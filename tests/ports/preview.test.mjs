import assert from "node:assert/strict";
import test from "node:test";
import {createEvidenceReference} from "../../src/kernel/evidence/reference.ts";
import {
	createPreviewObservation,
	createPreviewSubject,
	decodePreviewObservation,
	decodePreviewSubject,
	previewObservationEligibleForGate,
	previewRequestDigest,
	PREVIEW_PORT_PROTOCOL,
} from "../../src/ports/preview.ts";

const digest = (character) => `sha256:${character.repeat(64)}`;
const oid = (character) => ({algorithm: "sha1", hex: character.repeat(40)});

function subject(capability = "preview.verify", overrides = {}) {
	const result = createPreviewSubject({
		capability,
		repositoryId: "cw:repository:test",
		changeId: "CHG-test-preview",
		workId: "cw:work:test",
		projectCommit: oid("1"),
		projectTree: oid("2"),
		changeTip: oid("3"),
		artifactCommit: oid("4"),
		artifactTree: oid("5"),
		scope: ["frontend"],
		profileId: "cw:preview-profile:browser",
		environmentDigest: digest("a"),
		policyDigest: digest("b"),
		generation: 1,
		producerId: "cw:actor:producer",
		...overrides,
	});
	assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
	return result.value;
}

function observation(preview, overrides = {}) {
	const producerId = overrides.producerId ?? "cw:actor:independent-observer";
	const outputDigest = overrides.outputDigest ?? digest("c");
	const evidence = createEvidenceReference({
		evidenceId: "cw:evidence:preview",
		evidenceDigest: outputDigest,
		schema: {id: "codewiki.preview-evidence", version: "1.0.0"},
		mediaType: "application/json",
		subjectDigest: preview.subjectDigest,
		subjectOids: [preview.projectCommit, preview.projectTree, preview.changeTip, preview.artifactCommit, preview.artifactTree]
			.filter(Boolean)
			.sort((left, right) => left.hex.localeCompare(right.hex)),
		materialDigests: [],
		producerId,
		method: "codewiki.method:preview-observation",
		receiptDigest: digest("e"),
		authority: "verified",
		coverage: "complete",
		freshness: "current",
		capturePolicy: "full_revision",
		retentionPolicy: "pinned",
		limitations: [],
	});
	assert.equal(evidence.ok, true);
	const result = createPreviewObservation({
		previewSubjectDigest: preview.subjectDigest,
		capability: preview.capability,
		producerId,
		outputDigest,
		evidence: evidence.value,
		receiptDigest: evidence.value.receiptDigest,
		status: "passed",
		...overrides,
	});
	assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
	return result.value;
}

test("Preview port has one frozen host-neutral protocol identity", () => {
	assert.deepEqual(PREVIEW_PORT_PROTOCOL, {
		id: "codewiki.port.preview",
		version: "1.0.0",
	});
	assert.ok(Object.isFrozen(PREVIEW_PORT_PROTOCOL));
	assert.deepEqual(Object.keys(PREVIEW_PORT_PROTOCOL).sort(), ["id", "version"]);
});

test("Preview request digest binds authorization and exact subject", () => {
	const request = {authorizationId: "cw:authorization:preview", requestDigest: digest("0"), subject: subject()};
	const first = previewRequestDigest(request);
	const second = previewRequestDigest({...request, requestDigest: digest("f")});
	assert.equal(first.ok, true);
	assert.equal(second.ok, true);
	assert.equal(first.value, second.value);
	assert.notEqual(previewRequestDigest({...request, authorizationId: "cw:authorization:other"}).value, first.value);
});

test("Preview subject binds exact snapshot, scope, policy, environment, and producer", () => {
	const value = subject();
	assert.equal(decodePreviewSubject(value).ok, true);
	assert.equal(subject().subjectDigest, value.subjectDigest);
	assert.equal(decodePreviewSubject({...value, projectTree: oid("9")}).ok, false);
	assert.equal(decodePreviewSubject({...value, gateStatus: "passed"}).ok, false);
});

test("only independent passed preview.verify observation is Gate-eligible evidence", () => {
	const verify = subject("preview.verify");
	assert.equal(previewObservationEligibleForGate(verify, observation(verify)), true);
	assert.equal(previewObservationEligibleForGate(verify, observation(verify, {producerId: verify.producerId})), false);
	assert.equal(previewObservationEligibleForGate(verify, observation(verify, {status: "failed"})), false);
	const work = subject("preview.work");
	assert.equal(previewObservationEligibleForGate(work, observation(work)), false);
});

test("Preview observation is non-authoritative and digest-bound", () => {
	const preview = subject();
	const value = observation(preview);
	assert.equal(decodePreviewObservation(value).ok, true);
	assert.equal(decodePreviewObservation({...value, outputDigest: digest("f")}).ok, false);
	assert.equal(decodePreviewObservation({...value, authorized: true}).ok, false);
});
