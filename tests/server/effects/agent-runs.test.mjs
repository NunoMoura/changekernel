import assert from "node:assert/strict";
import test from "node:test";

import {gitOid} from "../../../src/kernel/identity/git.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {
	AGENT_ROLE_POLICIES,
	AGENT_ROLE_POLICY_DIGEST,
	DECISION_MODEL_CHECK_EXECUTION_DIGEST,
	DECISION_CHECK_OUTPUT_SCHEMA_DIGEST,
	authorizeDecisionModelCheckRun,
	authorizeConfiguredDecisionModelCheckRun,
	resolveCheckModelRoute,
	authorizeAgentRun,
	cancelAuthorizedAgentRun,
	startAuthorizedAgentRun,
} from "../../../src/server/effects/agent-runs.ts";
import {AGENT_RUNTIME_PORT_PROTOCOL} from "../../../src/ports/agent-runtime.ts";

const digest = (character) => `sha256:${character.repeat(64)}`;
const semantic = (protocol, value) => {
	const result = semanticDigest(protocol, value);
	assert.equal(result.ok, true);
	return result.value;
};
const oid = (character) => {
	const result = gitOid("sha1", character.repeat(40));
	assert.equal(result.ok, true);
	return result.value;
};

function input(overrides = {}) {
	const routeBody = {routeId: "cw:route:worker", providerId: "cw:provider:replay", modelId: "cw:model:replay"};
	return {
		role: "worker",
		stage: "implementation",
		actorId: "cw:actor:worker",
		authorizationId: "cw:authorization:worker",
		subject: {
			subjectId: "cw:subject:work",
			subjectDigest: digest("1"),
			repositoryId: "cw:repository:test",
			projectCommit: oid("1"),
			projectTree: oid("2"),
			changeId: "CHG-agent-run",
			changeTip: oid("3"),
			workId: "cw:work:one",
			artifactCommit: null,
			artifactTree: null,
		},
		route: {...routeBody, routeDigest: semantic("codewiki.agent-route@1.0.0", routeBody)},
		wikiCommit: oid("1"),
		itemIds: ["cw:item:one"],
		feedbackDigest: null,
		material: {systemPrompt: "system", prompt: "prompt"},
		writableScope: ["src/**"],
		previewSubjectDigest: digest("4"),
		attempt: 1,
		predecessor: null,
		issuedAt: "2026-09-05T05:00:00Z",
		deadlineAt: "2026-09-05T05:10:00Z",
		...overrides,
	};
}

test("Product-fixed role policy separates tools, writable scope, Preview, and Model Checks", () => {
	assert.match(AGENT_ROLE_POLICY_DIGEST, /^sha256:[0-9a-f]{64}$/u);
	assert.equal(AGENT_ROLE_POLICIES.worker.writable, true);
	assert.equal(AGENT_ROLE_POLICIES.worker.previewWork, true);
	assert.deepEqual(AGENT_ROLE_POLICIES["model-check"].toolIds, []);
	for (const policy of Object.values(AGENT_ROLE_POLICIES)) {
		assert.equal(policy.toolIds.some((tool) => /git|delivery|remote|preview/u.test(tool)), false);
	}
});

test("Project Server authorization fixes role policy around exact runtime subject", () => {
	const authorized = authorizeAgentRun(input());
	assert.equal(authorized.ok, true);
	assert.equal(authorized.value.policyDigest, AGENT_ROLE_POLICY_DIGEST);
	assert.deepEqual(authorized.value.toolIds, AGENT_ROLE_POLICIES.worker.toolIds);
	assert.deepEqual(authorized.value.capabilities, ["codewiki.capability:preview.work", "codewiki.capability:workbench.write"]);
	assert.equal(authorized.value.issuedAt, "2026-09-05T05:00:00.000Z");

	assert.equal(authorizeAgentRun(input({authorizationId: "not namespaced"})).ok, false);
	assert.equal(authorizeAgentRun(input({role: "review", stage: "review", writableScope: ["src/**"], previewSubjectDigest: null})).ok, false);
	assert.equal(authorizeAgentRun(input({role: "review", stage: "review", writableScope: [], previewSubjectDigest: digest("4")})).ok, false);
	assert.equal(authorizeAgentRun(input({role: "worker", stage: "review"})).ok, false);
});

