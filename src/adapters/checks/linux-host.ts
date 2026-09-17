import {spawn, execFile} from "node:child_process";
import {createHash, randomUUID} from "node:crypto";
import {copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile} from "node:fs/promises";
import {isAbsolute, join, relative, sep} from "node:path";
import {promisify} from "node:util";
import {canonicalJson, parseCanonicalJson, type CanonicalValue} from "../../kernel/data-contracts/canonical-json.ts";
import {failure, success} from "../../kernel/data-contracts/outcome.ts";
import {decodeContract, exactRecord, requiredField} from "../../kernel/data-contracts/validation.ts";
import {createCheckResult, decodeCheckAdoption, decodeCheckDefinition, decodeCheckInput, prepareCheckSelection} from "../../kernel/gates/checks.ts";
import {createDecisionValidationResult, prepareDecisionValidation} from "../../kernel/gates/decision-validation.ts";
import {decisionValidatorArtifact} from "../../kernel/gates/decision-validators.ts";
import {CHANGEKERNEL_VERSION} from "../../kernel/identity/version.ts";
import {semanticDigest} from "../../kernel/identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {CHECK_MODEL_PORT_PROTOCOL, UncertainCheckModelCustody, decodeCheckModelStructure, decodeCheckModelValue, type CheckModelPort} from "../../ports/check-model.ts";
import {CHECK_WORKER_PROTOCOL, CHECK_WORKER_SOURCE} from "./worker-source.ts";
import {openCheckJournal, type RetainedCheckValue} from "./journal.ts";

const execute = promisify(execFile);
const LIBRARIES = ["libdl.so.2", "libstdc++.so.6", "libm.so.6", "libgcc_s.so.1", "libpthread.so.0", "libc.so.6", "ld-linux-x86-64.so.2"];
const PROFILE = "changekernel.check-host.linux-systemd-bwrap@3.0.0";
export interface LinuxCheckHostOptions {
	/** Owner-private persistent directory outside the project checkout. Never rotate it to retry. */
	readonly custodyRoot: string;
	/** Identity returned by explicit one-time journal provisioning. */
	readonly stateIdentity: Sha256Digest;
	/** Authenticated backend decision, never supplied by a Check or candidate. */
	readonly authorize: (binding: Readonly<{selectionDigest: Sha256Digest; inputDigest: Sha256Digest; executionDigest: Sha256Digest; permissionDigest: Sha256Digest}>) => boolean;
	readonly model?: CheckModelPort;
	/** Exact verified running Kernel Build. Omission disables backend Decision execution. */
	readonly kernelBuildDigest?: Sha256Digest;
}
interface RunFailure {readonly code: "invalid-input" | "not-ready" | "denied" | "unsupported" | "already-attempted" | "operational-error"; readonly message: string;}
function issue(code: RunFailure["code"], message: string) {return failure(Object.freeze({code, message}));}
function bytesDigest(value: string | Uint8Array): Sha256Digest {return `sha256:${createHash("sha256").update(value).digest("hex")}`;}
function json(value: unknown): string {
	const encoded = canonicalJson(value);
	if (!encoded.ok) throw new Error("Non-canonical execution data.");
	return encoded.value;
}

/**
 * Narrow Linux/x64/glibc host. The service manager enforces whole-process-group
 * memory, swap, task and wall-time bounds. Bubblewrap supplies a read-only root,
 * isolated network/process namespaces and no project, home, sockets or credentials.
 * Node permissions are additional restrictions, not the containment boundary.
 * The durable journal retains exact completions and blocks unresolved attempts.
 * Unknown custody is never reclaimed automatically on restart.
 */
