import assert from "node:assert/strict";
import test from "node:test";

import {
	PI_EXECUTION_HOST_PROTOCOL,
	createPiAgentRuntime,
	validateCompletedAgentRun,
} from "../../../src/adapters/pi/agent-runtime.ts";
import {
	agentRunCancellationRequestDigest,
	agentRunInspectRequestDigest,
	agentRunStartRequestDigest,
	createAgentRunAuthorization,
	createAgentRunQuiescence,
	createAgentRunReceipt,
} from "../../../src/ports/agent-runtime.ts";
import {gitOid} from "../../../src/kernel/identity/git.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";

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

function authorization() {
	const result = createAgentRunAuthorization({
		attempt: 1,
		role: "decision",
		stage: "decision",
		actorId: "cw:actor:decision",
		authorityDigest: digest("1"),
		subject: {
			subjectId: "cw:subject:change",
			subjectDigest: digest("2"),
			repositoryId: "cw:repository:test",
			projectCommit: oid("1"),
			projectTree: oid("2"),
			changeId: "CHG-runtime-test",
			changeTip: oid("3"),
			workId: null,
			artifactCommit: null,
			artifactTree: null,
		},
		route: route("cw:route:decision"),
		context: {wikiCommit: oid("3"), itemIds: ["cw:item:one"], contextDigest: digest("4"), queryPolicyDigest: digest("5"), feedbackDigest: null},
		toolIds: ["codewiki.tool:wiki.read"],
		toolSetDigest: semantic("codewiki.agent-tool-set@1.0.0", {toolIds: ["codewiki.tool:wiki.read"]}),
		capabilities: [],
		writableScope: [],
		previewSubjectDigest: null,
		budget: {timeoutMs: 60_000, maximumModelRequests: 4, maximumToolCalls: 20, maximumInputTokens: 100_000, maximumOutputTokens: 10_000, maximumOutputBytes: 1_000_000},
		outputSchemaDigest: digest("7"),
		policyDigest: digest("8"),
		issuedAt: "2026-09-05T05:00:00.000Z",
		deadlineAt: "2026-09-05T05:01:00.000Z",
		predecessor: null,
	});
	assert.equal(result.ok, true);
	return result.value;
}

function route(routeId) {
	const body = {routeId, providerId: "cw:provider:replay", modelId: "cw:model:replay"};
	return {...body, routeDigest: semantic("codewiki.agent-route@1.0.0", body)};
}

function terminalHandle(auth) {
	const quiescence = createAgentRunQuiescence({
		runId: auth.runId,
		authorizationDigest: auth.authorizationDigest,
		observedAt: "2026-09-05T05:01:01.000Z",
		processTreeTerminated: true,
		providerRequestsClosed: true,
		previewClosed: true,
		temporaryStateClosed: true,
	});
	assert.equal(quiescence.ok, true);
	const receipt = createAgentRunReceipt({
		runId: auth.runId,
		authorizationDigest: auth.authorizationDigest,
		outcome: "completed",
		startedAt: "2026-09-05T05:00:01.000Z",
		finishedAt: "2026-09-05T05:01:00.000Z",
		outputDigest: digest("9"),
		usageDigest: null,
		providerReceiptDigest: digest("a"),
		sessionReceiptDigest: digest("b"),
		queryReceiptDigests: [],
		cancellationDigest: null,
		custody: {processTreeTerminated: true, providerRequestsClosed: true, previewClosed: true, temporaryStateClosed: true, quiescenceDigest: quiescence.value.quiescenceDigest},
		operationalGaps: [],
	});
	assert.equal(receipt.ok, true);
	return {runId: auth.runId, authorizationDigest: auth.authorizationDigest, status: "terminal", receipt: receipt.value, quiescence: quiescence.value};
}