test("Project Server runtime helpers bind start and cancellation request digests", async () => {
	const authorized = authorizeAgentRun(input());
	assert.equal(authorized.ok, true);
	const calls = [];
	const runtime = {
		protocol: AGENT_RUNTIME_PORT_PROTOCOL,
		async start(request) {
			calls.push(request);
			return {ok: true, value: {runId: request.authorization.runId, authorizationDigest: request.authorization.authorizationDigest, status: "accepted", receipt: null, quiescence: null}};
		},
		async inspect() { throw new Error("unused"); },
		async cancel(request) {
			calls.push(request);
			return {ok: true, value: {runId: request.runId, authorizationDigest: request.authorizationDigest, status: "cancelling", receipt: null, quiescence: null}};
		},
	};
	const started = await startAuthorizedAgentRun(runtime, authorized.value, {systemPrompt: "system", prompt: "prompt"});
	assert.equal(started.ok, true);
	assert.notEqual(calls[0].requestDigest, digest("0"));
	const cancelled = await cancelAuthorizedAgentRun(runtime, {
		runId: authorized.value.runId,
		authorizationDigest: authorized.value.authorizationDigest,
		reason: "operator",
		requestedAt: "2026-09-05T05:01:00.000Z",
	});
	assert.equal(cancelled.ok, true);
	assert.notEqual(calls[1].requestDigest, calls[0].requestDigest);
});

function checkInput(patch = {}) {
	const base = input();
	const {role, stage, ...body} = base;
	void role; void stage;
	return {...body, subject: {...body.subject, subjectId: "cw:subject:change", workId: null}, writableScope: [], previewSubjectDigest: null, ...patch};
}
test("Decision model check execution binds its current output contract without widening generic run authority", () => {
	const request = checkInput();
	const configured = authorizeDecisionModelCheckRun(request), generic = authorizeAgentRun({...request, role: "model-check", stage: "decision"});
	assert.equal(configured.ok, true, JSON.stringify(configured.error));
	assert.equal(generic.ok, true);
	assert.equal(generic.value.policyDigest, AGENT_ROLE_POLICY_DIGEST);
	assert.equal(configured.value.outputSchemaDigest, DECISION_CHECK_OUTPUT_SCHEMA_DIGEST);
	assert.equal(configured.value.policyDigest, DECISION_MODEL_CHECK_EXECUTION_DIGEST);
	assert.notEqual(configured.value.runId, generic.value.runId);
	assert.notEqual(configured.value.authorizationDigest, generic.value.authorizationDigest);
	assert.notEqual(configured.value.outputSchemaDigest, generic.value.outputSchemaDigest);
	assert.notEqual(configured.value.policyDigest, generic.value.policyDigest);
	for (const field of ["subject", "context", "route", "authorityDigest", "budget", "toolIds", "capabilities", "writableScope"]) assert.deepEqual(configured.value[field], generic.value[field]);
	assert.equal(configured.value.role, "model-check");
	assert.equal(configured.value.stage, "decision");
	assert.deepEqual(configured.value.toolIds, []);
	assert.deepEqual(authorizeDecisionModelCheckRun(request), configured);
	const changed = authorizeDecisionModelCheckRun({...request, material: {...request.material, prompt: "Changed exact context"}});
	assert.equal(changed.ok, true);
	assert.notEqual(changed.value.runId, configured.value.runId);
});
test("Decision model check refuses Work, artifact, write and Preview scope", () => {
	const request = checkInput();
	for (const patch of [{changeId: null}, {changeTip: null}, {workId: "cw:work:one"}, {artifactCommit: oid("4")}, {artifactTree: oid("5")}]) {
		assert.equal(authorizeDecisionModelCheckRun({...request, subject: {...request.subject, ...patch}}).ok, false);
	}
	assert.equal(authorizeDecisionModelCheckRun(checkInput({writableScope: ["src/**"]})).ok, false);
	assert.equal(authorizeDecisionModelCheckRun(checkInput({previewSubjectDigest: digest("4")})).ok, false);
});

