import assert from "node:assert/strict";
import test from "node:test";

import {deriveWorkUnitCandidateLifecycle} from "../../../src/loops/implementation/status.ts";
import {
	createImplementationAggregateFreeze,
	createPrivateIntegrationAdmission,
	privateChangeIntegrationRef,
} from "../../../src/project-server/integration/private-lineage.ts";
import {sha256Digest} from "../../../src/utils/canonical-json.ts";
import {baseSnapshotFor, reduceBatch} from "../../helpers/change-trace-replay-v1.mjs";
import {authorityBinding, gitObject} from "../../helpers/change-trace-v1.mjs";
import {acceptedImplementationCandidateContext} from "../../helpers/canonical-implementation.mjs";
import {nativeDecisionRevision} from "../../helpers/native-decision.mjs";
import {planningProposal} from "../../helpers/native-planning.mjs";

function observation(context, overrides = {}) {
	return {
		expectedLineageDigest: "absent",
		workGraphDigest: context.state.workGraph.graphDigest,
		candidateTreeDigest: context.candidate.content.resultTreeDigest,
		changedPaths: context.candidate.content.changedPaths,
		workbenchDigest: context.candidate.content.workbenchDigest,
		custodyReceiptDigests: context.candidate.content.runAttempts.map(
			(entry) => entry.receiptDigest,
		),
		baseCommit: context.candidate.content.sourceBase,
		status: "integrated",
		resultCommit: gitObject("7"),
		resultTreeDigest: sha256Digest("private-integrated-tree"),
		conflictRefs: [],
		recordedAt: "2026-08-10T10:05:00.000Z",
		...overrides,
	};
}

function admit(context, overrides = {}) {
	return createPrivateIntegrationAdmission({
		state: context.state,
		candidate: context.candidate,
		gateReport: context.gate.report,
		observation: observation(context, overrides),
		baseSnapshot: baseSnapshotFor(context.state),
		authorityBinding: authorityBinding(),
	});
}

test("Project Server admits exact passing Candidate into content-addressed private Change lineage", async () => {
	const context = await acceptedImplementationCandidateContext();
	const admission = admit(context);
	assert.equal(admission.operation.body.kind, "integration.candidate_admitted");
	assert.equal(admission.receipt.candidateId, context.candidate.id);
	assert.equal(admission.receipt.gateReportDigest, context.gate.report.reportDigest);
	assert.equal(admission.lineage.targetRef, privateChangeIntegrationRef(context.changeId));
	assert.equal(admission.lineage.integratedWorkUnits.length, 1);
	assert.equal(admission.lineage.headCommit, gitObject("7"));
	assert.equal(
		deriveWorkUnitCandidateLifecycle({
			candidate: context.candidate,
			gateReport: context.gate.report,
			privateLineage: admission.lineage,
		}).status,
		"integrated",
	);
	const accepted = reduceBatch(context.state, [admission.operation], gitObject("8"));
	const change = accepted.changes.find((entry) => entry.changeId === context.changeId);
	assert.equal(change.privateIntegrationLineage.lineageDigest, admission.lineage.lineageDigest);
	const replayed = reduceBatch(context.state, [admission.operation], gitObject("8"));
	assert.deepEqual(
		replayed.changes.find((entry) => entry.changeId === context.changeId).privateIntegrationLineage,
		change.privateIntegrationLineage,
	);
	assert.equal(
		change.operations.some((operation) => operation.body.kind === "source.branch_merge_recorded"),
		false,
	);
	assert.throws(
		() => admit({...context, state: accepted}),
		/expected-head CAS failed|already integrated/,
	);
});

test("private integration rejects byte, custody, Work Graph, and lineage-head drift", async () => {
	const context = await acceptedImplementationCandidateContext();
	assert.throws(
		() => admit(context, {changedPaths: ["src/changed-after-gate.ts"]}),
		/observed changed bytes differ/,
	);
	assert.throws(
		() => admit(context, {custodyReceiptDigests: [sha256Digest("wrong-custody")]}),
		/exact producing custody receipts/,
	);
	assert.throws(
		() => admit(context, {workGraphDigest: sha256Digest("stale-graph")}),
		/Work Graph observation is stale/,
	);
	assert.throws(
		() => admit(context, {expectedLineageDigest: sha256Digest("stale-lineage")}),
		/expected-head CAS failed/,
	);
	assert.throws(
		() => admit(context, {resultCommit: "not-a-git-object"}),
		/must be a lowercase Git object ID/,
	);
});

