import {isCanonicalObject} from "../../kernel/data-contracts/canonical-json.ts";
import {failure, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {
	authorizeDecisionModelCheckRun,
	resolveObservedCheckModelRoute,
	type AuthorizeAgentRunInput,
	type authorizeConfiguredDecisionModelCheckRun,
} from "../../server/effects/agent-runs.ts";
import {parseProjectConfigJson, type ProjectConfigFailure} from "./project-config.ts";

/**
 * Compose project settings and an observed interface route with check authorization.
 * The backend supplies accepted settings for the correct project, authenticates the actor and
 * filters the route catalogue for this invocation. Neither settings nor interface
 * observations grant authority. This bridge performs no file or provider discovery.
 */
export function authorizeProjectDecisionModelCheckRun(
	input: Omit<AuthorizeAgentRunInput, "role" | "stage" | "route">,
	projectConfigurationText: string,
	interfaceRoute: unknown,
	authorizedRoutes: unknown,
): ReturnType<typeof authorizeConfiguredDecisionModelCheckRun> | Outcome<never, ProjectConfigFailure> {
	const project = parseProjectConfigJson(projectConfigurationText);
	if (!project.ok) return project;
	const runtime = project.value.value.runtime;
	if (runtime !== undefined && !isCanonicalObject(runtime)) {
		return failure(Object.freeze({code: "invalid_value", path: "$.runtime", message: "Check model settings require an object-valued runtime configuration."}));
	}
	if (runtime !== undefined && Object.keys(runtime).some(key => key !== "checkModel")) {
		return failure(Object.freeze({code: "unknown_field", path: "$.runtime", message: "Only runtime.checkModel is supported; legacy routing and automation settings are not interpreted."}));
	}
	const configuration = runtime?.checkModel;
	const selected = resolveObservedCheckModelRoute(configuration, interfaceRoute, authorizedRoutes);
	if (!selected.ok) return selected;
	return authorizeDecisionModelCheckRun({...input, route: selected.value});
}
