import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {AGENT_RUN_OUTPUT_PORT_PROTOCOL, decodeAgentRunOutputRequest, decodeAgentRunOutputResponse, type AgentRunOutputPort, type AgentRunOutputRequest} from "../../ports/agent-output.ts";

/** Separate capability: do not widen the execution-host 1.0.0 message grammar. */
export const DSH_EXECUTION_OUTPUT_HOST_PROTOCOL = Object.freeze({id: "codewiki.dsh-execution-output-host", version: "1.0.0"} as const);
export interface DshExecutionOutputHost {
	readonly outputProtocol: typeof DSH_EXECUTION_OUTPUT_HOST_PROTOCOL;
	readOutput(request: AgentRunOutputRequest): Promise<unknown>;
}

export function createDshAgentOutputReader(host: DshExecutionOutputHost): Outcome<AgentRunOutputPort, Readonly<{code: "invalid_execution_host"; message: string}>> {
	if (host?.outputProtocol?.id !== DSH_EXECUTION_OUTPUT_HOST_PROTOCOL.id || host.outputProtocol.version !== DSH_EXECUTION_OUTPUT_HOST_PROTOCOL.version || typeof host.readOutput !== "function") {
		return failure(Object.freeze({code: "invalid_execution_host", message: "DSH host has no compatible output capability."}));
	}
	return success(Object.freeze({protocol: AGENT_RUN_OUTPUT_PORT_PROTOCOL, async read(input: AgentRunOutputRequest) {
		const request = decodeAgentRunOutputRequest(input);
		if (!request.ok) return failure(Object.freeze({code: "invalid_request" as const, message: "Agent Run output request is malformed."}));
		let raw: unknown;
		try {raw = await host.readOutput(request.value);} catch {return failure(Object.freeze({code: "transport_lost" as const, message: "DSH output host response was lost."}));}
		const response = decodeAgentRunOutputResponse(raw);
		if (!response.ok) return response;
		if (response.value.runId !== request.value.runId || response.value.authorizationDigest !== request.value.authorizationDigest || response.value.receiptDigest !== request.value.receiptDigest) {
			return failure(Object.freeze({code: "invalid_receipt" as const, message: "DSH output belongs to another execution receipt."}));
		}
		return response;
	}}));
}
