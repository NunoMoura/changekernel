import assert from "node:assert/strict";
import test from "node:test";

import {
	CLIENT_PROJECT_SERVER_PROTOCOL,
	normalizeClientProjectServerOperation,
	normalizeClientProjectServerQueryResult,
} from "../../src/protocol/client-project-server.ts";
import {
	CODEWIKI_MCP_OPERATIONS,
	createCodewikiMcpBinding,
} from "../../src/project-server/mcp/binding.ts";

const digest = (character) => `sha256:${character.repeat(64)}`;
const actor = {actorId: "user:nuno", authenticatedIdentityRef: "identity:local:nuno"};
const client = {
	clientKind: "mcp",
	clientInstanceId: "external-agent:laptop",
	authenticationRef: "auth:pairing:external-agent",
};

function query(operation = CODEWIKI_MCP_OPERATIONS.materialQuery) {
	return {
		protocolId: CLIENT_PROJECT_SERVER_PROTOCOL.id,
		protocolVersion: CLIENT_PROJECT_SERVER_PROTOCOL.version,
		kind: "query",
		transportRequestId: "query:01",
		actor,
		client,
		delegationRef: "delegation:bounded-material",
		repositoryIdentity: digest("1"),
		queryName: operation,
		expectedSnapshotDigest: digest("2"),
		maxItems: 8,
		payload: {refs: ["knowledge:cw:component:runtime"]},
	};
}

function command(operation = CODEWIKI_MCP_OPERATIONS.candidateSubmit) {
	return {
		protocolId: CLIENT_PROJECT_SERVER_PROTOCOL.id,
		protocolVersion: CLIENT_PROJECT_SERVER_PROTOCOL.version,
		kind: "command",
		transportRequestId: "command:01",
		actor,
		client,
		delegationRef: "delegation:candidate",
		repositoryIdentity: digest("1"),
		commandName: operation,
		targetRef: "change:current",
		expectedDigest: digest("2"),
		semanticIdempotencyKey: "candidate:01",
		expiresAt: "2099-08-12T11:00:00.000Z",
		requestedCapability: "candidate:submit",
		payload: {candidateDigest: digest("3")},
	};
}

test("reserved MCP queries preserve bounded Project Server protocol custody", async () => {
	const calls = [];
	const binding = createCodewikiMcpBinding({
		async query(operation, envelope) {
			calls.push({operation, envelope});
			return normalizeClientProjectServerQueryResult({
				protocolId: CLIENT_PROJECT_SERVER_PROTOCOL.id,
				protocolVersion: CLIENT_PROJECT_SERVER_PROTOCOL.version,
				kind: "query_result",
				transportRequestId: envelope.transportRequestId,
				repositoryIdentity: envelope.repositoryIdentity,
				queryName: envelope.queryName,
				snapshot: {
					snapshotDigest: digest("2"),
					provenanceRefs: ["project-context:current"],
					coverage: "complete",
					truncated: false,
					stale: false,
					redacted: true,
				},
				payload: {items: []},
			});
		},
		async command() { throw new Error("unexpected command"); },
	});
	const result = await binding.invoke({
		operation: CODEWIKI_MCP_OPERATIONS.materialQuery,
		envelope: query(),
	});
	assert.equal(result.kind, "query_result");
	assert.equal(result.envelope.snapshot.redacted, true);
	assert.equal(calls[0].operation, CODEWIKI_MCP_OPERATIONS.materialQuery);
});

test("reserved MCP submissions remain ordinary expected-state Project Server commands", async () => {
	const binding = createCodewikiMcpBinding({
		async query() { throw new Error("unexpected query"); },
		async command(operation, envelope) {
			assert.equal(operation, CODEWIKI_MCP_OPERATIONS.candidateSubmit);
			assert.equal(envelope.expectedDigest, digest("2"));
			return normalizeClientProjectServerOperation({
				protocolId: CLIENT_PROJECT_SERVER_PROTOCOL.id,
				protocolVersion: CLIENT_PROJECT_SERVER_PROTOCOL.version,
				kind: "operation",
				operationId: "operation:01",
				repositoryIdentity: envelope.repositoryIdentity,
				actorId: envelope.actor.actorId,
				commandName: envelope.commandName,
				semanticIdempotencyDigest: digest("4"),
				status: "accepted",
				acceptedAt: "2026-08-12T10:00:00.000Z",
				updatedAt: "2026-08-12T10:00:00.000Z",
				snapshotDigest: digest("5"),
				payload: {},
			});
		},
	});
	const result = await binding.invoke({
		operation: CODEWIKI_MCP_OPERATIONS.candidateSubmit,
		envelope: command(),
	});
	assert.equal(result.kind, "operation");
	assert.equal(result.envelope.status, "accepted");
});

test("MCP binding rejects namespace drift, envelope mismatch, and non-MCP clients", async () => {
	const binding = createCodewikiMcpBinding({
		async query() { throw new Error("not reached"); },
		async command() { throw new Error("not reached"); },
	});
	await assert.rejects(
		binding.invoke({operation: "vendor.material.query", envelope: query()}),
		/reserved codewiki namespace/,
	);
	await assert.rejects(
		binding.invoke({operation: CODEWIKI_MCP_OPERATIONS.reviewRead, envelope: query()}),
		/does not match/,
	);
	const {delegationRef: _delegationRef, ...withoutDelegation} = query();
	await assert.rejects(
		binding.invoke({
			operation: CODEWIKI_MCP_OPERATIONS.materialQuery,
			envelope: {...withoutDelegation, client: {...client, clientKind: "app"}},
		}),
		/MCP Client context/,
	);
});
