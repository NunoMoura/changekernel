import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {createKnowledgePostStateArtifact} from "../../src/changes/trace/identity.ts";
import {compileKnowledgeTransition} from "../../src/knowledge/materialization.ts";
import {
	createKnowledgeCheckpoint,
	knowledgeCellByTarget,
} from "../../src/knowledge/state.ts";

function document(subjectId, title, meaning) {
	return `---\ncodewiki_id: ${subjectId}\ntype: System Component\ntitle: ${title}\nstatus: stable\n---\n# ${title}\n\n${meaning}\n`;
}

function setTransition(base, subjectId, title, meaning) {
	const target = {subjectId};
	return {
		kind: "effects",
		effects: [
			{
				action: "set",
				target,
				expected: knowledgeCellByTarget(base, target)?.digest ?? "absent",
				postState: createKnowledgePostStateArtifact({
					mediaType: "text/markdown",
					content: document(subjectId, title, meaning),
				}),
			},
		],
	};
}

describe("representative Knowledge history replay", () => {
	it("reconstructs ownership 0d3b852, accepted-active c433150, broad ratification, and unchanged defect bytes", () => {
		const seed = createKnowledgeCheckpoint({files: []});
		const transitions = [];
		let current = seed;
		for (const [subjectId, title, meaning] of [
			[
				"cw:component:runtime",
				"Runtime ownership cut 0d3b852",
				"Runtime executes bounded work; Project Server alone owns canonical effects.",
			],
			[
				"cw:component:accepted-active-changes",
				"Accepted active Changes c433150",
				"Decision compatibility binds every accepted nonterminal Change revision.",
			],
			[
				"cw:component:knowledge-architecture",
				"Broad Knowledge architecture ratification",
				"Confirmed Effects reduce stable desired Knowledge and exact projections.",
			],
		]) {
			const transition = setTransition(current, subjectId, title, meaning);
			transitions.push(transition);
			current = compileKnowledgeTransition({base: current, transition}).projected;
		}
		const unchanged = {
			kind: "unchanged",
			refs: [{subjectId: "cw:component:runtime"}],
			rationale: "Defect changes realization only; accepted desired Knowledge remains correct.",
		};
		transitions.push(unchanged);
		current = compileKnowledgeTransition({base: current, transition: unchanged}).projected;

		let replayed = seed;
		for (const transition of transitions) {
			replayed = compileKnowledgeTransition({base: replayed, transition}).projected;
		}
		assert.equal(replayed.state.stateDigest, current.state.stateDigest);
		assert.equal(
			replayed.projection.projectionDigest,
			current.projection.projectionDigest,
		);
		assert.deepEqual(
			structuredClone(replayed.projection.files),
			structuredClone(current.projection.files),
		);
	});

	it("rejects conflicting replay against an already advanced target", () => {
		const seed = createKnowledgeCheckpoint({files: []});
		const first = setTransition(
			seed,
			"cw:component:runtime",
			"Runtime",
			"First accepted meaning.",
		);
		const advanced = compileKnowledgeTransition({base: seed, transition: first}).projected;
		assert.throws(
			() => compileKnowledgeTransition({base: advanced, transition: first}),
			/expected absent/u,
		);
	});
});
