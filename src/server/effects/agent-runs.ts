import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import type {GitOid} from "../../kernel/identity/git.ts";
import {semanticDigest, type SemanticIdentityIssue} from "../../kernel/identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {
	agentRunContextMaterialDigest,
	agentRunCancellationRequestDigest,
	agentRunStartRequestDigest,
	createAgentRunAuthorization,
	decodeAgentRunAuthorization,
	type AgentRunAuthorization,
	type AgentRunBudget,
	type AgentRunCancellationRequest,
	type AgentRunContext,
	type AgentRunHandle,
	type AgentRunMaterial,
	type AgentRunPredecessor,
	type AgentRunRole,
	type AgentRunRoute,
	type AgentRunStage,
	type AgentRunSubject,
	type AgentRuntimeIssue,
	type AgentRuntimePort,
} from "../../ports/agent-runtime.ts";
import {arrayField, decodeContract, exactRecord, isNamespacedIdentifier, rejectContract, textField, type ContractIssue} from "../../kernel/data-contracts/validation.ts";
import {DECISION_CHECK_OUTPUT_SCHEMA} from "../../kernel/gates/decision-output.ts";

export const AGENT_ROLE_POLICY_PROTOCOL = Object.freeze({id: "codewiki.agent-role-policy", version: "1.0.0"} as const);

export interface AgentRolePolicy {
	readonly role: AgentRunRole;
	readonly toolIds: readonly string[];
	readonly capabilities: readonly string[];
	readonly previewWork: boolean;
	readonly writable: boolean;
	readonly budget: AgentRunBudget;
	readonly outputSchemaDigest: Sha256Digest;
}

export type AgentRolePolicyCatalog = Readonly<Record<AgentRunRole, AgentRolePolicy>>;

export const AGENT_ROLE_POLICIES: AgentRolePolicyCatalog = Object.freeze({
	decision: rolePolicy("decision", [
		"codewiki.tool:changes.read", "codewiki.tool:wiki.get", "codewiki.tool:wiki.links", "codewiki.tool:wiki.list", "codewiki.tool:wiki.resolve", "codewiki.tool:wiki.search",
	], [], false, false, budget(8, 128, 180_000, 300_000, 24_000, 2_000_000)),
	planning: rolePolicy("planning", [
		"codewiki.tool:changes.read", "codewiki.tool:wiki.get", "codewiki.tool:wiki.links", "codewiki.tool:wiki.resolve", "codewiki.tool:work.read",
	], [], false, false, budget(6, 96, 180_000, 220_000, 18_000, 1_500_000)),
	worker: rolePolicy("worker", [
		"codewiki.tool:changes.read", "codewiki.tool:project.read", "codewiki.tool:wiki.get", "codewiki.tool:wiki.resolve", "codewiki.tool:work.read",
	], ["codewiki.capability:workbench.write"], true, true, budget(12, 256, 600_000, 500_000, 40_000, 8_000_000)),
	review: rolePolicy("review", [
		"codewiki.tool:changes.read", "codewiki.tool:project.read", "codewiki.tool:wiki.get", "codewiki.tool:wiki.links", "codewiki.tool:wiki.resolve", "codewiki.tool:work.read",
	], [], false, false, budget(6, 128, 240_000, 300_000, 24_000, 2_000_000)),
	"model-check": rolePolicy("model-check", [], [], false, false, budget(2, 0, 120_000, 180_000, 12_000, 1_000_000)),
});

export const AGENT_ROLE_POLICY_DIGEST = staticDigest(
	`${AGENT_ROLE_POLICY_PROTOCOL.id}@${AGENT_ROLE_POLICY_PROTOCOL.version}`,
	AGENT_ROLE_POLICIES,
);

