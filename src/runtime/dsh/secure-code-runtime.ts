import {spawn, type ChildProcessWithoutNullStreams} from "node:child_process";
import {readFileSync, realpathSync, statSync} from "node:fs";
import type {Context} from "@deepseek-ai/cordis";
import {
	CodeRuntime,
	DUNDER_MEMBER,
	PORTABLE_RESERVED_WORDS,
	RESERVED_BINDING_GLOBALS,
	RESERVED_ERROR_MEMBERS,
	type CodeBindingNamespace,
	type CodeJsonValue,
	type CodeRunFailure,
	type CodeRunRequest,
	type CodeRunResult,
} from "@deepseek-ai/dsh-code-runtime";

import {
	assertBubblewrapSandboxProfile,
	createBubblewrapLaunchCommand,
	normalizeBubblewrapSandboxProfile,
	type BubblewrapSandboxProfile,
	type SandboxExecutableIdentity,
} from "../sandbox/bubblewrap.ts";
import {
	canonicalJson,
	sha256Digest,
	toCanonicalJsonValue,
} from "../../utils/canonical-json.ts";
import {SECURE_CODE_WORKER_SOURCE} from "./secure-code-worker-source.ts";

export interface SecureCodeRuntimeConfig {
	readonly sandbox: BubblewrapSandboxProfile;
	readonly node: SandboxExecutableIdentity;
	readonly maxProgramBytes: number;
	readonly maxFrameBytes: number;
	readonly maxOutputBytes: number;
	readonly maxBindingCalls: number;
	readonly maxBindingBytes: number;
	readonly maxWallMs: number;
	readonly maxOldGenerationSizeMb: number;
}

interface WorkerBoot {
	readonly protocol: "codewiki.secure-code-worker@1.0.0";
	readonly program: string;
	readonly namespaces: readonly {
		readonly global: string;
		readonly names: readonly string[];
		readonly errorClass?: {
			readonly name: string;
			readonly memberNameProperty: string;
		};
	}[];
}

interface ActiveCodeRun {
	readonly child: ChildProcessWithoutNullStreams;
	terminate(): Promise<void>;
}

export class SecureCodeRuntime extends CodeRuntime {
	readonly language = "typescript";
	readonly isolation = "bubblewrap-process";
	private readonly config: SecureCodeRuntimeConfig;
	private readonly live = new Set<ActiveCodeRun>();
	private disposed = false;

	constructor(context: Context, config: SecureCodeRuntimeConfig) {
		super(context);
		assertSecureCodeRuntimeConfig(config);
		this.config = config;
		context.effect(() => () => this.teardown(), "secure code-runtime teardown");
	}

	async run(request: CodeRunRequest): Promise<CodeRunResult> {
		if (this.disposed) {
			throw new Error("Secure Code Runtime is disposed.");
		}
		assertCodeRunRequest(request);
		if (Buffer.byteLength(request.program, "utf8") > this.config.maxProgramBytes) {
			return failed("exception", "Program exceeds the admitted source-byte budget.");
		}
		if (request.signal?.aborted) {
			return failed("abort", "Code run was aborted before launch.");
		}
		return executeSecureCodeRun(this.config, request, this.live);
	}

	async teardown(): Promise<void> {
		this.disposed = true;
		await Promise.all([...this.live].map((run) => run.terminate()));
	}
}

export async function runSecureCodeProgram(
	config: SecureCodeRuntimeConfig,
	request: CodeRunRequest,
): Promise<CodeRunResult> {
	assertSecureCodeRuntimeConfig(config);
	assertCodeRunRequest(request);
	if (Buffer.byteLength(request.program, "utf8") > config.maxProgramBytes) {
		return failed("exception", "Program exceeds the admitted source-byte budget.");
	}
	if (request.signal?.aborted) {
		return failed("abort", "Code run was aborted before launch.");
	}
	return executeSecureCodeRun(config, request, new Set());
}

