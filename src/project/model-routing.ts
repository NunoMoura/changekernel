import { createCodewikiConfigError } from "./config-errors.ts";

export type WikiModelQuality = "standard" | "high" | "critical";
export type WikiModelLatency = "fast" | "balanced" | "slow";
export type WikiModelThinking =
	| "off"
	| "minimal"
	| "low"
	| "medium"
	| "high"
	| "xhigh"
	| "max";

export interface WikiModelPricingConfig {
	inputUsdPerMillion: number;
	outputUsdPerMillion: number;
	cacheReadUsdPerMillion: number;
	cacheWriteUsdPerMillion: number;
}

export interface WikiModelRouteConfig {
	id: string;
	provider: string;
	accountId: string;
	credentialRef: string | null;
	model: string;
	thinking: WikiModelThinking;
	quality: WikiModelQuality;
	latency: WikiModelLatency;
	contextWindowTokens: number;
	timeoutMs: number;
	pricing: WikiModelPricingConfig;
	allowedTools: string[];
}

export interface WikiModelEscalationTransitionConfig {
	fromRouteId: string;
	toRouteId: string;
}

export type WikiHarnessStage = "harness" | "decision" | "planning" | "review";

export interface WikiModelRoleRoutesConfig {
	harness: string | null;
	decision: string | "inherit";
	planning: string | "inherit";
	review: string | "inherit";
	workers: string[];
}

export interface WikiModelRoutingConfig {
	qualityFloor: WikiModelQuality;
	maxEscalations: number;
	estimatedInputTokens: number;
	estimatedOutputTokens: number;
	routes: WikiModelRouteConfig[];
	roleRoutes: WikiModelRoleRoutesConfig;
	escalationTransitions: WikiModelEscalationTransitionConfig[];
}

export type PartialWikiModelRoutingConfig = Partial<
	Omit<WikiModelRoutingConfig, "routes" | "roleRoutes" | "escalationTransitions">
> & {
	routes?: WikiModelRouteConfig[];
	roleRoutes?: Partial<WikiModelRoleRoutesConfig>;
	escalationTransitions?: WikiModelEscalationTransitionConfig[];
};

export const DEFAULT_MODEL_ROUTING_CONFIG: WikiModelRoutingConfig = {
	qualityFloor: "standard",
	maxEscalations: 0,
	estimatedInputTokens: 75_000,
	estimatedOutputTokens: 25_000,
	routes: [],
	roleRoutes: {
		harness: null,
		decision: "inherit",
		planning: "inherit",
		review: "inherit",
		workers: [],
	},
	escalationTransitions: [],
};

export function resolveWikiModelRoutingConfig(
	input: PartialWikiModelRoutingConfig = {},
): WikiModelRoutingConfig {
	validatePartialWikiModelRoutingKeys(input, "runtime.modelRouting");
	return validateWikiModelRoutingConfig({
		...DEFAULT_MODEL_ROUTING_CONFIG,
		...input,
		routes: (input.routes || DEFAULT_MODEL_ROUTING_CONFIG.routes).map(
			(route) => ({
				...route,
				pricing: { ...route.pricing },
				allowedTools: [...route.allowedTools],
			}),
		),
		roleRoutes: {
			...DEFAULT_MODEL_ROUTING_CONFIG.roleRoutes,
			...(input.roleRoutes || {}),
			workers: input.roleRoutes?.workers
				? [...input.roleRoutes.workers]
				: [...DEFAULT_MODEL_ROUTING_CONFIG.roleRoutes.workers],
		},
		escalationTransitions: (
			input.escalationTransitions || DEFAULT_MODEL_ROUTING_CONFIG.escalationTransitions
		).map((transition) => ({...transition})),
	});
}

export function validateWikiModelRoutingConfig(
	config: WikiModelRoutingConfig,
): WikiModelRoutingConfig {
	validateRoutingScalars(config);
	const {routes, routeIds} = validateRoutes(config.routes);
	const roleRoutes = validateRoleRoutes(config.roleRoutes, routeIds);
	const escalationTransitions = validateEscalationTransitions(
		config.escalationTransitions,
		routeIds,
		new Set(roleRoutes.workers),
	);
	return {
		qualityFloor: config.qualityFloor,
		maxEscalations: config.maxEscalations,
		estimatedInputTokens: config.estimatedInputTokens,
		estimatedOutputTokens: config.estimatedOutputTokens,
		routes,
		roleRoutes,
		escalationTransitions,
	};
}

