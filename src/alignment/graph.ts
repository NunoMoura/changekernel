import {
	CHANGE_OPERATION_KINDS,
	type CanonicalChangeOperation,
	type CanonicalInlineSemanticArtifact,
	type ChangeOperationKind,
	type ChangeOperationPayload,
	type OperationId,
} from "../changes/trace/contracts.ts";
import type {
	ContradictionProjection,
	ProjectWorkState,
} from "../changes/trace/state.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../utils/canonical-json.ts";
import {compareText, sameText} from "../changes/trace/order.ts";
import {knowledgeEffectId} from "../knowledge/materialization.ts";
import {knowledgeTargetKey} from "../knowledge/state.ts";
import {
	candidateOperationPayload as candidatePayload,
	operationPayload as payloadOf,
} from "../changes/trace/identity.ts";

export const ALIGNMENT_GRAPH_PROJECTOR = Object.freeze({
	id: "codewiki.alignment-graph-projector",
	version: "5.0.0",
} as const);

export type AlignmentGraphProvenanceClass =
	| "canonical_binding"
	| "observed_binding"
	| "deterministic_analysis"
	| "inferred_analysis";

export interface AlignmentGraphFactProvenance {
	readonly class: AlignmentGraphProvenanceClass;
	readonly canonicalRefs: readonly string[];
	readonly observedRefs: readonly string[];
	readonly analysisRefs: readonly string[];
}

export interface AlignmentGraphNode {
	readonly id: string;
	readonly type: string;
	readonly label: string;
	readonly attributes: Readonly<Record<string, CanonicalJsonValue>>;
	readonly provenance: AlignmentGraphFactProvenance;
}

export interface AlignmentGraphEdge {
	readonly factId: Sha256Digest;
	readonly type: string;
	readonly from: string;
	readonly to: string;
	readonly attributes: Readonly<Record<string, CanonicalJsonValue>>;
	readonly provenance: AlignmentGraphFactProvenance;
}

export interface AlignmentGraphBaseBinding {
	readonly remoteStateHead: string;
	readonly sourceHead: string;
	readonly knowledgeDigest: Sha256Digest;
	readonly configDigest: Sha256Digest;
	readonly policyDigest: Sha256Digest;
	readonly workStateDigest: Sha256Digest;
}

export interface AlignmentGraphCoverage {
	readonly acceptedRecordCount: number;
	readonly projectedRecordCount: number;
	readonly knowledgeConceptCount: number;
	readonly authoredRelationshipCount: number;
	readonly sourceOwnershipCount: number;
	readonly nodeCount: number;
	readonly edgeCount: number;
	readonly truncated: false;
}

export interface AlignmentGraphSnapshot {
	readonly projector: typeof ALIGNMENT_GRAPH_PROJECTOR;
	readonly graphSnapshotDigest: Sha256Digest;
	readonly graphContentDigest: Sha256Digest;
	readonly baseBinding: AlignmentGraphBaseBinding;
	readonly status: "fresh";
	readonly projectedRecordIds: readonly OperationId[];
	readonly nodes: readonly AlignmentGraphNode[];
	readonly edges: readonly AlignmentGraphEdge[];
	readonly coverage: AlignmentGraphCoverage;
}

export function assertValidAlignmentGraphSnapshot(
	graph: AlignmentGraphSnapshot,
): void {
	assertAlignmentGraphIdentity(graph);
	assertAlignmentGraphFacts(graph);
	assertAlignmentGraphCoverage(graph);
}

function assertAlignmentGraphIdentity(graph: AlignmentGraphSnapshot): void {
	if (
		graph.projector.id !== ALIGNMENT_GRAPH_PROJECTOR.id ||
		graph.projector.version !== ALIGNMENT_GRAPH_PROJECTOR.version
	) {
		throw new Error("Alignment Graph projector is unsupported.");
	}
	const expectedSnapshotDigest = canonicalJsonDigest({
		remoteStateHead: graph.baseBinding.remoteStateHead,
		sourceHead: graph.baseBinding.sourceHead,
		knowledgeDigest: graph.baseBinding.knowledgeDigest,
		configDigest: graph.baseBinding.configDigest,
		policyDigest: graph.baseBinding.policyDigest,
		projector: ALIGNMENT_GRAPH_PROJECTOR,
	});
	if (graph.graphSnapshotDigest !== expectedSnapshotDigest) {
		throw new Error("Alignment Graph snapshot identity is invalid.");
	}
	if (
		graph.graphContentDigest !==
		canonicalJsonDigest({nodes: graph.nodes, edges: graph.edges})
	) {
		throw new Error("Alignment Graph content digest is invalid.");
	}
}

function assertAlignmentGraphFacts(graph: AlignmentGraphSnapshot): void {
	const nodeIds = new Set(graph.nodes.map((node) => node.id));
	const edgeIds = new Set(graph.edges.map((edge) => edge.factId));
	if (nodeIds.size !== graph.nodes.length || edgeIds.size !== graph.edges.length) {
		throw new Error("Alignment Graph contains duplicate fact identities.");
	}
	for (const edge of graph.edges) {
		const {factId, ...body} = edge;
		if (
			canonicalJsonDigest(body) !== factId ||
			!nodeIds.has(edge.from) ||
			!nodeIds.has(edge.to)
		) {
			throw new Error(`Alignment Graph edge ${factId} is invalid.`);
		}
	}
}

function assertAlignmentGraphCoverage(graph: AlignmentGraphSnapshot): void {
	if (
		graph.status !== "fresh" ||
		graph.coverage.nodeCount !== graph.nodes.length ||
		graph.coverage.edgeCount !== graph.edges.length ||
		graph.coverage.projectedRecordCount !== graph.projectedRecordIds.length ||
		graph.coverage.acceptedRecordCount !== graph.projectedRecordIds.length
	) {
		throw new Error("Alignment Graph coverage is invalid.");
	}
}

type GraphAccumulator = ReturnType<typeof createAccumulator>;
type OperationGraphProjector = (
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
) => void;

const OPERATION_GRAPH_PROJECTORS: Readonly<
	Record<ChangeOperationKind, OperationGraphProjector>