async function executeSecureCodeRun(
	config: SecureCodeRuntimeConfig,
	request: CodeRunRequest,
	live: Set<ActiveCodeRun>,
): Promise<CodeRunResult> {
	verifyNodeIdentity(config.node);
	const command = createBubblewrapLaunchCommand(config.sandbox, {
		executable: config.node.path,
		args: [
			"--permission",
			"--no-warnings",
			`--max-old-space-size=${config.maxOldGenerationSizeMb}`,
			"-e",
			SECURE_CODE_WORKER_SOURCE,
		],
		cwd: "/",
		mounts: nodeMount(config.node.path),
		disableNestedUserNamespaces: true,
	});
	const child = spawn(command.executable, command.args, {
		cwd: command.cwd,
		env: {},
		detached: true,
		shell: false,
		windowsHide: true,
		stdio: ["pipe", "pipe", "pipe"],
	});
	const active = activeCodeRun(child);
	live.add(active);
	try {
		return await driveCodeWorker(child, request, config, active);
	} finally {
		live.delete(active);
	}
}

interface CodeWorkerDriverState {
	readonly child: ChildProcessWithoutNullStreams;
	readonly request: CodeRunRequest;
	readonly config: SecureCodeRuntimeConfig;
	readonly active: ActiveCodeRun;
	readonly resolve: (result: CodeRunResult) => void;
	readonly logs: string[];
	readonly calls: Set<number>;
	readonly bindings: ReturnType<typeof bindingMap>;
	frameBuffer: Buffer;
	bindingCalls: number;
	bindingBytes: number;
	outputBytes: number;
	settled: boolean;
	stderr: string;
	timer: NodeJS.Timeout | null;
	onAbort: () => void;
}

function driveCodeWorker(
	child: ChildProcessWithoutNullStreams,
	request: CodeRunRequest,
	config: SecureCodeRuntimeConfig,
	active: ActiveCodeRun,
): Promise<CodeRunResult> {
	return new Promise((resolve) => {
		const state: CodeWorkerDriverState = {
			child,
			request,
			config,
			active,
			resolve,
			logs: [],
			calls: new Set(),
			bindings: bindingMap(request.bindings),
			frameBuffer: Buffer.alloc(0),
			bindingCalls: 0,
			bindingBytes: 0,
			outputBytes: 0,
			settled: false,
			stderr: "",
			timer: null,
			onAbort: () => {},
		};
		startCodeWorkerDriver(state);
	});
}

function startCodeWorkerDriver(state: CodeWorkerDriverState): void {
	state.onAbort = () => failCodeWorker(state, "abort", "Code run was aborted.");
	state.timer = setTimeout(
		() => failCodeWorker(state, "timeout", "Code run exceeded its wall-time budget."),
		state.config.maxWallMs,
	);
	state.request.signal?.addEventListener("abort", state.onAbort, {once: true});
	state.child.stderr.on("data", (chunk: Buffer) => appendWorkerStderr(state, chunk));
	state.child.stdout.on("data", (chunk: Buffer) => acceptWorkerChunk(state, chunk));
	state.child.once("error", (error) => {
		failCodeWorker(state, "worker-exit", `Secure code worker failed to launch: ${error.message}`);
	});
	state.child.once("exit", (code, signal) => acceptUnexpectedWorkerExit(state, code, signal));
	writeWorkerFrame(state.child, createWorkerBoot(state.request)).catch((error: Error) => {
		failCodeWorker(state, "worker-exit", `Secure code worker bootstrap failed: ${error.message}`);
	});
}

function appendWorkerStderr(state: CodeWorkerDriverState, chunk: Buffer): void {
	const remaining = state.config.maxFrameBytes - Buffer.byteLength(state.stderr, "utf8");
	if (remaining > 0) state.stderr += chunk.subarray(0, remaining).toString("utf8");
}

