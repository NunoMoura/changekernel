import {once} from "node:events";
import {createServer, type IncomingMessage, type ServerResponse} from "node:http";
import type {AddressInfo} from "node:net";
import type {StreamChunk} from "@deepseek-ai/dsh-llm";
import {
	canonicalJson,
	canonicalJsonDigest,
	type CanonicalJsonValue,
	toCanonicalJsonValue,
} from "../../utils/canonical-json.ts";
import {
	assertProviderBrokerRequest,
	createPrivateProviderBrokerAccess,
	createPrivateProviderBrokerBinding,
	createProviderBrokerReceipt,
	sealProviderBrokerReceipt,
	type PrivateProviderBrokerAccess,
	type PrivateProviderBrokerBinding,
	type ProviderBrokerFailureKind,
	type ProviderBrokerReceipt,
	type ProviderBrokerRequest,
	type ProviderBrokerWireMessage,
} from "./contracts.ts";

const MAX_REQUEST_BYTES = 16 * 1_024 * 1_024;

export interface PrivateProviderTransportResult {
	readonly selectedProvider: string;
	readonly selectedModel: string;
	readonly providerRequestId: string | null;
	readonly chunks: AsyncIterable<StreamChunk>;
}

export interface PrivateProviderTransportPort {
	open(
		request: ProviderBrokerRequest,
		signal: AbortSignal,
	): Promise<PrivateProviderTransportResult>;
}

export class PrivateProviderTransportError extends Error {
	readonly failureKind: ProviderBrokerFailureKind;
	readonly providerRequestId: string | null;

	constructor(
		failureKind: ProviderBrokerFailureKind,
		message: string,
		providerRequestId: string | null = null,
	) {
		super(message);
		this.name = "PrivateProviderTransportError";
		this.failureKind = failureKind;
		this.providerRequestId = providerRequestId;
	}
}

export interface PrivateProviderBrokerServerOptions {
	readonly binding: PrivateProviderBrokerBinding;
	readonly capabilityId: string;
	readonly capabilityToken: string;
	readonly expiresAt: string;
	readonly runId: string;
	readonly routeDigest: string;
	readonly transport: PrivateProviderTransportPort;
	readonly socketPath?: string;
	readonly now?: () => string;
	readonly recordReceipt?: (receipt: ProviderBrokerReceipt) => void | Promise<void>;
}

export interface PrivateProviderBrokerServer {
	readonly access: PrivateProviderBrokerAccess;
	readonly receipts: () => readonly ProviderBrokerReceipt[];
	readonly close: () => Promise<void>;
}

interface BrokerHttpRequestContext {
	readonly request: IncomingMessage;
	readonly response: ServerResponse;
	readonly options: PrivateProviderBrokerServerOptions;
	readonly access: () => PrivateProviderBrokerAccess;
	readonly active: Map<string, AbortController>;
	readonly consumed: Set<string>;
	readonly receipts: ProviderBrokerReceipt[];
	readonly now: () => string;
}

