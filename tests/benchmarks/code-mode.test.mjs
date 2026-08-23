import assert from "node:assert/strict";
import {test} from "node:test";

import {
	CODE_MODE_BENCHMARK_PROTOCOL,
	benchmarkProgrammaticContextModes,
} from "../../benchmarks/code-mode.ts";

function trace(mode, overrides = {}) {
	return {
		mode,
		source: "schema ".repeat(20),
		cachedPrefix: "stable ".repeat(20),
		modelOutput: "call ".repeat(10),
		toolResults: ["result ".repeat(20)],
		candidate: "candidate edit",
		editBytes: 14,
		reusedInputBytes: 100,
		turns: 2,
		latencyMs: 100,
		ledgerBytes: 1_000,
		compactionCount: 0,
		candidateQuality: 0.95,
		...overrides,
	};
}

test("Code Mode benchmark selects mode by exact workload rather than globally", () => {
	const lookup = benchmarkProgrammaticContextModes({
		workloadId: "single-lookup",
		qualityFloor: 0.9,
		traces: [
			trace("native-direct", {turns: 1, modelOutput: "call", toolResults: ["small"]}),
			trace("native-batch", {source: "batch schema ".repeat(40)}),
			trace("secure-code", {source: "typed sdk ".repeat(60), latencyMs: 200}),
		],
	});
	assert.equal(lookup.protocol, CODE_MODE_BENCHMARK_PROTOCOL);
	assert.equal(lookup.selectedMode, "native-direct");

	const reduction = benchmarkProgrammaticContextModes({
		workloadId: "multi-query-reduction",
		qualityFloor: 0.9,
		traces: [
			trace("native-direct", {
				modelOutput: "eight separate calls ".repeat(80),
				toolResults: ["full result ".repeat(200)],
				turns: 8,
				ledgerBytes: 12_000,
			}),
			trace("native-batch", {
				modelOutput: "one batch ".repeat(20),
				toolResults: ["batch result ".repeat(100)],
				turns: 2,
				ledgerBytes: 6_000,
			}),
			trace("secure-code", {
				source: "typed sdk ".repeat(30),
				modelOutput: "program ".repeat(20),
				toolResults: ["curated result"],
				turns: 2,
				ledgerBytes: 3_000,
			}),
		],
	});
	assert.equal(reduction.selectedMode, "secure-code");
	for (const measurement of reduction.measurements) {
		assert.equal(measurement.repeatedByteRatio + measurement.newByteRatio, 1);
		assert.equal(measurement.candidateToEditAmplification, 1);
		assert.match(measurement.traceDigest, /^sha256:[0-9a-f]{64}$/);
	}
	assert.match(reduction.reportDigest, /^sha256:[0-9a-f]{64}$/);
	assert.deepEqual(
		benchmarkProgrammaticContextModes({
			workloadId: "multi-query-reduction",
			qualityFloor: 0.9,
			traces: [
				trace("native-direct", {modelOutput: "eight separate calls ".repeat(80), toolResults: ["full result ".repeat(200)], turns: 8, ledgerBytes: 12_000}),
				trace("native-batch", {modelOutput: "one batch ".repeat(20), toolResults: ["batch result ".repeat(100)], turns: 2, ledgerBytes: 6_000}),
				trace("secure-code", {source: "typed sdk ".repeat(30), modelOutput: "program ".repeat(20), toolResults: ["curated result"], turns: 2, ledgerBytes: 3_000}),
			],
		}).reportDigest,
		reduction.reportDigest,
	);
});

test("Code Mode benchmark rejects low-quality savings and incomplete comparisons", () => {
	const report = benchmarkProgrammaticContextModes({
		workloadId: "quality-bound",
		qualityFloor: 0.9,
		traces: [
			trace("native-direct", {candidateQuality: 0.91}),
			trace("native-batch", {candidateQuality: 0.95, toolResults: ["small"]}),
			trace("secure-code", {candidateQuality: 0.7, toolResults: []}),
		],
	});
	assert.equal(report.selectedMode, "native-batch");
	assert.throws(
		() => benchmarkProgrammaticContextModes({
			workloadId: "incomplete",
			qualityFloor: 0.9,
			traces: [trace("native-direct"), trace("native-batch")],
		}),
		/requires exactly one trace for each mode/,
	);
});