function acceptWorkerChunk(state: CodeWorkerDriverState, chunk: Buffer): void {
	if (state.settled) return;
	state.frameBuffer = Buffer.concat([state.frameBuffer, chunk]);
	for (;;) {
		const newline = state.frameBuffer.indexOf(0x0a);
		if (newline < 0) break;
		if (newline > state.config.maxFrameBytes) {
			failCodeWorker(state, "worker-exit", "Secure code worker emitted an oversized frame.");
			return;
		}
		const frame = state.frameBuffer.subarray(0, newline).toString("utf8");
		state.frameBuffer = state.frameBuffer.subarray(newline + 1);
		void acceptWorkerFrame(state, frame).catch((error: Error) => {
			failCodeWorker(state, "worker-exit", `Secure code worker protocol failed: ${error.message}`);
		});
	}
	if (state.frameBuffer.length > state.config.maxFrameBytes) {
		failCodeWorker(state, "worker-exit", "Secure code worker emitted an oversized frame.");
	}
}

async function acceptWorkerFrame(
	state: CodeWorkerDriverState,
	frame: string,
): Promise<void> {
	if (state.settled) return;
	const message = parseWorkerFrame(frame);
	if (!message) {
		failCodeWorker(state, "worker-exit", "Secure code worker emitted malformed protocol JSON.");
		return;
	}
	switch (message.type) {
		case "log":
			acceptWorkerLog(state, message);
			return;
		case "call":
			await acceptBindingCall(state, message);
			return;
		case "done":
			acceptWorkerDone(state, message);
			return;
		default:
			failCodeWorker(state, "worker-exit", "Secure code worker emitted an unsupported protocol message.");
	}
}

function acceptWorkerLog(
	state: CodeWorkerDriverState,
	message: Record<string, unknown>,
): void {
	if (typeof message.text !== "string") {
		failCodeWorker(state, "worker-exit", "Secure code worker emitted an invalid log message.");
		return;
	}
	if (!accountWorkerOutput(state, message.text)) return;
	state.logs.push(message.text);
}

async function acceptBindingCall(
	state: CodeWorkerDriverState,
	message: Record<string, unknown>,
): Promise<void> {
	const call = decodeBindingCall(message);
	if (!call) {
		failCodeWorker(state, "worker-exit", "Secure code worker emitted an invalid binding call.");
		return;
	}
	if (state.calls.has(call.id)) {
		failCodeWorker(state, "worker-exit", "Secure code worker repeated a binding call identity.");
		return;
	}
	state.calls.add(call.id);
	state.bindingCalls += 1;
	if (state.bindingCalls > state.config.maxBindingCalls) {
		await writeBindingFailure(state.child, call.id, "Binding call budget exhausted.");
		return;
	}
	const args = decodeBindingArguments(message.args);
	if (!args) {
		await writeBindingFailure(state.child, call.id, "Binding arguments are not lossless JSON.");
		return;
	}
	state.bindingBytes += byteLength(args);
	const binding = state.bindings.get(`${call.global}\0${call.name}`);
	if (!binding) {
		await writeBindingFailure(state.child, call.id, "Binding is not admitted.");
		return;
	}
	if (state.bindingBytes > state.config.maxBindingBytes) {
		await writeBindingFailure(state.child, call.id, "Binding byte budget exhausted.");
		return;
	}
	await executeBindingCall(state, call.id, binding, args);
}

async function executeBindingCall(
	state: CodeWorkerDriverState,
	id: number,
	binding: CodeBindingNamespace["functions"][string],
	args: CodeJsonValue,
): Promise<void> {
	try {
		const value = normalizeCodeJson(await binding(args));
		state.bindingBytes += byteLength(value);
		if (state.bindingBytes > state.config.maxBindingBytes) {
			await writeBindingFailure(state.child, id, "Binding byte budget exhausted.");
			return;
		}
		await writeWorkerFrame(state.child, {type: "reply", id, ok: true, value});
	} catch (error) {
		await writeBindingFailure(state.child, id, errorMessage(error));
	}
}