function validateRoutingScalars(config: WikiModelRoutingConfig): void {
	if (!isQuality(config.qualityFloor)) {
		throw configError(
			"runtime.modelRouting.qualityFloor",
			"must be standard, high, or critical.",
			config.qualityFloor,
		);
	}
	if (!Number.isInteger(config.maxEscalations) || config.maxEscalations < 0) {
		throw configError(
			"runtime.modelRouting.maxEscalations",
			"must be a non-negative integer.",
			config.maxEscalations,
		);
	}
	for (const field of ["estimatedInputTokens", "estimatedOutputTokens"] as const) {
		if (!Number.isInteger(config[field]) || config[field] < 0) {
			throw configError(
				`runtime.modelRouting.${field}`,
				"must be a non-negative integer.",
				config[field],
			);
		}
	}
	if (config.estimatedInputTokens + config.estimatedOutputTokens < 1) {
		throw configError("runtime.modelRouting", "must estimate at least one token.", config);
	}
}

function validateRoutes(value: WikiModelRouteConfig[]): {
	readonly routes: WikiModelRouteConfig[];
	readonly routeIds: ReadonlySet<string>;
} {
	if (!Array.isArray(value) || value.length > 32) {
		throw configError(
			"runtime.modelRouting.routes",
			"must contain at most 32 routes.",
			value,
		);
	}
	const routes = value.map(validateRoute);
	const routeIds = new Set<string>();
	for (const route of routes) {
		if (routeIds.has(route.id)) {
			throw configError(
				"runtime.modelRouting.routes",
				`contains duplicate route id ${route.id}.`,
				route.id,
			);
		}
		routeIds.add(route.id);
	}
	return {routes, routeIds};
}

function validateEscalationTransitions(
	value: WikiModelEscalationTransitionConfig[],
	routeIds: ReadonlySet<string>,
	workerRouteIds: ReadonlySet<string>,
): WikiModelEscalationTransitionConfig[] {
	if (!Array.isArray(value) || value.length > 64) {
		throw configError(
			"runtime.modelRouting.escalationTransitions",
			"must contain at most 64 transitions.",
			value,
		);
	}
	const transitionKeys = new Set<string>();
	return value.map((transition, index) => {
		const path = `runtime.modelRouting.escalationTransitions[${index}]`;
		const fromRouteId = identifier(transition.fromRouteId, `${path}.fromRouteId`);
		const toRouteId = identifier(transition.toRouteId, `${path}.toRouteId`);
		if (!routeIds.has(fromRouteId) || !routeIds.has(toRouteId)) {
			throw configError(path, "must reference configured routes.", transition);
		}
		if (!workerRouteIds.has(fromRouteId) || !workerRouteIds.has(toRouteId)) {
			throw configError(
				path,
				"must stay within the user-authorized Worker route pool.",
				transition,
			);
		}
		if (fromRouteId === toRouteId) {
			throw configError(path, "cannot transition a route to itself.", transition);
		}
		const key = `${fromRouteId}\0${toRouteId}`;
		if (transitionKeys.has(key)) {
			throw configError(path, "duplicates an escalation transition.", transition);
		}
		transitionKeys.add(key);
		return {fromRouteId, toRouteId};
	});
}

export function resolveWikiStageModelRoute(
	config: WikiModelRoutingConfig,
	stage: WikiHarnessStage,
): WikiModelRouteConfig | null {
	const validated = validateWikiModelRoutingConfig(config);
	const configured = stage === "harness"
		? validated.roleRoutes.harness
		: validated.roleRoutes[stage];
	const routeId = configured === "inherit"
		? validated.roleRoutes.harness
		: configured;
	if (routeId === null) return null;
	return validated.routes.find((route) => route.id === routeId) || null;
}

