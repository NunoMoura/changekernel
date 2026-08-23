import {createHmac, timingSafeEqual} from "node:crypto";
import {isAbsolute} from "node:path";
import {
	createRunModelRouteBinding,
	type RunModelRouteBinding,
} from "../contracts.ts";
import {
	assertSha256Digest,
	canonicalJson,
	canonicalJsonDigest,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export const PRIVATE_PROVIDER_BROKER_PROTOCOL = Object.freeze({
	id: "codewiki.private-provider-broker",
	version: "1.0.0",
} as const);

export type PrivateProviderBrokerMode = "direct" | "switchyard-passthrough";
export type ProviderBrokerOutcome = "completed" | "failed" | "cancelled";
export type ProviderBrokerFailureKind =
	| "timeout"
	| "rate-limited"
	| "unavailable"
	| "authentication"
	| "quota-exhausted"
	| "context-overflow"
	| "malformed-response"
	| "cancelled";

export interface PrivateProviderBrokerBinding {
	readonly protocol: typeof PRIVATE_PROVIDER_BROKER_PROTOCOL;
	readonly brokerId: string;
	readonly implementationId: string;
	readonly implementationVersion: string;
	readonly implementationDigest: Sha256Digest;
	readonly configurationDigest: Sha256Digest;
	readonly mode: PrivateProviderBrokerMode;
	readonly maxRetries: number;
	readonly bindingDigest: Sha256Digest;
}

export interface PrivateProviderBrokerAccess {
	readonly endpoint: string;
	readonly capabilityId: string;
	readonly capabilityToken: string;
	readonly expiresAt: string;
	readonly binding: PrivateProviderBrokerBinding;
}

export interface ProviderBrokerRequest {
	readonly schemaVersion: "1.0.0";
	readonly callId: string;
	readonly runId: string;
	readonly callIndex: number;
	readonly route: RunModelRouteBinding;
	readonly deadlineAt: string;
	readonly payload: CanonicalJsonValue;
	readonly payloadDigest: Sha256Digest;
	readonly requestDigest: Sha256Digest;
}

export interface ProviderBrokerReceipt {
	readonly schemaVersion: "1.0.0";
	readonly brokerBindingDigest: Sha256Digest;
	readonly callId: string;
	readonly requestDigest: Sha256Digest;
	readonly routeDigest: Sha256Digest;
	readonly selectedProvider: string;
	readonly selectedModel: string;
	readonly providerRequestId: string | null;
	readonly transportAttempts: number;
	readonly outcome: ProviderBrokerOutcome;
	readonly failureKind: ProviderBrokerFailureKind | null;
	readonly responseDigest: Sha256Digest | null;
	readonly usageDigest: Sha256Digest | null;
	readonly startedAt: string;
	readonly finishedAt: string;
	readonly receiptDigest: Sha256Digest;
}

export interface ProviderBrokerReceiptEnvelope {
	readonly receipt: ProviderBrokerReceipt;
	readonly receiptMac: string;
}

export type ProviderBrokerWireMessage =
	| {readonly kind: "chunk"; readonly chunk: CanonicalJsonValue}
	| ({readonly kind: "receipt"} & ProviderBrokerReceiptEnvelope);

export function createPrivateProviderBrokerBinding(
	input: Omit<PrivateProviderBrokerBinding, "protocol" | "bindingDigest">,
): Readonly<PrivateProviderBrokerBinding> {
	const body = Object.freeze({
		protocol: PRIVATE_PROVIDER_BROKER_PROTOCOL,
		brokerId: identifier(input.brokerId, "Private provider broker id"),
		implementationId: identifier(
			input.implementationId,
			"Private provider broker implementation id",
		),
		implementationVersion: version(
			input.implementationVersion,
			"Private provider broker implementation version",
		),
		implementationDigest: assertSha256Digest(
			input.implementationDigest,
			"Private provider broker implementation digest",
		),
		configurationDigest: assertSha256Digest(
			input.configurationDigest,
			"Private provider broker configuration digest",
		),
		mode: brokerMode(input.mode),
		maxRetries: nonNegativeInteger(input.maxRetries, "Private provider broker retries", 8),
	});
	if (body.mode === "switchyard-passthrough" && body.maxRetries !== 0) {
		throw new Error("Switchyard passthrough qualification requires zero retries.");
	}
	return Object.freeze({...body, bindingDigest: canonicalJsonDigest(body)});
}

export function createPrivateProviderBrokerAccess(
	input: PrivateProviderBrokerAccess,
): Readonly<PrivateProviderBrokerAccess> {
	const endpoint = privateBrokerEndpoint(input.endpoint);
	const capabilityToken = boundedText(
		input.capabilityToken,
		"Private provider broker capability token",
		512,
	);
	if (capabilityToken.length < 32) {
		throw new Error("Private provider broker capability token is too short.");
	}
	return Object.freeze({
		endpoint,
		capabilityId: identifier(input.capabilityId, "Private provider broker capability id"),
		capabilityToken,
		expiresAt: timestamp(input.expiresAt, "Private provider broker capability expiry"),
		binding: createPrivateProviderBrokerBinding(input.binding),
	});
}

export function createProviderBrokerRequest(input: {
	readonly runId: string;
	readonly callIndex: number;
	readonly route: RunModelRouteBinding;
	readonly deadlineAt: string;
	readonly payload: CanonicalJsonValue;
}): Readonly<ProviderBrokerRequest> {
	const runId = identifier(input.runId, "Provider broker Run id");
	const callIndex = nonNegativeInteger(input.callIndex, "Provider broker call index", 1_000_000);
	const route = recreateRoute(input.route);
	const deadlineAt = timestamp(input.deadlineAt, "Provider broker deadline");
	const payloadDigest = canonicalJsonDigest(input.payload);
	const identity = {runId, callIndex, routeDigest: route.routeDigest, payloadDigest};
	const callId = `provider-call:${canonicalJsonDigest(identity).slice(7)}`;
	const body = Object.freeze({
		schemaVersion: "1.0.0" as const,
		callId,
		runId,
		callIndex,
		route,
		deadlineAt,
		payload: input.payload,
		payloadDigest,
	});
	return Object.freeze({...body, requestDigest: canonicalJsonDigest(body)});
}

export function assertProviderBrokerRequest(
	value: ProviderBrokerRequest,
): Readonly<ProviderBrokerRequest> {
	const expected = createProviderBrokerRequest(value);
	if (canonicalJson(value) !== canonicalJson(expected)) {
		throw new Error("Provider broker request identity is invalid.");
	}
	return expected;
}

export function createProviderBrokerReceipt(
	input: Omit<ProviderBrokerReceipt, "schemaVersion" | "receiptDigest">,
): Readonly<ProviderBrokerReceipt> {
	const outcome = brokerOutcome(input.outcome);
	const failureKind = input.failureKind === null
		? null
		: brokerFailureKind(input.failureKind);
	if ((outcome === "completed") !== (failureKind === null)) {
		throw new Error("Provider broker receipt outcome and failure kind disagree.");
	}
	const startedAt = timestamp(input.startedAt, "Provider broker receipt start");
	const finishedAt = timestamp(input.finishedAt, "Provider broker receipt finish");
	if (Date.parse(finishedAt) < Date.parse(startedAt)) {
		throw new Error("Provider broker receipt finish precedes its start.");
	}
	const body = Object.freeze({
		schemaVersion: "1.0.0" as const,
		brokerBindingDigest: assertSha256Digest(
			input.brokerBindingDigest,
			"Provider broker binding digest",
		),
		callId: identifier(input.callId, "Provider broker receipt call id"),
		requestDigest: assertSha256Digest(input.requestDigest, "Provider broker request digest"),
		routeDigest: assertSha256Digest(input.routeDigest, "Provider broker route digest"),
		selectedProvider: identifier(input.selectedProvider, "Provider broker selected provider"),
		selectedModel: boundedText(input.selectedModel, "Provider broker selected model", 256),
		providerRequestId: input.providerRequestId === null
			? null
			: boundedText(input.providerRequestId, "Provider request id", 512),
		transportAttempts: positiveInteger(
			input.transportAttempts,
			"Provider broker transport attempts",
			9,
		),
		outcome,
		failureKind,
		responseDigest: optionalDigest(input.responseDigest, "Provider broker response digest"),
		usageDigest: optionalDigest(input.usageDigest, "Provider broker usage digest"),
		startedAt,
		finishedAt,
	});
	if (body.outcome === "completed" && body.responseDigest === null) {
		throw new Error("Completed provider broker receipt requires a response digest.");
	}
	return Object.freeze({...body, receiptDigest: canonicalJsonDigest(body)});
}

export function assertProviderBrokerReceipt(
	value: ProviderBrokerReceipt,
): Readonly<ProviderBrokerReceipt> {
	const {schemaVersion: _schemaVersion, receiptDigest, ...input} = value;
	const expected = createProviderBrokerReceipt(input);
	if (
		receiptDigest !== expected.receiptDigest ||
		canonicalJson(value) !== canonicalJson(expected)
	) {
		throw new Error("Provider broker receipt identity is invalid.");
	}
	return expected;
}

export function assertProviderBrokerReceiptForRequest(
	receipt: ProviderBrokerReceipt,
	request: ProviderBrokerRequest,
	binding: PrivateProviderBrokerBinding,
): void {
	if (
		receipt.brokerBindingDigest !== binding.bindingDigest ||
		receipt.callId !== request.callId ||
		receipt.requestDigest !== request.requestDigest ||
		receipt.routeDigest !== request.route.routeDigest ||
		receipt.selectedProvider !== request.route.provider ||
		receipt.selectedModel !== request.route.model
	) {
		throw new Error("Provider broker receipt does not match its exact Run route and request.");
	}
}

export function sealProviderBrokerReceipt(
	receiptValue: ProviderBrokerReceipt,
	capabilityToken: string,
): Readonly<ProviderBrokerReceiptEnvelope> {
	const receipt = assertProviderBrokerReceipt(receiptValue);
	return Object.freeze({
		receipt,
		receiptMac: receiptMac(receipt, capabilityToken),
	});
}

export function openProviderBrokerReceipt(
	envelope: ProviderBrokerReceiptEnvelope,
	capabilityToken: string,
): Readonly<ProviderBrokerReceipt> {
	const receipt = assertProviderBrokerReceipt(envelope.receipt);
	const expected = Buffer.from(receiptMac(receipt, capabilityToken), "hex");
	const actual = Buffer.from(envelope.receiptMac, "hex");
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
		throw new Error("Provider broker receipt authentication failed.");
	}
	return receipt;
}

