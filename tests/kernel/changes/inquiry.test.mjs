import assert from "node:assert/strict";
import test from "node:test";

import {canonicalJson} from "../../../src/kernel/data-contracts/canonical-json.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {createProjectSnapshot} from "../../../src/kernel/changes/snapshot.ts";
import {decodeProfiledWikiReference} from "../../../src/kernel/wiki/profile-reference.ts";

import {decodeProfileChange} from "../../../src/kernel/changes/contracts.ts";
import {createInquiryChange, createInquirySource, decodeInquiryChange, decodeInquirySource, INQUIRY_LIMITS, INQUIRY_CANONICAL_LIMITS} from "../../../src/kernel/changes/inquiry.ts";

import {admitted, profileRecord} from "../wiki/profile-fixtures.mjs";

import {rawDigest, fixtureDigest, rawHex, without, sourceFixture, inquiryBody, inquiryFixture, boundaryInquiry, repositorySource, assertDeepFrozen, ownDataAttacks} from "./inquiry-fixtures.mjs";

test("Change 3 accepts an early question with no scope, acceptance, type, realization or Wiki patch in both Git formats", () => {
	for (const format of ["sha1", "sha256"]) {
		const change = inquiryFixture(format);
		assert.equal(change.protocol.version, "3.0.0"); assert.equal(change.baseline.complete, true);
		assert.equal(change.realization, null); assert.deepEqual(change.acceptance, []);
		assert.deepEqual(change.wikiConsequences, {kind: "unresolved"});
		assert.deepEqual(admitted(decodeInquiryChange(change)), change); assertDeepFrozen(change);
		assert.equal(decodeProfileChange(change).ok, false);
		assert.equal("ownerBinding" in change, false); assert.equal("status" in change, false);
	}
});

test("submitted capture preserves BOM, CRLF, non-NFC UTF-8 and separates claimed author from interpreter", () => {
	const text = "\ufeff# e\u0301\r\nClaimed prose\r\n";
	const source = sourceFixture(text, {claimedLocator: "https://example.test/note", claimedAttribution: "Author claim"});
	assert.equal(Buffer.from(source.contentUtf8Hex, "hex").toString("utf8"), text);
	assert.equal(source.contentDigest, rawDigest(Buffer.from(text)));
	assert.notEqual(source.contentDigest, sourceFixture(text.normalize("NFC")).contentDigest);
	const change = inquiryFixture("sha1", {sources: [source], intent: "What should change?", intentBasis: {kind: "interpreted", sourceDigests: [source.sourceDigest], producerRunRef: "cw:run:interpret"}});
	assert.equal(change.intentBasis.kind, "interpreted"); assert.equal(change.sources[0].claimedAttribution, "Author claim");
	const {sourceDigest, ...sourceBody} = source;
	assert.equal(sourceDigest, admitted(semanticDigest("codewiki.change-source@1.0.0", sourceBody)));
	assert.notEqual(sourceDigest, admitted(semanticDigest("codewiki.change@3.0.0", sourceBody)));
});

test("repository captures retain complete snapshot, raw path bytes, regular mode, blob and content digest without a Wiki reference", () => {
	for (const format of ["sha1", "sha256"]) {
		const source = repositorySource(format);
		const change = inquiryFixture(format, {sources: [source], intentBasis: {kind: "interpreted", sourceDigests: [source.sourceDigest], producerRunRef: null}});
		assert.equal(change.sources[0].snapshot.complete, true); assert.equal(source.blob.algorithm, format);
		assert.equal(Buffer.from(source.pathUtf8Hex, "hex").toString("utf8"), "notes/e\u0301 design.MD");
		assert.equal("reference" in source, false); assertDeepFrozen(source);
	}
});

