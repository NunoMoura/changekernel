import assert from "node:assert/strict";
import {readdir, readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import test from "node:test";

import {
	MAXIMUM_WIKI_FILE_BYTES,
	decodeWikiFile,
	wikiFileFormat,
} from "../../../src/kernel/wiki/file.ts";
import {decodeWikiInlineLinks} from "../../../src/kernel/wiki/links.ts";
import {validateWikiTree} from "../../../src/kernel/wiki/tree.ts";
import {digest, envelope, markdownEntry, oid, snapshot, yamlEntry} from "./fixtures.mjs";

const UTF8 = new TextEncoder();

test("canonical Markdown and JSON-compatible YAML decode to path-independent Item semantics", () => {
	const common = {
		itemId: "cw:item:alpha",
		title: "Café",
		aliases: ["Alpha"],
		body: "Exact body.\n",
	};
	const markdown = decodeWikiFile(markdownEntry({path: ".codewiki/wiki/items/concepts/alpha.md", blob: 10, ...common}));
	const yaml = decodeWikiFile(yamlEntry({path: ".codewiki/wiki/items/archive/alpha.yaml", blob: 11, ...common}));
	assert.equal(markdown.ok, true);
	assert.equal(yaml.ok, true);
	assert.equal(markdown.value.item.semanticDigest, yaml.value.item.semanticDigest);
	assert.equal(markdown.value.item.body, "Exact body.\n");
	assert.equal(yaml.value.format, "yaml");
});

test("Wiki Item paths use one portable lowercase canonical namespace", () => {
	for (const path of [
		".codewiki/wiki/items/a.md",
		".codewiki/wiki/items/system/components/wiki.yaml",
		".codewiki/wiki/items/decisions/abc123.yml",
	]) assert.equal(wikiFileFormat(path).ok, true, path);
	for (const path of [
		".codewiki/wiki/items/System/wiki.md",
		".codewiki/wiki/items/system/wiki_item.md",
		".codewiki/wiki/items/system/../wiki.md",
		".codewiki/wiki/items/system/con.md",
		".codewiki/wiki/items/system/wiki.txt",
		".codewiki/wiki/items/cafe\u0301/item.md",
		".codewiki/wiki.md",
	]) assert.equal(wikiFileFormat(path).ok, false, path);
});

test("Wiki file decoding rejects malformed encoding, mode, framing, normalization, and bounds", () => {
	const valid = markdownEntry({path: ".codewiki/wiki/items/test/item.md", itemId: "cw:item:test", title: "Test", body: "Body\n"});
	const malformed = [
		{...valid, mode: "100755"},
		{...valid, mode: "120000"},
		{...valid, bytes: new Uint8Array([0xff])},
		{...valid, bytes: valid.bytes.slice(0, -1)},
		{...valid, bytes: UTF8.encode(new TextDecoder().decode(valid.bytes).replace("Body\n", "Cafe\u0301\n"))},
		{...valid, bytes: UTF8.encode(new TextDecoder().decode(valid.bytes).replace("\n---\n", "\r\n---\r\n"))},
		{...valid, bytes: new Uint8Array(MAXIMUM_WIKI_FILE_BYTES + 1)},
	];
	for (const input of malformed) assert.equal(decodeWikiFile(input).ok, false);

	const record = envelope({itemId: "cw:item:test", title: "Test"});
	const pretty = UTF8.encode(`---\n${JSON.stringify(record, null, 2)}\n---\n`);
	assert.equal(decodeWikiFile({...valid, bytes: pretty}).ok, false);
});

test("canonical inline Wiki links are exact, code-aware, and part of closure", () => {
	const body = [
		"[Alpha](codewiki://item/cw%3Aitem%3Aalpha)",
		"`[Ignored](codewiki://item/cw%3Aitem%3Aignored)`",
		"\\[Escaped](codewiki://item/cw%3Aitem%3Aescaped)",
		"```md",
		"[Also ignored](codewiki://item/cw%3Aitem%3Aignored)",
		"```",
		"",
	].join("\n");
	const links = decodeWikiInlineLinks(body);
	assert.equal(links.ok, true);
	assert.deepEqual(links.value, ["cw:item:alpha"]);
	assert.equal(decodeWikiInlineLinks("[bad](codewiki://item/cw%3aitem%3Abad)\n").ok, false);

	const source = markdownEntry({path: ".codewiki/wiki/items/test/source.md", blob: 18, itemId: "cw:item:source", title: "Source", body});
	const target = markdownEntry({path: ".codewiki/wiki/items/test/alpha.md", blob: 19, itemId: "cw:item:alpha", title: "Alpha"});
	assert.equal(validateWikiTree({snapshot: snapshot(), kernelBuildDigest: digest(), entries: [target, source], retiredItemIds: []}).ok, true);
	const dangling = validateWikiTree({snapshot: snapshot(), kernelBuildDigest: digest(), entries: [source], retiredItemIds: []});
	assert.equal(dangling.ok, false);
	assert.equal(dangling.error.code, "dangling_relationship");
});

test("complete Wiki tree enforces stable IDs, relationship closure, retired reservations, and ordering", () => {
	const first = markdownEntry({
		path: ".codewiki/wiki/items/test/first.md",
		blob: 20,
		itemId: "cw:item:first",
		title: "First",
		relationships: [{predicate: "codewiki.wiki:relates-to", targetItemId: "cw:item:second", attributes: {}}],
	});
	const second = markdownEntry({path: ".codewiki/wiki/items/test/second.md", blob: 21, itemId: "cw:item:second", title: "Second"});
	const valid = validateWikiTree({snapshot: snapshot(), kernelBuildDigest: digest(), entries: [first, second], retiredItemIds: []});
	assert.equal(valid.ok, true);
	assert.deepEqual(valid.value.items.map((file) => file.item.itemId), ["cw:item:first", "cw:item:second"]);

	const duplicate = markdownEntry({path: ".codewiki/wiki/items/test/third.md", blob: 22, itemId: "cw:item:first", title: "Duplicate"});
	assert.equal(validateWikiTree({snapshot: snapshot(), kernelBuildDigest: digest(), entries: [first, second, duplicate], retiredItemIds: []}).error.code, "duplicate_item_id");
	assert.equal(validateWikiTree({snapshot: snapshot(), kernelBuildDigest: digest(), entries: [second, first], retiredItemIds: []}).error.code, "non_canonical_order");
	assert.equal(validateWikiTree({snapshot: snapshot(), kernelBuildDigest: digest(), entries: [first, second], retiredItemIds: ["cw:item:first"]}).error.code, "retired_item_id");

	const dangling = markdownEntry({
		path: ".codewiki/wiki/items/test/dangling.md",
		blob: 23,
		itemId: "cw:item:dangling",
		title: "Dangling",
		relationships: [{predicate: "codewiki.wiki:relates-to", targetItemId: "cw:item:absent", attributes: {}}],
	});
	assert.equal(validateWikiTree({snapshot: snapshot(), kernelBuildDigest: digest(), entries: [dangling], retiredItemIds: []}).error.code, "dangling_relationship");
});

test("the governed Wiki corpus satisfies the new exact file and relationship contract", async () => {
	const root = fileURLToPath(new URL("../../../.codewiki/wiki/items/", import.meta.url));
	const paths = await markdownPaths(root);
	const entries = await Promise.all(paths.map(async (path, index) => Object.freeze({
		path: `.codewiki/wiki/items/${path}`,
		mode: "100644",
		blob: oid(100 + index),
		bytes: new Uint8Array(await readFile(`${root}/${path}`)),
	})));
	entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
	const result = validateWikiTree({snapshot: snapshot(), kernelBuildDigest: digest(), entries, retiredItemIds: []});
	assert.equal(result.ok, true, result.ok ? "" : `${result.error.path}: ${result.error.message}`);
	assert.equal(result.value.items.length, paths.length);
	assert.ok(paths.length > 20);
});

async function markdownPaths(root, relative = "") {
	const output = [];
	for (const entry of await readdir(`${root}/${relative}`, {withFileTypes: true})) {
		const path = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
		if (entry.isDirectory()) output.push(...await markdownPaths(root, path));
		else if (entry.isFile()) output.push(path);
	}
	return output.sort();
}
