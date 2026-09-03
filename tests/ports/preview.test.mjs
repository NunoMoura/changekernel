import assert from "node:assert/strict";
import test from "node:test";
import {PREVIEW_PORT_PROTOCOL} from "../../src/ports/preview.ts";

test("Preview port has one frozen host-neutral protocol identity", () => {
	assert.deepEqual(PREVIEW_PORT_PROTOCOL, {
		id: "codewiki.port.preview",
		version: "1.0.0",
	});
	assert.ok(Object.isFrozen(PREVIEW_PORT_PROTOCOL));
	assert.deepEqual(Object.keys(PREVIEW_PORT_PROTOCOL).sort(), ["id", "version"]);
});
