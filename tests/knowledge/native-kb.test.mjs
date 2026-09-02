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
import {
	repositoryLegacyKnowledgeState,
	repositoryWikiState,
} from "../helpers/repository-wiki.mjs";

function knowledgeState() {
	const state = repositoryLegacyKnowledgeState();
	const documents = state.okfFiles.map(({path, content}) =>
		parseOkfDocument(path, content),
	);
	return {...state, documents};
}

function ownershipRows(components, field) {
	return components.flatMap((component) =>
		(component.attributes["codewiki.component:ownership"][field] ?? []).map(
			(value) => [value, component.itemId],
		),
	);
}

function hasConnection(diagram, expected) {
	return diagram.connections.some((connection) =>
		Object.entries(expected).every(([field, value]) =>
			value instanceof RegExp
				? value.test(connection[field])
				: connection[field] === value,
		),
	);
}

function assertSemanticTopology(diagrams) {
	const byId = new Map(diagrams.map((diagram) => [diagram.id, diagram]));
	for (const diagram of diagrams) {
		const connected = new Set(
			diagram.connections.flatMap(({from, to}) => [from, to]),
		);
		assert.deepEqual(
			diagram.components
				.filter(({id}) => !connected.has(id))
				.map(({id}) => id),
			[],
			`${diagram.id} cannot contain orphan components`,
		);
		for (const connection of diagram.connections.filter(
			({type}) => type === "authorizes",
		)) {
			assert.equal(
				connection.from,
				"project-server",
				`${diagram.id}:${connection.id} authority must originate at Project Server`,
			);
		}
		assert.equal(
			diagram.connections.some(
				({from, to}) => from === "project-server" && to === "change-trace",
			),
			false,
			`${diagram.id} must route durable Trace access through Project Store`,
		);
	}

	const architecture = byId.get("architecture");
	for (const component of [
		"project-store-port",
		"git-adapter",
		"check-runner-port",
		"check-adapter",
		"agent-runtime-port",
		"dsh-adapter",
		"preview",
	]) {
		assert.equal(
			architecture.components.some(({id}) => id === component),
			true,
			`architecture must expose ${component}`,
		);
	}
	for (const expected of [
		{from: "project-server", to: "project-store-port"},
		{from: "project-store-port", to: "git-adapter"},
		{from: "check-runner-port", to: "check-adapter"},
		{from: "agent-runtime-port", to: "dsh-adapter"},
	]) {
		assert.equal(hasConnection(architecture, expected), true);
	}
	assert.equal(
		hasConnection(architecture, {
			from: "project-server",
			to: "git-adapter",
		}),
		false,
	);
	assert.equal(
		hasConnection(architecture, {
			from: "package",
			to: "project-server",
			type: "produces",
		}),
		true,
	);
	assert.equal(
		hasConnection(architecture, {
			from: "dsh-adapter",
			to: "provider",
			label: /AI\/model/,
		}),
		true,
	);
	assert.equal(
		hasConnection(architecture, {
			from: "dsh-adapter",
			to: "preview",
			label: /preview\.work/,
		}),
		true,
	);
	assert.equal(
		hasConnection(architecture, {
			from: "check-adapter",
			to: "preview",
			label: /preview\.verify/,
		}),
		true,
	);
	assert.equal(
		hasConnection(architecture, {
			from: "checks",
			to: "evidence",
			type: "consumes",
		}),
		true,
	);

	const lifecycle = byId.get("lifecycle");
	for (const stage of ["decision", "planning", "implementation", "review"]) {
		assert.equal(
			lifecycle.connections.some(
				({from, to}) => from === stage && ["checks", "runtime"].includes(to),
			),
			false,
			`${stage} cannot dispatch its own Checks or Run`,
		);
	}
	assert.equal(
		hasConnection(lifecycle, {
			from: "project-server",
			to: "runtime",
			type: "authorizes",
		}),
		true,
	);
	assert.equal(
		lifecycle.components.find(({id}) => id === "plugins").concept,
		"cw:component:provider-boundary",
	);

	const runtime = byId.get("runtime");
	assert.equal(
		hasConnection(runtime, {
			from: "runtime",
			to: "agent-runtime-port",
			type: "queries",
		}),
		true,
	);
	assert.equal(
		runtime.connections.some(
			({from, to}) => from === "knowledge" && to === "runtime",
		),
		false,
	);
	assert.equal(
		hasConnection(runtime, {
			from: "runtime",
			to: "worktree",
			type: "reads",
		}),
		true,
	);
	assert.equal(
		hasConnection(runtime, {
			from: "runtime",
			to: "preview-port",
			label: /preview\.work/,
		}),
		true,
	);
	assert.equal(
		hasConnection(runtime, {
			from: "check-runner-port",
			to: "preview-port",
			label: /preview\.verify/,
		}),
		true,
	);
	assert.equal(
		hasConnection(runtime, {
			from: "runtime",
			to: "provider",
			label: /AI\/model/,
		}),
		true,
	);

	const synchronization = byId.get("synchronization");
	assert.equal(
		synchronization.components.find(({id}) => id === "plugins").concept,
		"cw:component:provider-boundary",
	);
	assert.equal(
		hasConnection(synchronization, {
			from: "project",
			to: "change-trace",
		}),
		true,
	);
}