function acceptWorkerDone(
	state: CodeWorkerDriverState,
	message: Record<string, unknown>,
): void {
	if (message.error !== undefined) {
		acceptWorkerFailure(state, message.error);
		return;
	}
	if (message.value === undefined) {
		finishCodeWorker(state, {logs: state.logs});
		return;
	}
	try {
		const value = normalizeCodeJson(message.value);
		if (!accountWorkerOutput(state, value)) return;
		finishCodeWorker(state, {logs: state.logs, value});
	} catch {
		failCodeWorker(state, "invalid-output", "Program completion is not lossless JSON.");
	}
}

function acceptWorkerFailure(state: CodeWorkerDriverState, value: unknown): void {
	if (!isRecord(value) || !workerFailureKind(value.kind) || typeof value.message !== "string") {
		failCodeWorker(state, "worker-exit", "Secure code worker emitted an invalid failure.");
		return;
	}
	if (!accountWorkerOutput(state, value.message)) return;
	failCodeWorker(state, value.kind, value.message);
}

function accountWorkerOutput(state: CodeWorkerDriverState, value: unknown): boolean {
	state.outputBytes += byteLength(value);
	if (state.outputBytes <= state.config.maxOutputBytes) return true;
	failCodeWorker(state, "output-limit", "Code run exceeded its outer-output byte budget.");
	return false;
}

function failCodeWorker(
	state: CodeWorkerDriverState,
	kind: CodeRunFailure["kind"],
	message: string,
): void {
	finishCodeWorker(state, {logs: state.logs, error: {kind, message}});
}

function finishCodeWorker(
	state: CodeWorkerDriverState,
	result: CodeRunResult,
): void {
	if (state.settled) return;
	state.settled = true;
	if (state.timer) clearTimeout(state.timer);
	state.request.signal?.removeEventListener("abort", state.onAbort);
	void state.active.terminate().then(() => state.resolve(freezeResult(result)));
}

function acceptUnexpectedWorkerExit(
	state: CodeWorkerDriverState,
	code: number | null,
	signal: NodeJS.Signals | null,
): void {
	if (state.settled) return;
	const detail = state.stderr.trim().slice(0, 4096);
	failCodeWorker(
		state,
		"worker-exit",
		`Secure code worker exited before completion (code ${String(code)}, signal ${String(signal)}).${detail ? ` ${detail}` : ""}`,
	);
}

function parseWorkerFrame(frame: string): Record<string, unknown> | null {
	try {
		const value: unknown = JSON.parse(frame);
		return isRecord(value) && typeof value.type === "string" ? value : null;
	} catch {
		return null;
	}
}

function decodeBindingCall(
	message: Record<string, unknown>,
): {readonly id: number; readonly global: string; readonly name: string} | null {
	if (
		!Number.isSafeInteger(message.id) ||
		typeof message.global !== "string" ||
		typeof message.name !== "string"
	) return null;
	return {id: message.id as number, global: message.global, name: message.name};
}

function decodeBindingArguments(value: unknown): CodeJsonValue | null {
	try {
		return normalizeCodeJson(value);
	} catch {
		return null;
	}
}

function workerFailureKind(value: unknown): value is "exception" | "invalid-output" {
	return value === "exception" || value === "invalid-output";
}

function createWorkerBoot(request: CodeRunRequest): WorkerBoot {
	return {
		protocol: "codewiki.secure-code-worker@1.0.0",
		program: request.program,
		namespaces: request.bindings.map((binding) => ({
			global: binding.global,
			names: Object.keys(binding.functions).sort((left, right) => left.localeCompare(right)),
			...(binding.errorClass ? {errorClass: {...binding.errorClass}} : {}),
		})),
	};
}

