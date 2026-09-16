import {createModels, InMemoryCredentialStore, type AssistantMessage, type ThinkingLevel} from "@earendil-works/pi-ai";
import {decodeContract, exactRecord, literalField, textField} from "../../kernel/data-contracts/validation.ts";
import {semanticDigest} from "../../kernel/identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {CHECK_MODEL_PORT_PROTOCOL, UncertainCheckModelCustody, checkModelJson, decodeCheckModelRequest, parseCheckModelValue, type CheckModelPort, type CheckModelRequest} from "../../ports/check-model.ts";
import {piTokenUsage, validatePiModel, type PiModelLease} from "./model.ts";

const PROTOCOL = "changekernel.pi-check-model@1.0.0";
export interface PiCheckModelBinding {
	readonly providerId: string;
	readonly modelId: string;
	readonly locality: "local" | "private";
	readonly providerConfigurationDigest: Sha256Digest;
	readonly temperature: number;
	readonly reasoningEffort: ThinkingLevel | null;
	readonly routeDigest: Sha256Digest;
	readonly settingsDigest: Sha256Digest;
}
export interface PiCheckProviderLease extends PiModelLease {
	readonly routeDigest: Sha256Digest;
	readonly settingsDigest: Sha256Digest;
}
/** Backend installation owns the exact credentials, endpoint and response-body boundary. */
export type PiCheckProviderInstaller = (binding: PiCheckModelBinding, signal: AbortSignal) => PiCheckProviderLease | Promise<PiCheckProviderLease>;

/** One tool-free pi-ai call. No agent session, ambient discovery, repair or fallback. */
export function createPiCheckModel(configuration: unknown, installProvider: PiCheckProviderInstaller) {
	return decodeContract("Pi Check model configuration", configuration, value => {
		if (typeof installProvider !== "function") throw new Error("A backend provider installer is required.");
		const r = exactRecord("Pi Check model configuration", value, "$", ["providerId", "modelId", "locality", "providerConfigurationDigest", "temperature", "reasoningEffort"]);
		const text = (key: string) => {
			const value = textField("Pi Check model configuration", r, key, "$", {maximumBytes: 256});
			if (!value.trim()) throw new Error("An exact provider/model setting is required.");
			return value;
		};
		const providerConfigurationDigest = decodeSha256Digest(r.providerConfigurationDigest);
		if (!providerConfigurationDigest.ok || typeof r.temperature !== "number" || !Number.isFinite(r.temperature) || r.temperature < 0 || r.temperature > 2) throw new Error("Invalid provider configuration or sampling setting.");
		const route = {providerId: text("providerId"), modelId: text("modelId"), locality: literalField("Pi Check model configuration", r, "locality", ["local", "private"] as const), providerConfigurationDigest: providerConfigurationDigest.value};
		const routeDigest = digest(`${PROTOCOL}:route`, route);
		const reasoningEffort = r.reasoningEffort === null ? null : literalField("Pi Check model configuration", r, "reasoningEffort", ["minimal", "low", "medium", "high", "xhigh", "max"] as const);
		const settings = {temperature: r.temperature, reasoningEffort};
		const binding = Object.freeze({...route, ...settings, routeDigest, settingsDigest: digest(`${PROTOCOL}:settings`, {routeDigest, ...settings})});
		let active = false, poisoned = false;
		const port: CheckModelPort = Object.freeze({protocol: CHECK_MODEL_PORT_PROTOCOL, routeDigest, settingsDigest: binding.settingsDigest, locality: binding.locality,
			async call(input: CheckModelRequest, signal: AbortSignal) {
				if (poisoned) throw new UncertainCheckModelCustody("Prior provider custody is unresolved.");
				if (active) throw new Error("The Pi Check model bridge is busy.");
				const decoded = decodeCheckModelRequest(input);
				if (!decoded.ok) throw new Error("Invalid bounded model request.");
				if (signal.aborted) throw new Error("Model call was cancelled before setup.");
				const request = decoded.value;
				const systemPrompt = "Return only a compact canonical JSON object: sorted keys, no whitespace outside strings, no extra keys or markdown. Use exactly these fields and types: " + checkModelJson(request.shape);
				const context = {systemPrompt, messages: [{role: "user" as const, content: request.prompt, timestamp: 0}], tools: []};
				if (Buffer.byteLength(checkModelJson(context)) > request.maximumInputTokens) throw new Error("Prepared request exceeds the conservative input-token reserve.");
				active = true;
				const controller = new AbortController();
				const cancel = () => controller.abort();
				signal.addEventListener("abort", cancel, {once: true});
				if (signal.aborted) cancel();
				let lease: PiCheckProviderLease | undefined, installing = false;
				try {
					if (controller.signal.aborted) throw new Error("Cancelled before provider installation.");
					installing = true;
					lease = await installProvider(binding, controller.signal);
					if (lease.routeDigest !== binding.routeDigest || lease.settingsDigest !== binding.settingsDigest) throw new Error("Installed provider does not match the adopted route and settings.");
					validatePiModel(lease, binding.providerId, binding.modelId);
					if (binding.reasoningEffort !== null && !lease.model.reasoning) throw new Error("Selected Pi route does not support the adopted reasoning setting.");
					if (controller.signal.aborted) throw new Error("Cancelled before model dispatch.");
					const models = createModels({credentials: new InMemoryCredentialStore()});
					models.setProvider(lease.provider);
					const stream = models.streamSimple(lease.model, context, {
						signal: controller.signal, temperature: binding.temperature, maxTokens: request.maximumOutputTokens,
						reasoning: binding.reasoningEffort ?? undefined, toolChoice: "none", maxRetries: 0, cacheRetention: "none", transport: "sse",
					});
					let completed: AssistantMessage | undefined, chunks = 0, bytes = 0;
					for await (const event of stream) {
						if (controller.signal.aborted || completed || ++chunks > 4096) throw new Error("Cancelled, excessive or post-terminal model stream.");
						if (event.type === "error") throw new Error("Model call did not finish successfully.");
						if (event.type.startsWith("toolcall_")) throw new Error("Check models cannot invoke tools.");
						if (event.type === "text_delta" || event.type === "thinking_delta") bytes += Buffer.byteLength(event.delta);
						if (bytes > request.maximumResponseBytes * 4 + 4096) throw new Error("Model stream exceeds its output envelope.");
						if (event.type === "done") {
							if (event.reason !== "stop" || event.message.stopReason !== "stop") throw new Error("Model call did not finish successfully.");
							completed = event.message;
						}
					}
					if (!completed) throw new Error("Model stream lacks explicit completion.");
					if (completed.provider !== binding.providerId || completed.model !== binding.modelId || completed.content.some(block => block.type !== "text" && block.type !== "thinking")) throw new Error("Unexpected model response identity or content.");
					if (Buffer.byteLength(JSON.stringify(completed.content)) > request.maximumResponseBytes * 4 + 4096) throw new Error("Model response exceeds its output envelope.");
					const usage = piTokenUsage(completed.usage);
					if (usage.inputTokens > request.maximumInputTokens || usage.outputTokens > request.maximumOutputTokens) throw new Error("Provider usage exceeds the authorized budget.");
					const text = completed.content.flatMap(block => block.type === "text" ? [block.text] : []).join("");
					return Object.freeze({value: parseCheckModelValue(text, request), ...usage});
				} finally {
					controller.abort();
					let failed = installing && !lease;
					try {await lease?.dispose();} catch {failed = true;}
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
function digest(domain: string, value: unknown): Sha256Digest {
	const result = semanticDigest(domain, value);
	if (!result.ok) throw new Error("Invalid Pi model binding.");
	return result.value;
}
