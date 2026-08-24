import {
	assertSha256Digest,
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../utils/canonical-json.ts";
import {
	CLIENT_PROJECT_SERVER_PROTOCOL,
	normalizeClientProjectServerRequestContext,
	type ClientProjectServerRequestContext,
} from "./client-project-server.ts";

export const FRONTEND_API_PROTOCOL = Object.freeze({
	id: "codewiki.frontend-api",
	version: "1.0.0",
} as const);

export const FRONTEND_CAPABILITY_DOCUMENT_PROTOCOL = Object.freeze({
	id: "codewiki.frontend-capabilities",
	version: "1.0.0",
} as const);

export const FRONTEND_EVENT_PROTOCOL = Object.freeze({
	id: "codewiki.frontend-events",
	version: "1.0.0",
	maxEvents: 128,
	maxWaitMs: 25_000,
} as const);

export const FRONTEND_QUERY_NAMES = Object.freeze([
	"codewiki.app-state.read",
	"codewiki.changes.read",
	"codewiki.configuration.read",
	"codewiki.decision-attention.read",
] as const);

export const FRONTEND_COMMAND_NAMES = Object.freeze([
	"codewiki.decision.select",
] as const);

export const FRONTEND_EVENT_NAMES = Object.freeze([
	"codewiki.projection.invalidated",
] as const);

export const FRONTEND_PROJECTION_NAMES = Object.freeze([
	"app-state",
	"changes",
	"configuration",
	"decision-attention",
] as const);

export const FRONTEND_ERROR_CODES = Object.freeze([
	"authentication_required",
	"authorization_denied",
	"conflict",
	"expired",
	"internal",
	"invalid_request",
	"payload_too_large",
	"rate_limited",
	"stale_snapshot",
	"unavailable",
	"unsupported_capability",
] as const);

export type FrontendQueryName = (typeof FRONTEND_QUERY_NAMES)[number];
export type FrontendCommandName = (typeof FRONTEND_COMMAND_NAMES)[number];
export type FrontendEventName = (typeof FRONTEND_EVENT_NAMES)[number];
export type FrontendProjectionName = (typeof FRONTEND_PROJECTION_NAMES)[number];
export type FrontendErrorCode = (typeof FRONTEND_ERROR_CODES)[number];

export interface FrontendCapabilityDocument {
	readonly protocol: typeof FRONTEND_CAPABILITY_DOCUMENT_PROTOCOL;
	readonly frontendApi: typeof FRONTEND_API_PROTOCOL;
	readonly clientProjectServerProtocol: typeof CLIENT_PROJECT_SERVER_PROTOCOL;
	readonly authentication: {
		readonly required: true;
		readonly authority: "project-server";
		readonly mechanismIds: readonly ["project-server-session"];
		readonly credentialsInPayload: false;
	};
	readonly transports: {
		readonly unary: "authenticated-http-json";
		readonly events: "authenticated-bounded-long-poll";
	};
	readonly queries: readonly FrontendQueryName[];
	readonly commands: readonly FrontendCommandName[];
	readonly events: readonly FrontendEventName[];
	readonly projections: readonly FrontendProjectionName[];
	readonly eventSemantics: {
		readonly ordering: "cursor-ascending";
		readonly resume: "generation-and-after-cursor";
		readonly gapRecovery: "fresh-bounded-snapshot";
		readonly delivery: "at-least-once-idempotent";
	};
	readonly redaction: {
		readonly credentials: "omitted";
		readonly providerSecrets: "omitted";
		readonly chainOfThought: "omitted";
		readonly internalStorageHandles: "omitted";
		readonly eventPayloads: "projection-invalidation-only";
	};
	readonly limits: {
		readonly maxEnvelopeBytes: number;
		readonly maxPayloadBytes: number;
		readonly maxQueryItems: number;
		readonly maxEvents: number;
		readonly maxEventWaitMs: number;
	};
	readonly capabilityDigest: Sha256Digest;
}

export interface FrontendEventRequest extends ClientProjectServerRequestContext {
	readonly protocolId: typeof FRONTEND_EVENT_PROTOCOL.id;
	readonly protocolVersion: typeof FRONTEND_EVENT_PROTOCOL.version;
	readonly kind: "event_request";
	readonly repositoryIdentity: Sha256Digest;
	readonly generationId: string | null;
	readonly afterCursor: number;
	readonly maxEvents: number;
	readonly waitMs: number;
}

export interface FrontendProjectionInvalidatedEvent {
	readonly protocolId: typeof FRONTEND_EVENT_PROTOCOL.id;
	readonly protocolVersion: typeof FRONTEND_EVENT_PROTOCOL.version;
	readonly kind: "event";
	readonly eventId: `frontend-event:${string}`;
	readonly cursor: number;
	readonly repositoryIdentity: Sha256Digest;
	readonly eventName: FrontendEventName;
	readonly occurredAt: string;
	readonly snapshotDigest: Sha256Digest;
	readonly projections: readonly FrontendProjectionName[];
}

export interface FrontendEventBatch {
	readonly protocolId: typeof FRONTEND_EVENT_PROTOCOL.id;
	readonly protocolVersion: typeof FRONTEND_EVENT_PROTOCOL.version;
	readonly kind: "event_batch";
	readonly repositoryIdentity: Sha256Digest;
	readonly generationId: string;
	readonly latestCursor: number;
	readonly cursor: number;
	readonly resetRequired: boolean;
	readonly events: readonly FrontendProjectionInvalidatedEvent[];
	readonly batchDigest: Sha256Digest;
}

export interface FrontendErrorEnvelope {
	readonly protocolId: typeof FRONTEND_API_PROTOCOL.id;
	readonly protocolVersion: typeof FRONTEND_API_PROTOCOL.version;
	readonly kind: "error";
	readonly code: FrontendErrorCode;
	readonly message: string;
	readonly retryable: boolean;
}

export class FrontendApiError extends Error {
	readonly code: FrontendErrorCode;
	readonly retryable: boolean;

	constructor(code: FrontendErrorCode, message: string, retryable = false) {
		super(message);
		this.name = "FrontendApiError";
		this.code = code;
		this.retryable = retryable;
	}
}

const CAPABILITY_DOCUMENT_WITHOUT_DIGEST = {
	protocol: FRONTEND_CAPABILITY_DOCUMENT_PROTOCOL,
	frontendApi: FRONTEND_API_PROTOCOL,
	clientProjectServerProtocol: CLIENT_PROJECT_SERVER_PROTOCOL,
	authentication: {
		required: true,
		authority: "project-server",
		mechanismIds: ["project-server-session"],
		credentialsInPayload: false,
	},
	transports: {
		unary: "authenticated-http-json",
		events: "authenticated-bounded-long-poll",
	},
	queries: FRONTEND_QUERY_NAMES,
	commands: FRONTEND_COMMAND_NAMES,
	events: FRONTEND_EVENT_NAMES,
	projections: FRONTEND_PROJECTION_NAMES,
	eventSemantics: {
		ordering: "cursor-ascending",
		resume: "generation-and-after-cursor",
		gapRecovery: "fresh-bounded-snapshot",
		delivery: "at-least-once-idempotent",
	},
	redaction: {
		credentials: "omitted",
		providerSecrets: "omitted",
		chainOfThought: "omitted",
		internalStorageHandles: "omitted",
		eventPayloads: "projection-invalidation-only",
	},
	limits: {
		maxEnvelopeBytes: CLIENT_PROJECT_SERVER_PROTOCOL.maxEnvelopeBytes,
		maxPayloadBytes: CLIENT_PROJECT_SERVER_PROTOCOL.maxPayloadBytes,
		maxQueryItems: CLIENT_PROJECT_SERVER_PROTOCOL.maxQueryItems,
		maxEvents: FRONTEND_EVENT_PROTOCOL.maxEvents,
		maxEventWaitMs: FRONTEND_EVENT_PROTOCOL.maxWaitMs,
	},
} as const;

export const FRONTEND_CAPABILITIES = freezeCanonical<FrontendCapabilityDocument>({
	...CAPABILITY_DOCUMENT_WITHOUT_DIGEST,
	capabilityDigest: canonicalJsonDigest(CAPABILITY_DOCUMENT_WITHOUT_DIGEST),
});

const EVENT_REQUEST_FIELDS = [
	"protocolId",
	"protocolVersion",
	"kind",
	"actor",
	"client",
	"delegationRef",
	"repositoryIdentity",
	"generationId",
	"afterCursor",
	"maxEvents",
	"waitMs",
] as const;

export function assertFrontendCapabilityDocument(
	value: unknown,
): FrontendCapabilityDocument {
	const normalized = toCanonicalJsonValue(value);
	if (
		canonicalJsonDigest(withoutDigest(normalized, "capabilityDigest")) !==
			objectValue(normalized).capabilityDigest ||
		JSON.stringify(normalized) !== JSON.stringify(FRONTEND_CAPABILITIES)
	) {
		throw new Error("Frontend capability document is invalid or drifted.");
	}
	return FRONTEND_CAPABILITIES;
}

export function normalizeFrontendEventRequest(value: unknown): FrontendEventRequest {
	const input = exactObject(
		value,
		EVENT_REQUEST_FIELDS,
		"Frontend event request",
		["delegationRef"],
	);
	if (
		input.protocolId !== FRONTEND_EVENT_PROTOCOL.id ||
		input.protocolVersion !== FRONTEND_EVENT_PROTOCOL.version ||
		input.kind !== "event_request"
	) {
		throw new FrontendApiError("invalid_request", "Frontend event protocol is invalid.");
	}
	const context = normalizeClientProjectServerRequestContext(
		requestContextFields({
			actor: input.actor,
			client: input.client,
			...(input.delegationRef === undefined
				? {}
				: {delegationRef: input.delegationRef}),
		}),
	);
	return freezeCanonical<FrontendEventRequest>({
		protocolId: FRONTEND_EVENT_PROTOCOL.id,
		protocolVersion: FRONTEND_EVENT_PROTOCOL.version,
		kind: "event_request",
		...context,
		repositoryIdentity: assertSha256Digest(
			input.repositoryIdentity,
			"frontendEvent.repositoryIdentity",
		),
		generationId:
			input.generationId === null
				? null
				: text(input.generationId, "generationId"),
		afterCursor: integer(input.afterCursor, "afterCursor", 0, Number.MAX_SAFE_INTEGER),
		maxEvents: integer(input.maxEvents, "maxEvents", 1, FRONTEND_EVENT_PROTOCOL.maxEvents),
		waitMs: integer(input.waitMs, "waitMs", 0, FRONTEND_EVENT_PROTOCOL.maxWaitMs),
	});
}

export function createFrontendEventBatch(input: {
	readonly repositoryIdentity: Sha256Digest;
	readonly generationId: string;
	readonly latestCursor: number;
	readonly cursor: number;
	readonly resetRequired: boolean;
	readonly events: readonly FrontendProjectionInvalidatedEvent[];
}): FrontendEventBatch {
	const value = {
		protocolId: FRONTEND_EVENT_PROTOCOL.id,
		protocolVersion: FRONTEND_EVENT_PROTOCOL.version,
		kind: "event_batch",
		repositoryIdentity: assertSha256Digest(
			input.repositoryIdentity,
			"frontendEventBatch.repositoryIdentity",
		),
		generationId: text(input.generationId, "generationId"),
		latestCursor: integer(input.latestCursor, "latestCursor", 0, Number.MAX_SAFE_INTEGER),
		cursor: integer(input.cursor, "cursor", 0, Number.MAX_SAFE_INTEGER),
		resetRequired: booleanValue(input.resetRequired, "resetRequired"),
		events: normalizedEvents(input.events, input.repositoryIdentity),
	} as const;
	if (value.cursor > value.latestCursor) {
		throw new Error("Frontend event cursor exceeds latest cursor.");
	}
	if (value.resetRequired && value.events.length > 0) {
		throw new Error("Frontend reset batch cannot include events.");
	}
	if (value.events.some((event) => event.cursor > value.cursor)) {
		throw new Error("Frontend event exceeds the batch cursor.");
	}
	return freezeCanonical<FrontendEventBatch>({
		...value,
		batchDigest: canonicalJsonDigest(value),
	});
}

export function frontendErrorEnvelope(error: unknown): FrontendErrorEnvelope {
	const known = error instanceof FrontendApiError ? error : undefined;
	return freezeCanonical<FrontendErrorEnvelope>({
		protocolId: FRONTEND_API_PROTOCOL.id,
		protocolVersion: FRONTEND_API_PROTOCOL.version,
		kind: "error",
		code: known?.code || "internal",
		message: known?.message || "Frontend request failed.",
		retryable: known?.retryable || false,
	});
}

export function assertFrontendRequestContext(
	trusted: ClientProjectServerRequestContext,
	supplied: ClientProjectServerRequestContext,
): void {
	const expected = normalizeClientProjectServerRequestContext(
		requestContextFields(trusted),
	);
	const actual = normalizeClientProjectServerRequestContext(
		requestContextFields(supplied),
	);
	if (JSON.stringify(expected) !== JSON.stringify(actual)) {
		throw new FrontendApiError(
			"authorization_denied",
			"Frontend request context does not match authenticated authority.",
		);
	}
	if (actual.client.clientKind !== "app") {
		throw new FrontendApiError(
			"authorization_denied",
			"Frontend API requires an App client binding.",
		);
	}
}

function normalizedEvents(
	values: readonly FrontendProjectionInvalidatedEvent[],
	repositoryIdentity: Sha256Digest,
): readonly FrontendProjectionInvalidatedEvent[] {
	if (!Array.isArray(values) || values.length > FRONTEND_EVENT_PROTOCOL.maxEvents) {
		throw new Error("Frontend event batch exceeds the event limit.");
	}
	let prior = 0;
	return Object.freeze(
		values.map((event) => {
			const normalized = normalizedEvent(event, repositoryIdentity);
			if (normalized.cursor <= prior) {
				throw new Error("Frontend events are not ordered by ascending cursor.");
			}
			prior = normalized.cursor;
			return normalized;
		}),
	);
}

function normalizedEvent(
	value: unknown,
	repositoryIdentity: Sha256Digest,
): FrontendProjectionInvalidatedEvent {
	const input = exactObject(
		value,
		[
			"protocolId",
			"protocolVersion",
			"kind",
			"eventId",
			"cursor",
			"repositoryIdentity",
			"eventName",
			"occurredAt",
			"snapshotDigest",
			"projections",
		],
		"Frontend event",
	);
	if (
		input.protocolId !== FRONTEND_EVENT_PROTOCOL.id ||
		input.protocolVersion !== FRONTEND_EVENT_PROTOCOL.version ||
		input.kind !== "event" ||
		input.eventName !== "codewiki.projection.invalidated" ||
		input.repositoryIdentity !== repositoryIdentity ||
		typeof input.eventId !== "string" ||
		!/^frontend-event:[a-f0-9]{64}$/.test(input.eventId)
	) {
		throw new Error("Frontend event identity or binding is invalid.");
	}
	if (
		!Array.isArray(input.projections) ||
		input.projections.length < 1 ||
		new Set(input.projections).size !== input.projections.length ||
		input.projections.some(
			(projection) =>
				typeof projection !== "string" ||
				!FRONTEND_PROJECTION_NAMES.includes(projection as FrontendProjectionName),
		)
	) {
		throw new Error("Frontend event projections are invalid.");
	}
	return freezeCanonical<FrontendProjectionInvalidatedEvent>({
		protocolId: FRONTEND_EVENT_PROTOCOL.id,
		protocolVersion: FRONTEND_EVENT_PROTOCOL.version,
		kind: "event",
		eventId: input.eventId,
		cursor: integer(input.cursor, "event.cursor", 1, Number.MAX_SAFE_INTEGER),
		repositoryIdentity,
		eventName: "codewiki.projection.invalidated",
		occurredAt: timestamp(input.occurredAt, "event.occurredAt"),
		snapshotDigest: assertSha256Digest(
			input.snapshotDigest,
			"frontendEvent.snapshotDigest",
		),
		projections: input.projections as FrontendProjectionName[],
	});
}

function exactObject(
	value: unknown,
	fields: readonly string[],
	label: string,
	optionalFields: readonly string[] = [],
): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new FrontendApiError("invalid_request", `${label} must be an object.`);
	}
	const input = value as Record<string, unknown>;
	const allowed = new Set(fields);
	const optional = new Set(optionalFields);
	const actual = Object.keys(input);
	if (
		actual.some((field) => !allowed.has(field)) ||
		fields.some((field) => !optional.has(field) && !(field in input))
	) {
		throw new FrontendApiError("invalid_request", `${label} fields are invalid.`);
	}
	return input;
}

