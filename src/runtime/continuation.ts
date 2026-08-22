import type {CheckStage} from "../checks/contracts.ts";
import {
	assertSha256Digest,
	canonicalJson,
	canonicalJsonDigest,
	type Sha256Digest,
} from "../utils/canonical-json.ts";

export const RUN_CONTINUATION_PROTOCOL = Object.freeze({
	name: "codewiki.run-continuation",
	version: "1.0.0",
});

export const COMPACTION_SUMMARY_PROTOCOL = Object.freeze({
	name: "codewiki.compaction-summary",
	version: "1.0.0",
});

export type RunGoalPolicy =
	| Readonly<{readonly mode: "disabled"}>
	| Readonly<{
		readonly mode: "controlled";
		readonly objectiveDigest: Sha256Digest;
		readonly maxRounds: number;
		readonly candidateAction: "pause";
		readonly completionAuthority: "project-server";
	}>;

export type RunCompactionPolicy =
	| Readonly<{readonly mode: "disabled"}>
	| Readonly<{
		readonly mode: "predictive";
		readonly contextWindowTokens: number;
		readonly pressureThresholdTokens: number;
		readonly expectedNextRunInputTokens: number;
		readonly toolResultReserveTokens: number;
		readonly candidateOutputReserveTokens: number;
		readonly retainRecentTokens: number;
		readonly maxSummaryCharacters: number;
	}>;

export interface CanonicalRehydrationBinding {
	readonly stage: CheckStage;
	readonly semanticStateDigest: Sha256Digest;
	readonly authorityPromotionDigest: Sha256Digest;
	readonly unresolvedObligationsDigest: Sha256Digest;
	readonly feedbackDigest: Sha256Digest | null;
}

export interface RunContinuationBinding {
	readonly protocol: typeof RUN_CONTINUATION_PROTOCOL;
	readonly stage: CheckStage;
	readonly goal: RunGoalPolicy;
	readonly compaction: RunCompactionPolicy;
	readonly rehydration: CanonicalRehydrationBinding;
	readonly bindingDigest: Sha256Digest;
}

export type RunContinuationBindingInput = Omit<RunContinuationBinding, "protocol" | "bindingDigest">;

export function createRunContinuationBinding(
	input: RunContinuationBindingInput,
): Readonly<RunContinuationBinding> {
	assertStage(input.stage);
	const goal = normalizeGoalPolicy(input.goal);
	const compaction = normalizeCompactionPolicy(input.compaction);
	const rehydration = normalizeRehydration(input.rehydration, input.stage);
	const body = {
		protocol: RUN_CONTINUATION_PROTOCOL,
		stage: input.stage,
		goal,
		compaction,
		rehydration,
	};
	return Object.freeze({...body, bindingDigest: canonicalJsonDigest(body)});
}

export function assertRunContinuationBinding(
	value: RunContinuationBinding,
): Readonly<RunContinuationBinding> {
	const normalized = createRunContinuationBinding(value);
	assertSha256Digest(value?.bindingDigest, "Run continuation binding digest");
	if (canonicalJson(normalized) !== canonicalJson(value)) {
		throw new Error("Run continuation binding is not canonical.");
	}
	return normalized;
}

export function createStageRunContinuationBinding(input: {
	readonly stage: CheckStage;
	readonly objectiveDigest: Sha256Digest;
	readonly maxRounds: number;
	readonly semanticStateDigest: Sha256Digest;
	readonly authorityPromotionDigest: Sha256Digest;
	readonly unresolvedObligationsDigest: Sha256Digest;
	readonly feedbackDigest: Sha256Digest | null;
	readonly contextWindowTokens: number;
	readonly pressureThresholdTokens: number;
	readonly expectedNextRunInputTokens: number;
	readonly toolResultReserveTokens: number;
	readonly candidateOutputReserveTokens: number;
	readonly retainRecentTokens: number;
	readonly maxSummaryCharacters: number;
}): Readonly<RunContinuationBinding> {
	return createRunContinuationBinding({
		stage: input.stage,
		goal: {
			mode: "controlled",
			objectiveDigest: input.objectiveDigest,
			maxRounds: input.maxRounds,
			candidateAction: "pause",
			completionAuthority: "project-server",
		},
		compaction: {
			mode: "predictive",
			contextWindowTokens: input.contextWindowTokens,
			pressureThresholdTokens: input.pressureThresholdTokens,
			expectedNextRunInputTokens: input.expectedNextRunInputTokens,
			toolResultReserveTokens: input.toolResultReserveTokens,
			candidateOutputReserveTokens: input.candidateOutputReserveTokens,
			retainRecentTokens: input.retainRecentTokens,
			maxSummaryCharacters: input.maxSummaryCharacters,
		},
		rehydration: {
			stage: input.stage,
			semanticStateDigest: input.semanticStateDigest,
			authorityPromotionDigest: input.authorityPromotionDigest,
			unresolvedObligationsDigest: input.unresolvedObligationsDigest,
			feedbackDigest: input.feedbackDigest,
		},
	});
}

