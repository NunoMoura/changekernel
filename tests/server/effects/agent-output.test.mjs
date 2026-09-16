import assert from "node:assert/strict";
import test from "node:test";
import {AGENT_RUN_OUTPUT_PORT_PROTOCOL, AGENT_RUN_OUTPUT_PROTOCOL, MAXIMUM_AGENT_OUTPUT_BYTES, createAgentRunOutputRequest, decodeAgentRunOutput, decodeAgentRunOutputRequest, decodeAgentRunOutputResponse, verifyAgentRunOutput} from "../../../src/ports/agent-output.ts";
import {createAgentRunAuthorization, createAgentRunQuiescence, createAgentRunReceipt} from "../../../src/ports/agent-runtime.ts";
import {readAuthorizedAgentRunOutput, readDecisionModelCheckOutput} from "../../../src/server/effects/agent-output.ts";
import {DECISION_MODEL_CHECK_EXECUTION, DECISION_MODEL_CHECK_EXECUTION_DIGEST} from "../../../src/server/effects/agent-runs.ts";
import {DECISION_CHECK_OUTPUT_PROTOCOL} from "../../../src/kernel/gates/semantic.ts";
import {canonicalJson} from "../../../src/kernel/data-contracts/canonical-json.ts";
import {createDshAgentOutputReader, DSH_EXECUTION_OUTPUT_HOST_PROTOCOL} from "../../../src/adapters/dsh/agent-output.ts";
import {gitOid} from "../../../src/kernel/identity/git.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";

const admitted = result => {assert.equal(result.ok, true, JSON.stringify(result.error)); return result.value;};
const digest = char => `sha256:${char.repeat(64)}`;
const semantic = (domain, value) => admitted(semanticDigest(domain, value));
const oid = char => admitted(gitOid("sha1", char.repeat(40)));
function bundle({text = '{"finding":"unresolved"}', authorizationPatch = {}, receiptPatch = {}, quiescencePatch = {}} = {}) {
	const route = {routeId: "cw:route:decision", providerId: "cw:provider:replay", modelId: "cw:model:replay"};
	const authorization = admitted(createAgentRunAuthorization({
		attempt: 1, role: "decision", stage: "decision", actorId: "cw:actor:test", authorityDigest: digest("1"),
		subject: {subjectId: "cw:subject:change", subjectDigest: digest("2"), repositoryId: "cw:repository:test", projectCommit: oid("1"), projectTree: oid("2"), changeId: "CHG-output", changeTip: oid("3"), workId: null, artifactCommit: null, artifactTree: null},
		route: {...route, routeDigest: semantic("codewiki.agent-route@1.0.0", route)},
		context: {wikiCommit: oid("3"), itemIds: [], contextDigest: digest("3"), queryPolicyDigest: digest("4"), feedbackDigest: null},
		toolIds: [], toolSetDigest: semantic("codewiki.agent-tool-set@1.0.0", {toolIds: []}), capabilities: [], writableScope: [], previewSubjectDigest: null,
		budget: {timeoutMs: 60_000, maximumModelRequests: 1, maximumToolCalls: 0, maximumInputTokens: 1000, maximumOutputTokens: 1000, maximumOutputBytes: MAXIMUM_AGENT_OUTPUT_BYTES},
		outputSchemaDigest: digest("5"), policyDigest: digest("6"), issuedAt: "2026-09-05T05:00:00.000Z", deadlineAt: "2026-09-05T05:01:00.000Z", predecessor: null,
		...authorizationPatch,
	}));
	const quiescence = admitted(createAgentRunQuiescence({runId: authorization.runId, authorizationDigest: authorization.authorizationDigest,
		observedAt: "2026-09-05T05:01:01.000Z", processTreeTerminated: true, providerRequestsClosed: true, previewClosed: true, temporaryStateClosed: true, ...quiescencePatch}));
	const outputDigest = semantic("codewiki.agent-output@1.0.0", {text});
	const receipt = admitted(createAgentRunReceipt({runId: authorization.runId, authorizationDigest: authorization.authorizationDigest, outcome: "completed",
		startedAt: "2026-09-05T05:00:01.000Z", finishedAt: "2026-09-05T05:01:00.000Z", outputDigest, usageDigest: digest("7"), providerReceiptDigest: digest("8"), sessionReceiptDigest: digest("9"), queryReceiptDigests: [], cancellationDigest: null,
		custody: {processTreeTerminated: true, providerRequestsClosed: true, previewClosed: true, temporaryStateClosed: true, quiescenceDigest: quiescence.quiescenceDigest}, operationalGaps: [], ...receiptPatch}));
	const handle = {runId: authorization.runId, authorizationDigest: authorization.authorizationDigest, status: "terminal", receipt, quiescence};
	const output = {protocol: AGENT_RUN_OUTPUT_PROTOCOL, runId: authorization.runId, authorizationDigest: authorization.authorizationDigest, receiptDigest: receipt.receiptDigest, outputDigest, text};
	return {authorization, handle, output};
}
const outputPort = read => ({protocol: AGENT_RUN_OUTPUT_PORT_PROTOCOL, read});
const requestFor = value => admitted(createAgentRunOutputRequest({runId: value.authorization.runId, authorizationDigest: value.authorization.authorizationDigest, receiptDigest: value.handle.receipt.receiptDigest}));