export function validatePartialWikiModelRoutingKeys(
	value: unknown,
	path: string,
): void {
	if (value === undefined) return;
	const config = record(value, path);
	knownKeys(config, path, [
		"qualityFloor",
		"maxEscalations",
		"estimatedInputTokens",
		"estimatedOutputTokens",
		"routes",
		"roleRoutes",
		"escalationTransitions",
	]);
	if (config.roleRoutes !== undefined) {
		knownKeys(record(config.roleRoutes, `${path}.roleRoutes`), `${path}.roleRoutes`, [
			"harness",
			"decision",
			"planning",
			"review",
			"workers",
		]);
	}
	if (config.escalationTransitions !== undefined) {
		if (!Array.isArray(config.escalationTransitions)) {
			throw configError(
				`${path}.escalationTransitions`,
				"must be an array.",
				config.escalationTransitions,
			);
		}
		for (const [index, candidate] of config.escalationTransitions.entries()) {
			const transitionPath = `${path}.escalationTransitions[${index}]`;
			knownKeys(record(candidate, transitionPath), transitionPath, [
				"fromRouteId",
				"toRouteId",
			]);
		}
	}
	if (config.routes === undefined) return;
	if (!Array.isArray(config.routes)) {
		throw configError(`${path}.routes`, "must be an array.", config.routes);
	}
	for (const [index, candidate] of config.routes.entries()) {
		const routePath = `${path}.routes[${index}]`;
		const route = record(candidate, routePath);
		knownKeys(route, routePath, [
			"id",
			"provider",
			"accountId",
			"credentialRef",
			"model",
			"thinking",
			"quality",
			"latency",
			"contextWindowTokens",
			"timeoutMs",
			"pricing",
			"allowedTools",
		]);
		const pricing = record(route.pricing, `${routePath}.pricing`);
		knownKeys(pricing, `${routePath}.pricing`, [
			"inputUsdPerMillion",
			"outputUsdPerMillion",
			"cacheReadUsdPerMillion",
			"cacheWriteUsdPerMillion",
		]);
	}
}

function validateRoleRoutes(
	value: WikiModelRoleRoutesConfig,
	routeIds: ReadonlySet<string>,
): WikiModelRoleRoutesConfig {
	const path = "runtime.modelRouting.roleRoutes";
	const roles = record(value, path);
	knownKeys(roles, path, ["harness", "decision", "planning", "review", "workers"]);
	const harness = roles.harness === null
		? null
		: routeReference(roles.harness, `${path}.harness`, routeIds);
	const decision = stageRouteReference(roles.decision, `${path}.decision`, routeIds);
	const planning = stageRouteReference(roles.planning, `${path}.planning`, routeIds);
	const review = stageRouteReference(roles.review, `${path}.review`, routeIds);
	if (!Array.isArray(roles.workers) || roles.workers.length > 32) {
		throw configError(`${path}.workers`, "must contain at most 32 route ids.", roles.workers);
	}
	const workers = unique(
		roles.workers.map((routeId) =>
			routeReference(routeId, `${path}.workers`, routeIds),
		),
	);
	return {harness, decision, planning, review, workers};
}

function stageRouteReference(
	value: unknown,
	path: string,
	routeIds: ReadonlySet<string>,
): string {
	return value === "inherit" ? value : routeReference(value, path, routeIds);
}

function routeReference(
	value: unknown,
	path: string,
	routeIds: ReadonlySet<string>,
): string {
	const routeId = identifier(value, path);
	if (!routeIds.has(routeId)) {
		throw configError(path, "must reference a configured route.", value);
	}
	return routeId;
}

