import type {EvidenceRecord} from "../../evidence/contracts.ts";
import type {LoopCandidate} from "../../checks/identity.ts";
import type {CheckExecutor} from "../../checks/runner.ts";
import type {CheckPackSnapshot} from "../../checks/packs/contracts.ts";
import type {GateEvaluationSourceHeads} from "../../checks/gate-package.ts";
import type {DecisionCandidate} from "../../loops/decision/candidate.ts";
import type {PlanningCandidate} from "../../loops/planning/candidate.ts";
import type {WorkUnitCandidate} from "../../loops/implementation/work-unit-candidate.ts";
import type {ReviewAttempt} from "../../loops/review/contracts.ts";
import {canonicalJsonDigest, type Sha256Digest} from "../../utils/canonical-json.ts";

export function decisionGatePackageContext(input: {
	readonly candidate: DecisionCandidate;
	readonly snapshot: CheckPackSnapshot;
	readonly executors?: readonly CheckExecutor[];
	readonly evidenceRecords?: readonly EvidenceRecord[];
}) {
	const checkpoint = input.candidate.content.knowledgeCheckpoint;
	return Object.freeze({
		sources: candidateSources({
			...input,
			overrides: {
				knowledgeStateDigest: checkpoint.base.state.stateDigest,
				knowledgeProjectionDigest: checkpoint.base.projection.projectionDigest,
				alignmentDigest: canonicalJsonDigest({
					relationships: input.candidate.content.relationships,
					overlaps: input.candidate.content.activeOverlaps,
				}),
			},
		}),
		stageBindings: Object.freeze({
			stage: "decision",
			changeRevisionDigest: input.candidate.content.revision.revisionId,
			knowledgeTransitionDigest: checkpoint.transitionDigest,
			compilerDigest: checkpoint.compiler.digest,
			applicationPlanDigest: checkpoint.applicationPlan.planDigest,
			projectedKnowledgeStateDigest: checkpoint.projected.state.stateDigest,
			projectedKnowledgeProjectionDigest: checkpoint.projected.projection.projectionDigest,
			semanticViewDigest: canonicalJsonDigest(checkpoint.view),
			acceptedActiveChangesDigest: input.candidate.content.acceptedActiveChanges.digest,
		}),
	});
}

export function planningGatePackageContext(input: {
	readonly candidate: PlanningCandidate;
	readonly snapshot: CheckPackSnapshot;
	readonly executors?: readonly CheckExecutor[];
	readonly evidenceRecords?: readonly EvidenceRecord[];
}) {
	const delta = input.candidate.content.delta;
	return Object.freeze({
		sources: candidateSources({
			...input,
			overrides: {
				knowledgeStateDigest: input.candidate.content.observedKnowledgeStateDigest,
				alignmentDigest: canonicalJsonDigest({
					workGraph: input.candidate.content.observedWorkGraphDigest,
					dependencies: delta.dependencyEdges,
				}),
			},
		}),
		stageBindings: Object.freeze({
			stage: "planning",
			changeRevisionDigest: input.candidate.content.changeRevisionId,
			acceptedKnowledgeTargetsDigest: canonicalJsonDigest({
				effects: delta.knowledgeEffectCoverage,
				unchanged: delta.unchangedKnowledgeCoverage,
			}),
			acceptanceRequirementsDigest: canonicalJsonDigest(delta.acceptanceCoverage),
			planningDeltaDigest: delta.deltaId,
		}),
	});
}

export function implementationGatePackageContext(input: {
	readonly candidate: WorkUnitCandidate;
	readonly snapshot: CheckPackSnapshot;
	readonly policyDigest: Sha256Digest;
	readonly executors?: readonly CheckExecutor[];
	readonly evidenceRecords?: readonly EvidenceRecord[];
}) {
	const acceptance = input.candidate.content.acceptanceSlice;
	return Object.freeze({
		sources: candidateSources({
			...input,
			overrides: {
				repositoryTreeDigest: input.candidate.content.resultTreeDigest,
				alignmentDigest: canonicalJsonDigest(acceptance),
			},
		}),
		stageBindings: Object.freeze({
			stage: "implementation",
			changeRevisionDigest: input.candidate.content.changeRevisionId,
			acceptedKnowledgeTargetsDigest: canonicalJsonDigest({
				effects: acceptance.knowledgeEffectIds,
				unchanged: acceptance.unchangedKnowledgeTargets,
			}),
			acceptanceRequirementsDigest: canonicalJsonDigest(acceptance.acceptanceRequirementIds),
			implementationPolicyDigest: input.policyDigest,
			workUnitDigest: input.candidate.content.workUnitDigest,
			assignmentDigest: input.candidate.content.assignmentDigest,
			resultTreeDigest: input.candidate.content.resultTreeDigest,
		}),
	});
}