> = Object.freeze({
	"trace.opened": classifyOperation("change_has_trace_root"),
	"trace.closed": classifyOperation("trace_closed_by"),
	"trace.reopened": projectTraceReopened,
	"change.proposed": projectChangeRevision,
	"change.revised": projectChangeRevision,
	"change.relationship_recorded": projectChangeRelationship,
	"change.relationship_superseded": projectRelationshipSupersession,
	"change.merge_recorded": projectChangeMerge,
	"change.split_recorded": projectChangeSplit,
	"change.withdrawal_recorded": classifyOperation("change_withdrawn_by"),
	"change.feedback_recorded": projectChangeFeedback,
	"change_claim.acquired": projectChangeClaim,
	"change_claim.released": projectClaimRelease,
	"change_claim.takeover_recorded": projectChangeClaimTakeover,
	"loop.attempt_started": projectLoopAttempt,
	"loop.attempt_ended": projectAttemptEnd,
	"decision.candidate_recorded": projectCandidate,
	"decision.confirmed": projectDecisionConfirmation,
	"planning.candidate_recorded": projectCandidate,
	"planning.delta_accepted": projectPlanningDeltaAcceptance,
	"implementation.candidate_recorded": projectCandidate,
	"loop.exit_policy_recorded": projectExitPolicy,
	"evidence.recorded": projectEvidence,
	"check.result_recorded": projectCheckResult,
	"loop.exit_report_recorded": projectExitReport,
	"runtime.route_recorded": projectServerRoute,
	"work_unit_claim.acquired": projectWorkUnitClaim,
	"work_unit_claim.released": projectWorkUnitClaimRelease,
	"work_unit_claim.takeover_recorded": projectWorkUnitClaimTakeover,
	"assignment.dispatched": projectAssignment,
	"assignment.cancel_requested": projectAssignmentCancellation,
	"assignment.terminal_recorded": projectAssignmentTerminal,
	"worker.report_recorded": projectWorkerReport,
	"integration.attempt_started": projectIntegrationAttempt,
	"integration.result_recorded": projectIntegrationResult,
	"integration.candidate_admitted": projectPrivateIntegrationAdmission,
	"implementation.aggregate_frozen": projectImplementationAggregate,
	"delivery.applied": projectGuardedDelivery,
	"source.branch_merge_recorded": projectSourceMerge,
	"source.branch_push_recorded": projectSourcePush,
	"review_projection.published": projectReviewProjection,
	"product.publication_recorded": projectProductPublication,
	"product.release_recorded": projectProductRelease,
	"delivery.observation_recorded": projectDeliveryObservation,
	"outcome.observation_recorded": projectOutcomeObservation,
});

for (const kind of CHANGE_OPERATION_KINDS) {
	if (!OPERATION_GRAPH_PROJECTORS[kind]) {
		throw new Error(`Change operation ${kind} has no graph projector.`);
	}
}

export function projectAlignmentGraph(
	state: ProjectWorkState,
): AlignmentGraphSnapshot {
	return projectAlignmentGraphIncremental(null, state);
}

export function projectAlignmentGraphIncremental(
	previous: AlignmentGraphSnapshot | null,
	state: ProjectWorkState,
): AlignmentGraphSnapshot {
	assertProjectionBase(previous, state);
	const graph = createAccumulator(previous);
	const start = previous?.projectedRecordIds.length ?? 0;
	const records = recordsById(state);
	for (const operationId of state.acceptedOperationIds.slice(start)) {
		const record = records.get(operationId);
		if (!record) {
			throw new Error(`Accepted graph record ${operationId} is unavailable.`);
		}
		projectChangeOperation(graph, record);
	}
	for (const change of state.changes) {
		change.contradictions.forEach((entry) => projectContradiction(graph, entry));
	}
	return materializeGraphSnapshot(state, graph);
}

function projectChangeOperation(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const canonical = operationProvenance(operation);
	const operationNode = operationNodeId(operation.operationId);
	const changeNode = changeNodeId(operation.body.changeId);
	graph.node({
		id: changeNode,
		type: "change",
		label: operation.body.changeId,
		attributes: {},
		provenance: canonical,
	});
	graph.node({
		id: operationNode,
		type: "operation",
		label: operation.body.kind,
		attributes: {
			kind: operation.body.kind,
			kindVersion: operation.body.kindVersion,
			recordedAt: operation.body.recordedAt,
		},
		provenance: canonical,
	});
	graph.edge("change_has_operation", changeNode, operationNode, canonical);
	const actorNode = `actor:${operation.body.authorityBinding.actorId}`;
	graph.node({
		id: actorNode,
		type: "actor",
		label: operation.body.authorityBinding.actorId,
		attributes: {},
		provenance: canonical,
	});
	graph.edge("actor_authorized_operation", actorNode, operationNode, canonical, {
		role: operation.body.authorityBinding.role,
	});
	for (const parent of operation.body.parents) {
		graph.edge(
			"operation_has_parent",
			operationNode,
			operationNodeId(parent),
			canonical,
		);
	}
	const sourceNode = `git-commit:${operation.body.baseSnapshot.sourceHead}`;
	const observed = operationProvenance(operation, "observed_binding", [
		operation.body.baseSnapshot.sourceHead,
	]);
	graph.node({
		id: sourceNode,
		type: "git_commit",
		label: operation.body.baseSnapshot.sourceHead,
		attributes: {},
		provenance: observed,
	});
	graph.edge("operation_observed_source", operationNode, sourceNode, observed);
	OPERATION_GRAPH_PROJECTORS[operation.body.kind](graph, operation);
}

function projectChangeRevision(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload =
		operation.body.kind === "change.proposed"
			? payloadOf(operation, "change.proposed")
			: payloadOf(operation, "change.revised");
	const provenance = operationProvenance(operation);
	const revision = payload.revision;
	const revisionNode = `revision:${revision.revisionId}`;
	graph.node({
		id: revisionNode,
		type: "change_revision",
		label: revision.content.title,
		attributes: {risk: revision.content.safety.risk},
		provenance,
	});
	graph.edge(
		"change_has_revision",
		changeNodeId(operation.body.changeId),
		revisionNode,
		provenance,
	);
	for (const requirement of revision.content.acceptanceRequirements) {
		const requirementNode = `requirement:${revision.revisionId}:${requirement.id}`;
		graph.node({
			id: requirementNode,
			type: "requirement",
			label: requirement.statement,
			attributes: {requirementId: requirement.id},
			provenance,
		});
		graph.edge("revision_has_requirement", revisionNode, requirementNode, provenance);
	}
	if (revision.content.knowledge.kind === "effects") {
		for (const effect of revision.content.knowledge.effects) {
			const effectId = knowledgeEffectId(effect);
			const effectNode = effectId;
			graph.node({
				id: effectNode,
				type: "knowledge_effect",
				label: effectId,
				attributes: {
					action: effect.action,
					targetKey: knowledgeTargetKey(effect.target),
				},
				provenance,
			});
			graph.edge("revision_has_knowledge_effect", revisionNode, effectNode, provenance);
			graph.edge(
				"knowledge_effect_targets_subject",
				effectNode,
				`knowledge-ref:${effect.target.subjectId}`,
				provenance,
				{...(effect.target.facetId ? {facetId: effect.target.facetId} : {})},
			);
		}
	}
	for (const invariant of revision.content.safety.invariants) {
		const invariantId = canonicalJsonDigest({invariant: invariant.trim()});
		const invariantNode = `invariant:${invariantId}`;
		graph.node({
			id: invariantNode,
			type: "accepted_invariant",
			label: "Accepted invariant",
			attributes: {statementDigest: invariantId},
			provenance,
		});
		graph.edge("revision_declares_invariant", revisionNode, invariantNode, provenance);
	}
	if (operation.body.kind === "change.revised") {
		const revised = payloadOf(operation, "change.revised");
		graph.edge(
			"revision_supersedes_revision",
			revisionNode,
			`revision:${revised.previousRevisionId}`,
			provenance,
		);
	}
}