function bindingMap(bindings: readonly CodeBindingNamespace[]): Map<string, CodeBindingNamespace["functions"][string]> {
	const result = new Map<string, CodeBindingNamespace["functions"][string]>();
	for (const namespace of bindings) {
		for (const [name, binding] of Object.entries(namespace.functions)) {
			result.set(`${namespace.global}\0${name}`, binding);
		}
	}
	return result;
}

export function normalizeSecureCodeRuntimeConfig(
	value: unknown,
): Readonly<SecureCodeRuntimeConfig> {
	if (!isRecord(value) || !hasExactKeys(value, [
		"sandbox",
		"node",
		"maxProgramBytes",
		"maxFrameBytes",
		"maxOutputBytes",
		"maxBindingCalls",
		"maxBindingBytes",
		"maxWallMs",
		"maxOldGenerationSizeMb",
	])) {
		throw new Error("Secure Code Runtime config shape is invalid.");
	}
	if (!isRecord(value.node) || !hasExactKeys(value.node, ["path", "version", "digest"])) {
		throw new Error("Secure Code Runtime Node identity shape is invalid.");
	}
	const config: SecureCodeRuntimeConfig = {
		sandbox: normalizeBubblewrapSandboxProfile(value.sandbox),
		node: Object.freeze({
			path: value.node.path as string,
			version: value.node.version as string,
			digest: value.node.digest as SandboxExecutableIdentity["digest"],
		}),
		maxProgramBytes: value.maxProgramBytes as number,
		maxFrameBytes: value.maxFrameBytes as number,
		maxOutputBytes: value.maxOutputBytes as number,
		maxBindingCalls: value.maxBindingCalls as number,
		maxBindingBytes: value.maxBindingBytes as number,
		maxWallMs: value.maxWallMs as number,
		maxOldGenerationSizeMb: value.maxOldGenerationSizeMb as number,
	};
	assertSecureCodeRuntimeConfig(config);
	return Object.freeze(config);
}

function assertSecureCodeRuntimeConfig(config: SecureCodeRuntimeConfig): void {
	if (!config || typeof config !== "object") {
		throw new Error("Secure Code Runtime config is invalid.");
	}
	assertBubblewrapSandboxProfile(config.sandbox);
	assertNodeIdentityShape(config.node);
	for (const field of [
		"maxProgramBytes",
		"maxFrameBytes",
		"maxOutputBytes",
		"maxBindingCalls",
		"maxBindingBytes",
		"maxWallMs",
		"maxOldGenerationSizeMb",
	] as const) {
		if (!Number.isSafeInteger(config[field]) || config[field] < 1) {
			throw new Error(`Secure Code Runtime ${field} must be a positive safe integer.`);
		}
	}
}

function assertCodeRunRequest(request: CodeRunRequest): void {
	if (!request || typeof request.program !== "string" || !Array.isArray(request.bindings)) {
		throw new Error("Secure Code Runtime request is invalid.");
	}
	const globals = new Set<string>();
	for (const binding of request.bindings) {
		if (!portableIdentifier(binding.global) || RESERVED_BINDING_GLOBALS.has(binding.global) || globals.has(binding.global)) {
			throw new Error("Secure Code Runtime binding global is invalid or duplicated.");
		}
		globals.add(binding.global);
	}
	for (const binding of request.bindings) {
		if (!binding.functions || typeof binding.functions !== "object") {
			throw new Error("Secure Code Runtime binding functions are invalid.");
		}
		for (const value of Object.values(binding.functions)) {
			if (typeof value !== "function") {
				throw new Error("Secure Code Runtime binding member must be a function.");
			}
		}
		if (binding.errorClass) {
			assertErrorClass(binding.errorClass, globals);
			globals.add(binding.errorClass.name);
		}
	}
}

