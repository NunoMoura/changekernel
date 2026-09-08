import {
	AGENT_RUNTIME_PORT_PROTOCOL,
	agentRunCancellationRequestDigest,
	agentRunInspectRequestDigest,
	agentRunReceiptClosesAuthorization,
	agentRunStartRequestDigest,
	decodeAgentRunAuthorization,
	decodeAgentRunQuiescence,
	decodeAgentRunReceipt,
	type AgentRunAuthorization,
	type AgentRunCancellationRequest,
	type AgentRunHandle,
	type AgentRunInspectRequest,
	type AgentRunOperationalStatus,
	type AgentRunReceipt,
	type AgentRunStartRequest,
	type AgentRuntimeIssue,
	type AgentRuntimePort,
} from "../../ports/agent-runtime.ts";
import {decodeCanonicalValue, type CanonicalValue} from "../../kernel/data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";

export const DSH_EXECUTION_HOST_PROTOCOL = Object.freeze({
	id: "codewiki.dsh-execution-host",
	version: "1.0.0",
} as const);
export const DSH_AGENT_RUNTIME_ADAPTER_PROTOCOL = Object.freeze({
	id: "codewiki.adapter.agent-runtime.dsh",
	version: "1.0.0",
} as const);

export type DshHostOperation = "cancel" | "inspect" | "start";

export interface DshExecutionHostRequest {
	readonly protocol: typeof DSH_EXECUTION_HOST_PROTOCOL;
	readonly operation: DshHostOperation;
	readonly input: CanonicalValue;
}

/**
 * Qualified execution host owns DSH process/session/provider/tool mechanics.
 * Adapter sends one strict message and treats every response as untrusted data.
 */
export interface DshExecutionHost {
	readonly protocol: typeof DSH_EXECUTION_HOST_PROTOCOL;
	execute(request: DshExecutionHostRequest): Promise<unknown>;
}

export interface DshAgentRuntimeAdapter extends AgentRuntimePort {
	readonly adapterProtocol: typeof DSH_AGENT_RUNTIME_ADAPTER_PROTOCOL;
}

export interface DshAgentRuntimeBindingIssue {
	readonly code: "invalid_execution_host";
	readonly message: string;
}

export function createDshAgentRuntime(
	host: DshExecutionHost,
): Outcome<DshAgentRuntimeAdapter, DshAgentRuntimeBindingIssue> {
	if (typeof host !== "object" || host === null || !sameProtocol(host.protocol, DSH_EXECUTION_HOST_PROTOCOL) || typeof host.execute !== "function") {
		return failure(Object.freeze({
			code: "invalid_execution_host" as const,
			message: `DSH execution host must bind ${DSH_EXECUTION_HOST_PROTOCOL.id}@${DSH_EXECUTION_HOST_PROTOCOL.version}.`,
		}));
	}
	return success(Object.freeze({
		protocol: AGENT_RUNTIME_PORT_PROTOCOL,
		adapterProtocol: DSH_AGENT_RUNTIME_ADAPTER_PROTOCOL,
		start: async (request: AgentRunStartRequest) => executeStart(host, request),
		inspect: async (request: AgentRunInspectRequest) => executeInspect(host, request),
		cancel: async (request: AgentRunCancellationRequest) => executeCancellation(host, request),
	}));
}

async function executeStart(
	host: DshExecutionHost,
	request: AgentRunStartRequest,
): Promise<Outcome<AgentRunHandle, AgentRuntimeIssue>> {
	const authorization = decodeAgentRunAuthorization(request.authorization);
	if (!authorization.ok) return failure(runtimeIssue("invalid_request", "Agent Run authorization is invalid."));
	const expected = agentRunStartRequestDigest(request);
	if (!expected.ok || request.requestDigest !== expected.value) return failure(runtimeIssue("invalid_request", "Agent Run start digest does not match its authorization."));
	const input = canonicalHostInput(request);
	if (!input.ok) return input;
	return executeHost(host, "start", input.value, authorization.value);
}

