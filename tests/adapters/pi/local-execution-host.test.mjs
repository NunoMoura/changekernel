import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";

import {scriptedInstaller} from "./fixtures.mjs";

import {createPiAgentRuntime, validateCompletedAgentRun, PI_EXECUTION_HOST_PROTOCOL} from "../../../src/adapters/pi/agent-runtime.ts";
import {createPiAgentOutputReader} from "../../../src/adapters/pi/agent-output.ts";
import {createAgentRunOutputRequest} from "../../../src/ports/agent-output.ts";
import {readAuthorizedAgentRunOutput} from "../../../src/server/effects/agent-output.ts";
import {
	createLocalPiExecutionHost,
} from "../../../src/adapters/pi/local-execution-host.ts";
import {gitOid} from "../../../src/kernel/identity/git.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {
	agentRunCancellationRequestDigest,
	agentRunInspectRequestDigest,
	agentRunStartRequestDigest,
	createAgentRunAuthorization,
} from "../../../src/ports/agent-runtime.ts";
import {authorizeAgentRun} from "../../../src/server/effects/agent-runs.ts";

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
	const routeBody = {routeId: "cw:route:model-check", providerId: "cw:provider:scripted", modelId: "cw:model:scripted"};
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

function authorizationWithBudget(budgetPatch) {
	const {protocol, runId, authorizationDigest, ...body} = authorization();
	void protocol; void runId; void authorizationDigest;
	const result = createAgentRunAuthorization({...body, budget: {...body.budget, ...budgetPatch}});
	assert.equal(result.ok, true);
	return result.value;
}


function startRequest(auth, material = {systemPrompt, prompt}) {
	const draft = {requestDigest: digest("0"), authorization: auth, material};
	const requestDigest = agentRunStartRequestDigest(draft);
	assert.equal(requestDigest.ok, true);
	return {...draft, requestDigest: requestDigest.value};
}

