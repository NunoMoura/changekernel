import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
	createWikiItem,
	generatedWikiItemPath,
	serializeWikiItemFile,
} from "../../src/knowledge/wiki-item.ts";
import {validateWikiTree} from "../../src/knowledge/wiki-tree.ts";

function item(itemId, overrides = {}) {
	return createWikiItem({
		itemId,
		itemType: "codewiki.statement",
		title: itemId,
		body: `${itemId} body.`,
		...overrides,
	});
}

function entry(value, path = generatedWikiItemPath(value.itemId)) {
	return {path, bytes: serializeWikiItemFile(value, "markdown")};
}

describe("complete Wiki tree validation", () => {
	it("resolves stable identity, aliases, relationships, and retired targets", () => {
		const architecture = item("cw:demo:item:architecture", {
			aliases: ["Architecture"],
		});
		const policy = item("cw:demo:item:policy", {
			aliases: ["Policy"],
			relationships: [
				{
					predicate: "codewiki.implements",
					targetItemId: architecture.itemId,
					attributes: {},
				},
				{
					predicate: "codewiki.supersedes",
					targetItemId: "cw:demo:item:retired-policy",
					attributes: {},
				},
			],
		});
		const tree = validateWikiTree([entry(policy), entry(architecture)], {
			retiredItemIds: ["cw:demo:item:retired-policy"],
		});
		assert.equal(tree.itemById.get(policy.itemId)?.title, policy.title);
		assert.equal(tree.entries[0]?.path < tree.entries[1]?.path, true);
	});

	it("rejects duplicate identities, ambiguous aliases, and unresolved targets", () => {
		const first = item("cw:demo:item:first", {aliases: ["shared"]});
		const duplicate = item("cw:demo:item:first", {title: "Duplicate"});
		assert.throws(
			() => validateWikiTree([
				entry(first, ".codewiki/wiki/items/a/first.md"),
				entry(duplicate, ".codewiki/wiki/items/b/duplicate.md"),
			]),
			/occurs at/u,
		);
		const second = item("cw:demo:item:second", {aliases: ["shared"]});
		assert.throws(() => validateWikiTree([entry(first), entry(second)]), /ambiguous/u);
		const dangling = item("cw:demo:item:dangling", {
			relationships: [{
				predicate: "codewiki.depends-on",
				targetItemId: "cw:demo:item:missing",
				attributes: {},
			}],
		});
		assert.throws(() => validateWikiTree([entry(dangling)]), /unresolved target/u);
	});

	it("rejects retired-ID reuse and cross-platform path collisions", () => {
		const current = item("cw:demo:item:current");
		assert.throws(
			() => validateWikiTree([entry(current)], {retiredItemIds: [current.itemId]}),
			/cannot be reused/u,
		);
		const other = item("cw:demo:item:other");
		assert.throws(
			() => validateWikiTree([
				entry(current, ".codewiki/wiki/items/Policy/current.md"),
				entry(other, ".codewiki/wiki/items/policy/current.md"),
			]),
			/Case-folding/u,
		);
	});
});