async function executeInspect(
	host: DshExecutionHost,
	request: AgentRunInspectRequest,
): Promise<Outcome<AgentRunHandle, AgentRuntimeIssue>> {
	const expected = agentRunInspectRequestDigest(request);
	if (!expected.ok || request.requestDigest !== expected.value) return failure(runtimeIssue("invalid_request", "Agent Run inspection digest does not match its subject."));
	const input = canonicalHostInput(request);
	if (!input.ok) return input;
	return executeHost(host, "inspect", input.value, request);
}

async function executeCancellation(
	host: DshExecutionHost,
	request: AgentRunCancellationRequest,
): Promise<Outcome<AgentRunHandle, AgentRuntimeIssue>> {
	const expected = agentRunCancellationRequestDigest(request);
	if (!expected.ok || request.requestDigest !== expected.value || !canonicalTimestamp(request.requestedAt)) {
		return failure(runtimeIssue("invalid_request", "Agent Run cancellation request is invalid."));
	}
	const input = canonicalHostInput(request);
	if (!input.ok) return input;
	return executeHost(host, "cancel", input.value, request);
}

async function executeHost(
	host: DshExecutionHost,
	operation: DshHostOperation,
	input: CanonicalValue,
	expected: Pick<AgentRunAuthorization, "runId" | "authorizationDigest">,
): Promise<Outcome<AgentRunHandle, AgentRuntimeIssue>> {
	let raw: unknown;
	try {
		raw = await host.execute(Object.freeze({protocol: DSH_EXECUTION_HOST_PROTOCOL, operation, input}));
	} catch {
		return failure(runtimeIssue("transport_lost", "DSH execution host response was lost."));
	}
	const response = decodeHostResponse(raw);
	if (!response.ok) return response;
	return decodeRunHandle(response.value, expected);
}

function canonicalHostInput(input: unknown): Outcome<CanonicalValue, AgentRuntimeIssue> {
	const canonical = decodeCanonicalValue(input, {
		maximumDepth: 32,
		maximumEntriesPerContainer: 10_000,
		maximumNodes: 100_000,
		maximumTextBytes: 64 * 1_024 * 1_024,
	});
	return canonical.ok ? canonical : failure(runtimeIssue("invalid_request", "Agent Runtime request is not canonical bounded data."));
}

function decodeHostResponse(input: unknown): Outcome<CanonicalValue, AgentRuntimeIssue> {
	const canonical = decodeCanonicalValue(input, {
		maximumDepth: 32,
		maximumEntriesPerContainer: 100_000,
		maximumNodes: 100_000,
		maximumTextBytes: 64 * 1_024 * 1_024,
	});
	if (!canonical.ok || typeof canonical.value !== "object" || canonical.value === null || Array.isArray(canonical.value)) {
		return failure(runtimeIssue("invalid_receipt", "DSH execution host returned a malformed response."));
	}
	const record = canonical.value as Readonly<Record<string, CanonicalValue>>;
	if (record.ok === true && exactKeys(record, ["ok", "value"])) return success(record.value as CanonicalValue);
	if (record.ok === false && exactKeys(record, ["error", "ok"]) && typeof record.error === "object" && record.error !== null && !Array.isArray(record.error)) {
		const error = record.error as Readonly<Record<string, CanonicalValue>>;
		if (exactKeys(error, ["code", "message"]) && typeof error.code === "string" && typeof error.message === "string") {
			const code = error.code as AgentRuntimeIssue["code"];
			if (runtimeIssueCodes.has(code)) return failure(runtimeIssue(code, boundedMessage(error.message)));
		}
	}
	return failure(runtimeIssue("invalid_receipt", "DSH execution host returned an invalid response envelope."));
}

