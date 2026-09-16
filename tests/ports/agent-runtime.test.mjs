import assert from "node:assert/strict";
import test from "node:test";

import {
	AGENT_RUNTIME_PORT_PROTOCOL,
	agentRunCancellationRequestDigest,
	agentRunInspectRequestDigest,
	agentRunReceiptClosesAuthorization,
	agentRunStartRequestDigest,
	createAgentRunAuthorization,
	createAgentRunQuiescence,
	createAgentRunReceipt,
	decodeAgentRunAuthorization,
} from "../../src/ports/agent-runtime.ts";
import {gitOid} from "../../src/kernel/identity/git.ts";
import {semanticDigest} from "../../src/kernel/identity/semantic-digest.ts";

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

function authorizationInput(overrides = {}) {
	return {
		attempt: 1,
		role: "worker",
		stage: "implementation",
		actorId: "cw:actor:worker",
		authorityDigest: digest("1"),
		subject: {
			subjectId: "cw:subject:work",
			subjectDigest: digest("2"),
			repositoryId: "cw:repository:test",
			projectCommit: oid("1"),
			projectTree: oid("2"),
			changeId: "CHG-runtime-test",
			changeTip: oid("3"),
			workId: "cw:work:test",
			artifactCommit: null,
			artifactTree: null,
		},
		route: route("cw:route:worker"),
		context: {
			wikiCommit: oid("1"),
			itemIds: ["cw:item:one"],
			contextDigest: digest("4"),
			queryPolicyDigest: digest("5"),
			feedbackDigest: null,
		},
		toolIds: ["codewiki.tool:wiki.read"],
		toolSetDigest: semantic("codewiki.agent-tool-set@1.0.0", {toolIds: ["codewiki.tool:wiki.read"]}),
		capabilities: ["codewiki.capability:preview.work"],
		writableScope: ["src/**"],
		previewSubjectDigest: digest("7"),
		budget: {
			timeoutMs: 60_000,
			maximumModelRequests: 4,
			maximumToolCalls: 20,
			maximumInputTokens: 100_000,
			maximumOutputTokens: 10_000,
			maximumOutputBytes: 1_000_000,
		},
		outputSchemaDigest: digest("8"),
		policyDigest: digest("9"),
		issuedAt: "2026-09-05T05:00:00.000Z",
		deadlineAt: "2026-09-05T05:01:00.000Z",
		predecessor: null,
		...overrides,
	};
}

function route(routeId) {
	const body = {routeId, providerId: "cw:provider:replay", modelId: "cw:model:replay"};
	return {...body, routeDigest: semantic("codewiki.agent-route@1.0.0", body)};
}

function completeEvidence(authorization) {
	const quiescence = createAgentRunQuiescence({
		runId: authorization.runId,
		authorizationDigest: authorization.authorizationDigest,
		observedAt: "2026-09-05T05:01:01.000Z",
		processTreeTerminated: true,
		providerRequestsClosed: true,
		previewClosed: true,
		temporaryStateClosed: true,
	});
	assert.equal(quiescence.ok, true);
	const receipt = createAgentRunReceipt({
		runId: authorization.runId,
		authorizationDigest: authorization.authorizationDigest,
		outcome: "completed",
		startedAt: "2026-09-05T05:00:01.000Z",
		finishedAt: "2026-09-05T05:01:00.000Z",
		outputDigest: digest("a"),
		usageDigest: digest("b"),
		providerReceiptDigest: digest("c"),
		sessionReceiptDigest: digest("d"),
		queryReceiptDigests: [digest("e")],
		cancellationDigest: null,
		custody: {
			processTreeTerminated: true,
			providerRequestsClosed: true,
			previewClosed: true,
			temporaryStateClosed: true,
			quiescenceDigest: quiescence.value.quiescenceDigest,
		},
		operationalGaps: [],
	});
	assert.equal(receipt.ok, true);
	return {quiescence: quiescence.value, receipt: receipt.value};
}

test("Agent Run authorization deterministically binds role, exact subject, route, tools, scope, budgets, and predecessor", () => {
	const first = createAgentRunAuthorization(authorizationInput());
	const second = createAgentRunAuthorization(authorizationInput());
	assert.equal(first.ok, true);
	assert.equal(second.ok, true);
	assert.deepEqual(first.value, second.value);
	assert.match(first.value.runId, /^cw:run:/u);
	assert.equal(decodeAgentRunAuthorization(first.value).ok, true);

	const evidence = completeEvidence(first.value);
	const successor = createAgentRunAuthorization(authorizationInput({
		attempt: 2,
		issuedAt: "2026-09-05T05:02:00.000Z",
		deadlineAt: "2026-09-05T05:03:00.000Z",
		predecessor: {
			runId: first.value.runId,
			authorizationDigest: first.value.authorizationDigest,
			receiptDigest: evidence.receipt.receiptDigest,
			quiescenceDigest: evidence.quiescence.quiescenceDigest,
			outcome: "completed",
		},
	}));
	assert.equal(successor.ok, true);
	assert.notEqual(successor.value.runId, first.value.runId);
	assert.equal(agentRunReceiptClosesAuthorization(first.value, evidence.receipt), true);
});

test("Agent Run authorization rejects role, protected scope, preview, attempt, and digest drift", () => {
	for (const input of [
		authorizationInput({role: "review"}),
		authorizationInput({writableScope: [".changekernel/wiki/**"]}),
		authorizationInput({capabilities: [], previewSubjectDigest: digest("7")}),
		authorizationInput({attempt: 2, predecessor: null}),
	]) {
		assert.equal(createAgentRunAuthorization(input).ok, false);
	}
	const valid = createAgentRunAuthorization(authorizationInput());
	assert.equal(valid.ok, true);
	assert.equal(decodeAgentRunAuthorization({...valid.value, policyDigest: digest("a")}).ok, false);
});

test("Agent Run request digest helpers exclude their digest fields and bind cancellation semantics", () => {
	const authorization = createAgentRunAuthorization(authorizationInput());
	assert.equal(authorization.ok, true);
	const start = {
		requestDigest: digest("0"),
		authorization: authorization.value,
		material: {systemPrompt: "system prompt", prompt: "user prompt"},
	};
	const startDigest = agentRunStartRequestDigest(start);
	assert.equal(startDigest.ok, true);
	assert.equal(agentRunStartRequestDigest({...start, requestDigest: startDigest.value}).value, startDigest.value);

	const inspect = {requestDigest: digest("0"), runId: authorization.value.runId, authorizationDigest: authorization.value.authorizationDigest};
	const inspectDigest = agentRunInspectRequestDigest(inspect);
	assert.equal(inspectDigest.ok, true);

	const cancellation = {...inspect, reason: "operator", requestedAt: "2026-09-05T05:00:30.000Z"};
	const cancellationDigest = agentRunCancellationRequestDigest(cancellation);
	assert.equal(cancellationDigest.ok, true);
	assert.notEqual(cancellationDigest.value, inspectDigest.value);
});