export function createSingleRunContinuationBinding(input: {
	readonly stage: CheckStage;
	readonly semanticStateDigest: Sha256Digest;
	readonly feedbackDigest: Sha256Digest | null;
}): Readonly<RunContinuationBinding> {
	return createRunContinuationBinding({
		stage: input.stage,
		goal: {mode: "disabled"},
		compaction: {mode: "disabled"},
		rehydration: {
			stage: input.stage,
			semanticStateDigest: input.semanticStateDigest,
			authorityPromotionDigest: canonicalJsonDigest({
				stage: input.stage,
				mode: "single-run",
				semanticStateDigest: input.semanticStateDigest,
			}),
			unresolvedObligationsDigest: canonicalJsonDigest({stage: input.stage, obligations: []}),
			feedbackDigest: input.feedbackDigest,
		},
	});
}

function normalizeGoalPolicy(value: RunGoalPolicy): RunGoalPolicy {
	if (value?.mode === "disabled") return Object.freeze({mode: "disabled"});
	if (value?.mode !== "controlled") throw new Error("Run Goal policy mode is invalid.");
	assertSha256Digest(value.objectiveDigest, "Run Goal objective digest");
	assertPositiveInteger(value.maxRounds, "Run Goal maximum rounds");
	if (value.candidateAction !== "pause" || value.completionAuthority !== "project-server") {
		throw new Error("Run Goal authority policy is invalid.");
	}
	return Object.freeze({
		mode: value.mode,
		objectiveDigest: value.objectiveDigest,
		maxRounds: value.maxRounds,
		candidateAction: value.candidateAction,
		completionAuthority: value.completionAuthority,
	});
}

function normalizeCompactionPolicy(value: RunCompactionPolicy): RunCompactionPolicy {
	if (value?.mode === "disabled") return Object.freeze({mode: "disabled"});
	if (value?.mode !== "predictive") throw new Error("Run compaction policy mode is invalid.");
	const fields = [
		["contextWindowTokens", value.contextWindowTokens],
		["pressureThresholdTokens", value.pressureThresholdTokens],
		["expectedNextRunInputTokens", value.expectedNextRunInputTokens],
		["toolResultReserveTokens", value.toolResultReserveTokens],
		["candidateOutputReserveTokens", value.candidateOutputReserveTokens],
		["retainRecentTokens", value.retainRecentTokens],
		["maxSummaryCharacters", value.maxSummaryCharacters],
	] as const;
	for (const [field, fieldValue] of fields) assertPositiveInteger(fieldValue, `Run compaction ${field}`);
	if (value.maxSummaryCharacters < 1_024) {
		throw new Error("Run compaction summary bound is too small for canonical rehydration.");
	}
	const reserve = value.expectedNextRunInputTokens + value.toolResultReserveTokens + value.candidateOutputReserveTokens;
	if (
		value.pressureThresholdTokens >= value.contextWindowTokens ||
		value.retainRecentTokens >= value.pressureThresholdTokens ||
		reserve >= value.contextWindowTokens
	) {
		throw new Error("Run compaction token policy is internally inconsistent.");
	}
	return Object.freeze({
		mode: value.mode,
		contextWindowTokens: value.contextWindowTokens,
		pressureThresholdTokens: value.pressureThresholdTokens,
		expectedNextRunInputTokens: value.expectedNextRunInputTokens,
		toolResultReserveTokens: value.toolResultReserveTokens,
		candidateOutputReserveTokens: value.candidateOutputReserveTokens,
		retainRecentTokens: value.retainRecentTokens,
		maxSummaryCharacters: value.maxSummaryCharacters,
	});
}

function normalizeRehydration(
	value: CanonicalRehydrationBinding,
	stage: CheckStage,
): Readonly<CanonicalRehydrationBinding> {
	if (value?.stage !== stage) throw new Error("Run continuation rehydration stage does not match.");
	return Object.freeze({
		stage,
		semanticStateDigest: assertSha256Digest(value.semanticStateDigest, "Rehydration semantic state digest"),
		authorityPromotionDigest: assertSha256Digest(value.authorityPromotionDigest, "Rehydration authority promotion digest"),
		unresolvedObligationsDigest: assertSha256Digest(value.unresolvedObligationsDigest, "Rehydration unresolved obligations digest"),
		feedbackDigest: optionalDigest(value.feedbackDigest, "Rehydration feedback digest"),
	});
}

function optionalDigest(value: Sha256Digest | null, field: string): Sha256Digest | null {
	if (value === null) return null;
	return assertSha256Digest(value, field);
}

function assertStage(value: CheckStage): void {
	if (!(["decision", "planning", "implementation", "review"] as const).includes(value)) {
		throw new Error("Run continuation stage is invalid.");
	}
}

function assertPositiveInteger(value: number, field: string): void {
	if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer.`);
}
