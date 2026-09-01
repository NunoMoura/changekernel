import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {validateCodeWikiKbBundle} from "../../src/domains/software-development/codewiki-kb-profile.ts";
import {
	assertKnowledgeFactInventory,
	createKnowledgeFactInventory,
} from "../../src/domains/software-development/fact-classification.ts";
import {createKnowledgeCheckpoint} from "../../src/knowledge/state.ts";
import { parseOkfDocument } from "../../src/knowledge/okf-frontmatter.ts";
import { analyzeOkfV02Document } from "../../src/knowledge/okf-v02.ts";
import { validateSystemDiagrams } from "../../src/domains/software-development/system-diagrams.ts";
import {repositoryLegacyKnowledgeState} from "../helpers/repository-wiki.mjs";

function knowledgeState() {
	const state = repositoryLegacyKnowledgeState();
	const documents = state.okfFiles.map(({path, content}) =>
		parseOkfDocument(path, content),
	);
	return {...state, documents};
}

describe("CodeWiki migrated Knowledge bundle", () => {
	it("classifies every retained legacy semantic file and cell as a durable seed", () => {
		const {legacyFiles} = knowledgeState();
		const checkpoint = createKnowledgeCheckpoint({
			files: legacyFiles,
		});
		const inventory = createKnowledgeFactInventory({checkpoint});
		assertKnowledgeFactInventory(inventory);
		assert.equal(
			inventory.entries.filter((entry) => entry.id.startsWith("knowledge-projection:")).length,
			legacyFiles.length,
		);
		assert.equal(inventory.counts.accepted_semantic_cell, 0);
		assert.equal(inventory.coverage, "complete");
	});

	it("retains canonical semantic documents and diagrams in Wiki migration metadata", () => {
		const {legacyFiles, documents, itemEntries, entries, tree} = knowledgeState();
		assert.equal(tree.entries.length, entries.length);
		assert.equal(
			legacyFiles.every(
				(file) =>
					file.path.endsWith(".md") ||
					/^system\/diagrams\/[a-z0-9-]+\.yaml$/.test(file.path),
			),
			true,
		);
		assert.deepEqual(validateCodeWikiKbBundle(documents), []);
		assert.equal(
			documents.some((document) => document.path === "lexicon.md"),
			false,
		);
		assert.equal(
			itemEntries.some(({item}) =>
				Array.isArray(item.attributes["codewiki.legacy:terms"]),
			),
			true,
		);
		assert.deepEqual(
			documents.flatMap((document) => analyzeOkfV02Document(document).issues),
			[],
		);
	});

	it("resolves every retained authored relationship to one Wiki Item", () => {
		const {documents} = knowledgeState();
		const concepts = new Set(documents.map((document) => document.conceptId));
		const unresolved = documents.flatMap((document) =>
			(document.frontmatter?.codewiki_relationships ?? []).flatMap(
				(relationship) =>
					concepts.has(relationship.target)
						? []
						: [`${document.path} -> ${relationship.target}`],
			),
		);
		assert.deepEqual(unresolved, []);
	});

	it("maps every stable Component and Flow to retained diagram topology and Product intent", () => {
		const {documents, diagrams} = knowledgeState();
		const components = documents.filter(
			(document) => document.frontmatter?.type === "System Component",
		);
		const flows = documents.filter(
			(document) => document.frontmatter?.type === "System Flow",
		);
		assert.deepEqual(
			validateSystemDiagrams({
				diagrams,
				componentConcepts: components.map((document) => document.conceptId),
				flowConcepts: flows.map((document) => document.conceptId),
			}),
			[],
		);
		const realizedStories = new Set();
		for (const document of [...components, ...flows]) {
			const relationships = document.frontmatter.codewiki_relationships ?? [];
			for (const relationship of relationships) {
				if (
					relationship.type === "realizes" &&
					relationship.target.startsWith("cw:story:")
				) {
					realizedStories.add(relationship.target);
				}
			}
			assert.equal(
				relationships.some(
					(relationship) =>
						relationship.type === "realizes" &&
						relationship.target.startsWith("cw:story:"),
				),
				true,
				`${document.path} must realize a Product Story`,
			);
		}
		for (const story of documents.filter(
			(document) =>
				document.frontmatter?.type === "User Story" &&
				document.frontmatter.status === "stable",
		)) {
			assert.equal(
				realizedStories.has(story.conceptId),
				true,
				`${story.path} must be realized by a Component or Flow`,
			);
		}
	});

	it("retains desired state rather than authored history or migration views", () => {
		const {documents} = knowledgeState();
		const forbiddenHeading = /^## (Current State|History|Migration|Status|Update Log|Completed Checklist)$/m;
		assert.deepEqual(
			documents.flatMap((document) =>
				forbiddenHeading.test(document.body) ? [document.path] : [],
			),
			[],
		);
	});
});
