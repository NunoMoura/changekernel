import assert from "node:assert/strict";
import test from "node:test";
import {
	createEvidenceReference,
	decodeEvidenceReference,
} from "../../../src/kernel/evidence/reference.ts";

export const digest = (character) => `sha256:${character.repeat(64)}`;

export function evidenceFixture(overrides = {}) {
	const result = createEvidenceReference({
		evidenceId: "cw:evidence:test",
		evidenceDigest: digest("a"),
		schema: {id: "codewiki.test-evidence", version: "1.0.0"},
		mediaType: "application/json",
		subjectDigest: digest("b"),
		subjectOids: [{algorithm: "sha1", hex: "1".repeat(40)}, {algorithm: "sha1", hex: "2".repeat(40)}],
		materialDigests: [digest("c"), digest("d")],
		producerId: "cw:actor:observer",
		method: "codewiki.method:independent",
		receiptDigest: digest("e"),
		authority: "observed",
		coverage: "complete",
		freshness: "current",
		capturePolicy: "full_revision",
		retentionPolicy: "pinned",
		limitations: [],
		...overrides,
	});
	assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
	return result.value;
}

test("Evidence reference binds immutable identity, subject, receipt, and policy", () => {
	const evidence = evidenceFixture();
	assert.equal(decodeEvidenceReference(evidence).ok, true);
	assert.equal(Object.isFrozen(evidence), true);
	assert.equal(evidenceFixture().referenceDigest, evidence.referenceDigest);
});

test("Evidence reference rejects forged identity and unsorted material", () => {
	const evidence = evidenceFixture();
	assert.equal(decodeEvidenceReference({...evidence, subjectDigest: digest("f")}).ok, false);
	assert.equal(decodeEvidenceReference({...evidence, materialDigests: [...evidence.materialDigests].reverse()}).ok, false);
	assert.equal(decodeEvidenceReference({...evidence, subjectOids: [...evidence.subjectOids].reverse()}).ok, false);
});

test("Evidence reference cannot carry path, URL, credential, or raw bytes", () => {
	const evidence = evidenceFixture();
	for (const extra of [
		{path: "/tmp/evidence"},
		{url: "https://example.invalid/evidence"},
		{credential: "secret"},
		{content: "raw"},
	]) assert.equal(decodeEvidenceReference({...evidence, ...extra}).ok, false);
});
