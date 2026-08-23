import type {ScheduledAssignment} from "../../changes/trace/scheduling.ts";
import type {PlanningWorkUnitCandidate} from "../../loops/planning/candidate-content.ts";
import type {WikiConfig} from "../../project/config.ts";
import {
	createRunModelRouteBinding,
	type RunModelRouteBinding,
} from "../../runtime/contracts.ts";
import {
	assertSha256Digest,
	canonicalJsonDigest,
	type Sha256Digest,
	toCanonicalJsonValue,
} from "../../utils/canonical-json.ts";
import {
	resolveExecutionPolicy,
	type ExecutionPolicyAttempt,
	type ExecutionPolicyContext,
	type ExecutionRisk,
	type WorkerExecutionPolicySnapshot,
	workerExecutionPolicySnapshot,
} from "./execution-policy.ts";

export const WORK_UNIT_MODEL_ASSIGNMENT_PROTOCOL = Object.freeze({
	id: "codewiki.work-unit-model-assignment",
	version: "1.0.0",
} as const);

export interface WorkUnitModelAssignment {
	readonly protocol: typeof WORK_UNIT_MODEL_ASSIGNMENT_PROTOCOL;
	readonly scheduledAssignmentAttemptId: string;
	readonly scheduledAssignmentDigest: Sha256Digest;
	readonly workUnitId: string;
	readonly workUnitDigest: Sha256Digest;
	readonly routePolicyDigest: Sha256Digest;
	readonly priorAttemptsDigest: Sha256Digest;
	readonly policy: WorkerExecutionPolicySnapshot;
	readonly assignmentDigest: Sha256Digest;
}

export interface CreateWorkUnitModelAssignmentInput {
	readonly config: WikiConfig;
	readonly assignment: ScheduledAssignment;
	readonly workUnit: PlanningWorkUnitCandidate;
	readonly risk: ExecutionRisk;
	readonly changeType?: string;
	readonly workerProfile?: string;
	readonly previousAttempts?: readonly ExecutionPolicyAttempt[];
	readonly priorUsage?: {
		readonly totalTokens: number;
		readonly costUsd: number;
		readonly latencyMs: number;
	};
}

export function createWorkUnitModelAssignment(
	input: CreateWorkUnitModelAssignmentInput,
): Readonly<WorkUnitModelAssignment> {
	assertWorkUnitBinding(input.assignment, input.workUnit);
	const previousAttempts = (input.previousAttempts || []).map((attempt) => ({...attempt}));
	const workerConfig = workerRoutingConfig(input.config);
	const context: ExecutionPolicyContext = {
		target: "worker",
		changeType: input.changeType,
		workerProfile: input.workerProfile,
		risk: input.risk,
		pathScopes: [...input.workUnit.pathScopes],
		requiredTools: [...input.workUnit.resourceRequirements.toolIds],
		estimatedInputTokens: input.config.runtime.modelRouting.estimatedInputTokens,
		estimatedOutputTokens: input.config.runtime.modelRouting.estimatedOutputTokens,
		previousAttempts,
	};
	if (input.priorUsage) context.priorUsage = {...input.priorUsage};
	const resolved = resolveExecutionPolicy(workerConfig, context);
	const policy = freezePolicy(workerExecutionPolicySnapshot(resolved));
	const body = Object.freeze({
		protocol: WORK_UNIT_MODEL_ASSIGNMENT_PROTOCOL,
		scheduledAssignmentAttemptId: input.assignment.assignmentAttemptId,
		scheduledAssignmentDigest: input.assignment.assignmentDigest,
		workUnitId: input.workUnit.id,
		workUnitDigest: canonicalJsonDigest(toCanonicalJsonValue(input.workUnit)),
		routePolicyDigest: canonicalJsonDigest({
			role: "worker",
			modelRouting: input.config.runtime.modelRouting,
		}),
		priorAttemptsDigest: canonicalJsonDigest(previousAttempts),
		policy,
	});
	return Object.freeze({
		...body,
		assignmentDigest: canonicalJsonDigest(body),
	});
}