export interface AuthorizeAgentRunInput {
	readonly role: AgentRunRole;
	readonly stage: AgentRunStage;
	readonly actorId: string;
	readonly authorizationId: string;
	readonly subject: AgentRunSubject;
	readonly route: AgentRunRoute;
	readonly wikiCommit: GitOid;
	readonly itemIds: readonly string[];
	readonly feedbackDigest: Sha256Digest | null;
	readonly material: AgentRunMaterial;
	readonly writableScope: readonly string[];
	readonly previewSubjectDigest: Sha256Digest | null;
	readonly attempt: number;
	readonly predecessor: AgentRunPredecessor | null;
	readonly issuedAt: string;
	readonly deadlineAt: string;
}

export interface AgentRunAuthorizationIssue {
	readonly code: "invalid_authorization" | "policy_violation";
	readonly message: string;
}

export function authorizeAgentRun(
	input: AuthorizeAgentRunInput,
): Outcome<AgentRunAuthorization, AgentRunAuthorizationIssue | ContractIssue | SemanticIdentityIssue> {
	const policy = AGENT_ROLE_POLICIES[input.role];
	if (!isNamespacedIdentifier(input.authorizationId)) return failure(authorizationIssue("invalid_authorization", "Agent authorization identity is invalid."));
	const issuedAt = canonicalTimestamp(input.issuedAt);
	const deadlineAt = canonicalTimestamp(input.deadlineAt);
	if (issuedAt === null || deadlineAt === null) return failure(authorizationIssue("invalid_authorization", "Agent Run timestamps are invalid."));
	if (policy.writable !== (input.writableScope.length > 0)) {
		return failure(authorizationIssue("policy_violation", policy.writable ? "Worker Run requires bounded writable scope." : "Agent role cannot receive writable scope."));
	}
	if (input.previewSubjectDigest !== null && !policy.previewWork) {
		return failure(authorizationIssue("policy_violation", "Agent role cannot receive producer Preview."));
	}
	const authorityDigest = semanticDigest("codewiki.agent-run-actor-authority@1.0.0", {
		actorId: input.actorId,
		authorizationId: input.authorizationId,
		role: input.role,
		subjectId: input.subject.subjectId,
	});
	if (!authorityDigest.ok) return failure(authorityDigest.error);
	const capabilities = input.previewSubjectDigest === null
		? policy.capabilities
		: Object.freeze([...policy.capabilities, "codewiki.capability:preview.work"].sort(compareText));
	const toolSetDigest = semanticDigest("codewiki.agent-tool-set@1.0.0", {toolIds: policy.toolIds});
	if (!toolSetDigest.ok) return failure(toolSetDigest.error);
	const itemIds = Object.freeze([...input.itemIds].sort(compareText));
	const contextDigest = agentRunContextMaterialDigest(input.material, itemIds);
	if (!contextDigest.ok) return failure(contextDigest.error);
	const queryPolicyDigest = semanticDigest("codewiki.agent-query-policy@1.0.0", {toolIds: policy.toolIds});
	if (!queryPolicyDigest.ok) return failure(queryPolicyDigest.error);
	const context: AgentRunContext = Object.freeze({
		wikiCommit: input.wikiCommit,
		itemIds,
		contextDigest: contextDigest.value,
		queryPolicyDigest: queryPolicyDigest.value,
		feedbackDigest: input.feedbackDigest,
	});
	return createAgentRunAuthorization({
		attempt: input.attempt,
		role: input.role,
		stage: input.stage,
		actorId: input.actorId,
		authorityDigest: authorityDigest.value,
		subject: input.subject,
		route: input.route,
		context,
		toolIds: policy.toolIds,
		toolSetDigest: toolSetDigest.value,
		capabilities,
		writableScope: Object.freeze([...input.writableScope].sort(compareText)),
		previewSubjectDigest: input.previewSubjectDigest,
		budget: policy.budget,
		outputSchemaDigest: policy.outputSchemaDigest,
		policyDigest: AGENT_ROLE_POLICY_DIGEST,
		issuedAt,
		deadlineAt,
		predecessor: input.predecessor,
	});
}