function projectChangeRelationship(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "change.relationship_recorded");
	graph.edge(
		payload.relationship.type,
		changeNodeId(operation.body.changeId),
		changeNodeId(payload.relationship.targetChangeId),
		operationProvenance(operation),
		{
			relationshipId: payload.relationshipId,
			sourceRevisionId: payload.relationship.sourceRevisionId,
			targetRevisionId: payload.relationship.targetRevisionId,
		},
	);
}

function projectRelationshipSupersession(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "change.relationship_superseded");
	graph.edge(
		"relationship_superseded_by",
		operationNodeId(payload.relationshipOperationId),
		operationNodeId(operation.operationId),
		operationProvenance(operation),
	);
}

function projectChangeMerge(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "change.merge_recorded");
	const provenance = operationProvenance(operation);
	payload.sources.forEach((source) =>
		graph.edge(
			"change_merged_into",
			changeNodeId(source.changeId),
			changeNodeId(payload.result.changeId),
			provenance,
			{mergeId: payload.mergeId},
		),
	);
}

function projectChangeSplit(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "change.split_recorded");
	const provenance = operationProvenance(operation);
	payload.results.forEach((result) =>
		graph.edge(
			"change_split_into",
			changeNodeId(payload.source.changeId),
			changeNodeId(result.changeId),
			provenance,
			{splitId: payload.splitId},
		),
	);
}

function projectTraceReopened(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "trace.reopened");
	const provenance = operationProvenance(operation);
	graph.edge(
		"trace_reopens_archive",
		operationNodeId(operation.operationId),
		`archive:${payload.archiveManifestId}`,
		provenance,
	);
	graph.edge(
		"trace_continues_from",
		operationNodeId(operation.operationId),
		operationNodeId(payload.archivedTailOperationId),
		provenance,
	);
}

function projectChangeFeedback(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "change.feedback_recorded");
	graph.edge(
		"feedback_about_revision",
		operationNodeId(operation.operationId),
		`revision:${payload.revisionId}`,
		operationProvenance(operation),
		{classification: payload.classification},
	);
}

function projectChangeClaim(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "change_claim.acquired");
	const claimNode = claimNodeId(operation.operationId);
	const provenance = operationProvenance(operation);
	graph.node({
		id: claimNode,
		type: "change_claim",
		label: payload.purpose,
		attributes: {revisionId: payload.revisionId},
		provenance,
	});
	graph.edge(
		"actor_claims_change",
		`actor:${operation.body.authorityBinding.actorId}`,
		changeNodeId(operation.body.changeId),
		provenance,
		{claimOperationId: operation.operationId},
	);
}

function projectClaimRelease(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "change_claim.released");
	graph.edge(
		"claim_released_by",
		claimNodeId(payload.claimOperationId),
		operationNodeId(operation.operationId),
		operationProvenance(operation),
	);
}

function projectChangeClaimTakeover(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "change_claim.takeover_recorded");
	const provenance = operationProvenance(operation);
	graph.node({
		id: claimNodeId(operation.operationId),
		type: "change_claim",
		label: payload.purpose,
		attributes: {revisionId: payload.revisionId},
		provenance,
	});
	graph.edge(
		"claim_taken_over_by",
		claimNodeId(payload.priorClaimOperationId),
		claimNodeId(operation.operationId),
		provenance,
	);
}

function projectLoopAttempt(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "loop.attempt_started");
	const attemptNode = attemptNodeId(operation.operationId);
	const provenance = operationProvenance(operation);
	graph.node({
		id: attemptNode,
		type: "loop_attempt",
		label: payload.loop,
		attributes: {loop: payload.loop, changeRevisionId: payload.changeRevisionId},
		provenance,
	});
	graph.edge(
		"change_has_loop_attempt",
		changeNodeId(operation.body.changeId),
		attemptNode,
		provenance,
	);
}

function projectAttemptEnd(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "loop.attempt_ended");
	graph.edge(
		"attempt_ended_by",
		attemptNodeId(payload.attemptOperationId),
		operationNodeId(operation.operationId),
		operationProvenance(operation),
		{status: payload.status},
	);
}

function projectCandidate(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = candidatePayload(operation);
	const candidateNode = `candidate:${payload.candidate.id}`;
	const provenance = operationProvenance(operation);
	const attributes: Record<string, CanonicalJsonValue> = {
		digest: inlineArtifactAttribute(payload.candidate, "digest"),
		contentDigest: payload.candidate.digest,
	};
	const workUnitId =
		operation.body.kind === "implementation.candidate_recorded"
			? inlineCandidateContentAttribute(payload.candidate, "workUnitId")
			: null;
	if (workUnitId !== null) attributes.workUnitId = workUnitId;
	graph.node({
		id: candidateNode,
		type: "candidate",
		label: payload.candidate.id,
		attributes,
		provenance,
	});
	graph.edge(
		"attempt_has_candidate",
		attemptNodeId(payload.attemptOperationId),
		candidateNode,
		provenance,
	);
	if (typeof workUnitId === "string") {
		graph.edge(
			"work_unit_realized_by_candidate",
			workUnitNodeId(workUnitId),
			candidateNode,
			provenance,
		);
	}
	projectCandidateRealizationLineage(graph, operation, payload.candidate, provenance);
}

