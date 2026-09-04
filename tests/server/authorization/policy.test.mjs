import assert from "node:assert/strict";
import test from "node:test";
import {createProductTransportRequest} from "../../../src/api/transport/envelope.ts";
import {
	PROJECT_ACCESS_POLICY_PROTOCOL,
	createProjectAccessPolicy,
	decodeProjectAccessGrants,
	projectAccessProofDigest,
} from "../../../src/server/authorization/policy.ts";

const PROOF = "one bounded secret proof";
const PROOF_DIGEST = projectAccessProofDigest(PROOF).value;

function grants(overrides = {}) {
	return [{
		authorizationId: "cw:authorization:reader",
		identityRef: "cw:identity:ada",
		actorId: "cw:actor:ada",
		proofDigest: PROOF_DIGEST,
		expiresAt: "2026-09-06T00:00:00Z",
		capabilities: ["audit.read", "project.discover", "wiki.read"],
		wikiItemIds: ["cw:item:visible"],
		changeIds: ["CHG-visible"],
		...overrides,
	}];
}

function request(overrides = {}) {
	return createProductTransportRequest({
		requestId: "cw:request:one",
		repositoryId: "cw:repository:test",
		client: {kind: "cli", instanceId: "cw:client:one"},
		authentication: {identityRef: "cw:identity:ada", proof: PROOF},
		expiresAt: "2026-09-05T12:00:00Z",
		operation: "wiki.read",
		input: {source: {kind: "canonical"}, view: "list", limit: 10, cursor: null},
		...overrides,
	}).value;
}

test("access policy maps proof-backed identity to an Actor independently of Client kind", () => {
	const policy = createProjectAccessPolicy({grants: grants(), now: () => "2026-09-05T00:00:00Z"});
	assert.equal(policy.ok, true);
	assert.equal(policy.value.protocol, PROJECT_ACCESS_POLICY_PROTOCOL);
	const cli = policy.value.authorize(request());
	const agent = policy.value.authorize(request({client: {kind: "agent", instanceId: "cw:client:two"}}));
	assert.equal(cli.ok, true);
	assert.equal(agent.ok, true);
	assert.equal(cli.value.actorId, "cw:actor:ada");
	assert.equal(agent.value.actorId, cli.value.actorId);
	assert.deepEqual(cli.value.wikiItemIds, ["cw:item:visible"]);
	assert.deepEqual(Object.keys(policy.value).sort(), ["authorize", "protocol"]);
	assert.equal(JSON.stringify(policy.value).includes(PROOF), false);
	assert.equal(JSON.stringify(cli.value).includes(PROOF), false);
});

test("access policy fails closed for wrong proof, expiration, and missing capability", () => {
	const policy = createProjectAccessPolicy({grants: grants(), now: () => "2026-09-05T00:00:00Z"}).value;
	const wrongProof = request({authentication: {identityRef: "cw:identity:ada", proof: "wrong"}});
	assert.equal(policy.authorize(wrongProof).error.code, "authentication_required");
	const wrongIdentity = request({authentication: {identityRef: "cw:identity:other", proof: PROOF}});
	assert.equal(policy.authorize(wrongIdentity).error.code, "authentication_required");
	const expiredRequest = request({expiresAt: "2026-09-04T00:00:00Z"});
	assert.equal(policy.authorize(expiredRequest).error.code, "expired_request");
	const denied = request({operation: "work.read", input: {source: {kind: "canonical"}, changeId: null, limit: 10, cursor: null}});
	assert.equal(policy.authorize(denied).error.code, "authorization_denied");

	const expiredGrant = createProjectAccessPolicy({grants: grants({expiresAt: "2026-09-04T00:00:00Z"}), now: () => "2026-09-05T00:00:00Z"}).value;
	assert.equal(expiredGrant.authorize(request()).error.code, "expired_request");
});

test("access grants reject duplicates, unsorted visibility, unsupported capabilities, and unsafe proofs", () => {
	assert.equal(decodeProjectAccessGrants([...grants(), ...grants()]).ok, false);
	assert.equal(decodeProjectAccessGrants(grants({wikiItemIds: ["cw:item:z", "cw:item:a"]})).ok, false);
	assert.equal(decodeProjectAccessGrants(grants({wikiItemIds: ["cw:item:\u001b"]})).ok, false);
	assert.equal(decodeProjectAccessGrants(grants({capabilities: ["unknown.read"]})).ok, false);
	assert.equal(decodeProjectAccessGrants([]).ok, false);
	assert.equal(projectAccessProofDigest("").ok, false);
	assert.equal(projectAccessProofDigest("x".repeat(15)).ok, false);
	assert.equal(projectAccessProofDigest("x".repeat(4097)).ok, false);
	assert.equal(createProjectAccessPolicy({grants: grants()}).ok, false);
	assert.equal(createProjectAccessPolicy({grants: grants(), now: () => "2026-09-05T00:00:00Z", unexpected: true}).ok, false);
	assert.equal(createProjectAccessPolicy({grants: grants(), now: () => "not-a-time"}).value.authorize(request()).error.code, "internal_failure");
});
