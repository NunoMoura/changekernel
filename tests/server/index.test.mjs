import assert from "node:assert/strict";
import test from "node:test";
import {AGENT_RUNTIME_PORT_PROTOCOL} from "../../src/ports/agent-runtime.ts";
import {CHECK_RUNNER_PORT_PROTOCOL} from "../../src/ports/check-runner.ts";
import {PREVIEW_PORT_PROTOCOL} from "../../src/ports/preview.ts";
import {PROJECT_STORE_PORT_PROTOCOL} from "../../src/ports/project-store.ts";
import {
	bindProjectServerFoundation,
	PROJECT_SERVER_FOUNDATION_PROTOCOL,
} from "../../src/server/index.ts";

function validPorts() {
	return {
		projectStore: {protocol: PROJECT_STORE_PORT_PROTOCOL},
		checkRunner: {protocol: CHECK_RUNNER_PORT_PROTOCOL},
		agentRuntime: {protocol: AGENT_RUNTIME_PORT_PROTOCOL},
		preview: {protocol: PREVIEW_PORT_PROTOCOL},
	};
}

test("Project Server foundation binds exactly four explicit capabilities", () => {
	const bound = bindProjectServerFoundation(validPorts());
	assert.equal(bound.ok, true);
	assert.deepEqual(bound.value.protocol, PROJECT_SERVER_FOUNDATION_PROTOCOL);
	assert.deepEqual(Object.keys(bound.value.ports).sort(), [
		"agentRuntime",
		"checkRunner",
		"preview",
		"projectStore",
	]);
	assert.equal("transition" in bound.value, false);
	assert.equal("writeRef" in bound.value, false);
	assert.ok(Object.isFrozen(bound.value));
	assert.ok(Object.isFrozen(bound.value.ports));
});

test("Project Server foundation returns typed protocol mismatch", () => {
	const ports = validPorts();
	ports.preview = {protocol: {id: "codewiki.port.preview", version: "2.0.0"}};
	const bound = bindProjectServerFoundation(ports);
	assert.deepEqual(bound, {
		ok: false,
		error: {
			code: "invalid_port_protocol",
			port: "preview",
			message: "preview must bind codewiki.port.preview@1.0.0.",
		},
	});
});
