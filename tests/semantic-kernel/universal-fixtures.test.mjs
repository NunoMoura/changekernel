import assert from "node:assert/strict";
import {readdir, readFile} from "node:fs/promises";
import {join, relative, sep} from "node:path";
import {describe, it} from "node:test";
import {
	parseChangeTrace,
	reduceChangeTrace,
	serializeChangeTrace,
} from "../../src/changes/trace/semantic-kernel.ts";
import {
	generatedWikiItemPath,
	parseWikiItemFile,
	serializeWikiItemFile,
} from "../../src/knowledge/wiki-item.ts";
import {validateWikiTree} from "../../src/knowledge/wiki-tree.ts";

const root = join(process.cwd(), "tests/fixtures/semantic-kernel/universal");
const scenarios = [
	"empty",
	"software",
	"research",
	"legal",
	"design",
	"music",
	"logistics",
];
const adversarialCases = new Map([
	["empty", "bootstrap and replay under Windows and POSIX path rules"],
	["software", "stale source head and overlapping Work Units"],
	["research", "later source Revision withdrawn after acceptance"],
	["legal", "mixed ACL synthesis and superseding policy"],
	["design", "binary asset changes while Wiki text remains unchanged"],
	["music", "revoked license and conflicting ownership assertion"],
	["logistics", "delayed provider revision and partial Delivery"],
]);

async function manifest(scenario) {
	return JSON.parse(await readFile(join(root, scenario, "manifest.json"), "utf8"));
}

async function filesBelow(directory) {
	const result = [];
	for (const entry of await readdir(directory, {withFileTypes: true})) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) result.push(...await filesBelow(path));
		else if (entry.isFile()) result.push(path);
		else throw new Error(`Fixture contains non-file entry ${path}.`);
	}
	return result.sort();
}

describe("universal Semantic Kernel fixtures", () => {
	it("covers exactly seven scenario families and their required adversarial cases", async () => {
		const actual = (await readdir(root, {withFileTypes: true}))
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();
		assert.deepEqual(actual, [...scenarios].sort());
		for (const scenario of scenarios) {
			const fixture = await manifest(scenario);
			assert.equal(fixture.scenario, scenario);
			assert.equal(fixture.adversarialCase, adversarialCases.get(scenario));
		}
	});

	it("represents empty Wiki and explicit empty requirements without synthetic state", async () => {
		const fixture = await manifest("empty");
		const requirements = JSON.parse(
			await readFile(join(root, "empty/completion-requirements.json"), "utf8"),
		);
		assert.deepEqual(requirements, []);
		assert.equal(fixture.changeId, null);
		assert.equal(fixture.expectedState, "empty");
		assert.equal(fixture.itemCount, 0);
		assert.equal(validateWikiTree([]).entries.length, 0);
	});

	it("round-trips every non-empty Wiki and Trace golden through identical contracts", async () => {
		let operationKinds;
		let headerKeys;
		let itemKeys;
		let proposalKeys;
		let requirementKeys;
		for (const scenario of scenarios.slice(1)) {
			const fixture = await manifest(scenario);
			const projectRoot = join(root, scenario, "project");
			const wikiRoot = join(projectRoot, ".codewiki/wiki/items");
			const wikiFiles = (await filesBelow(wikiRoot)).filter((path) => path.endsWith(".md"));
			const entries = [];
			for (const absolutePath of wikiFiles) {
				const path = relative(projectRoot, absolutePath).split(sep).join("/");
				const bytes = await readFile(absolutePath, "utf8");
				const item = parseWikiItemFile(path, bytes);
				assert.equal(generatedWikiItemPath(item.itemId), path);
				assert.equal(serializeWikiItemFile(item, "markdown"), bytes);
				entries.push({path, bytes});
				const keys = Object.keys(item).sort();
				itemKeys ??= keys;
				assert.deepEqual(keys, itemKeys);
			}
			const wiki = validateWikiTree(entries);
			assert.equal(wiki.entries.length, fixture.itemCount);
			const tracePath = join(
				projectRoot,
				`.codewiki/changes/TRACE-${fixture.changeId}.jsonl`,
			);
			const traceBytes = await readFile(tracePath, "utf8");
			const trace = parseChangeTrace(traceBytes);
			assert.equal(serializeChangeTrace(trace.header, trace.operations), traceBytes);
			assert.equal(reduceChangeTrace(trace).status, fixture.expectedState);
			const kinds = trace.operations.map(({kind}) => kind);
			operationKinds ??= kinds;
			assert.deepEqual(kinds, operationKinds);
			const currentHeaderKeys = Object.keys(trace.header).sort();
			headerKeys ??= currentHeaderKeys;
			assert.deepEqual(currentHeaderKeys, headerKeys);
			const proposed = trace.operations[0];
			const accepted = trace.operations.at(-1);
			assert.equal(proposed.kind, "change.proposed");
			assert.equal(accepted.kind, "change.accepted");
			const currentProposalKeys = Object.keys(proposed.payload).sort();
			proposalKeys ??= currentProposalKeys;
			assert.deepEqual(currentProposalKeys, proposalKeys);
			assert.equal(
				proposed.payload.completionRequirements.length,
				fixture.completionRequirementCount,
			);
			const acceptedIds = [...wiki.itemById.keys()].sort();
			assert.deepEqual(accepted.payload.acceptedItemIds, acceptedIds);
			assert.deepEqual(
				accepted.payload.completionRequirements,
				proposed.payload.completionRequirements,
			);
			for (const requirement of proposed.payload.completionRequirements) {
				const keys = Object.keys(requirement).sort();
				requirementKeys ??= keys;
				assert.deepEqual(keys, requirementKeys);
				for (const targetRef of requirement.targetRefs) {
					assert.equal(wiki.itemById.has(targetRef), true);
				}
			}
		}
	});
});
