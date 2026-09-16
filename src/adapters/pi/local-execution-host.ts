import {isAbsolute, join} from "node:path";

import {decodeCanonicalValue, type CanonicalValue} from "../../kernel/data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import type {Sha256Digest} from "../../kernel/identity/sha256.ts";
import {decodeSha256Digest} from "../../kernel/identity/sha256.ts";
import {
	agentRunCancellationRequestDigest,
	agentRunInspectRequestDigest,
	agentRunStartRequestDigest,
	createAgentRunQuiescence,
	createAgentRunReceipt,
	decodeAgentRunAuthorization,
	type AgentRunCancellationRequest,
	type AgentRunHandle,
	type AgentRunInspectRequest,
	type AgentRunMaterial,
	type AgentRunOperationalStatus,
	type AgentRunQuiescence,
	type AgentRunReceipt,
} from "../../ports/agent-runtime.ts";
import {PI_EXECUTION_HOST_PROTOCOL, type PiExecutionHost} from "./agent-runtime.ts";
import {PI_EXECUTION_OUTPUT_HOST_PROTOCOL, type PiExecutionOutputHost} from "./agent-output.ts";
import {AGENT_RUN_OUTPUT_PROTOCOL, MAXIMUM_AGENT_OUTPUT_BYTES, decodeAgentRunOutput, decodeAgentRunOutputRequest, type AgentRunOutput} from "../../ports/agent-output.ts";
import {runPiSession, type PiProviderInstaller, type PiSessionRunResult} from "./session-runner.ts";

export const LOCAL_PI_EXECUTION_HOST_PROTOCOL = Object.freeze({
	id: "codewiki.adapter.pi-execution-host.local",
	version: "1.0.0",
} as const);

export type LocalPiExecutionHostSuccess = Readonly<{
	ok: true;
	value: AgentRunHandle;
}>;

export type LocalPiExecutionHostFailure = Readonly<{
	ok: false;
	error: Readonly<{code: string; message: string}>;
}>;

export type LocalPiExecutionHostResponse = LocalPiExecutionHostSuccess | LocalPiExecutionHostFailure;

export interface LocalPiExecutionHostOptions {
	/** Absolute owner-private custody root for session logs and scratch state. */
	readonly custodyRoot: string;
	readonly providerInstaller: PiProviderInstaller;
	readonly maximumConcurrentRuns?: number;
	readonly maximumTrackedRuns?: number;
	/** Output custody is transient; eviction never authorizes automatic re-execution. */
	readonly maximumRetainedOutputBytes?: number;
	readonly clock?: () => string;
}

export interface LocalPiExecutionHostIssue {
	readonly code: "invalid_options";
	readonly message: string;
}

interface TrackedRun {
	readonly runId: string;
	readonly authorizationDigest: Sha256Digest;
	readonly controller: AbortController;
	status: AgentRunOperationalStatus;
	receipt: AgentRunReceipt | null;
	quiescence: AgentRunQuiescence | null;
	cancellationDigest: Sha256Digest | null;
	output: AgentRunOutput | null;
}

/**
 * Bounded in-process Execution Host for one Project Server. Pi Sessions, the
 * provider installer, and custody paths stay host-private; responses are one
 * strict protocol envelope. A qualified deployment may replace this host with
 * the sandboxed Run Process host without touching the Agent Runtime port.
 */