test("inquiry digests bind every source claim, provenance, decision field and relationship", () => {
	const original = inquiryFixture();
	const {changeDigest, protocol, ...body} = original;
	assert.equal(changeDigest, admitted(semanticDigest("codewiki.change@3.0.0", {...body, protocol})));
	for (const patch of [
		{intent: "Different question"}, {rationale: "Reason"}, {scope: "Known scope"}, {revision: 2},
		{changeType: "maintenance"}, {realization: "wiki-only"}, {acceptance: ["One criterion"]}, {questions: ["Still unknown?"]},
		{assumptions: ["Unverified claim"]}, {relationships: [{kind: "related_to", changeId: "CHG-next"}]},
		{wikiConsequences: {kind: "none", reason: "Only source behavior is in scope."}},
		{intentBasis: {...body.intentBasis, kind: "interpreted", producerRunRef: "cw:run:producer"}},
	]) assert.notEqual(admitted(createInquiryChange({...body, ...patch})).changeDigest, changeDigest);
	const submitted = original.sources[0];
	for (const patch of [{claimedLocator: "copied file"}, {claimedAttribution: "someone"}]) {
		const changed = admitted(createInquirySource({...without(submitted, "sourceDigest"), ...patch}));
		assert.notEqual(changed.sourceDigest, submitted.sourceDigest);
		assert.equal(decodeInquirySource({...submitted, ...patch}).ok, false);
	}
	const repository = repositorySource();
	for (const patch of [{mode: "100755"}, {pathUtf8Hex: rawHex("other.md")}, {blob: {...repository.blob, hex: "b".repeat(40)}}, {contentDigest: fixtureDigest("d")}]) {
		assert.notEqual(admitted(createInquirySource({...without(repository, "sourceDigest"), ...patch})).sourceDigest, repository.sourceDigest);
		assert.equal(decodeInquirySource({...repository, ...patch}).ok, false);
	}
});

test("Change 3 constructors and decoders reject unowned, cyclic, accessor, sparse and hidden data before reading fields", () => {
	for (const [value, create, decode, digestField] of [
		[inquiryFixture(), createInquiryChange, decodeInquiryChange, "changeDigest"],
		[sourceFixture(), createInquirySource, decodeInquirySource, "sourceDigest"],
	]) {
		let accesses = 0; const onAccess = () => { accesses++; };
		for (const attack of ownDataAttacks(without(value, digestField, "protocol"), onAccess)) assert.equal(create(attack).ok, false);
		for (const attack of ownDataAttacks(value, onAccess)) assert.equal(decode(attack).ok, false);
		assert.equal(accesses, 0);
		assert.equal(create({...without(value, digestField, "protocol"), protocol: {id: "override", version: "1"}}).ok, false);
		assert.equal(decode(Object.assign(Object.create(null), value)).ok, true);
	}
	const body = inquiryBody(); body.sources = [...body.sources]; Object.defineProperty(body.sources, "0", {get() { throw new Error("source accessor"); }});
	assert.equal(createInquiryChange(body).ok, false);
	assert.equal(createInquiryChange({...inquiryBody(), baseline: {...inquiryBody().baseline, [Symbol("ignored")]: true}}).ok, false);
});

test("raw sources reject malformed or lossy hex/UTF-8, unsafe paths, links, foreign formats and stale digests", () => {
	const submitted = sourceFixture(); const repository = repositorySource();
	for (const hex of ["0", "FF", "zz", "ff", "c0af", "eda080", "f4908080", "e282"]) {
		assert.equal(createInquirySource({...without(submitted, "sourceDigest"), contentUtf8Hex: hex}).ok, false, hex);
		assert.equal(createInquirySource({...without(repository, "sourceDigest"), pathUtf8Hex: hex}).ok, false, hex);
	}
	for (const path of ["/note.md", "../note.md", "a/../note.md", "a//note.md", "a/./note.md", "C:note.md", "a\\note.md", "note.md/", "\0note.md", "note.txt"]) {
		assert.equal(createInquirySource({...without(repository, "sourceDigest"), pathUtf8Hex: rawHex(path)}).ok, false, path);
	}
	for (const patch of [{mode: "120000"}, {mode: "160000"}, {blob: {algorithm: "sha256", hex: "a".repeat(64)}}, {contentDigest: "SHA256:bad"}, {snapshot: {...repository.snapshot, complete: false}}]) {
		assert.equal(createInquirySource({...without(repository, "sourceDigest"), ...patch}).ok, false);
	}
	assert.equal(createInquirySource({...without(submitted, "sourceDigest"), contentDigest: fixtureDigest("f")}).ok, false);
});