function recreateRoute(route: RunModelRouteBinding): RunModelRouteBinding {
	const {routeDigest, ...input} = route;
	const expected = createRunModelRouteBinding(input);
	if (routeDigest !== expected.routeDigest || canonicalJson(route) !== canonicalJson(expected)) {
		throw new Error("Provider broker route identity is invalid.");
	}
	return expected;
}

function receiptMac(receipt: ProviderBrokerReceipt, capabilityToken: string): string {
	return createHmac("sha256", capabilityToken)
		.update("codewiki.private-provider-broker/receipt/1\0")
		.update(canonicalJson(receipt))
		.digest("hex");
}

function privateBrokerEndpoint(value: string): string {
	let endpoint: URL;
	try {
		endpoint = new URL(boundedText(value, "Private provider broker endpoint", 2_048));
	} catch {
		throw new Error("Private provider broker endpoint is invalid.");
	}
	if (endpoint.protocol === "unix:") return unixSocketEndpoint(endpoint);
	if (
		endpoint.protocol !== "http:" ||
		!["127.0.0.1", "[::1]", "::1"].includes(endpoint.hostname) ||
		endpoint.username ||
		endpoint.password ||
		endpoint.search ||
		endpoint.hash
	) {
		throw new Error("Private provider broker endpoint must be credential-free loopback HTTP or an absolute Unix socket.");
	}
	endpoint.pathname = endpoint.pathname.replace(/\/$/, "");
	return endpoint.toString().replace(/\/$/, "");
}

