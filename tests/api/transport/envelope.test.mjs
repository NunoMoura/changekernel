import assert from "node:assert/strict";
import test from "node:test";
import {
	PRODUCT_TRANSPORT_REQUEST_PROTOCOL,
	PRODUCT_TRANSPORT_RESPONSE_PROTOCOL,
	createProductTransportRequest,
	createProductTransportResponse,
	decodeProductTransportRequest,
	decodeProductTransportResponse,
	isCanonicalRequestTimestamp,
	productError,
} from "../../../src/api/transport/envelope.ts";

function request(overrides = {}) {
	return createProductTransportRequest({
		requestId: "cw:request:one",
		repositoryId: "cw:repository:test",
		client: {kind: "cli", instanceId: "cw:client:one"},
		authentication: {identityRef: "cw:identity:ada", proof: "correct horse battery staple"},
		expiresAt: "2026-09-05T00:00:00Z",
		operation: "project.status",
		input: {source: {kind: "canonical"}},
		...overrides,
	});
}

test("transport request envelope is canonical, digest-bound, and deterministic", () => {
	const first = request();
	const second = request();
	assert.equal(first.ok, true);
	assert.deepEqual(first, second);
	assert.equal(first.value.protocol, PRODUCT_TRANSPORT_REQUEST_PROTOCOL);
	assert.equal(decodeProductTransportRequest(first.value).ok, true);
	assert.equal(Object.isFrozen(first.value), true);

	const tampered = {...first.value, input: {source: {kind: "change", changeId: "CHG-other"}}};
	assert.equal(decodeProductTransportRequest(tampered).ok, false);
	assert.equal(decodeProductTransportRequest({...first.value, unexpected: true}).ok, false);
	assert.equal(request({operation: "unknown.read"}).ok, false);
	assert.equal(request({requestId: "plain"}).ok, false);
	assert.equal(request({expiresAt: "2026-02-30T00:00:00Z"}).ok, false);
});

test("transport response envelope binds success or stable plain-language failure", () => {
	const source = request().value;
	const passed = createProductTransportResponse(
		source,
		{ok: true, value: {status: "ready", nextAction: "Choose Work."}},
		{repositoryId: "cw:repository:test", source: {commit: {algorithm: "sha1", hex: "1".repeat(40)}}},
	);
	assert.equal(passed.ok, true);
	assert.equal(passed.value.protocol, PRODUCT_TRANSPORT_RESPONSE_PROTOCOL);
	assert.equal(passed.value.requestDigest, source.requestDigest);
	assert.equal(decodeProductTransportResponse(passed.value).ok, true);
	assert.equal(passed.value.binding.repositoryId, "cw:repository:test");
	assert.equal(decodeProductTransportResponse({...passed.value, data: {status: "changed"}}).ok, false);
	assert.equal(decodeProductTransportResponse({...passed.value, binding: {repositoryId: "cw:repository:forged"}}).ok, false);
	assert.equal(decodeProductTransportResponse({...passed.value, requestDigest: `sha256:${"0".repeat(64)}`}).ok, false);

	const error = productError("authorization_denied", "This Actor cannot read that.", "Choose an allowed read.", true);
	const denied = createProductTransportResponse(source, {ok: false, error});
	assert.equal(denied.ok, true);
	assert.deepEqual(denied.value.error, error);
	assert.equal(decodeProductTransportResponse({...denied.value, data: {leak: true}}).ok, false);
	assert.equal(JSON.stringify(denied.value).includes(source.authentication.proof), false);
});

test("request timestamps reject normalized-but-impossible dates", () => {
	assert.equal(isCanonicalRequestTimestamp("2026-09-05T00:00:00Z"), true);
	for (const value of ["2026-02-30T00:00:00Z", "2026-09-05T00:00:00+00:00", "2026-09-05T00:00:00.000Z", "not-a-time"]) {
		assert.equal(isCanonicalRequestTimestamp(value), false, value);
	}
});