export async function createLinuxCheckHost(options: LinuxCheckHostOptions) {
	if (process.platform !== "linux" || process.arch !== "x64" || !isAbsolute(options.custodyRoot) || typeof options.authorize !== "function") return issue("unsupported", "Linux x64, an external custody root and an authenticated authorizer are required.");
	const authorize = options.authorize, kernelBuildDigest = options.kernelBuildDigest;
	if (kernelBuildDigest !== undefined && !decodeSha256Digest(kernelBuildDigest).ok) return issue("unsupported", "Backend validation requires an exact verified Kernel Build.");
	const model = options.model ? Object.freeze({...options.model, call: options.model.call.bind(options.model)}) : undefined;
	if (model && (model.protocol !== CHECK_MODEL_PORT_PROTOCOL || !["local", "private"].includes(model.locality))) return issue("unsupported", "Only explicitly configured local or private model routes are supported.");
	let directory: string | undefined;
	try {
		const cwd = await realpath(process.cwd()), root = await realpath(options.custodyRoot);
		const location = relative(cwd, root);
		if (!location || (!location.startsWith(`..${sep}`) && location !== ".." && !isAbsolute(location))) return issue("unsupported", "Check custody must be outside the project checkout.");
		const journal = await openCheckJournal(root, options.stateIdentity);
		directory = await mkdtemp(join(root, "check-host-"));
		const runtime = join(directory, "runtime"); await mkdir(runtime, {mode: 0o700});
		const identities: Record<string, string> = {};
		for (const [name, path] of [["node", process.execPath], ...LIBRARIES.map(name => [name, `/usr/lib/${name}`])]) {
			if (!name || !path) throw new Error("Incomplete runtime binding.");
			await copyFile(await realpath(path), join(runtime, name));
			identities[name] = bytesDigest(await readFile(join(runtime, name)));
		}
		for (const binary of ["bwrap", "systemd-run", "systemctl"]) identities[binary] = bytesDigest(await readFile(`/usr/bin/${binary}`));
		const identity = semanticDigest(PROFILE, {identities, worker: bytesDigest(CHECK_WORKER_SOURCE), profile: PROFILE});
		if (!identity.ok) throw new Error("Runtime identity is invalid.");
		const dependenciesDigest = identity.value;
		const active = new Set<Promise<unknown>>();
		let disposed = false, custodyUncertain = false, retainCustody = false;
		const custody = directory;
		return success(Object.freeze({dependenciesDigest,
			run(input: unknown, signal?: AbortSignal) {return dispatch("domain", input, signal);},
			runDecision(input: unknown, signal?: AbortSignal) {return dispatch("decision", input, signal);},
			async dispose() {
				disposed = true;
				await Promise.allSettled([...active]);
				if (!retainCustody) await rm(custody, {recursive: true, force: true});
			},
		}));

		async function dispatch(kind: "domain" | "decision", input: unknown, signal?: AbortSignal) {
			if (disposed || custodyUncertain || active.size) return issue("unsupported", "Execution host is closed, busy or has unresolved execution custody.");
			const task = run(kind, input, signal); active.add(task);
			try {return await task;} catch {return issue("operational-error", "Host admission or cleanup failed; no semantic result is available.");} finally {active.delete(task);}
		}
		async function run(kind: "domain" | "decision", input: unknown, signal?: AbortSignal) {
			const prepared = kind === "domain" ? prepareDomainRun(input) : prepareDecisionRun(input, kernelBuildDigest);
			if (!prepared.ok) return prepared;
			const {entry, definition, selectedInput, execution, selectionDigest, artifact, origin} = prepared.value;
			if (typeof artifact !== "string" || Buffer.byteLength(artifact) > 128 * 1024 || bytesDigest(artifact) !== definition.implementation.artifactDigest || definition.implementation.dependenciesDigest !== dependenciesDigest) return issue("invalid-input", "Artifact or runtime bytes differ from the bound implementation.");
			if (execution.model && (!model || model.routeDigest !== execution.model.routeDigest || model.settingsDigest !== execution.model.settingsDigest)) return issue("denied", "The exact authorized model route and settings are unavailable; no fallback.");
			if (execution.limits.memoryBytes < 64 * 1024 * 1024) return issue("unsupported", "This Node execution profile requires at least 64 MiB, including containment overhead.");
			const inputText = json({input: selectedInput, parameters: execution.parameters});
			if (Buffer.byteLength(inputText) > execution.limits.inputBytes) return issue("invalid-input", "Selected inputs and parameters exceed the execution input budget.");
			if (signal?.aborted) return issue("operational-error", "Execution was cancelled before launch.");
			const binding = Object.freeze({selectionDigest, inputDigest: entry.inputDigest, executionDigest: entry.executionDigest, permissionDigest: execution.permissionDigest});
			if (authorize(binding) !== true) return issue("denied", "Current authority does not permit this exact execution.");
			let attempt;
			try {attempt = await journal.begin(binding);} catch {
				custodyUncertain = true;
				return issue("operational-error", "Check state is unavailable, conflicting or unresolved; no execution or automatic retry is permitted.");
			}
			if (attempt.kind === "retained") {
				const value = attempt.value;
				const wrongOwner = value && (origin ? !("owner" in value.result) || value.result.kernelBuildDigest !== origin.kernelBuildDigest ||
					value.result.kernelVersion !== origin.kernelVersion || value.result.definitionDigest !== origin.definitionDigest : "owner" in value.result);
				if (value && (wrongOwner || value.dependenciesDigest !== dependenciesDigest || value.result.checkId !== entry.checkId || value.result.producerId !== "changekernel:producer:linux-check-host" || value.modelCalls > execution.limits.modelCalls || Buffer.byteLength(json(value.result)) > execution.limits.outputBytes || value.result.evidenceDigests.some(digest => !entry.evidenceDigests.includes(digest)))) {
					custodyUncertain = true; return issue("operational-error", "Retained Check violates its current binding or result bounds.");
				}
				if (signal?.aborted) return issue("operational-error", "Retained result delivery was cancelled.");
				if (authorize(binding) !== true) return issue("denied", "Current authority does not permit retained result delivery.");
				if (!value) return issue("already-attempted", "This execution previously failed; retry requires explicit investigation and authorization.");
				return success(Object.freeze({...value, modelCalls: 0, reused: true}));
			}
			let scratch: string | undefined, completed: RetainedCheckValue | undefined;
			try {
				// Host binaries must still match the profile admitted into the definition.
				for (const binary of ["bwrap", "systemd-run", "systemctl"]) if (identities[binary] !== bytesDigest(await readFile(`/usr/bin/${binary}`))) throw new Error("Containment binary changed.");
				scratch = await mkdtemp(join(custody, "run-"));
				const writes = await Promise.allSettled([
					writeFile(join(scratch, "worker.mjs"), CHECK_WORKER_SOURCE, {mode: 0o400}),
					writeFile(join(scratch, "check.mjs"), artifact, {mode: 0o400}),
					writeFile(join(scratch, "input.json"), inputText, {mode: 0o400}),
				]);
				if (writes.some(write => write.status === "rejected")) throw new Error("Execution material could not be prepared.");
				if (signal?.aborted || authorize(binding) !== true) throw new Error("Authority or cancellation changed before dispatch.");
				const output = await executeIsolated(runtime, scratch, execution.limits, execution.model ? model : undefined, signal);
				const decoded = decodeContract("Check return", output.value, value => exactRecord("Check return", value, "$", ["passed", "failureKind", "feedback", "evidenceDigests", "limitations"]));
				if (!decoded.ok) throw new Error("Check returned a malformed semantic result.");
				const envelope = {...decoded.value, checkId: entry.checkId, inputDigest: entry.inputDigest, executionDigest: entry.executionDigest,
					producerId: "changekernel:producer:linux-check-host", status: "completed"};
				const result = origin ? createDecisionValidationResult({...envelope, ...origin}) : createCheckResult(envelope);
				if (!result.ok || Buffer.byteLength(json(result.value)) > execution.limits.outputBytes || result.value.evidenceDigests.some(digest => !entry.evidenceDigests.includes(digest))) throw new Error("Check result violates its exact result or Evidence bounds.");
				completed = Object.freeze({result: result.value, dependenciesDigest, modelCalls: output.modelCalls});
			} catch (error) {
				if (error instanceof UncertainCustody) custodyUncertain = true;
			} finally {
				if (scratch && custodyUncertain) retainCustody = true;
				else try {if (scratch) await rm(scratch, {recursive: true, force: true});} catch {custodyUncertain = true; retainCustody = true;}
			}
			// Publish only after execution, provider custody and scratch cleanup settle.
			// If publication fails, retain the reservation and block this host too.
			if (!custodyUncertain) try {await attempt.finish(completed ?? null);} catch {custodyUncertain = true;}
			if (custodyUncertain) return issue("operational-error", "Execution custody or durable completion is unresolved; explicit investigation is required. No semantic verdict is available.");
			if (completed) {
				if (signal?.aborted) return issue("operational-error", "Completed result delivery was cancelled; completion is retained.");
				if (authorize(binding) !== true) return issue("denied", "Current authority does not permit completed result delivery.");
				return success(Object.freeze({...completed, reused: false}));
			}
			return issue("operational-error", "Execution, containment, model service or result validation failed; no semantic verdict was fabricated. Retry requires explicit investigation and authorization.");
		}
	} catch {
		if (directory) await rm(directory, {recursive: true, force: true});
		return issue("unsupported", "The pinned Linux runtime could not be prepared; no in-process fallback is supported.");
	}
}