function unixSocketEndpoint(endpoint: URL): string {
	let socketPath: string;
	try {
		socketPath = decodeURIComponent(endpoint.pathname);
	} catch {
		throw new Error("Private provider broker Unix socket path is invalid.");
	}
	if (
		endpoint.hostname ||
		endpoint.username ||
		endpoint.password ||
		endpoint.port ||
		endpoint.search ||
		endpoint.hash ||
		!isAbsolute(socketPath) ||
		Buffer.byteLength(socketPath) > 100
	) {
		throw new Error("Private provider broker Unix socket path must be absolute and bounded.");
	}
	return endpoint.toString();
}

function identifier(value: string, field: string): string {
	const normalized = boundedText(value, field, 256);
	if (!/^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/.test(normalized)) {
		throw new Error(`${field} is invalid.`);
	}
	return normalized;
}

function boundedText(value: string, field: string, maximum: number): string {
	if (typeof value !== "string" || !value.trim() || value.length > maximum) {
		throw new Error(`${field} is invalid.`);
	}
	return value.trim();
}

function version(value: string, field: string): string {
	const normalized = boundedText(value, field, 64);
	if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(normalized)) {
		throw new Error(`${field} must be an exact semantic version.`);
	}
	return normalized;
}

function timestamp(value: string, field: string): string {
	if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) {
		throw new Error(`${field} is invalid.`);
	}
	return value.trim();
}

function nonNegativeInteger(value: number, field: string, maximum: number): number {
	if (!Number.isInteger(value) || value < 0 || value > maximum) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}

function positiveInteger(value: number, field: string, maximum: number): number {
	if (!Number.isInteger(value) || value < 1 || value > maximum) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}

function optionalDigest(value: Sha256Digest | null, field: string): Sha256Digest | null {
	return value === null ? null : assertSha256Digest(value, field);
}

function brokerMode(value: PrivateProviderBrokerMode): PrivateProviderBrokerMode {
	if (value !== "direct" && value !== "switchyard-passthrough") {
		throw new Error("Private provider broker mode is invalid.");
	}
	return value;
}

function brokerOutcome(value: ProviderBrokerOutcome): ProviderBrokerOutcome {
	if (value !== "completed" && value !== "failed" && value !== "cancelled") {
		throw new Error("Provider broker outcome is invalid.");
	}
	return value;
}

function brokerFailureKind(value: ProviderBrokerFailureKind): ProviderBrokerFailureKind {
	if (!([
		"timeout",
		"rate-limited",
		"unavailable",
		"authentication",
		"quota-exhausted",
		"context-overflow",
		"malformed-response",
		"cancelled",
	] as const).includes(value)) {
		throw new Error("Provider broker failure kind is invalid.");
	}
	return value;
}
