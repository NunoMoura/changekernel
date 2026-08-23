import type {
	RunBudget,
	RunInputBindings,
	RunReceipt,
	RunRequest,
	RunSessionBinding,
	RuntimeBuildBinding,
} from "../../runtime/contracts.ts";
import {
	createRunRequest,
	createStageRunContinuationBinding,
} from "../../runtime/contracts.ts";
import type {
	ScheduledAssignment,
	WorkbenchBinding,
} from "../../changes/trace/scheduling.ts";
import type {PlanningWorkUnitCandidate} from "../../loops/planning/candidate-content.ts";
import {
	MAXIMUM_IMPLEMENTATION_ATTEMPTS,
	implementationContinuityKey,
	implementationWorkUnitSubjectId,
} from "../../loops/implementation/work-unit-candidate.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	toCanonicalJsonValue,
} from "../../utils/canonical-json.ts";
import {
	runModelRouteForAssignment,
	type WorkUnitModelAssignment,
} from "./model-assignment.ts";

export interface CreateImplementationRunRequestInput {
	readonly assignment: ScheduledAssignment;
	readonly workbench: WorkbenchBinding;
	readonly workUnit: PlanningWorkUnitCandidate;
	readonly modelAssignment: WorkUnitModelAssignment;
	readonly runtimeBuild: RuntimeBuildBinding;
	readonly inputs: RunInputBindings;
	readonly budget: RunBudget;
	readonly session: RunSessionBinding;
	readonly priorReceipts: readonly RunReceipt[];
	readonly runId: string;
	readonly createdAt: string;
	readonly deadlineAt: string;
}

export function createImplementationRunRequest(
	input: CreateImplementationRunRequestInput,
): RunRequest {
	assertImplementationRunBinding(
		input.assignment,
		input.workbench,
		input.workUnit,
		input.modelAssignment,
	);
	const modelRoute = runModelRouteForAssignment(input.modelAssignment);
	if (canonicalJson(input.inputs.modelRoute) !== canonicalJson(modelRoute)) {
		throw new Error("Implementation Run model route differs from its model Assignment.");
	}
	const continuityKey = implementationContinuityKey(input.workUnit.id);
	assertPriorReceipts(input.priorReceipts, continuityKey, input.runId);
	assertImplementationSession(
		input.session,
		continuityKey,
		input.priorReceipts.at(-1),
		modelRoute.routeDigest,
	);
	const previous = input.priorReceipts.at(-1);
	if (previous?.outputDigest) {
		throw new Error("Producing Implementation Run already exists for this Assignment.");
	}
	return createRunRequest({
		runId: requiredText(input.runId, "Implementation Run ID"),
		operationId: input.assignment.assignmentAttemptId,
		custody: "backend-owned",
		role: "implementation-worker",
		stage: "implementation",
		subject: {
			id: implementationWorkUnitSubjectId(input.workUnit.id),
			digest: canonicalJsonDigest(toCanonicalJsonValue(input.workUnit)),
		},
		runtimeBuild: input.runtimeBuild,
		session: input.session,
		inputs: input.inputs,
		continuation: implementationContinuationBinding(input),
		workspace: {
			kind: "runtime-workbench",
			repositorySnapshotDigest: input.workbench.workbenchDigest,
			assignmentId: input.assignment.assignmentAttemptId,
			workbenchRef: input.workbench.workbenchId,
		},
		budget: input.budget,
		createdAt: input.createdAt,
		deadlineAt: input.deadlineAt,
	});
}

