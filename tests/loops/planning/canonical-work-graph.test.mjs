import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {materializeProjectWorkState} from "../../../src/changes/trace/state.ts";
import {createPlanningCandidate} from "../../../src/loops/planning/candidate.ts";
import {
	applyAcceptedPlanningDelta,
	materializeWorkGraph,
	refreshWorkGraphStatuses,
} from "../../../src/loops/planning/work-graph.ts";
import {createPlanningOperationSequence} from "../../../src/project-server/effects/planning-operations.ts";
import {createPlanningGate} from "../../../src/project-server/lifecycle/gates.ts";
import {baseSnapshotFor, reduceBatch} from "../../helpers/change-trace-replay-v1.mjs";
import {authorityBinding, digest, gitObject} from "../../helpers/change-trace-v1.mjs";
import {checkSnapshot} from "../../helpers/checks.mjs";
import {
	nativePlanningContext,
	planningProposal,
} from "../../helpers/native-planning.mjs";

describe("canonical Planning Candidate and Work Graph", () => {
	it("binds exact Change, Knowledge, and Work Graph heads before Checks", async () => {
		const context = await nativePlanningContext();
		assert.equal(context.candidate.loop, "planning");
		assert.equal(
			context.candidate.content.observedKnowledgeStateDigest,
			context.state.knowledgeHead.stateDigest,
		);
		assert.equal(
			context.candidate.content.observedWorkGraphDigest,
			context.state.workGraph.graphDigest,
		);
		assert.equal(
			context.candidate.observedBase.workStateDigest,
			context.state.workStateDigest,
		);
		assert.equal(context.candidate.content.delta.changeRevisionId, context.revision.revisionId);
		assert.match(context.candidate.content.delta.deltaId, /^sha256:[0-9a-f]{64}$/u);
	});

	it("rejects incomplete semantic and acceptance coverage before Gate", async () => {
		const context = await nativePlanningContext();
		assert.throws(
			() => createPlanningCandidate({
				state: context.state,
				changeId: context.changeId,
				proposal: {...context.proposal, knowledgeEffectCoverage: []},
			}),
			/Knowledge Effect coverage must exactly cover accepted obligations/,
		);
		assert.throws(
			() => createPlanningCandidate({
				state: context.state,
				changeId: context.changeId,
				proposal: {...context.proposal, acceptanceCoverage: []},
			}),
			/fewer than 1 items|acceptance requirement coverage/u,
		);
	});

	it("accepts exact passed Gate output and atomically advances canonical Work Graph", async () => {
		const context = await nativePlanningContext();
		const gate = await createPlanningGate({
			packSnapshot: checkSnapshot([], {stage: "planning"}),
		}).run({candidate: context.candidate});
		assert.equal(gate.report.status, "passed");
		const sequence = createPlanningOperationSequence({
			state: context.state,
			changeId: context.changeId,
			attemptOperationId: context.planningAttempt.operationId,
			baseSnapshot: baseSnapshotFor(context.state),
			authorityBinding: authorityBinding(),
			acceptanceAuthorityBinding: authorityBinding(),
			recordedAt: "2026-08-10T10:03:00.000Z",
			candidate: context.candidate,
			packSnapshot: gate.packSnapshot,
			evidenceRecords: [],
			report: gate.report,
			transition: gate.transition,
		});
		assert.deepEqual(sequence.operations.map((operation) => operation.body.kind), [
			"planning.candidate_recorded",
			"loop.exit_policy_recorded",
			"loop.exit_report_recorded",
			"planning.delta_accepted",
			"runtime.route_recorded",
			"loop.attempt_ended",
		]);
		const accepted = reduceBatch(context.state, sequence.operations, gitObject("d"));
		assert.notEqual(accepted.workGraph.graphDigest, context.state.workGraph.graphDigest);
		assert.equal(accepted.workGraph.deltas.length, 1);
		assert.equal(accepted.workGraph.workUnits[0].status, "accepted");
		assert.equal(
			accepted.workGraph.currentDeltaByChange[0].deltaId,
			context.candidate.content.delta.deltaId,
		);
		const replayed = reduceBatch(context.state, sequence.operations, gitObject("d"));
		assert.deepEqual(replayed.workGraph, accepted.workGraph);
	});

	it("never accepts failed or stopped Gate output", async () => {
		const context = await nativePlanningContext();
		const gate = await createPlanningGate({
			packSnapshot: checkSnapshot([], {stage: "planning"}),
			stoppedReason: {code: "execution_failed", message: "Checks unavailable."},
		}).run({candidate: context.candidate});
		const sequence = createPlanningOperationSequence({
			state: context.state,
			changeId: context.changeId,
			attemptOperationId: context.planningAttempt.operationId,
			baseSnapshot: baseSnapshotFor(context.state),
			authorityBinding: authorityBinding(),
			acceptanceAuthorityBinding: authorityBinding(),
			recordedAt: "2026-08-10T10:03:00.000Z",
			candidate: context.candidate,
			packSnapshot: gate.packSnapshot,
			evidenceRecords: [],
			report: gate.report,
			transition: gate.transition,
		});
		assert.equal(sequence.acceptanceOperationId, null);
		assert.ok(!sequence.operations.some((operation) => operation.body.kind === "planning.delta_accepted"));
		const retained = reduceBatch(context.state, sequence.operations, gitObject("d"));
		assert.equal(retained.workGraph.graphDigest, context.state.workGraph.graphDigest);
	});

	it("derives current Work Unit status without mutating accepted delta identity", async () => {
		const context = await nativePlanningContext();
		const graph = applyAcceptedPlanningDelta({
			graph: context.state.workGraph,
			delta: context.candidate.content.delta,
			candidateId: context.candidate.id,
			candidateDigest: context.candidate.digest,
			acceptanceOperationId: digest("8"),
			changes: context.state.changes,
		});
		const workUnitId = graph.workUnits[0].workUnit.id;
		const claimed = refreshWorkGraphStatuses(graph, [{
			workUnitClaims: [{workUnitId, status: "active"}],
			assignments: [],
		}]);
		assert.equal(claimed.workUnits[0].status, "claimed");
		assert.deepEqual(claimed.deltas, graph.deltas);
		const completed = refreshWorkGraphStatuses(graph, [{
			workUnitClaims: [],
			assignments: [{workUnitId, status: "completed"}],
		}]);
		assert.equal(completed.workUnits[0].status, "completed");
		assert.deepEqual(completed.deltas, graph.deltas);
	});

	it("requires explicit amendment lineage and never rewrites active Work Units", async () => {
		const context = await nativePlanningContext();
		const graph = applyAcceptedPlanningDelta({
			graph: context.state.workGraph,
			delta: context.candidate.content.delta,
			candidateId: context.candidate.id,
			candidateDigest: context.candidate.digest,
			acceptanceOperationId: digest("1"),
			changes: context.state.changes,
		});
		const {workStateDigest: _staleDigest, ...advancedBody} = context.state;
		const advancedState = materializeProjectWorkState({...advancedBody, workGraph: graph});
		assert.throws(
			() => createPlanningCandidate({
				state: advancedState,
				changeId: context.changeId,
				proposal: context.proposal,
			}),
			/must supersede exact current Change delta/,
		);
		const proposal = planningProposal(context.revision, context.changeId, {
			unitId: "WU-amended",
			amendment: {
				supersedesDeltaId: context.candidate.content.delta.deltaId,
				retireWorkUnitIds: [context.proposal.workUnits[0].id],
				rationale: "Replace unclaimed decomposition with exact smaller work.",
			},
		});
		const amendment = createPlanningCandidate({
			state: advancedState,
			changeId: context.changeId,
			proposal,
		});
		assert.equal(amendment.content.delta.amendment.supersedesDeltaId, context.candidate.content.delta.deltaId);

		const activeGraph = materializeWorkGraph({
			...graph,
			workUnits: graph.workUnits.map((entry) => ({...entry, status: "assigned"})),
		});
		assert.throws(
			() => applyAcceptedPlanningDelta({
				graph: activeGraph,
				delta: amendment.content.delta,
				candidateId: amendment.id,
				candidateDigest: amendment.digest,
				acceptanceOperationId: digest("2"),
				changes: context.state.changes,
			}),
			/Active Work Unit .* cannot be amended/,
		);
	});

	it("merges disjoint Change-scoped deltas with explicit cross-Change dependencies", async () => {
		const context = await nativePlanningContext();
		const firstGraph = applyAcceptedPlanningDelta({
			graph: context.state.workGraph,
			delta: context.candidate.content.delta,
			candidateId: context.candidate.id,
			candidateDigest: context.candidate.digest,
			acceptanceOperationId: digest("3"),
			changes: context.state.changes,
		});
		const firstUnit = context.candidate.content.delta.workUnits[0];
		const secondUnit = {
			...firstUnit,
			id: "WU-second-change",
			owningChangeId: "CHG-second",
			pathScopes: ["src/second-change"],
		};
		const remap = (entry) => ({...entry, workUnitIds: [secondUnit.id]});
		const secondDelta = {
			...context.candidate.content.delta,
			deltaId: digest("4"),
			owningChangeId: "CHG-second",
			changeRevisionId: digest("5"),
			workUnits: [secondUnit],
			dependencyEdges: [{
				fromWorkUnitId: secondUnit.id,
				toWorkUnitId: firstUnit.id,
				kind: "requires",
			}],
			knowledgeEffectCoverage: context.candidate.content.delta.knowledgeEffectCoverage.map(remap),
			unchangedKnowledgeCoverage: context.candidate.content.delta.unchangedKnowledgeCoverage.map(remap),
			acceptanceCoverage: context.candidate.content.delta.acceptanceCoverage.map(remap),
			aggregateReviewRequirements:
				context.candidate.content.delta.aggregateReviewRequirements.map(remap),
			amendment: null,
		};
		const combined = applyAcceptedPlanningDelta({
			graph: firstGraph,
			delta: secondDelta,
			candidateId: "candidate:planning:second",
			candidateDigest: digest("6"),
			acceptanceOperationId: digest("7"),
			changes: context.state.changes,
		});
		assert.equal(combined.deltas.length, 2);
		assert.equal(combined.currentDeltaByChange.length, 2);
		assert.equal(combined.dependencyEdges.length, 1);
		assert.equal(combined.dependencyEdges[0].fromWorkUnitId, secondUnit.id);
		assert.equal(combined.dependencyEdges[0].toWorkUnitId, firstUnit.id);
	});

	it("rejects duplicate identities, cycles, and unordered overlapping scopes", async () => {
		const context = await nativePlanningContext();
		const first = context.proposal.workUnits[0];
		const second = {...first, id: "WU-second"};
		const duplicate = {...first};
		assert.throws(
			() => createPlanningCandidate({
				state: context.state,
				changeId: context.changeId,
				proposal: {...context.proposal, workUnits: [first, duplicate]},
			}),
			/identities must be unique/,
		);
		assert.throws(
			() => createPlanningCandidate({
				state: context.state,
				changeId: context.changeId,
				proposal: {
					...context.proposal,
					workUnits: [first, second],
					dependencyEdges: [],
					knowledgeEffectCoverage: context.proposal.knowledgeEffectCoverage.map(
						(entry) => ({...entry, workUnitIds: [first.id, second.id]}),
					),
					acceptanceCoverage: context.proposal.acceptanceCoverage.map(
						(entry) => ({...entry, workUnitIds: [first.id, second.id]}),
					),
					aggregateReviewRequirements: context.proposal.aggregateReviewRequirements.map(
						(entry) => ({...entry, workUnitIds: [first.id, second.id]}),
					),
				},
			}),
			/require explicit ordering/,
		);
	});
});
