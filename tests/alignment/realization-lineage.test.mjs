import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {projectAlignmentGraph} from "../../src/alignment/graph.ts";
import {frozenImplementationContext} from "../helpers/frozen-implementation.mjs";

describe("Alignment realization lineage", () => {
	it("projects accepted Effects through Work Units, Candidates, private Git, and aggregate", async () => {
		const context = await frozenImplementationContext();
		const graph = projectAlignmentGraph(context.state);
		const effectId = context.candidate.content.acceptanceSlice.knowledgeEffectIds[0];
		const aggregateNode = `implementation-aggregate:${context.freeze.aggregate.aggregateDigest}`;
		const edgeTypes = graph.edges
			.filter((edge) => edge.from === effectId || edge.to === effectId)
			.map((edge) => edge.type);
		assert.ok(graph.nodes.some((node) => node.id === effectId && node.type === "knowledge_effect"));
		assert.ok(edgeTypes.includes("revision_has_knowledge_effect"));
		assert.ok(edgeTypes.includes("knowledge_effect_assigned_to_work_unit"));
		assert.ok(edgeTypes.includes("knowledge_effect_realized_by_candidate"));
		assert.ok(edgeTypes.includes("knowledge_effect_admitted_to_private_lineage"));
		assert.ok(edgeTypes.includes("knowledge_effect_realized_by_aggregate"));
		assert.ok(graph.edges.some(
			(edge) => edge.type === "aggregate_has_commit" && edge.from === aggregateNode,
		));
		assert.ok(graph.edges.some(
			(edge) => edge.type === "aggregate_has_tree" && edge.from === aggregateNode,
		));
	});
});
