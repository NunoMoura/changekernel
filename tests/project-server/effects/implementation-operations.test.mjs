import assert from "node:assert/strict";
import test from "node:test";

import {createImplementationStagePolicy} from "../../../src/loops/implementation/policy.ts";
import {createWorkUnitCandidate} from "../../../src/loops/implementation/work-unit-candidate.ts";
import {createImplementationOperationSequence} from "../../../src/project-server/effects/implementation-operations.ts";
import {createImplementationStageGate} from "../../../src/project-server/lifecycle/implementation-gate.ts";
import {baseSnapshotFor, reduceBatch} from "../../helpers/change-trace-replay-v1.mjs";
import {authorityBinding, gitObject} from "../../helpers/change-trace-v1.mjs";
import {checkExecutor, checkSnapshot, packagedCheck} from "../../helpers/checks.mjs";
import {
	canonicalImplementationFixture,
	implementationRunReceipt,
	implementationRunRequest,
} from "../../helpers/canonical-implementation.mjs";

test("Project Server records exact Work Unit Candidate and shared Gate policy separately from integration", async () => {
	const fixture = await canonicalImplementationFixture();
	const request = implementationRunRequest(fixture);
	const receipt = implementationRunReceipt(request);
	const candidate = createWorkUnitCandidate({
		state: fixture.state,
		workUnitId: fixture.workUnit.id,
		assignment: fixture.assignment,
		workbench: fixture.workbench,
		runs: [{request, receipt}],
		changedPaths: ["src/planning"],
	});
	const policy = createImplementationStagePolicy(
		checkSnapshot(
			[packagedCheck({stage: "implementation", id: "unit-quality"})],
			{stage: "implementation"},
		),
	);
	const gate = await createImplementationStageGate({
		policy,
		executors: [checkExecutor()],
	}).run({candidate});
	const sequence = createImplementationOperationSequence({
		state: fixture.state,
		candidate,
		policy,
		evidenceRecords: [],
		report: gate.report,
		baseSnapshot: baseSnapshotFor(fixture.state),
		authorityBinding: authorityBinding(),
		recordedAt: "2026-08-10T10:04:10.000Z",
	});
	assert.deepEqual(
		sequence.operations.map((operation) => operation.body.kind),
		[
			"loop.attempt_started",
			"implementation.candidate_recorded",
			"loop.exit_policy_recorded",
			"check.result_recorded",
			"loop.exit_report_recorded",
			"runtime.route_recorded",
			"loop.attempt_ended",
		],
	);
	const accepted = reduceBatch(fixture.state, sequence.operations, gitObject("f"));
	const change = accepted.changes.find((entry) => entry.changeId === fixture.changeId);
	const attempt = change.loopAttempts.find(
		(entry) => entry.operationId === sequence.attemptOperationId,
	);
	assert.equal(attempt.loop, "implementation");
	assert.equal(attempt.status, "passed");
	assert.equal(attempt.currentCandidateId, candidate.id);
	assert.equal(attempt.exitPolicyOperationId !== null, true);
	assert.equal(attempt.exitReportOperationId !== null, true);
	assert.equal(change.integrationAttempts.length, 0);
});
