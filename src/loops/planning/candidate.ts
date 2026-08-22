import type {ChangeRevision, KnowledgeTargetRef} from "../../changes/trace/contracts.ts";
import {operationPayload} from "../../changes/trace/identity.ts";
import {
	changeById,
	type ChangeWorkState,
	type ProjectWorkState,
} from "../../changes/trace/state.ts";
import {createLoopCandidate, type LoopCandidate} from "../../checks/identity.ts";
import {knowledgeEffectId} from "../../knowledge/materialization.ts";
import {knowledgeTargetKey} from "../../knowledge/state.ts";
import {
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {
	comparePlanningEdges,
	comparePlanningText as compareText,
	parsePlanningCandidateProposal,
	type PlanningCandidateProposal,
	type PlanningObligationCoverage,
	type PlanningUnchangedKnowledgeCoverage,
	type PlanningWorkUnitCandidate,
} from "./candidate-content.ts";
import {
	applyAcceptedPlanningDelta,
	type PlanningGraphDelta,
} from "./work-graph.ts";

export const PLANNING_CANDIDATE_SCHEMA_VERSION = "2.0.0" as const;

export type PlanningCandidateContent = CanonicalJsonValue & {
	readonly changeId: string;
	readonly changeRevisionId: Sha256Digest;
	readonly observedKnowledgeStateDigest: Sha256Digest;
	readonly observedWorkGraphDigest: Sha256Digest;
	readonly delta: PlanningGraphDelta;
};

export type PlanningCandidate = LoopCandidate<"planning", PlanningCandidateContent>;

export interface CreatePlanningCandidateInput {
	readonly state: ProjectWorkState;
	readonly changeId: string;
	readonly proposal: PlanningCandidateProposal;
}

export function createPlanningCandidate(input: CreatePlanningCandidateInput): PlanningCandidate {
	const change = acceptedPlanningChange(input.state, input.changeId);
	const revision = change.currentRevision as ChangeRevision;
	const proposal = normalizeProposal(parsePlanningCandidateProposal(input.proposal));
	const delta = createPlanningDelta(change.changeId, revision, proposal);
	assertPlanningCoverage(delta, revision);
	applyAcceptedPlanningDelta({
		graph: input.state.workGraph,
		delta,
		candidateId: "candidate:planning:preview",
		candidateDigest: canonicalJsonDigest(delta),
		acceptanceOperationId: canonicalJsonDigest({kind: "planning.delta_accepted", deltaId: delta.deltaId}),
		changes: input.state.changes,
	});
	const knowledgeStateDigest = input.state.knowledgeHead?.stateDigest;
	if (!knowledgeStateDigest) {
		throw new Error("Planning Candidate requires accepted Knowledge State.");
	}
	return createLoopCandidate<"planning", PlanningCandidateContent>({
		loop: "planning",
		schemaVersion: PLANNING_CANDIDATE_SCHEMA_VERSION,
		content: toCanonicalJsonValue({
			changeId: change.changeId,
			changeRevisionId: revision.revisionId,
			observedKnowledgeStateDigest: knowledgeStateDigest,
			observedWorkGraphDigest: input.state.workGraph.graphDigest,
			delta,
		}) as PlanningCandidateContent,
		observedBase: {
			workStateDigest: input.state.workStateDigest,
			knowledgeSnapshotDigest: knowledgeStateDigest,
			canonicalRefs: [
				`change:${change.changeId}`,
				revision.revisionId,
				input.state.workGraph.graphDigest,
			],
		},
	});
}

export function assertPlanningCandidate(
	candidate: PlanningCandidate,
	state: ProjectWorkState,
): void {
	const rebuilt = createPlanningCandidate({
		state,
		changeId: candidate.content.changeId,
		proposal: proposalFromDelta(candidate.content.delta),
	});
	if (rebuilt.id !== candidate.id || rebuilt.digest !== candidate.digest) {
		throw new Error("Planning Candidate identity or accepted-base binding is invalid.");
	}
}

function assertPlanningCoverage(
	delta: PlanningGraphDelta,
	revision: ChangeRevision,
): void {
	const unitIds = new Set(delta.workUnits.map((unit) => unit.id));
	if (unitIds.size !== delta.workUnits.length) {
		throw new Error("Planning Work Unit identities must be unique.");
	}
	for (const unit of delta.workUnits) {
		if (unit.owningChangeId !== delta.owningChangeId) {
			throw new Error("Every Planning Work Unit must belong to its Change.");
		}
	}
	assertCoverageIds(
		delta.knowledgeEffectCoverage,
		revision.content.knowledge.kind === "effects"
			? revision.content.knowledge.effects.map(knowledgeEffectId)
			: [],
		unitIds,
		"Knowledge Effect",
	);
	assertUnchangedCoverage(
		delta.unchangedKnowledgeCoverage,
		revision.content.knowledge.kind === "unchanged"
			? revision.content.knowledge.refs
			: [],
		unitIds,
	);
	assertCoverageIds(
		delta.acceptanceCoverage,
		revision.content.acceptanceRequirements.map((entry) => entry.id),
		unitIds,
		"acceptance requirement",
	);
	assertUnitCoverageConsistency(delta);
	const reviewIds = new Set<string>();
	for (const requirement of delta.aggregateReviewRequirements) {
		if (reviewIds.has(requirement.id)) {
			throw new Error(`Aggregate Review requirement ${requirement.id} is duplicated.`);
		}
		reviewIds.add(requirement.id);
		if (!requirement.workUnitIds.every((id) => unitIds.has(id))) {
			throw new Error(`Aggregate Review requirement ${requirement.id} references unknown Work Unit.`);
		}
	}
}

function acceptedPlanningChange(state: ProjectWorkState, changeId: string): ChangeWorkState {
	const change = changeById(state, changeId);
	if (!change?.currentRevision || change.withdrawn || change.trace.status !== "open") {
		throw new Error(`Planning Candidate requires current accepted Change ${changeId}.`);
	}
	let accepted = false;
	for (let index = change.loopAttempts.length - 1; index >= 0; index -= 1) {
		const attempt = change.loopAttempts[index];
		accepted = Boolean(
			attempt && approvedPlanningAttempt(change, attempt, change.currentRevision.revisionId),
		);
		if (accepted) break;
	}
	if (!accepted) throw new Error(`Planning Candidate Change ${changeId} is not approved.`);
	return change;
}

function approvedPlanningAttempt(
	change: ChangeWorkState,
	attempt: ChangeWorkState["loopAttempts"][number],
	revisionId: string,
): boolean {
	if (
		attempt.loop !== "decision" ||
		attempt.changeRevisionId !== revisionId ||
		!attempt.confirmationOperationId ||
		!attempt.routeOperationId
	) return false;
	const confirmation = change.operations.find(
		(operation) => operation.operationId === attempt.confirmationOperationId,
	);
	const route = change.operations.find(
		(operation) => operation.operationId === attempt.routeOperationId,
	);
	return confirmation?.body.kind === "decision.confirmed" &&
		operationPayload(confirmation, "decision.confirmed").disposition === "approve" &&
		route?.body.kind === "runtime.route_recorded" &&
		operationPayload(route, "runtime.route_recorded").route === "planning";
}

function createPlanningDelta(
	changeId: string,
	revision: ChangeRevision,
	proposal: PlanningCandidateProposal,
): PlanningGraphDelta {
	const body = {
		schemaVersion: "1.0.0" as const,
		owningChangeId: changeId,
		changeRevisionId: revision.revisionId,
		...proposal,
	};
	const deltaId = canonicalJsonDigest({protocol: "codewiki.planning-delta/1.0.0", body});
	// SAFETY: body was parsed by Planning proposal schema and augmented with derived bindings.
	return toCanonicalJsonValue({...body, deltaId}) as PlanningGraphDelta;
}

function proposalFromDelta(delta: PlanningGraphDelta): PlanningCandidateProposal {
	return {
		workUnits: [...delta.workUnits],
		dependencyEdges: [...delta.dependencyEdges],
		knowledgeEffectCoverage: [...delta.knowledgeEffectCoverage],
		unchangedKnowledgeCoverage: [...delta.unchangedKnowledgeCoverage],
		acceptanceCoverage: [...delta.acceptanceCoverage],
		aggregateReviewRequirements: [...delta.aggregateReviewRequirements],
		uiPreviewTargets: [...delta.uiPreviewTargets],
		integrationRequirements: [...delta.integrationRequirements],
		amendment: delta.amendment,
		rationale: delta.rationale,
	};
}

function normalizeProposal(proposal: PlanningCandidateProposal): PlanningCandidateProposal {
	// SAFETY: normalization preserves schema fields while canonicalizing collection order.
	return toCanonicalJsonValue({
		...proposal,
		workUnits: [...proposal.workUnits].map(normalizeWorkUnit).sort((a, b) => compareText(a.id, b.id)),
		dependencyEdges: [...proposal.dependencyEdges].sort(comparePlanningEdges),
		knowledgeEffectCoverage: normalizeCoverage(proposal.knowledgeEffectCoverage),
		unchangedKnowledgeCoverage: [...proposal.unchangedKnowledgeCoverage]
			.map((entry) => ({...entry, workUnitIds: sorted(entry.workUnitIds)}))
			.sort((a, b) => compareText(knowledgeTargetKey(a.target), knowledgeTargetKey(b.target))),
		acceptanceCoverage: normalizeCoverage(proposal.acceptanceCoverage),
		aggregateReviewRequirements: [...proposal.aggregateReviewRequirements]
			.map((entry) => ({...entry, workUnitIds: sorted(entry.workUnitIds)}))
			.sort((a, b) => compareText(a.id, b.id)),
		uiPreviewTargets: [...proposal.uiPreviewTargets]
			.map((entry) => ({...entry, workUnitIds: sorted(entry.workUnitIds), changeIds: sorted(entry.changeIds)}))
			.sort((a, b) => compareText(a.targetId, b.targetId)),
		integrationRequirements: sorted(proposal.integrationRequirements),
		amendment: proposal.amendment
			? {...proposal.amendment, retireWorkUnitIds: sorted(proposal.amendment.retireWorkUnitIds)}
			: null,
	}) as unknown as PlanningCandidateProposal;
}

function normalizeWorkUnit(unit: PlanningWorkUnitCandidate): PlanningWorkUnitCandidate {
	return {
		...unit,
		technicalRequirements: sorted(unit.technicalRequirements),
		knowledgeEffectIds: sorted(unit.knowledgeEffectIds),
		unchangedKnowledgeTargets: [...unit.unchangedKnowledgeTargets].sort((a, b) =>
			compareText(knowledgeTargetKey(a), knowledgeTargetKey(b)),
		),
		acceptanceRequirementIds: sorted(unit.acceptanceRequirementIds),
		componentRefs: sorted(unit.componentRefs),
		pathScopes: sorted(unit.pathScopes),
		verification: sorted(unit.verification),
		resourceRequirements: {
			...unit.resourceRequirements,
			capabilityIds: sorted(unit.resourceRequirements.capabilityIds),
			toolIds: sorted(unit.resourceRequirements.toolIds),
			skillIds: sorted(unit.resourceRequirements.skillIds),
			custodyRequirements: sorted(unit.resourceRequirements.custodyRequirements),
			consentRequirements: sorted(unit.resourceRequirements.consentRequirements),
		},
	};
}

function assertCoverageIds(
	coverage: readonly PlanningObligationCoverage[],
	expectedIds: readonly string[],
	unitIds: ReadonlySet<string>,
	label: string,
): void {
	const actualIds = coverage.map((entry) => entry.obligationId);
	if (!sameSet(actualIds, expectedIds)) {
		throw new Error(`Planning ${label} coverage must exactly cover accepted obligations.`);
	}
	if (new Set(actualIds).size !== actualIds.length) {
		throw new Error(`Planning ${label} coverage contains duplicate obligations.`);
	}
	for (const entry of coverage) {
		if (!entry.workUnitIds.every((id) => unitIds.has(id))) {
			throw new Error(`Planning ${label} ${entry.obligationId} references unknown Work Unit.`);
		}
	}
}

function assertUnchangedCoverage(
	coverage: readonly PlanningUnchangedKnowledgeCoverage[],
	expected: readonly KnowledgeTargetRef[],
	unitIds: ReadonlySet<string>,
): void {
	const actualKeys = coverage.map((entry) => knowledgeTargetKey(entry.target));
	const expectedKeys = expected.map(knowledgeTargetKey);
	if (!sameSet(actualKeys, expectedKeys) || new Set(actualKeys).size !== actualKeys.length) {
		throw new Error("Planning unchanged-Knowledge coverage must exactly cover accepted references.");
	}
	for (const entry of coverage) {
		if (!entry.workUnitIds.every((id) => unitIds.has(id))) {
			throw new Error("Planning unchanged-Knowledge coverage references unknown Work Unit.");
		}
	}
}

function assertUnitCoverageConsistency(delta: PlanningGraphDelta): void {
	const effectByUnit = reverseCoverage(
		delta.knowledgeEffectCoverage,
		(entry) => entry.obligationId,
	);
	const acceptanceByUnit = reverseCoverage(
		delta.acceptanceCoverage,
		(entry) => entry.obligationId,
	);
	const unchangedByUnit = reverseCoverage(
		delta.unchangedKnowledgeCoverage,
		(entry) => knowledgeTargetKey(entry.target),
	);
	for (const unit of delta.workUnits) {
		if (!sameSet(unit.knowledgeEffectIds, effectByUnit.get(unit.id) ?? [])) {
			throw new Error(`Work Unit ${unit.id} Knowledge Effect coverage is inconsistent.`);
		}
		if (!sameSet(unit.acceptanceRequirementIds, acceptanceByUnit.get(unit.id) ?? [])) {
			throw new Error(`Work Unit ${unit.id} acceptance coverage is inconsistent.`);
		}
		if (!sameSet(
			unit.unchangedKnowledgeTargets.map(knowledgeTargetKey),
			unchangedByUnit.get(unit.id) ?? [],
		)) {
			throw new Error(`Work Unit ${unit.id} unchanged-Knowledge coverage is inconsistent.`);
		}
	}
}

function reverseCoverage<T extends {readonly workUnitIds: readonly string[]}>(
	coverage: readonly T[],
	obligationId: (entry: T) => string,
): Map<string, string[]> {
	const result = new Map<string, string[]>();
	for (const entry of coverage) {
		for (const workUnitId of entry.workUnitIds) {
			result.set(workUnitId, [...(result.get(workUnitId) ?? []), obligationId(entry)]);
		}
	}
	return result;
}

function normalizeCoverage(
	coverage: readonly PlanningObligationCoverage[],
): PlanningObligationCoverage[] {
	return [...coverage]
		.map((entry) => ({...entry, workUnitIds: sorted(entry.workUnitIds)}))
		.sort((a, b) => compareText(a.obligationId, b.obligationId));
}

function sorted(values: readonly string[]): string[] {
	return [...values].sort(compareText);
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length &&
		left.every((value) => right.includes(value));
}