/** Decision model check execution constraints; historical wire identities stay frozen. */
export const DECISION_CHECK_OUTPUT_SCHEMA_DIGEST = staticDigest("codewiki.agent-output-schema@2.0.0", DECISION_CHECK_OUTPUT_SCHEMA);
export const DECISION_MODEL_CHECK_EXECUTION = Object.freeze({
	...AGENT_ROLE_POLICIES["model-check"],
	outputSchemaDigest: DECISION_CHECK_OUTPUT_SCHEMA_DIGEST,
});
// Retain the hash domain and body keys for byte-compatible run identities.
export const DECISION_MODEL_CHECK_EXECUTION_DIGEST = staticDigest("codewiki.decision-check-run-policy@1.0.0", {
	parentPolicyDigest: AGENT_ROLE_POLICY_DIGEST,
	stage: "decision", policy: DECISION_MODEL_CHECK_EXECUTION,
});

/**
 * Authorize one model check in the Decision stage, not the whole stage.
 * Callers must rebuild the exact subject/material under current Project authority.
 * Output remains untrusted until finding admission; this does not qualify execution.
 */
export function authorizeDecisionModelCheckRun(
	input: Omit<AuthorizeAgentRunInput, "role" | "stage">,
): Outcome<AgentRunAuthorization, AgentRunAuthorizationIssue | ContractIssue | SemanticIdentityIssue> {
	if (input.subject.changeId === null || input.subject.changeTip === null || input.subject.workId !== null ||
		input.subject.artifactCommit !== null || input.subject.artifactTree !== null) {
		return failure(authorizationIssue("policy_violation", "Decision model check requires an exact Change subject without Work or artifact scope."));
	}
	const base = authorizeAgentRun({...input, role: "model-check", stage: "decision"});
	if (!base.ok) return base;
	const {protocol, runId, authorizationDigest, ...body} = base.value;
	void protocol; void runId; void authorizationDigest;
	return createAgentRunAuthorization({...body, policyDigest: DECISION_MODEL_CHECK_EXECUTION_DIGEST,
		outputSchemaDigest: DECISION_CHECK_OUTPUT_SCHEMA_DIGEST});
}

/**
 * Resolve one check-model override from a backend-authorized route catalogue.
 * Missing configuration inherits the interface route; explicit overrides never fall
 * back. This selects metadata only, not provider availability or qualification.
 */
export function resolveCheckModelRoute(
	configuration: unknown,
	interfaceRouteId: unknown,
	authorizedRoutes: unknown,
): Outcome<AgentRunRoute, ContractIssue | AgentRuntimeIssue> {
	const contract = "Check model configuration";
	const parsed = decodeContract(contract, {configuration: configuration === undefined ? {} : configuration, interfaceRouteId, authorizedRoutes}, value => {
		const record = exactRecord(contract, value, "$", ["configuration", "interfaceRouteId", "authorizedRoutes"]);
		const config = exactRecord(contract, record.configuration!, "$.configuration", [], ["modelRoute"]);
		const modelRoute = config.modelRoute === undefined ? "inherit" : textField(contract, config, "modelRoute", "$.configuration", {maximumBytes: 200});
		if (modelRoute !== "inherit" && !isNamespacedIdentifier(modelRoute)) rejectContract("invalid_field", contract, "$.configuration.modelRoute", "Select inherit or one named model route.");
		const inherited = record.interfaceRouteId;
		if (inherited !== null && (typeof inherited !== "string" || !isNamespacedIdentifier(inherited))) rejectContract("invalid_field", contract, "$.interfaceRouteId", "Interface route must be a named route or null.");
		const seen = new Set<string>();
		const routes = arrayField(contract, record, "authorizedRoutes", "$", 32).map((entry, index) => {
			const path = `$.authorizedRoutes[${index}]`;
			const route = exactRecord(contract, entry, path, ["routeId", "providerId", "modelId", "routeDigest"]);
			const routeId = textField(contract, route, "routeId", path, {maximumBytes: 200});
			const providerId = textField(contract, route, "providerId", path, {maximumBytes: 200});
			const modelId = textField(contract, route, "modelId", path, {maximumBytes: 200});
			if (![routeId, providerId, modelId].every(isNamespacedIdentifier) || seen.has(routeId)) rejectContract("invalid_field", contract, path, "Routes require unique names and valid provider/model identities.");
			seen.add(routeId);
			const digest = decodeSha256Digest(route.routeDigest);
			const expected = semanticDigest("codewiki.agent-route@1.0.0", {routeId, providerId, modelId});
			if (!digest.ok || !expected.ok || digest.value !== expected.value) rejectContract("invalid_field", contract, path, "Model route digest differs from its identities.");
			return Object.freeze({routeId, providerId, modelId, routeDigest: digest.value});
		});
		return Object.freeze({selected: modelRoute === "inherit" ? inherited : modelRoute, routes});
	});
	if (!parsed.ok) return parsed;
	const route = parsed.value.routes.find(entry => entry.routeId === parsed.value.selected);
	return route ? success(route) : failure(runtimeIssue("environment_unavailable", "Selected check model route is absent from the backend-authorized catalogue; no fallback was attempted."));
}