function assertErrorClass(
	errorClass: NonNullable<CodeBindingNamespace["errorClass"]>,
	globals: ReadonlySet<string>,
): void {
	if (!portableIdentifier(errorClass.name) || RESERVED_BINDING_GLOBALS.has(errorClass.name) || globals.has(errorClass.name)) {
		throw new Error("Secure Code Runtime binding error class is invalid or colliding.");
	}
	if (typeof errorClass.memberNameProperty !== "string" || !errorClass.memberNameProperty || RESERVED_ERROR_MEMBERS.has(errorClass.memberNameProperty) || DUNDER_MEMBER.test(errorClass.memberNameProperty)) {
		throw new Error("Secure Code Runtime binding error member is invalid.");
	}
}

function portableIdentifier(value: string): boolean {
	return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) && !PORTABLE_RESERVED_WORDS.has(value);
}

function assertNodeIdentityShape(identity: SandboxExecutableIdentity): void {
	if (
		!identity ||
		typeof identity.path !== "string" ||
		typeof identity.version !== "string" ||
		!/^sha256:[0-9a-f]{64}$/.test(identity.digest)
	) {
		throw new Error("Secure Code Runtime Node identity is invalid.");
	}
}

function verifyNodeIdentity(identity: SandboxExecutableIdentity): void {
	assertNodeIdentityShape(identity);
	if (realpathSync(identity.path) !== identity.path || !statSync(identity.path).isFile()) {
		throw new Error("Secure Code Runtime Node executable is invalid.");
	}
	if (sha256Digest(readFileSync(identity.path)) !== identity.digest) {
		throw new Error("Secure Code Runtime Node executable digest changed.");
	}
	if (identity.version !== process.version) {
		throw new Error("Secure Code Runtime Node version changed.");
	}
}

function nodeMount(path: string): readonly {source: string; destination: string; access: "read-only"}[] {
	return path.startsWith("/usr/") ? [] : [{source: path, destination: path, access: "read-only"}];
}

function activeCodeRun(child: ChildProcessWithoutNullStreams): ActiveCodeRun {
	let termination: Promise<void> | undefined;
	return {
		child,
		terminate() {
			termination ??= terminateProcessGroup(child);
			return termination;
		},
	};
}

async function terminateProcessGroup(child: ChildProcessWithoutNullStreams): Promise<void> {
	if (child.exitCode !== null || child.signalCode !== null) return;
	try {
		process.kill(-child.pid!, "SIGKILL");
	} catch {
		child.kill("SIGKILL");
	}
	await new Promise<void>((resolve) => child.once("exit", () => resolve()));
}

async function writeBindingFailure(
	child: ChildProcessWithoutNullStreams,
	id: number,
	message: string,
): Promise<void> {
	await writeWorkerFrame(child, {
		type: "reply",
		id,
		ok: false,
		message: message.slice(0, 4096),
	});
}

function writeWorkerFrame(
	child: ChildProcessWithoutNullStreams,
	value: unknown,
): Promise<void> {
	const bytes = `${canonicalJson(value)}\n`;
	return new Promise((resolve, reject) => {
		child.stdin.write(bytes, (error) => error ? reject(error) : resolve());
	});
}

function freezeResult(result: CodeRunResult): CodeRunResult {
	return Object.freeze({
		logs: [...result.logs],
		...(result.value === undefined ? {} : {value: result.value}),
		...(result.error ? {error: Object.freeze({...result.error})} : {}),
	});
}

function failed(kind: CodeRunFailure["kind"], message: string): CodeRunResult {
	return freezeResult({logs: [], error: {kind, message}});
}

function normalizeCodeJson(value: unknown): CodeJsonValue {
	return structuredClone(toCanonicalJsonValue(value)) as CodeJsonValue;
}

function byteLength(value: unknown): number {
	return Buffer.byteLength(canonicalJson(value), "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
	value: Record<string, unknown>,
	expected: readonly string[],
): boolean {
	const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
	const wanted = [...expected].sort((left, right) => left.localeCompare(right));
	return keys.length === wanted.length && keys.every((key, index) => key === wanted[index]);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