export function createLocalPiExecutionHost(
	options: LocalPiExecutionHostOptions,
): Outcome<PiExecutionHost & PiExecutionOutputHost, LocalPiExecutionHostIssue> {
	if (typeof options !== "object" || options === null || !isAbsolute(options.custodyRoot) || typeof options.providerInstaller !== "function") {
		return failure(Object.freeze({
			code: "invalid_options" as const,
			message: "Local Pi execution host requires an absolute custody root and Provider installer.",
		}));
	}
	const maximumConcurrentRuns = options.maximumConcurrentRuns ?? 4;
	const maximumTrackedRuns = options.maximumTrackedRuns ?? 256;
	const maximumRetainedOutputBytes = options.maximumRetainedOutputBytes ?? 8 * 1024 * 1024;
	if (!Number.isSafeInteger(maximumRetainedOutputBytes) || maximumRetainedOutputBytes < 1 || maximumRetainedOutputBytes > 64 * 1024 * 1024 ||
		!Number.isSafeInteger(maximumConcurrentRuns) || maximumConcurrentRuns < 1 || maximumConcurrentRuns > 64 ||
		!Number.isSafeInteger(maximumTrackedRuns) || maximumTrackedRuns < maximumConcurrentRuns || maximumTrackedRuns > 4_096) {
		return failure(Object.freeze({
			code: "invalid_options" as const,
			message: "Local Pi execution host bounds are invalid.",
		}));
	}
	const runs = new Map<string, TrackedRun>();
	const clock = options.clock ?? systemTimestamp;
	const context = {options, runs, clock, maximumConcurrentRuns, maximumTrackedRuns, maximumRetainedOutputBytes};
	const execute = async (request: unknown): Promise<unknown> => executeHostRequest(request, context);
	return success(Object.freeze({
		protocol: PI_EXECUTION_HOST_PROTOCOL,
		hostProtocol: LOCAL_PI_EXECUTION_HOST_PROTOCOL,
		outputProtocol: PI_EXECUTION_OUTPUT_HOST_PROTOCOL,
		readOutput: async (request: unknown): Promise<unknown> => readTrackedOutput(request, context),
		execute,
	}));
}

interface HostContext {
	readonly options: LocalPiExecutionHostOptions;
	readonly runs: Map<string, TrackedRun>;
	readonly clock: () => string;
	readonly maximumConcurrentRuns: number;
	readonly maximumTrackedRuns: number;
	readonly maximumRetainedOutputBytes: number;
}

async function executeHostRequest(request: unknown, context: HostContext): Promise<LocalPiExecutionHostResponse> {
	const envelope = decodeHostEnvelope(request);
	if (!envelope.ok) return errorEnvelope("invalid_request", envelope.error.message);
	try {
		if (envelope.value.operation === "start") return await executeStart(envelope.value.input, context);
		if (envelope.value.operation === "inspect") return executeInspect(envelope.value.input, context);
		return executeCancellation(envelope.value.input, context);
	} catch (error) {
		const message = error instanceof Error ? boundedMessage(error.message) : "Execution host failed.";
		return errorEnvelope("environment_unavailable", message);
	}
}

function decodeHostEnvelope(request: unknown): Outcome<Readonly<{operation: string; input: CanonicalValue}>, LocalPiExecutionHostIssue> {
	const canonical = decodeCanonicalValue(request, {maximumDepth: 8, maximumEntriesPerContainer: 64, maximumNodes: 1_000, maximumTextBytes: 4 * 1_024 * 1_024});
	if (!canonical.ok || typeof canonical.value !== "object" || canonical.value === null || Array.isArray(canonical.value)) {
		return failure(hostIssue("invalid_options", "Execution host request envelope is malformed."));
	}
	const record = canonical.value as Readonly<Record<string, CanonicalValue>>;
	const keys = Object.keys(record).sort(compareText);
	if (keys.length !== 3 || keys[0] !== "input" || keys[1] !== "operation" || keys[2] !== "protocol") {
		return failure(hostIssue("invalid_options", "Execution host request envelope is malformed."));
	}
	const protocol = record.protocol;
	if (typeof protocol !== "object" || protocol === null || Array.isArray(protocol)) {
		return failure(hostIssue("invalid_options", "Execution host request protocol is malformed."));
	}
	const protocolRecord = protocol as Readonly<Record<string, CanonicalValue>>;
	if (protocolRecord.id !== PI_EXECUTION_HOST_PROTOCOL.id || protocolRecord.version !== PI_EXECUTION_HOST_PROTOCOL.version) {
		return failure(hostIssue("invalid_options", "Execution host protocol identity does not match."));
	}
	if (typeof record.operation !== "string" || !["cancel", "inspect", "start"].includes(record.operation)) {
		return failure(hostIssue("invalid_options", "Execution host operation is unknown."));
	}
	if (record.input === undefined) return failure(hostIssue("invalid_options", "Execution host input is malformed."));
	return success(Object.freeze({operation: record.operation, input: record.input}));
}