/** Inheritance binds the complete observed interface identity, not a reused route name. */
export function resolveObservedCheckModelRoute(configuration: unknown, interfaceRoute: unknown, authorizedRoutes: unknown) {
	const snapshot = decodeContract("Check model observations", {configuration: configuration === undefined ? {} : configuration, interfaceRoute, authorizedRoutes}, value => {
		const record = exactRecord("Check model observations", value, "$", ["configuration", "interfaceRoute", "authorizedRoutes"]);
		return Object.freeze({interfaceRoute: record.interfaceRoute, authorizedRoutes: record.authorizedRoutes,
			configuration: exactRecord("Check model observations", record.configuration!, "$.configuration", [], ["modelRoute"])});
	});
	if (!snapshot.ok) return snapshot;
	const observed = decodeContract("Interface model route", snapshot.value.interfaceRoute, value => value === null ? null :
		exactRecord("Interface model route", value, "$", ["routeId", "providerId", "modelId", "routeDigest"]));
	if (!observed.ok) return observed;
	const verified = observed.value === null ? null : resolveCheckModelRoute(undefined, observed.value.routeId, [observed.value]);
	if (verified !== null && !verified.ok) return verified;
	const inherited = verified?.value ?? null;
	const selected = resolveCheckModelRoute(snapshot.value.configuration, inherited?.routeId ?? null, snapshot.value.authorizedRoutes);
	if (!selected.ok) return selected;
	const inherits = snapshot.value.configuration.modelRoute === undefined || snapshot.value.configuration.modelRoute === "inherit";
	if (inherits && selected.value.routeDigest !== inherited?.routeDigest) {
		return failure(runtimeIssue("environment_unavailable", "The interface model differs from the backend-authorized route; no substitution was attempted."));
	}
	return selected;
}

/** Internal composition; the backend, not client configuration, supplies authorized routes. */
export function authorizeConfiguredDecisionModelCheckRun(
	input: Omit<AuthorizeAgentRunInput, "role" | "stage" | "route">,
	configuration: unknown,
	interfaceRouteId: unknown,
	authorizedRoutes: unknown,
): Outcome<AgentRunAuthorization, AgentRunAuthorizationIssue | ContractIssue | SemanticIdentityIssue | AgentRuntimeIssue> {
	const route = resolveCheckModelRoute(configuration, interfaceRouteId, authorizedRoutes);
	return route.ok ? authorizeDecisionModelCheckRun({...input, route: route.value}) : route;
}

