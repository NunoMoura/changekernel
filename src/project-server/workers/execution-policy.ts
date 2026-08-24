import type {
	WikiConfig,
	WikiConfigAgencyLevel,
	WikiModelQuality,
	WikiModelRouteConfig,
} from "../../project/config.ts";
import {
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {
	resolveExecutionRecovery,
	type ExecutionFailureKind,
	type ExecutionRecoveryDecision,
} from "./execution-recovery.ts";

export type ExecutionRisk = "low" | "medium" | "high" | "critical";
export type ExecutionTarget =
	| "planning"
	| "implementation"
	| "close"
	| "worker";
export type ExecutionAttemptOutcome =
	| "completed"
	| "blocked"
	| "failed"
	| "cancelled";

export interface ExecutionPolicyAttempt {
	routeId: string;
	outcome: ExecutionAttemptOutcome;
	failureKind?: ExecutionFailureKind;
	inputTokens: number;
	outputTokens: number;
	costUsd: number;
	latencyMs: number;
}

export interface ExecutionPolicyContext {
	target: ExecutionTarget;
	changeType?: string;
	workerProfile?: string;
	risk: ExecutionRisk;
	pathScopes: string[];
	requiredTools: string[];
	estimatedInputTokens: number;
	estimatedOutputTokens: number;
	priorUsage?: {
		totalTokens: number;
		costUsd: number;
		latencyMs: number;
	};
	previousAttempts?: ExecutionPolicyAttempt[];
}

export interface ExecutionAutonomyCapabilities {
	readState: boolean;
	previewLoops: boolean;
	editSource: boolean;
	runChecks: boolean;
	startWorkers: boolean;
	appendApprovedIterations: boolean;
	acceptChanges: false;
	destructiveActions: false;
	publicActions: false;
	promoteSource: false;
	publishPackage: false;
	advanceController: false;
	continueWithoutSupervision: false;
}

export interface ExecutionRouteRejection {
	routeId: string;
	reasons: string[];
}

export interface WorkerExecutionUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	costUsd: number;
	latencyMs: number;
}

export interface WorkerExecutionPolicySnapshot {
	readonly digest: Sha256Digest;
	readonly qualityFloor: WikiModelQuality;
	readonly route: {
		readonly routeId: string;
		readonly provider: string;
		readonly accountId: string;
		readonly credentialRef: string | null;
		readonly model: string;
		readonly thinking: WikiModelRouteConfig["thinking"];
		readonly quality: WikiModelQuality;
		readonly contextWindowTokens: number;
		readonly timeoutMs: number;
		readonly allowedTools: readonly string[];
		readonly pricingSnapshot: Readonly<WikiModelRouteConfig["pricing"]>;
	};
	readonly budget: Readonly<ResolvedExecutionPolicy["budget"]>;
	readonly escalation: Readonly<ResolvedExecutionPolicy["escalation"]>;
}

export interface WorkerExecutionVerification {
	policyDigest: Sha256Digest;
	routeId: string;
	usage: WorkerExecutionUsage;
}

export interface ResolvedExecutionPolicy {
	status: "selected" | "blocked";
	digest: Sha256Digest;
	qualityFloor: WikiModelQuality;
	selected?: {
		routeId: string;
		provider: string;
		accountId: string;
		credentialRef: string | null;
		model: string;
		thinking: WikiModelRouteConfig["thinking"];
		contextWindowTokens: number;
		timeoutMs: number;
		estimatedCostUsd: number;
		quality: WikiModelQuality;
		latency: WikiModelRouteConfig["latency"];
		pricingSnapshot: WikiModelRouteConfig["pricing"];
		allowedTools: string[];
	};
	eligibleRouteIds: string[];
	rejected: ExecutionRouteRejection[];
	capabilities: ExecutionAutonomyCapabilities;
	budget: {
		maxTokens?: number;
		maxCostUsd?: number;
		maxLatencyMs?: number;
		spentTokens: number;
		spentCostUsd: number;
		spentLatencyMs: number;
	};
	escalation: {
		attempt: number;
		maxEscalations: number;
		previousRouteId?: string;
		failureKind?: ExecutionFailureKind;
		recoveryAction?: ExecutionRecoveryDecision["action"];
	};
	rationale: string;
}

