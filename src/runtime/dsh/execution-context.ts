import type {Context} from "@deepseek-ai/cordis";
import type {Agent} from "@deepseek-ai/dsh-agent";
import GoalService, {type GoalView} from "@deepseek-ai/dsh-goal";
import * as GoalInvariant from "@deepseek-ai/dsh-goal/invariant";
import SessionProjectionRegistry from "@deepseek-ai/dsh-session-projection";
import TokenMeter from "@deepseek-ai/dsh-token-meter";
import ToolResultPruner from "@deepseek-ai/dsh-compaction-tool-result-pruner";

import type {RunContinuationBinding} from "../continuation.ts";
import type {RunRequest} from "../contracts.ts";
import type {ExecutionLedgerEntryInput} from "../evidence/execution-ledger.ts";
import {
	compactForContinuation,
	createCodeWikiCompactionPlugin,
} from "./compaction.ts";
import type {ManagedDshPluginDefinition} from "./managed-loader.ts";

interface ControlledGoalRound {
	readonly goalId: GoalView["id"];
	readonly revision: number;
	readonly round: number;
}

export function createDshContinuityPluginDefinitions(
	continuation: RunContinuationBinding,
): readonly ManagedDshPluginDefinition[] {
	return Object.freeze([
		...goalPluginDefinitions(continuation),
		...compactionPluginDefinitions(continuation),
	]);
}

export async function prepareDshContinuation(input: {
	readonly context: Context;
	readonly agent: Agent;
	readonly request: RunRequest;
	readonly prompt: string;
	readonly signal?: AbortSignal;
	readonly now: () => string;
	readonly record: (entry: ExecutionLedgerEntryInput) => void;
}): Promise<ControlledGoalRound | undefined> {
	const goal = input.request.continuation.goal.mode === "controlled"
		? prepareControlledGoal(input)
		: undefined;
	if (goal) {
		const flushed = await input.context.sessions.flush(input.agent.session);
		if (!flushed) throw new Error("DSH Goal activation has no persistence checkpoint.");
	}
	if (input.request.session.mode === "resume") {
		await compactResumedContinuation(input);
	}
	return goal
		? Object.freeze({
				goalId: goal.id,
				revision: goal.revision,
				round: goal.roundsStarted + 1,
			})
		: undefined;
}

export function pauseGoalAtCandidateBoundary(input: {
	readonly context: Context;
	readonly agent: Agent;
	readonly continuation: RunContinuationBinding;
}): void {
	if (input.continuation.goal.mode !== "controlled") return;
	const current = input.context.goals.get(input.agent);
	if (!current || current.phase !== "active") {
		throw new Error("Controlled Goal is not active at Candidate boundary.");
	}
	input.context.goals.pause(input.agent, current);
}

function goalPluginDefinitions(
	continuation: RunContinuationBinding,
): readonly ManagedDshPluginDefinition[] {
	if (continuation.goal.mode !== "controlled") return [];
	return [
		{
			entryId: "session-projection",
			moduleName: "@deepseek-ai/dsh-session-projection",
			plugin: SessionProjectionRegistry,
		},
		{
			entryId: "goal",
			moduleName: "@deepseek-ai/dsh-goal",
			plugin: GoalService,
			config: {defaultMaxGoalRounds: continuation.goal.maxRounds},
		},
		{
			entryId: "goal-invariant",
			moduleName: "@deepseek-ai/dsh-goal/invariant",
			plugin: GoalInvariant,
		},
	];
}

function compactionPluginDefinitions(
	continuation: RunContinuationBinding,
): readonly ManagedDshPluginDefinition[] {
	if (continuation.compaction.mode !== "predictive") return [];
	return [
		{
			entryId: "token-meter",
			moduleName: "@deepseek-ai/dsh-token-meter",
			plugin: TokenMeter,
		},
		{
			entryId: "tool-result-pruner",
			moduleName: "@deepseek-ai/dsh-compaction-tool-result-pruner",
			plugin: ToolResultPruner,
		},
		{
			entryId: "stage-compaction",
			moduleName: "@nunomoura/codewiki/stage-compaction",
			plugin: createCodeWikiCompactionPlugin(continuation),
		},
	];
}

function prepareControlledGoal(input: {
	readonly context: Context;
	readonly agent: Agent;
	readonly request: RunRequest;
	readonly prompt: string;
}): GoalView {
	const policy = input.request.continuation.goal;
	if (policy.mode !== "controlled") throw new Error("Controlled Goal policy is unavailable.");
	let current = input.context.goals.get(input.agent);
	if (input.request.session.mode === "create") {
		if (current) throw new Error("Fresh DSH Session already has a Goal.");
		return input.context.goals.create(input.agent, {
			objective: input.prompt,
			maxGoalRounds: policy.maxRounds,
		});
	}
	if (!current) throw new Error("Resumed DSH Session has no controlled Goal.");
	if (current.objective !== input.prompt || current.maxGoalRounds !== policy.maxRounds) {
		current = input.context.goals.edit(input.agent, current, {
			objective: input.prompt,
			maxGoalRounds: policy.maxRounds,
		});
	}
	return input.context.goals.resume(input.agent, current);
}

async function compactResumedContinuation(input: {
	readonly context: Context;
	readonly agent: Agent;
	readonly request: RunRequest;
	readonly signal?: AbortSignal;
	readonly now: () => string;
	readonly record: (entry: ExecutionLedgerEntryInput) => void;
}): Promise<void> {
	const observation = await compactForContinuation({
		context: input.context,
		agent: input.agent,
		binding: input.request.continuation,
		signal: input.signal,
	});
	if (!observation) return;
	input.record({
		kind: "compaction",
		occurredAt: input.now(),
		modelVisible: false,
		payload: observation,
	});
	if (observation.outcome === "unavailable") {
		throw new Error("Predictive compaction could not establish bounded continuation.");
	}
}
