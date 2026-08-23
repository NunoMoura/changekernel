import type {Context, Fiber} from "@deepseek-ai/cordis";
import AgentRegistry from "@deepseek-ai/dsh-agent";
import * as AgentInvariant from "@deepseek-ai/dsh-agent/invariant";
import AgentLoop from "@deepseek-ai/dsh-agent-loop";
import * as AgentLoopInvariant from "@deepseek-ai/dsh-agent-loop/invariant";
import InvariantRegistry from "@deepseek-ai/dsh-invariants";
import LlmRuntime from "@deepseek-ai/dsh-llm";
import SessionStore from "@deepseek-ai/dsh-session";
import * as SessionInvariant from "@deepseek-ai/dsh-session/invariant";
import JsonlSessionPersistence from "@deepseek-ai/dsh-session-persistence-jsonl";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime from "@deepseek-ai/dsh-tools";

import type {RunContinuationBinding} from "../continuation.ts";
import {mountDshContinuityPlugins} from "./execution-context.ts";
import {
	normalizeSecureCodeRuntimeConfig,
	SecureCodeRuntime,
	type SecureCodeRuntimeConfig,
} from "./secure-code-runtime.ts";

export interface DshCodeModeConfig {
	readonly runtime: SecureCodeRuntimeConfig;
	readonly maxParallelSubCalls: number;
}

export function normalizeDshCodeModeConfig(
	value: unknown,
): Readonly<DshCodeModeConfig> {
	if (!isRecord(value) || !hasExactKeys(value, ["runtime", "maxParallelSubCalls"])) {
		throw new Error("DSH Code Mode config shape is invalid.");
	}
	if (
		!Number.isSafeInteger(value.maxParallelSubCalls) ||
		(value.maxParallelSubCalls as number) < 1 ||
		(value.maxParallelSubCalls as number) > 64
	) {
		throw new Error("DSH Code Mode maxParallelSubCalls is invalid.");
	}
	return Object.freeze({
		runtime: normalizeSecureCodeRuntimeConfig(value.runtime),
		maxParallelSubCalls: value.maxParallelSubCalls as number,
	});
}

export async function mountDshExecutionPlugins(input: {
	readonly context: Context;
	readonly systemPrompt: string;
	readonly sessionRoot: string;
	readonly continuation: RunContinuationBinding;
	readonly codeMode: DshCodeModeConfig | null;
}): Promise<readonly Fiber[]> {
	const fibers: Fiber[] = [];
	fibers.push(await input.context.plugin(InvariantRegistry));
	fibers.push(await input.context.plugin(LlmRuntime));
	fibers.push(await input.context.plugin(SessionStore));
	fibers.push(await input.context.plugin(SystemPrompt, {persona: input.systemPrompt}));
	if (input.codeMode) {
		fibers.push(await input.context.plugin(SecureCodeRuntime, input.codeMode.runtime));
	}
	fibers.push(await input.context.plugin(ToolRuntime, {
		mode: input.codeMode ? "code" : "native",
		maxParallelSubCalls: input.codeMode?.maxParallelSubCalls ?? 1,
	}));
	fibers.push(await input.context.plugin(AgentRegistry));
	fibers.push(await input.context.plugin(JsonlSessionPersistence, {
		root: input.sessionRoot,
		compression: "none",
		packChunks: false,
		writeBatchMaxDelayMs: 1,
	}));
	fibers.push(await input.context.plugin(AgentLoop, {agents: []}));
	fibers.push(await input.context.plugin(SessionInvariant));
	fibers.push(await input.context.plugin(AgentInvariant));
	fibers.push(await input.context.plugin(AgentLoopInvariant));
	await mountDshContinuityPlugins(input.context, input.continuation, fibers);
	return fibers;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
	value: Record<string, unknown>,
	expected: readonly string[],
): boolean {
	const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
	const wanted = [...expected].sort((left, right) => left.localeCompare(right));
	return keys.length === wanted.length && keys.every((key, index) => key === wanted[index]);
}
