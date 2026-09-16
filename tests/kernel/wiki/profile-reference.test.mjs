import assert from "node:assert/strict";
import test from "node:test";
import {createProfiledWikiReference, decodeProfiledWikiReference, decodeProfiledPathUtf8Hex, profileReferencePathUtf8Hex} from "../../../src/kernel/wiki/profile-reference.ts";
import {admitted, PROFILE_PATH, profileFixture} from "./profile-fixtures.mjs";

test("reference carries the admitted transaction digest; it is not a second reference-body digest", () => {
	for (const algorithm of ["sha1", "sha256"]) {
		const {transaction} = profileFixture(algorithm);
		const reference = admitted(createProfiledWikiReference(transaction));
		assert.equal(reference.transactionDigest, transaction.transactionDigest);
		assert.equal(admitted(decodeProfiledPathUtf8Hex(reference.mappings[0].before[0].pathUtf8Hex)), PROFILE_PATH);
		assert.deepEqual(admitted(decodeProfiledWikiReference(JSON.parse(JSON.stringify(reference)))), reference);
	}
});

test("reference decoder rejects hostile data and inconsistent complete identities", () => {
	const value = JSON.parse(JSON.stringify(admitted(createProfiledWikiReference(profileFixture().transaction))));
	let touched = 0;
	const hostile = {...value};
	Object.defineProperty(hostile, "profile", {enumerable: true, get() {touched++; throw new Error("not data");}});
	assert.equal(decodeProfiledWikiReference(hostile).ok, false); assert.equal(touched, 0);
	for (const patch of [
		{profile: "unknown"}, {kernelBuildDigest: "unknown"}, {transactionDigest: "unknown"}, {unexpected: true},
		{before: {...value.before, complete: false}}, {after: {...value.after, tree: value.before.tree}},
		{mappings: new Array(1)}, {mappings: [value.mappings[0], value.mappings[0]]},
		{mappings: [{...value.mappings[0], before: []}]},
		{mappings: [{...value.mappings[0], before: [{...value.mappings[0].before[0], blob: {algorithm: "sha256", hex: "0".repeat(64)}}]}]},
	]) assert.equal(decodeProfiledWikiReference({...value, ...patch}).ok, false);
	const retained = admitted(decodeProfiledWikiReference(value));
	value.mappings[0].before.length = 0;
	assert.equal(retained.mappings[0].before.length, 1);
	const pending = [retained];
	while (pending.length) {
		const record = pending.pop();
		assert.equal(Object.isFrozen(record), true);
		for (const child of Object.values(record)) if (child !== null && typeof child === "object") pending.push(child);
	}
});

test("transport text and node budgets precede reference expansion", () => {
	const value = admitted(createProfiledWikiReference(profileFixture().transaction));
	const before = Array.from({length: 512}, (_, index) => ({blob: value.mappings[0].before[0].blob, pathUtf8Hex: profileReferencePathUtf8Hex(`.changekernel/wiki/items/${String(index).padStart(3, "0")}${"a".repeat(4060)}.md`)}));
	const text = decodeProfiledWikiReference({...value, mappings: [{kind: "merge", before, after: value.mappings[0].after}]});
	assert.equal(text.ok, false); assert.equal(text.error.cause.code, "too_much_text");
	const nodes = decodeProfiledWikiReference({...value, excess: Array.from({length: 101}, () => Array(1024).fill(null))});
	assert.equal(nodes.ok, false); assert.equal(nodes.error.cause.code, "too_many_nodes");
});

test("managed references use the ChangeKernel root without accepting legacy path aliases", () => {
	const reference = admitted(createProfiledWikiReference(profileFixture().transaction));
	const legacyChangePath = Buffer.from(".codewiki/changes/TRACE-CHG-profile-test.jsonl", "utf8").toString("hex");
	assert.equal(decodeProfiledPathUtf8Hex(legacyChangePath, true).ok, false);
	assert.equal(decodeProfiledWikiReference({...reference, changePathUtf8Hex: legacyChangePath}).ok, false);
	const legacyWikiPath = Buffer.from(".codewiki/wiki/items/claim.md", "utf8").toString("hex");
	assert.equal(decodeProfiledPathUtf8Hex(legacyWikiPath).ok, false);
	assert.equal(decodeProfiledWikiReference({...reference, mappings: [{...reference.mappings[0],
		before: [{...reference.mappings[0].before[0], pathUtf8Hex: legacyWikiPath}],
	}]}).ok, false);
});

test("exact path tokens preserve decomposed and astral Unicode and reject ambiguous bytes", () => {
	for (const path of [PROFILE_PATH, ".changekernel/wiki/items/🌱.md"]) {
		assert.equal(admitted(decodeProfiledPathUtf8Hex(profileReferencePathUtf8Hex(path))), path);
	}
	const good = profileReferencePathUtf8Hex(PROFILE_PATH);
	for (const value of [good.toUpperCase(), good.slice(1), "ff", "c080", "efbbbf" + good, "00", "a".repeat(8194)]) {
		assert.equal(decodeProfiledPathUtf8Hex(value).ok, false);
	}
	assert.notEqual(good, profileReferencePathUtf8Hex(PROFILE_PATH.normalize("NFC")));
});