function prepareDomainRun(input: unknown) {
	const request = decodeContract("Check launch", input, value => exactRecord("Check launch", value, "$", ["selection", "checkId", "artifact"]), {maximumDepth: 40, maximumEntriesPerContainer: 256, maximumNodes: 262144, maximumTextBytes: 4 * 1024 * 1024});
	if (!request.ok) return issue("invalid-input", request.error.message);
	const selection = prepareCheckSelection(request.value.selection);
	if (!selection.ok) return issue("invalid-input", selection.error.message);
	const entry = selection.value.entries.find(entry => entry.checkId === request.value.checkId);
	if (!entry || entry.readiness !== "ready") return issue("not-ready", "Only an explicitly adopted, active, ready Check can execute.");
	const material = decodeContract("Check launch material", request.value.selection, value => {
		const r = exactRecord("Check launch material", value, "$", ["current", "adoption", "packs", "definitions", "inputs"]);
		return {adoption: r.adoption, definitions: r.definitions, inputs: r.inputs};
	}, {maximumDepth: 40, maximumEntriesPerContainer: 256, maximumNodes: 262144, maximumTextBytes: 4 * 1024 * 1024});
	if (!material.ok || !Array.isArray(material.value.definitions) || !Array.isArray(material.value.inputs)) return issue("invalid-input", "Incomplete launch material.");
	const definition = material.value.definitions.map(value => decodeCheckDefinition(value)).find(value => value.ok && value.value.checkId === entry.checkId);
	const selectedInput = material.value.inputs.map(value => decodeCheckInput(value)).find(value => value.ok && value.value.checkId === entry.checkId);
	const adoption = decodeCheckAdoption(material.value.adoption);
	if (!definition?.ok || !selectedInput?.ok || !adoption.ok) return issue("invalid-input", "Incomplete exact Check binding.");
	const adopted = adoption.value.checks.find(value => value.check.checkId === entry.checkId);
	if (!adopted) return issue("invalid-input", "Check is not adopted.");
	const artifact = request.value.artifact;
	return success({entry, definition: definition.value, selectedInput: selectedInput.value, execution: adopted,
		selectionDigest: selection.value.digest, artifact, origin: null});
}