test("submitted capture rejects invalid UTF-8 even when its content hash matches the exact bytes", () => {
	for (const contentUtf8Hex of ["ff", "c0af", "eda080", "f4908080", "e282"]) {
		const result = createInquirySource({
			kind: "submitted", contentUtf8Hex,
			contentDigest: rawDigest(Buffer.from(contentUtf8Hex, "hex")),
			claimedLocator: null, claimedAttribution: null,
		});
		assert.equal(result.ok, false, contentUtf8Hex);
		assert.equal(result.error.path, "$.contentUtf8Hex");
		assert.equal(result.error.message, "Captured bytes must be valid UTF-8 without normalization.");
	}
	// U+FFFD is valid when actually encoded, not when substituted for invalid bytes.
	const source = sourceFixture("\ufffd");
	assert.equal(source.contentUtf8Hex, "efbfbd");
	assert.deepEqual(admitted(decodeInquirySource(source)), source);
});

test("inquiry requires nonblank NFC intent, sources, grounded basis, strict optional fields and complete consistent baseline", () => {
	const body = inquiryBody();
	for (const patch of [
		{intent: " \t\n"}, {intent: "e\u0301"}, {intent: "\ud800"}, {sources: []}, {sources: [body.sources[0], body.sources[0]]},
		{intentBasis: {...body.intentBasis, sourceDigests: []}}, {intentBasis: {...body.intentBasis, sourceDigests: [fixtureDigest("f")]}},
		{intentBasis: {...body.intentBasis, sourceDigests: [body.sources[0].sourceDigest, body.sources[0].sourceDigest]}},
		{intentBasis: {...body.intentBasis, producerRunRef: "unqualified"}}, {intentBasis: {...body.intentBasis, kind: "approved"}},
		{rationale: " "}, {scope: "\n"}, {questions: [""]}, {assumptions: [" "]}, {acceptance: ["\t"]},
		{changeType: "unknown"}, {realization: "maybe"}, {revision: 0}, {revision: 1.5}, {revision: 1_000_001},
		{profile: "codewiki.wiki@2"}, {baseline: {...body.baseline, complete: false}}, {repositoryId: "cw:repository:foreign"},
		{sources: [repositorySource("sha256")]}, {relationships: [{kind: "related_to", changeId: body.changeId}]},
		{relationships: [{kind: "related_to", changeId: "CHG-z"}, {kind: "related_to", changeId: "CHG-a"}]},
	]) assert.equal(createInquiryChange({...body, ...patch}).ok, false, JSON.stringify(patch));
	const other = repositorySource("sha1", {snapshot: admitted(createProjectSnapshot({...without(body.baseline, "protocol", "snapshotDigest"), repositoryId: "cw:repository:other"}))});
	assert.equal(createInquiryChange({...body, sources: [other], intentBasis: {...body.intentBasis, sourceDigests: [other.sourceDigest]}}).ok, false);
});

test("repository identity claims cannot contradict one commit, blob or snapshot/path within a revision", () => {
	const source = repositorySource(); const body = inquiryBody();
	const alternateSnapshot = admitted(createProjectSnapshot({...without(source.snapshot, "protocol", "snapshotDigest"), tree: {...source.snapshot.tree, hex: "e".repeat(40)}}));
	for (const second of [
		repositorySource("sha1", {snapshot: alternateSnapshot}),
		repositorySource("sha1", {contentDigest: fixtureDigest("f"), pathUtf8Hex: rawHex("other.md")}),
		repositorySource("sha1", {mode: "100755"}),
		repositorySource("sha1", {blob: {...source.blob, hex: "e".repeat(40)}}),
	]) assert.equal(createInquiryChange({...body, sources: [source, second], intentBasis: {...body.intentBasis, sourceDigests: [source.sourceDigest]}}).ok, false);
});

test("unresolved, explicit-none and nonempty profile attachment are disjoint, baseline/responsible-Change bound states", () => {
	for (const format of ["sha1", "sha256"]) {
		const {reference} = profileRecord(format); const body = inquiryBody(format);
		assert.equal(createInquiryChange({...body, wikiConsequences: {kind: "none", reason: "No current Wiki consequences."}}).ok, true);
		assert.equal(createInquiryChange({...body, wikiConsequences: {kind: "profile", reference}}).ok, true);
		const empty = admitted(decodeProfiledWikiReference({...reference, mappings: []}));
		const wrongPath = admitted(decodeProfiledWikiReference({...reference, changePathUtf8Hex: rawHex(".changekernel/changes/TRACE-CHG-other.jsonl")}));
		for (const consequences of [
			{kind: "unresolved", reference}, {kind: "unresolved", reason: "not applicable"}, {kind: "none", reason: " "},
			{kind: "none", reason: "none", reference}, {kind: "profile"}, {kind: "profile", reference: empty},
			{kind: "profile", reference: wrongPath}, {kind: "profile", reference: {...reference, transactionDigest: "forged"}},
		]) assert.equal(createInquiryChange({...body, wikiConsequences: consequences}).ok, false);
		assert.equal(createInquiryChange({...body, baseline: reference.after, wikiConsequences: {kind: "profile", reference}}).ok, false);
	}
});

