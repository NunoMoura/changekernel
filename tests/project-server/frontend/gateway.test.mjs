import assert from "node:assert/strict";
import test from "node:test";
import {
	FRONTEND_EVENT_PROTOCOL,
	FrontendApiError,
} from "../../../src/protocol/frontend.ts";
import {CLIENT_PROJECT_SERVER_PROTOCOL} from "../../../src/protocol/client-project-server.ts";
import {createFrontendProjectServerGateway} from "../../../src/project-server/frontend/gateway.ts";

const digest = (character) => `sha256:${character.repeat(64)}`;
const repositoryIdentity = digest("1");
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

function query(queryName, overrides = {}) {
	return {
		protocolId: CLIENT_PROJECT_SERVER_PROTOCOL.id,
		protocolVersion: CLIENT_PROJECT_SERVER_PROTOCOL.version,
		kind: "query",
		transportRequestId: "request:query:1",
		...context,
		repositoryIdentity,
		queryName,
		maxItems: 2,
		payload: {},
		...overrides,
	};
}

function command(overrides = {}) {
	return {
		protocolId: CLIENT_PROJECT_SERVER_PROTOCOL.id,
		protocolVersion: CLIENT_PROJECT_SERVER_PROTOCOL.version,
		kind: "command",
		transportRequestId: "request:command:1",
		...context,
		repositoryIdentity,
		commandName: "codewiki.decision.select",
		targetRef: "chg:1",
		expectedDigest: digest("2"),
		semanticIdempotencyKey: "frontend-decision:1",
		expiresAt: "2026-08-24T01:00:00.000Z",
		requestedCapability: "codewiki.decision.select",
		payload: {changeId: "chg:1", changeRevisionId: digest("3")},
		...overrides,
	};
}

function eventRequest(overrides = {}) {
	return {
		protocolId: FRONTEND_EVENT_PROTOCOL.id,
		protocolVersion: FRONTEND_EVENT_PROTOCOL.version,
		kind: "event_request",
		...context,
		repositoryIdentity,
		generationId: "generation:1",
		afterCursor: 0,
		maxEvents: 16,
		waitMs: 0,
		...overrides,
	};
}

function projectServer() {
	return {
		queries: {
			state: async () => ({}),
			appState: async () => ({
				projectRoot: "/project",
				projectName: "project",
				summary: {},
				next: {},
				pipelineQueue: [{id: "trace:1"}, {id: "trace:2"}, {id: "trace:3"}],
			}),
			changes: async () => ({
				generatedAt: "2026-08-24T00:00:00.000Z",
				available: true,
				blockers: [],
				head: null,
				stateDigest: digest("4"),
				records: [{id: 1}, {id: 2}, {id: 3}],
				summary: {total: 3},
				truncated: false,
			}),
			configuration: async () => ({
				generatedAt: "2026-08-24T00:00:00.000Z",
				sourcePath: ".codewiki/config.json",
				validation: "valid",
				configDigest: digest("5"),
				activeConfigDigest: digest("5"),
				stateDigest: digest("6"),
				restartRequired: false,
				restartReasons: [],
				restartGuidance: "none",
				previewProfiles: [],
				uiPreviewTargets: [],
				effective: {},
				limits: {},
			}),
			inspect: async () => ({}),
			decisionAttention: async () => {
				throw new Error("not used");
			},
		},
		commands: {
			selectDecision: async () => ({
				attemptOperationId: "op:decision:1",
			}),
			submitCandidate: async () => ({}),
		},
		events: {
			read: async () => ({
				schemaVersion: "1.0.0",
				generationId: "generation:1",
				latestCursor: 1,
				cursor: 1,
				resetRequired: false,
				events: [
					{
						cursor: 1,
						generationId: "generation:1",
						state: "changed",
						observedAt: "2026-08-24T00:00:01.000Z",
						clientId: "private-client",
						idempotencyKey: "private-key",
						message: "private message",
						workStateDigest: digest("7"),
					},
				],
			}),
		},
		connection: {heartbeat: async () => {}, disconnect: async () => {}},
	};
}

test("frontend gateway exposes only frozen capabilities to App clients", () => {
	const gateway = createFrontendProjectServerGateway({
		repositoryIdentity,
		projectServer: projectServer(),
	});
	assert.deepEqual(gateway.capabilities(context).commands, ["codewiki.decision.select"]);
	assert.throws(
		() => gateway.capabilities({...context, client: {...context.client, clientKind: "cli"}}),
		/App client binding/,
	);
});

test("frontend gateway returns bounded canonical projections and rejects stale snapshots", async () => {
	const gateway = createFrontendProjectServerGateway({
		repositoryIdentity,
		projectServer: projectServer(),
	});
	const result = await gateway.query(context, query("codewiki.app-state.read"));
	assert.equal(result.payload.pipelineQueue.length, 2);
	assert.equal(result.snapshot.coverage, "partial");
	assert.equal(result.snapshot.redacted, true);
	await assert.rejects(
		() =>
			gateway.query(
				context,
				query("codewiki.changes.read", {expectedSnapshotDigest: digest("8")}),
			),
		(error) => error instanceof FrontendApiError && error.code === "stale_snapshot",
	);
	await assert.rejects(
		() => gateway.query(context, query("codewiki.raw-storage.read")),
		/unsupported/,
	);
});

test("frontend gateway binds authenticated command authority and idempotency", async () => {
	const gateway = createFrontendProjectServerGateway({
		repositoryIdentity,
		projectServer: projectServer(),
		now: () => "2026-08-24T00:00:00.000Z",
	});
	const receipt = await gateway.command(context, command());
	assert.equal(receipt.operationId, "op:decision:1");
	assert.equal(receipt.actorId, context.actor.actorId);
	assert.equal(receipt.status, "accepted");
	assert.match(receipt.semanticIdempotencyDigest, /^sha256:[a-f0-9]{64}$/);
	await assert.rejects(
		() =>
			gateway.command(
				context,
				command({repositoryIdentity: digest("9")}),
			),
		/does not match authenticated project/,
	);
});

test("frontend gateway projects resumable redacted invalidation events", async () => {
	const gateway = createFrontendProjectServerGateway({
		repositoryIdentity,
		projectServer: projectServer(),
	});
	const batch = await gateway.events(context, eventRequest());
	assert.equal(batch.resetRequired, false);
	assert.equal(batch.events.length, 1);
	assert.equal(batch.events[0].snapshotDigest, digest("7"));
	assert.equal("message" in batch.events[0], false);
	assert.equal("clientId" in batch.events[0], false);
	assert.equal("idempotencyKey" in batch.events[0], false);
	const reset = await gateway.events(
		context,
		eventRequest({generationId: "generation:old"}),
	);
	assert.equal(reset.resetRequired, true);
	assert.equal(reset.events.length, 0);
	assert.equal(reset.cursor, reset.latestCursor);
});
