import assert from "node:assert/strict";
import test from "node:test";
import {projectStoreCasRequestDigest, PROJECT_STORE_PORT_PROTOCOL} from "../../src/ports/project-store.ts";

test("Project Store port has one frozen host-neutral protocol identity", () => {
	assert.deepEqual(PROJECT_STORE_PORT_PROTOCOL, {
		id: "codewiki.port.project-store",
		version: "1.1.0",
	});
	assert.ok(Object.isFrozen(PROJECT_STORE_PORT_PROTOCOL));
	assert.deepEqual(Object.keys(PROJECT_STORE_PORT_PROTOCOL).sort(), ["id", "version"]);
});

test("Project Store request digest binds every CAS field except itself", () => {
	const oid = {algorithm: "sha1", hex: "1".repeat(40)};
	const request = {
		repositoryId: "cw:repository:test",
		objectFormat: "sha1",
		ref: "refs/codewiki/changes/CHG-test",
		expectedOld: null,
		newOid: oid,
		reflogMessage: "test",
		authorizationId: "cw:authorization:test",
		requestDigest: "sha256:" + "0".repeat(64),
	};
	const first = projectStoreCasRequestDigest(request);
	const second = projectStoreCasRequestDigest({...request, requestDigest: "sha256:" + "f".repeat(64)});
	assert.equal(first.ok, true);
	assert.equal(second.value, first.value);
	assert.notEqual(projectStoreCasRequestDigest({...request, reflogMessage: "other"}).value, first.value);
});
