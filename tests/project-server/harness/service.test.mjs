import assert from "node:assert/strict";
import test from "node:test";

import {
	createHarnessInteractionBinding,
	createHarnessObserverProjection,
} from "../../../src/project-server/harness/contracts.ts";
import {runHarnessProducerTurn} from "../../../src/project-server/harness/service.ts";
import {
	completedReceipt,
	digest,
	rawLogReference,
	runRequest,
} from "../../runtime/helpers/run-evidence.mjs";

function interaction(contextSnapshotDigest = digest("stage-context")) {
	return createHarnessInteractionBinding({
		interactionId: "interaction:01",
		producerLoop: "decision",
		sessionId: "interaction:01",
		sessionHead: 0,
		sessionHeadDigest: null,
		contextSnapshotDigest,
		observerProjection: createHarnessObserverProjection({
			changeRevisionId: digest("change"),
			workStateDigest: digest("work-state"),
			observedStage: "decision",
			workUnits: [],
			review: {status: "not-ready"},
		}),
	});
}

test("Harness turn submits unchanged Candidate only after completed exact role-scoped Run", async () => {
	const request = runRequest("run-harness", "interaction:01");
	const receipt = completedReceipt(request, digest("ledger"), rawLogReference(request, Buffer.from("events")));
	const candidate = Object.freeze({kind: "decision", value: "exact"});
	let submitted;
	const result = await runHarnessProducerTurn({
		interaction: interaction(),
		request,
		expectedWorkStateDigest: digest("expected-work-state"),
		runtime: {async run() { return {receipt, candidateDigest: digest("output"), candidate}; }},
		projectServer: {async submit(value) { submitted = value; return {accepted: true}; }},
	});
	assert.strictEqual(submitted.candidate, candidate);
	assert.equal(submitted.loop, "decision");
	assert.equal(result.submission.runReceiptDigest, receipt.receiptDigest);
	assert.equal(result.result.accepted, true);
});

test("Harness turn rejects wrong role, context, Session, and incomplete output before submission", async () => {
	const request = runRequest("run-harness", "interaction:01");
	let submitted = false;
	await assert.rejects(
		runHarnessProducerTurn({
			interaction: interaction(digest("wrong")),
			request,
			expectedWorkStateDigest: digest("state"),
			runtime: {async run() { throw new Error("not reached"); }},
			projectServer: {async submit() { submitted = true; }},
		}),
		/context does not match/,
	);
	assert.equal(submitted, false);
});