function projectCandidateRealizationLineage(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
	candidate: CanonicalInlineSemanticArtifact,
	provenance: AlignmentGraphFactProvenance,
): void {
	const content = candidateContentRecord(candidate);
	if (!content) return;
	const revisionId = typeof content.changeRevisionId === "string"
		? content.changeRevisionId
		: null;
	if (operation.body.kind === "planning.candidate_recorded" && revisionId) {
		const delta = objectRecord(content.delta);
		const workUnits = Array.isArray(delta?.workUnits) ? delta.workUnits : [];
		for (const value of workUnits) {
			const workUnit = objectRecord(value);
			if (!workUnit || typeof workUnit.id !== "string") continue;
			const workUnitNode = workUnitNodeId(workUnit.id);
			graph.node({
				id: workUnitNode,
				type: "work_unit",
				label: typeof workUnit.title === "string" ? workUnit.title : workUnit.id,
				attributes: {},
				provenance,
			});
			for (const effectId of stringValues(workUnit.knowledgeEffectIds)) {
				graph.edge(
					"knowledge_effect_assigned_to_work_unit",
					effectId,
					workUnitNode,
					provenance,
				);
			}
			for (const requirementId of stringValues(workUnit.acceptanceRequirementIds)) {
				graph.edge(
					"requirement_assigned_to_work_unit",
					`requirement:${revisionId}:${requirementId}`,
					workUnitNode,
					provenance,
				);
			}
			for (const path of stringValues(workUnit.pathScopes)) {
				graph.edge(
					"work_unit_scopes_realization_path",
					workUnitNode,
					realizationPathNode(path),
					provenance,
				);
			}
		}
	}
	if (operation.body.kind !== "implementation.candidate_recorded" || !revisionId) return;
	const candidateId = inlineArtifactAttribute(candidate, "id");
	if (typeof candidateId !== "string") return;
	const candidateNode = `candidate:${candidateId}`;
	const acceptanceSlice = objectRecord(content.acceptanceSlice);
	for (const effectId of stringValues(acceptanceSlice?.knowledgeEffectIds)) {
		graph.edge(
			"knowledge_effect_realized_by_candidate",
			effectId,
			candidateNode,
			provenance,
		);
	}
	for (const requirementId of stringValues(acceptanceSlice?.acceptanceRequirementIds)) {
		graph.edge(
			"requirement_realized_by_candidate",
			`requirement:${revisionId}:${requirementId}`,
			candidateNode,
			provenance,
		);
	}
	for (const path of stringValues(content.changedPaths)) {
		const pathNode = realizationPathNode(path);
		graph.node({
			id: pathNode,
			type: realizationPathType(path),
			label: path,
			attributes: {},
			provenance,
		});
		graph.edge("candidate_realizes_path", candidateNode, pathNode, provenance);
	}
}

function candidateContentRecord(
	candidate: CanonicalInlineSemanticArtifact,
): Readonly<Record<string, CanonicalJsonValue>> | null {
	const artifact = objectRecord(candidate.artifact);
	return objectRecord(artifact?.content);
}

function objectRecord(
	value: unknown,
): Readonly<Record<string, CanonicalJsonValue>> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? value as Readonly<Record<string, CanonicalJsonValue>>
		: null;
}

function stringValues(value: unknown): readonly string[] {
	return Array.isArray(value)
		? value.filter((entry): entry is string => typeof entry === "string")
		: [];
}

function realizationPathNode(path: string): string {
	return `${realizationPathType(path)}:${path}`;
}

function realizationPathType(path: string): "source_path" | "test_path" {
	return /(^|\/)(tests?|__tests__)(\/|$)|\.(?:spec|test)\.[^.]+$/u.test(path)
		? "test_path"
		: "source_path";
}

function projectExitPolicy(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "loop.exit_policy_recorded");
	const policyNode = `exit-policy:${payload.policy.id}`;
	const provenance = operationProvenance(operation);
	graph.node({
		id: policyNode,
		type: "exit_policy",
		label: payload.policy.id,
		attributes: {
			digest: inlineArtifactAttribute(payload.policy, "policyDigest"),
			contentDigest: payload.policy.digest,
		},
		provenance,
	});
	graph.edge(
		"candidate_has_exit_policy",
		`candidate:${payload.candidateId}`,
		policyNode,
		provenance,
	);
}

function projectEvidence(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "evidence.recorded");
	const evidenceNode = `evidence:${payload.evidence.id}`;
	const provenance = operationProvenance(operation);
	graph.node({
		id: evidenceNode,
		type: "evidence",
		label: payload.evidenceKind,
		attributes: {
			authority: payload.authority,
			coverage: payload.coverage,
			digest: payload.evidence.digest,
		},
		provenance,
	});
	graph.edge(
		payload.candidateId ? "candidate_has_evidence" : "attempt_has_evidence",
		payload.candidateId
			? `candidate:${payload.candidateId}`
			: attemptNodeId(payload.attemptOperationId),
		evidenceNode,
		provenance,
	);
}

function projectCheckResult(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "check.result_recorded");
	const resultNode = `check-result:${payload.result.id}`;
	const provenance = operationProvenance(operation);
	graph.node({
		id: resultNode,
		type: "check_result",
		label: `${payload.checkId}@${payload.checkVersion}`,
		attributes: {
			status: payload.status,
			digest: inlineArtifactAttribute(payload.result, "resultDigest"),
			contentDigest: payload.result.digest,
		},
		provenance,
	});
	graph.edge(
		"candidate_has_check_result",
		`candidate:${payload.candidateId}`,
		resultNode,
		provenance,
	);
	payload.evidenceRecordIds.forEach((evidenceId) =>
		graph.edge(
			"check_result_considered_evidence",
			resultNode,
			`evidence:${evidenceId}`,
			provenance,
		),
	);
}

function projectExitReport(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "loop.exit_report_recorded");
	const reportNode = `exit-report:${payload.report.id}`;
	const provenance = operationProvenance(operation);
	graph.node({
		id: reportNode,
		type: "exit_report",
		label: payload.report.id,
		attributes: {
			status: payload.status,
			digest: inlineArtifactAttribute(payload.report, "reportDigest"),
			contentDigest: payload.report.digest,
		},
		provenance,
	});
	graph.edge(
		"candidate_has_exit_report",
		`candidate:${payload.candidateId}`,
		reportNode,
		provenance,
	);
	payload.resultIds.forEach((resultId) =>
		graph.edge("exit_report_has_result", reportNode, `check-result:${resultId}`, provenance),
	);
}

