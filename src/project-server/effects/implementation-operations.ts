import type {
	AuthorityBinding,
	BaseSnapshot,
	CanonicalChangeOperation,
	CanonicalInlineSemanticArtifact,
	ChangeOperationKind,
} from "../../changes/trace/contracts.ts";
import {createNextChangeOperation} from "../../changes/trace/builder.ts";
import {reduceChangeOperation} from "../../changes/trace/reduce-operation.ts";
import {
	changeById,
	type ChangeWorkState,
	type ProjectWorkState,
} from "../../changes/trace/state.ts";
import {qualifiedCheckId} from "../../checks/contracts.ts";
import {assertValidGateReport} from "../../checks/results.ts";
import type {EvidenceRecord} from "../../evidence/contracts.ts";
import {assertValidEvidenceRecord} from "../../evidence/materialize.ts";
import {
	assertImplementationStagePolicy,
	type ImplementationStagePolicy,
} from "../../loops/implementation/policy.ts";
import {
	assertWorkUnitCandidate,
	type WorkUnitCandidate,
} from "../../loops/implementation/work-unit-candidate.ts";
import {
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
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

export interface CreateImplementationOperationsInput {
	readonly state: ProjectWorkState;
	readonly candidate: WorkUnitCandidate;
	readonly policy: ImplementationStagePolicy;
	readonly evidenceRecords: readonly EvidenceRecord[];
	readonly report: Parameters<typeof assertValidGateReport>[0];
	readonly baseSnapshot: BaseSnapshot;
	readonly authorityBinding: AuthorityBinding;
	readonly recordedAt: string;
}

export interface ImplementationOperationSequence {
	readonly operations: readonly CanonicalChangeOperation[];
	readonly state: ChangeWorkState;
	readonly attemptOperationId: Sha256Digest;
	readonly candidateId: string;
	readonly policyId: string;
	readonly gateReportId: string;
}

export function createImplementationOperationSequence(
	input: CreateImplementationOperationsInput,
): ImplementationOperationSequence {
	assertImplementationInput(input);
	const change = changeById(input.state, input.candidate.content.owningChangeId);
	if (!change) {
		throw new Error("Implementation operation sequence requires owning Change.");
	}
	const candidateBinding = inlineSemanticArtifact(
		input.candidate.id,
		input.candidate.schemaVersion,
		input.candidate,
	);
	const policyBinding = inlineSemanticArtifact(
		idFromDigest("implementation-stage-policy", input.policy.policyDigest),
		input.policy.schemaVersion,
		input.policy,
	);
	const resultBindings = new Map<string, CanonicalInlineSemanticArtifact>(
		input.report.results.map((result) => {
			const id = qualifiedCheckId(result.packId, result.checkId);
			return [
				id,
				inlineSemanticArtifact(
					idFromDigest(`check-result:implementation:${id}`, result.resultDigest),
					String(result.schemaVersion),
					result,
				),
			];
		}),
	);
	const reportBinding = inlineSemanticArtifact(
		idFromDigest("gate-report:implementation", input.report.reportDigest),
		String(input.report.schemaVersion),
		input.report,
	);
	let projected = change;
	const operations: CanonicalChangeOperation[] = [];
	const append = <K extends ChangeOperationKind>(
		kind: K,
		payload: Parameters<typeof createNextChangeOperation<K>>[1]["payload"],
	): CanonicalChangeOperation<K> => {
		const operation = createNextChangeOperation(projected, {
			changeId: projected.changeId,
			kind,
			baseSnapshot: input.baseSnapshot,
			authorityBinding: input.authorityBinding,
			recordedAt: operationTimestamp(input.recordedAt, operations.length),
			payload,
		});
		projected = reduceChangeOperation(projected, operation, {});
		operations.push(operation);
		return operation;
	};
	const attempt = append("loop.attempt_started", {
		loop: "implementation",
		changeRevisionId: input.candidate.content.changeRevisionId,
		loopProtocolDigest: canonicalJsonDigest({
			candidate: input.candidate.schemaVersion,
			policy: input.policy.schemaVersion,
		}),
		routeId: input.candidate.content.continuityKey,
		privateAttemptDigest: canonicalJsonDigest({
			workUnitId: input.candidate.content.workUnitId,
			assignmentDigest: input.candidate.content.assignmentDigest,
		}),
	});
	append("implementation.candidate_recorded", {
		attemptOperationId: attempt.operationId,
		candidate: candidateBinding,
		observedBaseDigest: canonicalJsonDigest(input.candidate.observedBase),
	});
	append("loop.exit_policy_recorded", {
		attemptOperationId: attempt.operationId,
		candidateId: candidateBinding.id,
		policy: policyBinding,
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
	const routeBody = {
		schemaVersion: "1.0.0",
		candidateId: input.candidate.id,
		candidateDigest: input.candidate.digest,
		gateReportDigest: input.report.reportDigest,
		status: input.report.status === "passed" ? "integration_pending" : "gate_failed",
	} as const;
	const routeArtifact = {
		...routeBody,
		transitionDigest: canonicalJsonDigest(routeBody),
	};
	const routeBinding = inlineSemanticArtifact(
		idFromDigest("runtime-transition:implementation", routeArtifact.transitionDigest),
		routeArtifact.schemaVersion,
		routeArtifact,
	);
	const route = append("runtime.route_recorded", {
		attemptOperationId: attempt.operationId,
		exitReportId: reportBinding.id,
		route: input.report.status === "passed" ? "implementation" : "repair",
		reasonCode:
			input.report.status === "passed" ? "candidate_gate_passed" : "candidate_gate_failed",
		runtimeRoute: routeBinding,
		targetChangeId: input.candidate.content.owningChangeId,
	});
	append("loop.attempt_ended", {
		attemptOperationId: attempt.operationId,
		status: operationReportStatus(input.report.status),
		exitReportId: reportBinding.id,
		routeOperationId: route.operationId,
	});
	// SAFETY: sequence is assembled from canonical artifacts and every operation reduced successfully.
	return toCanonicalJsonValue({
		operations,
		state: projected,
		attemptOperationId: attempt.operationId,
		candidateId: candidateBinding.id,
		policyId: policyBinding.id,
		gateReportId: reportBinding.id,
	}) as unknown as ImplementationOperationSequence;
}

function assertImplementationInput(input: CreateImplementationOperationsInput): void {
	assertWorkUnitCandidate(input.candidate, input.state);
	assertImplementationStagePolicy(input.policy);
	assertValidGateReport(input.report, input.policy.packSnapshot);
	if (
		input.report.stage !== "implementation" ||
		input.report.subjectDigest !== input.candidate.digest
	) {
		throw new Error("Implementation operation sequence requires exact Candidate Gate Report.");
	}
	const evidenceIds = input.evidenceRecords.map((record) => {
		assertValidEvidenceRecord(record);
		return record.evidenceId;
	}).sort(compareText);
	const expectedIds = [...input.candidate.content.evidenceRecordIds].sort(compareText);
	if (
		evidenceIds.length !== expectedIds.length ||
		evidenceIds.some((id, index) => id !== expectedIds[index])
	) {
		throw new Error("Implementation operation sequence requires exact Candidate Evidence.");
	}
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