test("conflict receipt advances lineage history without claiming integrated bytes", async () => {
	const context = await acceptedImplementationCandidateContext();
	const conflict = admit(context, {
		status: "conflicted",
		resultCommit: null,
		resultTreeDigest: null,
		conflictRefs: ["path:src/planning"],
	});
	assert.equal(conflict.lineage.receipts.length, 1);
	assert.equal(conflict.lineage.integratedWorkUnits.length, 0);
	assert.equal(conflict.lineage.headCommit, context.candidate.content.sourceBase);
	assert.equal(
		deriveWorkUnitCandidateLifecycle({
			candidate: context.candidate,
			gateReport: context.gate.report,
			privateLineage: conflict.lineage,
		}).status,
		"conflicted",
	);
	const accepted = reduceBatch(context.state, [conflict.operation], gitObject("8"));
	assert.throws(
		() =>
			createImplementationAggregateFreeze({
				state: accepted,
				changeId: context.changeId,
				expectedLineageDigest: conflict.lineage.lineageDigest,
				frozenAt: "2026-08-10T10:06:00.000Z",
				baseSnapshot: baseSnapshotFor(accepted),
				authorityBinding: authorityBinding(),
			}),
		/requires integrated result tree/,
	);
});

test("one passing unit cannot freeze a Change that requires two integrated units", async () => {
	const changeId = "CHG-two-unit-integration";
	const revision = nativeDecisionRevision({
		changeId,
		acceptanceRequirements: [
			{id: "REQ-plan", statement: "Both exact units realize accepted Change."},
		],
	});
	const baseProposal = planningProposal(revision, changeId, {unitId: "WU-first"});
	const first = baseProposal.workUnits[0];
	const second = {
		...first,
		id: "WU-second",
		title: "Implement second accepted slice",
		pathScopes: ["src/second"],
	};
	const unitIds = [first.id, second.id];
	const proposal = {
		...baseProposal,
		workUnits: [first, second],
		knowledgeEffectCoverage: baseProposal.knowledgeEffectCoverage.map((entry) => ({
			...entry,
			workUnitIds: unitIds,
		})),
		unchangedKnowledgeCoverage: baseProposal.unchangedKnowledgeCoverage.map((entry) => ({
			...entry,
			workUnitIds: unitIds,
		})),
		acceptanceCoverage: baseProposal.acceptanceCoverage.map((entry) => ({
			...entry,
			workUnitIds: unitIds,
		})),
		aggregateReviewRequirements: baseProposal.aggregateReviewRequirements.map((entry) => ({
			...entry,
			workUnitIds: unitIds,
		})),
	};
	const firstContext = await acceptedImplementationCandidateContext({
		changeId,
		revision,
		proposal,
		maximumAssignments: 1,
	});
	const firstAdmission = admit(firstContext);
	const firstIntegrated = reduceBatch(firstContext.state, [firstAdmission.operation], gitObject("8"));
	assert.throws(
		() =>
			createImplementationAggregateFreeze({
				state: firstIntegrated,
				changeId,
				expectedLineageDigest: firstAdmission.lineage.lineageDigest,
				frozenAt: "2026-08-10T10:06:00.000Z",
				baseSnapshot: baseSnapshotFor(firstIntegrated),
				authorityBinding: authorityBinding(),
			}),
		/every required Work Unit exactly once/,
	);
});

test("aggregate freezes only exact complete integrated Change lineage", async () => {
	const context = await acceptedImplementationCandidateContext();
	assert.throws(
		() =>
			createImplementationAggregateFreeze({
				state: context.state,
				changeId: context.changeId,
				expectedLineageDigest: sha256Digest("missing-lineage"),
				frozenAt: "2026-08-10T10:06:00.000Z",
				baseSnapshot: baseSnapshotFor(context.state),
				authorityBinding: authorityBinding(),
			}),
		/private lineage head is stale/,
	);
	const admission = admit(context);
	const integrated = reduceBatch(context.state, [admission.operation], gitObject("8"));
	const freeze = createImplementationAggregateFreeze({
		state: integrated,
		changeId: context.changeId,
		expectedLineageDigest: admission.lineage.lineageDigest,
		frozenAt: "2026-08-10T10:06:00.000Z",
		baseSnapshot: baseSnapshotFor(integrated),
		authorityBinding: authorityBinding(),
	});
	assert.deepEqual(freeze.aggregate.requiredWorkUnitIds, [context.workUnit.id]);
	assert.deepEqual(freeze.aggregate.contributingCandidateIds, [context.candidate.id]);
	assert.deepEqual(
		freeze.aggregate.acceptanceRequirementIds,
		context.candidate.content.acceptanceSlice.acceptanceRequirementIds,
	);
	const complete = reduceBatch(integrated, [freeze.operation], gitObject("9"));
	const change = complete.changes.find((entry) => entry.changeId === context.changeId);
	assert.equal(change.implementationAggregate.aggregateDigest, freeze.aggregate.aggregateDigest);
	assert.equal(
		change.operations.some((operation) => operation.body.kind === "source.branch_merge_recorded"),
		false,
	);
	assert.throws(
		() =>
			createPrivateIntegrationAdmission({
				state: complete,
				candidate: context.candidate,
				gateReport: context.gate.report,
				observation: observation(context, {
					expectedLineageDigest: admission.lineage.lineageDigest,
					baseCommit: admission.lineage.headCommit,
				}),
				baseSnapshot: baseSnapshotFor(complete),
				authorityBinding: authorityBinding(),
			}),
		/already frozen|already integrated/,
	);
});