test("Change 3 enforces source, aggregate submitted, prose, list, relationship and canonical byte boundaries", () => {
	assert.equal(INQUIRY_LIMITS.sources, 16); assert.equal(INQUIRY_LIMITS.changeBytes, 256 * 1024);
	const source = sourceFixture("x".repeat(64 * 1024)); const body = inquiryBody();
	assert.equal(createInquiryChange({...body, sources: [source], intentBasis: {...body.intentBasis, sourceDigests: [source.sourceDigest]}}).ok, true);
	assert.equal(createInquirySource({kind: "submitted", contentUtf8Hex: rawHex("x".repeat(64 * 1024 + 1)), contentDigest: fixtureDigest(), claimedLocator: null, claimedAttribution: null}).ok, false);
	const small = sourceFixture("extra");
	assert.equal(createInquiryChange({...body, sources: [source, small], intentBasis: {...body.intentBasis, sourceDigests: [source.sourceDigest]}}).ok, false);
	const sources = Array.from({length: 17}, (_, i) => sourceFixture(String(i)));
	assert.equal(createInquiryChange({...body, sources: sources.slice(0, 16), intentBasis: {...body.intentBasis, sourceDigests: [sources[0].sourceDigest]}}).ok, true);
	assert.equal(createInquiryChange({...body, sources, intentBasis: {...body.intentBasis, sourceDigests: [sources[0].sourceDigest]}}).ok, false);
	for (const field of ["intent", "rationale", "scope"]) {
		assert.equal(createInquiryChange({...body, [field]: "x".repeat(16 * 1024)}).ok, true);
		assert.equal(createInquiryChange({...body, [field]: "é".repeat(8 * 1024 + 1)}).ok, false);
	}
	for (const field of ["acceptance", "questions", "assumptions"]) {
		assert.equal(createInquiryChange({...body, [field]: Array(32).fill("x".repeat(2048))}).ok, true);
		assert.equal(createInquiryChange({...body, [field]: Array(33).fill("x")}).ok, false);
		assert.equal(createInquiryChange({...body, [field]: ["x".repeat(2049)]}).ok, false);
	}
	const relationships = Array.from({length: 33}, (_, i) => ({kind: "related_to", changeId: `CHG-${String(i).padStart(2, "0")}`}));
	assert.equal(createInquiryChange({...body, relationships: relationships.slice(0, 32)}).ok, true);
	assert.equal(createInquiryChange({...body, relationships}).ok, false);
	// Control characters are valid prose but escaped bytes still count toward the canonical record ceiling.
	assert.equal(createInquiryChange({...body, intent: "x" + "\u0001".repeat(16383), rationale: "x" + "\u0001".repeat(16383), scope: "x" + "\u0001".repeat(16383)}).ok, false);
	let deep = {}; for (let i = 0; i < INQUIRY_CANONICAL_LIMITS.maximumDepth + 1; i++) deep = {nested: deep};
	assert.equal(createInquiryChange({...body, extra: deep}).ok, false);
	assert.equal(createInquiryChange({...body, extra: Array(INQUIRY_CANONICAL_LIMITS.maximumEntriesPerContainer + 1).fill(null)}).ok, false);
	const manyNodes = Array.from({length: 17}, () => Array(1024).fill(null));
	const rejected = createInquiryChange({...body, extra: manyNodes});
	assert.equal(rejected.ok, false); assert.equal(rejected.error.cause.code, "too_many_nodes");
});

