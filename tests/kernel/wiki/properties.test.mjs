import assert from "node:assert/strict";
import test from "node:test";

import {MAXIMUM_WIKI_FILE_BYTES, decodeWikiFile, wikiFileFormat} from "../../../src/kernel/wiki/file.ts";
import {validateWikiTransaction} from "../../../src/kernel/wiki/transaction.ts";
import {validateWikiTree} from "../../../src/kernel/wiki/tree.ts";
import {digest, markdownEntry, materialize, snapshot} from "./fixtures.mjs";

const UTF8 = new TextEncoder();

test("deterministic path corpus preserves portable valid paths and rejects non-canonical mutations", () => {
	for (let index = 0; index < 128; index += 1) {
		const path = `.codewiki/wiki/items/category-${index}/item-${index}.md`;
		assert.equal(wikiFileFormat(path).ok, true, path);
		for (const mutation of [
			path.replace("category", "Category"),
			path.replace("item-", "item_"),
			path.replace(`/item-${index}.md`, "/../item.md"),
			path.replace(`item-${index}.md`, `item-${index}-.md`),
		]) assert.equal(wikiFileFormat(mutation).ok, false, mutation);
	}
});

test("malformed UTF-8, Unicode normalization, framing, and size corpus always fails closed", () => {
	assert.equal(decodeWikiFile(null).ok, false);
	const base = markdownEntry({path: ".codewiki/wiki/items/test/item.md", itemId: "cw:item:test", title: "Test", body: "Body\n"});
	const byteCorpus = [
		new Uint8Array([0x80]),
		new Uint8Array([0xc0, 0xaf]),
		new Uint8Array([0xe2, 0x82]),
		new Uint8Array([0xed, 0xa0, 0x80]),
		UTF8.encode(`\uFEFF${new TextDecoder().decode(base.bytes)}`),
		UTF8.encode(new TextDecoder().decode(base.bytes).replace("Body", "Cafe\u0301")),
		UTF8.encode(new TextDecoder().decode(base.bytes).replace("Body", "Body\0")),
		UTF8.encode(new TextDecoder().decode(base.bytes).replace("Body\n", "Body\r\n")),
		base.bytes.slice(0, -1),
		new Uint8Array(MAXIMUM_WIKI_FILE_BYTES + 1),
	];
	for (const bytes of byteCorpus) assert.equal(decodeWikiFile({...base, bytes}).ok, false);

	const oversizeBody = markdownEntry({
		path: base.path,
		itemId: "cw:item:test",
		title: "Test",
		body: `${"a".repeat(4 * 1024 * 1024)}\n`,
	});
	assert.equal(decodeWikiFile(oversizeBody).ok, false);
});

test("generated transaction corpus classifies stable moves and edits without partial retirement", () => {
	const beforeEntries = [];
	const afterEntries = [];
	const retired = [];
	for (let index = 0; index < 24; index += 1) {
		const itemId = `cw:item:generated-${index}`;
		const entry = markdownEntry({
			path: `.codewiki/wiki/items/generated/item-${index}.md`,
			blob: 1000 + index,
			itemId,
			title: `Item ${index}`,
		});
		beforeEntries.push(entry);
		if (index % 4 === 0) afterEntries.push(entry);
		if (index % 4 === 1) afterEntries.push(Object.freeze({...entry, path: `.codewiki/wiki/items/moved/item-${index}.md`}));
		if (index % 4 === 2) afterEntries.push(markdownEntry({
			path: entry.path,
			blob: 2000 + index,
			itemId,
			title: `Edited ${index}`,
		}));
		if (index % 4 === 3) retired.push(itemId);
	}
	for (let index = 0; index < 6; index += 1) afterEntries.push(markdownEntry({
		path: `.codewiki/wiki/items/added/item-${index}.md`,
		blob: 3000 + index,
		itemId: `cw:item:added-${index}`,
		title: `Added ${index}`,
	}));
	const before = materialize(beforeEntries, {commit: 300, tree: 301});
	const after = materialize(afterEntries, {commit: 302, tree: 303, parents: [300], retiredItemIds: retired.sort()});
	const transaction = validateWikiTransaction({before, after});
	assert.equal(transaction.ok, true, transaction.ok ? "" : transaction.error.message);
	const counts = Object.create(null);
	for (const change of transaction.value.changes) counts[change.kind] = (counts[change.kind] ?? 0) + 1;
	assert.deepEqual({...counts}, {added: 6, edited: 6, moved: 6, retired: 6});
	assert.deepEqual(transaction.value.retiredItemIds, retired);
});

test("relationship post-state is atomic across generated additions", () => {
	const first = markdownEntry({
		path: ".codewiki/wiki/items/generated/first.md",
		blob: 4000,
		itemId: "cw:item:first",
		title: "First",
		body: "[Second](codewiki://item/cw%3Aitem%3Asecond)\n",
		relationships: [{predicate: "codewiki.wiki:depends-on", targetItemId: "cw:item:second", attributes: {}}],
	});
	const second = markdownEntry({path: ".codewiki/wiki/items/generated/second.md", blob: 4001, itemId: "cw:item:second", title: "Second"});
	const complete = validateWikiTree({snapshot: snapshot(), kernelBuildDigest: digest(), entries: [first, second], retiredItemIds: []});
	assert.equal(complete.ok, true);
	const partial = validateWikiTree({snapshot: snapshot(), kernelBuildDigest: digest(), entries: [first], retiredItemIds: []});
	assert.equal(partial.ok, false);
	assert.equal(partial.error.code, "dangling_relationship");
});