function projectPlanningDeltaAcceptance(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "planning.delta_accepted");
	const acceptanceNode = `planning-acceptance:${operation.operationId}`;
	const deltaNode = `work-graph-delta:${payload.deltaId}`;
	const provenance = operationProvenance(operation);
	graph.node({
		id: acceptanceNode,
		type: "planning_acceptance",
		label: payload.deltaId,
		attributes: {
			candidateDigest: payload.candidateDigest,
			gateReportDigest: payload.gateReportDigest,
			workGraphDigest: payload.expectedWorkGraphDigest,
		},
		provenance,
	});
	graph.node({
		id: deltaNode,
		type: "work_graph_delta",
		label: payload.deltaId,
		attributes: {},
		provenance,
	});
	graph.edge(
		"candidate_accepted_by",
		`candidate:${payload.candidateId}`,
		acceptanceNode,
		provenance,
	);
	graph.edge("planning_delta_updates_work_graph", acceptanceNode, deltaNode, provenance);
}

function projectDecisionConfirmation(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "decision.confirmed");
	const confirmationNode = `decision-confirmation:${operation.operationId}`;
	const provenance = operationProvenance(operation);
	graph.node({
		id: confirmationNode,
		type: "decision_confirmation",
		label: payload.disposition,
		attributes: {
			candidateDigest: payload.candidateDigest,
			gateReportDigest: payload.gateReportDigest,
			...(payload.disposition === "approve"
				? {knowledgeStateDigest: payload.resultingKnowledgeStateDigest}
				: {}),
		},
		provenance,
	});
	graph.edge(
		"candidate_confirmed_by",
		`candidate:${payload.candidateId}`,
		confirmationNode,
		provenance,
	);
	graph.edge(
		"confirmation_binds_gate_report",
		confirmationNode,
		`gate-report:${payload.gateReportId}`,
		provenance,
	);
}

function projectServerRoute(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "runtime.route_recorded");
	const routeNode = `runtime-route:${operation.operationId}`;
	const provenance = operationProvenance(operation);
	graph.node({
		id: routeNode,
		type: "runtime_route",
		label: payload.route,
		attributes: {
			route: payload.route,
			reasonCode: payload.reasonCode,
			routeDigest: inlineArtifactAttribute(payload.runtimeRoute, "routeDigest"),
			contentDigest: payload.runtimeRoute.digest,
		},
		provenance,
	});
	graph.edge(
		"exit_report_routes_to",
		`exit-report:${payload.exitReportId}`,
		routeNode,
		provenance,
	);
}

function projectWorkUnitClaim(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "work_unit_claim.acquired");
	projectWorkUnitClaimNode(graph, operation, payload);
}

function projectWorkUnitClaimTakeover(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "work_unit_claim.takeover_recorded");
	projectWorkUnitClaimNode(graph, operation, payload);
	graph.edge(
		"work_unit_claim_taken_over_by",
		claimNodeId(payload.priorClaimOperationId),
		claimNodeId(operation.operationId),
		operationProvenance(operation),
	);
}

function projectWorkUnitClaimNode(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
	payload: Pick<
		ChangeOperationPayload<"work_unit_claim.acquired">,
		| "workGraphDeltaId"
		| "workUnitId"
		| "workerId"
		| "workerOfferId"
		| "workerOfferDigest"
		| "schedulingPolicyDigest"
		| "leaseExpiresAt"
	>,
): void {
	const provenance = operationProvenance(operation);
	const claimNode = claimNodeId(operation.operationId);
	graph.node({
		id: claimNode,
		type: "work_unit_claim",
		label: payload.workUnitId,
		attributes: {
			workerId: payload.workerId,
			workerOfferId: payload.workerOfferId,
			workerOfferDigest: payload.workerOfferDigest,
			schedulingPolicyDigest: payload.schedulingPolicyDigest,
			leaseExpiresAt: payload.leaseExpiresAt,
		},
		provenance,
	});
	const workerNode = `actor:${payload.workerId}`;
	const workUnitNode = workUnitNodeId(payload.workUnitId);
	graph.edge(
		"worker_claims_work_unit",
		workerNode,
		workUnitNode,
		provenance,
		{claimOperationId: operation.operationId},
	);
	graph.edge("worker_holds_work_unit_claim", workerNode, claimNode, provenance);
	graph.edge("claim_authorizes_work_unit", claimNode, workUnitNode, provenance);
}

function projectWorkUnitClaimRelease(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "work_unit_claim.released");
	graph.edge(
		"work_unit_claim_released_by",
		claimNodeId(payload.claimOperationId),
		operationNodeId(operation.operationId),
		operationProvenance(operation),
	);
}

function projectAssignment(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "assignment.dispatched");
	const assignmentNode = assignmentNodeId(operation.operationId);
	const provenance = operationProvenance(operation);
	graph.node({
		id: assignmentNode,
		type: "assignment",
		label: payload.assignmentAttemptId,
		attributes: {
			workerId: payload.workerId,
			workerOfferId: payload.workerOfferId,
			workerOfferDigest: payload.workerOfferDigest,
			workbenchId: payload.workbenchId,
			workbenchDigest: payload.workbenchDigest,
			assignmentDigest: payload.assignmentDigest,
		},
		provenance,
	});
	graph.edge(
		"work_unit_dispatched_as_assignment",
		workUnitNodeId(payload.workUnitId),
		assignmentNode,
		provenance,
	);
	graph.edge(
		"assignment_uses_claim",
		assignmentNode,
		claimNodeId(payload.claimOperationId),
		provenance,
	);
}

function projectAssignmentCancellation(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "assignment.cancel_requested");
	graph.edge(
		"assignment_has_cancel_request",
		assignmentNodeId(payload.assignmentOperationId),
		operationNodeId(operation.operationId),
		operationProvenance(operation),
	);
}

function projectAssignmentTerminal(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "assignment.terminal_recorded");
	graph.edge(
		"assignment_ended_by",
		assignmentNodeId(payload.assignmentOperationId),
		operationNodeId(operation.operationId),
		operationProvenance(operation),
		{status: payload.status},
	);
}

function projectWorkerReport(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "worker.report_recorded");
	graph.edge(
		"assignment_has_worker_report",
		assignmentNodeId(payload.assignmentOperationId),
		`evidence:${payload.workerReportEvidenceId}`,
		operationProvenance(operation),
	);
}

function projectIntegrationAttempt(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "integration.attempt_started");
	const integrationNode = integrationNodeId(operation.operationId);
	const provenance = operationProvenance(operation);
	graph.node({
		id: integrationNode,
		type: "integration_attempt",
		label: payload.targetRef,
		attributes: {baseCommit: payload.baseCommit},
		provenance,
	});
	graph.edge(
		"change_has_integration_attempt",
		changeNodeId(operation.body.changeId),
		integrationNode,
		provenance,
	);
	payload.assignmentOperationIds.forEach((assignmentOperationId) =>
		graph.edge(
			"integration_uses_assignment",
			integrationNode,
			assignmentNodeId(assignmentOperationId),
			provenance,
		),
	);
}

