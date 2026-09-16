import {decodeContract, exactRecord, requiredField, textField, protocolField, protocolIdentity, assertDigestMatch, rejectContract, type CanonicalRecord, type ContractIssue} from "../kernel/data-contracts/validation.ts";
import {failure, type Outcome} from "../kernel/data-contracts/outcome.ts";
import {semanticDigest} from "../kernel/identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../kernel/identity/sha256.ts";
import {agentRunReceiptClosesAuthorization, decodeAgentRunAuthorization, decodeAgentRunQuiescence, decodeAgentRunReceipt, type AgentRuntimeIssue} from "./agent-runtime.ts";

/** Optional capability; the Agent Runtime 1.1.0 handle and wire grammar are unchanged. */
export const AGENT_RUN_OUTPUT_PORT_PROTOCOL = protocolIdentity("codewiki.port.agent-run-output", "1.0.0");
export const AGENT_RUN_OUTPUT_PROTOCOL = protocolIdentity("codewiki.agent-run-output", "1.0.0");
export const MAXIMUM_AGENT_OUTPUT_BYTES = 1024 * 1024;
const CONTRACT = "Agent Run output";
const REQUEST_DOMAIN = "codewiki.agent-run-output-request@1.0.0";
const LIMITS = Object.freeze({maximumDepth: 16, maximumNodes: 4096, maximumEntriesPerContainer: 1024, maximumTextBytes: MAXIMUM_AGENT_OUTPUT_BYTES + 128 * 1024});

export interface AgentRunOutputRequest {
	readonly runId: string;
	readonly authorizationDigest: Sha256Digest;
	readonly receiptDigest: Sha256Digest;
	readonly requestDigest: Sha256Digest;
}
export interface AgentRunOutput {
	readonly protocol: typeof AGENT_RUN_OUTPUT_PROTOCOL;
	readonly runId: string;
	readonly authorizationDigest: Sha256Digest;
	readonly receiptDigest: Sha256Digest;
	readonly outputDigest: Sha256Digest;
	readonly text: string;
}

/** Private backend capability, not a user-facing lookup by claimed digest. */
export interface AgentRunOutputPort {
	readonly protocol: typeof AGENT_RUN_OUTPUT_PORT_PROTOCOL;
	read(request: AgentRunOutputRequest): Promise<Outcome<AgentRunOutput, AgentRuntimeIssue>>;
}

export function createAgentRunOutputRequest(body: Omit<AgentRunOutputRequest, "requestDigest">): Outcome<AgentRunOutputRequest, ContractIssue> {
	return decodeContract(CONTRACT, body, value => {
		const record = exactRecord(CONTRACT, value, "$", ["runId", "authorizationDigest", "receiptDigest"]);
		return admitted(decodeAgentRunOutputRequest({...record, requestDigest: digest(REQUEST_DOMAIN, record)}));
	}, LIMITS);
}
export function decodeAgentRunOutputRequest(input: unknown): Outcome<AgentRunOutputRequest, ContractIssue> {
	return decodeContract(CONTRACT, input, value => {
		const record = exactRecord(CONTRACT, value, "$", ["runId", "authorizationDigest", "receiptDigest", "requestDigest"]);
		const body = {runId: runId(record), authorizationDigest: digestField(record, "authorizationDigest"), receiptDigest: digestField(record, "receiptDigest")};
		const requestDigest = digestField(record, "requestDigest");
		assertDigestMatch(CONTRACT, "$.requestDigest", requestDigest, digest(REQUEST_DOMAIN, body));
		return Object.freeze({...body, requestDigest});
	}, LIMITS);
}
export function decodeAgentRunOutput(input: unknown): Outcome<AgentRunOutput, ContractIssue> {
	return decodeContract(CONTRACT, input, value => {
		const record = exactRecord(CONTRACT, value, "$", ["protocol", "runId", "authorizationDigest", "receiptDigest", "outputDigest", "text"]);
		protocolField(CONTRACT, record, "$", AGENT_RUN_OUTPUT_PROTOCOL);
		const text = textField(CONTRACT, record, "text", "$", {maximumBytes: MAXIMUM_AGENT_OUTPUT_BYTES});
		const outputDigest = digestField(record, "outputDigest");
		assertDigestMatch(CONTRACT, "$.outputDigest", outputDigest, digest("codewiki.agent-output@1.0.0", {text}));
		return Object.freeze({protocol: AGENT_RUN_OUTPUT_PROTOCOL, runId: runId(record),
			authorizationDigest: digestField(record, "authorizationDigest"), receiptDigest: digestField(record, "receiptDigest"), outputDigest, text});
	}, LIMITS);
}

