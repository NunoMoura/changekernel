import type {
	AuthorityBinding,
	BaseSnapshot,
	CanonicalChangeOperation,
	CanonicalInlineSemanticArtifact,
	ChangeOperationKind,
	OperationId,
} from "../../changes/trace/contracts.ts";
import {createNextChangeOperation} from "../../changes/trace/builder.ts";
import {
	createGitCommandRunner,
	type GitCommandRunner,
} from "../../changes/trace/git-command.ts";
import type {ReplayAdmissionPolicy} from "../../changes/trace/reducer.ts";
import {
	createCurrentGitSynchronizer,
	pushSynchronizedStateBatch,
	type ProjectAuthoritySnapshot,
	type SynchronizationObservation,
} from "../../changes/trace/synchronization.ts";
import {reduceChangeOperation} from "../../changes/trace/reduce-operation.ts";
import {changeById, type ChangeWorkState, type ProjectWorkState} from "../../changes/trace/state.ts";
import type {EvidenceRecord} from "../../evidence/contracts.ts";
import {assertValidEvidenceRecord} from "../../evidence/materialize.ts";
import {qualifiedCheckId, type GateReport} from "../../checks/contracts.ts";
import type {CheckPackSnapshot} from "../../checks/packs/contracts.ts";
import {assertCheckPackSnapshot} from "../../checks/packs/contracts.ts";
import {assertValidGateReport} from "../../checks/results.ts";
import {
	assertPlanningCandidate,
	type PlanningCandidate,
} from "../../loops/planning/candidate.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {
	derivePlanningLifecycleTransition,
	type PlanningLifecycleTransition,
} from "../lifecycle/gates.ts";
import {
	idFromDigest,
	inlineSemanticArtifact,
	operationReportStatus,
	operationResultStatus,
	operationTimestamp,
	requiredResultBinding,
	sortedEvidence,
	sortedResults,
} from "./gate-operations.ts";

export interface CreatePlanningOperationsInput {
	readonly state: ProjectWorkState;
	readonly changeId: string;
	readonly attemptOperationId: OperationId;
	readonly baseSnapshot: BaseSnapshot;
	readonly authorityBinding: AuthorityBinding;
	readonly acceptanceAuthorityBinding: AuthorityBinding;
	readonly recordedAt: string;
	readonly candidate: PlanningCandidate;
	readonly packSnapshot: CheckPackSnapshot;
	readonly evidenceRecords: readonly EvidenceRecord[];
	readonly report: GateReport;
	readonly transition: PlanningLifecycleTransition;
}

export interface PlanningOperationSequence {
	readonly operations: readonly CanonicalChangeOperation[];
	readonly state: ChangeWorkState;
	readonly attemptOperationId: Sha256Digest;
	readonly candidateId: string;
	readonly packSnapshotId: string;
	readonly gateReportId: string;
	readonly acceptanceOperationId: Sha256Digest | null;
	readonly transitionOperationId: Sha256Digest;
}