function projectPrivateIntegrationAdmission(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	classifyOperation("candidate_admitted_to_private_lineage")(graph, operation);
	const payload = payloadOf(operation, "integration.candidate_admitted");
	const provenance = operationProvenance(operation);
	const receipt = payload.receipt;
	const workUnitId = inlineArtifactAttribute(receipt, "workUnitId");
	const candidateId = inlineArtifactAttribute(receipt, "candidateId");
	const resultCommit = inlineArtifactAttribute(receipt, "resultCommit");
	const resultTree = inlineArtifactAttribute(receipt, "resultTree");
	const changeRevisionId = inlineArtifactAttribute(receipt, "changeRevisionId");
	const acceptanceSlice = objectRecord(inlineArtifactAttribute(receipt, "acceptanceSlice"));
	if (typeof workUnitId === "string") {
		graph.edge(
			"work_unit_admitted_to_private_lineage",
			workUnitNodeId(workUnitId),
			operationNodeId(operation.operationId),
			provenance,
		);
	}
	if (typeof candidateId === "string") {
		graph.edge(
			"candidate_admitted_to_private_lineage",
			`candidate:${candidateId}`,
			operationNodeId(operation.operationId),
			provenance,
		);
	}
	if (typeof resultCommit === "string") {
		graph.edge(
			"private_lineage_has_commit",
			operationNodeId(operation.operationId),
			`git-commit:${resultCommit}`,
			provenance,
		);
	}
	if (typeof resultTree === "string") {
		graph.edge(
			"private_lineage_has_tree",
			operationNodeId(operation.operationId),
			`git-tree:${resultTree}`,
			provenance,
		);
	}
	for (const effectId of stringValues(acceptanceSlice?.knowledgeEffectIds)) {
		graph.edge(
			"knowledge_effect_admitted_to_private_lineage",
			effectId,
			operationNodeId(operation.operationId),
			provenance,
		);
	}
	for (const requirementId of stringValues(acceptanceSlice?.acceptanceRequirementIds)) {
		if (typeof changeRevisionId !== "string") continue;
		graph.edge(
			"requirement_admitted_to_private_lineage",
			`requirement:${changeRevisionId}:${requirementId}`,
			operationNodeId(operation.operationId),
			provenance,
		);
	}
}

function projectImplementationAggregate(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	classifyOperation("change_has_frozen_implementation_aggregate")(graph, operation);
	const payload = payloadOf(operation, "implementation.aggregate_frozen");
	const provenance = operationProvenance(operation);
	const candidateIds = inlineArtifactAttribute(payload.aggregate, "contributingCandidateIds");
	const workUnitIds = inlineArtifactAttribute(payload.aggregate, "requiredWorkUnitIds");
	const aggregateDigest = inlineArtifactAttribute(payload.aggregate, "aggregateDigest");
	const headCommit = inlineArtifactAttribute(payload.aggregate, "headCommit");
	const headTreeDigest = inlineArtifactAttribute(payload.aggregate, "headTreeDigest");
	const changeRevisionId = inlineArtifactAttribute(payload.aggregate, "changeRevisionId");
	const aggregateNode = typeof aggregateDigest === "string"
		? `implementation-aggregate:${aggregateDigest}`
		: operationNodeId(operation.operationId);
	if (typeof aggregateDigest === "string") {
		graph.node({
			id: aggregateNode,
			type: "implementation_aggregate",
			label: aggregateDigest,
			attributes: {
				aggregateDigest,
				...(typeof headCommit === "string" ? {headCommit} : {}),
				...(typeof headTreeDigest === "string" ? {headTreeDigest} : {}),
			},
			provenance,
		});
		graph.edge(
			"aggregate_frozen_by_operation",
			aggregateNode,
			operationNodeId(operation.operationId),
			provenance,
		);
	}
	if (typeof headCommit === "string") {
		graph.edge("aggregate_has_commit", aggregateNode, `git-commit:${headCommit}`, provenance);
	}
	if (typeof headTreeDigest === "string") {
		graph.edge("aggregate_has_tree", aggregateNode, `git-tree:${headTreeDigest}`, provenance);
	}
	for (const effectId of stringValues(inlineArtifactAttribute(payload.aggregate, "knowledgeEffectIds"))) {
		graph.edge("knowledge_effect_realized_by_aggregate", effectId, aggregateNode, provenance);
	}
	for (const requirementId of stringValues(inlineArtifactAttribute(payload.aggregate, "acceptanceRequirementIds"))) {
		if (typeof changeRevisionId !== "string") continue;
		graph.edge(
			"requirement_realized_by_aggregate",
			`requirement:${changeRevisionId}:${requirementId}`,
			aggregateNode,
			provenance,
		);
	}
	if (Array.isArray(candidateIds)) {
		for (const candidateId of candidateIds) {
			if (typeof candidateId !== "string") continue;
			graph.edge(
				"candidate_contributes_to_implementation_aggregate",
				`candidate:${candidateId}`,
				aggregateNode,
				provenance,
			);
		}
	}
	if (Array.isArray(workUnitIds)) {
		for (const workUnitId of workUnitIds) {
			if (typeof workUnitId !== "string") continue;
			graph.edge(
				"work_unit_contributes_to_implementation_aggregate",
				workUnitNodeId(workUnitId),
				aggregateNode,
				provenance,
			);
		}
	}
}

function projectIntegrationResult(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "integration.result_recorded");
	const provenance = operationProvenance(operation);
	graph.edge(
		"integration_attempt_has_result",
		integrationNodeId(payload.integrationAttemptOperationId),
		operationNodeId(operation.operationId),
		provenance,
		{status: payload.status},
	);
	if (payload.resultCommit) {
		graph.edge(
			"integration_result_has_commit",
			operationNodeId(operation.operationId),
			`git-commit:${payload.resultCommit}`,
			provenance,
		);
	}
}