async function executeStart(input: CanonicalValue, context: HostContext): Promise<LocalPiExecutionHostResponse> {
	const request = decodeStartRequest(input);
	if (!request.ok) return errorEnvelope("invalid_request", request.error.message);
	const authorization = decodeAgentRunAuthorization(request.value.authorization);
	if (!authorization.ok) return errorEnvelope("invalid_request", "Agent Run authorization is invalid.");
	const digest = agentRunStartRequestDigest({requestDigest: request.value.requestDigest, authorization: authorization.value, material: request.value.material});
	if (!digest.ok || request.value.requestDigest !== digest.value) {
		return errorEnvelope("invalid_request", "Agent Run start digest does not match its authorization.");
	}
	const existing = context.runs.get(authorization.value.runId);
	if (existing) return existing.authorizationDigest === authorization.value.authorizationDigest
		? handleSnapshot(existing) : errorEnvelope("stale_authorization", "Agent Run authorization does not match the tracked Run.");
	const admittedAt = context.clock();
	if (!canonicalTimestamp(admittedAt)) return errorEnvelope("environment_unavailable", "Execution host clock is invalid.");
	if (admittedAt < authorization.value.issuedAt || admittedAt >= authorization.value.deadlineAt) {
		return errorEnvelope("stale_authorization", "Agent Run authorization is outside its execution window.");
	}
	const active = [...context.runs.values()].filter((run) => run.status !== "terminal").length;
	if (active >= context.maximumConcurrentRuns || context.runs.size >= context.maximumTrackedRuns) {
		return errorEnvelope("authorization_conflict", "Pi execution host is at its active or tracked Run bound; execution identities cannot be evicted to authorize retries.");
	}
	const timeoutMs = Math.min(authorization.value.budget.timeoutMs, Date.parse(authorization.value.deadlineAt) - Date.parse(admittedAt));
	const cutoffAt = new Date(Date.parse(admittedAt) + timeoutMs).toISOString();
	const deadline = agentRunCancellationRequestDigest({requestDigest: authorization.value.authorizationDigest,
		runId: authorization.value.runId, authorizationDigest: authorization.value.authorizationDigest,
		reason: "deadline", requestedAt: cutoffAt});
	if (!deadline.ok) return errorEnvelope("invalid_request", "Agent Run deadline cancellation binding is invalid.");
	const startedMonotonic = performance.now();
	const tracked: TrackedRun = {
		runId: authorization.value.runId,
		authorizationDigest: authorization.value.authorizationDigest,
		controller: new AbortController(),
		status: "running",
		receipt: null,
		quiescence: null,
		cancellationDigest: null,
		output: null,
	};
	context.runs.set(authorization.value.runId, tracked);
	// The timer requests cancellation. It never publishes custody closure or races
	// the still-running execution with a synthetic terminal response.
	const timer = setTimeout(() => cancelTrackedRun(tracked, deadline.value), timeoutMs);
	try {
		const result = await runPiSession({
			authorization: authorization.value,
			material: {
				systemPrompt: request.value.material.systemPrompt,
				prompt: request.value.material.prompt,
				workspacePath: context.options.custodyRoot,
				sessionRoot: join(context.options.custodyRoot, "sessions"),
				sessionId: sessionIdFor(authorization.value.runId),
				resume: false,
			},
			installProvider: context.options.providerInstaller,
			signal: tracked.controller.signal,
			clock: context.clock,
		});
		const closedAt = context.clock();
		if (!canonicalTimestamp(closedAt) || result.startedAt < admittedAt || closedAt < result.finishedAt) {
			throw new Error("Execution host cannot establish an ordered custody timestamp.");
		}
		if (closedAt >= cutoffAt || performance.now() - startedMonotonic >= timeoutMs) cancelTrackedRun(tracked, deadline.value);
		await closeRun(tracked, result, closedAt);
		retainOutput(tracked, result, authorization.value.budget.maximumOutputBytes, context);
	} catch (error) {
		// Cleanup can itself fail. Retain uncertain custody and prevent a second
		// launch under this authorization, even when no receipt could be built.
		cancelTrackedRun(tracked, null);
		throw error;
	} finally {
		clearTimeout(timer);
	}
	return handleSnapshot(tracked);
}

