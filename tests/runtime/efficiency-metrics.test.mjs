import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
	assertStageEfficiencyMetrics,
	createStageEfficiencyMetrics,
	measureByteNovelty,
} from "../../src/runtime/efficiency-metrics.ts";

describe("stage efficiency metrics", () => {
	it("accounts exact stage token, byte novelty, expansion, cache, and amplification facts", () => {
		const current = "Current project state repeats this exact long sentence.\n";
		const output = `${current}New invariant: delivery requires aggregate Review.\n`;
		const metrics = createStageEfficiencyMetrics({
			stage: "review",
			tokens: {
				sourceTokens: 120,
				cachedInputTokens: 80,
				modelOutputTokens: 24,
				toolResultTokens: 16,
			},
			sourceTexts: [current],
			modelOutput: output,
			candidate: "delivery requires aggregate Review",
			editedByteLength: 12,
			activeChangeCount: 10,
			expandedActiveChangeCount: 2,
			cacheLookups: 8,
			cacheHits: 6,
		});
		assertStageEfficiencyMetrics(metrics);
		assert.ok(metrics.repeatedByteLength >= Buffer.byteLength(current) - 1);
		assert.equal(metrics.newByteLength + metrics.repeatedByteLength, metrics.modelOutputByteLength);
		assert.equal(metrics.activeChangeExpansion, 0.2);
		assert.equal(metrics.cacheHitRate, 0.75);
		assert.ok(metrics.candidateToEditAmplification > 1);
	});

	it("rejects impossible accounting and measures empty output deterministically", () => {
		assert.deepEqual(measureByteNovelty(["source"], ""), {
			totalBytes: 0,
			repeatedBytes: 0,
			newBytes: 0,
		});
		assert.throws(
			() =>
				createStageEfficiencyMetrics({
					stage: "decision",
					tokens: {
						sourceTokens: 1,
						cachedInputTokens: 0,
						modelOutputTokens: 1,
						toolResultTokens: 0,
					},
					sourceTexts: [],
					modelOutput: "x",
					candidate: "x",
					editedByteLength: 1,
					activeChangeCount: 1,
					expandedActiveChangeCount: 2,
					cacheLookups: 0,
					cacheHits: 0,
				}),
			/exceeds active Change count/,
		);
	});
});