function requestContextFields(value: {
	readonly actor: unknown;
	readonly client: unknown;
	readonly delegationRef?: unknown;
}): Record<string, unknown> {
	return {
		actor: value.actor,
		client: value.client,
		...(value.delegationRef === undefined
			? {}
			: {delegationRef: value.delegationRef}),
	};
}

function withoutDigest(value: CanonicalJsonValue, field: string): CanonicalJsonValue {
	const input = objectValue(value);
	return Object.fromEntries(Object.entries(input).filter(([key]) => key !== field));
}

function objectValue(value: CanonicalJsonValue): Readonly<Record<string, CanonicalJsonValue>> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Frontend protocol value must be an object.");
	}
	return value as Readonly<Record<string, CanonicalJsonValue>>;
}

function text(value: unknown, field: string): string {
	if (typeof value !== "string" || !value.trim() || value.length > 512) {
		throw new FrontendApiError("invalid_request", `Frontend ${field} is invalid.`);
	}
	return value;
}

function timestamp(value: unknown, field: string): string {
	if (typeof value !== "string") {
		throw new FrontendApiError("invalid_request", `Frontend ${field} is invalid.`);
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
		throw new FrontendApiError("invalid_request", `Frontend ${field} is invalid.`);
	}
	return value;
}

function booleanValue(value: unknown, field: string): boolean {
	if (value !== true && value !== false) {
		throw new FrontendApiError("invalid_request", `Frontend ${field} is invalid.`);
	}
	return value;
}

function integer(
	value: unknown,
	field: string,
	minimum: number,
	maximum: number,
): number {
	if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
		throw new FrontendApiError("invalid_request", `Frontend ${field} is invalid.`);
	}
	return value as number;
}

function freezeCanonical<T>(value: unknown): Readonly<T> {
	return deepFreeze(toCanonicalJsonValue(value)) as Readonly<T>;
}

function deepFreeze<T>(value: T): T {
	if (value && typeof value === "object" && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}