export function createPlanningOperationSequence(
	input: CreatePlanningOperationsInput,
): PlanningOperationSequence {
	const {change, attempt} = assertPlanningInput(input);
	const candidateBinding = inlineSemanticArtifact(
		input.candidate.id,
		input.candidate.schemaVersion,
		input.candidate,
	);
	const packSnapshotBinding = inlineSemanticArtifact(
		idFromDigest("check-pack-snapshot:planning", input.packSnapshot.checkPackDigest),
		String(input.packSnapshot.schemaVersion),
		input.packSnapshot,
	);
	const resultBindings = new Map<string, CanonicalInlineSemanticArtifact>(
		input.report.results.map((result) => {
			const id = qualifiedCheckId(result.packId, result.checkId);
			return [
				id,
				inlineSemanticArtifact(
					idFromDigest(`check-result:planning:${id}`, result.resultDigest),
					String(result.schemaVersion),
					result,
				),
			];
		}),
	);
	const reportBinding = inlineSemanticArtifact(
		idFromDigest("gate-report:planning", input.report.reportDigest),
		String(input.report.schemaVersion),
		input.report,
	);
	const transitionBinding = inlineSemanticArtifact(
		idFromDigest("runtime-transition:planning", input.transition.transitionDigest),
		input.transition.schemaVersion,
		input.transition,
	);
	let projected = change;
	const operations: CanonicalChangeOperation[] = [];
	const append = <K extends ChangeOperationKind>(
		kind: K,
		payload: Parameters<typeof createNextChangeOperation<K>>[1]["payload"],
		authorityBinding: AuthorityBinding = input.authorityBinding,
	): CanonicalChangeOperation<K> => {
		const operation = createNextChangeOperation(projected, {
			changeId: projected.changeId,
			kind,
			baseSnapshot: input.baseSnapshot,
			authorityBinding,
			recordedAt: operationTimestamp(input.recordedAt, operations.length),
			payload,
		});
		projected = reduceChangeOperation(projected, operation, {});
		operations.push(operation);
		return operation;
	};
	append("planning.candidate_recorded", {
		attemptOperationId: attempt.operationId,
		candidate: candidateBinding,
		observedBaseDigest: canonicalJsonDigest(input.candidate.observedBase),
	});
	append("loop.exit_policy_recorded", {
		attemptOperationId: attempt.operationId,
		candidateId: candidateBinding.id,
		policy: packSnapshotBinding,
	});
	for (const evidence of sortedEvidence(input.evidenceRecords)) {
		append("evidence.recorded", {
			attemptOperationId: attempt.operationId,
			candidateId: candidateBinding.id,
			evidence: inlineSemanticArtifact(evidence.evidenceId, evidence.schemaVersion, evidence),
			evidenceKind: evidence.kind,
			authority: evidence.authority,
			coverage: evidence.coverage,
		});
	}
	for (const result of sortedResults(input.report.results)) {
		const id = qualifiedCheckId(result.packId, result.checkId);
		const binding = requiredResultBinding(resultBindings, id);
		append("check.result_recorded", {
			attemptOperationId: attempt.operationId,
			candidateId: candidateBinding.id,
			result: binding,
			checkId: id,
			checkVersion: result.checkVersion,
			status: operationResultStatus(result.status),
			evidenceRecordIds: [...result.evidenceRecordIds],
			evidenceInputDigest: result.inputDigest,
		});
	}
	append("loop.exit_report_recorded", {
		attemptOperationId: attempt.operationId,
		candidateId: candidateBinding.id,
		report: reportBinding,
		status: operationReportStatus(input.report.status),
		resultIds: sortedResults(input.report.results).map((result) =>
			requiredResultBinding(
				resultBindings,
				qualifiedCheckId(result.packId, result.checkId),
			).id,
		),
	});
	let acceptanceOperation: CanonicalChangeOperation<"planning.delta_accepted"> | null = null;
	if (input.report.status === "passed") {
		acceptanceOperation = append(
			"planning.delta_accepted",
			{
				attemptOperationId: attempt.operationId,
				candidateId: input.candidate.id,
				candidateDigest: input.candidate.digest,
				gateReportId: reportBinding.id,
				gateReportDigest: input.report.reportDigest,
				expectedWorkStateDigest: input.state.workStateDigest,
				expectedKnowledgeStateDigest: input.candidate.content.observedKnowledgeStateDigest,
				expectedWorkGraphDigest: input.candidate.content.observedWorkGraphDigest,
				deltaId: input.candidate.content.delta.deltaId,
			},
			input.acceptanceAuthorityBinding,
		);
	}
	const transitionOperation = append("runtime.route_recorded", {
		attemptOperationId: attempt.operationId,
		exitReportId: reportBinding.id,
		route: planningRoute(input.transition),
		reasonCode: input.transition.reasonCode,
		runtimeRoute: transitionBinding,
		targetChangeId: input.changeId,
	});
	append("loop.attempt_ended", {
		attemptOperationId: attempt.operationId,
		status: operationReportStatus(input.report.status),
		exitReportId: reportBinding.id,
		routeOperationId: transitionOperation.operationId,
	});
	// SAFETY: sequence fields are canonical JSON and all operations were reduced successfully.
	return toCanonicalJsonValue({
		operations,
		state: projected,
		attemptOperationId: attempt.operationId,
		candidateId: candidateBinding.id,
		packSnapshotId: packSnapshotBinding.id,
		gateReportId: reportBinding.id,
		acceptanceOperationId: acceptanceOperation?.operationId ?? null,
		transitionOperationId: transitionOperation.operationId,
	}) as unknown as PlanningOperationSequence;
}