function assertWorkUnitModelAssignment(
	assignment: WorkUnitModelAssignment,
): void {
	if (
		assignment.protocol?.id !== WORK_UNIT_MODEL_ASSIGNMENT_PROTOCOL.id ||
		assignment.protocol.version !== WORK_UNIT_MODEL_ASSIGNMENT_PROTOCOL.version
	) {
		throw new Error("Work Unit model Assignment protocol is invalid.");
	}
	assertSha256Digest(
		assignment.scheduledAssignmentDigest,
		"Work Unit model scheduled Assignment digest",
	);
	assertSha256Digest(assignment.workUnitDigest, "Work Unit model Work Unit digest");
	assertSha256Digest(assignment.routePolicyDigest, "Work Unit model route policy digest");
	assertSha256Digest(assignment.priorAttemptsDigest, "Work Unit model prior attempts digest");
	assertSha256Digest(assignment.policy.digest, "Work Unit model execution policy digest");
	const {assignmentDigest, ...body} = assignment;
	if (
		assertSha256Digest(assignmentDigest, "Work Unit model Assignment digest") !==
		canonicalJsonDigest(body)
	) {
		throw new Error("Work Unit model Assignment digest does not match its content.");
	}
}

export function runModelRouteForAssignment(
	assignment: WorkUnitModelAssignment,
): RunModelRouteBinding {
	assertWorkUnitModelAssignment(assignment);
	return createRunModelRouteBinding({
		routeId: assignment.policy.route.routeId,
		provider: assignment.policy.route.provider,
		model: assignment.policy.route.model,
		reasoningEffort: assignment.policy.route.thinking === "off"
			? null
			: assignment.policy.route.thinking,
		contextWindowTokens: assignment.policy.route.contextWindowTokens,
		timeoutMs: assignment.policy.route.timeoutMs,
		policyDigest: assignment.policy.digest,
		policyAttempt: assignment.policy.escalation.attempt,
		modelAssignmentDigest: assignment.assignmentDigest,
		optionsDigest: canonicalJsonDigest({
			thinking: assignment.policy.route.thinking,
			contextWindowTokens: assignment.policy.route.contextWindowTokens,
			timeoutMs: assignment.policy.route.timeoutMs,
			allowedTools: assignment.policy.route.allowedTools,
		}),
	});
}

function workerRoutingConfig(config: WikiConfig): WikiConfig {
	const authorized = new Set(config.runtime.modelRouting.roleRoutes.workers);
	if (authorized.size === 0) {
		throw new Error("Work Unit model Assignment has no user-authorized Worker routes.");
	}
	return {
		...config,
		runtime: {
			...config.runtime,
			modelRouting: {
				...config.runtime.modelRouting,
				routes: config.runtime.modelRouting.routes.filter((route) =>
					authorized.has(route.id)
				),
			},
		},
	};
}

function assertWorkUnitBinding(
	assignment: ScheduledAssignment,
	workUnit: PlanningWorkUnitCandidate,
): void {
	if (
		assignment.workUnitId !== workUnit.id ||
		assignment.owningChangeId !== workUnit.owningChangeId
	) {
		throw new Error("Work Unit model Assignment does not match its scheduled Assignment.");
	}
}

function freezePolicy(
	policy: WorkerExecutionPolicySnapshot,
): WorkerExecutionPolicySnapshot {
	return Object.freeze({
		...policy,
		route: Object.freeze({
			...policy.route,
			allowedTools: Object.freeze([...policy.route.allowedTools]),
			pricingSnapshot: Object.freeze({...policy.route.pricingSnapshot}),
		}),
		budget: Object.freeze({...policy.budget}),
		escalation: Object.freeze({...policy.escalation}),
	});
}