function localCheckRoute() {
	const body = {routeId: "cw:route:local-checks", providerId: "cw:provider:local", modelId: "cw:model:small"};
	return {...body, routeDigest: semantic("codewiki.agent-route@1.0.0", body)};
}
test("check model configuration inherits the interface route without changing existing authorizations", () => {
	const request = checkInput(), route = request.route;
	for (const configuration of [undefined, {}, {modelRoute: "inherit"}]) {
		assert.deepEqual(resolveCheckModelRoute(configuration, route.routeId, [route]), {ok: true, value: route});
		assert.deepEqual(authorizeConfiguredDecisionModelCheckRun(request, configuration, route.routeId, [route]), authorizeDecisionModelCheckRun(request));
	}
});
test("check model override selects one authorized local route and snapshots its identity", () => {
	const request = checkInput(), local = localCheckRoute(), config = {modelRoute: local.routeId};
	const result = authorizeConfiguredDecisionModelCheckRun(request, config, null, [request.route, local]);
	assert.equal(result.ok, true, JSON.stringify(result.error));
	assert.deepEqual(result.value.route, local);
	assert.ok(Object.isFrozen(result.value.route));
	assert.equal(result.value.role, "model-check");
	assert.deepEqual(result.value.toolIds, []);
	assert.deepEqual(result.value.budget, AGENT_ROLE_POLICIES["model-check"].budget);
	assert.equal(result.value.outputSchemaDigest, DECISION_CHECK_OUTPUT_SCHEMA_DIGEST);
	assert.notEqual(result.value.runId, authorizeDecisionModelCheckRun(request).value.runId);
	const original = structuredClone(local);
	local.modelId = "cw:model:changed"; config.modelRoute = request.route.routeId;
	assert.deepEqual(result.value.route, original);
	assert.deepEqual(request.route, input().route, "Authoring route must not be modified");
});
test("check model selection refuses missing or unapproved routes without fallback", () => {
	const request = checkInput(), local = localCheckRoute();
	for (const [config, inherited, routes] of [
		[{modelRoute: local.routeId}, request.route.routeId, [request.route]],
		[{}, null, [local]], [{}, request.route.routeId, [local]],
		[{modelRoute: local.routeId}, null, []],
	]) {
		assert.equal(resolveCheckModelRoute(config, inherited, routes).error.code, "environment_unavailable");
		assert.equal(authorizeConfiguredDecisionModelCheckRun(request, config, inherited, routes).ok, false);
	}
});
test("check model configuration rejects hostile data, malformed routes and ambiguous catalogues", () => {
	const route = input().route;
	let accessed = 0;
	const hostile = Object.defineProperty({}, "modelRoute", {enumerable: true, get() {accessed++; throw Error("must not run");}});
	for (const config of [null, hostile, {modelRoute: ""}, {modelRoute: "small"}, {modelRoute: "inherit", fallback: route.routeId}, {apiKey: "not permitted"}]) {
		assert.equal(resolveCheckModelRoute(config, route.routeId, [route]).ok, false);
	}
	for (const routes of [[route, route], [{...route, modelId: "cw:model:forged"}], [{...route, routeDigest: digest("f")}],
		[{...route, endpoint: "http://localhost:1234"}], Array.from({length: 33}, () => route)]) {
		assert.equal(resolveCheckModelRoute({}, route.routeId, routes).ok, false);
	}
	assert.equal(resolveCheckModelRoute({}, {}, [route]).ok, false);
	assert.equal(accessed, 0);
});
