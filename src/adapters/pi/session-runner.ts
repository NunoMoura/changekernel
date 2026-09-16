import {InMemoryCredentialStore, InMemoryModelsStore} from "@earendil-works/pi-ai";
import {createAgentSession, createExtensionRuntime, CURRENT_SESSION_VERSION, ModelRuntime, SessionManager, SettingsManager, type AgentSession, type Extension, type FileEntry, type ResourceLoader} from "@earendil-works/pi-coding-agent";
import {mkdir, readFile, stat, writeFile} from "node:fs/promises";
import {isAbsolute, join} from "node:path";
import {semanticDigest} from "../../kernel/identity/semantic-digest.ts";
import {sha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {agentRunContextMaterialDigest, decodeAgentRunAuthorization, type AgentRunAuthorization, type AgentRunOutcome} from "../../ports/agent-runtime.ts";
import {piTokenUsage, validatePiModel, type PiModelLease} from "./model.ts";

export const PI_SESSION_RUNNER_PROTOCOL = Object.freeze({id: "codewiki.pi-session-runner", version: "1.0.0"} as const);
const MAXIMUM_SESSION_BYTES = 16 * 1024 * 1024;

export interface PiRunMaterial {
	readonly systemPrompt: string;
	readonly prompt: string;
	readonly workspacePath: string;
	readonly sessionRoot: string;
	readonly sessionId: string;
	readonly resume: boolean;
}
export interface PiProviderLease extends PiModelLease {
	readonly providerReceiptDigest: Sha256Digest | null;
	readonly assertComplete?: () => void;
}
export type PiProviderInstaller = (authorization: AgentRunAuthorization, signal?: AbortSignal) => PiProviderLease | Promise<PiProviderLease>;
export interface PiSessionRunResult {
	readonly protocol: typeof PI_SESSION_RUNNER_PROTOCOL;
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
export interface RunPiSessionInput {
	readonly authorization: AgentRunAuthorization;
	readonly material: PiRunMaterial;
	readonly installProvider: PiProviderInstaller;
	readonly signal?: AbortSignal;
	readonly clock?: () => string;
}

/** Runs an already-authorized Pi session; the execution host owns process containment. */
export async function runPiSession(input: RunPiSessionInput): Promise<PiSessionRunResult> {
	validateRunInput(input);
	input = {...input, material: Object.freeze({...input.material})};
	const now = input.clock ?? (() => new Date().toISOString());
	const startedAt = now();
	const runtime = await ModelRuntime.create({credentials: new InMemoryCredentialStore(), modelsStore: new InMemoryModelsStore(),
		modelsPath: null, allowModelNetwork: false, refreshOnCreate: false, signal: input.signal});
	let provider: PiProviderLease | undefined, session: AgentSession | undefined;
	let unsubscribe: (() => void) | undefined;
	const controller = new AbortController();
	let cancellation: Promise<void> | undefined;
	const cancel = () => {
		controller.abort();
		if (session && !cancellation) {
			cancellation = session.abort();
			// Observe rejection immediately; cleanup still awaits it and propagates failure.
			void cancellation.catch(() => {});
		}
	};
	input.signal?.addEventListener("abort", cancel, {once: true});
	if (input.signal?.aborted) cancel();
	try {
		if (controller.signal.aborted) throw new Error("Pi Run was cancelled before provider installation.");
		provider = await input.installProvider(input.authorization, controller.signal);
		if (controller.signal.aborted) throw new Error("Pi Run was cancelled before model execution.");
		validatePiModel(provider, input.authorization.route.providerId, input.authorization.route.modelId);
		runtime.registerNativeProvider(provider.provider);
		const {manager, path} = await prepareSession(input.material);
		const created = await createAgentSession({cwd: input.material.workspacePath, agentDir: input.material.sessionRoot,
			model: provider.model, thinkingLevel: "off", modelRuntime: runtime, sessionManager: manager,
			settingsManager: SettingsManager.inMemory({compaction: {enabled: false}, retry: {enabled: false}, enableSkillCommands: false}),
			resourceLoader: isolatedResources(input.material.systemPrompt), tools: [], customTools: [],
		});
		session = created.session;
		if (created.modelFallbackMessage || session.model?.provider !== input.authorization.route.providerId || session.model.id !== input.authorization.route.modelId) throw new Error("Pi selected an unadopted model route.");
		if (controller.signal.aborted) throw new Error("Pi Run was cancelled before model execution.");
		const firstMessage = session.messages.length;
		let eventCount = 0;
		unsubscribe = session.subscribe(() => {eventCount++;});
		await session.prompt(input.material.prompt, {expandPromptTemplates: false});
		await session.agent.waitForIdle();
		const messages = session.messages.slice(firstMessage);
		const last = messages.filter(message => message.role === "assistant").at(-1);
		// prompt() resolves on provider error too; idleness is not successful completion.
		let outcome: AgentRunOutcome = controller.signal.aborted || last?.stopReason === "aborted" ? "cancelled" : last?.stopReason === "stop" ? "completed" : "failed";
		const usage: Readonly<{inputTokens: number; outputTokens: number}>[] = [];
		try {
			for (const message of messages) if (message.role === "assistant") {
				if (message.provider !== input.authorization.route.providerId || message.model !== input.authorization.route.modelId) throw new Error("Unexpected producer response identity.");
				usage.push(piTokenUsage(message.usage));
			}
			if (usage.length > input.authorization.budget.maximumModelRequests ||
				usage.reduce((total, entry) => total + entry.inputTokens, 0) > input.authorization.budget.maximumInputTokens ||
				usage.reduce((total, entry) => total + entry.outputTokens, 0) > input.authorization.budget.maximumOutputTokens) throw new Error("Run usage exceeds its budget.");
		} catch {outcome = controller.signal.aborted ? "cancelled" : "failed";}
		if (outcome === "completed") provider.assertComplete?.();
		const output = outcome === "completed" ? last!.content.flatMap(block => block.type === "text" ? [block.text] : []).join("") : null;
		const raw = serializeSession(manager);
		await writeFile(path, raw, {mode: 0o600});
		const rawSessionDigest = sha256Digest(raw);
		return Object.freeze({protocol: PI_SESSION_RUNNER_PROTOCOL, runId: input.authorization.runId,
			authorizationDigest: input.authorization.authorizationDigest, outcome, startedAt, finishedAt: now(), output,
			outputDigest: output === null ? null : receiptDigest("codewiki.agent-output@1.0.0", {text: output}),
			usageDigest: usage.length ? receiptDigest("codewiki.pi-agent-usage@1.0.0", usage) : null,
			providerReceiptDigest: provider.providerReceiptDigest, rawSessionDigest, eventCount,
			sessionReceiptDigest: receiptDigest("codewiki.pi-session-receipt@1.0.0", {runId: input.authorization.runId,
				sessionId: input.material.sessionId, formatVersion: CURRENT_SESSION_VERSION, rawSessionDigest, eventCount}),
		});
	} finally {
		// Keep cancellation active throughout cleanup; the host publishes closure only afterward.
		try {
			try {await (cancellation ?? session?.abort());} finally {unsubscribe?.(); session?.dispose();}
		} finally {
			try {await provider?.dispose();} finally {controller.abort(); input.signal?.removeEventListener("abort", cancel);}
		}
	}
}

function isolatedResources(systemPrompt: string): ResourceLoader {
	const runtime = createExtensionRuntime();
	// Pi's base prompt adds a working-directory suffix. This explicit, in-memory
	// event binding restores exactly the authorized prompt without loading code or files.
	const path = "changekernel:authorized-context";
	const contextBinding: Extension = {path, resolvedPath: path,
		sourceInfo: {path, source: path, scope: "temporary", origin: "top-level"},
		handlers: new Map([["before_agent_start", [async () => ({systemPrompt})]]]),
		tools: new Map(), messageRenderers: new Map(), commands: new Map(), flags: new Map(), shortcuts: new Map(),
	};
	return {
		getExtensions: () => ({extensions: [contextBinding], errors: [], runtime}),
		getSkills: () => ({skills: [], diagnostics: []}), getPrompts: () => ({prompts: [], diagnostics: []}),
		getThemes: () => ({themes: [], diagnostics: []}), getAgentsFiles: () => ({agentsFiles: []}),
		getSystemPrompt: () => systemPrompt, getSystemPromptSource: () => undefined,
		getAppendSystemPrompt: () => [], getAppendSystemPromptSources: () => [], extendResources: () => {}, reload: async () => {},
	};
}

async function prepareSession(material: PiRunMaterial): Promise<{manager: SessionManager; path: string}> {
	await mkdir(material.sessionRoot, {recursive: true, mode: 0o700});
	// Pi IDs have a narrower alphabet than host references; bind them without lossy sanitizing.
	const id = sha256Digest(material.sessionId).slice("sha256:".length);
	const path = join(material.sessionRoot, `${id}.jsonl`);
	let entries: FileEntry[] | undefined;
	if (material.resume) {
		if ((await stat(path)).size > MAXIMUM_SESSION_BYTES) throw new Error("Pi session exceeds its custody byte bound.");
		const raw = await readFile(path, "utf8");
		if (Buffer.byteLength(raw) > MAXIMUM_SESSION_BYTES) throw new Error("Pi session exceeds its custody byte bound.");
		try {entries = raw.trimEnd().split("\n").map(line => JSON.parse(line) as FileEntry);} catch {throw new Error("Malformed Pi session history.");}
		const header = entries[0];
		if (header?.type !== "session" || header.version !== CURRENT_SESSION_VERSION || header.id !== id || header.cwd !== material.workspacePath) throw new Error("Unsupported or mismatched Pi session history.");
	}
	const manager = SessionManager.inMemory(material.workspacePath, {id}, entries);
	// Reserve a fresh identity before inference; a previous private log never grants permission to rerun.
	if (!material.resume) await writeFile(path, serializeSession(manager), {mode: 0o600, flag: "wx"});
	return {manager, path};
}
function serializeSession(manager: SessionManager): string {
	const raw = [manager.getHeader(), ...manager.getEntries()].map(entry => JSON.stringify(entry)).join("\n") + "\n";
	if (Buffer.byteLength(raw) > MAXIMUM_SESSION_BYTES) throw new Error("Pi session exceeds its custody byte bound.");
	return raw;
}
function validateRunInput(input: RunPiSessionInput): void {
	if (!input || typeof input.installProvider !== "function") throw new Error("Pi Run requires a Provider installer.");
	if (!decodeAgentRunAuthorization(input.authorization).ok) throw new Error("Pi Run authorization is invalid.");
	if (input.authorization.toolIds.length > 0) throw new Error("Pi Session runner has no admitted tool binding for this authorization.");
	if (Buffer.byteLength(input.material.systemPrompt) > 64 * 1024 || Buffer.byteLength(input.material.prompt) > 4 * 1024 * 1024) throw new Error("Pi Run material exceeds its byte bound.");
	const materialDigest = agentRunContextMaterialDigest(input.material, input.authorization.context.itemIds);
	if (!materialDigest.ok || materialDigest.value !== input.authorization.context.contextDigest) throw new Error("Pi Run material does not match authorized context.");
	for (const [field, path] of [["workspacePath", input.material.workspacePath], ["sessionRoot", input.material.sessionRoot]] as const) {
		if (!isAbsolute(path)) throw new Error(`Pi ${field} must be absolute.`);
	}
	if (!/^cw:session:[a-z0-9][a-z0-9._:-]*$/u.test(input.material.sessionId) || input.material.sessionId.length > 256) throw new Error("Pi Session identity is invalid.");
	if (input.signal?.aborted) throw new Error("Pi Run was cancelled before admission.");
}
function receiptDigest(protocol: string, value: unknown): Sha256Digest {
	const result = semanticDigest(protocol, value);
	if (!result.ok) throw new Error(`Pi receipt value is invalid: ${result.error.message}`);
	return result.value;
}