export function reviewGatePackageContext(input: {
	readonly attempt: ReviewAttempt;
	readonly snapshot: CheckPackSnapshot;
	readonly executors?: readonly CheckExecutor[];
	readonly evidenceRecords?: readonly EvidenceRecord[];
}) {
	return Object.freeze({
		sources: Object.freeze({
			workStateDigest: canonicalJsonDigest({
				planning: input.attempt.planningDeltaIds,
				aggregate: input.attempt.aggregateDigest,
			}),
			knowledgeStateDigest: input.attempt.knowledgeStateDigest,
			knowledgeProjectionDigest: input.attempt.knowledgeProjectionDigest,
			alignmentDigest: canonicalJsonDigest({
				workGraph: input.attempt.workGraphDigest,
				lineage: input.attempt.lineageDigest,
			}),
			repositoryTreeDigest: input.attempt.integratedTreeDigest,
			repositoryBase: input.attempt.targetBaseCommit,
			evidenceDigest: canonicalJsonDigest(input.evidenceRecords ?? []),
			resultsDigest: canonicalJsonDigest(input.attempt.implementationResultDigests),
			configurationDigest: input.snapshot.checkPackDigest,
			routesDigest: canonicalJsonDigest((input.executors ?? []).map((executor) => executor.identity)),
		}),
		stageBindings: Object.freeze({
			stage: "review",
			changeRevisionDigest: input.attempt.changeRevisionId,
			acceptedKnowledgeTargetsDigest: input.attempt.knowledgeTransitionDigest,
			acceptanceRequirementsDigest: input.attempt.workGraphDigest,
			workGraphDigest: input.attempt.workGraphDigest,
			aggregateDigest: input.attempt.aggregateDigest,
			lineageDigest: input.attempt.lineageDigest,
			integratedTreeDigest: input.attempt.integratedTreeDigest,
		}),
	});
}

function candidateSources(input: {
	readonly candidate: LoopCandidate;
	readonly snapshot: CheckPackSnapshot;
	readonly executors?: readonly CheckExecutor[];
	readonly evidenceRecords?: readonly EvidenceRecord[];
	readonly overrides: Partial<Pick<GateEvaluationSourceHeads,
		"knowledgeStateDigest" | "knowledgeProjectionDigest" | "alignmentDigest" | "repositoryTreeDigest">>;
}): GateEvaluationSourceHeads {
	const {candidate, snapshot, executors, evidenceRecords, overrides} = input;
	const base = candidate.observedBase;
	const knowledgeDigest = base.knowledgeSnapshotDigest;
	const repositoryDigest = base.gitTreeDigest ?? base.sourceSnapshotDigest ?? knowledgeDigest;
	return Object.freeze({
		workStateDigest: base.workStateDigest,
		knowledgeStateDigest: overrides.knowledgeStateDigest ?? knowledgeDigest,
		knowledgeProjectionDigest: overrides.knowledgeProjectionDigest ?? knowledgeDigest,
		alignmentDigest: overrides.alignmentDigest ?? canonicalJsonDigest(base.canonicalRefs),
		repositoryTreeDigest: overrides.repositoryTreeDigest ?? repositoryDigest,
		repositoryBase: base.canonicalRefs[0] ?? repositoryDigest,
		evidenceDigest: canonicalJsonDigest(evidenceRecords ?? []),
		resultsDigest: canonicalJsonDigest([]),
		configurationDigest: snapshot.checkPackDigest,
		routesDigest: canonicalJsonDigest((executors ?? []).map((executor) => executor.identity)),
	});
}
