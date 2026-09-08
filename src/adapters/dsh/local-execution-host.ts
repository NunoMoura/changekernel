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
import {DSH_EXECUTION_HOST_PROTOCOL, type DshExecutionHost} from "./agent-runtime.ts";
import {runDshSession, type DshProviderInstaller, type DshSessionRunResult} from "./session-runner.ts";

export const LOCAL_DSH_EXECUTION_HOST_PROTOCOL = Object.freeze({
	id: "codewiki.adapter.dsh-execution-host.local",
	version: "1.0.0",
} as const);

export type LocalDshExecutionHostSuccess = Readonly<{
	ok: true;
	value: AgentRunHandle;
}>;

export type LocalDshExecutionHostFailure = Readonly<{
	ok: false;
	error: Readonly<{code: string; message: string}>;
}>;

export type LocalDshExecutionHostResponse = LocalDshExecutionHostSuccess | LocalDshExecutionHostFailure;

export interface LocalDshExecutionHostOptions {
	/** Absolute owner-private custody root for session logs and scratch state. */
	readonly custodyRoot: string;
	readonly providerInstaller: DshProviderInstaller;
	readonly maximumConcurrentRuns?: number;
	readonly maximumTrackedRuns?: number;
	readonly clock?: () => string;
}

export interface LocalDshExecutionHostIssue {
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
}

/**
 * Bounded in-process Execution Host for one Project Server. DSH Sessions, the
 * provider installer, and custody paths stay host-private; responses are one
 * strict protocol envelope. A qualified deployment may replace this host with
 * the sandboxed Run Process host without touching the Agent Runtime port.
 */
export function createLocalDshExecutionHost(
	options: LocalDshExecutionHostOptions,
): Outcome<DshExecutionHost, LocalDshExecutionHostIssue> {
	if (typeof options !== "object" || options === null || !isAbsolute(options.custodyRoot) || typeof options.providerInstaller !== "function") {
		return failure(Object.freeze({
			code: "invalid_options" as const,
			message: "Local DSH execution host requires an absolute custody root and Provider installer.",
		}));
	}
	const maximumConcurrentRuns = options.maximumConcurrentRuns ?? 4;
	const maximumTrackedRuns = options.maximumTrackedRuns ?? 256;
	if (!Number.isSafeInteger(maximumConcurrentRuns) || maximumConcurrentRuns < 1 || maximumConcurrentRuns > 64 ||
		!Number.isSafeInteger(maximumTrackedRuns) || maximumTrackedRuns < maximumConcurrentRuns || maximumTrackedRuns > 4_096) {
		return failure(Object.freeze({
			code: "invalid_options" as const,
			message: "Local DSH execution host bounds are invalid.",
		}));
	}
	const runs = new Map<string, TrackedRun>();
	const clock = options.clock ?? systemTimestamp;
	const execute = async (request: unknown): Promise<unknown> => executeHostRequest(request, {options, runs, clock, maximumConcurrentRuns, maximumTrackedRuns});
	return success(Object.freeze({
		protocol: DSH_EXECUTION_HOST_PROTOCOL,
		hostProtocol: LOCAL_DSH_EXECUTION_HOST_PROTOCOL,
		execute,
	}));
}

interface HostContext {
	readonly options: LocalDshExecutionHostOptions;
	readonly runs: Map<string, TrackedRun>;
	readonly clock: () => string;
	readonly maximumConcurrentRuns: number;
	readonly maximumTrackedRuns: number;
}

