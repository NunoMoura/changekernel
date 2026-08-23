import assert from "node:assert/strict";
import test from "node:test";

import {
	assertHarnessInteractionBinding,
	assertHarnessObserverProjection,
	createHarnessCandidateSubmission,
	createHarnessInteractionBinding,
	createHarnessObserverProjection,
} from "../../../src/project-server/harness/contracts.ts";

const digest = (character) => `sha256:${character.repeat(64)}`;

function projection(overrides = {}) {
	return createHarnessObserverProjection({
		changeRevisionId: digest("1"),
		workStateDigest: digest("2"),
		observedStage: "implementation",
		workUnits: [
			{workUnitId: "unit:a", status: "passed"},
			{workUnitId: "unit:b", status: "running"},
			{workUnitId: "unit:c", status: "failed", reportRef: "report:unit-c", failureCode: "test.failed"},
		],
		review: {status: "not-ready"},
		...overrides,
	});
}

test("Harness observer coalesces progress and exposes only exceptional report references", () => {
	const value = projection();
	assert.deepEqual(value.workUnits, {
		queued: 0,
		running: 1,
		passed: 1,
		failed: 1,
		stopped: 0,
		conflicted: 0,
	});
	assert.deepEqual(value.reportRefs, ["report:unit-c"]);
	assert.equal(value.exceptionalWorkUnits.length, 1);
	assert.doesNotThrow(() => assertHarnessObserverProjection(value));
	assert.throws(
		() => projection({workUnits: [{workUnitId: "unit:a", status: "passed", reportRef: "report:passing"}]}),
		/must remain coalesced/,
	);
});

test("Harness receives exact Review Results only on typed Decision or Planning return", () => {
	assert.throws(
		() => projection({
			review: {
				status: "failed",
				routeBack: "implementation",
				relevantResultRefs: ["result:full"],
			},
		}),
		/only when routed/,
	);
	const value = projection({
		observedStage: "review",
		review: {
			status: "failed",
			routeBack: "planning",
			gateReportRef: "gate:review",
			relevantResultRefs: ["result:decomposition"],
		},
	});
	assert.deepEqual(value.reportRefs, ["gate:review", "report:unit-c", "result:decomposition"]);
});

test("Harness continuity and Candidate submission bind exact role-scoped Run evidence", () => {
	const observerProjection = projection();
	const interaction = createHarnessInteractionBinding({
		interactionId: "interaction:01",
		producerLoop: "planning",
		sessionId: "session:planning:01",
		sessionHead: 1,
		sessionHeadDigest: digest("3"),
		contextSnapshotDigest: digest("4"),
		observerProjection,
	});
	assert.equal(interaction.continuityKey, "planning:interaction:01");
	assert.doesNotThrow(() => assertHarnessInteractionBinding(interaction));
	const submission = createHarnessCandidateSubmission({
		interaction,
		producerLoop: "planning",
		candidateDigest: digest("5"),
		runRequestDigest: digest("6"),
		runReceiptDigest: digest("7"),
		expectedWorkStateDigest: digest("8"),
	});
	assert.match(submission.submissionDigest, /^sha256:/);
	assert.throws(
		() => createHarnessCandidateSubmission({
			interaction,
			producerLoop: "decision",
			candidateDigest: digest("5"),
			runRequestDigest: digest("6"),
			runReceiptDigest: digest("7"),
			expectedWorkStateDigest: digest("8"),
		}),
		/does not match/,
	);
});
