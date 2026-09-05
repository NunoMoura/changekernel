import {Context, type Fiber} from "@deepseek-ai/cordis";
import AgentRegistry, {type AgentHandle} from "@deepseek-ai/dsh-agent";
import AgentLoop from "@deepseek-ai/dsh-agent-loop";
import * as AgentLoopInvariant from "@deepseek-ai/dsh-agent-loop/invariant";
import * as AgentInvariant from "@deepseek-ai/dsh-agent/invariant";
import InvariantRegistry from "@deepseek-ai/dsh-invariants";
import LlmRegistry, {createUserMessage} from "@deepseek-ai/dsh-llm";
import SessionStore, {SessionId, type SessionEvent} from "@deepseek-ai/dsh-session";
import * as SessionInvariant from "@deepseek-ai/dsh-session/invariant";
import JsonlSessionPersistence from "@deepseek-ai/dsh-session-persistence-jsonl";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime from "@deepseek-ai/dsh-tools";
import {isAbsolute} from "node:path";

import {semanticDigest} from "../../kernel/identity/semantic-digest.ts";
import {sha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {agentRunContextMaterialDigest, decodeAgentRunAuthorization, type AgentRunAuthorization, type AgentRunOutcome} from "../../ports/agent-runtime.ts";

export const DSH_SESSION_RUNNER_PROTOCOL = Object.freeze({id: "codewiki.dsh-session-runner", version: "1.0.0"} as const);

export interface DshRunMaterial {
	readonly systemPrompt: string;
	readonly prompt: string;
	readonly workspacePath: string;
	readonly sessionRoot: string;
	readonly sessionId: string;
	readonly resume: boolean;
}

export interface DshProviderLease {
	readonly providerReceiptDigest: Sha256Digest | null;
	readonly assertComplete?: () => void;
	dispose(): void | Promise<void>;
}

export type DshProviderInstaller = (
	context: Context,
	authorization: AgentRunAuthorization,
) => DshProviderLease | Promise<DshProviderLease>;

export interface DshSessionRunResult {
	readonly protocol: typeof DSH_SESSION_RUNNER_PROTOCOL;
	readonly runId: string;
	readonly authorizationDigest: Sha256Digest;
	readonly outcome: AgentRunOutcome;
	readonly startedAt: string;
	readonly finishedAt: string;
	readonly output: string | null;
	readonly outputDigest: Sha256Digest | null;
	readonly usageDigest: Sha256Digest | null;
	readonly providerReceiptDigest: Sha256Digest | null;
	readonly sessionReceiptDigest: Sha256Digest;
	readonly rawSessionDigest: Sha256Digest;
	readonly eventCount: number;
}

export interface RunDshSessionInput {
	readonly authorization: AgentRunAuthorization;
	readonly material: DshRunMaterial;
	readonly installProvider: DshProviderInstaller;
	readonly signal?: AbortSignal;
	readonly clock?: () => string;
}

interface DshExecution {
	readonly context: Context;
	readonly fibers: readonly Fiber[];
	readonly agent: AgentHandle;
	readonly provider: DshProviderLease;
	readonly removeCancellation?: () => void;
}

/**
 * Runs one already-authorized DSH Session without owning semantic policy.
 * Process containment belongs to the qualified Execution Host around this function.
 */
export async function runDshSession(input: RunDshSessionInput): Promise<DshSessionRunResult> {
	validateRunInput(input);
	const now = input.clock ?? systemTimestamp;
	const startedAt = now();
	const execution = await createExecution(input);
	try {
		execution.agent.agent.followup(createUserMessage({
			content: [{type: "text", text: input.material.prompt}],
			source: {kind: "user"},
		}));
		await execution.agent.agent.whenIdle();
		await execution.context.sessions.flush(execution.agent.agent.session);
		const finishedAt = now();
		const completed = execution.agent.agent.session.events.some((event) => event?.type === "turn/end" && event.data.reason.kind === "completed") && input.signal?.aborted !== true;
		if (completed) execution.provider.assertComplete?.();
		return await buildResult(input, execution, startedAt, finishedAt);
	} finally {
		await disposeExecution(execution);
	}
}

async function createExecution(input: RunDshSessionInput): Promise<DshExecution> {
	const context = new Context();
	const fibers = await mountCoreDsh(context, input.material);
	let provider: DshProviderLease | undefined;
	let agent: AgentHandle | undefined;
	try {
		provider = await input.installProvider(context, input.authorization);
		const agentOptions = {
			provider: input.authorization.route.providerId,
			model: input.authorization.route.modelId,
			maxTokens: input.authorization.budget.maximumOutputTokens,
		};
		agent = input.material.resume
			? await context.agents.resume({resumeSessionId: SessionId(input.material.sessionId), agentOptions, signal: input.signal})
			: await context.agents.create({
				sessionId: SessionId(input.material.sessionId),
				meta: {cwd: input.material.workspacePath},
				agentOptions,
				signal: input.signal,
			});
		return Object.freeze({context, fibers, agent, provider, removeCancellation: bindCancellation(agent, input.signal)});
	} catch (error) {
		if (agent) await agent.dispose();
		if (provider) await provider.dispose();
		await disposeFibers(fibers);
		throw error;
	}
}

async function mountCoreDsh(context: Context, material: DshRunMaterial): Promise<readonly Fiber[]> {
	const fibers: Fiber[] = [];
	try {
		fibers.push(await context.plugin(InvariantRegistry));
		fibers.push(await context.plugin(LlmRegistry));
		fibers.push(await context.plugin(SessionStore));
		fibers.push(await context.plugin(SystemPrompt, {includeHarnessIdentity: false, includeRuntimeContext: true, persona: material.systemPrompt}));
		fibers.push(await context.plugin(ToolRuntime));
		fibers.push(await context.plugin(AgentRegistry));
		fibers.push(await context.plugin(JsonlSessionPersistence, {root: material.sessionRoot, compression: "none", packChunks: false}));
		fibers.push(await context.plugin(AgentLoop, {agents: [], maxParallelToolCalls: 1}));
		fibers.push(await context.plugin(SessionInvariant));
		fibers.push(await context.plugin(AgentInvariant));
		fibers.push(await context.plugin(AgentLoopInvariant));
		return Object.freeze(fibers);
	} catch (error) {
		await disposeFibers(fibers);
		throw error;
	}
}

async function buildResult(
	input: RunDshSessionInput,
	execution: DshExecution,
	startedAt: string,
	finishedAt: string,
): Promise<DshSessionRunResult> {
	const events = execution.agent.agent.session.events;
	const outcome = runOutcome(events, input.signal?.aborted === true);
	const output = outcome === "completed" ? finalAssistantText(events) : null;
	const outputDigest = output === null ? null : semanticValueDigest("codewiki.agent-output@1.0.0", {text: output});
	const usage = events.flatMap((event) => event.type === "assistant/message" && event.data.usage ? [event.data.usage] : []);
	const usageDigest = usage.length === 0 ? null : semanticValueDigest("codewiki.agent-usage@1.0.0", usage);
	const raw = await execution.context.sessionPersistence.readRaw(SessionId(input.material.sessionId));
	if (!raw) throw new Error("DSH Session raw receipt is unavailable.");
	const rawSessionDigest = sha256Digest(raw.content);
	const sessionReceiptDigest = semanticValueDigest("codewiki.dsh-session-receipt@1.0.0", {
		runId: input.authorization.runId,
		sessionId: input.material.sessionId,
		formatVersion: raw.meta.version,
		rawSessionDigest,
		eventCount: events.length,
	});
	return Object.freeze({
		protocol: DSH_SESSION_RUNNER_PROTOCOL,
		runId: input.authorization.runId,
		authorizationDigest: input.authorization.authorizationDigest,
		outcome,
		startedAt,
		finishedAt,
		output,
		outputDigest,
		usageDigest,
		providerReceiptDigest: execution.provider.providerReceiptDigest,
		sessionReceiptDigest,
		rawSessionDigest,
		eventCount: events.length,
	});
}

function bindCancellation(handle: AgentHandle, signal: AbortSignal | undefined): (() => void) | undefined {
	if (!signal) return undefined;
	const cancel = (): void => handle.agent.cancel({kind: "user"});
	signal.addEventListener("abort", cancel, {once: true});
	if (signal.aborted) cancel();
	return () => signal.removeEventListener("abort", cancel);
}

async function disposeExecution(execution: DshExecution): Promise<void> {
	execution.removeCancellation?.();
	await execution.agent.dispose();
	await execution.provider.dispose();
	await disposeFibers(execution.fibers);
}

async function disposeFibers(fibers: readonly Fiber[]): Promise<void> {
	for (let index = fibers.length - 1; index >= 0; index -= 1) await fibers[index]?.dispose();
}

function finalAssistantText(events: readonly SessionEvent[]): string {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event?.type === "assistant/message") return event.data.message.content.flatMap((block) => block.type === "text" ? [block.text] : []).join("");
	}
	return "";
}

