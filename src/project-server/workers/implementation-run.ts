import type {
	RunBudget,
	RunInputBindings,
	RunReceipt,
	RunRequest,
	RuntimeBuildBinding,
} from "../../runtime/contracts.ts";
import {createRunRequest} from "../../runtime/contracts.ts";
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
	canonicalJsonDigest,
	toCanonicalJsonValue,
} from "../../utils/canonical-json.ts";

export interface CreateImplementationRunRequestInput {
	readonly assignment: ScheduledAssignment;
	readonly workbench: WorkbenchBinding;
	readonly workUnit: PlanningWorkUnitCandidate;
	readonly runtimeBuild: RuntimeBuildBinding;
	readonly inputs: RunInputBindings;
	readonly budget: RunBudget;
	readonly priorReceipts: readonly RunReceipt[];
	readonly runId: string;
	readonly createdAt: string;
	readonly deadlineAt: string;
}

export function createImplementationRunRequest(
	input: CreateImplementationRunRequestInput,
): RunRequest {
	assertImplementationRunBinding(input.assignment, input.workbench, input.workUnit);
	const sessionId = implementationContinuityKey(input.workUnit.id);
	assertPriorReceipts(input.priorReceipts, sessionId, input.runId);
	const previous = input.priorReceipts.at(-1);
	if (previous?.outputDigest) {
		throw new Error("Producing Implementation Run already exists for this Assignment.");
	}
	const session = previous
		? {
				mode: "resume" as const,
				sessionId,
				resumeLog: requiredResumeLog(previous),
			}
		: {mode: "create" as const, sessionId, resumeLog: null};
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
		session,
		inputs: input.inputs,
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

function assertImplementationRunBinding(
	assignment: ScheduledAssignment,
	workbench: WorkbenchBinding,
	workUnit: PlanningWorkUnitCandidate,
): void {
	if (
		assignment.workUnitId !== workUnit.id ||
		assignment.owningChangeId !== workUnit.owningChangeId ||
		assignment.assignmentAttemptId !== workbench.assignmentAttemptId ||
		assignment.workUnitId !== workbench.workUnitId ||
		assignment.workerId !== workbench.workerId ||
		assignment.workbenchDigest !== workbench.workbenchDigest ||
		assignment.sourceBase !== workbench.sourceBase
	) {
		throw new Error("Implementation Run requires exact Assignment, Workbench, and Work Unit.");
	}
}

function assertPriorReceipts(
	receipts: readonly RunReceipt[],
	sessionId: string,
	nextRunId: string,
): void {
	if (receipts.length >= MAXIMUM_IMPLEMENTATION_ATTEMPTS) {
		throw new Error("Implementation attempt limit is exhausted.");
	}
	const runIds = new Set<string>();
	for (const receipt of receipts) {
		if (
			receipt.sessionId !== sessionId ||
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

function requiredResumeLog(receipt: RunReceipt) {
	if (!receipt.rawLog || receipt.rawLog.sessionId !== receipt.sessionId) {
		throw new Error("Implementation retry requires exact prior Session resume log.");
	}
	return receipt.rawLog;
}

function requiredText(value: string, label: string): string {
	const normalized = value.trim();
	if (!normalized) throw new Error(`${label} must be non-empty text.`);
	return normalized;
}
