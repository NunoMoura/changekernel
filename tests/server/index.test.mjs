import assert from "node:assert/strict";
import test from "node:test";
import {AGENT_RUNTIME_PORT_PROTOCOL} from "../../src/ports/agent-runtime.ts";
import {PREVIEW_PORT_PROTOCOL} from "../../src/ports/preview.ts";
import {PROJECT_STORE_PORT_PROTOCOL} from "../../src/ports/project-store.ts";
import {PROJECT_ACCESS_POLICY_PROTOCOL} from "../../src/server/authorization/policy.ts";
import {
	PROJECT_SERVER_FOUNDATION_PROTOCOL,
	PROJECT_SERVER_PROTOCOL,
	bindProjectServerFoundation,
	createProjectServer,
} from "../../src/server/index.ts";

import {CHANGEKERNEL_VERSION} from "../../src/kernel/identity/version.ts";
import {WIKI_PROFILE_ID} from "../../src/kernel/wiki/profile.ts";

const DIGEST = `sha256:${"a".repeat(64)}`;
const unavailable = async () => { throw new Error("not called by binding test"); };

function validPorts() {
	return {
		projectStore: {
			protocol: PROJECT_STORE_PORT_PROTOCOL,
			readSnapshot: unavailable,
			readBlob: unavailable,
			readTree: unavailable,
			writeBlob: unavailable,
			writeTree: unavailable,
			createCommit: unavailable,
			compareAndSwapRefs: unavailable,
		},
		agentRuntime: {protocol: AGENT_RUNTIME_PORT_PROTOCOL, start: unavailable, inspect: unavailable, cancel: unavailable},
	};
}

function validInput(overrides = {}) {
	return {
		ports: validPorts(),
		accessPolicy: {
			protocol: PROJECT_ACCESS_POLICY_PROTOCOL,
			authorize() {
				throw new Error("not called by binding test");
			},
		},
		project: {
			projectName: "Test Project",
			repositoryId: "cw:repository:test",
			objectFormat: "sha1",
			canonicalRef: "refs/heads/main",
			kernelBuildDigest: DIGEST,
		},
		...overrides,
	};
}

test("Project Server foundation binds qualified internal ports and exposes only Preview unavailability", () => {
	const result = bindProjectServerFoundation(validPorts());
	assert.equal(result.ok, true);
	assert.equal(result.value.protocol, PROJECT_SERVER_FOUNDATION_PROTOCOL);
	assert.deepEqual(result.value.capabilities, {
		projectStore: "available",
		agentRuntime: "available",
		preview: "unavailable",
	});
	assert.equal("ports" in result.value, false);
	assert.equal(Object.isFrozen(result.value), true);

	const withPreview = bindProjectServerFoundation({
		...validPorts(),
		preview: {protocol: PREVIEW_PORT_PROTOCOL, observe: unavailable},
	});
	assert.equal(withPreview.ok, true);
	assert.equal(withPreview.value.capabilities.preview, "available");
});

test("Project Server rejects wrong ports, access policy, identity, refs, and bounds", () => {
	for (const port of ["projectStore", "agentRuntime", "preview"]) {
		const ports = validPorts();
		if (port === "preview") {
			ports.preview = {protocol: {id: PREVIEW_PORT_PROTOCOL.id, version: "999.0.0"}, observe: unavailable};
		} else {
			ports[port] = {protocol: {...ports[port].protocol, version: "999.0.0"}};
		}
		const result = bindProjectServerFoundation(ports);
		assert.equal(result.ok, false);
		assert.equal(result.error.field, port);
	}
	assert.equal(bindProjectServerFoundation(null).ok, false);
	assert.equal(bindProjectServerFoundation({...validPorts(), unexpected: true}).ok, false);
	assert.equal(createProjectServer({...validInput(), accessPolicy: {protocol: {...PROJECT_ACCESS_POLICY_PROTOCOL, version: "2.0.0"}}}).ok, false);
	assert.equal(createProjectServer({...validInput(), project: {...validInput().project, repositoryId: "plain"}}).ok, false);
	assert.equal(createProjectServer({...validInput(), project: {...validInput().project, projectName: "unsafe\u001bname"}}).ok, false);
	assert.equal(createProjectServer({...validInput(), project: {...validInput().project, canonicalRef: "refs/heads/other"}}).ok, false);
	assert.equal(createProjectServer({...validInput(), limits: {maximumHistoryCommits: 0}}).ok, false);
	assert.equal(createProjectServer({...validInput(), limits: {unexpected: 1}}).ok, false);
	assert.equal(createProjectServer({...validInput(), project: {...validInput().project, unexpected: true}}).ok, false);
	assert.equal(createProjectServer({...validInput(), unexpected: true}).ok, false);
	assert.equal(createProjectServer({...validInput(), maximumReplayEntries: 0}).ok, false);
});

test("bound Project Server exposes one request handle and no adapter or authority handles", () => {
	const result = createProjectServer(validInput());
	assert.equal(result.ok, true);
	assert.equal(result.value.protocol, PROJECT_SERVER_PROTOCOL);
	assert.deepEqual(Object.keys(result.value).sort(), ["handle", "protocol"]);
	assert.equal(JSON.stringify(result.value).includes("projectStore"), false);
	assert.equal(JSON.stringify(result.value).includes("accessPolicy"), false);
});

test("Project Server defaults and explicit pins use the same current Kernel contract", () => {
	for (const selection of [{}, {kernelVersion: CHANGEKERNEL_VERSION}]) {
		const input = validInput();
		assert.equal(createProjectServer({...input, project: {...input.project, ...selection}}).ok, true);
	}
});

test("Project Server rejects unknown, mixed or hostile Kernel version selection before source access", () => {
	const input = validInput();
	for (const kernelVersion of [undefined, null, {}, "latest", "999.0.0", WIKI_PROFILE_ID, `^${CHANGEKERNEL_VERSION}`]) {
		const result = createProjectServer({...input, project: {...input.project, kernelVersion}});
		assert.equal(result.ok, false);
		assert.equal(result.error.field, "kernelVersion");
	}
	for (const patch of [
		{wikiProfile: WIKI_PROFILE_ID},
		{kernelVersion: CHANGEKERNEL_VERSION, wikiProfile: WIKI_PROFILE_ID},
		{kernelVersion: CHANGEKERNEL_VERSION, retiredWikiItemIds: ["cw:item:retired"]},
	]) assert.equal(createProjectServer({...input, project: {...input.project, ...patch}}).ok, false);
	let reads = 0;
	const getter = Object.defineProperty({...input.project}, "kernelVersion", {enumerable: true, get() {reads++; throw new Error("must not run");}});
	const inherited = Object.assign(Object.create({kernelVersion: CHANGEKERNEL_VERSION}), input.project);
	for (const project of [getter, inherited]) assert.equal(createProjectServer({...input, project}).ok, false);
	assert.equal(reads, 0);
	const historical = createProjectServer({...input, project: {...input.project, wikiProfile: WIKI_PROFILE_ID, retiredWikiItemIds: ["cw:item:retired"]}});
	assert.equal(historical.ok, false);
	for (const extra of [{checkRunner: {}}, {facts: {}}]) assert.equal(bindProjectServerFoundation({...validPorts(), ...extra}).ok, false);
});
