import assert from "node:assert/strict";
import test from "node:test";

import {gitOid} from "../../../src/kernel/identity/git.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {
	AGENT_ROLE_POLICIES,
	AGENT_ROLE_POLICY_DIGEST,
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
