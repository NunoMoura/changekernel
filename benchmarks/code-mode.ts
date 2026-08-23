import {Buffer} from "node:buffer";

import {canonicalJsonDigest, type Sha256Digest} from "../src/utils/canonical-json.ts";

export const CODE_MODE_BENCHMARK_PROTOCOL = "codewiki.code-mode-benchmark@1.0.0" as const;

type ProgrammaticContextMode = "native-direct" | "native-batch" | "secure-code";

interface ProgrammaticContextBenchmarkTrace {
	readonly mode: ProgrammaticContextMode;
	readonly source: string;
	readonly cachedPrefix: string;
	readonly modelOutput: string;
	readonly toolResults: readonly string[];
	readonly candidate: string;
	readonly editBytes: number;
	readonly reusedInputBytes: number;
	readonly turns: number;
	readonly latencyMs: number;
	readonly ledgerBytes: number;
	readonly compactionCount: number;
	readonly candidateQuality: number;
}

interface ProgrammaticContextBenchmarkMetrics {
	readonly mode: ProgrammaticContextMode;
	readonly sourceTokens: number;
	readonly cachedInputTokens: number;
	readonly modelOutputTokens: number;
	readonly toolResultTokens: number;
	readonly repeatedByteRatio: number;
	readonly newByteRatio: number;
	readonly candidateToEditAmplification: number | null;
	readonly turns: number;
	readonly totalBytes: number;
	readonly latencyMs: number;
	readonly ledgerBytes: number;
	readonly compactionCount: number;
	readonly candidateQuality: number;
	readonly traceDigest: Sha256Digest;
}

interface ProgrammaticContextBenchmarkReport {
	readonly protocol: typeof CODE_MODE_BENCHMARK_PROTOCOL;
	readonly workloadId: string;
	readonly qualityFloor: number;
	readonly measurements: readonly ProgrammaticContextBenchmarkMetrics[];
	readonly selectedMode: ProgrammaticContextMode | null;
	readonly reportDigest: Sha256Digest;
}

export function benchmarkProgrammaticContextModes(input: {
	readonly workloadId: string;
	readonly qualityFloor: number;
	readonly traces: readonly ProgrammaticContextBenchmarkTrace[];
}): Readonly<ProgrammaticContextBenchmarkReport> {
	if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(input.workloadId)) {
		throw new Error("Code Mode benchmark workload id is invalid.");
	}
	if (!finiteRatio(input.qualityFloor)) {
		throw new Error("Code Mode benchmark quality floor must be between zero and one.");
	}
	const modes = new Set(input.traces.map(({mode}) => mode));
	if (modes.size !== 3 || input.traces.length !== 3) {
		throw new Error("Code Mode benchmark requires exactly one trace for each mode.");
	}
	const measurements = input.traces
		.map(measureTrace)
		.sort((left, right) => left.mode.localeCompare(right.mode));
	const eligible = measurements
		.filter(({candidateQuality}) => candidateQuality >= input.qualityFloor)
		.sort(compareMeasurements);
	const body = {
		protocol: CODE_MODE_BENCHMARK_PROTOCOL,
		workloadId: input.workloadId,
		qualityFloor: input.qualityFloor,
		measurements,
		selectedMode: eligible[0]?.mode ?? null,
	};
	return Object.freeze({
		...body,
		measurements: Object.freeze(measurements),
		reportDigest: canonicalJsonDigest(body),
	});
}

function measureTrace(
	trace: ProgrammaticContextBenchmarkTrace,
): ProgrammaticContextBenchmarkMetrics {
	assertTrace(trace);
	const sourceBytes = bytes(trace.source);
	const cachedBytes = bytes(trace.cachedPrefix);
	const modelOutputBytes = bytes(trace.modelOutput);
	const toolResultBytes = trace.toolResults.reduce((total, value) => total + bytes(value), 0);
	const candidateBytes = bytes(trace.candidate);
	const totalBytes = sourceBytes + cachedBytes + modelOutputBytes + toolResultBytes + candidateBytes;
	const repeatedBytes = Math.min(trace.reusedInputBytes, totalBytes);
	return Object.freeze({
		mode: trace.mode,
		sourceTokens: tokens(sourceBytes),
		cachedInputTokens: tokens(cachedBytes),
		modelOutputTokens: tokens(modelOutputBytes),
		toolResultTokens: tokens(toolResultBytes),
		repeatedByteRatio: ratio(repeatedBytes, totalBytes),
		newByteRatio: ratio(totalBytes - repeatedBytes, totalBytes),
		candidateToEditAmplification: trace.editBytes === 0
			? null
			: candidateBytes / trace.editBytes,
		turns: trace.turns,
		totalBytes,
		latencyMs: trace.latencyMs,
		ledgerBytes: trace.ledgerBytes,
		compactionCount: trace.compactionCount,
		candidateQuality: trace.candidateQuality,
		traceDigest: canonicalJsonDigest(trace),
	});
}

function compareMeasurements(
	left: ProgrammaticContextBenchmarkMetrics,
	right: ProgrammaticContextBenchmarkMetrics,
): number {
	return (
		totalTokens(left) - totalTokens(right) ||
		left.turns - right.turns ||
		left.ledgerBytes - right.ledgerBytes ||
		left.latencyMs - right.latencyMs ||
		right.candidateQuality - left.candidateQuality ||
		left.mode.localeCompare(right.mode)
	);
}

function totalTokens(value: ProgrammaticContextBenchmarkMetrics): number {
	return value.sourceTokens + value.cachedInputTokens + value.modelOutputTokens + value.toolResultTokens;
}

function assertTrace(trace: ProgrammaticContextBenchmarkTrace): void {
	if (!(trace.mode === "native-direct" || trace.mode === "native-batch" || trace.mode === "secure-code")) {
		throw new Error("Code Mode benchmark trace mode is invalid.");
	}
	for (const field of [
		"editBytes",
		"reusedInputBytes",
		"turns",
		"latencyMs",
		"ledgerBytes",
		"compactionCount",
	] as const) {
		if (!Number.isSafeInteger(trace[field]) || trace[field] < 0) {
			throw new Error(`Code Mode benchmark ${field} must be a non-negative safe integer.`);
		}
	}
	if (trace.turns < 1 || !finiteRatio(trace.candidateQuality)) {
		throw new Error("Code Mode benchmark turns or Candidate quality is invalid.");
	}
}

function bytes(value: string): number {
	return Buffer.byteLength(value, "utf8");
}

function tokens(byteCount: number): number {
	return Math.ceil(byteCount / 4);
}

function ratio(numerator: number, denominator: number): number {
	return denominator === 0 ? 0 : numerator / denominator;
}

function finiteRatio(value: number): boolean {
	return Number.isFinite(value) && value >= 0 && value <= 1;
}