function prepareDecisionRun(input: unknown, kernelBuildDigest: Sha256Digest | undefined) {
	if (!kernelBuildDigest) return issue("unsupported", "Backend Decision validation is not bound to a verified Kernel Build.");
	const request = decodeContract("Decision launch", input, value => exactRecord("Decision launch", value, "$", ["selection", "validatorId"]), {maximumDepth: 44, maximumEntriesPerContainer: 256, maximumNodes: 524288, maximumTextBytes: 8 * 1024 * 1024});
	if (!request.ok) return issue("invalid-input", request.error.message);
	const selection = prepareDecisionValidation(request.value.selection);
	if (!selection.ok) return issue("invalid-input", selection.error.message);
	if (selection.value.current.kernelBuildDigest !== kernelBuildDigest) return issue("denied", "Decision validation differs from the verified running Kernel Build.");
	const entry = selection.value.entries.find(value => value.checkId === request.value.validatorId);
	if (!entry || entry.readiness !== "ready") return issue("not-ready", "Only a ready release-owned Decision condition can execute.");
	const definition = selection.value.definitions.find(value => value.checkId === entry.checkId), selectedInput = selection.value.inputs.find(value => value.checkId === entry.checkId);
	if (!definition || !selectedInput) return issue("invalid-input", "Incomplete release-owned Decision material.");
	return success({entry, definition, selectedInput, execution: {...selection.value.configuration, parameters: {}}, selectionDigest: selection.value.digest,
		artifact: decisionValidatorArtifact(entry.checkId), origin: {owner: "backend", stage: "decision", kernelVersion: CHANGEKERNEL_VERSION,
			kernelBuildDigest, definitionDigest: definition.digest}});
}

// Executed budgets are the narrower authorized envelope, not an evaluator maximum.
type ExecutionLimits = {readonly milliseconds: number; readonly memoryBytes: number; readonly inputBytes: number; readonly outputBytes: number; readonly modelCalls: number; readonly modelInputTokens: number; readonly modelOutputTokens: number};