function requestFor(auth) {
	const draft = {
		requestDigest: digest("0"),
		authorization: auth,
		material: {systemPrompt: "test system prompt", prompt: "test prompt"},
	};
	const requestDigest = agentRunStartRequestDigest(draft);
	assert.equal(requestDigest.ok, true);
	return {...draft, requestDigest: requestDigest.value};
}

test("Pi adapter validates host protocol and forwards only strict protocol messages", async () => {
	assert.equal(createPiAgentRuntime({protocol: {id: "wrong", version: "1.0.0"}, execute: async () => null}).ok, false);
	const auth = authorization();
	const messages = [];
	const host = {
		protocol: PI_EXECUTION_HOST_PROTOCOL,
		async execute(message) {
			messages.push(message);
			return {ok: true, value: {runId: auth.runId, authorizationDigest: auth.authorizationDigest, status: "accepted", receipt: null, quiescence: null}};
		},
	};
	const adapter = createPiAgentRuntime(host);
	assert.equal(adapter.ok, true);
	const started = await adapter.value.start(requestFor(auth));
	assert.equal(started.ok, true);
	assert.equal(started.value.status, "accepted");
	assert.equal(messages.length, 1);
	assert.equal(messages[0].operation, "start");
	assert.deepEqual(messages[0].protocol, PI_EXECUTION_HOST_PROTOCOL);
});

test("Pi adapter rejects malformed requests, stale handles, malformed evidence, and lost transport", async () => {
	const auth = authorization();
	for (const response of [
		{ok: true, value: {runId: "cw:run:other", authorizationDigest: auth.authorizationDigest, status: "accepted", receipt: null, quiescence: null}},
		{ok: true, value: {runId: auth.runId, authorizationDigest: auth.authorizationDigest, status: "terminal", receipt: null, quiescence: null}},
		{ok: false, error: {code: "unknown", message: "bad"}},
	]) {
		const adapter = createPiAgentRuntime({protocol: PI_EXECUTION_HOST_PROTOCOL, execute: async () => response});
		assert.equal(adapter.ok, true);
		assert.equal((await adapter.value.start(requestFor(auth))).ok, false);
	}
	const throwing = createPiAgentRuntime({protocol: PI_EXECUTION_HOST_PROTOCOL, execute: async () => { throw new Error("lost"); }});
	assert.equal(throwing.ok, true);
	assert.equal((await throwing.value.start(requestFor(auth))).error.code, "transport_lost");
	assert.equal((await throwing.value.start({...requestFor(auth), requestDigest: digest("f")})).error.code, "invalid_request");
});

test("Pi adapter validates terminal receipt, quiescence, inspect, cancellation, and completion", async () => {
	const auth = authorization();
	const terminal = terminalHandle(auth);
	const operations = [];
	const adapter = createPiAgentRuntime({
		protocol: PI_EXECUTION_HOST_PROTOCOL,
		async execute(message) {
			operations.push(message.operation);
			return {ok: true, value: terminal};
		},
	});
	assert.equal(adapter.ok, true);
	const started = await adapter.value.start(requestFor(auth));
	assert.equal(started.ok, true);
	assert.equal(validateCompletedAgentRun(auth, started.value).ok, true);

	const inspectDraft = {requestDigest: digest("0"), runId: auth.runId, authorizationDigest: auth.authorizationDigest};
	const inspectDigest = agentRunInspectRequestDigest(inspectDraft);
	assert.equal(inspectDigest.ok, true);
	assert.equal((await adapter.value.inspect({...inspectDraft, requestDigest: inspectDigest.value})).ok, true);

	const cancelDraft = {...inspectDraft, reason: "operator", requestedAt: "2026-09-05T05:00:30.000Z"};
	const cancelDigest = agentRunCancellationRequestDigest(cancelDraft);
	assert.equal(cancelDigest.ok, true);
	assert.equal((await adapter.value.cancel({...cancelDraft, requestDigest: cancelDigest.value})).ok, true);
	assert.deepEqual(operations, ["start", "inspect", "cancel"]);
});