export function workerExecutionPolicySnapshot(
	policy: ResolvedExecutionPolicy,
): WorkerExecutionPolicySnapshot {
	if (policy.status !== "selected" || !policy.selected) {
		throw new Error(`Worker execution policy blocked: ${policy.rationale}`);
	}
	return {
		digest: policy.digest,
		qualityFloor: policy.qualityFloor,
		route: {
			routeId: policy.selected.routeId,
			provider: policy.selected.provider,
			accountId: policy.selected.accountId,
			credentialRef: policy.selected.credentialRef,
			model: policy.selected.model,
			thinking: policy.selected.thinking,
			quality: policy.selected.quality,
			contextWindowTokens: policy.selected.contextWindowTokens,
			timeoutMs: policy.selected.timeoutMs,
			allowedTools: [...policy.selected.allowedTools],
			pricingSnapshot: { ...policy.selected.pricingSnapshot },
		},
		budget: { ...policy.budget },
		escalation: { ...policy.escalation },
	};
}

export function verifyWorkerExecutionUsage(
	policy: WorkerExecutionPolicySnapshot,
	usage: WorkerExecutionUsage | undefined,
): WorkerExecutionVerification {
	if (!usage) throw new Error("Worker usage telemetry is missing.");
	for (const [field, value] of Object.entries(usage)) {
		if (!Number.isFinite(value) || value < 0) {
			throw new Error(`Worker usage ${field} is invalid.`);
		}
	}
	if (usage.totalTokens !== usage.inputTokens + usage.outputTokens) {
		throw new Error(
			"Worker usage totalTokens does not match input and output.",
		);
	}
	if (
		policy.budget.maxTokens !== undefined &&
		policy.budget.spentTokens + usage.totalTokens > policy.budget.maxTokens
	) {
		throw new Error("Worker token budget exceeded.");
	}
	if (
		policy.budget.maxCostUsd !== undefined &&
		policy.budget.spentCostUsd + usage.costUsd > policy.budget.maxCostUsd
	) {
		throw new Error("Worker monetary budget exceeded.");
	}
	if (
		policy.budget.maxLatencyMs !== undefined &&
		policy.budget.spentLatencyMs + usage.latencyMs > policy.budget.maxLatencyMs
	) {
		throw new Error("Worker latency budget exceeded.");
	}
	return {
		policyDigest: policy.digest,
		routeId: policy.route.routeId,
		usage: { ...usage },
	};
}

interface CandidateEvaluation {
	route: WikiModelRouteConfig;
	estimatedCostUsd: number;
	reasons: string[];
}

export function resolveExecutionPolicy(
	config: WikiConfig,
	context: ExecutionPolicyContext,
): ResolvedExecutionPolicy {
	const normalized = normalizeContext(context);
	const attempts = normalized.previousAttempts || [];
	const history = executionHistory(config, attempts);
	const qualityFloor = effectiveQualityFloor(
		config.runtime.modelRouting.qualityFloor,
		normalized,
	);
	const budget = budgetState(config, attempts, normalized.priorUsage);
	const evaluations = config.runtime.modelRouting.routes.map((route) =>
		evaluateCandidate(
			route,
			config,
			normalized,
			qualityFloor,
			budget,
			attempts,
		),
	);
	applyEscalationPolicy(config, evaluations, history);
	const eligible = evaluations
		.filter((evaluation) => evaluation.reasons.length === 0)
		.sort(compareCandidates);
	const escalationAllowed = routeSelectionAllowed(
		history,
		config.runtime.modelRouting.maxEscalations,
	);
	const selected = escalationAllowed ? eligible[0] : undefined;
	const policy: Omit<ResolvedExecutionPolicy, "digest"> = {
		status: selected ? "selected" : "blocked",
		qualityFloor,
		eligibleRouteIds: eligible.map((evaluation) => evaluation.route.id),
		rejected: rejectedRoutes(evaluations),
		capabilities: autonomyCapabilities(
			config.runtime.agency,
			config.runtime.automation,
		),
		budget,
		escalation: escalationEvidence(
			history,
			config.runtime.modelRouting.maxEscalations,
		),
		rationale: policyRationale(
			selected,
			qualityFloor,
			history.attempt,
			escalationAllowed,
			history.recovery,
		),
	};
	if (selected) policy.selected = selectedRoute(selected);
	return {...policy, digest: canonicalJsonDigest(policy)};
}

interface ExecutionHistory {
	readonly attempt: number;
	readonly previous: ExecutionPolicyAttempt | undefined;
	readonly previousRoute: WikiModelRouteConfig | undefined;
	readonly recovery: ExecutionRecoveryDecision | undefined;
}