function executeInspect(input: CanonicalValue, context: HostContext): LocalPiExecutionHostResponse {
	const request = decodeInspectRequest(input);
	if (!request.ok) return errorEnvelope("invalid_request", request.error.message);
	const digest = agentRunInspectRequestDigest(request.value);
	if (!digest.ok || request.value.requestDigest !== digest.value) {
		return errorEnvelope("invalid_request", "Agent Run inspection digest does not match its subject.");
	}
	const tracked = context.runs.get(request.value.runId);
	if (!tracked) return errorEnvelope("not_found", "Agent Run is not tracked by this Execution Host.");
	if (tracked.authorizationDigest !== request.value.authorizationDigest) return errorEnvelope("stale_authorization", "Agent Run authorization does not match the tracked Run.");
	return handleSnapshot(tracked);
}

function executeCancellation(input: CanonicalValue, context: HostContext): LocalPiExecutionHostResponse {
	const request = decodeCancellationRequest(input);
	if (!request.ok) return errorEnvelope("invalid_request", request.error.message);
	const digest = agentRunCancellationRequestDigest(request.value);
	if (!digest.ok || request.value.requestDigest !== digest.value) {
		return errorEnvelope("invalid_request", "Agent Run cancellation digest does not match its subject.");
	}
	const tracked = context.runs.get(request.value.runId);
	if (!tracked) return errorEnvelope("not_found", "Agent Run is not tracked by this Execution Host.");
	if (tracked.authorizationDigest !== request.value.authorizationDigest) return errorEnvelope("stale_authorization", "Agent Run authorization does not match the tracked Run.");
	cancelTrackedRun(tracked, request.value.requestDigest);
	return handleSnapshot(tracked);
}

function cancelTrackedRun(tracked: TrackedRun, cancellationDigest: Sha256Digest | null): void {
	if (tracked.status === "terminal") return;
	tracked.status = "cancelling";
	tracked.cancellationDigest ??= cancellationDigest;
	tracked.controller.abort();
}

async function closeRun(
	tracked: TrackedRun,
	result: PiSessionRunResult,
	closedAt: string,
): Promise<void> {
	const quiescence = createAgentRunQuiescence({
		runId: tracked.runId,
		authorizationDigest: tracked.authorizationDigest,
		observedAt: closedAt,
		processTreeTerminated: true,
		providerRequestsClosed: true,
		previewClosed: true,
		temporaryStateClosed: true,
	});
	if (!quiescence.ok) throw new Error(`Pi Run custody closure failed: ${quiescence.error.message}`);
	const receipt = createAgentRunReceipt({
		runId: tracked.runId,
		authorizationDigest: tracked.authorizationDigest,
		outcome: tracked.controller.signal.aborted ? "cancelled" : result.outcome,
		startedAt: result.startedAt,
		finishedAt: result.finishedAt,
		outputDigest: tracked.controller.signal.aborted ? null : result.outputDigest,
		usageDigest: result.usageDigest,
		providerReceiptDigest: result.providerReceiptDigest,
		sessionReceiptDigest: result.sessionReceiptDigest,
		queryReceiptDigests: [],
		cancellationDigest: tracked.cancellationDigest,
		custody: {
			processTreeTerminated: true,
			providerRequestsClosed: true,
			previewClosed: true,
			temporaryStateClosed: true,
			quiescenceDigest: quiescence.value.quiescenceDigest,
		},
		operationalGaps: [],
	});
	if (!receipt.ok) throw new Error(`Pi Run receipt failed: ${receipt.error.message}`);
	tracked.receipt = receipt.value;
	tracked.quiescence = quiescence.value;
	tracked.status = "terminal";
}