async function executeIsolated(runtime: string, scratch: string, limits: ExecutionLimits, model: CheckModelPort | undefined, signal?: AbortSignal): Promise<{value: CanonicalValue; modelCalls: number}> {
	const unit = `changekernel-check-${randomUUID()}.service`;
	const properties = ["Type=exec", "KillMode=control-group", "TimeoutStopSec=1s", "SendSIGKILL=yes", "OOMPolicy=kill", "NoNewPrivileges=yes", "TasksMax=32", "MemorySwapMax=0", "LimitCORE=0", `MemoryMax=${limits.memoryBytes}`, `RuntimeMaxSec=${limits.milliseconds}ms`];
	const args = ["--user", "--quiet", "--wait", "--pipe", "--collect", `--unit=${unit}`, ...properties.map(value => `--property=${value}`), "--", "/usr/bin/bwrap",
		"--unshare-all", "--unshare-user", "--disable-userns", "--die-with-parent", "--new-session", "--cap-drop", "ALL", "--clearenv",
		"--ro-bind", runtime, "/runtime", "--ro-bind", scratch, "/app", "--symlink", "runtime", "/lib64", "--dev", "/dev",
		"--setenv", "LD_LIBRARY_PATH", "/runtime", "--chdir", "/app", "--remount-ro", "/",
		"/runtime/node", "--permission", "--allow-fs-read=/app", "--no-addons", "--disable-proto=throw", "/app/worker.mjs"];
	const controller = new AbortController();
	let failure: Error | undefined, pending = false, admitted = false, forced = false, modelCustodyUncertain = false, modelCalls = 0, inputBudget = limits.modelInputTokens, outputBudget = limits.modelOutputTokens;
	let result: CanonicalValue | undefined, buffered = Buffer.alloc(0), stdoutBytes = 0, stderrBytes = 0;
	const child = spawn("/usr/bin/systemd-run", args, {stdio: ["pipe", "pipe", "pipe"]});
	let stopping: Promise<unknown> | undefined;
	const stop = () => {
		failure ??= new Error("Isolated execution did not complete within its bounds.");
		controller.abort();
		stopping ??= execute("/usr/bin/systemctl", ["--user", "stop", unit], {timeout: 5000, maxBuffer: 4096}).catch(() => undefined);
	};
	const timer = setTimeout(stop, limits.milliseconds);
	const watchdog = setTimeout(() => {forced = true; stop(); child.kill("SIGKILL");}, limits.milliseconds + 6000);
	signal?.addEventListener("abort", stop, {once: true});
	if (signal?.aborted) stop();
	child.stdin.on("error", stop);
	child.stdout.on("data", (chunk: Buffer) => {
		stdoutBytes += chunk.length;
		if (stdoutBytes > limits.outputBytes + limits.modelCalls * (limits.inputBytes + 4096) || buffered.length + chunk.length > 512 * 1024) {stop(); return;}
		buffered = Buffer.concat([buffered, chunk]);
		while (!failure) {
			const boundary = buffered.indexOf(10);
			if (boundary < 0) break;
			const lineBytes = buffered.subarray(0, boundary), line = lineBytes.toString("utf8");
			buffered = buffered.subarray(boundary + 1);
			if (!Buffer.from(line, "utf8").equals(lineBytes)) {stop(); break;}
			const parsed = parseCanonicalJson(line, {requireCanonicalBytes: true});
			if (!parsed.ok || result !== undefined || pending) {stop(); break;}
			const message = decodeContract("Check message", parsed.value, value => {
				const r = exactRecord("Check message", value, "$", ["protocol", "type"], ["id", "prompt", "shape", "value"]);
				if (r.protocol !== CHECK_WORKER_PROTOCOL) throw new Error("Unsupported worker protocol.");
				if (r.type === "ready") return exactRecord("Check message", value, "$", ["protocol", "type"]);
				if (r.type === "result") return exactRecord("Check message", value, "$", ["protocol", "type", "value"]);
				if (r.type === "model") return exactRecord("Check message", value, "$", ["protocol", "type", "id", "prompt", "shape"]);
				throw new Error("Unknown Check message.");
			});
			if (!message.ok) {stop(); break;}
			if (message.value.type === "ready" && !admitted) {
				pending = true;
				void verifyServiceBounds(unit, limits.memoryBytes).then(() => {
					pending = false;
					if (failure) return;
					admitted = true; child.stdin.write(json({protocol: CHECK_WORKER_PROTOCOL, id: 0, value: true}) + "\n");
				}).catch(() => {pending = false; stop();});
				continue;
			}
			if (!admitted || message.value.type === "ready") {stop(); break;}
			if (message.value.type === "result") {result = requiredField("Check message", message.value, "value"); continue;}
			const r = message.value;
			if (!model || modelCalls >= limits.modelCalls || r.id !== modelCalls + 1 || outputBudget < 1) {stop(); break;}
			const decodedStructure = decodeCheckModelStructure(r.shape);
			if (!decodedStructure.ok || typeof r.prompt !== "string" || !r.prompt.trim()) {stop(); break;}
			const shape = decodedStructure.value;
			const reservedInput = Buffer.byteLength(json({prompt: r.prompt, shape})) + 1024;
			if (reservedInput > inputBudget || Buffer.byteLength(r.prompt) > limits.inputBytes) {stop(); break;}
			inputBudget -= reservedInput; modelCalls++; pending = true;
			const maximumOutputTokens = outputBudget;
			const prompt = r.prompt;
			void Promise.resolve().then(() => model.call(Object.freeze({prompt, shape, maximumInputTokens: reservedInput, maximumOutputTokens, maximumResponseBytes: limits.outputBytes}), controller.signal)).then(response => {
				if (failure) return;
				if (!Number.isSafeInteger(response.inputTokens) || response.inputTokens < 0 || response.inputTokens > reservedInput || !Number.isSafeInteger(response.outputTokens) || response.outputTokens < 0 || response.outputTokens > maximumOutputTokens) throw new Error("Invalid provider usage.");
				const decodedValue = decodeCheckModelValue(response.value, shape);
				if (!decodedValue.ok) throw new Error("Malformed model output.");
				const value = decodedValue.value;
				if (Buffer.byteLength(json(value)) > limits.outputBytes) throw new Error("Excess model output.");
				outputBudget -= response.outputTokens;
				pending = false;
				child.stdin.write(json({protocol: CHECK_WORKER_PROTOCOL, id: r.id, value}) + "\n");
			}).catch(error => {pending = false; modelCustodyUncertain = error instanceof UncertainCheckModelCustody; stop();});
		}
	});
	child.stderr.on("data", (chunk: Buffer) => {stderrBytes += chunk.length; if (stderrBytes > 4096) stop();});
	try {
		const code = await new Promise<number | null>((resolve, reject) => {child.once("error", reject); child.once("close", resolve);});
		try {
			const {stdout} = await execute("/usr/bin/systemctl", ["--user", "show", "--property=ActiveState", "--value", unit], {timeout: 1000, maxBuffer: 4096});
			if (!["inactive", "failed"].includes(stdout.trim())) throw new Error("Service has not stopped.");
		} catch {throw new UncertainCustody("Service closure could not be confirmed.");}
		if (pending || forced || modelCustodyUncertain) throw new UncertainCustody("Provider or process closure is unproven.");
		if (failure || code !== 0 || result === undefined || buffered.length) throw new Error("Incomplete isolated execution.");
		return {value: result, modelCalls};
	} finally {
		clearTimeout(timer); clearTimeout(watchdog); signal?.removeEventListener("abort", stop); controller.abort();
		if (stopping) await stopping;
	}
}

class UncertainCustody extends Error {}

/** Verify effective kernel controls before the worker imports any custom code. */
async function verifyServiceBounds(unit: string, memoryBytes: number): Promise<void> {
	const {stdout} = await execute("/usr/bin/systemctl", ["--user", "show", "--property=ControlGroup", "--value", unit], {timeout: 1000, maxBuffer: 4096});
	const group = stdout.trim();
	if (!group.startsWith("/user.slice/") || group.split("/").some(part => part === "..") || !group.endsWith(`/${unit}`)) throw new Error("Unexpected execution control group.");
	const base = `/sys/fs/cgroup${group}`;
	for (const [name, maximum] of [["memory.max", memoryBytes], ["memory.swap.max", 0], ["pids.max", 32]] as const) {
		const value = (await readFile(join(base, name), "utf8")).trim();
		if (!/^(0|[1-9][0-9]*)$/u.test(value) || Number(value) > maximum) throw new Error("Required kernel limit is not enforced.");
	}
}