export async function startPrivateProviderBrokerServer(
	options: PrivateProviderBrokerServerOptions,
): Promise<PrivateProviderBrokerServer> {
	const admittedOptions = Object.freeze({
		...options,
		binding: createPrivateProviderBrokerBinding(options.binding),
	});
	const receipts: ProviderBrokerReceipt[] = [];
	const active = new Map<string, AbortController>();
	const consumed = new Set<string>();
	const now = options.now || (() => new Date().toISOString());
	let access: PrivateProviderBrokerAccess | undefined;
	const socketAccess = options.socketPath
		? createPrivateProviderBrokerAccess({
			endpoint: unixSocketEndpoint(options.socketPath),
			capabilityId: options.capabilityId,
			capabilityToken: options.capabilityToken,
			expiresAt: options.expiresAt,
			binding: admittedOptions.binding,
		})
		: undefined;
	const server = createServer((request, response) => {
		void dispatchBrokerHttpRequest({
			request,
			response,
			options: admittedOptions,
			access: () => {
				if (!access) throw new Error("Private provider broker is not listening.");
				return access;
			},
			active,
			consumed,
			receipts,
			now,
		});
	});
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		const listening = () => {
			server.off("error", reject);
			resolve();
		};
		if (options.socketPath) server.listen(options.socketPath, listening);
		else server.listen(0, "127.0.0.1", listening);
	});
	if (socketAccess) {
		access = socketAccess;
	} else {
		const address = server.address() as AddressInfo | null;
		if (!address) throw new Error("Private provider broker address is unavailable.");
		access = createPrivateProviderBrokerAccess({
			endpoint: `http://127.0.0.1:${address.port}`,
			capabilityId: options.capabilityId,
			capabilityToken: options.capabilityToken,
			expiresAt: options.expiresAt,
			binding: admittedOptions.binding,
		});
	}
	return Object.freeze({
		access,
		receipts: () => Object.freeze([...receipts]),
		close: async () => {
			for (const controller of active.values()) controller.abort("broker-shutdown");
			await new Promise<void>((resolve, reject) => {
				server.close((error) => {
					if (error) reject(error);
					else resolve();
				});
			});
		},
	});
}

function unixSocketEndpoint(socketPath: string): string {
	const encoded = socketPath.slice(1).split("/").map(encodeURIComponent).join("/");
	return `unix:///${encoded}`;
}

async function dispatchBrokerHttpRequest(
	input: BrokerHttpRequestContext,
): Promise<void> {
	try {
		await handleBrokerHttpRequest(input);
	} catch (error: unknown) {
		if (!input.response.headersSent) {
			input.response.writeHead(500, {"content-type": "application/json"});
		}
		if (!input.response.writableEnded) {
			input.response.end(canonicalJson({error: errorMessage(error)}));
		}
	}
}

async function handleBrokerHttpRequest(
	input: BrokerHttpRequestContext,
): Promise<void> {
	const access = input.access();
	if (!admitBrokerAccess(input, access)) return;
	const url = new URL(input.request.url || "/", access.endpoint);
	if (handleBrokerCancellation(input, url)) return;
	const brokerRequest = await admitBrokerCall(input, url);
	if (!brokerRequest) return;
	const controller = new AbortController();
	input.active.set(brokerRequest.callId, controller);
	const deadlineTimer = deadlineCancellation(
		brokerRequest.deadlineAt,
		controller,
		input.now(),
	);
	input.response.writeHead(200, {
		"content-type": "application/x-ndjson",
		"cache-control": "no-store",
	});
	input.response.on("close", () => {
		if (!input.response.writableEnded) controller.abort("client-disconnected");
	});
	try {
		await executeBrokerCall({...input, brokerRequest, controller});
	} finally {
		clearTimeout(deadlineTimer);
		input.active.delete(brokerRequest.callId);
		if (!input.response.writableEnded) input.response.end();
	}
}

function admitBrokerAccess(
	input: BrokerHttpRequestContext,
	access: PrivateProviderBrokerAccess,
): boolean {
	if (!authorized(input.request, access)) {
		respond(input.response, 401, {error: "unauthorized"});
		return false;
	}
	if (Date.parse(input.now()) >= Date.parse(access.expiresAt)) {
		respond(input.response, 403, {error: "capability-expired"});
		return false;
	}
	return true;
}

function handleBrokerCancellation(
	input: BrokerHttpRequestContext,
	url: URL,
): boolean {
	if (
		input.request.method !== "POST" ||
		!url.pathname.startsWith("/v1/model-calls/") ||
		!url.pathname.endsWith("/cancel")
	) {
		return false;
	}
	const callId = decodeURIComponent(
		url.pathname.slice("/v1/model-calls/".length, -"/cancel".length),
	);
	const controller = input.active.get(callId);
	if (!controller) {
		respond(input.response, 404, {error: "call-not-active"});
		return true;
	}
	controller.abort("caller-cancelled");
	respond(input.response, 202, {status: "cancelling"});
	return true;
}

