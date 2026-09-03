import assert from "node:assert/strict";
import test from "node:test";
import {CHECK_RUNNER_PORT_PROTOCOL} from "../../src/ports/check-runner.ts";

test("Check Runner port has one frozen host-neutral protocol identity", () => {
	assert.deepEqual(CHECK_RUNNER_PORT_PROTOCOL, {
		id: "codewiki.port.check-runner",
		version: "1.0.0",
	});
	assert.ok(Object.isFrozen(CHECK_RUNNER_PORT_PROTOCOL));
	assert.deepEqual(Object.keys(CHECK_RUNNER_PORT_PROTOCOL).sort(), ["id", "version"]);
});