/** Recompute execution compatibility; the historical policyDigest field alone is insufficient. */
export function matchesDecisionModelCheckExecution(input: unknown): boolean {
	const decoded = decodeAgentRunAuthorization(input);
	if (!decoded.ok) return false;
	const authorization = decoded.value;
	if (authorization.role !== "model-check" || authorization.stage !== "decision" ||
		authorization.subject.changeId === null || authorization.subject.changeTip === null ||
		authorization.subject.workId !== null || authorization.subject.artifactCommit !== null || authorization.subject.artifactTree !== null) return false;
	const policy = semanticDigest("codewiki.decision-check-run-policy@1.0.0", {
		parentPolicyDigest: AGENT_ROLE_POLICY_DIGEST, stage: authorization.stage,
		policy: {role: authorization.role, toolIds: authorization.toolIds, capabilities: authorization.capabilities,
			previewWork: authorization.previewSubjectDigest !== null, writable: authorization.writableScope.length !== 0,
			budget: authorization.budget, outputSchemaDigest: authorization.outputSchemaDigest},
	});
	return policy.ok && policy.value === DECISION_MODEL_CHECK_EXECUTION_DIGEST && authorization.policyDigest === policy.value;
}

export async function startAuthorizedAgentRun(
	runtime: AgentRuntimePort,
	authorization: AgentRunAuthorization,
	material: AgentRunMaterial,
): Promise<Outcome<AgentRunHandle, AgentRuntimeIssue>> {
	const draft = {requestDigest: emptyDigest, authorization, material};
	const requestDigest = agentRunStartRequestDigest(draft);
	if (!requestDigest.ok) return failure(runtimeIssue("invalid_request", requestDigest.error.message));
	return runtime.start(Object.freeze({...draft, requestDigest: requestDigest.value}));
}

export async function cancelAuthorizedAgentRun(
	runtime: AgentRuntimePort,
	input: Omit<AgentRunCancellationRequest, "requestDigest">,
): Promise<Outcome<AgentRunHandle, AgentRuntimeIssue>> {
	const draft = {...input, requestDigest: emptyDigest};
	const requestDigest = agentRunCancellationRequestDigest(draft);
	if (!requestDigest.ok) return failure(runtimeIssue("invalid_request", requestDigest.error.message));
	return runtime.cancel(Object.freeze({...draft, requestDigest: requestDigest.value}));
}

function rolePolicy(
	role: AgentRunRole,
	toolIds: readonly string[],
	capabilities: readonly string[],
	previewWork: boolean,
	writable: boolean,
	value: AgentRunBudget,
): AgentRolePolicy {
	return Object.freeze({
		role,
		toolIds: Object.freeze([...toolIds].sort(compareText)),
		capabilities: Object.freeze([...capabilities].sort(compareText)),
		previewWork,
		writable,
		budget: Object.freeze(value),
		outputSchemaDigest: staticDigest("codewiki.agent-output-schema@1.0.0", {role}),
	});
}

function budget(
	maximumModelRequests: number,
	maximumToolCalls: number,
	timeoutMs: number,
	maximumInputTokens: number,
	maximumOutputTokens: number,
	maximumOutputBytes: number,
): AgentRunBudget {
	return {timeoutMs, maximumModelRequests, maximumToolCalls, maximumInputTokens, maximumOutputTokens, maximumOutputBytes};
}

function canonicalTimestamp(value: string): string | null {
	try {
		const timestamp = new Date(value).toISOString();
		return timestamp === value || timestamp.replace(".000Z", "Z") === value ? timestamp : null;
	} catch {
		return null;
	}
}

function staticDigest(protocol: string, value: unknown): Sha256Digest {
	const digest = semanticDigest(protocol, value);
	if (!digest.ok) throw new Error(`Static Agent policy is invalid: ${digest.error.message}`);
	return digest.value;
}

function authorizationIssue(code: AgentRunAuthorizationIssue["code"], message: string): AgentRunAuthorizationIssue {
	return Object.freeze({code, message});
}

function runtimeIssue(code: AgentRuntimeIssue["code"], message: string): AgentRuntimeIssue {
	return Object.freeze({code, message});
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

const emptyDigest = `sha256:${"0".repeat(64)}` as Sha256Digest;
