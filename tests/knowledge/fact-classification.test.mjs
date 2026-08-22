import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
	assertKnowledgeFactInventory,
	createKnowledgeFactInventory,
} from "../../src/knowledge/fact-classification.ts";
import {createKnowledgeCheckpoint} from "../../src/knowledge/state.ts";
import {canonicalJsonDigest} from "../../src/utils/canonical-json.ts";

function document(id, title) {
	return `---\ncodewiki_id: ${id}\ntype: System Component\ntitle: ${title}\nstatus: stable\n---\n# ${title}\n\n${title} meaning.\n`;
}

describe("Knowledge fact classification", () => {
	it("classifies every semantic cell, generated view, and Git realization exactly", () => {
		const checkpoint = createKnowledgeCheckpoint({
			files: [
				{path: "system/a.md", mediaType: "text/markdown", bytes: document("cw:component:a", "A")},
				{path: "views/a-index.md", mediaType: "text/markdown", bytes: document("cw:view:a-index", "A index")},
			],
		});
		const inventory = createKnowledgeFactInventory({
			checkpoint,
			acceptedSemanticTargetKeys: ["cw:component:a"],
			realizations: [
				{
					targetKey: "cw:component:a",
					sourceRefs: ["src/a.ts"],
					testRefs: ["tests/a.test.mjs"],
					treeDigest: canonicalJsonDigest({tree: "a"}),
				},
			],
		});
		assertKnowledgeFactInventory(inventory);
		assert.deepEqual({...inventory.counts}, {
			durable_seed: 2,
			accepted_semantic_cell: 1,
			deterministic_projection: 1,
			git_derived_realization: 1,
		});
		assert.equal(inventory.coverage, "complete");
	});

	it("rejects unsafe generated-view roots", () => {
		const checkpoint = createKnowledgeCheckpoint({files: []});
		assert.throws(
			() => createKnowledgeFactInventory({checkpoint, generatedViewPrefix: "../views"}),
			/generated view prefix is invalid/,
		);
	});
});
