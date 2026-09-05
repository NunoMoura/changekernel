import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";

import {installLlmReplay} from "@deepseek-ai/dsh-llm-replay";

import {createDshAgentRuntime, validateCompletedAgentRun} from "../../../src/adapters/dsh/agent-runtime.ts";
import {
	createLocalDshExecutionHost,
	LOCAL_DSH_EXECUTION_HOST_PROTOCOL,
} from "../../../src/adapters/dsh/local-execution-host.ts";
import {gitOid} from "../../../src/kernel/identity/git.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {
	agentRunCancellationRequestDigest,
	agentRunInspectRequestDigest,
	agentRunStartRequestDigest,
} from "../../../src/ports/agent-runtime.ts";
import {authorizeAgentRun} from "../../../src/server/effects/agent-runs.ts";

const fixture = fileURLToPath(new URL("./fixtures/replay-session.jsonl", import.meta.url));
const systemPrompt = "Return only the requested bounded assessment.";
const prompt = "Evaluate the exact Decision subject.";
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

function authorization(overrides = {}) {
	const routeBody = {routeId: "cw:route:model-check", providerId: "cw:provider:replay", modelId: "cw:model:replay"};
	const result = authorizeAgentRun({
		role: "model-check",
		stage: "decision",
		actorId: "cw:actor:model-check",
		authorizationId: "cw:authorization:model-check",
		subject: {
			subjectId: "cw:subject:decision-check",
			subjectDigest: digest("1"),
			repositoryId: "cw:repository:test",
			projectCommit: oid("1"),
			projectTree: oid("2"),
			changeId: "CHG-local-host",
			changeTip: oid("3"),
			workId: null,
			artifactCommit: null,
			artifactTree: null,
		},
		route: {...routeBody, routeDigest: semantic("codewiki.agent-route@1.0.0", routeBody)},
		wikiCommit: oid("3"),
		itemIds: ["cw:item:one"],
		feedbackDigest: null,
		material: {systemPrompt, prompt},
		writableScope: [],
		previewSubjectDigest: null,
		attempt: 1,
		predecessor: null,
		issuedAt: "2026-09-05T05:00:00.000Z",
		deadlineAt: "2026-09-05T05:02:00.000Z",
		...overrides,
	});
	assert.equal(result.ok, true);
	return result.value;
}

function replayInstaller(context, auth) {
	const replay = installLlmReplay(context, {
		file: fixture,
		providers: [{id: auth.route.providerId, models: [{id: auth.route.modelId}]}],
	});
	return {
		providerReceiptDigest: semantic("codewiki.test-replay-provider@1.0.0", {routeDigest: auth.route.routeDigest}),
		assertComplete: replay.assertConsumed,
		dispose: replay.dispose,
	};
}

function startRequest(auth, material = {systemPrompt, prompt}) {
	const draft = {requestDigest: digest("0"), authorization: auth, material};
	const requestDigest = agentRunStartRequestDigest(draft);
	assert.equal(requestDigest.ok, true);
	return {...draft, requestDigest: requestDigest.value};
}

test("local DSH Execution Host executes Run and re-returns identical handle on idempotent retry", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-local-host-"));
	try {
		const host = createLocalDshExecutionHost({
			custodyRoot: root,
			providerInstaller: replayInstaller,
		});
		assert.equal(host.ok, true);
		const runtime = createDshAgentRuntime(host.value);
		assert.equal(runtime.ok, true);

		const auth = authorization();
		const request = startRequest(auth);
		const first = await runtime.value.start(request);
		assert.equal(first.ok, true);
		assert.equal(first.value.status, "terminal");
		assert.notEqual(first.value.receipt, null);
		assert.notEqual(first.value.quiescence, null);
		assert.equal(first.value.receipt.outcome, "completed");
		assert.equal(first.value.receipt.runId, auth.runId);

		const validated = validateCompletedAgentRun(auth, first.value);
		assert.equal(validated.ok, true);

		const second = await runtime.value.start(request);
		assert.equal(second.ok, true);
		assert.deepEqual(second.value, first.value);

		const inspectDraft = {requestDigest: digest("0"), runId: auth.runId, authorizationDigest: auth.authorizationDigest};
		const inspectDigest = agentRunInspectRequestDigest(inspectDraft);
		assert.equal(inspectDigest.ok, true);
		const inspected = await runtime.value.inspect({...inspectDraft, requestDigest: inspectDigest.value});
		assert.equal(inspected.ok, true);
		assert.deepEqual(inspected.value, first.value);
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("local DSH Execution Host enforces request digest, bounds, and unknown Run inspection", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-local-host-bounds-"));
	try {
		assert.equal(createLocalDshExecutionHost({custodyRoot: "relative", providerInstaller: replayInstaller}).ok, false);
		assert.equal(createLocalDshExecutionHost({custodyRoot: root, providerInstaller: replayInstaller, maximumConcurrentRuns: 0}).ok, false);

		const host = createLocalDshExecutionHost({
			custodyRoot: root,
			providerInstaller: replayInstaller,
		});
		assert.equal(host.ok, true);
		const runtime = createDshAgentRuntime(host.value);
		assert.equal(runtime.ok, true);

		const auth = authorization();
		const badDigestRequest = {...startRequest(auth), requestDigest: digest("f")};
		const badDigestResult = await runtime.value.start(badDigestRequest);
		assert.equal(badDigestResult.ok, false);
		assert.equal(badDigestResult.error.code, "invalid_request");

		const inspectDraft = {requestDigest: digest("0"), runId: "cw:run:nonexistent", authorizationDigest: digest("e")};
		const inspectDigest = agentRunInspectRequestDigest(inspectDraft);
		assert.equal(inspectDigest.ok, true);
		const inspected = await runtime.value.inspect({...inspectDraft, requestDigest: inspectDigest.value});
		assert.equal(inspected.ok, false);
		assert.equal(inspected.error.code, "not_found");

		const cancelDraft = {...inspectDraft, reason: "operator", requestedAt: "2026-09-05T05:01:00.000Z"};
		const cancelDigest = agentRunCancellationRequestDigest(cancelDraft);
		assert.equal(cancelDigest.ok, true);
		const cancelled = await runtime.value.cancel({...cancelDraft, requestDigest: cancelDigest.value});
		assert.equal(cancelled.ok, false);
		assert.equal(cancelled.error.code, "not_found");
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("local DSH Execution Host cancels terminal Run idempotently", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-local-host-cancel-"));
	try {
		const host = createLocalDshExecutionHost({custodyRoot: root, providerInstaller: replayInstaller});
		assert.equal(host.ok, true);
		const runtime = createDshAgentRuntime(host.value);
		assert.equal(runtime.ok, true);

		const auth = authorization();
		const started = await runtime.value.start(startRequest(auth));
		assert.equal(started.ok, true);

		const cancelDraft = {
			requestDigest: digest("0"),
			runId: auth.runId,
			authorizationDigest: auth.authorizationDigest,
			reason: "operator",
			requestedAt: "2026-09-05T05:01:00.000Z",
		};
		const cancelDigest = agentRunCancellationRequestDigest(cancelDraft);
		assert.equal(cancelDigest.ok, true);
		const cancelled = await runtime.value.cancel({...cancelDraft, requestDigest: cancelDigest.value});
		assert.equal(cancelled.ok, true);
		assert.equal(cancelled.value.status, "terminal");
		assert.equal(cancelled.value.receipt.outcome, "completed");
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});