function executionHistory(
	config: WikiConfig,
	attempts: readonly ExecutionPolicyAttempt[],
): ExecutionHistory {
	const previous = attempts.at(-1);
	const previousRoute = previous
		? config.runtime.modelRouting.routes.find((route) => route.id === previous.routeId)
		: undefined;
	const recovery = previous?.outcome === "failed" && previous.failureKind
		? resolveExecutionRecovery(previous.failureKind)
		: undefined;
	return {attempt: attempts.length, previous, previousRoute, recovery};
}

function applyEscalationPolicy(
	config: WikiConfig,
	evaluations: CandidateEvaluation[],
	history: ExecutionHistory,
): void {
	if (!history.previous) return;
	for (const evaluation of evaluations) {
		if (evaluation.reasons.length > 0) continue;
		const rejection = escalationRejection(
			evaluation.route,
			history.previous,
			history.previousRoute,
			history.recovery,
			config.runtime.modelRouting.escalationTransitions,
		);
		if (rejection) evaluation.reasons.push(rejection);
	}
}

function routeSelectionAllowed(
	history: ExecutionHistory,
	maxEscalations: number,
): boolean {
	if (history.attempt === 0) return true;
	return Boolean(
		history.recovery?.owner === "project-server" &&
		history.recovery.routeRequirement !== "none" &&
		history.attempt <= maxEscalations,
	);
}

function rejectedRoutes(
	evaluations: readonly CandidateEvaluation[],
): ExecutionRouteRejection[] {
	return evaluations.flatMap((evaluation) =>
		evaluation.reasons.length === 0
			? []
			: [{routeId: evaluation.route.id, reasons: evaluation.reasons}],
	);
}

function escalationEvidence(
	history: ExecutionHistory,
	maxEscalations: number,
): ResolvedExecutionPolicy["escalation"] {
	const evidence: ResolvedExecutionPolicy["escalation"] = {
		attempt: history.attempt,
		maxEscalations,
	};
	if (history.previous) evidence.previousRouteId = history.previous.routeId;
	if (history.previous?.failureKind) evidence.failureKind = history.previous.failureKind;
	if (history.recovery) evidence.recoveryAction = history.recovery.action;
	return evidence;
}

function evaluateCandidate(
	route: WikiModelRouteConfig,
	config: WikiConfig,
	context: ExecutionPolicyContext,
	qualityFloor: WikiModelQuality,
	budget: ResolvedExecutionPolicy["budget"],
	attempts: ExecutionPolicyAttempt[],
): CandidateEvaluation {
	const reasons: string[] = [];
	const estimatedCostUsd = estimatedCost(route, context);
	if (qualityRank(route.quality) < qualityRank(qualityFloor)) {
		reasons.push(`quality ${route.quality} is below required ${qualityFloor}.`);
	}
	const missingTools = context.requiredTools.filter(
		(tool) => !route.allowedTools.includes(tool),
	);
	if (missingTools.length > 0) {
		reasons.push(`missing required tools: ${missingTools.join(", ")}.`);
	}
	const estimatedTokens =
		context.estimatedInputTokens + context.estimatedOutputTokens;
	if (estimatedTokens > route.contextWindowTokens) {
		reasons.push("estimated context exceeds the route context window.");
	}
	if (
		config.runtime.budgets.maxTokens !== undefined &&
		budget.spentTokens + estimatedTokens > config.runtime.budgets.maxTokens
	) {
		reasons.push("token budget would be exceeded.");
	}
	if (
		config.runtime.budgets.maxCostUsd !== undefined &&
		budget.spentCostUsd + estimatedCostUsd > config.runtime.budgets.maxCostUsd
	) {
		reasons.push("monetary budget would be exceeded.");
	}
	const maxLatencyMs = effectiveLatencyBudget(config);
	if (
		maxLatencyMs !== undefined &&
		budget.spentLatencyMs + route.timeoutMs > maxLatencyMs
	) {
		reasons.push("latency budget would be exceeded.");
	}
	if (attempts.some((entry) => entry.routeId === route.id)) {
		reasons.push("route was already attempted.");
	}
	return { route, estimatedCostUsd, reasons };
}

