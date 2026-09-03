export const CHECK_RUNNER_PORT_PROTOCOL = Object.freeze({
	id: "codewiki.port.check-runner",
	version: "1.0.0",
} as const);

/** Capability marker. SK3C adds immutable Check invocation and receipt observation. */
export interface CheckRunnerPort {
	readonly protocol: typeof CHECK_RUNNER_PORT_PROTOCOL;
}