async function admitBrokerCall(
	input: BrokerHttpRequestContext,
	url: URL,
): Promise<ProviderBrokerRequest | null> {
	if (input.request.method !== "POST" || url.pathname !== "/v1/model-calls") {
		respond(input.response, 404, {error: "not-found"});
		return null;
	}
	const brokerRequest = assertProviderBrokerRequest(
		parseBrokerRequest(await readBoundedBody(input.request)),
	);
	if (
		brokerRequest.runId !== input.options.runId ||
		brokerRequest.route.routeDigest !== input.options.routeDigest
	) {
		respond(input.response, 403, {error: "capability-scope-mismatch"});
		return null;
	}
	if (input.consumed.has(brokerRequest.callId)) {
		respond(input.response, 409, {error: "duplicate-call"});
		return null;
	}
	input.consumed.add(brokerRequest.callId);
	return brokerRequest;
}

async function executeBrokerCall(input: {
	readonly response: ServerResponse;
	readonly options: PrivateProviderBrokerServerOptions;
	readonly receipts: ProviderBrokerReceipt[];
	readonly now: () => string;
	readonly brokerRequest: ProviderBrokerRequest;
	readonly controller: AbortController;
}): Promise<void> {
	const startedAt = input.now();
	let providerRequestId: string | null = null;
	let selectedProvider = input.brokerRequest.route.provider;
	let selectedModel = input.brokerRequest.route.model;
	let transportAttempts = 0;
	let failureKind: ProviderBrokerFailureKind | null = null;
	let chunks: CanonicalJsonValue[] = [];
	for (;;) {
		transportAttempts += 1;
		chunks = [];
		try {
			const opened = await input.options.transport.open(
				input.brokerRequest,
				input.controller.signal,
			);
			providerRequestId = opened.providerRequestId;
			selectedProvider = opened.selectedProvider;
			selectedModel = opened.selectedModel;
			assertSelectedTarget(
				input.brokerRequest,
				selectedProvider,
				selectedModel,
				providerRequestId,
			);
			for await (const chunk of opened.chunks) {
				const canonicalChunk = canonicalStreamChunk(chunk);
				chunks.push(canonicalChunk);
				await writeWireMessage(input.response, {kind: "chunk", chunk: canonicalChunk});
			}
			assertTerminalChunk(chunks, providerRequestId);
			failureKind = null;
			break;
		} catch (error: unknown) {
			failureKind = transportFailureKind(error, input.controller.signal);
			providerRequestId = providerRequestIdFrom(error) ?? providerRequestId;
			if (shouldRetryTransport(
				chunks,
				failureKind,
				transportAttempts,
				input.options.binding.maxRetries,
			)) {
				continue;
			}
			break;
		}
	}
	const outcome = receiptOutcome(failureKind);
	const usage = chunks.filter((chunk) =>
		typeOfChunk(chunk) === "usage"
	);
	const receipt = createProviderBrokerReceipt({
		brokerBindingDigest: input.options.binding.bindingDigest,
		callId: input.brokerRequest.callId,
		requestDigest: input.brokerRequest.requestDigest,
		routeDigest: input.brokerRequest.route.routeDigest,
		selectedProvider,
		selectedModel,
		providerRequestId,
		transportAttempts,
		outcome,
		failureKind,
		responseDigest: chunks.length === 0 ? null : canonicalJsonDigest(chunks),
		usageDigest: usage.length === 0 ? null : canonicalJsonDigest(usage),
		startedAt,
		finishedAt: input.now(),
	});
	await input.options.recordReceipt?.(receipt);
	input.receipts.push(receipt);
	await writeWireMessage(input.response, {
		kind: "receipt",
		...sealProviderBrokerReceipt(receipt, input.options.capabilityToken),
	});
}

function assertSelectedTarget(
	request: ProviderBrokerRequest,
	selectedProvider: string,
	selectedModel: string,
	providerRequestId: string | null,
): void {
	if (
		selectedProvider !== request.route.provider ||
		selectedModel !== request.route.model
	) {
		throw new PrivateProviderTransportError(
			"malformed-response",
			"Provider transport selected a target outside the exact Run route.",
			providerRequestId,
		);
	}
}