function assertPlanningInput(input: CreatePlanningOperationsInput): {
	readonly change: ChangeWorkState;
	readonly attempt: ChangeWorkState["loopAttempts"][number];
} {
	const change = changeById(input.state, input.changeId);
	if (!change) throw new Error(`Planning Change ${input.changeId} is absent.`);
	const attempt = change.loopAttempts.find(
		(candidate) => candidate.operationId === input.attemptOperationId,
	);
	if (!attempt || attempt.loop !== "planning" || attempt.status !== "active") {
		throw new Error("Planning operation sequence requires active Planning attempt.");
	}
	assertPlanningCandidate(input.candidate, input.state);
	if (input.candidate.content.changeId !== input.changeId) {
		throw new Error("Planning Candidate belongs to different Change.");
	}
	assertCheckPackSnapshot(input.packSnapshot);
	if (input.packSnapshot.stage !== "planning") {
		throw new Error("Planning operation sequence requires Planning Check Pack.");
	}
	assertValidGateReport(input.report, input.packSnapshot);
	if (
		input.report.stage !== "planning" ||
		input.report.subjectDigest !== input.candidate.digest ||
		input.report.packSnapshotDigest !== input.packSnapshot.checkPackDigest
	) {
		throw new Error("Planning Gate Report does not bind exact Candidate and Check Pack.");
	}
	const expectedTransition = derivePlanningLifecycleTransition(input.candidate, input.report);
	if (canonicalJson(expectedTransition) !== canonicalJson(input.transition)) {
		throw new Error("Planning lifecycle transition is not derived from exact Gate Report.");
	}
	for (const evidence of input.evidenceRecords) assertValidEvidenceRecord(evidence);
	return {change, attempt};
}

export interface CommitPlanningOperationSequenceInput
	extends Omit<
		CreatePlanningOperationsInput,
		"state" | "baseSnapshot"
	> {
	readonly repoRoot: string;
	readonly remote: string;
	readonly repositoryIdentity: Sha256Digest;
	readonly currentProject: () => ProjectAuthoritySnapshot | Promise<ProjectAuthoritySnapshot>;
	readonly replayPolicy: ReplayAdmissionPolicy;
	readonly expectedTeamSnapshotDigest: Sha256Digest;
	readonly expectedWorkStateDigest: Sha256Digest;
	readonly expectedKnowledgeStateDigest: Sha256Digest;
	readonly expectedWorkGraphDigest: Sha256Digest;
	readonly runner?: GitCommandRunner;
	readonly materializationRoot?: string;
	readonly signal?: AbortSignal;
}

export interface PlanningCommitReceipt {
	readonly candidateId: string;
	readonly attemptOperationId: Sha256Digest;
	readonly gateReportId: string;
	readonly acceptanceOperationId: Sha256Digest | null;
	readonly transitionOperationId: Sha256Digest;
	readonly stateHead: string;
	readonly sequence: PlanningOperationSequence;
	readonly observation: SynchronizationObservation;
}