function readTrackedOutput(input: unknown, context: HostContext) {
	const request = decodeAgentRunOutputRequest(input);
	if (!request.ok) return errorEnvelope("invalid_request", "Agent Run output request is malformed.");
	const tracked = context.runs.get(request.value.runId);
	if (!tracked) return errorEnvelope("not_found", "Agent Run is not tracked by this Execution Host.");
	if (tracked.authorizationDigest !== request.value.authorizationDigest) return errorEnvelope("stale_authorization", "Agent Run authorization does not match the tracked Run.");
	if (tracked.status !== "terminal" || tracked.receipt === null || tracked.quiescence === null) return errorEnvelope("quiescence_unproven", "Output is unavailable before terminal custody closure.");
	if (tracked.receipt.receiptDigest !== request.value.receiptDigest || tracked.receipt.outcome !== "completed") return errorEnvelope("invalid_receipt", "Output lookup does not match a completed receipt.");
	if (tracked.output === null) return errorEnvelope("not_found", "Output bytes are unavailable or were evicted; receipt presence is not retained evidence.");
	return success(tracked.output);
}

function retainOutput(tracked: TrackedRun, result: PiSessionRunResult, maximumOutputBytes: number, context: HostContext): void {
	if (result.outcome !== "completed" || result.output === null || tracked.receipt === null || tracked.receipt.outcome !== "completed") return;
	const bytes = Buffer.byteLength(result.output);
	if (bytes > Math.min(MAXIMUM_AGENT_OUTPUT_BYTES, maximumOutputBytes, context.maximumRetainedOutputBytes)) return;
	const output = decodeAgentRunOutput({protocol: AGENT_RUN_OUTPUT_PROTOCOL, runId: tracked.runId,
		authorizationDigest: tracked.authorizationDigest, receiptDigest: tracked.receipt.receiptDigest,
		outputDigest: result.outputDigest, text: result.output});
	if (!output.ok) return;
	let retainedBytes = [...context.runs.values()].reduce((total, run) => total + (run.output === null ? 0 : Buffer.byteLength(run.output.text)), 0);
	for (const run of context.runs.values()) {
		if (retainedBytes + bytes <= context.maximumRetainedOutputBytes) break;
		if (run.output !== null) {
			retainedBytes -= Buffer.byteLength(run.output.text);
			run.output = null;
		}
	}
	tracked.output = output.value;
}

function decodeStartRequest(input: CanonicalValue): Outcome<Readonly<{requestDigest: Sha256Digest; authorization: CanonicalValue; material: AgentRunMaterial}>, LocalPiExecutionHostIssue> {
	const record = exactRecord(input, ["authorization", "material", "requestDigest"]);
	if (!record.ok) return record;
	const requestDigest = decodeSha256Digest(record.value.requestDigest);
	if (!requestDigest.ok) return failure(hostIssue("invalid_options", "Agent Run start digest is malformed."));
	const material = decodeMaterial(field(record.value, "material"));
	if (!material.ok) return material;
	return success(Object.freeze({
		requestDigest: requestDigest.value,
		authorization: field(record.value, "authorization"),
		material: material.value,
	}));
}

function decodeMaterial(value: CanonicalValue): Outcome<AgentRunMaterial, LocalPiExecutionHostIssue> {
	const record = exactRecord(value, ["prompt", "systemPrompt"]);
	if (!record.ok) return failure(hostIssue("invalid_options", "Agent Run material is malformed."));
	const systemPrompt = record.value.systemPrompt;
	const prompt = record.value.prompt;
	if (typeof systemPrompt !== "string" || typeof prompt !== "string") {
		return failure(hostIssue("invalid_options", "Agent Run material is malformed."));
	}
	if (Buffer.byteLength(systemPrompt) > 64 * 1_024 || Buffer.byteLength(prompt) > 4 * 1_024 * 1_024) {
		return failure(hostIssue("invalid_options", "Agent Run material exceeds its byte bound."));
	}
	return success(Object.freeze({systemPrompt, prompt}));
}

