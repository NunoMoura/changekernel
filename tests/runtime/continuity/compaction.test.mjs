import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
	COMPACTION_SUMMARY_PROTOCOL,
	RUN_CONTINUATION_PROTOCOL,
	assertRunContinuationBinding,
	createStageRunContinuationBinding,
} from "../../../src/runtime/continuation.ts";
import {createCodeWikiSummary} from "../../../src/runtime/dsh/compaction.ts";
import {canonicalJsonDigest, sha256Digest} from "../../../src/utils/canonical-json.ts";

const stages = ["decision", "planning", "implementation", "review"];

describe("stage-aware DSH continuity", () => {
	it("binds canonical authority promotion and predictive reserves for every stage", () => {
		for (const stage of stages) {
			const binding = stageBinding(stage);
			assert.equal(binding.protocol.version, "1.0.0");
			assert.equal(binding.protocol.name, RUN_CONTINUATION_PROTOCOL.name);
			assert.equal(binding.stage, stage);
			assert.equal(binding.goal.candidateAction, "pause");
			assert.equal(binding.goal.completionAuthority, "project-server");
			assert.equal(binding.compaction.mode, "predictive");
			assert.equal(Object.isFrozen(binding), true);
			assert.deepEqual(assertRunContinuationBinding(binding), binding);
		}
	});

	it("rejects tampered authority and internally inconsistent pressure policy", () => {
		const binding = stageBinding("planning");
		assert.throws(
			() => assertRunContinuationBinding({
				...binding,
				rehydration: {
					...binding.rehydration,
					authorityPromotionDigest: sha256Digest("tampered"),
				},
			}),
			/not canonical/,
		);
		assert.throws(
			() => createStageRunContinuationBinding({
				...stageInput("planning"),
				pressureThresholdTokens: 32_768,
			}),
			/internally inconsistent/,
		);
	});

	it("creates deterministic bounded non-authoritative semantic checkpoints", () => {
		const binding = stageBinding("review");
		const messages = [{
			role: "user",
			content: [{type: "text", text: "unresolved integration observation ".repeat(500)}],
		}];
		const summary = createCodeWikiSummary(binding, {messages});
		assert.equal(summary, createCodeWikiSummary(binding, {messages}));
		assert.match(summary, new RegExp(COMPACTION_SUMMARY_PROTOCOL.name));
		assert.match(summary, /non-authoritative model-surface projection/);
		assert.match(summary, new RegExp(binding.rehydration.authorityPromotionDigest));
		assert.match(summary, /shadowed bytes omitted/);
		assert.match(summary, new RegExp(canonicalJsonDigest(messages)));
		assert.ok(summary.length <= binding.compaction.maxSummaryCharacters);
	});
});

function stageBinding(stage) {
	return createStageRunContinuationBinding(stageInput(stage));
}

function stageInput(stage) {
	return {
		stage,
		objectiveDigest: sha256Digest(`${stage}-objective`),
		maxRounds: 4,
		semanticStateDigest: sha256Digest(`${stage}-state`),
		authorityPromotionDigest: sha256Digest(`${stage}-promotion`),
		unresolvedObligationsDigest: sha256Digest(`${stage}-obligations`),
		feedbackDigest: sha256Digest(`${stage}-feedback`),
		contextWindowTokens: 32_768,
		pressureThresholdTokens: 24_000,
		expectedNextRunInputTokens: 8_000,
		toolResultReserveTokens: 4_000,
		candidateOutputReserveTokens: 2_000,
		retainRecentTokens: 4_000,
		maxSummaryCharacters: 2_000,
	};
}
