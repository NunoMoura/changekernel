import type {CheckStage} from "../checks/contracts.ts";
import {
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../utils/canonical-json.ts";

export const STAGE_EFFICIENCY_METRICS_PROTOCOL = Object.freeze({
	id: "codewiki.stage-efficiency-metrics",
	version: "1.0.0",
} as const);

export interface StageTokenAccounting {
	readonly sourceTokens: number;
	readonly cachedInputTokens: number;
	readonly modelOutputTokens: number;
	readonly toolResultTokens: number;
}

export interface StageEfficiencyMetrics {
	readonly schemaVersion: typeof STAGE_EFFICIENCY_METRICS_PROTOCOL.version;
	readonly stage: CheckStage;
	readonly tokens: StageTokenAccounting;
	readonly sourceByteLength: number;
	readonly modelOutputByteLength: number;
	readonly candidateByteLength: number;
	readonly editedByteLength: number;
	readonly repeatedByteLength: number;
	readonly newByteLength: number;
	readonly repeatedByteRatio: number;
	readonly newByteRatio: number;
	readonly candidateToEditAmplification: number;
	readonly activeChangeCount: number;
	readonly expandedActiveChangeCount: number;
	readonly activeChangeExpansion: number;
	readonly cacheLookups: number;
	readonly cacheHits: number;
	readonly cacheHitRate: number;
	readonly digest: Sha256Digest;
}

export function createStageEfficiencyMetrics(input: {
	readonly stage: CheckStage;
	readonly tokens: StageTokenAccounting;
	readonly sourceTexts: readonly string[];
	readonly modelOutput: string;
	readonly candidate: string;
	readonly editedByteLength: number;
	readonly activeChangeCount: number;
	readonly expandedActiveChangeCount: number;
	readonly cacheLookups: number;
	readonly cacheHits: number;
}): StageEfficiencyMetrics {
	assertCounts(input);
	const sourceByteLength = input.sourceTexts.reduce(
		(total, text) => total + Buffer.byteLength(text),
		0,
	);
	const novelty = measureByteNovelty(input.sourceTexts, input.modelOutput);
	const candidateByteLength = Buffer.byteLength(input.candidate);
	const body = toCanonicalJsonValue({
		schemaVersion: STAGE_EFFICIENCY_METRICS_PROTOCOL.version,
		stage: input.stage,
		tokens: input.tokens,
		sourceByteLength,
		modelOutputByteLength: novelty.totalBytes,
		candidateByteLength,
		editedByteLength: input.editedByteLength,
		repeatedByteLength: novelty.repeatedBytes,
		newByteLength: novelty.newBytes,
		repeatedByteRatio: ratio(novelty.repeatedBytes, novelty.totalBytes),
		newByteRatio: ratio(novelty.newBytes, novelty.totalBytes),
		candidateToEditAmplification: ratio(candidateByteLength, input.editedByteLength),
		activeChangeCount: input.activeChangeCount,
		expandedActiveChangeCount: input.expandedActiveChangeCount,
		activeChangeExpansion: ratio(
			input.expandedActiveChangeCount,
			input.activeChangeCount,
		),
		cacheLookups: input.cacheLookups,
		cacheHits: input.cacheHits,
		cacheHitRate: ratio(input.cacheHits, input.cacheLookups),
	});
	// SAFETY: canonical conversion preserves validated numeric and text fields.
	return Object.freeze({
		...(body as unknown as Omit<StageEfficiencyMetrics, "digest">),
		digest: canonicalJsonDigest(body),
	});
}

export function assertStageEfficiencyMetrics(value: StageEfficiencyMetrics): void {
	if (value.schemaVersion !== STAGE_EFFICIENCY_METRICS_PROTOCOL.version) {
		throw new Error("Stage efficiency metrics schema version is invalid.");
	}
	for (const ratioValue of [
		value.repeatedByteRatio,
		value.newByteRatio,
		value.activeChangeExpansion,
		value.cacheHitRate,
	]) {
		if (ratioValue < 0 || ratioValue > 1 || !Number.isFinite(ratioValue)) {
			throw new Error("Stage efficiency ratio is invalid.");
		}
	}
	const {digest: _digest, ...body} = value;
	if (canonicalJsonDigest(body) !== value.digest) {
		throw new Error("Stage efficiency metrics digest is invalid.");
	}
}

export function measureByteNovelty(
	sourceTexts: readonly string[],
	output: string,
	minimumMatchBytes = 16,
): {readonly totalBytes: number; readonly repeatedBytes: number; readonly newBytes: number} {
	if (!Number.isSafeInteger(minimumMatchBytes) || minimumMatchBytes < 1) {
		throw new Error("Byte novelty minimum match must be a positive safe integer.");
	}
	const outputBytes = Buffer.from(output);
	if (outputBytes.length === 0) return {totalBytes: 0, repeatedBytes: 0, newBytes: 0};
	const sourceWindows = new Set<string>();
	for (const sourceText of sourceTexts) {
		const source = Buffer.from(sourceText);
		for (let index = 0; index + minimumMatchBytes <= source.length; index += 1) {
			sourceWindows.add(
				source.subarray(index, index + minimumMatchBytes).toString("base64"),
			);
		}
	}
	const repeated = new Uint8Array(outputBytes.length);
	for (let index = 0; index + minimumMatchBytes <= outputBytes.length; index += 1) {
		const window = outputBytes
			.subarray(index, index + minimumMatchBytes)
			.toString("base64");
		if (!sourceWindows.has(window)) continue;
		repeated.fill(1, index, index + minimumMatchBytes);
	}
	const repeatedBytes = repeated.reduce((total, value) => total + value, 0);
	return {
		totalBytes: outputBytes.length,
		repeatedBytes,
		newBytes: outputBytes.length - repeatedBytes,
	};
}

function assertCounts(input: {
	readonly tokens: StageTokenAccounting;
	readonly editedByteLength: number;
	readonly activeChangeCount: number;
	readonly expandedActiveChangeCount: number;
	readonly cacheLookups: number;
	readonly cacheHits: number;
}): void {
	const counts = {
		...input.tokens,
		editedByteLength: input.editedByteLength,
		activeChangeCount: input.activeChangeCount,
		expandedActiveChangeCount: input.expandedActiveChangeCount,
		cacheLookups: input.cacheLookups,
		cacheHits: input.cacheHits,
	};
	for (const [field, value] of Object.entries(counts)) {
		if (!Number.isSafeInteger(value) || value < 0) {
			throw new Error(`Stage efficiency ${field} must be a non-negative safe integer.`);
		}
	}
	if (input.expandedActiveChangeCount > input.activeChangeCount) {
		throw new Error("Expanded active Change count exceeds active Change count.");
	}
	if (input.cacheHits > input.cacheLookups) {
		throw new Error("Stage efficiency cache hits exceed cache lookups.");
	}
}

function ratio(numerator: number, denominator: number): number {
	if (denominator === 0) return 0;
	return Math.round((numerator / denominator) * 1_000_000) / 1_000_000;
}