test("output contract binds exact receipt and text without converting text into a semantic finding", async () => {
	const value = bundle(), request = requestFor(value);
	assert.deepEqual(admitted(decodeAgentRunOutputRequest(request)), request);
	assert.deepEqual(admitted(verifyAgentRunOutput(value)), value.output);
	let calls = 0;
	const result = await readAuthorizedAgentRunOutput(outputPort(async actual => {calls++; assert.deepEqual(actual, request); return {ok: true, value: value.output};}), value.authorization, value.handle);
	assert.deepEqual(admitted(result), value.output);
	assert.equal(calls, 1);
	assert.equal("finding" in result.value, false);
	assert.ok(Object.isFrozen(result.value));
	assert.notEqual(result.value, value.output);
});

test("output request and response reject substitutions, tampering and extra fields", () => {
	const value = bundle(), request = requestFor(value);
	for (const field of ["authorizationDigest", "receiptDigest", "requestDigest"]) assert.equal(decodeAgentRunOutputRequest({...request, [field]: digest("f")}).ok, false);
	assert.equal(decodeAgentRunOutputRequest({...request, contextComplete: true}).ok, false);
	for (const patch of [{text: "forged"}, {outputDigest: digest("f")}, {protocol: {...AGENT_RUN_OUTPUT_PROTOCOL, version: "2.0.0"}}, {verdict: "approved"}]) assert.equal(decodeAgentRunOutput({...value.output, ...patch}).ok, false);
	for (const field of ["authorizationDigest", "receiptDigest", "runId"]) {
		const output = {...value.output, [field]: field === "runId" ? "cw:run:another" : digest("f")};
		assert.equal(verifyAgentRunOutput({...value, output}).ok, false);
	}
	const text = "forged", forged = {...value.output, text, outputDigest: semantic("codewiki.agent-output@1.0.0", {text})};
	assert.equal(decodeAgentRunOutput(forged).ok, true, "Self-consistency is not provenance");
	assert.equal(verifyAgentRunOutput({...value, output: forged}).ok, false);
});

test("nonterminal, mismatched and forged custody handles fail before any output lookup", async () => {
	const value = bundle(); let calls = 0;
	const port = outputPort(async () => {calls++; throw new Error("must not read");});
	const wrongQuiescence = bundle({quiescencePatch: {runId: "cw:run:other"}});
	for (const candidate of [
		{...value, handle: {...value.handle, status: "running"}},
		{...value, handle: {...value.handle, runId: "cw:run:other"}},
		{...value, handle: {...value.handle, receipt: null}},
		{...value, handle: {...value.handle, quiescence: {...value.handle.quiescence, observedAt: "2026-09-05T05:01:02.000Z"}}},
		wrongQuiescence,
		bundle({receiptPatch: {outcome: "cancelled", outputDigest: null}}),
	]) {
		assert.equal(verifyAgentRunOutput(candidate).ok, false);
		assert.equal((await readAuthorizedAgentRunOutput(port, candidate.authorization, candidate.handle)).error.code, "invalid_receipt");
	}
	assert.equal(calls, 0);
});

