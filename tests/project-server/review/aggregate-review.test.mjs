import assert from "node:assert/strict";
import test from "node:test";

import {createGateReport} from "../../../src/checks/results.ts";
import {reviewSubjectFromAttempt} from "../../../src/loops/review/contracts.ts";
import {
	createDeliveryAuthority,
	createGuardedDeliveryOperation,
} from "../../../src/project-server/delivery/guarded-delivery.ts";
import {createReviewOperationSequence} from "../../../src/project-server/effects/gate-operations.ts";
import {createPrivateIntegrationAdmission} from "../../../src/project-server/integration/private-lineage.ts";
import {
	createReviewGate,
	deriveReviewLifecycleTransition,
} from "../../../src/project-server/lifecycle/gates.ts";
import {
	assertCurrentAggregateReviewAttempt,
	createAggregateReviewAttempt,
} from "../../../src/project-server/review/aggregate-review.ts";
import {canonicalJsonDigest} from "../../../src/utils/canonical-json.ts";
import {
	baseSnapshotFor,
	reduceBatch,
} from "../../helpers/change-trace-replay-v1.mjs";
import {authorityBinding, gitObject} from "../../helpers/change-trace-v1.mjs";
import {
	checkExecutor,
	checkOutput,
	checkSnapshot,
	packagedCheck,
} from "../../helpers/checks.mjs";
import {frozenImplementationContext} from "../../helpers/frozen-implementation.mjs";

function attemptFor(context, snapshot) {
	return createAggregateReviewAttempt({
		state: context.state,
		changeId: context.changeId,
		integratedTree: gitObject("e"),
		targetBranch: "refs/heads/main",
		producerSessionId: `session:review:${context.changeId}`,
		producingRunId: `run:review:${context.changeId}`,
		producerRunReceiptDigest: canonicalJsonDigest("review-producer"),
		projectContextSnapshotDigest: canonicalJsonDigest("review-material"),
		checkPackSnapshotDigest: snapshot.checkPackDigest,
		providerReceiptDigests: [],
		evidenceRecordDigests: [],
	});
}

function passingReview(context) {
	const snapshot = checkSnapshot([], {stage: "review", packs: []});
	const attempt = attemptFor(context, snapshot);
	const report = createGateReport({
		snapshot,
		subjectDigest: reviewSubjectFromAttempt(attempt).digest,
		results: [],
		executions: [],
	});
	const transition = deriveReviewLifecycleTransition(attempt, report);
	const sequence = createReviewOperationSequence({
		state: context.state,
		changeId: context.changeId,
		baseSnapshot: baseSnapshotFor(context.state),
		authorityBinding: authorityBinding(),
		recordedAt: "2026-08-20T12:00:00.000Z",
		attempt,
		packSnapshot: snapshot,
		evidenceRecords: [],
		report,
		transition,
	});
	const state = reduceBatch(context.state, sequence.operations, gitObject("a"));
	return {snapshot, attempt, report, transition, sequence, state};
}

test("aggregate Review subject binds exact Change, Knowledge, Planning, Work Units, Candidates, Evidence, Results, and lineage", async () => {
	const context = await frozenImplementationContext();
	const snapshot = checkSnapshot([], {stage: "review", packs: []});
	const attempt = attemptFor(context, snapshot);
	assert.equal(attempt.changeRevisionId, context.freeze.aggregate.changeRevisionId);
	assert.equal(attempt.aggregateDigest, context.freeze.aggregate.aggregateDigest);
	assert.equal(attempt.lineageDigest, context.freeze.aggregate.lineageDigest);
	assert.deepEqual(attempt.workUnitIds, context.freeze.aggregate.requiredWorkUnitIds);
	assert.deepEqual(attempt.candidateIds, context.freeze.aggregate.contributingCandidateIds);
	assert.equal(attempt.implementationGateReportDigests.length, 1);
	assert.equal(attempt.continuityKey, `review:${context.changeId}:${attempt.lineageDigest}`);
	assert.doesNotThrow(() => assertCurrentAggregateReviewAttempt(context.state, attempt));
	assert.throws(
		() => assertCurrentAggregateReviewAttempt(
			context.state,
			{...attempt, aggregateDigest: canonicalJsonDigest("stale-aggregate")},
		),
		/stale|identity/i,
	);
});