export async function commitPlanningOperationSequence(
	input: CommitPlanningOperationSequenceInput,
): Promise<PlanningCommitReceipt> {
	const runner = input.runner ?? createGitCommandRunner();
	const synchronizeCurrent = createCurrentGitSynchronizer({
		repoRoot: input.repoRoot,
		remote: input.remote,
		repositoryIdentity: input.repositoryIdentity,
		currentProject: input.currentProject,
		policy: input.replayPolicy,
		runner,
		materializationRoot: input.materializationRoot,
		signal: input.signal,
	});
	const {observation} = await synchronizeCurrent();
	if (observation.status !== "fresh" || !observation.workState || !observation.teamSnapshot) {
		throw new Error(
			`Planning commit requires fresh synchronization; current status is ${observation.status}.`,
		);
	}
	if (observation.teamSnapshot.snapshotDigest !== input.expectedTeamSnapshotDigest) {
		throw new Error("Planning team snapshot is stale and Checks must be rerun.");
	}
	if (observation.workState.workStateDigest !== input.expectedWorkStateDigest) {
		throw new Error("Planning WorkState is stale and Checks must be rerun.");
	}
	if (observation.workState.knowledgeHead?.stateDigest !== input.expectedKnowledgeStateDigest) {
		throw new Error("Planning Knowledge State is stale and Checks must be rerun.");
	}
	if (observation.workState.workGraph.graphDigest !== input.expectedWorkGraphDigest) {
		throw new Error("Planning Work Graph is stale and Checks must be rerun.");
	}
	assertPlanningCandidate(input.candidate, observation.workState);
	const sequence = createPlanningOperationSequence({
		state: observation.workState,
		changeId: input.changeId,
		attemptOperationId: input.attemptOperationId,
		baseSnapshot: {
			remoteStateHead: observation.teamSnapshot.remoteStateHead,
			sourceHead: observation.teamSnapshot.protectedSourceHead,
			knowledgeDigest: observation.teamSnapshot.knowledgeDigest,
			configDigest: observation.teamSnapshot.configDigest,
			policyDigest: observation.teamSnapshot.policyDigest,
		},
		authorityBinding: input.authorityBinding,
		acceptanceAuthorityBinding: input.acceptanceAuthorityBinding,
		recordedAt: input.recordedAt,
		candidate: input.candidate,
		packSnapshot: input.packSnapshot,
		evidenceRecords: input.evidenceRecords,
		report: input.report,
		transition: input.transition,
	});
	const {pushResult} = await pushSynchronizedStateBatch({
		repoRoot: input.repoRoot,
		remote: input.remote,
		state: observation.workState,
		records: sequence.operations,
		policy: input.replayPolicy,
		observation,
		runner,
		signal: input.signal,
	});
	if (pushResult.status === "stale") {
		throw new Error("Planning push became stale; Project Server must refetch and rerun Planning.");
	}
	const {observation: verified} = await synchronizeCurrent();
	const acceptedIds = new Set(verified.workState?.acceptedOperationIds ?? []);
	if (
		verified.status !== "fresh" ||
		!verified.workState?.stateHead ||
		!sequence.operations.every((operation) => acceptedIds.has(operation.operationId))
	) {
		throw new Error(`Accepted Planning Candidate ${sequence.candidateId} could not be verified.`);
	}
	return Object.freeze({
		candidateId: sequence.candidateId,
		attemptOperationId: sequence.attemptOperationId,
		gateReportId: sequence.gateReportId,
		acceptanceOperationId: sequence.acceptanceOperationId,
		transitionOperationId: sequence.transitionOperationId,
		stateHead: verified.workState.stateHead,
		sequence,
		observation: verified,
	});
}

function planningRoute(
	transition: PlanningLifecycleTransition,
): "implementation" | "planning" | "waiting" {
	if (transition.target === "implementation") return "implementation";
	if (transition.target === "planning") return "planning";
	return "waiting";
}
