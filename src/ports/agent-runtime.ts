export const AGENT_RUNTIME_PORT_PROTOCOL = Object.freeze({
	id: "codewiki.port.agent-runtime",
	version: "1.0.0",
} as const);

/** Capability marker. SK3G adds bounded Run submission, observation, and cancellation. */
export interface AgentRuntimePort {
	readonly protocol: typeof AGENT_RUNTIME_PORT_PROTOCOL;
}
