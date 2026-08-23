import type {Context} from "@deepseek-ai/cordis";
import {
	LlmAdapter,
	LlmError,
	ReasoningEffortId,
	resolveRetryPolicy,
	type GenerateOptions,
	type LlmProviderInfo,
	type LlmResolvedModelInfo,
	type ResolvedRetryPolicy,
	type StreamChunk,
} from "@deepseek-ai/dsh-llm";
import type {RunRequest} from "../contracts.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	type CanonicalJsonValue,
	toCanonicalJsonValue,
} from "../../utils/canonical-json.ts";
import type {
	DshModelAdapterInstaller,
	DshModelAdapterLease,
} from "./adapter.ts";
import {
	assertProviderBrokerReceiptForRequest,
	createPrivateProviderBrokerAccess,
	createProviderBrokerRequest,
	openProviderBrokerReceipt,
	type PrivateProviderBrokerAccess,
	type ProviderBrokerFailureKind,
	type ProviderBrokerReceipt,
	type ProviderBrokerReceiptEnvelope,
	type ProviderBrokerRequest,
	type ProviderBrokerWireMessage,
} from "../providers/contracts.ts";

const MAX_WIRE_LINE_BYTES = 8 * 1_024 * 1_024;

export interface DshPrivateProviderBrokerOptions {
	readonly access: PrivateProviderBrokerAccess;
}

export function createDshPrivateProviderBrokerInstaller(
	options: DshPrivateProviderBrokerOptions,
): DshModelAdapterInstaller {
	const access = createPrivateProviderBrokerAccess(options.access);
	return ({context, request}) => installPrivateProviderBroker(context, request, access);
}

function installPrivateProviderBroker(
	context: Context,
	request: RunRequest,
	access: PrivateProviderBrokerAccess,
): DshModelAdapterLease {
	if (Date.parse(access.expiresAt) <= Date.parse(request.createdAt)) {
		throw new Error("Private provider broker capability expires before the Run starts.");
	}
	const adapter = new PrivateProviderBrokerAdapter(request, access);
	const registration = context.llm.registerAdapter(
		[request.inputs.modelRoute.provider],
		adapter,
	);
	return {
		assertComplete: () => adapter.assertComplete(),
		providerReceipts: () => adapter.providerReceipts(),
		dispose: () => registration(),
	};
}

class PrivateProviderBrokerAdapter extends LlmAdapter {
	private readonly receipts: ProviderBrokerReceipt[] = [];
	private readonly request: RunRequest;
	private readonly access: PrivateProviderBrokerAccess;
	private activeCalls = 0;
	private callIndex = 0;

	constructor(
		request: RunRequest,
		access: PrivateProviderBrokerAccess,
	) {
		super();
		this.request = request;
		this.access = access;
	}

	override providerInfo(provider: string): LlmProviderInfo {
		return {id: provider, name: provider};
	}

	override providerRetryPolicy(_provider: string): ResolvedRetryPolicy {
		return resolveRetryPolicy(
			{mode: "normal", maxRetries: 0},
			"codewiki.private-provider-broker",
		);
	}

	override async resolveModel(
		provider: string,
		model: string,
	): Promise<LlmResolvedModelInfo> {
		this.assertExactRoute(provider, model);
		const reasoningEffort = this.request.inputs.modelRoute.reasoningEffort;
		const modelInfo: LlmResolvedModelInfo = {
			provider,
			id: model,
			name: model,
			context: {contextWindow: this.request.inputs.modelRoute.contextWindowTokens},
		};
		if (!reasoningEffort) return modelInfo;
		return {
			...modelInfo,
			reasoning: {
				efforts: [{id: ReasoningEffortId(reasoningEffort), name: reasoningEffort}],
				defaultEffort: ReasoningEffortId(reasoningEffort),
			},
		};
	}

	override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
		this.assertExactRoute(options.provider, options.model);
		this.assertReasoningEffort(options);
		const brokerRequest = createProviderBrokerRequest({
			runId: this.request.runId,
			callIndex: this.callIndex++,
			route: this.request.inputs.modelRoute,
			deadlineAt: this.request.deadlineAt,
			payload: modelPayload(options),
		});
		this.activeCalls += 1;
		try {
			yield* this.streamBrokerCall(brokerRequest, options.signal);
		} finally {
			this.activeCalls -= 1;
		}
	}

	assertComplete(): void {
		if (this.activeCalls !== 0) {
			throw new Error("Private provider broker has unfinished model calls.");
		}
		if (this.receipts.length === 0) {
			throw new Error("Private provider broker produced no authenticated receipt.");
		}
	}

	providerReceipts(): readonly ProviderBrokerReceipt[] {
		return Object.freeze([...this.receipts]);
	}

	private async *streamBrokerCall(
		brokerRequest: ProviderBrokerRequest,
		signal: AbortSignal | undefined,
	): AsyncIterable<StreamChunk> {
		const cancellation = signal
			? () => {
				void cancelBrokerCall(this.access, brokerRequest.callId);
			}
			: undefined;
		signal?.addEventListener("abort", cancellation as EventListener, {once: true});
		try {
			const response = await fetch(`${this.access.endpoint}/v1/model-calls`, {
				method: "POST",
				headers: brokerHeaders(this.access, {"content-type": "application/json"}),
				body: canonicalJson(brokerRequest),
			});
			if (!response.ok || !response.body) {
				throw new LlmError(
					`Private provider broker rejected model call with HTTP ${response.status}.`,
					"BROKER_TRANSPORT",
					{status: response.status},
				);
			}
			const chunks: CanonicalJsonValue[] = [];
			let receipt: ProviderBrokerReceipt | undefined;
			for await (const message of readWireMessages(response.body)) {
				if (message.kind === "chunk") {
					if (receipt) throw new Error("Provider broker emitted a chunk after its receipt.");
					chunks.push(message.chunk);
					yield message.chunk as StreamChunk;
					continue;
				}
				if (receipt) throw new Error("Provider broker emitted duplicate receipts.");
				receipt = openProviderBrokerReceipt(
					message as ProviderBrokerReceiptEnvelope,
					this.access.capabilityToken,
				);
				assertProviderBrokerReceiptForRequest(receipt, brokerRequest, this.access.binding);
				assertBrokerResponseDigests(receipt, chunks);
				this.receipts.push(receipt);
			}
			if (!receipt) throw new Error("Private provider broker stream ended without a receipt.");
			if (receipt.outcome !== "completed") throw brokerFailure(receipt.failureKind);
		} finally {
			if (cancellation) signal?.removeEventListener("abort", cancellation as EventListener);
		}
	}

	private assertExactRoute(provider: string, model: string): void {
		if (
			provider !== this.request.inputs.modelRoute.provider ||
			model !== this.request.inputs.modelRoute.model
		) {
			throw new LlmError(
				"Private provider broker refused a route outside the exact Run binding.",
				"ROUTE_MISMATCH",
			);
		}
	}

	private assertReasoningEffort(options: GenerateOptions): void {
		const expected = this.request.inputs.modelRoute.reasoningEffort;
		if ((options.reasoningEffort ?? null) !== expected) {
			throw new LlmError(
				"Private provider broker reasoning effort differs from the Run binding.",
				"ROUTE_MISMATCH",
			);
		}
	}
}

