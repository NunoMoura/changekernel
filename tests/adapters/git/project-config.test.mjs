import assert from "node:assert/strict";
import test from "node:test";
import {
	decodeProjectConfig,
	parseProjectConfigJson,
	serializeBootstrapProjectConfig,
} from "../../../src/adapters/git/project-config.ts";

import {authorizeProjectDecisionModelCheckRun} from "../../../src/adapters/git/check-model.ts";
import {authorizeDecisionModelCheckRun, startAuthorizedAgentRun} from "../../../src/server/effects/agent-runs.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";


test("reader accepts current project identity without checkout configuration or controller state", () => {
	const result = parseProjectConfigJson(JSON.stringify({protocol: {id: "codewiki.project-config", version: "2.0.0"}, project: "example"}));
	assert.equal(result.ok, true);
	assert.equal(result.value.project, "example");
});

test("bootstrap emits only project identity, with no invented runtime or Check Pack settings", () => {
	const result = serializeBootstrapProjectConfig("example-project");
	assert.equal(result.ok, true);
	assert.equal(result.value.endsWith("\n"), true);
	assert.deepEqual(JSON.parse(result.value), {project: "example-project", protocol: {id: "codewiki.project-config", version: "2.0.0"}});
	assert.equal(parseProjectConfigJson(result.value).ok, true);
	for (const field of ["quality", "hosts", "retention", "userStandards", "preview"]) {
		assert.equal(decodeProjectConfig({...JSON.parse(result.value), [field]: {}}).error.code, "unknown_field");
	}
});

test("reader rejects Domain fallback, unknown fields, protocol drift, and invalid project identity", () => {
	for (const [value, code] of [
		[{protocol: {id: "codewiki.project-config", version: "2.0.0"}, project: "x", domain: {}}, "unknown_field"],
		[{protocol: {id: "codewiki.project-config", version: "3.0.0"}, project: "x"}, "invalid_protocol"],
		[{protocol: {id: "codewiki.project-config", version: "2.0.0"}, project: "../x"}, "invalid_project"],
		[{protocol: {id: "codewiki.project-config", version: "2.0.0"}, project: ""}, "invalid_project"],
	]) {
		const result = decodeProjectConfig(value);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, code);
	}
	assert.equal(parseProjectConfigJson("not-json").error.code, "invalid_json");
	assert.equal(parseProjectConfigJson(`{"padding":"${"x".repeat(1_048_576)}"}`).error.code, "invalid_value");
});

const digest = (character) => `sha256:${character.repeat(64)}`;
function modelRoute(name) {
	const body = {routeId: `cw:route:${name}`, providerId: `cw:provider:${name}`, modelId: `cw:model:${name}`};
	const result = semanticDigest("codewiki.agent-route@1.0.0", body);
	assert.equal(result.ok, true);
	return {...body, routeDigest: result.value};
}
function checkRequest() {
	const oid = (character) => ({algorithm: "sha1", hex: character.repeat(40)});
	return {
		actorId: "cw:actor:author", authorizationId: "cw:authorization:author",
		subject: {
			subjectId: "cw:subject:change", subjectDigest: digest("1"), repositoryId: "cw:repository:test",
			projectCommit: oid("1"), projectTree: oid("2"), changeId: "CHG-model-config", changeTip: oid("3"),
			workId: null, artifactCommit: null, artifactTree: null,
		},
		wikiCommit: oid("1"), itemIds: [], feedbackDigest: null,
		material: {systemPrompt: "Check one claim.", prompt: "Bound source material."},
		writableScope: [], previewSubjectDigest: null, attempt: 1, predecessor: null,
		issuedAt: "2026-09-14T05:00:00Z", deadlineAt: "2026-09-14T05:01:00Z",
	};
}
const settings = (runtime) => JSON.stringify({
	protocol: {id: "codewiki.project-config", version: "2.0.0"}, project: "test",
	...(runtime === undefined ? {} : {runtime}),
}, null, 2);

test("project check settings inherit only the exact observed interface model", () => {
	const request = checkRequest(), route = modelRoute("authoring");
	const expected = authorizeDecisionModelCheckRun({...request, route});
	assert.equal(expected.ok, true, JSON.stringify(expected.error));
	for (const runtime of [undefined, {}, {checkModel: {}}, {checkModel: {modelRoute: "inherit"}}]) {
		assert.deepEqual(authorizeProjectDecisionModelCheckRun(request, settings(runtime), route, [route]), expected);
	}
});