test("local Pi Execution Host executes Run and re-returns identical handle on idempotent retry", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-local-host-"));
	try {
		const host = createLocalPiExecutionHost({
			custodyRoot: root,
			clock: outputClock,
			providerInstaller: scriptedInstaller,
		});
		assert.equal(host.ok, true);
		const runtime = createPiAgentRuntime(host.value);
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

test("local Pi Execution Host enforces request digest, bounds, and unknown Run inspection", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-local-host-bounds-"));
	try {
		assert.equal(createLocalPiExecutionHost({custodyRoot: "relative", providerInstaller: scriptedInstaller}).ok, false);
		assert.equal(createLocalPiExecutionHost({custodyRoot: root, providerInstaller: scriptedInstaller, maximumConcurrentRuns: 0}).ok, false);

		const host = createLocalPiExecutionHost({
			custodyRoot: root,
			providerInstaller: scriptedInstaller,
		});
		assert.equal(host.ok, true);
		const runtime = createPiAgentRuntime(host.value);
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

test("local Pi Execution Host cancels terminal Run idempotently", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-local-host-cancel-"));
	try {
		const host = createLocalPiExecutionHost({custodyRoot: root, providerInstaller: scriptedInstaller, clock: outputClock});
		assert.equal(host.ok, true);
		const runtime = createPiAgentRuntime(host.value);
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

function outputRequest(auth, handle, patch = {}) {
	const result = createAgentRunOutputRequest({runId: auth.runId, authorizationDigest: auth.authorizationDigest, receiptDigest: handle.receipt.receiptDigest, ...patch});
	assert.equal(result.ok, true);
	return result.value;
}
const outputClock = () => "2026-09-05T05:01:00.000Z";

test("local host rejects wrong authorization before inspecting or cancelling an active Run", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-host-binding-"));
	let release;
	const blocked = new Promise(resolve => {release = resolve;});
	let entered;
	const ready = new Promise(resolve => {entered = resolve;});
	let starting;
	try {
		const host = createLocalPiExecutionHost({custodyRoot: root, clock: outputClock,
			providerInstaller: async (auth, signal) => {entered(); await blocked; return scriptedInstaller(auth, signal);}}).value;
		const runtime = createPiAgentRuntime(host).value, auth = authorization();
		starting = runtime.start(startRequest(auth));
		await ready;
		for (const operation of ["inspect", "cancel"]) {
			const draft = {runId: auth.runId, authorizationDigest: digest("f"), requestDigest: digest("0"),
				...(operation === "cancel" ? {reason: "superseded", requestedAt: outputClock()} : {})};
			const requestDigest = (operation === "cancel" ? agentRunCancellationRequestDigest : agentRunInspectRequestDigest)(draft).value;
			const denied = await host.execute({protocol: PI_EXECUTION_HOST_PROTOCOL, operation, input: {...draft, requestDigest}});
			assert.equal(denied.error.code, "stale_authorization");
			assert.equal("value" in denied, false, "The host must not disclose a handle and rely on adapter rejection");
		}
		const draft = {runId: auth.runId, authorizationDigest: auth.authorizationDigest, requestDigest: digest("0")};
		const inspected = await runtime.inspect({...draft, requestDigest: agentRunInspectRequestDigest(draft).value});
		assert.equal(inspected.value.status, "running", "Wrong authorization must not abort or change status");
		const pendingRequest = createAgentRunOutputRequest({runId: auth.runId, authorizationDigest: auth.authorizationDigest, receiptDigest: digest("1")});
		assert.equal(pendingRequest.ok, true);
		const pending = await host.readOutput(pendingRequest.value);
		assert.equal(pending.error.code, "quiescence_unproven");
		release();
		const result = await starting;
		assert.equal(result.ok, true);
		assert.equal(result.value.receipt.outcome, "completed");
		assert.equal(result.value.receipt.cancellationDigest, null);
	} finally {release(); if (starting) await starting; await rm(root, {recursive: true, force: true});}
});

test("Pi output capability returns exact completed bytes without changing historical handles", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-host-output-"));
	try {
		const host = createLocalPiExecutionHost({custodyRoot: root, providerInstaller: scriptedInstaller, clock: outputClock}).value;
		const runtime = createPiAgentRuntime(host).value, reader = createPiAgentOutputReader(host).value, auth = authorization();
		const handle = (await runtime.start(startRequest(auth))).value;
		assert.deepEqual(Object.keys(handle).sort(), ["authorizationDigest", "quiescence", "receipt", "runId", "status"]);
		const result = await readAuthorizedAgentRunOutput(reader, auth, handle);
		assert.equal(result.ok, true, JSON.stringify(result.error));
		assert.equal(result.value.text, "Pi vertical slice complete.");
		assert.equal(result.value.outputDigest, handle.receipt.outputDigest);
		assert.deepEqual((await readAuthorizedAgentRunOutput(reader, auth, handle)).value, result.value);
		assert.ok(Object.isFrozen(result.value));
		for (const [patch, code] of [[{authorizationDigest: digest("f")}, "stale_authorization"], [{receiptDigest: digest("f")}, "invalid_receipt"], [{runId: "cw:run:absent"}, "not_found"]]) {
			assert.equal((await host.readOutput(outputRequest(auth, handle, patch))).error.code, code);
		}
		let accessed = 0;
		const hostile = Object.defineProperty({}, "runId", {get() {accessed++; throw new Error("must not run");}});
		assert.equal((await host.readOutput(hostile)).error.code, "invalid_request");
		assert.equal(accessed, 0);
		const freshHost = createLocalPiExecutionHost({custodyRoot: root, providerInstaller: scriptedInstaller, clock: outputClock}).value;
		assert.equal((await freshHost.readOutput(outputRequest(auth, handle))).error.code, "not_found", "Session logs are not implicitly promoted into retained output evidence");
	} finally {await rm(root, {recursive: true, force: true});}
});

test("Pi output custody bounds evict bytes without rerunning or replacing receipts", async () => {
	for (const maximumRetainedOutputBytes of [1, Buffer.byteLength("Pi vertical slice complete.")]) {
		const root = await mkdtemp(join(tmpdir(), "codewiki-host-output-bound-"));
		try {
			let calls = 0;
			const host = createLocalPiExecutionHost({custodyRoot: root, clock: outputClock, maximumRetainedOutputBytes,
				providerInstaller: (auth, signal) => {calls++; return scriptedInstaller(auth, signal);}}).value;
			const runtime = createPiAgentRuntime(host).value;
			const firstAuth = authorization(), secondAuth = authorization({actorId: "cw:actor:other"});
			const first = (await runtime.start(startRequest(firstAuth))).value;
			if (maximumRetainedOutputBytes > 1) assert.equal((await host.readOutput(outputRequest(firstAuth, first))).ok, true);
			const second = (await runtime.start(startRequest(secondAuth))).value;
			assert.equal((await host.readOutput(outputRequest(firstAuth, first))).error.code, "not_found");
			assert.equal((await host.readOutput(outputRequest(secondAuth, second))).ok, maximumRetainedOutputBytes > 1);
			assert.deepEqual((await runtime.start(startRequest(firstAuth))).value, first);
			assert.equal((await host.readOutput(outputRequest(firstAuth, first))).error.code, "not_found");
			assert.equal(calls, 2, "Missing output does not authorize another provider call");
		} finally {await rm(root, {recursive: true, force: true});}
	}
});

function inspectRequest(auth) {
	const draft = {requestDigest: digest("0"), runId: auth.runId, authorizationDigest: auth.authorizationDigest};
	return {...draft, requestDigest: agentRunInspectRequestDigest(draft).value};
}
function deferred() {
	let resolve;
	const promise = new Promise(done => {resolve = done;});
	return {promise, resolve};
}

test("host time admission rejects future, expired and malformed clocks before provider effects", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-host-time-admission-"));
	try {
		for (const [now, code] of [["2026-09-05T04:59:59.999Z", "stale_authorization"], ["2026-09-05T05:02:00.000Z", "stale_authorization"], ["2026-09-05T05:02:00.001Z", "stale_authorization"], ["bad-clock", "environment_unavailable"]]) {
			let calls = 0;
			const host = createLocalPiExecutionHost({custodyRoot: root, clock: () => now,
				providerInstaller: () => {calls++; throw new Error("must not install");}}).value;
			const runtime = createPiAgentRuntime(host).value, auth = authorization();
			assert.equal((await runtime.start(startRequest(auth))).error.code, code);
			assert.equal((await runtime.inspect(inspectRequest(auth))).error.code, "not_found");
			assert.equal(calls, 0);
		}
	} finally {await rm(root, {recursive: true, force: true});}
});

test("host timeout during provider setup preserves unknown custody and prevents a later model call or relaunch", async t => {
	t.mock.timers.enable({apis: ["setTimeout"]});
	const root = await mkdtemp(join(tmpdir(), "codewiki-host-setup-timeout-"));
	const entered = deferred(), release = deferred();
	let starting;
	try {
		let calls = 0, now = outputClock();
		const auth = authorizationWithBudget({timeoutMs: 1000});
		const host = createLocalPiExecutionHost({custodyRoot: root, clock: () => now,
			providerInstaller: async () => {
				calls++; entered.resolve(); await release.promise;
				// No provider is installed. A model call after cancellation would fail.
				return {providerReceiptDigest: null, dispose() {}};
			}}).value;
		const runtime = createPiAgentRuntime(host).value;
		starting = runtime.start(startRequest(auth));
		await entered.promise;
		t.mock.timers.tick(999);
		assert.equal((await runtime.inspect(inspectRequest(auth))).value.status, "running");
		now = "2026-09-05T05:01:01.000Z";
		t.mock.timers.tick(1);
		const pending = (await runtime.inspect(inspectRequest(auth))).value;
		assert.equal(pending.status, "cancelling");
		assert.equal(pending.receipt, null);
		assert.equal(pending.quiescence, null);
		release.resolve();
		const result = await starting;
		assert.equal(result.error.code, "environment_unavailable");
		assert.match(result.error.message, /cancelled before model execution/u);
		const retry = (await runtime.start(startRequest(auth))).value;
		assert.equal(retry.status, "cancelling");
		assert.equal(retry.receipt, null);
		assert.equal(calls, 1);
	} finally {release.resolve(); if (starting) await starting; t.mock.timers.reset(); await rm(root, {recursive: true, force: true});}
});

for (const cause of ["timeout", "deadline", "late-observation"]) test(`host ${cause} during cleanup cannot publish completed output or premature closure`, async t => {
	t.mock.timers.enable({apis: ["setTimeout"]});
	const root = await mkdtemp(join(tmpdir(), "codewiki-host-cleanup-timeout-"));
	const entered = deferred(), release = deferred();
	let starting;
	try {
		let now = outputClock();
		const auth = cause === "deadline" ? authorization() : authorizationWithBudget({timeoutMs: 1000});
		const host = createLocalPiExecutionHost({custodyRoot: root, clock: () => now,
			providerInstaller: (auth, signal) => {
				const lease = scriptedInstaller(auth, signal);
				return {...lease, async dispose() {entered.resolve(); await release.promise; await lease.dispose();}};
			}}).value;
		const runtime = createPiAgentRuntime(host).value;
		starting = runtime.start(startRequest(auth));
		await entered.promise;
		assert.equal((await runtime.inspect(inspectRequest(auth))).value.receipt, null);
		now = cause === "deadline" ? auth.deadlineAt : "2026-09-05T05:01:01.000Z";
		if (cause !== "late-observation") {
			t.mock.timers.tick(cause === "deadline" ? 60_000 : 1000);
			const pending = (await runtime.inspect(inspectRequest(auth))).value;
			assert.equal(pending.status, "cancelling");
			assert.equal(pending.quiescence, null);
		}
		release.resolve();
		const result = await starting;
		assert.equal(result.ok, true, JSON.stringify(result.error));
		assert.equal(result.value.receipt.outcome, "cancelled");
		assert.equal(result.value.receipt.outputDigest, null);
		assert.equal(result.value.quiescence.observedAt, now, "Closure is observed after disposal, not backdated to model completion");
		const cancellation = {requestDigest: digest("0"), runId: auth.runId, authorizationDigest: auth.authorizationDigest, reason: "deadline", requestedAt: now};
		assert.equal(result.value.receipt.cancellationDigest, agentRunCancellationRequestDigest(cancellation).value);
		assert.equal((await host.readOutput(outputRequest(auth, result.value))).error.code, "invalid_receipt");
		assert.deepEqual((await runtime.start(startRequest(auth))).value, result.value);
	} finally {release.resolve(); if (starting) await starting; t.mock.timers.reset(); await rm(root, {recursive: true, force: true});}
});

test("host retains failed custody and refuses new work instead of forgetting a possibly active execution", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-host-uncertain-"));
	try {
		let calls = 0;
		const host = createLocalPiExecutionHost({custodyRoot: root, clock: outputClock, maximumConcurrentRuns: 1, maximumTrackedRuns: 1,
			providerInstaller: () => {calls++; throw new Error("uncertain provider setup");}}).value;
		const runtime = createPiAgentRuntime(host).value, auth = authorization();
		assert.equal((await runtime.start(startRequest(auth))).error.code, "environment_unavailable");
		const retry = (await runtime.start(startRequest(auth))).value;
		assert.equal(retry.status, "cancelling");
		assert.equal(retry.receipt, null);
		assert.equal((await runtime.start(startRequest(authorization({actorId: "cw:actor:another"})))).error.code, "authorization_conflict");
		assert.equal(calls, 1);
	} finally {await rm(root, {recursive: true, force: true});}
});

test("host preserves completed identities at the tracking bound and replays them after authorization expiry", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-host-tracked-bound-"));
	try {
		let calls = 0, now = "2026-09-05T05:00:00.000Z";
		const host = createLocalPiExecutionHost({custodyRoot: root, clock: () => now, maximumConcurrentRuns: 1, maximumTrackedRuns: 1,
			providerInstaller: (auth, signal) => {calls++; return scriptedInstaller(auth, signal);}}).value;
		const runtime = createPiAgentRuntime(host).value, auth = authorization();
		const first = await runtime.start(startRequest(auth));
		assert.equal(first.value.receipt.outcome, "completed", "The exact issuance boundary is admissible");
		assert.equal((await runtime.start(startRequest(authorization({actorId: "cw:actor:another"})))).error.code, "authorization_conflict");
		now = "2026-09-05T05:03:00.000Z";
		assert.deepEqual(await runtime.start(startRequest(auth)), first);
		assert.equal(calls, 1);
	} finally {await rm(root, {recursive: true, force: true});}
});

test("timeout during harness mounting prevents provider installation", async t => {
	t.mock.timers.enable({apis: ["setTimeout"]});
	const root = await mkdtemp(join(tmpdir(), "codewiki-host-mount-timeout-"));
	try {
		let calls = 0;
		const host = createLocalPiExecutionHost({custodyRoot: root, clock: outputClock,
			providerInstaller: () => {calls++; throw new Error("must not install");}}).value;
		const runtime = createPiAgentRuntime(host).value, auth = authorizationWithBudget({timeoutMs: 1000});
		const starting = runtime.start(startRequest(auth));
		t.mock.timers.tick(1000);
		const result = await starting;
		assert.equal(result.error.code, "environment_unavailable");
		assert.match(result.error.message, /cancelled before provider installation/u);
		assert.equal(calls, 0);
		assert.equal((await runtime.inspect(inspectRequest(auth))).value.status, "cancelling");
	} finally {t.mock.timers.reset(); await rm(root, {recursive: true, force: true});}
});

test("deadline cancellation preserves the first explicit cancellation binding", async t => {
	t.mock.timers.enable({apis: ["setTimeout"]});
	const root = await mkdtemp(join(tmpdir(), "codewiki-host-cancel-order-"));
	const entered = deferred(), release = deferred();
	let starting;
	try {
		const auth = authorizationWithBudget({timeoutMs: 1000});
		const host = createLocalPiExecutionHost({custodyRoot: root, clock: outputClock,
			providerInstaller: (auth, signal) => {
				const lease = scriptedInstaller(auth, signal);
				return {...lease, async dispose() {entered.resolve(); await release.promise; await lease.dispose();}};
			}}).value;
		const runtime = createPiAgentRuntime(host).value;
		starting = runtime.start(startRequest(auth));
		await entered.promise;
		const body = {...inspectRequest(auth), reason: "operator", requestedAt: outputClock()};
		const request = {...body, requestDigest: agentRunCancellationRequestDigest(body).value};
		assert.equal((await runtime.cancel(request)).value.status, "cancelling");
		t.mock.timers.tick(1000);
		release.resolve();
		const result = await starting;
		assert.equal(result.value.receipt.outcome, "cancelled");
		assert.equal(result.value.receipt.cancellationDigest, request.requestDigest);
	} finally {release.resolve(); if (starting) await starting; t.mock.timers.reset(); await rm(root, {recursive: true, force: true});}
});