function projectGuardedDelivery(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "delivery.applied");
	const provenance = operationProvenance(operation, "observed_binding", [
		payload.authority.id,
	]);
	graph.edge(
		"review_authorizes_delivery",
		`review-attempt:${payload.reviewAttemptDigest}`,
		operationNodeId(operation.operationId),
		provenance,
	);
	const aggregateNode = `implementation-aggregate:${payload.aggregateDigest}`;
	graph.edge(
		"delivery_applies_aggregate",
		operationNodeId(operation.operationId),
		aggregateNode,
		provenance,
	);
	graph.edge(
		"delivery_realizes_commit",
		operationNodeId(operation.operationId),
		`git-commit:${payload.deliveredCommit}`,
		provenance,
	);
	graph.edge(
		"delivery_realizes_tree",
		operationNodeId(operation.operationId),
		`git-tree:${payload.deliveredTree}`,
		provenance,
	);
	graph.edge(
		"delivery_updates_ref",
		operationNodeId(operation.operationId),
		`git-ref:${payload.targetRef}`,
		provenance,
	);
}

function projectSourceMerge(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "source.branch_merge_recorded");
	graph.edge(
		"integration_merged_commit",
		integrationNodeId(payload.integrationAttemptOperationId),
		`git-commit:${payload.resultCommit}`,
		operationProvenance(operation, "observed_binding", [
			payload.providerReceiptRef ?? payload.resultCommit,
		]),
	);
}

function projectSourcePush(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "source.branch_push_recorded");
	graph.edge(
		"commit_pushed_to_ref",
		`git-commit:${payload.sourceCommit}`,
		`git-ref:${payload.targetRef}`,
		operationProvenance(operation, "observed_binding", [payload.receiptEvidenceId]),
	);
}

function projectReviewProjection(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "review_projection.published");
	graph.edge(
		"candidate_published_for_review",
		`candidate:${payload.candidateId}`,
		`review:${operation.operationId}`,
		operationProvenance(operation, "observed_binding", [
			payload.providerRef,
			payload.publicationEvidenceId,
		]),
	);
}

function projectProductPublication(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "product.publication_recorded");
	graph.edge(
		"candidate_published_as_product",
		`candidate:${payload.candidateId}`,
		`publication:${operation.operationId}`,
		operationProvenance(operation, "observed_binding", [payload.receiptEvidenceId]),
		{status: payload.status, channel: payload.channel},
	);
}

function projectProductRelease(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "product.release_recorded");
	graph.edge(
		"artifact_released_through_channel",
		payload.publicationOperationId
			? `publication:${payload.publicationOperationId}`
			: changeNodeId(operation.body.changeId),
		`release:${operation.operationId}`,
		operationProvenance(operation, "observed_binding", [payload.receiptEvidenceId]),
		{status: payload.status, channel: payload.channel, version: payload.version},
	);
}

function projectDeliveryObservation(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "delivery.observation_recorded");
	graph.edge(
		"effect_has_delivery_observation",
		operationNodeId(payload.subjectOperationId),
		`delivery:${operation.operationId}`,
		operationProvenance(operation, "observed_binding", [payload.evidenceId]),
		{status: payload.status, effect: payload.effect},
	);
}

function projectOutcomeObservation(
	graph: GraphAccumulator,
	operation: CanonicalChangeOperation,
): void {
	const payload = payloadOf(operation, "outcome.observation_recorded");
	graph.edge(
		payload.deliveryOperationId ? "delivery_has_outcome" : "change_has_outcome",
		payload.deliveryOperationId
			? `delivery:${payload.deliveryOperationId}`
			: changeNodeId(operation.body.changeId),
		`outcome:${operation.operationId}`,
		operationProvenance(operation, "observed_binding", [payload.evidenceId]),
		{status: payload.status},
	);
}

function projectContradiction(
	graph: GraphAccumulator,
	contradiction: ContradictionProjection,
): void {
	const provenance: AlignmentGraphFactProvenance = {
		class: "deterministic_analysis",
		canonicalRefs: [...contradiction.operationIds].sort(compareText),
		observedRefs: [],
		analysisRefs: [
			`${ALIGNMENT_GRAPH_PROJECTOR.id}@${ALIGNMENT_GRAPH_PROJECTOR.version}`,
		],
	};
	const contradictionNode = `contradiction:${contradiction.contradictionId}`;
	graph.node({
		id: contradictionNode,
		type: "contradiction",
		label: contradiction.kind,
		attributes: {subject: contradiction.subject},
		provenance,
	});
	contradiction.operationIds.forEach((operationId) =>
		graph.edge(
			"operation_contradicts_operation",
			contradictionNode,
			operationNodeId(operationId),
			provenance,
		),
	);
}

function classifyOperation(type: string): OperationGraphProjector {
	return (graph, operation) =>
		graph.edge(
			type,
			changeNodeId(operation.body.changeId),
			operationNodeId(operation.operationId),
			operationProvenance(operation),
		);
}

type AddEdgeInput = readonly [
	type: string,
	from: string,
	to: string,
	provenance: AlignmentGraphFactProvenance,
	attributes?: Readonly<Record<string, CanonicalJsonValue>>,
];

function createAccumulator(previous: AlignmentGraphSnapshot | null) {
	const nodes = new Map<string, AlignmentGraphNode>(
		(previous?.nodes ?? []).map((node) => [node.id, node]),
	);
	const edges = new Map<Sha256Digest, AlignmentGraphEdge>(
		(previous?.edges ?? []).map((edge) => [edge.factId, edge]),
	);
	const ensureReference = (
		id: string,
		provenance: AlignmentGraphFactProvenance,
	): void => {
		if (nodes.has(id)) return;
		nodes.set(
			id,
			canonicalValue({
				id,
				type: "reference",
				label: id,
				attributes: {},
				provenance,
			}),
		);
	};
	return {
		node(input: AlignmentGraphNode): void {
			const normalized = canonicalValue<AlignmentGraphNode>(input);
			const existing = nodes.get(normalized.id);
			if (!existing) {
				nodes.set(normalized.id, normalized);
				return;
			}
			const provenance = mergeAlignmentGraphProvenance(
				existing.provenance,
				normalized.provenance,
			);
			if (existing.type === "reference" && normalized.type !== "reference") {
				nodes.set(normalized.id, {...normalized, provenance});
				return;
			}
			if (normalized.type === "reference" && existing.type !== "reference") {
				nodes.set(normalized.id, {...existing, provenance});
				return;
			}
			if (
				existing.type !== normalized.type ||
				existing.label !== normalized.label ||
				canonicalJson(existing.attributes) !== canonicalJson(normalized.attributes)
			) {
				throw new Error(`Alignment Graph node ${normalized.id} has conflicting identity.`);
			}
			nodes.set(normalized.id, {...existing, provenance});
		},
		edge(...[
			type,
			from,
			to,
			provenance,
			attributes = {},
		]: AddEdgeInput): void {
			ensureReference(from, provenance);
			ensureReference(to, provenance);
			const body = canonicalValue<Omit<AlignmentGraphEdge, "factId">>({
				type,
				from,
				to,
				attributes,
				provenance,
			});
			const edge = canonicalValue<AlignmentGraphEdge>({
				...body,
				factId: canonicalJsonDigest(body),
			});
			edges.set(edge.factId, edge);
		},
		values(): {nodes: AlignmentGraphNode[]; edges: AlignmentGraphEdge[]} {
			return {
				nodes: [...nodes.values()].sort((left, right) => compareText(left.id, right.id)),
				edges: [...edges.values()].sort((left, right) =>
					compareText(left.factId, right.factId),
				),
			};
		},
	};
}

