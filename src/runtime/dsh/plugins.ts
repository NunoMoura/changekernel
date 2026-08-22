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

export async function mountDshExecutionPlugins(input: {
	readonly context: Context;
	readonly systemPrompt: string;
	readonly sessionRoot: string;
	readonly continuation: RunContinuationBinding;
}): Promise<readonly Fiber[]> {
	const fibers: Fiber[] = [];
	fibers.push(await input.context.plugin(InvariantRegistry));
	fibers.push(await input.context.plugin(LlmRuntime));
	fibers.push(await input.context.plugin(SessionStore));
	fibers.push(await input.context.plugin(SystemPrompt, {persona: input.systemPrompt}));
	fibers.push(await input.context.plugin(ToolRuntime));
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
