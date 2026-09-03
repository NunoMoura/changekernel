import assert from "node:assert/strict";
import test from "node:test";
import {AGENT_RUNTIME_PORT_PROTOCOL} from "../../src/ports/agent-runtime.ts";

test("Agent Runtime port has one frozen host-neutral protocol identity", () => {
	assert.deepEqual(AGENT_RUNTIME_PORT_PROTOCOL, {
		id: "codewiki.port.agent-runtime",
		version: "1.0.0",
	});
	assert.ok(Object.isFrozen(AGENT_RUNTIME_PORT_PROTOCOL));
	assert.deepEqual(Object.keys(AGENT_RUNTIME_PORT_PROTOCOL).sort(), ["id", "version"]);
});