function materializeGraphSnapshot(
	state: ProjectWorkState,
	graph: GraphAccumulator,
): AlignmentGraphSnapshot {
	if (!state.stateHead || !state.observedBase) {
		throw new Error("Alignment Graph requires an accepted WorkState base.");
	}
	const baseBinding: AlignmentGraphBaseBinding = {
		remoteStateHead: state.stateHead,
		sourceHead: state.observedBase.sourceHead,
		knowledgeDigest: state.observedBase.knowledgeDigest,
		configDigest: state.observedBase.configDigest,
		policyDigest: state.observedBase.policyDigest,
		workStateDigest: state.workStateDigest,
	};
	const graphSnapshotDigest = canonicalJsonDigest({
		remoteStateHead: baseBinding.remoteStateHead,
		sourceHead: baseBinding.sourceHead,
		knowledgeDigest: baseBinding.knowledgeDigest,
		configDigest: baseBinding.configDigest,
		policyDigest: baseBinding.policyDigest,
		projector: ALIGNMENT_GRAPH_PROJECTOR,
	});
	const values = graph.values();
	const graphContentDigest = canonicalJsonDigest(values);
	return canonicalValue({
		projector: ALIGNMENT_GRAPH_PROJECTOR,
		graphSnapshotDigest,
		graphContentDigest,
		baseBinding,
		status: "fresh",
		projectedRecordIds: state.acceptedOperationIds,
		nodes: values.nodes,
		edges: values.edges,
		coverage: {
			acceptedRecordCount: state.acceptedOperationIds.length,
			projectedRecordCount: state.acceptedOperationIds.length,
			knowledgeConceptCount: 0,
			authoredRelationshipCount: 0,
			sourceOwnershipCount: 0,
			nodeCount: values.nodes.length,
			edgeCount: values.edges.length,
			truncated: false,
		},
	});
}

function assertProjectionBase(
	previous: AlignmentGraphSnapshot | null,
	state: ProjectWorkState,
): void {
	if (!previous) return;
	if (
		previous.projector.id !== ALIGNMENT_GRAPH_PROJECTOR.id ||
		previous.projector.version !== ALIGNMENT_GRAPH_PROJECTOR.version
	) {
		throw new Error("Alignment Graph projector version mismatch.");
	}
	if (
		previous.coverage.knowledgeConceptCount > 0 ||
		previous.coverage.authoredRelationshipCount > 0 ||
		previous.coverage.sourceOwnershipCount > 0
	) {
		throw new Error(
			"Alignment Graph incremental operation projection cannot use a Knowledge-augmented base.",
		);
	}
	if (
		!sameText(
			previous.projectedRecordIds,
			state.acceptedOperationIds.slice(0, previous.projectedRecordIds.length),
		)
	) {
		throw new Error("Alignment Graph incremental base is not an accepted prefix.");
	}
}

function recordsById(
	state: ProjectWorkState,
): ReadonlyMap<OperationId, CanonicalChangeOperation> {
	return new Map(
		state.changes.flatMap((change) =>
			change.operations.map((operation) => [operation.operationId, operation] as const),
		),
	);
}

function operationProvenance(
	operation: CanonicalChangeOperation,
	provenanceClass: AlignmentGraphProvenanceClass = "canonical_binding",
	observedRefs: readonly string[] = [],
): AlignmentGraphFactProvenance {
	return {
		class: provenanceClass,
		canonicalRefs: [operation.operationId],
		observedRefs: [...new Set(observedRefs)].sort(compareText),
		analysisRefs: [],
	};
}

export function mergeAlignmentGraphProvenance(
	left: AlignmentGraphFactProvenance,
	right: AlignmentGraphFactProvenance,
): AlignmentGraphFactProvenance {
	const rank: Record<AlignmentGraphProvenanceClass, number> = {
		canonical_binding: 0,
		observed_binding: 1,
		deterministic_analysis: 2,
		inferred_analysis: 3,
	};
	return {
		class: rank[left.class] <= rank[right.class] ? left.class : right.class,
		canonicalRefs: sortedUnique([...left.canonicalRefs, ...right.canonicalRefs]),
		observedRefs: sortedUnique([...left.observedRefs, ...right.observedRefs]),
		analysisRefs: sortedUnique([...left.analysisRefs, ...right.analysisRefs]),
	};
}

function sortedUnique(values: readonly string[]): readonly string[] {
	return [...new Set(values)].sort(compareText);
}

function operationNodeId(operationId: OperationId): string {
	return `operation:${operationId}`;
}

function changeNodeId(changeId: string): string {
	return `change:${changeId}`;
}

function workUnitNodeId(workUnitId: string): string {
	return `work-unit:${workUnitId}`;
}

function claimNodeId(operationId: string): string {
	return `claim:${operationId}`;
}

function attemptNodeId(operationId: string): string {
	return `attempt:${operationId}`;
}

function assignmentNodeId(operationId: string): string {
	return `assignment:${operationId}`;
}

function integrationNodeId(operationId: string): string {
	return `integration:${operationId}`;
}

function inlineArtifactAttribute(
	inline: CanonicalInlineSemanticArtifact,
	field: string,
): CanonicalJsonValue {
	const artifact = inline.artifact as Record<string, CanonicalJsonValue>;
	return artifact[field] ?? null;
}

function inlineCandidateContentAttribute(
	inline: CanonicalInlineSemanticArtifact,
	field: string,
): CanonicalJsonValue {
	const artifact = inline.artifact as Record<string, CanonicalJsonValue>;
	const content = artifact.content;
	if (!content || typeof content !== "object" || Array.isArray(content)) return null;
	const contentRecord = content as Readonly<Record<string, CanonicalJsonValue>>;
	return contentRecord[field] ?? null;
}

function canonicalValue<T>(value: unknown): T {
	// SAFETY: graph projectors assemble contract values; canonicalization preserves shape while freezing and ordering.
	return toCanonicalJsonValue(value) as unknown as T;
}