test("passing aggregate Review authorizes only exact target-head-CAS delivery", async () => {
	const context = await frozenImplementationContext();
	const review = passingReview(context);
	const deliveryAuthority = createDeliveryAuthority({
		actor: "runtime-main",
		authorityRef: "grant:deliver-main",
		targetRef: review.attempt.targetBranch,
		reviewAttemptDigest: review.attempt.attemptDigest,
		gateReportDigest: review.report.reportDigest,
		expectedTargetHead: review.attempt.targetBaseCommit,
	});
	const plan = createGuardedDeliveryOperation({
		state: review.state,
		changeId: context.changeId,
		baseSnapshot: baseSnapshotFor(review.state),
		authorityBinding: authorityBinding(),
		recordedAt: "2026-08-20T12:01:00.000Z",
		attempt: review.attempt,
		report: review.report,
		transition: review.transition,
		deliveryAuthority,
	});
	const delivered = reduceBatch(review.state, [plan.operation], gitObject("b"));
	assert.equal(
		delivered.changes[0].delivery.deliveredCommit,
		review.attempt.integratedHead,
	);
	assert.equal(delivered.changes[0].delivery.expectedTargetHead, review.attempt.targetBaseCommit);
	const staleAuthority = createDeliveryAuthority({
		...deliveryAuthority,
		expectedTargetHead: gitObject("c"),
	});
	assert.throws(
		() => createGuardedDeliveryOperation({
			state: review.state,
			changeId: context.changeId,
			baseSnapshot: baseSnapshotFor(review.state),
			authorityBinding: authorityBinding(),
			recordedAt: "2026-08-20T12:01:00.000Z",
			attempt: review.attempt,
			report: review.report,
			transition: review.transition,
			deliveryAuthority: staleAuthority,
		}),
		/does not bind exact current Review/,
	);
});

test("unit-defect Review route reopens only affected private integration", async () => {
	const context = await frozenImplementationContext();
	const check = packagedCheck({stage: "review", definition: {id: "unit-integrity"}});
	const snapshot = checkSnapshot([check], {stage: "review"});
	const attempt = attemptFor(context, snapshot);
	const run = await createReviewGate({
		packSnapshot: snapshot,
		executors: [
			checkExecutor({
				execute: (execution) => checkOutput(execution.invocation, {
					measurement: {kind: "binary", value: false},
					summary: "Work Unit defect.",
					details: [{message: "Repair affected Work Unit."}],
				}),
			}),
		],
		classifyFailure: (_attempt, _result) => ({
			owner: "implementation",
			affectedWorkUnitIds: [context.candidate.content.workUnitId],
		}),
	}).run({attempt, evidence: [], providerReceipts: []});
	const sequence = createReviewOperationSequence({
		state: context.state,
		changeId: context.changeId,
		baseSnapshot: baseSnapshotFor(context.state),
		authorityBinding: authorityBinding(),
		recordedAt: "2026-08-20T12:02:00.000Z",
		attempt,
		packSnapshot: snapshot,
		evidenceRecords: [],
		report: run.report,
		transition: run.transition,
	});
	const routed = reduceBatch(context.state, sequence.operations, gitObject("c"));
	const lineage = routed.changes[0].privateIntegrationLineage;
	const replacement = createPrivateIntegrationAdmission({
		state: routed,
		candidate: context.candidate,
		gateReport: context.gate.report,
		observation: {
			expectedLineageDigest: lineage.lineageDigest,
			workGraphDigest: routed.workGraph.graphDigest,
			candidateTreeDigest: context.candidate.content.resultTreeDigest,
			changedPaths: context.candidate.content.changedPaths,
			workbenchDigest: context.candidate.content.workbenchDigest,
			custodyReceiptDigests: context.candidate.content.runAttempts.map(
				(entry) => entry.receiptDigest,
			),
			baseCommit: lineage.headCommit,
			status: "integrated",
			resultCommit: gitObject("d"),
			resultTreeDigest: canonicalJsonDigest("replacement-tree"),
			conflictRefs: [],
			recordedAt: "2026-08-20T12:03:00.000Z",
		},
		baseSnapshot: baseSnapshotFor(routed),
		authorityBinding: authorityBinding(),
	});
	assert.equal(replacement.lineage.integratedWorkUnits.length, 1);
	assert.equal(replacement.lineage.headCommit, gitObject("d"));
	assert.equal(replacement.lineage.receipts.length, 2);
});

test("typed failed Review routing invalidates aggregate delivery authority", async () => {
	const context = await frozenImplementationContext();
	const check = packagedCheck({stage: "review", definition: {id: "meaning-integrity"}});
	const snapshot = checkSnapshot([check], {stage: "review"});
	const attempt = attemptFor(context, snapshot);
	const run = await createReviewGate({
		packSnapshot: snapshot,
		executors: [
			checkExecutor({
				execute: (execution) => checkOutput(execution.invocation, {
					measurement: {kind: "binary", value: false},
					summary: "Accepted meaning changed.",
					details: [{message: "Return to Decision."}],
				}),
			}),
		],
		classifyFailure: () => ({owner: "decision", affectedWorkUnitIds: []}),
	}).run({attempt, evidence: [], providerReceipts: []});
	assert.equal(run.transition.target, "decision");
	const sequence = createReviewOperationSequence({
		state: context.state,
		changeId: context.changeId,
		baseSnapshot: baseSnapshotFor(context.state),
		authorityBinding: authorityBinding(),
		recordedAt: "2026-08-20T12:02:00.000Z",
		attempt,
		packSnapshot: snapshot,
		evidenceRecords: [],
		report: run.report,
		transition: run.transition,
	});
	const routed = reduceBatch(context.state, sequence.operations, gitObject("c"));
	assert.equal(routed.changes[0].implementationAggregate, null);
	assert.throws(
		() => assertCurrentAggregateReviewAttempt(routed, attempt),
		/requires frozen Implementation/,
	);
});
