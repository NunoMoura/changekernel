import assert from "node:assert/strict";
import test from "node:test";
import {
	assertFrontendCapabilityDocument,
	createFrontendEventBatch,
	FRONTEND_API_PROTOCOL,
	FRONTEND_CAPABILITIES,
	FRONTEND_EVENT_PROTOCOL,
	frontendErrorEnvelope,
	normalizeFrontendEventRequest,
} from "../../src/protocol/frontend.ts";

const digest = (character) => `sha256:${character.repeat(64)}`;

const context = {
	actor: {
		actorId: "actor:user:1",
		authenticatedIdentityRef: "identity:user:1",
	},
	client: {
		clientKind: "app",
		clientInstanceId: "app:browser:1",
		authenticationRef: "auth:session:1",
	},
};

test("frontend capability document freezes authenticated bounded API semantics", () => {
	assert.equal(FRONTEND_CAPABILITIES.frontendApi.version, "1.0.0");
	assert.equal(FRONTEND_CAPABILITIES.authentication.required, true);
	assert.equal(FRONTEND_CAPABILITIES.authentication.authority, "project-server");
	assert.equal(FRONTEND_CAPABILITIES.redaction.providerSecrets, "omitted");
	assert.equal(FRONTEND_CAPABILITIES.redaction.chainOfThought, "omitted");
	assert.equal(FRONTEND_CAPABILITIES.eventSemantics.resume, "generation-and-after-cursor");
	assert.equal(Object.isFrozen(FRONTEND_CAPABILITIES.queries), true);
	assert.equal(
		assertFrontendCapabilityDocument(FRONTEND_CAPABILITIES),
		FRONTEND_CAPABILITIES,
	);
	assert.throws(
		() =>
			assertFrontendCapabilityDocument({
				...FRONTEND_CAPABILITIES,
				queries: [...FRONTEND_CAPABILITIES.queries, "codewiki.raw-storage.read"],
			}),
		/invalid or drifted/,
	);
});

test("frontend event protocol binds authenticated context and exact bounds", () => {
	const request = normalizeFrontendEventRequest({
		protocolId: FRONTEND_EVENT_PROTOCOL.id,
		protocolVersion: FRONTEND_EVENT_PROTOCOL.version,
		kind: "event_request",
		...context,
		repositoryIdentity: digest("a"),
		generationId: null,
		afterCursor: 0,
		maxEvents: 32,
		waitMs: 5_000,
	});
	assert.equal(request.client.clientKind, "app");
	assert.equal(Object.isFrozen(request.actor), true);
	assert.throws(
		() => normalizeFrontendEventRequest({...request, maxEvents: 129}),
		/maxEvents is invalid/,
	);
	assert.throws(
		() => normalizeFrontendEventRequest({...request, credential: "secret"}),
		/fields are invalid/,
	);
});

test("frontend event batches enforce deterministic ordering and digest", () => {
	const event = (cursor) => ({
		protocolId: FRONTEND_EVENT_PROTOCOL.id,
		protocolVersion: FRONTEND_EVENT_PROTOCOL.version,
		kind: "event",
		eventId: `frontend-event:${String(cursor).padStart(64, "0")}`,
		cursor,
		repositoryIdentity: digest("a"),
		eventName: "codewiki.projection.invalidated",
		occurredAt: `2026-08-24T00:00:0${cursor}.000Z`,
		snapshotDigest: digest(String(cursor)),
		projections: ["app-state"],
	});
	const batch = createFrontendEventBatch({
		repositoryIdentity: digest("a"),
		generationId: "generation:1",
		latestCursor: 2,
		cursor: 2,
		resetRequired: false,
		events: [event(1), event(2)],
	});
	assert.match(batch.batchDigest, /^sha256:[a-f0-9]{64}$/);
	assert.equal(Object.isFrozen(batch.events), true);
	assert.throws(
		() => createFrontendEventBatch({...batch, events: [event(2), event(1)]}),
		/not ordered/,
	);
});

test("frontend errors expose fixed taxonomy and redact unknown failures", () => {
	assert.deepEqual({...frontendErrorEnvelope(new Error("token=secret"))}, {
		protocolId: FRONTEND_API_PROTOCOL.id,
		protocolVersion: FRONTEND_API_PROTOCOL.version,
		kind: "error",
		code: "internal",
		message: "Frontend request failed.",
		retryable: false,
	});
});
