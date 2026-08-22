import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {runKnowledgeEncodingBenchmark} from "../../benchmarks/knowledge-effect-encoding.ts";
import {canonicalJsonDigest} from "../../src/utils/canonical-json.ts";

const baseHeader = "# Architecture\n\n";
const repeated = "Project Server owns canonical admission and guarded effects.\n".repeat(12);

function result(caseResult, method) {
	return caseResult.results.find((entry) => entry.method === method);
}

describe("Knowledge Effect encoding benchmark", () => {
	it("compares five encodings over terminology, architecture, and no-effect Changes", () => {
		const report = runKnowledgeEncodingBenchmark([
			{
				id: "terminology",
				baseDocument: `${baseHeader}${repeated}Use Work Item for executable work.\n`,
				targetDocument: `${baseHeader}${repeated}Use Work Unit for executable work.\n`,
				targetId: "cw:lexicon:work-unit",
				priorDigest: canonicalJsonDigest({value: "Work Item"}),
				newSemanticFragment: "Work Unit",
				sectionLocator: "Work Unit",
			},
			{
				id: "architecture",
				baseDocument: `${baseHeader}${repeated}Runtime integrates protected branches.\n`,
				targetDocument: `${baseHeader}${repeated}Project Server integrates only frozen aggregates.\n`,
				targetId: "cw:component:project-server#delivery",
				priorDigest: canonicalJsonDigest({value: "runtime integration"}),
				newSemanticFragment: "Project Server integrates only frozen aggregates.",
				sectionLocator: "delivery",
			},
			{
				id: "no-knowledge-effect",
				baseDocument: `${baseHeader}${repeated}`,
				targetDocument: `${baseHeader}${repeated}`,
				targetId: "cw:component:project-server",
				priorDigest: canonicalJsonDigest({value: "unchanged"}),
				newSemanticFragment: null,
			},
		]);
		assert.equal(report.cases.length, 3);
		for (const benchmarkCase of report.cases) {
			assert.deepEqual(
				benchmarkCase.results.map((entry) => entry.method),
				["full_document", "unified_diff", "byte_splice", "structural_section", "semantic_effect"],
			);
		}
		for (const benchmarkCase of report.cases.slice(0, 2)) {
			const semantic = result(benchmarkCase, "semantic_effect");
			assert.equal(semantic.repeatedBytes, 0);
			assert.equal(semantic.newFragmentCopies, 1);
			assert.ok(
				semantic.repeatedByteRatio <
					result(benchmarkCase, "full_document").repeatedByteRatio,
			);
		}
		const noEffect = report.cases[2];
		assert.ok(
			result(noEffect, "semantic_effect").encodedBytes <
				result(noEffect, "full_document").encodedBytes,
		);
	});
});
