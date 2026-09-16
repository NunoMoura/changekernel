import {createProvider, type Api, type Model, type ProviderStreams} from "@earendil-works/pi-ai";
import {openAICompletionsApi} from "@earendil-works/pi-ai/api/openai-completions.lazy";
import type {PiModelLease} from "./model.ts";

export interface PiOpenAIConfiguration {
	readonly providerId: string;
	readonly modelId: string;
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly maximumRequests: number;
	readonly maximumResponseBytes: number;
	readonly maximumOutputTokens: number;
	readonly contextWindow: number;
	readonly timeoutMs: number;
	readonly temperature: number;
}

/** One explicit HTTP route. Endpoint identity is not proof of private network containment. */
export function createPiOpenAIProvider(input: PiOpenAIConfiguration): PiModelLease {
	const configuration = Object.freeze({...input});
	for (const value of [configuration.maximumRequests, configuration.maximumResponseBytes, configuration.maximumOutputTokens, configuration.contextWindow, configuration.timeoutMs]) {
		if (!Number.isSafeInteger(value) || value < 1) throw new Error("Invalid Pi provider bound.");
	}
	if (!configuration.providerId || !configuration.modelId || !configuration.apiKey || !Number.isFinite(configuration.temperature) || configuration.temperature < 0 || configuration.temperature > 2) throw new Error("Invalid explicit Pi provider settings.");
	let baseUrl: URL;
	try {baseUrl = new URL(configuration.baseUrl);} catch {throw new Error("Invalid Pi provider endpoint.");}
	if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) throw new Error("Invalid Pi provider endpoint.");
	const base = baseUrl.href.replace(/\/$/u, "");
	const transport = boundedPiFetch(`${base}/chat/completions`, configuration.maximumResponseBytes, configuration.maximumRequests);
	const model = Object.freeze({id: configuration.modelId, name: configuration.modelId, api: "openai-completions" as const,
		provider: configuration.providerId, baseUrl: base, reasoning: false, input: ["text" as const],
		cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0}, contextWindow: configuration.contextWindow, maxTokens: configuration.maximumOutputTokens,
		compat: {supportsStore: false, supportsDeveloperRole: false, supportsReasoningEffort: false, supportsUsageInStreaming: true, supportsFinishReason: true, maxTokensField: "max_tokens" as const},
	});
	const api = openAICompletionsApi();
	const enforce = (selected: Model<Api>, options?: {maxTokens?: number}) => {
		if (selected.id !== model.id || selected.provider !== model.provider || selected.api !== model.api || selected.baseUrl !== base) throw new Error("Unapproved Pi model route.");
		return {
			apiKey: configuration.apiKey, fetch: transport.fetch, maxRetries: 0, timeoutMs: configuration.timeoutMs,
			env: {HTTP_PROXY: "", HTTPS_PROXY: "", ALL_PROXY: "", http_proxy: "", https_proxy: "", all_proxy: "", NO_PROXY: "*"},
			temperature: configuration.temperature, maxTokens: Math.min(options?.maxTokens ?? configuration.maximumOutputTokens, configuration.maximumOutputTokens),
			cacheRetention: "none" as const, transport: "sse" as const,
		};
	};
	const streams: ProviderStreams = {
		...api,
		stream: (model, context, options) => api.stream(model, context, {...options, ...enforce(model, options)}),
		streamSimple: (model, context, options) => api.streamSimple(model, context, {...options, ...enforce(model, options)}),
	};
	const provider = createProvider({id: configuration.providerId, baseUrl: base, auth: {apiKey: {name: "Explicit backend credentials", resolve: async () => ({auth: {apiKey: configuration.apiKey}})}}, models: [model], api: streams});
	return Object.freeze({provider, model, dispose: transport.dispose});
}

/** Decoded body bound before provider parsing; not a socket-byte or hard memory limit. */
export function boundedPiFetch(endpoint: string, maximumBytes: number, maximumRequests: number): {fetch: typeof globalThis.fetch; dispose(): Promise<void>} {
	if (![maximumBytes, maximumRequests].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error("Invalid transport limits.");
	const controller = new AbortController();
	const readers = new Set<ReadableStreamDefaultReader<Uint8Array>>();
	const pending = new Set<Promise<Response>>();
	let calls = 0;
	const dispatch: typeof globalThis.fetch = async (input, init) => {
		controller.signal.throwIfAborted();
		const request = new Request(input, init);
		if (request.url !== endpoint || request.method !== "POST") throw new Error("Unapproved Pi endpoint.");
		if (++calls > maximumRequests) throw new Error("Pi request count exceeds its budget.");
		const response = await fetch(request, {redirect: "error", signal: AbortSignal.any([request.signal, controller.signal])});
		if (!response.body) return response;
		const reader = response.body.getReader();
		readers.add(reader);
		let bytes = 0;
		const body = new ReadableStream<Uint8Array>({
			async pull(destination) {
				try {
					const next = await reader.read();
					if (next.done) {readers.delete(reader); destination.close(); return;}
					bytes += next.value.byteLength;
					if (bytes > maximumBytes) {
						await reader.cancel("Pi response body limit exceeded."); readers.delete(reader);
						throw new Error("Pi response body limit exceeded.");
					}
					destination.enqueue(next.value);
				} catch (error) {destination.error(error);}
			},
			async cancel(reason) {await reader.cancel(reason); readers.delete(reader);},
		}, {highWaterMark: 0});
		return new Response(body, {status: response.status, statusText: response.statusText, headers: response.headers});
	};
	const boundedFetch: typeof globalThis.fetch = (input, init) => {
		const request = dispatch(input, init);
		pending.add(request);
		void request.then(() => pending.delete(request), () => pending.delete(request));
		return request;
	};
	const closeReaders = () => Promise.allSettled([...readers].map(async reader => {
		try {return await reader.cancel("Pi provider disposed.");} finally {readers.delete(reader);}
	}));
	return {fetch: boundedFetch, async dispose() {
		const closing = closeReaders();
		controller.abort();
		// Include requests awaiting headers, then any body installed during that settlement.
		await Promise.allSettled([...pending]);
		const settled = [...await closing, ...await closeReaders()];
		if (settled.some(result => result.status === "rejected")) throw new Error("Pi response cleanup is uncertain.");
	}};
}
