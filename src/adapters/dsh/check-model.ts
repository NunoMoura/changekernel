import {Context, type Fiber} from "@deepseek-ai/cordis";
import LlmRuntime, {BlockAssembler, createUserMessage, deepFreeze, ReasoningEffortId, type LlmCallConfig, type StreamChunk} from "@deepseek-ai/dsh-llm";
import {decodeContract, exactRecord, literalField, textField} from "../../kernel/data-contracts/validation.ts";
import {semanticDigest} from "../../kernel/identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {CHECK_MODEL_PORT_PROTOCOL, UncertainCheckModelCustody, checkModelJson, decodeCheckModelRequest, parseCheckModelValue, type CheckModelPort, type CheckModelRequest} from "../../ports/check-model.ts";

const PROTOCOL = "changekernel.dsh-check-model@1.0.0";
export interface DshCheckModelBinding {
	readonly providerId: string;
	readonly modelId: string;
	readonly locality: "local" | "private";
	readonly providerConfigurationDigest: Sha256Digest;
	readonly temperature: number;
	readonly reasoningEffort: string | null;
	readonly routeDigest: Sha256Digest;
	readonly settingsDigest: Sha256Digest;
}
export interface DshCheckProviderLease {
	readonly routeDigest: Sha256Digest;
	readonly settingsDigest: Sha256Digest;
	dispose(): void | Promise<void>;
}
/** Backend-only installation of a pinned DSH provider. No ambient provider discovery. */
export type DshCheckProviderInstaller = (context: Context, binding: DshCheckModelBinding, signal: AbortSignal) => DshCheckProviderLease | Promise<DshCheckProviderLease>;

/**
 * One tool-free auxiliary DSH call, not a second agent harness or provider transport.
 * Provider installation must enforce the bound endpoint/credentials/locality itself.
 * A fresh private DSH model registry has no agent loop, tools, retry plugin, producer
 * history, session persistence, discovery or fallback. DSH owns dispatch/assembly.
 */