test("project check-model override reaches the runtime without changing the interface model or retrying failures", async () => {
	const request = checkRequest(), authoring = modelRoute("authoring"), local = modelRoute("local-small");
	const text = settings({checkModel: {modelRoute: local.routeId}});
	const result = authorizeProjectDecisionModelCheckRun(request, text, authoring, [authoring, local]);
	assert.equal(result.ok, true, JSON.stringify(result.error));
	assert.deepEqual(result.value.route, local);
	assert.deepEqual(authorizeProjectDecisionModelCheckRun(request, text, null, [local]), result);
	const received = [];
	const unavailable = {ok: false, error: {code: "environment_unavailable", message: "Simulated unavailable model."}};
	const output = await startAuthorizedAgentRun({start: async (run) => {received.push(run); return unavailable;}}, result.value, request.material);
	assert.deepEqual(output, unavailable);
	assert.equal(received.length, 1);
	assert.deepEqual(received[0].authorization.route, local);
	assert.deepEqual(authoring, modelRoute("authoring"));
});

test("project check-model inheritance rejects identity drift and unavailable selections", () => {
	const request = checkRequest(), route = modelRoute("authoring"), local = modelRoute("local-small");
	const changedBody = {...local, routeId: route.routeId};
	delete changedBody.routeDigest;
	const changed = {...changedBody, routeDigest: semanticDigest("codewiki.agent-route@1.0.0", changedBody).value};
	for (const [runtime, observed, routes] of [
		[{}, route, [changed]], [{}, null, [route]], [{}, route, [local]],
		[{checkModel: {modelRoute: local.routeId}}, route, [route]],
	]) {
		const result = authorizeProjectDecisionModelCheckRun(request, settings(runtime), observed, routes);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "environment_unavailable");
	}
});

test("project check settings and interface snapshots reject malformed or hostile input", () => {
	const request = checkRequest(), route = modelRoute("authoring");
	for (const runtime of [null, [], false, {checkModel: null}, {checkModel: "inherit"},
		{checkModel: {modelRoute: "inherit", fallback: route.routeId}}, {checkModel: {provider: "local", apiKey: "forbidden"}}]) {
		assert.equal(authorizeProjectDecisionModelCheckRun(request, settings(runtime), route, [route]).ok, false);
	}
	assert.equal(authorizeProjectDecisionModelCheckRun(request, "not-json", route, [route]).ok, false);
	let accessed = 0;
	const hostile = Object.defineProperty({}, "routeId", {enumerable: true, get() {accessed++; throw Error("must not execute");}});
	for (const observed of [undefined, hostile, {...route, modelId: "cw:model:forged"}, {...route, extra: true}]) {
		assert.equal(authorizeProjectDecisionModelCheckRun(request, settings(), observed, [route]).ok, false);
	}
	assert.equal(accessed, 0);
});

test("project check settings bind each run without retroactively changing prior model selection", () => {
	const request = checkRequest(), route = modelRoute("authoring"), local = modelRoute("local-small");
	const first = authorizeProjectDecisionModelCheckRun(request, settings(), route, [route, local]);
	const second = authorizeProjectDecisionModelCheckRun(request, settings({checkModel: {modelRoute: local.routeId}}), route, [route, local]);
	assert.equal(first.ok, true); assert.equal(second.ok, true);
	assert.notEqual(first.value.runId, second.value.runId);
	local.modelId = "cw:model:mutated"; route.modelId = "cw:model:mutated";
	assert.deepEqual(first.value.route, modelRoute("authoring"));
	assert.deepEqual(second.value.route, modelRoute("local-small"));
	assert.ok(Object.isFrozen(second.value.route));
});

test("project model settings do not relax Decision authorization boundaries", () => {
	const request = checkRequest(), route = modelRoute("local-small"), text = settings({checkModel: {modelRoute: route.routeId}});
	for (const modified of [
		{...request, writableScope: ["src/**"]}, {...request, previewSubjectDigest: digest("5")},
		{...request, subject: {...request.subject, workId: "cw:work:one"}},
	]) {
		assert.equal(authorizeProjectDecisionModelCheckRun(modified, text, null, [route]).ok, false);
	}
});


test("legacy runtime settings fail before route observation without implicit inheritance", () => {
	const hostile = Object.defineProperty({}, "routeId", {get() {throw new Error("must not observe");}});
	for (const runtime of [{modelRouting: {roleRoutes: {decision: "inherit"}}}, {automation: "manual"}, {checkModel: {}, budgets: {}}]) {
		const result = authorizeProjectDecisionModelCheckRun(checkRequest(), settings(runtime), hostile, []);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "unknown_field");
	}
});
