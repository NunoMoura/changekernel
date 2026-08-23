import assert from "node:assert/strict";
import test from "node:test";

import {
	admitExternalCandidateCapture,
	assertExternalCandidateCapture,
	createExternalCandidateCapture,
} from "../../../src/project-server/admission/external-candidate.ts";

const digest = (character) => `sha256:${character.repeat(64)}`;
const git = (character) => character.repeat(40);

function capture(overrides = {}) {
	return createExternalCandidateCapture({
		captureId: "capture:01",
		actorId: "user:nuno",
		clientInstanceId: "external-agent:laptop",
		authenticationRef: "auth:pairing:external-agent",
		repositoryIdentity: digest("1"),
		sourceCommit: git("a"),
		sourceTree: git("b"),
		baseTree: git("c"),
		changedPaths: ["src/runtime/adapter.ts", "tests/runtime/adapter.test.mjs"],
		capturedAt: "2026-08-23T10:00:00.000Z",
		...overrides,
	});
}

function intent(overrides = {}) {
	return {
		changeRevisionId: digest("2"),
		workGraphDeltaId: digest("3"),
		workUnitId: "work-unit:runtime",
		workUnitDigest: digest("4"),
		expectedBaseTree: git("c"),
		allowedScopes: ["src/runtime", "tests/runtime"],
		expectedWorkStateDigest: digest("5"),
		...overrides,
	};
}

test("external Candidate admission preserves capture custody and admits only exact accepted intent", () => {
	const value = capture();
	assert.doesNotThrow(() => assertExternalCandidateCapture(value));
	const admission = admitExternalCandidateCapture({capture: value, intent: intent()});
	assert.equal(admission.disposition, "candidate_admission");
	assert.equal(admission.intentBinding.workUnitId, "work-unit:runtime");
	assert.equal("runReceiptDigest" in value, false);
});

test("external Candidate capture routes missing intent, stale base, and scope drift to Intake", () => {
	assert.deepEqual(
		admitExternalCandidateCapture({capture: capture()}).reasons,
		["accepted_intent_missing"],
	);
	const stale = admitExternalCandidateCapture({
		capture: capture({changedPaths: ["README.md"]}),
		intent: intent({expectedBaseTree: git("d")}),
	});
	assert.equal(stale.disposition, "change_intake");
	assert.deepEqual(stale.reasons, ["base_tree_mismatch", "path_out_of_scope:README.md"]);
});