function escalationRejection(
	route: WikiModelRouteConfig,
	previous: ExecutionPolicyAttempt,
	previousRoute: WikiModelRouteConfig | undefined,
	recovery: ExecutionRecoveryDecision | undefined,
	transitions: WikiConfig["runtime"]["modelRouting"]["escalationTransitions"],
): string | null {
	if (!previousRoute) return `previous route ${previous.routeId} is not in policy.`;
	if (!recovery || recovery.owner !== "project-server" || recovery.routeRequirement === "none") {
		return recovery
			? `recovery action ${recovery.action} does not authorize a route change.`
			: "failed attempt has no typed recovery authorization.";
	}
	if (!transitions.some(
		(transition) =>
			transition.fromRouteId === previous.routeId &&
			transition.toRouteId === route.id,
	)) {
		return `transition ${previous.routeId} -> ${route.id} is not user-authorized.`;
	}
	if (
		recovery.routeRequirement === "stronger" &&
		qualityRank(route.quality) <= qualityRank(previousRoute.quality)
	) {
		return `capability escalation must exceed ${previousRoute.quality} quality.`;
	}
	if (
		recovery.routeRequirement === "larger-context" &&
		route.contextWindowTokens <= previousRoute.contextWindowTokens
	) {
		return `context recovery must exceed ${previousRoute.contextWindowTokens} tokens.`;
	}
	if (
		recovery.routeRequirement === "compatible" &&
		qualityRank(route.quality) < qualityRank(previousRoute.quality)
	) {
		return `compatible-route recovery cannot downgrade ${previousRoute.quality} quality.`;
	}
	return null;
}

function compareCandidates(
	left: CandidateEvaluation,
	right: CandidateEvaluation,
): number {
	return (
		left.estimatedCostUsd - right.estimatedCostUsd ||
		latencyRank(left.route.latency) - latencyRank(right.route.latency) ||
		qualityRank(left.route.quality) - qualityRank(right.route.quality) ||
		left.route.id.localeCompare(right.route.id)
	);
}

function selectedRoute(evaluation: CandidateEvaluation) {
	const route = evaluation.route;
	return {
		routeId: route.id,
		provider: route.provider,
		accountId: route.accountId,
		credentialRef: route.credentialRef,
		model: route.model,
		thinking: route.thinking,
		contextWindowTokens: route.contextWindowTokens,
		timeoutMs: route.timeoutMs,
		estimatedCostUsd: evaluation.estimatedCostUsd,
		quality: route.quality,
		latency: route.latency,
		pricingSnapshot: { ...route.pricing },
		allowedTools: [...route.allowedTools],
	};
}

function estimatedCost(
	route: WikiModelRouteConfig,
	context: ExecutionPolicyContext,
): number {
	return (
		(context.estimatedInputTokens * route.pricing.inputUsdPerMillion +
			context.estimatedOutputTokens * route.pricing.outputUsdPerMillion) /
		1_000_000
	);
}

function budgetState(
	config: WikiConfig,
	attempts: ExecutionPolicyAttempt[],
	priorUsage: ExecutionPolicyContext["priorUsage"],
): ResolvedExecutionPolicy["budget"] {
	return {
		...(config.runtime.budgets.maxTokens !== undefined
			? { maxTokens: config.runtime.budgets.maxTokens }
			: {}),
		...(config.runtime.budgets.maxCostUsd !== undefined
			? { maxCostUsd: config.runtime.budgets.maxCostUsd }
			: {}),
		...(effectiveLatencyBudget(config) !== undefined
			? { maxLatencyMs: effectiveLatencyBudget(config) }
			: {}),
		spentTokens:
			(priorUsage?.totalTokens || 0) +
			attempts.reduce(
				(sum, entry) => sum + entry.inputTokens + entry.outputTokens,
				0,
			),
		spentCostUsd:
			(priorUsage?.costUsd || 0) +
			attempts.reduce((sum, entry) => sum + entry.costUsd, 0),
		spentLatencyMs:
			(priorUsage?.latencyMs || 0) +
			attempts.reduce((sum, entry) => sum + entry.latencyMs, 0),
	};
}

function effectiveLatencyBudget(config: WikiConfig): number | undefined {
	const budgets = [
		config.runtime.budgets.maxLatencyMs,
		config.runtime.budgets.maxSeconds === undefined
			? undefined
			: config.runtime.budgets.maxSeconds * 1_000,
	].filter((value): value is number => value !== undefined);
	return budgets.length > 0 ? Math.min(...budgets) : undefined;
}

