import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateGraphDeltaPlanning } from "../../../src/loops/planning/graph-delta-quality.ts";

function workUnit(id, owningChangeId = "CHG-planned") {
	return {
		id,
		owningChangeId,
		title: id,
		outcome: `${id} is complete.`,
		technicalRequirements: ["Preserve graph authority."],
		knowledgeEffectIds: [],
		unchangedKnowledgeTargets: [],
		acceptanceRequirementIds: [`REQ-${id}`],
		componentRefs: ["planning"],
		pathScopes: [`src/${id}.ts`],
		verification: ["npm test"],
		resourceRequirements: {
			capabilityIds: ["source.edit"],
			toolIds: ["node-test"],
			skillIds: [],
			custodyRequirements: ["private-workbench"],
			consentRequirements: ["source-mutation"],
			privacyClass: "internal",
			budgetClass: "standard",
		},
	};
}

function quality(overrides = {}) {
	return evaluateGraphDeltaPlanning({
		changeId: "CHG-planned",
		workUnits: [workUnit("WU-new")],
		dependencyEdges: [],
		knowledgeEffectCoverage: [],
		unchangedKnowledgeCoverage: [],
		acceptanceCoverage: [
			{obligationId: "REQ-WU-new", workUnitIds: ["WU-new"]},
		],
		aggregateReviewRequirements: [
			{id: "AGR-new", statement: "Review new work.", workUnitIds: ["WU-new"]},
		],
		uiPreviewTargets: [],
		integrationRequirements: ["Integrate into private Change lineage."],
		amendment: null,
		rationale: "Map exact obligations.",
		workState: {
			workUnitIds: ["WU-foundation"],
			workUnits: [
				{
					id: "WU-foundation",
					dependsOn: [],
					pathScopes: ["src/foundation.ts"],
				},
			],
		},
		...overrides,
	});
}

describe("Change-scoped Planning graph quality", () => {
	it("admits explicit dependencies on existing cross-Change Work Units", () => {
		const result = quality({
			dependencyEdges: [
				{
					fromWorkUnitId: "WU-new",
					toWorkUnitId: "WU-foundation",
					kind: "requires",
				},
			],
		});
		assert.equal(result.passed, true);
	});

	it("rejects dependency edges that rewrite an existing Work Unit", () => {
		const result = quality({
			dependencyEdges: [
				{
					fromWorkUnitId: "WU-foundation",
					toWorkUnitId: "WU-new",
					kind: "requires",
				},
			],
		});
		assert.equal(result.passed, false);
		assert.equal(
			result.standards.find((standard) => standard.id === "dependency_graph")
				.status,
			"unmet",
		);
	});
});