function validateRoute(
	route: WikiModelRouteConfig,
	index: number,
): WikiModelRouteConfig {
	const path = `runtime.modelRouting.routes[${index}]`;
	const id = identifier(route.id, `${path}.id`);
	const provider = identifier(route.provider, `${path}.provider`);
	const accountId = identifier(route.accountId, `${path}.accountId`);
	const credentialRef = route.credentialRef === null
		? null
		: credentialReference(route.credentialRef, `${path}.credentialRef`);
	const model = modelIdentifier(route.model, `${path}.model`);
	if (!isThinking(route.thinking)) {
		throw configError(`${path}.thinking`, "is invalid.", route.thinking);
	}
	if (!isQuality(route.quality)) {
		throw configError(`${path}.quality`, "is invalid.", route.quality);
	}
	if (!isLatency(route.latency)) {
		throw configError(`${path}.latency`, "is invalid.", route.latency);
	}
	if (!Number.isInteger(route.contextWindowTokens) || route.contextWindowTokens < 1) {
		throw configError(
			`${path}.contextWindowTokens`,
			"must be >= 1.",
			route.contextWindowTokens,
		);
	}
	if (!Number.isInteger(route.timeoutMs) || route.timeoutMs < 1) {
		throw configError(`${path}.timeoutMs`, "must be >= 1.", route.timeoutMs);
	}
	const pricing = validatePricing(route.pricing, `${path}.pricing`);
	if (!Array.isArray(route.allowedTools) || route.allowedTools.length > 64) {
		throw configError(
			`${path}.allowedTools`,
			"must contain at most 64 tool ids.",
			route.allowedTools,
		);
	}
	return {
		id,
		provider,
		accountId,
		credentialRef,
		model,
		thinking: route.thinking,
		quality: route.quality,
		latency: route.latency,
		contextWindowTokens: route.contextWindowTokens,
		timeoutMs: route.timeoutMs,
		pricing,
		allowedTools: unique(
			route.allowedTools.map((tool) =>
				identifier(tool, `${path}.allowedTools`),
			),
		),
	};
}

function validatePricing(
	pricing: WikiModelPricingConfig,
	path: string,
): WikiModelPricingConfig {
	return {
		inputUsdPerMillion: price(
			pricing.inputUsdPerMillion,
			`${path}.inputUsdPerMillion`,
		),
		outputUsdPerMillion: price(
			pricing.outputUsdPerMillion,
			`${path}.outputUsdPerMillion`,
		),
		cacheReadUsdPerMillion: price(
			pricing.cacheReadUsdPerMillion,
			`${path}.cacheReadUsdPerMillion`,
		),
		cacheWriteUsdPerMillion: price(
			pricing.cacheWriteUsdPerMillion,
			`${path}.cacheWriteUsdPerMillion`,
		),
	};
}

function price(value: unknown, path: string): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		throw configError(path, "must be a finite non-negative number.", value);
	}
	return value;
}

function identifier(value: unknown, path: string): string {
	if (
		typeof value !== "string" ||
		value.length < 1 ||
		value.length > 120 ||
		!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
	) {
		throw configError(path, "contains an invalid identifier.", value);
	}
	return value;
}

function modelIdentifier(value: unknown, path: string): string {
	if (
		typeof value !== "string" ||
		value.length < 1 ||
		value.length > 200 ||
		!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value)
	) {
		throw configError(path, "contains an invalid model id.", value);
	}
	return value;
}

function credentialReference(value: unknown, path: string): string {
	if (
		typeof value !== "string" ||
		value.length > 128 ||
		!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)
	) {
		throw configError(path, "contains an invalid credential reference.", value);
	}
	return value;
}

function isThinking(value: unknown): value is WikiModelThinking {
	return ["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(
		String(value),
	);
}

function isQuality(value: unknown): value is WikiModelQuality {
	return ["standard", "high", "critical"].includes(String(value));
}

function isLatency(value: unknown): value is WikiModelLatency {
	return ["fast", "balanced", "slow"].includes(String(value));
}

function record(value: unknown, path: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw configError(path, "must be an object.", value);
	}
	return value as Record<string, unknown>;
}

function knownKeys(
	value: Record<string, unknown>,
	path: string,
	allowed: readonly string[],
): void {
	const known = new Set(allowed);
	for (const key of Object.keys(value)) {
		if (known.has(key)) continue;
		throw configError(`${path}.${key}`, "is unknown.", value[key]);
	}
}

function unique(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))].sort((left, right) =>
		left.localeCompare(right),
	);
}

function configError(path: string, message: string, value: unknown) {
	return createCodewikiConfigError({
		path,
		message: `wiki_config ${path} ${message}`,
		value,
	});
}