describe("CodeWiki migrated Knowledge bundle", () => {
	it("validates active native Wiki ownership and diagram topology", () => {
		const {itemEntries, tree} = repositoryWikiState();
		const items = itemEntries.map(({item}) => item);
		const components = items.filter(({itemId}) => itemId.startsWith("cw:component:"));
		const flows = items.filter(({itemId}) => itemId.startsWith("cw:flow:"));
		const diagrams = items
			.filter(({itemId}) => itemId.startsWith("cw:diagram:"))
			.map(({body}) => JSON.parse(body));

		assert.equal(tree.entries.length, 47);
		assert.equal(components.length, 21);
		assert.equal(flows.length, 8);
		assert.equal(diagrams.length, 4);
		assert.equal(items.some(({itemId}) => itemId === "cw:component:semantic-kernel"), true);
		assert.equal(items.some(({itemId}) => itemId === "cw:component:domains"), false);
		assert.equal(
			items.some(({attributes}) => attributes["codewiki.legacy:terms"] !== undefined),
			false,
		);
		assert.equal(
			components.every(({attributes}) => {
				const ownership = attributes["codewiki.component:ownership"];
				return ownership && typeof ownership === "object" && !Array.isArray(ownership);
			}),
			true,
		);
		assert.deepEqual(
			ownershipRows(components, "roles").sort(),
			[
				["decision", "cw:component:decision"],
				["model-check", "cw:component:checks"],
				["planning", "cw:component:planning"],
				["review", "cw:component:review"],
				["worker", "cw:component:implementation"],
			],
		);
		assert.deepEqual(ownershipRows(components, "traceEvents"), []);
		const sourceOwners = new Map(ownershipRows(components, "sourcePatterns"));
		assert.equal(sourceOwners.get(".codewiki/config.json"), "cw:component:project");
		assert.equal(
			sourceOwners.get(".codewiki/check-packs.lock.json"),
			"cw:component:checks",
		);
		assert.equal(sourceOwners.get("package-lock.json"), "cw:component:package");
		assert.equal(sourceOwners.get("src/ports/preview.ts"), "cw:component:preview");
		const testOwners = new Map(ownershipRows(components, "testPatterns"));
		assert.equal(
			testOwners.get("tests/ports/preview.test.mjs"),
			"cw:component:preview",
		);

		for (const field of ["sourcePatterns", "testPatterns"]) {
			const patterns = components.flatMap((component) =>
				component.attributes["codewiki.component:ownership"][field]
					.map((pattern) => ({component: component.itemId, pattern})),
			);
			const overlaps = [];
			for (let index = 0; index < patterns.length; index += 1) {
				const left = patterns[index];
				const leftPrefix = left.pattern.replace(/\/\*\*$/, "");
				for (const right of patterns.slice(index + 1)) {
					if (left.component === right.component) continue;
					const rightPrefix = right.pattern.replace(/\/\*\*$/, "");
					if (
						leftPrefix === rightPrefix ||
						leftPrefix.startsWith(`${rightPrefix.replace(/\/$/, "")}/`) ||
						rightPrefix.startsWith(`${leftPrefix.replace(/\/$/, "")}/`)
					) {
						overlaps.push(`${left.component}:${left.pattern} <> ${right.component}:${right.pattern}`);
					}
				}
			}
			assert.deepEqual(overlaps, []);
		}

		assert.deepEqual(
			validateSystemDiagrams({
				diagrams,
				componentConcepts: components.map(({itemId}) => itemId),
				flowConcepts: flows.map(({itemId}) => itemId),
			}),
			[],
		);
		assertSemanticTopology(diagrams);
	});

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
