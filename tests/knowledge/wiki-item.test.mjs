import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {describe, it} from "node:test";
import {
	assertGeneratedWikiItemPath,
	assertPortableWikiItemPath,
	createWikiItem,
	generatedWikiItemPath,
	parseWikiItemFile,
	serializeWikiItemFile,
} from "../../src/knowledge/wiki-item.ts";
import {
	canonicalSemanticJson,
	parseCanonicalSemanticJson,
	semanticDigest,
} from "../../src/utils/semantic-digest.ts";

const fixtureRoot = new URL("../fixtures/semantic-kernel/wiki/", import.meta.url);

function validInput() {
	return {
		itemId: "cw:demo:item:policy",
		itemType: "codewiki.policy",
		title: "Replay policy",
		aliases: ["Replay policy"],
		attributes: {"codewiki.priority": 1},
		relationships: [
			{
				predicate: "codewiki.implements",
				targetItemId: "cw:demo:item:architecture",
				attributes: {},
			},
		],
		provenance: [
			{
				kind: "codewiki.change",
				subjectId: "CHG-demo",
				attributes: {
					"codewiki.commit": "0123456789012345678901234567890123456789",
				},
			},
		],
		body: "# Policy\n\nRequire exact replay.",
	};
}

describe("Semantic Kernel common values", () => {
	it("uses restricted RFC 8785 bytes and domain-separated SHA-256", () => {
		const value = {b: "é", a: 1};
		assert.equal(canonicalSemanticJson(value), '{"a":1,"b":"é"}');
		assert.equal(
			semanticDigest("codewiki.test@1.0.0", value),
			"sha256:3114c342c0568a79ca0f152d585f8aa9017581ffa2a2cd5fec30cc49687ead56",
		);
		assert.equal(
			canonicalSemanticJson(parseCanonicalSemanticJson('{"a":1,"b":"é"}')),
			'{"a":1,"b":"é"}',
		);
	});

	it("rejects floats, unsafe integers, non-NFC text, and non-canonical bytes", () => {
		for (const value of [1.5, Number.MAX_SAFE_INTEGER + 1, -0, "e\u0301"]) {
			assert.throws(() => canonicalSemanticJson(value), /safe integer|NFC/u);
		}
		for (const text of ['{"b":2,"a":1}', '{"a":1, "b":2}', '{"a":1,"a":1}']) {
			assert.throws(() => parseCanonicalSemanticJson(text), /does not conform/u);
		}
	});
});

describe("Wiki Item 1.0.0", () => {
	it("round-trips exact Markdown and YAML goldens", async () => {
		const item = createWikiItem(validInput());
		for (const [name, format] of [
			["policy.md", "markdown"],
			["policy.yaml", "yaml"],
		]) {
			const bytes = await readFile(new URL(name, fixtureRoot), "utf8");
			const path = `.codewiki/wiki/items/policy/${name}`;
			assert.deepEqual(parseWikiItemFile(path, bytes), item);
			assert.equal(serializeWikiItemFile(item, format), bytes);
		}
	});

	it("derives portable default paths only from stable Item IDs", () => {
		const path = generatedWikiItemPath("cw:demo:item:policy");
		assert.equal(
			path,
			".codewiki/wiki/items/gc/item-gcxdkj5kneo24ze5ywpbbwkr62krgiumtf7f4mmvlskrd7upcngq.md",
		);
		assert.doesNotThrow(() => assertGeneratedWikiItemPath(path, "cw:demo:item:policy"));
		assert.throws(
			() => assertGeneratedWikiItemPath(path, "cw:demo:item:other"),
			/does not match/u,
		);
		const renamed = createWikiItem({...validInput(), title: "Renamed policy"});
		assert.equal(generatedWikiItemPath(renamed.itemId), path);
	});

	it("accepts portable user paths and rejects cross-platform hazards", () => {
		assert.doesNotThrow(() =>
			assertPortableWikiItemPath(".codewiki/wiki/items/Policy/replay-rule.md"),
		);
		for (const path of [
			".codewiki/wiki/items/CON/item.md",
			".codewiki/wiki/items/a/../item.md",
			".codewiki/wiki/items/a/item.txt",
			".codewiki/wiki/items/a/item?.md",
			".codewiki\\wiki\\items\\a\\item.md",
		]) {
			assert.throws(() => assertPortableWikiItemPath(path), /path|segment|Windows/u);
		}
	});

	it("rejects identity ambiguity and non-canonical Item bytes", async () => {
		assert.throws(
			() => createWikiItem({...validInput(), aliases: ["same", "same"]}),
			/duplicate-free/u,
		);
		assert.throws(
			() => createWikiItem({...validInput(), itemType: "policy"}),
			/namespaced/u,
		);
		assert.throws(
			() =>
				createWikiItem({
					...validInput(),
					attributes: {"codewiki.score": 1.5},
				}),
			/safe integer/u,
		);
		const valid = await readFile(new URL("policy.md", fixtureRoot), "utf8");
		const path = ".codewiki/wiki/items/policy/policy.md";
		for (const bytes of [
			valid.replace("\n", "\r\n"),
			valid.replace("# Policy", "# Policy "),
			valid.replace('{"aliases"', '{ "aliases"'),
			`${valid}\n`,
		]) {
			assert.throws(() => parseWikiItemFile(path, bytes));
		}
	});
});