function decodeRunHandle(
	input: CanonicalValue,
	expected: Pick<AgentRunAuthorization, "runId" | "authorizationDigest">,
): Outcome<AgentRunHandle, AgentRuntimeIssue> {
	if (typeof input !== "object" || input === null || Array.isArray(input)) return failure(runtimeIssue("invalid_receipt", "DSH Run handle is malformed."));
	const record = input as Readonly<Record<string, CanonicalValue>>;
	if (!exactKeys(record, ["authorizationDigest", "quiescence", "receipt", "runId", "status"]) ||
		typeof record.runId !== "string" || typeof record.authorizationDigest !== "string" || typeof record.status !== "string" || !operationalStatuses.has(record.status as AgentRunOperationalStatus)) {
		return failure(runtimeIssue("invalid_receipt", "DSH Run handle is malformed."));
	}
	if (record.runId !== expected.runId || record.authorizationDigest !== expected.authorizationDigest) {
		return failure(runtimeIssue("stale_authorization", "DSH Run handle does not bind the authorized Run."));
	}
	const receipt = record.receipt === null ? null : decodeAgentRunReceipt(record.receipt);
	const quiescence = record.quiescence === null ? null : decodeAgentRunQuiescence(record.quiescence);
	if (receipt !== null && !receipt.ok || quiescence !== null && !quiescence.ok) return failure(runtimeIssue("invalid_receipt", "DSH terminal evidence is invalid."));
	const decodedReceipt = receipt?.ok ? receipt.value : null;
	const decodedQuiescence = quiescence?.ok ? quiescence.value : null;
	if (record.status === "terminal") {
		if (decodedReceipt === null || decodedQuiescence === null || decodedReceipt.runId !== expected.runId ||
			decodedReceipt.authorizationDigest !== expected.authorizationDigest || decodedQuiescence.runId !== expected.runId ||
			decodedQuiescence.authorizationDigest !== expected.authorizationDigest || !receiptCustodyClosed(decodedReceipt) ||
			decodedReceipt.custody.quiescenceDigest !== decodedQuiescence.quiescenceDigest) {
			return failure(runtimeIssue("quiescence_unproven", "DSH terminal Run lacks matching custody closure."));
		}
	} else if (decodedReceipt !== null || decodedQuiescence !== null) {
		return failure(runtimeIssue("invalid_receipt", "Nonterminal DSH Run cannot return terminal evidence."));
	}
	return success(Object.freeze({
		runId: expected.runId,
		authorizationDigest: expected.authorizationDigest,
		status: record.status as AgentRunOperationalStatus,
		receipt: decodedReceipt,
		quiescence: decodedQuiescence,
	}));
}

export function validateCompletedAgentRun(
	authorization: AgentRunAuthorization,
	handle: AgentRunHandle,
): Outcome<AgentRunReceipt, AgentRuntimeIssue> {
	if (handle.status !== "terminal" || handle.receipt === null || handle.quiescence === null) {
		return failure(runtimeIssue("quiescence_unproven", "Agent Run is not terminal with proven custody closure."));
	}
	if (!agentRunReceiptClosesAuthorization(authorization, handle.receipt) || handle.receipt.outcome !== "completed" ||
		handle.quiescence.quiescenceDigest !== handle.receipt.custody.quiescenceDigest) {
		return failure(runtimeIssue("invalid_receipt", "Agent Run completion does not close its exact authorization."));
	}
	return success(handle.receipt);
}

const runtimeIssueCodes = new Set<AgentRuntimeIssue["code"]>([
	"authorization_conflict", "environment_unavailable", "invalid_receipt", "invalid_request", "not_found", "quiescence_unproven", "stale_authorization", "transport_lost",
]);
const operationalStatuses = new Set<AgentRunOperationalStatus>(["accepted", "cancelling", "running", "terminal"]);

function exactKeys(record: Readonly<Record<string, CanonicalValue>>, expected: readonly string[]): boolean {
	const actual = Object.keys(record).sort(compareText);
	return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function receiptCustodyClosed(receipt: AgentRunReceipt): boolean {
	return receipt.custody.processTreeTerminated && receipt.custody.providerRequestsClosed && receipt.custody.previewClosed && receipt.custody.temporaryStateClosed;
}

function sameProtocol(actual: Readonly<{id: string; version: string}> | undefined, expected: Readonly<{id: string; version: string}>): boolean {
	return actual?.id === expected.id && actual.version === expected.version;
}

function runtimeIssue(code: AgentRuntimeIssue["code"], message: string): AgentRuntimeIssue {
	return Object.freeze({code, message});
}

function boundedMessage(message: string): string {
	return message.length <= 500 ? message : `${message.slice(0, 497)}...`;
}

function canonicalTimestamp(value: string): boolean {
	try {
		return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) && new Date(value).toISOString() === value;
	} catch {
		return false;
	}
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
