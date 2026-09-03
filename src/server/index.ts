import {failure, success, type Outcome} from "../kernel/canonical/outcome.ts";
import {
	AGENT_RUNTIME_PORT_PROTOCOL,
	type AgentRuntimePort,
} from "../ports/agent-runtime.ts";
import {
	CHECK_RUNNER_PORT_PROTOCOL,
	type CheckRunnerPort,
} from "../ports/check-runner.ts";
import {PREVIEW_PORT_PROTOCOL, type PreviewPort} from "../ports/preview.ts";
import {
	PROJECT_STORE_PORT_PROTOCOL,
	type ProjectStorePort,
} from "../ports/project-store.ts";

export const PROJECT_SERVER_FOUNDATION_PROTOCOL = Object.freeze({
	id: "codewiki.project-server-foundation",
	version: "1.0.0",
} as const);

export interface ProjectServerPorts {
	readonly projectStore: ProjectStorePort;
	readonly checkRunner: CheckRunnerPort;
	readonly agentRuntime: AgentRuntimePort;
	readonly preview: PreviewPort;
}

export interface ProjectServerFoundation {
	readonly protocol: typeof PROJECT_SERVER_FOUNDATION_PROTOCOL;
	readonly ports: ProjectServerPorts;
}

export interface ProjectServerBindingFailure {
	readonly code: "invalid_port_protocol";
	readonly port: keyof ProjectServerPorts;
	readonly message: string;
}

/**
 * Binds four explicit capabilities without granting lifecycle authority.
 * SK3C and later milestones add authenticated commands and transition reducers.
 */
export function bindProjectServerFoundation(
	ports: ProjectServerPorts,
): Outcome<ProjectServerFoundation, ProjectServerBindingFailure> {
	const checks = [
		["projectStore", ports.projectStore.protocol, PROJECT_STORE_PORT_PROTOCOL],
		["checkRunner", ports.checkRunner.protocol, CHECK_RUNNER_PORT_PROTOCOL],
		["agentRuntime", ports.agentRuntime.protocol, AGENT_RUNTIME_PORT_PROTOCOL],
		["preview", ports.preview.protocol, PREVIEW_PORT_PROTOCOL],
	] as const;
	for (const [port, actual, expected] of checks) {
		if (actual.id !== expected.id || actual.version !== expected.version) {
			return failure(Object.freeze({
				code: "invalid_port_protocol",
				port,
				message: `${port} must bind ${expected.id}@${expected.version}.`,
			}));
		}
	}
	return success(Object.freeze({
		protocol: PROJECT_SERVER_FOUNDATION_PROTOCOL,
		ports: Object.freeze({...ports}),
	}));
}
