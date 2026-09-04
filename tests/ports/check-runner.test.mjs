import assert from "node:assert/strict";
import test from "node:test";
import {checkRunnerRequestDigest, CHECK_RUNNER_PORT_PROTOCOL} from "../../src/ports/check-runner.ts";

test("Check Runner port has one frozen host-neutral protocol identity", () => {
	assert.deepEqual(CHECK_RUNNER_PORT_PROTOCOL, {
		id: "codewiki.port.check-runner",
		version: "1.0.0",
	});
	assert.ok(Object.isFrozen(CHECK_RUNNER_PORT_PROTOCOL));
	assert.deepEqual(Object.keys(CHECK_RUNNER_PORT_PROTOCOL).sort(), ["id", "version"]);
});

test("Check Runner request digest binds authorization and execution request facts", () => {
	const request = {
		authorizationId: "cw:authorization:test",
		requestDigest: "sha256:" + "0".repeat(64),
		gate: {},
		registration: {},
		inputs: [],
		attempt: 1,
		predecessorRunDigest: null,
		quiescenceReceipt: null,
	};
	const first = checkRunnerRequestDigest(request);
	const second = checkRunnerRequestDigest({...request, requestDigest: "sha256:" + "f".repeat(64)});
	assert.equal(first.ok, true);
	assert.equal(second.value, first.value);
	assert.notEqual(checkRunnerRequestDigest({...request, attempt: 2}).value, first.value);
});
