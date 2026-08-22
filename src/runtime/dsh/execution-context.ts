import type {Context, Fiber} from "@deepseek-ai/cordis";
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

interface ControlledGoalRound {
	readonly goalId: GoalView["id"];
	readonly revision: number;
	readonly round: number;
}

export async function mountDshContinuityPlugins(
	context: Context,
	continuation: RunContinuationBinding,
	fibers: Fiber[],
): Promise<void> {
	await mountGoalContext(context, continuation, fibers);
	await mountCompactionContext(context, continuation, fibers);
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

async function mountGoalContext(
	context: Context,
	continuation: RunContinuationBinding,
	fibers: Fiber[],
): Promise<void> {
	if (continuation.goal.mode !== "controlled") return;
	fibers.push(await context.plugin(SessionProjectionRegistry));
	fibers.push(await context.plugin(GoalService, {
		defaultMaxGoalRounds: continuation.goal.maxRounds,
	}));
	fibers.push(await context.plugin(GoalInvariant));
}

async function mountCompactionContext(
	context: Context,
	continuation: RunContinuationBinding,
	fibers: Fiber[],
): Promise<void> {
	if (continuation.compaction.mode !== "predictive") return;
	fibers.push(await context.plugin(TokenMeter));
	fibers.push(await context.plugin(ToolResultPruner));
	fibers.push(await context.plugin(createCodeWikiCompactionPlugin(continuation)));
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