test("execution window and custody timing are checked even when receipts are rehashed", async () => {
	for (const options of [
		{receiptPatch: {startedAt: "2026-09-05T04:59:59.000Z"}},
		{receiptPatch: {finishedAt: "2026-09-05T05:01:01.000Z"}},
		{quiescencePatch: {observedAt: "2026-09-05T05:00:59.000Z"}},
		{authorizationPatch: {budget: {...bundle().authorization.budget, timeoutMs: 1000}}},
	]) {
		const value = bundle(options); let calls = 0;
		const result = await readAuthorizedAgentRunOutput(outputPort(async () => {calls++; return {ok: true, value: value.output};}), value.authorization, value.handle);
		assert.equal(result.error.code, "invalid_receipt");
		assert.equal(calls, 0);
	}
	assert.equal(verifyAgentRunOutput(bundle({receiptPatch: {startedAt: "2026-09-05T05:00:00.000Z"}})).ok, true, "Exact boundaries are admitted");
});

test("output limits count UTF-8 bytes, reject overflow and never normalize or truncate text", () => {
	const base = bundle();
	const small = bundle({text: "éé", authorizationPatch: {budget: {...base.authorization.budget, maximumOutputBytes: 3}}});
	assert.equal(verifyAgentRunOutput(small).ok, false);
	const boundary = bundle({text: "x".repeat(MAXIMUM_AGENT_OUTPUT_BYTES)});
	assert.equal(verifyAgentRunOutput(boundary).ok, true);
	assert.equal(decodeAgentRunOutput({...boundary.output, text: boundary.output.text + "x"}).ok, false);
	assert.equal(decodeAgentRunOutput({...base.output, text: "e\u0301"}).ok, false, "Historical agent-output digest requires canonical text; do not silently normalize bytes");
});

test("hostile own data and malformed failure envelopes never invoke accessors", async () => {
	let accessed = 0;
	const accessor = Object.defineProperty({}, "ok", {enumerable: true, get() {accessed++; throw new Error("must not run");}});
	const cyclic = {}; cyclic.self = cyclic;
	const value = bundle();
	for (const raw of [null, undefined, cyclic, accessor, {ok: false, error: {code: "invented", message: "bad"}}, {ok: true, value: value.output, extra: true}, {ok: "true", value: value.output}]) {
		assert.equal(decodeAgentRunOutputResponse(raw).error.code, "invalid_receipt");
		assert.equal((await readAuthorizedAgentRunOutput(outputPort(async () => raw), value.authorization, value.handle)).error.code, "invalid_receipt");
	}
	const hostileHandle = Object.defineProperty({}, "receipt", {enumerable: true, get() {accessed++; throw new Error("must not run");}});
	assert.equal((await readAuthorizedAgentRunOutput(outputPort(async () => {throw new Error("must not read");}), value.authorization, hostileHandle)).error.code, "invalid_receipt");
	assert.equal(accessed, 0);
});

test("missing output capability, custody loss and transport loss remain explicit failures", async () => {
	const value = bundle();
	assert.equal((await readAuthorizedAgentRunOutput({}, value.authorization, value.handle)).error.code, "environment_unavailable");
	for (const code of ["not_found", "transport_lost", "quiescence_unproven"]) {
		const result = await readAuthorizedAgentRunOutput(outputPort(async () => ({ok: false, error: {code, message: "Unavailable"}})), value.authorization, value.handle);
		assert.equal(result.error.code, code);
	}
	assert.equal((await readAuthorizedAgentRunOutput(outputPort(async () => {throw new Error("lost");}), value.authorization, value.handle)).error.code, "transport_lost");
});

