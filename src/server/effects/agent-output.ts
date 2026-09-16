import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {AGENT_RUN_OUTPUT_PORT_PROTOCOL, createAgentRunOutputRequest, decodeAgentRunOutputBinding, decodeAgentRunOutputResponse, verifyAgentRunOutput, type AgentRunOutput, type AgentRunOutputPort} from "../../ports/agent-output.ts";
import type {AgentRunAuthorization, AgentRunHandle, AgentRuntimeIssue} from "../../ports/agent-runtime.ts";
import {parseDecisionCheckOutput, type DecisionCheckOutput} from "../../kernel/gates/decision-output.ts";
import {matchesDecisionModelCheckExecution} from "./agent-runs.ts";

/**
 * Read from the backend's private runtime, never from caller-supplied findings.
 * The caller owns current Project authority and freshness checks. This function
 * proves output/receipt consistency, not semantic coverage or provider honesty.
 */
export async function readAuthorizedAgentRunOutput(
	port: AgentRunOutputPort,
	authorization: AgentRunAuthorization,
	handle: AgentRunHandle,
): Promise<Outcome<AgentRunOutput, AgentRuntimeIssue>> {
	const binding = decodeAgentRunOutputBinding({authorization, handle});
	if (!binding.ok) return failure(issue("invalid_receipt", "Output retrieval requires a completed authorized Run with closed custody."));
	if (port?.protocol?.id !== AGENT_RUN_OUTPUT_PORT_PROTOCOL.id || port.protocol.version !== AGENT_RUN_OUTPUT_PORT_PROTOCOL.version || typeof port.read !== "function") {
		return failure(issue("environment_unavailable", "The runtime has no compatible output reader."));
	}
	const request = createAgentRunOutputRequest({runId: binding.value.authorization.runId,
		authorizationDigest: binding.value.authorization.authorizationDigest, receiptDigest: binding.value.handle.receipt.receiptDigest});
	if (!request.ok) return failure(issue("invalid_request", "Output retrieval binding is malformed."));
	let raw: unknown;
	try {raw = await port.read(request.value);} catch {return failure(issue("transport_lost", "Agent Run output response was lost."));}
	const response = decodeAgentRunOutputResponse(raw);
	if (!response.ok) return response;
	const verified = verifyAgentRunOutput({...binding.value, output: response.value});
	return verified.ok ? success(verified.value) : failure(issue("invalid_receipt", "Output does not match the completed authorized Run."));
}
/** Read one Decision model check's output; source/evidence admission remains separate. */
export async function readDecisionModelCheckOutput(
	port: AgentRunOutputPort,
	authorization: AgentRunAuthorization,
	handle: AgentRunHandle,
): Promise<Outcome<Readonly<{output: AgentRunOutput; checkOutput: DecisionCheckOutput}>, AgentRuntimeIssue>> {
	const binding = decodeAgentRunOutputBinding({authorization, handle});
	if (!binding.ok) return failure(issue("invalid_receipt", "Check output requires a completed authorized Run."));
	if (!matchesDecisionModelCheckExecution(binding.value.authorization)) return failure(issue("invalid_request", "This Run does not match the Decision model check execution constraints and output format."));
	const output = await readAuthorizedAgentRunOutput(port, binding.value.authorization, binding.value.handle);
	if (!output.ok) return output;
	const checkOutput = parseDecisionCheckOutput(output.value.text);
	return checkOutput.ok ? success(Object.freeze({output: output.value, checkOutput: checkOutput.value}))
		: failure(issue("invalid_receipt", "Runtime output is not a valid Decision Check output."));
}

function issue(code: AgentRuntimeIssue["code"], message: string): AgentRuntimeIssue {return Object.freeze({code, message});}
