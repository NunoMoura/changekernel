import assert from "node:assert/strict";
import {readdir, readFile, stat} from "node:fs/promises";
import {join} from "node:path";
import test from "node:test";
import {
	decodeWikiItem,
	decodeWikiItemEnvelope,
} from "../../../src/kernel/wiki/item.ts";

async function walk(root) {
	const output = [];
	for (const name of (await readdir(root)).sort()) {
		const path = join(root, name);
		if ((await stat(path)).isDirectory()) output.push(...await walk(path));
		else output.push(path);
	}
	return output;
}

function splitItem(markdown) {
	const match = /^---\n([^\n]+)\n---\n/u.exec(markdown);
	assert.ok(match);
	return {envelope: JSON.parse(match[1]), body: markdown.slice(match[0].length)};
}

test("every canonical Wiki Item decodes through open native envelope", async () => {
	const paths = (await walk(".codewiki/wiki/items")).filter((path) => path.endsWith(".md"));
	assert.equal(paths.length, 47);
	for (const path of paths) {
		const {envelope, body} = splitItem(await readFile(path, "utf8"));
		const result = decodeWikiItem(envelope, body);
		assert.equal(result.ok, true, `${path}: ${result.ok ? "" : result.error.message}`);
	}
});

test("legacy metadata remains retrievable but cannot affect semantic identity", async () => {
	const {envelope, body} = splitItem(await readFile(".codewiki/wiki/items/system/components/checks.md", "utf8"));
	const baseline = decodeWikiItem(envelope, body);
	assert.equal(baseline.ok, true);
	const changedLegacy = structuredClone(envelope);
	changedLegacy.attributes["codewiki.legacy:source-path"] = "historical/other.md";
	changedLegacy.attributes["codewiki.legacy:metadata"].description = "different legacy prose";
	const legacy = decodeWikiItem(changedLegacy, body);
	assert.equal(legacy.ok, true);
	assert.equal(legacy.value.semanticDigest, baseline.value.semanticDigest);
	assert.equal(legacy.value.attributes["codewiki.legacy:source-path"], "historical/other.md");
	const changedNative = structuredClone(envelope);
	changedNative.attributes["codewiki.component:ownership"].traceEvents = ["gate.changed"];
	const native = decodeWikiItem(changedNative, body);
	assert.equal(native.ok, true);
	assert.notEqual(native.value.semanticDigest, baseline.value.semanticDigest);
});

test("unknown namespaced attributes survive while unknown envelope fields fail", async () => {
	const {envelope} = splitItem(await readFile(".codewiki/wiki/items/system/components/checks.md", "utf8"));
	const extended = structuredClone(envelope);
	extended.attributes["plugin.example:new-field"] = {nested: true};
	const decoded = decodeWikiItemEnvelope(extended);
	assert.equal(decoded.ok, true);
	assert.equal(decoded.value.attributes["plugin.example:new-field"].nested, true);
	assert.equal(decodeWikiItemEnvelope({...extended, domain: "software-development"}).ok, false);
	assert.equal(decodeWikiItemEnvelope({...extended, attributes: {unnamespaced: true}}).ok, false);
});
