import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
	createSchedulingPolicy,
	createWorkerOffer,
} from "../../../src/changes/trace/scheduling.ts";
import {materializeProjectWorkState} from "../../../src/changes/trace/state.ts";
import {
	createProjectSchedulingPlan,
	createSchedulingOperationSequence,
	deriveReadyWorkUnits,
} from "../../../src/project-server/scheduling/scheduler.ts";
import {baseSnapshotFor, reduceBatch} from "../../helpers/change-trace-replay-v1.mjs";
import {authorityBinding, gitObject} from "../../helpers/change-trace-v1.mjs";
import {acceptedPlanningContext} from "../../helpers/native-planning.mjs";

function workerOffer(overrides = {}) {
	return createWorkerOffer({
		workerId: "worker-alpha",
		capabilityIds: ["typescript"],
		toolIds: ["pi-lens"],
		skillIds: [],
		custodyCapabilities: ["isolated_worktree"],
		consentIds: ["source-mutation"],
		privacyClasses: ["internal"],
		budgetClasses: ["standard"],
		isolationKinds: ["worktree"],
		maximumConcurrentAssignments: 2,
		validFrom: "2026-08-10T10:00:00.000Z",
		validUntil: "2026-08-10T12:00:00.000Z",
		...overrides,
	});
}

function schedulingPolicy(overrides = {}) {
	return createSchedulingPolicy({
		maximumAssignments: 2,
		leaseDurationMs: 60_000,
		allowedPrivacyClasses: ["internal"],
		allowedBudgetClasses: ["standard"],
		acceptedConsentIds: ["source-mutation"],
		allowedCustodyCapabilities: ["isolated_worktree"],
		isolationPreference: ["worktree"],
		workbenchRoot: "/tmp/codewiki-workbenches",
		...overrides,
	});
}

async function schedulingContext() {
	const context = await acceptedPlanningContext();
	const policy = schedulingPolicy();
	const offer = workerOffer();
	const observedAt = "2026-08-10T10:04:00.000Z";
	const plan = createProjectSchedulingPlan({
		state: context.state,
		workerOffers: [offer],
		policy,
		sourceBase: gitObject("2"),
		observedAt,
	});
	return {context, policy, offer, observedAt, plan};
}

describe("Project Server canonical readiness and scheduling", () => {
	it("derives ready Work Units only from accepted Work Graph and WorkState", async () => {
		const {context} = await schedulingContext();
		const ready = deriveReadyWorkUnits(context.state);
		assert.deepEqual(ready.map((entry) => entry.workUnit.id), [
			context.candidate.content.delta.workUnits[0].id,
		]);
		assert.equal(ready[0].workGraphDeltaId, context.candidate.content.delta.deltaId);
	});

	it("matches capabilities, custody, consent, privacy, budget, isolation, and capacity", async () => {
		const {context, policy, observedAt} = await schedulingContext();
		for (const offer of [
			workerOffer({consentIds: []}),
			workerOffer({privacyClasses: ["public"]}),
			workerOffer({budgetClasses: ["tiny"]}),
			workerOffer({custodyCapabilities: ["container"]}),
			workerOffer({capabilityIds: ["javascript"]}),
			workerOffer({validUntil: observedAt}),
		]) {
			const held = createProjectSchedulingPlan({
				state: context.state,
				workerOffers: [offer],
				policy,
				sourceBase: gitObject("2"),
				observedAt,
			});
			assert.equal(held.admissions.length, 0);
			assert.equal(held.holds[0].reason, "no_eligible_worker");
		}
	});

	it("atomically admits one exact Claim, Assignment, and isolated Workbench", async () => {
		const {context, policy, plan} = await schedulingContext();
		assert.equal(plan.admissions.length, 1);
		const admission = plan.admissions[0];
		assert.equal(admission.assignment.workbenchId, admission.workbench.workbenchId);
		assert.equal(admission.assignment.workerOfferId, admission.workerOffer.offerId);
		assert.match(admission.workbench.path, /^\/tmp\/codewiki-workbenches\//u);
		const sequence = createSchedulingOperationSequence({
			state: context.state,
			plan,
			policy,
			baseSnapshot: baseSnapshotFor(context.state),
			claimAuthority: authorityBinding(),
			assignmentAuthority: authorityBinding(),
			recordedAt: plan.observedAt,
		});
		assert.deepEqual(sequence.operations.map((operation) => operation.body.kind), [
			"work_unit_claim.acquired",
			"assignment.dispatched",
		]);
		const accepted = reduceBatch(context.state, sequence.operations, gitObject("e"));
		const change = accepted.changes.find((entry) => entry.changeId === context.changeId);
		assert.equal(change.workUnitClaims.length, 1);
		assert.equal(change.assignments.length, 1);
		assert.equal(change.assignments[0].assignmentDigest, admission.assignment.assignmentDigest);
		assert.equal(accepted.workGraph.workUnits[0].status, "assigned");
	});

	it("recovers after restart without duplicate Claims or Assignments", async () => {
		const {context, policy, offer, plan} = await schedulingContext();
		const sequence = createSchedulingOperationSequence({
			state: context.state,
			plan,
			policy,
			baseSnapshot: baseSnapshotFor(context.state),
			claimAuthority: authorityBinding(),
			assignmentAuthority: authorityBinding(),
			recordedAt: plan.observedAt,
		});
		const recovered = reduceBatch(context.state, sequence.operations, gitObject("e"));
		const restartPlan = createProjectSchedulingPlan({
			state: recovered,
			workerOffers: [offer],
			policy,
			sourceBase: gitObject("2"),
			observedAt: "2026-08-10T10:05:00.000Z",
		});
		assert.equal(deriveReadyWorkUnits(recovered).length, 0);
		assert.equal(restartPlan.admissions.length, 0);
	});

	it("rejects stale Claim and Assignment batches", async () => {
		const {context, policy, plan} = await schedulingContext();
		const sequence = createSchedulingOperationSequence({
			state: context.state,
			plan,
			policy,
			baseSnapshot: baseSnapshotFor(context.state),
			claimAuthority: authorityBinding(),
			assignmentAuthority: authorityBinding(),
			recordedAt: plan.observedAt,
		});
		const {workStateDigest: _digest, ...body} = context.state;
		const stale = materializeProjectWorkState({
			...body,
			workGraph: {
				...context.state.workGraph,
				graphDigest: `sha256:${"f".repeat(64)}`,
			},
		});
		assert.throws(
			() => reduceBatch(stale, sequence.operations, gitObject("f")),
			/Scheduling Claim compare-and-swap failed|stale/u,
		);
		assert.throws(
			() => reduceBatch(context.state, [sequence.operations[0]], gitObject("f")),
			/requires exactly one atomic Assignment/,
		);
	});
});