test("output lookup snapshots authority and receipt bindings before awaiting external code", async () => {
	const original = bundle(), mutable = structuredClone(original);
	const result = await readAuthorizedAgentRunOutput(outputPort(async () => {
		mutable.authorization.subject.subjectDigest = digest("f");
		mutable.handle.receipt.receiptDigest = digest("f");
		return {ok: true, value: original.output};
	}), mutable.authorization, mutable.handle);
	assert.deepEqual(admitted(result), original.output);
});

test("DSH optional reader validates its protocol, request and output receipt independently", async () => {
	assert.equal(createDshAgentOutputReader({outputProtocol: {id: "wrong", version: "1.0.0"}, readOutput: async () => null}).ok, false);
	const value = bundle(); let calls = 0;
	const host = {outputProtocol: DSH_EXECUTION_OUTPUT_HOST_PROTOCOL, readOutput: async () => {calls++; return {ok: true, value: value.output};}};
	const reader = admitted(createDshAgentOutputReader(host));
	assert.equal((await reader.read({...requestFor(value), requestDigest: digest("f")})).error.code, "invalid_request");
	assert.equal(calls, 0);
	assert.deepEqual(admitted(await reader.read(requestFor(value))), value.output);
	const otherReceipt = admitted(createAgentRunOutputRequest({runId: value.authorization.runId, authorizationDigest: value.authorization.authorizationDigest, receiptDigest: digest("f")}));
	assert.equal((await reader.read(otherReceipt)).error.code, "invalid_receipt");
	host.readOutput = async () => {throw new Error("lost");};
	assert.equal((await reader.read(requestFor(value))).error.code, "transport_lost");
});

function checkBundle({draftPatch = {}, authorizationPatch = {}} = {}) {
	const draft = {protocol: DECISION_CHECK_OUTPUT_PROTOCOL, status: "unresolved", reason: "Required behavior evidence is absent.", assumptions: [], citations: [], ...draftPatch};
	return bundle({text: admitted(canonicalJson(draft)), authorizationPatch: {
		role: "model-check", budget: DECISION_MODEL_CHECK_EXECUTION.budget,
		outputSchemaDigest: DECISION_MODEL_CHECK_EXECUTION.outputSchemaDigest,
		policyDigest: DECISION_MODEL_CHECK_EXECUTION_DIGEST, ...authorizationPatch,
	}});
}
test("Decision model check decodes receipt-bound Check output, not a finding", async () => {
	const value = checkBundle();
	const result = admitted(await readDecisionModelCheckOutput(outputPort(async () => ({ok: true, value: value.output})), value.authorization, value.handle));
	assert.equal(result.checkOutput.status, "unresolved");
	assert.equal(result.output.receiptDigest, value.handle.receipt.receiptDigest);
	assert.equal("findingDigest" in result.checkOutput, false);
	assert.equal("contextComplete" in result.checkOutput, false);
	assert.ok(Object.isFrozen(result) && Object.isFrozen(result.checkOutput));
});
test("Decision Check output reader rejects incompatible or forged execution contracts before retrieving output", async () => {
	let calls = 0;
	for (const value of [bundle(), checkBundle({authorizationPatch: {outputSchemaDigest: digest("f")}}),
		checkBundle({authorizationPatch: {budget: {...DECISION_MODEL_CHECK_EXECUTION.budget, maximumModelRequests: 3}}}),
		checkBundle({authorizationPatch: {policyDigest: digest("f")}})]) {
		const result = await readDecisionModelCheckOutput(outputPort(async () => {calls++; return {ok: true, value: value.output};}), value.authorization, value.handle);
		assert.equal(result.error.code, "invalid_request");
	}
	assert.equal(calls, 0);
});
test("Decision Check output parser does not convert malformed output into a semantic contradiction", async () => {
	const value = checkBundle({draftPatch: {status: "passed"}});
	const result = await readDecisionModelCheckOutput(outputPort(async () => ({ok: true, value: value.output})), value.authorization, value.handle);
	assert.equal(result.error.code, "invalid_receipt");
	assert.equal("value" in result, false);
});