/** Decode and snapshot the completed binding before any output lookup. */
export function decodeAgentRunOutputBinding(input: unknown) {
	return decodeContract(CONTRACT, input, value => {
		const record = exactRecord(CONTRACT, value, "$", ["authorization", "handle"]);
		const authorization = admitted(decodeAgentRunAuthorization(requiredField(CONTRACT, record, "authorization")));
		const handle = exactRecord(CONTRACT, requiredField(CONTRACT, record, "handle"), "$.handle", ["runId", "authorizationDigest", "status", "receipt", "quiescence"]);
		const receipt = admitted(decodeAgentRunReceipt(requiredField(CONTRACT, handle, "receipt")));
		const quiescence = admitted(decodeAgentRunQuiescence(requiredField(CONTRACT, handle, "quiescence")));
		if (handle.status !== "terminal" || handle.runId !== authorization.runId || handle.authorizationDigest !== authorization.authorizationDigest ||
			!agentRunReceiptClosesAuthorization(authorization, receipt) || receipt.outcome !== "completed" ||
			quiescence.runId !== authorization.runId || quiescence.authorizationDigest !== authorization.authorizationDigest ||
			quiescence.quiescenceDigest !== receipt.custody.quiescenceDigest || receipt.outputDigest === null) {
			rejectContract("invalid_field", CONTRACT, "$", "Output must bind the exact completed authorization, receipt and custody closure.");
		}
		if (receipt.startedAt < authorization.issuedAt || receipt.finishedAt > authorization.deadlineAt ||
			Date.parse(receipt.finishedAt) - Date.parse(receipt.startedAt) > authorization.budget.timeoutMs ||
			quiescence.observedAt < receipt.finishedAt) {
			rejectContract("invalid_field", CONTRACT, "$", "Output exceeds the authorized execution window or output budget.");
		}
		return Object.freeze({authorization, handle: Object.freeze({runId: authorization.runId, authorizationDigest: authorization.authorizationDigest,
			status: "terminal" as const, receipt, quiescence})});
	}, LIMITS);
}

/** Consistency only. The backend must obtain these bytes from its trusted runtime. */
export function verifyAgentRunOutput(input: unknown): Outcome<AgentRunOutput, ContractIssue> {
	return decodeContract(CONTRACT, input, value => {
		const record = exactRecord(CONTRACT, value, "$", ["authorization", "handle", "output"]);
		const {authorization, handle} = admitted(decodeAgentRunOutputBinding({authorization: record.authorization, handle: record.handle}));
		const output = admitted(decodeAgentRunOutput(requiredField(CONTRACT, record, "output")));
		if (output.runId !== authorization.runId || output.authorizationDigest !== authorization.authorizationDigest ||
			output.receiptDigest !== handle.receipt.receiptDigest || output.outputDigest !== handle.receipt.outputDigest ||
			new TextEncoder().encode(output.text).byteLength > authorization.budget.maximumOutputBytes) {
			rejectContract("invalid_field", CONTRACT, "$", "Output must match the exact receipt and authorized byte budget.");
		}
		return output;
	}, LIMITS);
}

/** Re-admit the entire operational response, including failures, without accessors. */
export function decodeAgentRunOutputResponse(input: unknown): Outcome<AgentRunOutput, AgentRuntimeIssue> {
	const decoded = decodeContract(CONTRACT, input, value => {
		const ok = value !== null && typeof value === "object" && !Array.isArray(value) && "ok" in value && value.ok === true;
		const record = exactRecord(CONTRACT, value, "$", ok ? ["ok", "value"] : ["ok", "error"]);
		if (ok) return {ok: true as const, value: admitted(decodeAgentRunOutput(requiredField(CONTRACT, record, "value")))};
		if (record.ok !== false) rejectContract("invalid_field", CONTRACT, "$.ok", "Expected a strict output response.");
		const error = exactRecord(CONTRACT, requiredField(CONTRACT, record, "error"), "$.error", ["code", "message"]);
		const code = textField(CONTRACT, error, "code");
		if (!ISSUE_CODES.includes(code as AgentRuntimeIssue["code"])) rejectContract("invalid_field", CONTRACT, "$.error.code", "Unknown runtime issue.");
		return {ok: false as const, error: issue(code as AgentRuntimeIssue["code"], textField(CONTRACT, error, "message", "$", {maximumBytes: 2048}))};
	}, LIMITS);
	return decoded.ok ? Object.freeze(decoded.value) : failure(issue("invalid_receipt", "Agent Run output response is malformed."));
}
const ISSUE_CODES: readonly AgentRuntimeIssue["code"][] = ["authorization_conflict", "environment_unavailable", "invalid_receipt", "invalid_request", "not_found", "quiescence_unproven", "stale_authorization", "transport_lost"];

function runId(record: CanonicalRecord): string {
	return textField(CONTRACT, record, "runId", "$", {maximumBytes: 256, pattern: /^cw:run:[a-z0-9][a-z0-9._:-]*$/u});
}
function digestField(record: CanonicalRecord, field: string): Sha256Digest {
	const result = decodeSha256Digest(requiredField(CONTRACT, record, field));
	if (!result.ok) rejectContract("invalid_field", CONTRACT, `$.${field}`, result.error.message);
	return result.value;
}
function digest(domain: string, value: unknown): Sha256Digest {
	const result = semanticDigest(domain, value);
	if (!result.ok) rejectContract("invalid_field", CONTRACT, "$", result.error.message);
	return result.value;
}
function admitted<T>(result: Outcome<T, ContractIssue>): T {
	if (!result.ok) rejectContract(result.error.code, CONTRACT, result.error.path, result.error.message);
	return result.value;
}
function issue(code: AgentRuntimeIssue["code"], message: string): AgentRuntimeIssue {return Object.freeze({code, message});}
