import type {Context} from "@deepseek-ai/cordis";
import type {Agent} from "@deepseek-ai/dsh-agent";
import BasicCompactionEngine, {
	type BasicCompactionConfig,
} from "@deepseek-ai/dsh-compaction-basic";
import type {ContentBlock, Message} from "@deepseek-ai/dsh-llm";
import "@deepseek-ai/dsh-token-meter";
import type {PruneResult} from "@deepseek-ai/dsh-compaction-tool-result-pruner";
import type {RunContinuationBinding} from "../continuation.ts";
import {COMPACTION_SUMMARY_PROTOCOL} from "../continuation.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

interface CodeWikiCompactionObservation {
	readonly protocol: typeof COMPACTION_SUMMARY_PROTOCOL;
	readonly continuationBindingDigest: Sha256Digest;
	readonly outcome: "not-needed" | "compacted" | "unavailable";
	readonly measuredTokens: number;
	readonly predictedTokens: number;
	readonly pressureThresholdTokens: number;
	readonly pruned: PruneResult["pruned"];
	readonly prunedCharacters: number;
	readonly compactionId: string | null;
	readonly shadowedSeqs: readonly number[];
	readonly summaryDigest: Sha256Digest | null;
}

export function createCodeWikiCompactionPlugin(
	binding: RunContinuationBinding,
): typeof BasicCompactionEngine {
	if (binding.compaction.mode !== "predictive") {
		throw new Error("CodeWiki compaction plugin requires predictive policy.");
	}
	const policy = binding.compaction;
	return class CodeWikiCompactionEngine extends BasicCompactionEngine {
		constructor(context: Context) {
			const config: BasicCompactionConfig = {
				auto: false,
				thresholdRatio: policy.pressureThresholdTokens / policy.contextWindowTokens,
				retainTokens: policy.retainRecentTokens,
				maxTokens: Math.max(1, Math.ceil(policy.maxSummaryCharacters / 4)),
				compactionRetries: 0,
				maxOverflowRetries: 0,
			};
			super(context, config);
		}

		protected override summarize(
			input: {readonly messages: readonly Message[]},
			_agent: Agent,
			_signal?: AbortSignal,
		) {
			const text = createCodeWikiSummary(binding, input);
			const summary: ContentBlock[] = [{type: "text", text}];
			return Promise.resolve({
				summary,
				provider: "codewiki",
				model: `${COMPACTION_SUMMARY_PROTOCOL.name}@${COMPACTION_SUMMARY_PROTOCOL.version}`,
				rawOutput: summary,
			});
		}
	};
}

export async function compactForContinuation(input: {
	readonly context: Context;
	readonly agent: Agent;
	readonly binding: RunContinuationBinding;
	readonly signal?: AbortSignal;
}): Promise<Readonly<CodeWikiCompactionObservation> | null> {
	const policy = input.binding.compaction;
	if (policy.mode !== "predictive") return null;
	const pruning = input.context.toolResultPruner.pruneSession(input.agent.session);
	const measurement = input.context.tokenMeter.measure(input.agent.session);
	const predictedTokens = measurement.totalTokens +
		policy.expectedNextRunInputTokens +
		policy.toolResultReserveTokens +
		policy.candidateOutputReserveTokens;
	if (predictedTokens < policy.pressureThresholdTokens) {
		return compactionObservation(input.binding, {
			outcome: "not-needed",
			measuredTokens: measurement.totalTokens,
			predictedTokens,
			pruning,
		});
	}
	const result = await input.context.compaction.compactNow(
		input.agent,
		input.signal ?? new AbortController().signal,
	);
	if (!result) {
		return compactionObservation(input.binding, {
			outcome: "unavailable",
			measuredTokens: measurement.totalTokens,
			predictedTokens,
			pruning,
		});
	}
	return Object.freeze({
		...compactionObservation(input.binding, {
			outcome: "compacted",
			measuredTokens: measurement.totalTokens,
			predictedTokens,
			pruning,
		}),
		compactionId: result.compactionId,
		shadowedSeqs: Object.freeze([...result.shadowedSeqs]),
		summaryDigest: canonicalJsonDigest(result.summary),
	});
}

export function createCodeWikiSummary(
	binding: RunContinuationBinding,
	input: {readonly messages: readonly Message[]},
): string {
	const policy = binding.compaction;
	if (policy.mode !== "predictive") {
		throw new Error("CodeWiki summary requires predictive compaction policy.");
	}
	const conversation = canonicalJson(input.messages);
	const prefix = [
		`<codewiki_compaction_checkpoint protocol="${COMPACTION_SUMMARY_PROTOCOL.name}@${COMPACTION_SUMMARY_PROTOCOL.version}">`,
		"This summary is a non-authoritative model-surface projection. Resolve authority from canonical rehydration bindings.",
		`stage: ${binding.stage}`,
		`semantic-state-digest: ${binding.rehydration.semanticStateDigest}`,
		`authority-promotion-digest: ${binding.rehydration.authorityPromotionDigest}`,
		`unresolved-obligations-digest: ${binding.rehydration.unresolvedObligationsDigest}`,
		`feedback-digest: ${binding.rehydration.feedbackDigest ?? "absent"}`,
		`shadowed-conversation-digest: ${canonicalJsonDigest(input.messages)}`,
		"shadowed-conversation:",
	].join("\n");
	const suffix = "\n</codewiki_compaction_checkpoint>";
	const conversationLimit = policy.maxSummaryCharacters - prefix.length - suffix.length - 1;
	if (conversationLimit <= 0) {
		throw new Error("CodeWiki compaction summary policy cannot fit its authority bindings.");
	}
	return `${prefix}\n${boundSummaryText(conversation, conversationLimit)}${suffix}`;
}

function compactionObservation(
	binding: RunContinuationBinding,
	input: {
		readonly outcome: CodeWikiCompactionObservation["outcome"];
		readonly measuredTokens: number;
		readonly predictedTokens: number;
		readonly pruning: PruneResult;
	},
): Readonly<CodeWikiCompactionObservation> {
	if (binding.compaction.mode !== "predictive") {
		throw new Error("Compaction observation requires predictive policy.");
	}
	return Object.freeze({
		protocol: COMPACTION_SUMMARY_PROTOCOL,
		continuationBindingDigest: binding.bindingDigest,
		outcome: input.outcome,
		measuredTokens: input.measuredTokens,
		predictedTokens: input.predictedTokens,
		pressureThresholdTokens: binding.compaction.pressureThresholdTokens,
		pruned: Object.freeze(input.pruning.pruned.map((entry) => Object.freeze({...entry}))),
		prunedCharacters: input.pruning.charsRemoved,
		compactionId: null,
		shadowedSeqs: Object.freeze([]),
		summaryDigest: null,
	});
}

function boundSummaryText(value: string, maximum: number): string {
	if (value.length <= maximum) return value;
	const marker = `\n...[shadowed bytes omitted; digest=${canonicalJsonDigest(value)}]...\n`;
	const remaining = maximum - marker.length;
	if (remaining <= 1) return marker.slice(0, maximum);
	const headLength = Math.ceil(remaining / 2);
	return `${value.slice(0, headLength)}${marker}${value.slice(-(remaining - headLength))}`;
}
