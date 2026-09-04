import assert from "node:assert/strict";
import test from "node:test";

import {validateWikiTransaction} from "../../../src/kernel/wiki/transaction.ts";
import {validateWikiTree} from "../../../src/kernel/wiki/tree.ts";
import {digest, markdownEntry, materialize, snapshot} from "./fixtures.mjs";

test("one validated Wiki transaction handles add, move, retirement, and provenance-only edits atomically", () => {
	const alpha = markdownEntry({path: ".codewiki/wiki/items/old/alpha.md", blob: 10, itemId: "cw:item:alpha", title: "Alpha", body: "Alpha\n"});
	const beta = markdownEntry({path: ".codewiki/wiki/items/live/beta.md", blob: 11, itemId: "cw:item:beta", title: "Beta"});
	const deltaBefore = markdownEntry({
		path: ".codewiki/wiki/items/live/delta.md",
		blob: 12,
		itemId: "cw:item:delta",
		title: "Delta",
		attributes: {"codewiki.legacy:source": "before"},
	});
	const before = materialize([alpha, beta, deltaBefore], {commit: 1, tree: 2});
	const movedAlpha = Object.freeze({...alpha, path: ".codewiki/wiki/items/current/alpha.md"});
	const deltaAfter = markdownEntry({
		path: ".codewiki/wiki/items/live/delta.md",
		blob: 13,
		itemId: "cw:item:delta",
		title: "Delta",
		attributes: {"codewiki.legacy:source": "after"},
	});
	const gamma = markdownEntry({
		path: ".codewiki/wiki/items/live/gamma.md",
		blob: 14,
		itemId: "cw:item:gamma",
		title: "Gamma",
		relationships: [{predicate: "codewiki.wiki:depends-on", targetItemId: "cw:item:alpha", attributes: {}}],
	});
	const after = materialize([movedAlpha, deltaAfter, gamma], {
		commit: 3,
		tree: 4,
		parents: [1],
		retiredItemIds: ["cw:item:beta"],
	});
	const result = validateWikiTransaction({before, after});
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	assert.deepEqual(result.value.changes.map(({itemId, kind}) => [itemId, kind]), [
		["cw:item:alpha", "moved"],
		["cw:item:beta", "retired"],
		["cw:item:delta", "provenance_changed"],
		["cw:item:gamma", "added"],
	]);
	assert.deepEqual(result.value.retiredItemIds, ["cw:item:beta"]);
	assert.equal(result.value.changes[0].semanticChanged, false);
	assert.equal(result.value.changes[2].provenanceChanged, true);
	assert.match(result.value.transactionDigest, /^sha256:[0-9a-f]{64}$/u);
});

test("move plus semantic edit remains one stable Item history", () => {
	const before = materialize([
		markdownEntry({path: ".codewiki/wiki/items/old/item.md", blob: 20, itemId: "cw:item:stable", title: "Before", body: "Before\n"}),
	], {commit: 10, tree: 11});
	const after = materialize([
		markdownEntry({path: ".codewiki/wiki/items/new/item.md", blob: 21, itemId: "cw:item:stable", title: "After", body: "After\n"}),
	], {commit: 12, tree: 13, parents: [10]});
	const result = validateWikiTransaction({before, after});
	assert.equal(result.ok, true);
	assert.equal(result.value.changes.length, 1);
	assert.equal(result.value.changes[0].kind, "moved_and_edited");
	assert.equal(result.value.changes[0].itemId, "cw:item:stable");
});

test("transaction validation rejects forged blob identity and incompatible interpretation", () => {
	assert.equal(validateWikiTransaction(null).ok, false);
	const before = materialize([
		markdownEntry({path: ".codewiki/wiki/items/test/item.md", blob: 30, itemId: "cw:item:test", title: "Before"}),
	], {commit: 30, tree: 31});
	const forgedAfter = materialize([
		markdownEntry({path: ".codewiki/wiki/items/test/item.md", blob: 30, itemId: "cw:item:test", title: "After"}),
	], {commit: 32, tree: 33, parents: [30]});
	assert.equal(validateWikiTransaction({before, after: forgedAfter}).error.code, "identity_mismatch");

	const otherKernel = materialize([
		markdownEntry({path: ".codewiki/wiki/items/test/item.md", blob: 30, itemId: "cw:item:test", title: "Before"}),
	], {commit: 32, tree: 33, parents: [30], kernelBuildDigest: digest("b")});
	assert.equal(validateWikiTransaction({before, after: otherKernel}).error.code, "invalid_source");
});

test("post-state closure and retired-ID reuse fail before a transaction can be accepted", () => {
	const dangling = markdownEntry({
		path: ".codewiki/wiki/items/test/item.md",
		blob: 40,
		itemId: "cw:item:test",
		title: "Test",
		relationships: [{predicate: "codewiki.wiki:depends-on", targetItemId: "cw:item:missing", attributes: {}}],
	});
	const closure = validateWikiTree({snapshot: snapshot(), kernelBuildDigest: digest(), entries: [dangling], retiredItemIds: []});
	assert.equal(closure.ok, false);
	assert.equal(closure.error.code, "dangling_relationship");

	const reused = validateWikiTree({
		snapshot: snapshot(),
		kernelBuildDigest: digest(),
		entries: [markdownEntry({path: ".codewiki/wiki/items/test/item.md", blob: 41, itemId: "cw:item:test", title: "Reused"})],
		retiredItemIds: ["cw:item:test"],
	});
	assert.equal(reused.ok, false);
	assert.equal(reused.error.code, "retired_item_id");
});
