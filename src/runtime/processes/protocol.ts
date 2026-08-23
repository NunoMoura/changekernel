import {Buffer} from "node:buffer";
import {createHmac, timingSafeEqual} from "node:crypto";

import {
	RUN_PROTOCOL,
	RUN_REQUEST_SCHEMA_VERSION,
	admitRunProcessHandshake,
	createRunCancellationRequest,
	createRunEvent,
	createRunHandle,
	createRunQuiescence,
	createRunProcessResult,
	createRunRawLogReference,
	createRunRequest,
	type RunCustodyGap,
	type RunProcessHandshake,
	type RunProcessResult,
	type RunCancellationRequest,
	type RunEvent,
	type RunHandle,
	type RunQuiescence,
	type RunRawLogReference,
	type RunRequest,
	type RunRequestInput,
	type RuntimeBuildBinding,
} from "../contracts.ts";
import {
	assertExecutionLedgerEntry,
	createExecutionLedger,
	type ExecutionLedgerEntry,
	type ExecutionLedgerHeader,
} from "../evidence/execution-ledger.ts";
import {
	assertSha256Digest,
	canonicalJson,
	canonicalJsonDigest,
	sha256Digest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export const RUNNER_PROCESS_PROTOCOL = Object.freeze({
	id: "codewiki.run-process",
	version: "3.0.0",
} as const);

export const MAX_RUN_RAW_LOG_CHUNK_BYTES = 64 * 1_024;

export type RunProcessDirection =
	| "runtime-to-run-process"
	| "run-process-to-runtime";
export type RunProcessMac = `hmac-sha256:${string}`;

export interface RunProcessChallenge {
	readonly processProtocolId: typeof RUNNER_PROCESS_PROTOCOL.id;
	readonly processProtocolVersion: typeof RUNNER_PROCESS_PROTOCOL.version;
	readonly runProtocolId: typeof RUN_PROTOCOL.id;
	readonly runProtocolVersion: string;
	readonly runtimeBuildDigest: Sha256Digest;
	readonly runId: string;
	readonly requestDigest: Sha256Digest;
	readonly channelId: string;
	readonly challengeNonce: string;
	readonly issuedAt: string;
	readonly expiresAt: string;
	readonly challengeDigest: Sha256Digest;
}

interface RunProcessHandshakeResponse {
	readonly challengeDigest: Sha256Digest;
	readonly handshake: RunProcessHandshake;
	readonly proof: RunProcessMac;
}

export type RuntimeWireMessage =
	| {
			readonly kind: "start";
			readonly request: RunRequest;
			readonly handle: RunHandle;
			readonly acceptedEvent: RunEvent;
	  }
	| {
			readonly kind: "cancel";
			readonly request: RunCancellationRequest;
	  };

export interface RunRawLogChunk {
	readonly reference: RunRawLogReference;
	readonly offset: number;
	readonly contentBase64: string;
	readonly chunkDigest: Sha256Digest;
}

export type RunProcessWireMessage =
	| {
			readonly kind: "event";
			readonly event: RunEvent;
	  }
	| {
			readonly kind: "ledger-header";
			readonly header: ExecutionLedgerHeader;
	  }
	| {
			readonly kind: "ledger-entry";
			readonly entry: ExecutionLedgerEntry;
	  }
	| {
			readonly kind: "raw-log-chunk";
			readonly chunk: RunRawLogChunk;
	  }
	| {
			readonly kind: "result";
			readonly result: RunProcessResult;
	  }
	| {
			readonly kind: "quiescence";
			readonly quiescence: RunQuiescence;
	  };

export type RunProcessMessage =
	| RuntimeWireMessage
	| RunProcessWireMessage;

export interface RunProcessAuthenticatedEnvelope {
	readonly processProtocolId: typeof RUNNER_PROCESS_PROTOCOL.id;
	readonly processProtocolVersion: typeof RUNNER_PROCESS_PROTOCOL.version;
	readonly channelId: string;
	readonly direction: RunProcessDirection;
	readonly sequence: number;
	readonly message: RunProcessMessage;
	readonly mac: RunProcessMac;
}

export function createRunProcessChallenge(input: {
	readonly binding: RuntimeBuildBinding;
	readonly request: RunRequest;
	readonly channelId: string;
	readonly challengeNonce: string;
	readonly issuedAt: string;
	readonly expiresAt: string;
}): Readonly<RunProcessChallenge> {
	const request = normalizeRequest(input.request);
	assertBindingMatchesRequest(input.binding, request);
	assertIdentifier(input.channelId, "Run Process channelId");
	assertNonce(input.challengeNonce, "Run Process challengeNonce");
	const issuedAt = assertTimestamp(input.issuedAt, "Run Process challenge issuedAt");
	const expiresAt = assertTimestamp(
		input.expiresAt,
		"Run Process challenge expiresAt",
	);
	assertChallengeLifetime(issuedAt, expiresAt);
	const body = processChallengeBody({
		runProtocolVersion: input.binding.runProtocolVersion,
		runtimeBuildDigest: input.binding.buildDigest,
		runId: request.runId,
		requestDigest: request.requestDigest,
		channelId: input.channelId,
		challengeNonce: input.challengeNonce,
		issuedAt,
		expiresAt,
	});
	return Object.freeze({...body, challengeDigest: canonicalJsonDigest(body)});
}

export function createRunProcessHandshakeResponse(input: {
	readonly challenge: RunProcessChallenge;
	readonly handshake: RunProcessHandshake;
	readonly bootstrapKey: Uint8Array;
}): Readonly<RunProcessHandshakeResponse> {
	const challenge = normalizeChallenge(input.challenge);
	const handshake = admitRunProcessHandshake(
		challengeBinding(challenge),
		input.handshake,
	);
	const proofBody = Object.freeze({
		challengeDigest: challenge.challengeDigest,
		handshake,
	});
	return Object.freeze({
		...proofBody,
		proof: authenticate("handshake", proofBody, input.bootstrapKey),
	});
}

export function admitRunProcessHandshakeResponse(input: {
	readonly challenge: RunProcessChallenge;
	readonly binding: RuntimeBuildBinding;
	readonly response: unknown;
	readonly bootstrapKey: Uint8Array;
	readonly admittedAt: string;
}): Readonly<RunProcessHandshake> {
	const challenge = normalizeChallenge(input.challenge);
	assertBindingMatchesChallenge(input.binding, challenge);
	const admittedAt = assertTimestamp(
		input.admittedAt,
		"Run Process handshake admittedAt",
	);
	if (
		Date.parse(admittedAt) < Date.parse(challenge.issuedAt) ||
		Date.parse(admittedAt) >= Date.parse(challenge.expiresAt)
	) {
		throw new Error("Run Process challenge expired.");
	}
	const response = record(input.response, "Run Process handshake response");
	assertExactKeys(response, ["challengeDigest", "handshake", "proof"], "Run Process handshake response");
	if (response.challengeDigest !== challenge.challengeDigest) {
		throw new Error("Run Process handshake challenge does not match.");
	}
	const handshake = admitRunProcessHandshake(input.binding, response.handshake);
	const proofBody = Object.freeze({
		challengeDigest: challenge.challengeDigest,
		handshake,
	});
	assertAuthenticated({
		context: "handshake",
		value: proofBody,
		actual: response.proof,
		key: input.bootstrapKey,
		message: "Run Process handshake authentication failed.",
	});
	return handshake;
}

export function createRunProcessAcceptedEvent(
	challengeValue: RunProcessChallenge,
	handle: RunHandle,
): Readonly<RunEvent> {
	const challenge = normalizeChallenge(challengeValue);
	requireHandle(handle, challenge);
	return createRunEvent(handle, {
		sequence: 0,
		kind: "accepted",
		occurredAt: handle.acceptedAt,
		payloadDigest: canonicalJsonDigest({
			challengeDigest: challenge.challengeDigest,
			handle,
		}),
	});
}

export function sealRunProcessEnvelope(input: {
	readonly challenge: RunProcessChallenge;
	readonly direction: RunProcessDirection;
	readonly sequence: number;
	readonly message: RunProcessMessage;
	readonly handle?: RunHandle;
	readonly bootstrapKey: Uint8Array;
}): Readonly<RunProcessAuthenticatedEnvelope> {
	const challenge = normalizeChallenge(input.challenge);
	assertDirection(input.direction);
	assertSequence(input.sequence);
	const message = normalizeMessage({
		challenge,
		direction: input.direction,
		message: input.message,
		handle: input.handle,
	});
	const body = Object.freeze({
		processProtocolId: RUNNER_PROCESS_PROTOCOL.id,
		processProtocolVersion: RUNNER_PROCESS_PROTOCOL.version,
		channelId: challenge.channelId,
		direction: input.direction,
		sequence: input.sequence,
		message,
	});
	return Object.freeze({
		...body,
		mac: authenticate("envelope", body, input.bootstrapKey),
	});
}

export function openRunProcessEnvelope(input: {
	readonly challenge: RunProcessChallenge;
	readonly expectedDirection: RunProcessDirection;
	readonly expectedSequence: number;
	readonly value: unknown;
	readonly handle?: RunHandle;
	readonly bootstrapKey: Uint8Array;
}): Readonly<RunProcessAuthenticatedEnvelope> {
	const challenge = normalizeChallenge(input.challenge);
	assertDirection(input.expectedDirection);
	assertSequence(input.expectedSequence);
	const envelope = record(input.value, "Run Process envelope");
	assertExactKeys(
		envelope,
		[
			"processProtocolId",
			"processProtocolVersion",
			"channelId",
			"direction",
			"sequence",
			"message",
			"mac",
		],
		"Run Process envelope",
	);
	if (
		envelope.processProtocolId !== RUNNER_PROCESS_PROTOCOL.id ||
		envelope.processProtocolVersion !== RUNNER_PROCESS_PROTOCOL.version
	) {
		throw new Error("Run Process envelope process protocol is unsupported.");
	}
	if (envelope.channelId !== challenge.channelId) {
		throw new Error("Run Process envelope channel does not match the challenge.");
	}
	if (envelope.direction !== input.expectedDirection) {
		throw new Error("Run Process envelope direction does not match the channel side.");
	}
	if (envelope.sequence !== input.expectedSequence) {
		throw new Error("Run Process envelope sequence is stale or out of order.");
	}
	const body = Object.freeze({
		processProtocolId: RUNNER_PROCESS_PROTOCOL.id,
		processProtocolVersion: RUNNER_PROCESS_PROTOCOL.version,
		channelId: challenge.channelId,
		direction: input.expectedDirection,
		sequence: input.expectedSequence,
		message: envelope.message,
	});
	assertAuthenticated({
		context: "envelope",
		value: body,
		actual: envelope.mac,
		key: input.bootstrapKey,
		message: "Run Process envelope authentication failed.",
	});
	const message = normalizeMessage({
		challenge,
		direction: input.expectedDirection,
		message: envelope.message,
		handle: input.handle,
	});
	return Object.freeze({...body, message, mac: envelope.mac as RunProcessMac});
}

function normalizeMessage(input: {
	readonly challenge: RunProcessChallenge;
	readonly direction: RunProcessDirection;
	readonly message: unknown;
	readonly handle?: RunHandle;
}): RunProcessMessage {
	const message = record(input.message, "Run Process envelope message");
	if (message.kind === "start" && input.direction === "runtime-to-run-process") {
		assertExactKeys(
			message,
			["kind", "request", "handle", "acceptedEvent"],
			"Run Process start message",
		);
		const request = normalizeRequest(message.request);
		assertRequestMatchesChallenge(request, input.challenge);
		const handle = normalizeHandle(message.handle, request);
		const acceptedEvent = normalizeEvent(message.acceptedEvent, handle);
		const expectedEvent = createRunProcessAcceptedEvent(input.challenge, handle);
		assertCanonicalMatch(
			expectedEvent,
			acceptedEvent,
			"Run accepted event",
		);
		return Object.freeze({
			kind: "start",
			request,
			handle,
			acceptedEvent,
		});
	}
	const handle = requireHandle(input.handle, input.challenge);
	if (message.kind === "cancel" && input.direction === "runtime-to-run-process") {
		assertExactKeys(message, ["kind", "request"], "Run Process cancellation message");
		const request = normalizeCancellation(message.request, handle);
		return Object.freeze({kind: "cancel", request});
	}
	if (input.direction === "run-process-to-runtime") {
		const normalized = normalizeRunProcessMessage(message, handle);
		if (normalized) return normalized;
	}
	throw new Error("Run Process envelope message is not allowed for its direction.");
}

function normalizeRunProcessMessage(
	message: Record<string, unknown>,
	handle: RunHandle,
): RunProcessWireMessage | null {
	if (message.kind === "event") {
		assertExactKeys(message, ["kind", "event"], "Run Process event message");
		return Object.freeze({kind: "event", event: normalizeEvent(message.event, handle)});
	}
	if (message.kind === "ledger-header") {
		assertExactKeys(message, ["kind", "header"], "Run Process ledger header message");
		return Object.freeze({
			kind: "ledger-header",
			header: normalizeLedgerHeader(message.header, handle),
		});
	}
	if (message.kind === "ledger-entry") {
		assertExactKeys(message, ["kind", "entry"], "Run Process ledger entry message");
		const entry = assertExecutionLedgerEntry(message.entry);
		assertCanonicalMatch(entry, message.entry, "Run Process ledger entry");
		return Object.freeze({kind: "ledger-entry", entry});
	}
	if (message.kind === "raw-log-chunk") {
		assertExactKeys(message, ["kind", "chunk"], "Run Process raw-log chunk message");
		return Object.freeze({
			kind: "raw-log-chunk",
			chunk: normalizeRunRawLogChunk(message.chunk, handle),
		});
	}
	if (message.kind === "result") {
		assertExactKeys(message, ["kind", "result"], "Run Process result message");
		return Object.freeze({kind: "result", result: normalizeResult(message.result, handle)});
	}
	if (message.kind === "quiescence") {
		assertExactKeys(message, ["kind", "quiescence"], "Run Process quiescence message");
		return Object.freeze({
			kind: "quiescence",
			quiescence: normalizeQuiescence(message.quiescence, handle),
		});
	}
	return null;
}

function normalizeRequest(value: unknown): RunRequest {
	const request = record(value, "Run Request");
	assertExactKeys(
		request,
		[
			"schemaVersion",
			"runId",
			"operationId",
			"custody",
			"role",
			"stage",
			"subject",
			"runtimeBuild",
			"session",
			"inputs",
			"continuation",
			"workspace",
			"budget",
			"createdAt",
			"deadlineAt",
			"requestDigest",
		],
		"Run Request",
	);
	if (request.schemaVersion !== RUN_REQUEST_SCHEMA_VERSION) {
		throw new Error("Run Request schemaVersion is invalid.");
	}
	const {schemaVersion: _schemaVersion, requestDigest, ...input} = request;
	// SAFETY: exact persisted request keys and schema discriminator are validated above; createRunRequest validates every field.
	const normalized = createRunRequest(
		input as unknown as RunRequestInput,
	);
	if (requestDigest !== normalized.requestDigest) {
		throw new Error("Run Request digest does not match its content.");
	}
	return normalized;
}

function normalizeHandle(
	value: unknown,
	request: RunRequest,
): RunHandle {
	const handle = record(value, "Run handle");
	assertExactKeys(
		handle,
		[
			"runId",
			"requestDigest",
			"custody",
			"runtimeBuild",
			"continuityKey",
			"sessionId",
			"expectedSessionHead",
			"sessionLeaseDigest",
			"continuationBindingDigest",
			"materialDigest",
			"feedbackDigest",
			"modelRouteDigest",
			"acceptedAt",
		],
		"Run handle",
	);
	if (typeof handle.acceptedAt !== "string") {
		throw new Error("Run handle acceptedAt is invalid.");
	}
	const normalized = createRunHandle(request, handle.acceptedAt);
	if (canonicalJson(normalized) !== canonicalJson(handle)) {
		throw new Error("Run handle does not match its request.");
	}
	return normalized;
}

function normalizeCancellation(
	value: unknown,
	handle: RunHandle,
): RunCancellationRequest {
	const request = record(value, "Run cancellation request");
	assertExactKeys(
		request,
		["runId", "requestDigest", "expectedEventSequence", "reason", "requestedAt"],
		"Run cancellation request",
	);
	const normalized = createRunCancellationRequest(handle, {
		expectedEventSequence: request.expectedEventSequence as number,
		reason: request.reason as RunCancellationRequest["reason"],
		requestedAt: request.requestedAt as string,
	});
	assertCanonicalMatch(normalized, request, "Run cancellation request");
	return normalized;
}

function normalizeEvent(value: unknown, handle: RunHandle): RunEvent {
	const event = record(value, "Run event");
	assertExactKeys(
		event,
		["runId", "requestDigest", "sequence", "kind", "occurredAt", "payloadDigest"],
		"Run event",
	);
	const normalized = createRunEvent(handle, {
		sequence: event.sequence as number,
		kind: event.kind as RunEvent["kind"],
		occurredAt: event.occurredAt as string,
		payloadDigest: event.payloadDigest as Sha256Digest,
	});
	assertCanonicalMatch(normalized, event, "Run event");
	return normalized;
}

export function createRunRawLogChunk(input: {
	readonly reference: RunRawLogReference;
	readonly offset: number;
	readonly content: Uint8Array;
}): Readonly<RunRawLogChunk> {
	const reference = createRunRawLogReference(input.reference);
	if (!Number.isInteger(input.offset) || input.offset < 0) {
		throw new Error("Run raw-log chunk offset is invalid.");
	}
	const bytes = Buffer.from(input.content);
	if (bytes.byteLength === 0 || bytes.byteLength > MAX_RUN_RAW_LOG_CHUNK_BYTES) {
		throw new Error("Run raw-log chunk size is invalid.");
	}
	if (input.offset + bytes.byteLength > reference.byteLength) {
		throw new Error("Run raw-log chunk exceeds its declared artifact.");
	}
	return Object.freeze({
		reference,
		offset: input.offset,
		contentBase64: bytes.toString("base64"),
		chunkDigest: sha256Digest(bytes),
	});
}

export function runRawLogChunkBytes(chunk: RunRawLogChunk): Buffer {
	const content = Buffer.from(chunk.contentBase64, "base64");
	if (content.toString("base64") !== chunk.contentBase64) {
		throw new Error("Run raw-log chunk encoding is invalid.");
	}
	if (sha256Digest(content) !== chunk.chunkDigest) {
		throw new Error("Run raw-log chunk digest is invalid.");
	}
	return content;
}

function normalizeLedgerHeader(
	value: unknown,
	handle: RunHandle,
): Readonly<ExecutionLedgerHeader> {
	const header = createExecutionLedger(value as ExecutionLedgerHeader).header;
	if (header.runId !== handle.runId || header.requestDigest !== handle.requestDigest) {
		throw new Error("Run Process ledger header does not match its Run.");
	}
	assertCanonicalMatch(header, value, "Run Process ledger header");
	return header;
}

function normalizeRunRawLogChunk(
	value: unknown,
	handle: RunHandle,
): Readonly<RunRawLogChunk> {
	const chunk = record(value, "Run raw-log chunk");
	assertExactKeys(
		chunk,
		["reference", "offset", "contentBase64", "chunkDigest"],
		"Run raw-log chunk",
	);
	if (typeof chunk.contentBase64 !== "string") {
		throw new Error("Run raw-log chunk encoding is invalid.");
	}
	const normalized = createRunRawLogChunk({
		reference: chunk.reference as RunRawLogReference,
		offset: chunk.offset as number,
		content: Buffer.from(chunk.contentBase64, "base64"),
	});
	if (
		normalized.reference.sessionId !== handle.sessionId ||
		normalized.reference.runtimeBuildDigest !== handle.runtimeBuild.buildDigest
	) {
		throw new Error("Run raw-log chunk does not match its Run.");
	}
	assertCanonicalMatch(normalized, value, "Run raw-log chunk");
	return normalized;
}

function normalizeResult(
	value: unknown,
	handle: RunHandle,
): RunProcessResult {
	const result = record(value, "Run Process result");
	assertExactKeys(
		result,
		[
			"runId",
			"requestDigest",
			"outcome",
			"startedAt",
			"finishedAt",
			"executionLedgerDigest",
			"outputDigest",
			"usageDigest",
			"cancellationDigest",
			"custodyGaps",
			"resultDigest",
		],
		"Run Process result",
	);
	const normalized = createRunProcessResult(handle, {
		runId: result.runId as string,
		requestDigest: result.requestDigest as Sha256Digest,
		outcome: result.outcome as "completed" | "failed" | "cancelled",
		startedAt: result.startedAt as string,
		finishedAt: result.finishedAt as string,
		executionLedgerDigest: result.executionLedgerDigest as Sha256Digest,
		outputDigest: result.outputDigest as Sha256Digest | null,
		usageDigest: result.usageDigest as Sha256Digest | null,
		cancellationDigest: result.cancellationDigest as Sha256Digest | null,
		custodyGaps: result.custodyGaps as readonly RunCustodyGap[],
	});
	assertCanonicalMatch(normalized, value, "Run Process result");
	return normalized;
}

function normalizeQuiescence(
	value: unknown,
	handle: RunHandle,
): RunQuiescence {
	const quiescence = record(value, "Run quiescence");
	assertExactKeys(
		quiescence,
		[
			"runId",
			"requestDigest",
			"finalEventSequence",
			"quiescedAt",
			"proofDigest",
			"rawLog",
		],
		"Run quiescence",
	);
	const normalized = createRunQuiescence(handle, {
		finalEventSequence: quiescence.finalEventSequence as number,
		quiescedAt: quiescence.quiescedAt as string,
		proofDigest: quiescence.proofDigest as Sha256Digest,
		rawLog: quiescence.rawLog as RunQuiescence["rawLog"],
	});
	assertCanonicalMatch(normalized, quiescence, "Run quiescence");
	return normalized;
}

function assertChallengeLifetime(issuedAt: string, expiresAt: string): void {
	const lifetimeMs = Date.parse(expiresAt) - Date.parse(issuedAt);
	if (lifetimeMs < 1 || lifetimeMs > 60_000) {
		throw new Error("Run Process challenge lifetime is invalid.");
	}
}

function processChallengeBody(input: {
	readonly runProtocolVersion: string;
	readonly runtimeBuildDigest: Sha256Digest;
	readonly runId: string;
	readonly requestDigest: Sha256Digest;
	readonly channelId: string;
	readonly challengeNonce: string;
	readonly issuedAt: string;
	readonly expiresAt: string;
}): Omit<RunProcessChallenge, "challengeDigest"> {
	return Object.freeze({
		processProtocolId: RUNNER_PROCESS_PROTOCOL.id,
		processProtocolVersion: RUNNER_PROCESS_PROTOCOL.version,
		runProtocolId: RUN_PROTOCOL.id,
		...input,
	});
}

function normalizeChallenge(value: unknown): RunProcessChallenge {
	const challenge = record(value, "Run Process challenge");
	assertExactKeys(
		challenge,
		[
			"processProtocolId",
			"processProtocolVersion",
			"runProtocolId",
			"runProtocolVersion",
			"runtimeBuildDigest",
			"runId",
			"requestDigest",
			"channelId",
			"challengeNonce",
			"issuedAt",
			"expiresAt",
			"challengeDigest",
		],
		"Run Process challenge",
	);
	if (
		challenge.processProtocolId !== RUNNER_PROCESS_PROTOCOL.id ||
		challenge.processProtocolVersion !== RUNNER_PROCESS_PROTOCOL.version ||
		challenge.runProtocolId !== RUN_PROTOCOL.id
	) {
		throw new Error("Run Process challenge protocol is unsupported.");
	}
	assertVersion(challenge.runProtocolVersion, "Run Process protocol version");
	const runtimeBuildDigest = assertSha256Digest(
		challenge.runtimeBuildDigest,
		"Run Process build digest",
	);
	assertIdentifier(challenge.runId, "Run Process runId");
	const requestDigest = assertSha256Digest(
		challenge.requestDigest,
		"Run Process Request digest",
	);
	assertIdentifier(challenge.channelId, "Run Process channelId");
	assertNonce(challenge.challengeNonce, "Run Process challengeNonce");
	const issuedAt = assertTimestamp(
		challenge.issuedAt,
		"Run Process challenge issuedAt",
	);
	const expiresAt = assertTimestamp(
		challenge.expiresAt,
		"Run Process challenge expiresAt",
	);
	assertChallengeLifetime(issuedAt, expiresAt);
	const body = processChallengeBody({
		runProtocolVersion: challenge.runProtocolVersion,
		runtimeBuildDigest,
		runId: challenge.runId,
		requestDigest,
		channelId: challenge.channelId,
		challengeNonce: challenge.challengeNonce,
		issuedAt,
		expiresAt,
	});
	const challengeDigest = assertSha256Digest(
		challenge.challengeDigest,
		"Run Process challenge digest",
	);
	if (challengeDigest !== canonicalJsonDigest(body)) {
		throw new Error("Run Process challenge digest does not match its content.");
	}
	return Object.freeze({...body, challengeDigest});
}

function challengeBinding(
	challenge: RunProcessChallenge,
): RuntimeBuildBinding {
	return Object.freeze({
		buildDigest: challenge.runtimeBuildDigest,
		runProtocolVersion: challenge.runProtocolVersion,
	});
}

function assertBindingMatchesRequest(
	binding: RuntimeBuildBinding,
	request: RunRequest,
): void {
	if (canonicalJson(binding) !== canonicalJson(request.runtimeBuild)) {
		throw new Error("Run Process binding does not match the Run Request.");
	}
}

function assertBindingMatchesChallenge(
	binding: RuntimeBuildBinding,
	challenge: RunProcessChallenge,
): void {
	if (canonicalJson(binding) !== canonicalJson(challengeBinding(challenge))) {
		throw new Error("Run Process binding does not match the challenge.");
	}
}

function assertRequestMatchesChallenge(
	request: RunRequest,
	challenge: RunProcessChallenge,
): void {
	if (
		request.runId !== challenge.runId ||
		request.requestDigest !== challenge.requestDigest ||
		request.runtimeBuild.buildDigest !== challenge.runtimeBuildDigest ||
		request.runtimeBuild.runProtocolVersion !==
			challenge.runProtocolVersion
	) {
		throw new Error("Run Process start Request does not match the challenge.");
	}
}

function requireHandle(
	handle: RunHandle | undefined,
	challenge: RunProcessChallenge,
): RunHandle {
	if (
		!handle ||
		handle.runId !== challenge.runId ||
		handle.requestDigest !== challenge.requestDigest ||
		handle.runtimeBuild.buildDigest !== challenge.runtimeBuildDigest ||
		handle.runtimeBuild.runProtocolVersion !== challenge.runProtocolVersion
	) {
		throw new Error("Run Process envelope requires the exact challenged Run handle.");
	}
	return handle;
}

function authenticate(
	context: "handshake" | "envelope",
	value: unknown,
	key: Uint8Array,
): RunProcessMac {
	assertBootstrapKey(key);
	const digest = createHmac("sha256", key)
		.update(`codewiki.run-process/${context}/1\0`)
		.update(canonicalJson(value))
		.digest("hex");
	return `hmac-sha256:${digest}`;
}

function assertAuthenticated(input: {
	readonly context: "handshake" | "envelope";
	readonly value: unknown;
	readonly actual: unknown;
	readonly key: Uint8Array;
	readonly message: string;
}): void {
	let expected: RunProcessMac;
	try {
		expected = authenticate(input.context, input.value, input.key);
	} catch {
		throw new Error(input.message);
	}
	if (
		typeof input.actual !== "string" ||
		!/^hmac-sha256:[0-9a-f]{64}$/.test(input.actual)
	) {
		throw new Error(input.message);
	}
	const expectedBytes = Buffer.from(expected.slice("hmac-sha256:".length), "hex");
	const actualBytes = Buffer.from(
		input.actual.slice("hmac-sha256:".length),
		"hex",
	);
	if (!timingSafeEqual(expectedBytes, actualBytes)) {
		throw new Error(input.message);
	}
}

function assertBootstrapKey(key: Uint8Array): void {
	if (!(key instanceof Uint8Array) || key.byteLength < 32) {
		throw new Error("Run Process bootstrap key must contain at least 32 bytes.");
	}
}

function assertCanonicalMatch(
	normalized: unknown,
	value: unknown,
	field: string,
): void {
	if (canonicalJson(normalized) !== canonicalJson(value)) {
		throw new Error(`${field} does not match the challenged Run.`);
	}
}

function assertDirection(value: unknown): asserts value is RunProcessDirection {
	if (value !== "runtime-to-run-process" && value !== "run-process-to-runtime") {
		throw new Error("Run Process envelope direction is invalid.");
	}
}

function assertSequence(value: unknown): asserts value is number {
	if (!Number.isSafeInteger(value) || (value as number) < 0) {
		throw new Error("Run Process envelope sequence must be a non-negative safe integer.");
	}
}

function assertIdentifier(value: unknown, field: string): asserts value is string {
	if (
		typeof value !== "string" ||
		!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value)
	) {
		throw new Error(`${field} is invalid.`);
	}
}

function assertNonce(value: unknown, field: string): asserts value is string {
	if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
		throw new Error(`${field} must be 32 lowercase hexadecimal bytes.`);
	}
}

function assertTimestamp(value: unknown, field: string): string {
	if (
		typeof value !== "string" ||
		!Number.isFinite(Date.parse(value)) ||
		new Date(value).toISOString() !== value
	) {
		throw new Error(`${field} must be a canonical ISO timestamp.`);
	}
	return value;
}

function assertVersion(value: unknown, field: string): asserts value is string {
	if (typeof value !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value)) {
		throw new Error(`${field} is invalid.`);
	}
}

function record(value: unknown, field: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${field} shape is invalid.`);
	}
	return value as Record<string, unknown>;
}

function assertExactKeys(
	value: Record<string, unknown>,
	expected: readonly string[],
	field: string,
): void {
	const keys = Object.keys(value).sort(compareText);
	const expectedKeys = [...expected].sort(compareText);
	if (
		keys.length !== expectedKeys.length ||
		keys.some((key, index) => key !== expectedKeys[index])
	) {
		throw new Error(`${field} shape is invalid.`);
	}
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
