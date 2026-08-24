import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {startCodewikiAppServer} from "../../../src/project-server/app/server.ts";
import {CLIENT_PROJECT_SERVER_PROTOCOL} from "../../../src/protocol/client-project-server.ts";
import {FRONTEND_EVENT_PROTOCOL} from "../../../src/protocol/frontend.ts";

const digest = (character) => `sha256:${character.repeat(64)}`;
const repositoryIdentity = digest("1");
const actor = {
	actorId: "actor:frontend-user",
	authenticatedIdentityRef: "identity:frontend-user",
};
const client = {
	clientKind: "app",
	clientInstanceId: "app:frontend-browser",
	authenticationRef: "auth:frontend-session",
};

function queryEnvelope() {
	return {
		protocolId: CLIENT_PROJECT_SERVER_PROTOCOL.id,
		protocolVersion: CLIENT_PROJECT_SERVER_PROTOCOL.version,
		kind: "query",
		transportRequestId: "request:frontend-query",
		actor,
		client,
		repositoryIdentity,
		queryName: "codewiki.changes.read",
		maxItems: 1,
		payload: {},
	};
}

function eventRequest() {
	return {
		protocolId: FRONTEND_EVENT_PROTOCOL.id,
		protocolVersion: FRONTEND_EVENT_PROTOCOL.version,
		kind: "event_request",
		actor,
		client,
		repositoryIdentity,
		generationId: "generation:frontend",
		afterCursor: 0,
		maxEvents: 8,
		waitMs: 0,
	};
}

function projectServer() {
	return {
		queries: {
			state: async () => ({}),
			appState: async () => ({pipelineQueue: []}),
			changes: async () => ({
				generatedAt: "2026-08-24T00:00:00.000Z",
				available: true,
				blockers: [],
				head: null,
				stateDigest: digest("2"),
				records: [{changeId: "chg:1"}, {changeId: "chg:2"}],
				summary: {total: 2},
				truncated: false,
			}),
			configuration: async () => ({
				stateDigest: digest("3"),
				previewProfiles: [],
				uiPreviewTargets: [],
			}),
			inspect: async () => ({}),
			decisionAttention: async () => ({}),
		},
		commands: {
			selectDecision: async () => ({attemptOperationId: "op:decision:frontend"}),
			submitCandidate: async () => ({}),
		},
		events: {
			read: async () => ({
				schemaVersion: "1.0.0",
				generationId: "generation:frontend",
				latestCursor: 1,
				cursor: 1,
				resetRequired: false,
				events: [{
					cursor: 1,
					generationId: "generation:frontend",
					state: "changed",
					observedAt: "2026-08-24T00:00:01.000Z",
					message: "must not cross frontend boundary",
					workStateDigest: digest("4"),
				}],
			}),
		},
		connection: {heartbeat: async () => {}, disconnect: async () => {}},
	};
}

test("App Server serves authenticated frozen frontend API with resumable redacted events", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-frontend-api-"));
	let app;
	try {
		app = await startCodewikiAppServer({
			repoRoot: root,
			open: false,
			keepAlive: false,
			inProcess: true,
			persistent: false,
			connectProjectServer: true,
			projectServerConnector: async () => projectServer(),
			sessionBinding: {
				actor,
				client,
				project: {
					projectId: "project:frontend",
					repositoryIdentity,
					projectServerRouteRef: "project-server:frontend",
				},
			},
		});
		const origin = new URL(app.url).origin;
		const authorization = `Bearer ${app.sessionCredential}`;
		const unauthorized = await fetch(`${origin}/api/v1/capabilities`);
		assert.equal(unauthorized.status, 403);
		assert.equal((await unauthorized.json()).code, "authorization_denied");

		const capabilitiesResponse = await fetch(`${origin}/api/v1/capabilities`, {
			headers: {authorization},
		});
		assert.equal(capabilitiesResponse.status, 200);
		const capabilities = await capabilitiesResponse.json();
		assert.equal(capabilities.frontendApi.version, "1.0.0");
		assert.deepEqual(capabilities.commands, ["codewiki.decision.select"]);

		const queryResponse = await fetch(`${origin}/api/v1/query`, {
			method: "POST",
			headers: {authorization, origin, "content-type": "application/json"},
			body: JSON.stringify(queryEnvelope()),
		});
		assert.equal(queryResponse.status, 200);
		const query = await queryResponse.json();
		assert.equal(query.payload.records.length, 1);
		assert.equal(query.snapshot.coverage, "partial");

		const eventResponse = await fetch(`${origin}/api/v1/events`, {
			method: "POST",
			headers: {authorization, origin, "content-type": "application/json"},
			body: JSON.stringify(eventRequest()),
		});
		assert.equal(eventResponse.status, 200);
		const events = await eventResponse.json();
		assert.equal(events.events.length, 1);
		assert.equal("message" in events.events[0], false);

		const forbidden = await fetch(`${origin}/api/v1/raw-storage`, {
			headers: {authorization},
		});
		assert.equal(forbidden.status, 404);
		assert.equal((await forbidden.json()).code, "unsupported_capability");
	} finally {
		if (app) await app.close();
		await rm(root, {recursive: true, force: true});
	}
});
