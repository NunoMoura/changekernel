import assert from "node:assert/strict";
import test from "node:test";
import {PROJECT_STORE_PORT_PROTOCOL} from "../../src/ports/project-store.ts";

test("Project Store port has one frozen host-neutral protocol identity", () => {
	assert.deepEqual(PROJECT_STORE_PORT_PROTOCOL, {
		id: "codewiki.port.project-store",
		version: "1.0.0",
	});
	assert.ok(Object.isFrozen(PROJECT_STORE_PORT_PROTOCOL));
	assert.deepEqual(Object.keys(PROJECT_STORE_PORT_PROTOCOL).sort(), ["id", "version"]);
});