export function createDshCheckModel(configuration: unknown, installProvider: DshCheckProviderInstaller) {
	return decodeContract("DSH Check model configuration", configuration, value => {
		if (typeof installProvider !== "function") throw new Error("A backend provider installer is required.");
		const r = exactRecord("DSH Check model configuration", value, "$", ["providerId", "modelId", "locality", "providerConfigurationDigest", "temperature", "reasoningEffort"]);
		const text = (key: string) => {
			const value = textField("DSH Check model configuration", r, key, "$", {maximumBytes: 256});
			if (!value.trim()) throw new Error("An exact provider/model setting is required.");
			return value;
		};
		const providerConfigurationDigest = decodeSha256Digest(r.providerConfigurationDigest);
		if (!providerConfigurationDigest.ok || typeof r.temperature !== "number" || r.temperature < 0 || r.temperature > 2) throw new Error("Invalid provider configuration or sampling setting.");
		const route = {providerId: text("providerId"), modelId: text("modelId"), locality: literalField("DSH Check model configuration", r, "locality", ["local", "private"] as const), providerConfigurationDigest: providerConfigurationDigest.value};
		const routeDigest = digest(`${PROTOCOL}:route`, route);
		const settings = {temperature: r.temperature, reasoningEffort: r.reasoningEffort === null ? null : text("reasoningEffort")};
		const binding = Object.freeze({...route, ...settings, routeDigest, settingsDigest: digest(`${PROTOCOL}:settings`, {routeDigest, ...settings})});
		let active = false, poisoned = false;
		const port: CheckModelPort = Object.freeze({protocol: CHECK_MODEL_PORT_PROTOCOL, routeDigest, settingsDigest: binding.settingsDigest, locality: binding.locality,
			async call(input: CheckModelRequest, signal: AbortSignal) {
				if (poisoned) throw new UncertainCheckModelCustody("Prior provider custody is unresolved.");
				if (active) throw new Error("The DSH Check model bridge is busy.");
				const decoded = decodeCheckModelRequest(input);
				if (!decoded.ok) throw new Error("Invalid bounded model request.");
				if (signal.aborted) throw new Error("Model call was cancelled before setup.");
				const request = decoded.value;
				const system = "Return only a compact canonical JSON object: sorted keys, no whitespace outside strings, no extra keys or markdown. Use exactly these fields and types: " + checkModelJson(request.shape);
				const messages = [createUserMessage({content: [{type: "text", text: request.prompt}], source: {kind: "user"}})];
				if (new TextEncoder().encode(checkModelJson({system, messages})).length > request.maximumInputTokens) throw new Error("Prepared request exceeds the conservative input-token reserve.");
				active = true;
				const context = new Context(), controller = new AbortController();
				const cancel = () => controller.abort();
				signal.addEventListener("abort", cancel, {once: true});
				if (signal.aborted) cancel();
				let fiber: Fiber | undefined, lease: DshCheckProviderLease | undefined, installing = false;
				try {
					fiber = await context.plugin(LlmRuntime);
					if (controller.signal.aborted) throw new Error("Cancelled before provider installation.");
					installing = true;
					lease = await installProvider(context, binding, controller.signal);
					if (lease.routeDigest !== binding.routeDigest || lease.settingsDigest !== binding.settingsDigest) throw new Error("Installed provider does not match the adopted route and settings.");
					if (controller.signal.aborted) throw new Error("Cancelled before model preparation.");
					const config: LlmCallConfig = {provider: binding.providerId, model: binding.modelId, temperature: binding.temperature, maxTokens: request.maximumOutputTokens};
					if (binding.reasoningEffort !== null) config.reasoningEffort = ReasoningEffortId(binding.reasoningEffort);
					const prepared = await context.llm.prepareCall(config, controller.signal);
					if (checkModelJson(prepared.config) !== checkModelJson(config)) throw new Error("DSH materialized unadopted model settings.");
					if (controller.signal.aborted) throw new Error("Cancelled before model dispatch.");
					const assembler = new BlockAssembler();
					let finished = false, usageSeen = false, chunks = 0, bytes = 0;
					for await (const chunk of prepared.stream(deepFreeze({...prepared.config, system, messages, tools: [], signal: controller.signal}))) {
						if (controller.signal.aborted || finished || ++chunks > 4096) throw new Error("Cancelled, excessive or post-terminal model stream.");
						bytes += new TextEncoder().encode(checkModelJson(chunk)).length;
						if (bytes > request.maximumResponseBytes * 4 + 4096) throw new Error("Model stream exceeds the transport envelope.");
						validateChunk(chunk);
						if (chunk.type === "usage") {
							if (usageSeen) throw new Error("Duplicate model usage.");
							usageSeen = true;
						}
						if (chunk.type === "finish") {if (chunk.reason.kind !== "stop") throw new Error("Model call did not finish successfully."); finished = true;}
						assembler.push(chunk);
					}
					if (!finished || !usageSeen || !assembler.usage) throw new Error("Model stream lacks explicit completion or usage.");
					const usage = assembler.usage;
					const count = (value: number | undefined) => {
						if (value === undefined) return 0;
						if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid provider token count.");
						return value;
					};
					if (usage.inputTokens === undefined || usage.outputTokens === undefined) throw new Error("Missing provider token counts.");
					const inputTokens = count(usage.inputTokens) + count(usage.cacheReadTokens) + count(usage.cacheWriteTokens);
					// Conservatively charge separately reported reasoning; never hide it in a discount.
					const outputTokens = count(usage.outputTokens) + count(usage.reasoningTokens);
					if (inputTokens > request.maximumInputTokens || outputTokens > request.maximumOutputTokens) throw new Error("Provider usage exceeds the authorized budget.");
					const text = assembler.blocks().flatMap(block => block.type === "text" ? [block.text] : []).join("");
					const value = parseCheckModelValue(text, request);
					return Object.freeze({value, inputTokens, outputTokens});
				} finally {
					controller.abort();
					let failed = installing && !lease;
					try {await lease?.dispose();} catch {failed = true;}
					try {await fiber?.dispose();} catch {failed = true;}
					signal.removeEventListener("abort", cancel);
					active = false;
					if (failed) {poisoned = true; throw new UncertainCheckModelCustody("Provider cleanup did not establish closure.");}
					if (signal.aborted) throw new Error("Cancellation invalidated model output before cleanup completed.");
				}
			},
		});
		return port;
	});
}
function validateChunk(chunk: StreamChunk): void {
	if (chunk.type === "block-start" && !["text", "reasoning"].includes(chunk.blockType)) throw new Error("Check models cannot invoke tools or emit other block types.");
	if (chunk.type === "block-end" && !["text", "reasoning"].includes(chunk.block.type)) throw new Error("Check models cannot invoke tools or emit other block types.");
	if (!["block-start", "block-end", "text-delta", "reasoning-delta", "usage", "finish"].includes(chunk.type)) throw new Error("Unsupported Check model stream event.");
}
function digest(domain: string, value: unknown): Sha256Digest {
	const result = semanticDigest(domain, value);
	if (!result.ok) throw new Error("Invalid DSH model binding.");
	return result.value;
}