function runOutcome(events: readonly SessionEvent[], aborted: boolean): AgentRunOutcome {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event?.type === "turn/end") {
			if (aborted || event.data.reason.kind === "aborted") return "cancelled";
			return event.data.reason.kind === "completed" ? "completed" : "failed";
		}
	}
	return aborted ? "cancelled" : "failed";
}

function validateRunInput(input: RunDshSessionInput): void {
	if (!input || typeof input.installProvider !== "function") throw new Error("DSH Run requires a Provider installer.");
	if (!decodeAgentRunAuthorization(input.authorization).ok) throw new Error("DSH Run authorization is invalid.");
	if (input.authorization.toolIds.length > 0) throw new Error("DSH Session runner has no admitted tool binding for this authorization.");
	if (Buffer.byteLength(input.material.systemPrompt) > 64 * 1_024 || Buffer.byteLength(input.material.prompt) > 4 * 1_024 * 1_024) {
		throw new Error("DSH Run material exceeds its byte bound.");
	}
	const materialDigest = agentRunContextMaterialDigest(input.material, input.authorization.context.itemIds);
	if (!materialDigest.ok || materialDigest.value !== input.authorization.context.contextDigest) {
		throw new Error("DSH Run material does not match authorized context.");
	}
	for (const [field, path] of [["workspacePath", input.material.workspacePath], ["sessionRoot", input.material.sessionRoot]] as const) {
		if (!isAbsolute(path)) throw new Error(`DSH ${field} must be absolute.`);
	}
	if (!/^cw:session:[a-z0-9][a-z0-9._:-]*$/u.test(input.material.sessionId) || input.material.sessionId.length > 256) throw new Error("DSH Session identity is invalid.");
	if (input.signal?.aborted) throw new Error("DSH Run was cancelled before admission.");
}

function semanticValueDigest(protocol: string, value: unknown): Sha256Digest {
	const result = semanticDigest(protocol, value);
	if (!result.ok) throw new Error(`DSH receipt value is invalid: ${result.error.message}`);
	return result.value;
}

function systemTimestamp(): string {
	return new Date().toISOString();
}