function assertTerminalChunk(
	chunks: readonly CanonicalJsonValue[],
	providerRequestId: string | null,
): void {
	if (typeOfChunk(chunks.at(-1) || null) === "finish") return;
	throw new PrivateProviderTransportError(
		"malformed-response",
		"Provider transport ended without a terminal finish chunk.",
		providerRequestId,
	);
}

function shouldRetryTransport(
	chunks: readonly CanonicalJsonValue[],
	failureKind: ProviderBrokerFailureKind,
	transportAttempts: number,
	maxRetries: number,
): boolean {
	return (
		chunks.length === 0 &&
		transportRetryable(failureKind) &&
		transportAttempts <= maxRetries
	);
}

function receiptOutcome(
	failureKind: ProviderBrokerFailureKind | null,
): ProviderBrokerReceipt["outcome"] {
	if (failureKind === null) return "completed";
	return failureKind === "cancelled" ? "cancelled" : "failed";
}

function authorized(request: IncomingMessage, access: PrivateProviderBrokerAccess): boolean {
	return (
		request.headers["x-codewiki-capability-id"] === access.capabilityId &&
		request.headers["x-codewiki-capability-token"] === access.capabilityToken
	);
}

async function readBoundedBody(request: IncomingMessage): Promise<string> {
	const chunks: Buffer[] = [];
	let byteLength = 0;
	for await (const chunk of request) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
		byteLength += buffer.length;
		if (byteLength > MAX_REQUEST_BYTES) {
			throw new Error("Private provider broker request exceeds its byte limit.");
		}
		chunks.push(buffer);
	}
	return Buffer.concat(chunks).toString("utf8");
}

async function writeWireMessage(
	response: ServerResponse,
	message: ProviderBrokerWireMessage,
): Promise<void> {
	if (!response.write(`${canonicalJson(message)}\n`)) await once(response, "drain");
}

function respond(response: ServerResponse, status: number, value: CanonicalJsonValue): void {
	response.writeHead(status, {"content-type": "application/json", "cache-control": "no-store"});
	response.end(canonicalJson(value));
}

function deadlineCancellation(
	deadlineAt: string,
	controller: AbortController,
	observedAt: string,
): NodeJS.Timeout {
	const delay = Math.max(
		1,
		Math.min(Date.parse(deadlineAt) - Date.parse(observedAt), 2_147_483_647),
	);
	return setTimeout(() => controller.abort("deadline-exceeded"), delay);
}

function transportFailureKind(
	error: unknown,
	signal: AbortSignal,
): ProviderBrokerFailureKind {
	if (signal.aborted) return "cancelled";
	return error instanceof PrivateProviderTransportError
		? error.failureKind
		: "unavailable";
}

function providerRequestIdFrom(error: unknown): string | null {
	return error instanceof PrivateProviderTransportError ? error.providerRequestId : null;
}

function transportRetryable(kind: ProviderBrokerFailureKind): boolean {
	return kind === "timeout" || kind === "rate-limited" || kind === "unavailable";
}

function canonicalStreamChunk(chunk: StreamChunk): CanonicalJsonValue {
	try {
		return toCanonicalJsonValue(structuredClone(chunk));
	} catch {
		throw new PrivateProviderTransportError(
			"malformed-response",
			"Provider transport emitted a non-canonical stream chunk.",
		);
	}
}

function typeOfChunk(chunk: CanonicalJsonValue): string | null {
	if (chunk === null || Array.isArray(chunk) || typeof chunk !== "object") return null;
	return String((chunk as Readonly<Record<string, CanonicalJsonValue>>).type || "");
}

function parseBrokerRequest(value: string): ProviderBrokerRequest {
	try {
		return JSON.parse(value) as ProviderBrokerRequest;
	} catch {
		throw new Error("Private provider broker request is not valid JSON.");
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