function decodeInspectRequest(input: CanonicalValue): Outcome<AgentRunInspectRequest, LocalPiExecutionHostIssue> {
	const record = exactRecord(input, ["authorizationDigest", "requestDigest", "runId"]);
	if (!record.ok) return failure(hostIssue("invalid_options", "Agent Run inspection is malformed."));
	const requestDigest = decodeSha256Digest(record.value.requestDigest);
	const authorizationDigest = decodeSha256Digest(record.value.authorizationDigest);
	const runId = record.value.runId;
	if (!requestDigest.ok || !authorizationDigest.ok || typeof runId !== "string") {
		return failure(hostIssue("invalid_options", "Agent Run inspection is malformed."));
	}
	return success(Object.freeze({
		requestDigest: requestDigest.value,
		runId,
		authorizationDigest: authorizationDigest.value,
	}));
}

function decodeCancellationRequest(input: CanonicalValue): Outcome<AgentRunCancellationRequest, LocalPiExecutionHostIssue> {
	const record = exactRecord(input, ["authorizationDigest", "reason", "requestDigest", "requestedAt", "runId"]);
	if (!record.ok) return failure(hostIssue("invalid_options", "Agent Run cancellation is malformed."));
	const inspection = decodeInspectRequest(Object.freeze({
		requestDigest: field(record.value, "requestDigest"),
		runId: field(record.value, "runId"),
		authorizationDigest: field(record.value, "authorizationDigest"),
	}));
	if (!inspection.ok) return failure(hostIssue("invalid_options", "Agent Run cancellation is malformed."));
	if (typeof record.value.reason !== "string" || !["deadline", "operator", "policy", "shutdown", "superseded"].includes(record.value.reason)) {
		return failure(hostIssue("invalid_options", "Agent Run cancellation reason is invalid."));
	}
	if (typeof record.value.requestedAt !== "string" || !canonicalTimestamp(record.value.requestedAt)) {
		return failure(hostIssue("invalid_options", "Agent Run cancellation timestamp is invalid."));
	}
	return success(Object.freeze({
		requestDigest: inspection.value.requestDigest,
		runId: inspection.value.runId,
		authorizationDigest: inspection.value.authorizationDigest,
		reason: record.value.reason as AgentRunCancellationRequest["reason"],
		requestedAt: record.value.requestedAt,
	}));
}

function handleSnapshot(tracked: TrackedRun): LocalPiExecutionHostSuccess {
	return Object.freeze({
		ok: true,
		value: Object.freeze({
			runId: tracked.runId,
			authorizationDigest: tracked.authorizationDigest,
			status: tracked.status,
			receipt: tracked.receipt,
			quiescence: tracked.quiescence,
		}),
	});
}

function sessionIdFor(runId: string): string {
	return `cw:session:${runId.slice("cw:run:".length)}`;
}

function exactRecord(value: CanonicalValue, expected: readonly string[]): Outcome<Record<string, CanonicalValue>, LocalPiExecutionHostIssue> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return failure(hostIssue("invalid_options", "Execution host input is malformed."));
	}
	const source = value as Readonly<Record<string, CanonicalValue>>;
	const keys = Object.keys(source).sort(compareText);
	if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
		return failure(hostIssue("invalid_options", "Execution host input fields are invalid."));
	}
	const fields: Record<string, CanonicalValue> = {};
	for (const key of expected) {
		const entry = source[key];
		if (entry === undefined) return failure(hostIssue("invalid_options", "Execution host input fields are invalid."));
		fields[key] = entry;
	}
	return success(Object.freeze(fields));
}

function field(record: Record<string, CanonicalValue>, key: string): CanonicalValue {
	return record[key] as CanonicalValue;
}

function systemTimestamp(): string {
	return new Date().toISOString();
}

function canonicalTimestamp(value: string): boolean {
	try {
		return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) && new Date(value).toISOString() === value;
	} catch {
		return false;
	}
}

function boundedMessage(message: string): string {
	return message.length <= 500 ? message : `${message.slice(0, 497)}...`;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function hostIssue(code: LocalPiExecutionHostIssue["code"], message: string): LocalPiExecutionHostIssue {
	return Object.freeze({code, message});
}

function errorEnvelope(code: string, message: string): LocalPiExecutionHostFailure {
	return Object.freeze({ok: false, error: Object.freeze({code, message})});
}