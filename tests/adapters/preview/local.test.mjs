import assert from "node:assert/strict";
import test from "node:test";

import {
	createLocalPreviewAdapter,
	LOCAL_PREVIEW_ADAPTER_PROTOCOL,
} from "../../../src/adapters/preview/local.ts";
import {gitOid} from "../../../src/kernel/identity/git.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {
	createPreviewSubject,
	previewObservationEligibleForGate,
	previewRequestDigest,
} from "../../../src/ports/preview.ts";

const digest = (c) => `sha256:${c.repeat(64)}`;
const oid = (c) => gitOid("sha1", c.repeat(40)).value;

function subjectFixture(overrides = {}) {
	const subject = createPreviewSubject({
		capability: "preview.verify",
		repositoryId: "cw:repository:test",
		changeId: "CHG-preview-test",
		workId: null,
		projectCommit: oid("1"),
		projectTree: oid("2"),
		changeTip: oid("3"),
		artifactCommit: null,
		artifactTree: null,
		scope: ["src/**"],
		profileId: "cw:profile:test-runner",
		environmentDigest: digest("a"),
		policyDigest: digest("b"),
		generation: 1,
		producerId: "cw:producer:worker-1",
		...overrides,
	});
	assert.equal(subject.ok, true);
	return subject.value;
}

function requestFixture(subject) {
	const draft = {
		authorizationId: "cw:auth:preview-test",
		requestDigest: digest("0"),
		subject,
	};
	const reqDigest = previewRequestDigest(draft);
	assert.equal(reqDigest.ok, true);
	return {...draft, requestDigest: reqDigest.value};
}

const mockRunner = async (command, options) => {
	assert.ok(options.timeoutMs > 0);
	assert.ok(options.maximumOutputBytes > 0);
	if (command[0] === "fail") {
		return {stdout: "", stderr: "command failed", exitCode: 1};
	}
	if (command[0] === "throw") {
		throw new Error("process crashed");
	}
	return {stdout: "preview verified ok", stderr: "", exitCode: 0};
};

test("local Preview adapter qualifies preview.verify observation for Gate eligibility", async () => {
	const adapter = createLocalPreviewAdapter({
		profiles: [
			{profileId: "cw:profile:test-runner", command: ["npm", "run", "test"]},
		],
		runner: mockRunner,
		observerProducerId: "cw:producer:independent-verifier",
	});
	assert.equal(adapter.ok, true);
	assert.equal(adapter.value.adapterProtocol, LOCAL_PREVIEW_ADAPTER_PROTOCOL);

	const subject = subjectFixture();
	const request = requestFixture(subject);
	const outcome = await adapter.value.observe(request);
	assert.equal(outcome.ok, true);
	assert.equal(outcome.value.status, "passed");
	assert.equal(outcome.value.capability, "preview.verify");
	assert.notEqual(outcome.value.producerId, subject.producerId);
	assert.equal(previewObservationEligibleForGate(subject, outcome.value), true);
});

test("local Preview adapter marks preview.work as producer context ineligible for Gate", async () => {
	const adapter = createLocalPreviewAdapter({
		profiles: [
			{profileId: "cw:profile:test-runner", command: ["npm", "run", "test"]},
		],
		runner: mockRunner,
	});
	assert.equal(adapter.ok, true);

	const subject = subjectFixture({
		capability: "preview.work",
		workId: "cw:work:unit-1",
	});
	const request = requestFixture(subject);
	const outcome = await adapter.value.observe(request);
	assert.equal(outcome.ok, true);
	assert.equal(outcome.value.status, "passed");
	assert.equal(outcome.value.capability, "preview.work");
	assert.equal(previewObservationEligibleForGate(subject, outcome.value), false);
});

test("local Preview adapter rejects unknown profile and stale generation", async () => {
	let currentGeneration = 2;
	const adapter = createLocalPreviewAdapter({
		profiles: [
			{profileId: "cw:profile:test-runner", command: ["npm", "run", "test"]},
		],
		runner: async () => {
			currentGeneration = 3;
			return {stdout: "ok", stderr: "", exitCode: 0};
		},
		defaultLeaseTtlMs: 60_000,
	});
	assert.equal(adapter.ok, true);

	const unknownProfileSubject = subjectFixture({profileId: "cw:profile:nonexistent"});
	const unknownReq = requestFixture(unknownProfileSubject);
	const unknownOutcome = await adapter.value.observe(unknownReq);
	assert.equal(unknownOutcome.ok, false);
	assert.equal(unknownOutcome.error.code, "environment_unavailable");
});

test("local Preview adapter reports process failure and crash correctly", async () => {
	const adapter = createLocalPreviewAdapter({
		profiles: [
			{profileId: "cw:profile:failing", command: ["fail"]},
			{profileId: "cw:profile:throwing", command: ["throw"]},
		],
		runner: mockRunner,
	});
	assert.equal(adapter.ok, true);

	const failSubject = subjectFixture({profileId: "cw:profile:failing"});
	const failOutcome = await adapter.value.observe(requestFixture(failSubject));
	assert.equal(failOutcome.ok, true);
	assert.equal(failOutcome.value.status, "failed");
	assert.equal(previewObservationEligibleForGate(failSubject, failOutcome.value), false);

	const throwSubject = subjectFixture({profileId: "cw:profile:throwing"});
	const throwOutcome = await adapter.value.observe(requestFixture(throwSubject));
	assert.equal(throwOutcome.ok, false);
	assert.equal(throwOutcome.error.code, "stopped");
});
