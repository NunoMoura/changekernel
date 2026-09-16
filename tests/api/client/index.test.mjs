import assert from "node:assert/strict";
import test from "node:test";
import {createChangeKernelClient} from "../../../src/api/client/index.ts";
import {createProductTransportResponse} from "../../../src/api/transport/envelope.ts";

const OPTIONS = {requestId: "cw:request:one", expiresAt: "2026-09-05T00:00:00Z"};

function clientWith(send) {
	return createChangeKernelClient({
		repositoryId: "cw:repository:test",
		transport: {send},
		client: {kind: "sdk", instanceId: "cw:client:test"},
		authentication: {identityRef: "cw:identity:test", proof: "proof"},
	});
}

test("Client SDK sends versioned envelopes but returns only semantic Product data", async () => {
	let observed;
	const client = clientWith(async (request) => {
		observed = request;
		return createProductTransportResponse(request, {ok: true, value: {
			project: "Test Project",
			status: "available",
			nextAction: "Choose Project status.",
		}}).value;
	});
	assert.equal(client.ok, true);
	const result = await client.value.discover(OPTIONS);
	assert.equal(result.ok, true);
	assert.deepEqual({...result.value}, {
		nextAction: "Choose Project status.",
		project: "Test Project",
		status: "available",
	});
	assert.equal("protocol" in result.value, false);
	assert.equal("responseDigest" in result.value, false);
	assert.equal(observed.protocol.id, "codewiki.product-request");
	assert.equal(observed.repositoryId, "cw:repository:test");
	assert.equal(observed.operation, "project.discover");
	assert.equal(observed.authentication.proof, "proof");
	assert.deepEqual(Object.keys(client.value).sort(), [
		"admitPlanning", "admitWork", "alignment", "audit", "capabilities", "changes", "checks", "commitDecision",
		"completeChange", "deferDecision", "discover", "evaluateDecision", "evaluatePlanning", "evaluateReview",
		"evaluateWork", "integrateWork", "proposeChanges", "reconcileReview", "rejectDecision", "requestProtectedEffect",
		"resumeDecision", "review", "reviseChange", "status", "supersedeChange", "wiki", "withdrawDecision", "work",
	]);
});

test("Client SDK rejects thrown, malformed, mismatched, and forged responses", async () => {
	const thrown = clientWith(async () => { throw new Error("offline"); }).value;
	assert.equal((await thrown.discover(OPTIONS)).error.code, "transport_unavailable");

	const malformed = clientWith(async () => ({status: "ok", data: {secret: true}})).value;
	assert.equal((await malformed.discover(OPTIONS)).error.code, "transport_unavailable");

	const mismatched = clientWith(async (request) => createProductTransportResponse(
		{...request, requestId: "cw:request:other"},
		{ok: true, value: {status: "available"}},
	).value).value;
	assert.equal((await mismatched.discover(OPTIONS)).error.code, "transport_unavailable");

	const substituted = clientWith(async (request) => createProductTransportResponse(
		{...request, requestDigest: `sha256:${"0".repeat(64)}`},
		{ok: true, value: {status: "available"}},
	).value).value;
	assert.equal((await substituted.discover(OPTIONS)).error.code, "transport_unavailable");

	const forged = clientWith(async (request) => {
		const response = createProductTransportResponse(request, {ok: true, value: {status: "available"}}).value;
		return {...response, data: {status: "forged"}};
	}).value;
	assert.equal((await forged.discover(OPTIONS)).error.code, "transport_unavailable");
});

test("Client SDK fails closed before transport for malformed identity and request", async () => {
	assert.equal(createChangeKernelClient({repositoryId: "cw:repository:test", transport: {send: async () => null}, client: {kind: "cli", instanceId: "plain"}, authentication: {identityRef: "cw:identity:test", proof: "proof"}}).ok, false);
	let called = false;
	const client = clientWith(async () => { called = true; return null; }).value;
	const result = await client.wiki({
		...OPTIONS,
		requestId: "plain",
		source: {kind: "canonical"},
		view: "list",
		limit: 10,
		cursor: null,
	});
	assert.equal(result.error.code, "invalid_request");
	const malformedRead = await client.wiki({
		...OPTIONS,
		requestId: "cw:request:malformed-read",
		source: {kind: "canonical"},
		view: "unknown",
		limit: 10,
		cursor: null,
	});
	assert.equal(malformedRead.error.code, "invalid_request");
	assert.equal(called, false);
});