function effectiveQualityFloor(
	configured: WikiModelQuality,
	context: ExecutionPolicyContext,
): WikiModelQuality {
	let floor = configured;
	if (context.risk === "high") floor = maxQuality(floor, "high");
	if (context.risk === "critical") floor = "critical";
	if (
		context.pathScopes.some((path) =>
			/(^|\/)(auth|security|secrets?|release|controllers?)(\/|$)/i.test(path),
		)
	) {
		floor = maxQuality(floor, "high");
	}
	if (/security|incident|release/i.test(context.changeType || "")) {
		floor = maxQuality(floor, "high");
	}
	if (/security|architecture|integration/i.test(context.workerProfile || "")) {
		floor = maxQuality(floor, "high");
	}
	return floor;
}

function maxQuality(
	left: WikiModelQuality,
	right: WikiModelQuality,
): WikiModelQuality {
	return qualityRank(left) >= qualityRank(right) ? left : right;
}

function qualityRank(value: WikiModelQuality): number {
	return { standard: 0, high: 1, critical: 2 }[value];
}

function latencyRank(value: WikiModelRouteConfig["latency"]): number {
	return { fast: 0, balanced: 1, slow: 2 }[value];
}

function normalizeContext(
	context: ExecutionPolicyContext,
): ExecutionPolicyContext {
	assertTokenEstimate("estimatedInputTokens", context.estimatedInputTokens);
	assertTokenEstimate("estimatedOutputTokens", context.estimatedOutputTokens);
	if (context.priorUsage) {
		assertUsageValues(
			Object.values(context.priorUsage),
			"Execution policy prior usage must be finite and non-negative.",
		);
	}
	return {
		...context,
		pathScopes: unique(context.pathScopes),
		requiredTools: unique(context.requiredTools),
		previousAttempts: (context.previousAttempts || []).map(normalizeAttempt),
	};
}

function assertTokenEstimate(name: string, value: number): void {
	if (!Number.isInteger(value) || value < 0) {
		throw new Error(`Execution policy ${name} must be a non-negative integer.`);
	}
}

function normalizeAttempt(attempt: ExecutionPolicyAttempt): ExecutionPolicyAttempt {
	assertUsageValues(
		[attempt.inputTokens, attempt.outputTokens, attempt.costUsd, attempt.latencyMs],
		"Execution policy attempt usage must be finite and non-negative.",
	);
	if (!(["completed", "blocked", "failed", "cancelled"] as const).includes(attempt.outcome)) {
		throw new Error("Execution policy attempt outcome is invalid.");
	}
	if (attempt.outcome === "failed") {
		if (!attempt.failureKind || !resolveExecutionRecovery(attempt.failureKind)) {
			throw new Error("Failed execution policy attempt requires a typed failure kind.");
		}
	} else if (attempt.failureKind !== undefined) {
		throw new Error("Only failed execution policy attempts may carry a failure kind.");
	}
	return {...attempt};
}

function assertUsageValues(values: readonly number[], message: string): void {
	if (values.some((value) => !Number.isFinite(value) || value < 0)) {
		throw new Error(message);
	}
}

function autonomyCapabilities(
	agency: WikiConfigAgencyLevel,
	automation: WikiConfig["runtime"]["automation"],
): ExecutionAutonomyCapabilities {
	const active = agency !== "observe";
	const delegated = agency === "delegate" || agency === "auto";
	return {
		readState: true,
		previewLoops: active,
		editSource: delegated,
		runChecks: delegated,
		startWorkers: delegated,
		appendApprovedIterations: delegated && automation !== "manual",
		acceptChanges: false,
		destructiveActions: false,
		publicActions: false,
		promoteSource: false,
		publishPackage: false,
		advanceController: false,
		continueWithoutSupervision: false,
	};
}

function policyRationale(
	selected: CandidateEvaluation | undefined,
	floor: WikiModelQuality,
	attempt: number,
	escalationAllowed: boolean,
	recovery: ExecutionRecoveryDecision | undefined,
): string {
	if (selected) {
		return `Selected ${selected.route.id}: meets ${floor} quality floor at lowest estimated cost, then latency.`;
	}
	if (!escalationAllowed) {
		return recovery
			? `Blocked: ${recovery.reason}`
			: `Blocked: escalation attempt ${attempt} lacks a typed failed outcome.`;
	}
	return `Blocked: no untried route within user authorization satisfies ${floor} quality, context, tools, and remaining budgets.`;
}

function unique(values: string[]): string[] {
	return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
