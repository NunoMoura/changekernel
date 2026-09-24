import assert from "node:assert/strict";
import test from "node:test";
import {createContainerIntakeClient} from "../../../src/server/intake/container.ts";

const container = {containerId: "app:container:one"};

test("intake boundary rejects invalid identity and unsupported store before effects", () => {
	assert.throws(() => createContainerIntakeClient({protocol: "codewiki.project-store@1.0.0"}), /Unsupported/);
	const called = [];
	const store = {
		protocol: "changekernel.container-intake-store@1.0.0",
		create: (...args) => { called.push(["create", ...args]); return {ok: true, value: args[0]}; },
		open: (...args) => { called.push(["open", ...args]); return {ok: true, value: args[0]}; },
		propose: (...args) => { called.push(["propose", ...args]); return {ok: true, value: args[0]}; },
		read: (...args) => { called.push(["read", ...args]); return {ok: true, value: args[0]}; },
	};
	const client = createContainerIntakeClient(store);
	assert.equal(client.create({...container, owner: "claimed"}, "owner").error.code, "invalid_input");
	assert.equal(client.create(container, " ").error.code, "denied");
	assert.equal(client.propose({...container, requestId: "app:request:one", what: "x", why: "y", actor: "claimed"}, "owner").error.code, "invalid_input");
	assert.equal(client.open(container, undefined).error.code, "denied");
	assert.equal(client.read(container, "bad digest", "owner").error.code, "invalid_input");
	assert.deepEqual(called, []);
	assert.deepEqual(client.create(container, "owner").value, container);
	assert.deepEqual(called, [["create", container, "owner"]]);
});