test("accepted objects are independent deep-frozen copies and mutation invalidates retained digests", () => {
	const input = structuredClone(inquiryFixture()); const result = admitted(decodeInquiryChange(input));
	input.intent = "Changed later"; input.sources[0].claimedAttribution = "Someone else"; input.baseline.commit.hex = "f".repeat(40);
	assert.equal(result.intent, "Why does the setting fail?"); assert.equal(result.sources[0].claimedAttribution, null);
	assertDeepFrozen(result); assert.equal(decodeInquiryChange(input).ok, false);
	assert.equal(decodeInquiryChange({...result, changeDigest: fixtureDigest("f")}).ok, false);
	assert.equal(admitted(canonicalJson(admitted(decodeInquiryChange(result)))), admitted(canonicalJson(result)));
});

test("Change 3 canonical byte ceiling is inclusive and independent from raw/prose limits", () => {
	const change = boundaryInquiry();
	const body = without(change, "protocol", "changeDigest");
	const assumptions = [...body.assumptions]; assumptions[31] += "x";
	const tooLarge = createInquiryChange({...body, assumptions});
	assert.equal(tooLarge.ok, false); assert.equal(tooLarge.error.code, "limit_exceeded");
	assert.equal(createInquiryChange({...inquiryBody(), intent: "What about 🧭?"}).ok, true);
	const source = repositorySource("sha1", {pathUtf8Hex: rawHex("x".repeat(4093) + ".md")});
	assert.equal(Buffer.from(source.pathUtf8Hex, "hex").length, 4096);
	assert.equal(createInquirySource({...without(source, "sourceDigest"), pathUtf8Hex: rawHex("x".repeat(4094) + ".md")}).ok, false);
});

test("source and attachment digests commit to claims, not native repository authenticity", () => {
	const {reference} = profileRecord();
	const change = inquiryFixture("sha1", {wikiConsequences: {kind: "profile", reference}});
	const replacement = {...reference, transactionDigest: fixtureDigest("f")};
	assert.equal(decodeInquiryChange({...change, wikiConsequences: {kind: "profile", reference: replacement}}).ok, false, "Retained digest must bind the reference");
	// P1b/P1c must reopen exact native sources; this pure layer cannot recompute a transaction digest.
	const reidentified = admitted(createInquiryChange({...without(change, "protocol", "changeDigest"), wikiConsequences: {kind: "profile", reference: replacement}}));
	assert.notEqual(reidentified.changeDigest, change.changeDigest);
	const source = sourceFixture();
	for (const extra of [{verified: true}, {approved: true}, {producerRunRef: "cw:run:claimed"}]) {
		assert.equal(createInquirySource({...without(source, "sourceDigest"), ...extra}).ok, false);
	}
});

test("inquiry rejects missing/unknown fields, old protocols and noncanonical identity sets", () => {
	const change = inquiryFixture(); const body = without(change, "protocol", "changeDigest");
	for (const field of Object.keys(body)) assert.equal(createInquiryChange(without(body, field)).ok, false, field);
	for (const version of ["1.0.0", "2.0.0", "4.0.0"]) assert.equal(decodeInquiryChange({...change, protocol: {...change.protocol, version}}).ok, false);
	const sources = [sourceFixture("First"), sourceFixture("Second")];
	const sourceDigests = sources.map(source => source.sourceDigest).sort();
	const valid = {...body, sources, intentBasis: {...body.intentBasis, sourceDigests}};
	assert.equal(createInquiryChange(valid).ok, true);
	assert.equal(createInquiryChange({...valid, intentBasis: {...valid.intentBasis, sourceDigests: [...sourceDigests].reverse()}}).ok, false);
	const relation = {kind: "related_to", changeId: "CHG-other"};
	assert.equal(createInquiryChange({...body, relationships: [relation, relation]}).ok, false);
	assert.equal(createInquiryChange({...body, relationships: [{kind: "derived_from", changeId: "CHG-other"}]}).ok, false);
	assert.equal(createInquiryChange({...body, intentBasis: {...body.intentBasis, approved: true}}).ok, false);
});

test("early inquiry grammar rejects Gate, Work, readiness, approval and effect authority fields", () => {
	for (const field of ["gate", "work", "approval", "approved", "ready", "readiness", "status", "authorization", "transactionDigest", "reference", "ownerItemId"]) {
		assert.equal(createInquiryChange({...inquiryBody(), [field]: true}).ok, false, field);
	}
});
