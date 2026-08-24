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

import type {ManagedDshPluginDefinition} from "./managed-loader.ts";
import {
	SecureCodeRuntime,
	type SecureCodeRuntimeConfig,
} from "./secure-code-runtime.ts";

export interface DshCodeModeConfig {
	readonly runtime: SecureCodeRuntimeConfig;
	readonly maxParallelSubCalls: number;
}

export function createCoreDshPluginDefinitions(input: {
	readonly systemPrompt: string;
	readonly sessionRoot: string;
	readonly codeMode: DshCodeModeConfig | null;
}): readonly ManagedDshPluginDefinition[] {
	return [
		{
			entryId: "invariants",
			moduleName: "@deepseek-ai/dsh-invariants",
			plugin: InvariantRegistry,
		},
		{entryId: "llm", moduleName: "@deepseek-ai/dsh-llm", plugin: LlmRuntime},
		{
			entryId: "session",
			moduleName: "@deepseek-ai/dsh-session",
			plugin: SessionStore,
		},
		{
			entryId: "system-prompt",
			moduleName: "@deepseek-ai/dsh-system-prompt",
			plugin: SystemPrompt,
			config: {persona: input.systemPrompt},
		},
		...(input.codeMode
			? [
					{
						entryId: "secure-code-runtime",
						moduleName: "@nunomoura/codewiki/secure-code-runtime",
						plugin: SecureCodeRuntime,
						config: input.codeMode.runtime,
					} satisfies ManagedDshPluginDefinition,
				]
			: []),
		{
			entryId: "tools",
			moduleName: "@deepseek-ai/dsh-tools",
			plugin: ToolRuntime,
			config: {
				mode: input.codeMode ? "code" : "native",
				maxParallelSubCalls: input.codeMode?.maxParallelSubCalls ?? 1,
			},
		},
		{
			entryId: "agent",
			moduleName: "@deepseek-ai/dsh-agent",
			plugin: AgentRegistry,
		},
		{
			entryId: "session-persistence",
			moduleName: "@deepseek-ai/dsh-session-persistence-jsonl",
			plugin: JsonlSessionPersistence,
			config: {
				root: input.sessionRoot,
				compression: "none",
				packChunks: false,
				writeBatchMaxDelayMs: 1,
			},
		},
		{
			entryId: "agent-loop",
			moduleName: "@deepseek-ai/dsh-agent-loop",
			plugin: AgentLoop,
			config: {agents: []},
		},
		{
			entryId: "session-invariant",
			moduleName: "@deepseek-ai/dsh-session/invariant",
			plugin: SessionInvariant,
		},
		{
			entryId: "agent-invariant",
			moduleName: "@deepseek-ai/dsh-agent/invariant",
			plugin: AgentInvariant,
		},
		{
			entryId: "agent-loop-invariant",
			moduleName: "@deepseek-ai/dsh-agent-loop/invariant",
			plugin: AgentLoopInvariant,
		},
	];
}