function modelPayload(options: GenerateOptions): CanonicalJsonValue {
	const {signal: _signal, ...wire} = options;
	try {
		return toCanonicalJsonValue(structuredClone(wire));
	} catch {
		throw new Error("Private provider broker model payload is not canonical JSON.");
	}
}

async function* readWireMessages(
	body: ReadableStream<Uint8Array>,
): AsyncIterable<ProviderBrokerWireMessage> {
	const decoder = new TextDecoder();
	let pending = "";
	for await (const bytes of body) {
		pending += decoder.decode(bytes, {stream: true});
		if (Buffer.byteLength(pending) > MAX_WIRE_LINE_BYTES) {
			throw new Error("Private provider broker wire line exceeds its byte limit.");
		}
		let newline = pending.indexOf("\n");
		while (newline >= 0) {
			const line = pending.slice(0, newline);
			pending = pending.slice(newline + 1);
			if (line) yield parseWireMessage(line);
			newline = pending.indexOf("\n");
		}
	}
	pending += decoder.decode();
	if (pending.trim()) yield parseWireMessage(pending);
}

function parseWireMessage(line: string): ProviderBrokerWireMessage {
	let value: unknown;
	try {
		value = JSON.parse(line);
	} catch {
		throw new Error("Private provider broker emitted invalid JSON.");
	}
	if (!value || typeof value !== "object" || !("kind" in value)) {
		throw new Error("Private provider broker wire message is invalid.");
	}
	const message = value as ProviderBrokerWireMessage;
	if (message.kind !== "chunk" && message.kind !== "receipt") {
		throw new Error("Private provider broker wire message kind is invalid.");
	}
	return message;
}

function assertBrokerResponseDigests(
	receipt: ProviderBrokerReceipt,
	chunks: readonly CanonicalJsonValue[],
): void {
	const responseDigest = chunks.length === 0 ? null : canonicalJsonDigest(chunks);
	const usage = chunks.filter((chunk) => chunkType(chunk) === "usage");
	const usageDigest = usage.length === 0 ? null : canonicalJsonDigest(usage);
	if (receipt.responseDigest !== responseDigest || receipt.usageDigest !== usageDigest) {
		throw new Error("Provider broker receipt response or usage digest is invalid.");
	}
}

async function cancelBrokerCall(
	access: PrivateProviderBrokerAccess,
	callId: string,
): Promise<void> {
	try {
		await fetch(
			`${access.endpoint}/v1/model-calls/${encodeURIComponent(callId)}/cancel`,
			{method: "POST", headers: brokerHeaders(access)},
		);
	} catch {
		// Main stream still resolves the terminal broker receipt or transport failure.
	}
}

function brokerHeaders(
	access: PrivateProviderBrokerAccess,
	extra: Readonly<Record<string, string>> = {},
): Record<string, string> {
	return {
		"x-codewiki-capability-id": access.capabilityId,
		"x-codewiki-capability-token": access.capabilityToken,
		...extra,
	};
}

function brokerFailure(failureKind: ProviderBrokerFailureKind | null): LlmError {
	const codes: Partial<Record<ProviderBrokerFailureKind, string>> = {
		authentication: "AUTH",
		"rate-limited": "RATE_LIMIT",
		"context-overflow": "CONTEXT_OVERFLOW",
		cancelled: "ABORTED",
	};
	const code = failureKind ? codes[failureKind] || "BROKER_FAILURE" : "BROKER_FAILURE";
	return new LlmError(
		`Private provider broker call failed: ${failureKind || "unknown"}.`,
		code,
	);
}

function chunkType(chunk: CanonicalJsonValue): string | null {
	if (chunk === null || Array.isArray(chunk) || typeof chunk !== "object") return null;
	return String((chunk as Readonly<Record<string, CanonicalJsonValue>>).type || "");
}