async function executeHostRequest(request: unknown, context: HostContext): Promise<LocalDshExecutionHostResponse> {
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

function decodeHostEnvelope(request: unknown): Outcome<Readonly<{operation: string; input: CanonicalValue}>, LocalDshExecutionHostIssue> {
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
	if (protocolRecord.id !== DSH_EXECUTION_HOST_PROTOCOL.id || protocolRecord.version !== DSH_EXECUTION_HOST_PROTOCOL.version) {
		return failure(hostIssue("invalid_options", "Execution host protocol identity does not match."));
	}
	if (typeof record.operation !== "string" || !["cancel", "inspect", "start"].includes(record.operation)) {
		return failure(hostIssue("invalid_options", "Execution host operation is unknown."));
	}
	if (record.input === undefined) return failure(hostIssue("invalid_options", "Execution host input is malformed."));
	return success(Object.freeze({operation: record.operation, input: record.input}));
}

async function executeStart(input: CanonicalValue, context: HostContext): Promise<LocalDshExecutionHostResponse> {
	const request = decodeStartRequest(input);
	if (!request.ok) return errorEnvelope("invalid_request", request.error.message);
	const authorization = decodeAgentRunAuthorization(request.value.authorization);
	if (!authorization.ok) return errorEnvelope("invalid_request", "Agent Run authorization is invalid.");
	const digest = agentRunStartRequestDigest({requestDigest: request.value.requestDigest, authorization: authorization.value, material: request.value.material});
	if (!digest.ok || request.value.requestDigest !== digest.value) {
		return errorEnvelope("invalid_request", "Agent Run start digest does not match its authorization.");
	}
	const existing = context.runs.get(authorization.value.runId);
	if (existing) return handleSnapshot(existing);
	const active = [...context.runs.values()].filter((run) => run.status !== "terminal").length;
	if (active >= context.maximumConcurrentRuns) {
		return errorEnvelope("authorization_conflict", "DSH execution host is at its concurrent Run bound.");
	}
	evictTerminalRuns(context);
	const tracked: TrackedRun = {
		runId: authorization.value.runId,
		authorizationDigest: authorization.value.authorizationDigest,
		controller: new AbortController(),
		status: "running",
		receipt: null,
		quiescence: null,
		cancellationDigest: null,
	};
	context.runs.set(authorization.value.runId, tracked);
	try {
		const result = await runDshSession({
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
		await closeRun(tracked, result);
	} catch (error) {
		context.runs.delete(authorization.value.runId);
		throw error;
	}
	return handleSnapshot(tracked);
}

function executeInspect(input: CanonicalValue, context: HostContext): LocalDshExecutionHostResponse {
	const request = decodeInspectRequest(input);
	if (!request.ok) return errorEnvelope("invalid_request", request.error.message);
	const digest = agentRunInspectRequestDigest(request.value);
	if (!digest.ok || request.value.requestDigest !== digest.value) {
		return errorEnvelope("invalid_request", "Agent Run inspection digest does not match its subject.");
	}
	const tracked = context.runs.get(request.value.runId);
	if (!tracked) return errorEnvelope("not_found", "Agent Run is not tracked by this Execution Host.");
	return handleSnapshot(tracked);
}

function executeCancellation(input: CanonicalValue, context: HostContext): LocalDshExecutionHostResponse {
	const request = decodeCancellationRequest(input);
	if (!request.ok) return errorEnvelope("invalid_request", request.error.message);
	const digest = agentRunCancellationRequestDigest(request.value);
	if (!digest.ok || request.value.requestDigest !== digest.value) {
		return errorEnvelope("invalid_request", "Agent Run cancellation digest does not match its subject.");
	}
	const tracked = context.runs.get(request.value.runId);
	if (!tracked) return errorEnvelope("not_found", "Agent Run is not tracked by this Execution Host.");
	if (tracked.status !== "terminal") {
		tracked.status = "cancelling";
		tracked.cancellationDigest = request.value.requestDigest;
		tracked.controller.abort();
	}
	return handleSnapshot(tracked);
}

async function closeRun(
	tracked: TrackedRun,
	result: DshSessionRunResult,
): Promise<void> {
	const quiescence = createAgentRunQuiescence({
		runId: tracked.runId,
		authorizationDigest: tracked.authorizationDigest,
		observedAt: result.finishedAt,
		processTreeTerminated: true,
		providerRequestsClosed: true,
		previewClosed: true,
		temporaryStateClosed: true,
	});
	if (!quiescence.ok) throw new Error(`DSH Run custody closure failed: ${quiescence.error.message}`);
	const receipt = createAgentRunReceipt({
		runId: tracked.runId,
		authorizationDigest: tracked.authorizationDigest,
		outcome: result.outcome,
		startedAt: result.startedAt,
		finishedAt: result.finishedAt,
		outputDigest: result.outputDigest,
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
	if (!receipt.ok) throw new Error(`DSH Run receipt failed: ${receipt.error.message}`);
	tracked.receipt = receipt.value;
	tracked.quiescence = quiescence.value;
	tracked.status = "terminal";
}

function decodeStartRequest(input: CanonicalValue): Outcome<Readonly<{requestDigest: Sha256Digest; authorization: CanonicalValue; material: AgentRunMaterial}>, LocalDshExecutionHostIssue> {
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

function decodeMaterial(value: CanonicalValue): Outcome<AgentRunMaterial, LocalDshExecutionHostIssue> {
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

function decodeInspectRequest(input: CanonicalValue): Outcome<AgentRunInspectRequest, LocalDshExecutionHostIssue> {
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

function decodeCancellationRequest(input: CanonicalValue): Outcome<AgentRunCancellationRequest, LocalDshExecutionHostIssue> {
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

function handleSnapshot(tracked: TrackedRun): LocalDshExecutionHostSuccess {
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

function evictTerminalRuns(context: HostContext): void {
	while (context.runs.size >= context.maximumTrackedRuns) {
		let evicted = false;
		for (const [runId, tracked] of context.runs) {
			if (tracked.status === "terminal") {
				context.runs.delete(runId);
				evicted = true;
				break;
			}
		}
		if (!evicted) break;
	}
}

function sessionIdFor(runId: string): string {
	return `cw:session:${runId.slice("cw:run:".length)}`;
}

function exactRecord(value: CanonicalValue, expected: readonly string[]): Outcome<Record<string, CanonicalValue>, LocalDshExecutionHostIssue> {
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

function hostIssue(code: LocalDshExecutionHostIssue["code"], message: string): LocalDshExecutionHostIssue {
	return Object.freeze({code, message});
}

function errorEnvelope(code: string, message: string): LocalDshExecutionHostFailure {
	return Object.freeze({ok: false, error: Object.freeze({code, message})});
}