function implementationContinuationBinding(
	input: CreateImplementationRunRequestInput,
) {
	const toolResultReserveTokens = Math.max(1, input.budget.maxToolCalls * 512);
	const contextWindowTokens = Math.max(
		32_768,
		input.budget.maxInputTokens +
			toolResultReserveTokens +
			input.budget.maxOutputTokens +
			8_192,
	);
	return createStageRunContinuationBinding({
		stage: "implementation",
		objectiveDigest: input.inputs.promptDigest,
		maxRounds: MAXIMUM_IMPLEMENTATION_ATTEMPTS,
		semanticStateDigest: input.inputs.materialDigest,
		authorityPromotionDigest: canonicalJsonDigest({
			assignment: input.assignment,
			workUnit: input.workUnit,
			previousReceiptDigest: input.priorReceipts.at(-1)?.receiptDigest ?? null,
		}),
		unresolvedObligationsDigest: canonicalJsonDigest({
			workUnitId: input.workUnit.id,
			workUnit: input.workUnit,
		}),
		feedbackDigest: input.inputs.feedbackDigest,
		contextWindowTokens,
		pressureThresholdTokens: Math.floor(contextWindowTokens * 0.8),
		expectedNextRunInputTokens: input.budget.maxInputTokens,
		toolResultReserveTokens,
		candidateOutputReserveTokens: input.budget.maxOutputTokens,
		retainRecentTokens: Math.floor(contextWindowTokens * 0.16),
		maxSummaryCharacters: 12_000,
	});
}

function assertImplementationRunBinding(
	assignment: ScheduledAssignment,
	workbench: WorkbenchBinding,
	workUnit: PlanningWorkUnitCandidate,
	modelAssignment: WorkUnitModelAssignment,
): void {
	if (
		assignment.workUnitId !== workUnit.id ||
		assignment.owningChangeId !== workUnit.owningChangeId ||
		assignment.assignmentAttemptId !== workbench.assignmentAttemptId ||
		assignment.workUnitId !== workbench.workUnitId ||
		assignment.workerId !== workbench.workerId ||
		assignment.workbenchDigest !== workbench.workbenchDigest ||
		assignment.sourceBase !== workbench.sourceBase ||
		modelAssignment.scheduledAssignmentAttemptId !== assignment.assignmentAttemptId ||
		modelAssignment.scheduledAssignmentDigest !== assignment.assignmentDigest ||
		modelAssignment.workUnitId !== workUnit.id ||
		modelAssignment.workUnitDigest !== canonicalJsonDigest(toCanonicalJsonValue(workUnit))
	) {
		throw new Error("Implementation Run requires exact Assignment, Workbench, and Work Unit.");
	}
}

function assertPriorReceipts(
	receipts: readonly RunReceipt[],
	continuityKey: string,
	nextRunId: string,
): void {
	if (receipts.length >= MAXIMUM_IMPLEMENTATION_ATTEMPTS) {
		throw new Error("Implementation attempt limit is exhausted.");
	}
	const runIds = new Set<string>();
	for (const receipt of receipts) {
		if (
			receipt.continuityKey !== continuityKey ||
			receipt.custody !== "backend-owned" ||
			receipt.custodyGaps.length > 0 ||
			runIds.has(receipt.runId)
		) {
			throw new Error("Implementation attempt receipt breaks persistent Session custody.");
		}
		runIds.add(receipt.runId);
	}
	if (runIds.has(nextRunId)) {
		throw new Error("Implementation Run identity cannot be reused.");
	}
}

function assertImplementationSession(
	session: RunSessionBinding,
	continuityKey: string,
	previous: RunReceipt | undefined,
	modelRouteDigest: string,
): void {
	if (session.continuityKey !== continuityKey) {
		throw new Error("Implementation Run requires exact Work Unit continuity.");
	}
	if (
		previous &&
		previous.modelRouteDigest !== modelRouteDigest &&
		previous.sessionId === session.sessionId
	) {
		throw new Error("Implementation model route change requires a fresh Session.");
	}
	if (!previous || previous.sessionId !== session.sessionId) {
		if (session.mode !== "create" || session.expectedHead !== "absent") {
			throw new Error("New or rolled Implementation Session must start absent.");
		}
		return;
	}
	if (
		session.mode !== "resume" ||
		previous.resultingSessionHead === null ||
		session.expectedHead !== previous.resultingSessionHead ||
		!previous.rawLog ||
		canonicalJson(session.resumeLog) !== canonicalJson(previous.rawLog)
	) {
		throw new Error("Implementation retry requires exact prior Session head and resume log.");
	}
}

function requiredText(value: string, label: string): string {
	const normalized = value.trim();
	if (!normalized) throw new Error(`${label} must be non-empty text.`);
	return normalized;
}
