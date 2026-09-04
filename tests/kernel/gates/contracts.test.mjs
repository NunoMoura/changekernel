import assert from "node:assert/strict";
import test from "node:test";
import {createEvidenceReference} from "../../../src/kernel/evidence/reference.ts";
import {
	checkRunIdentity,
	createCheckRegistration,
	createCheckRun,
	createGate,
	createGateSubject,
	createResult,
	decodeCheckRegistration,
	decodeCheckRun,
	decodeGate,
	decodeResult,
} from "../../../src/kernel/gates/contracts.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {checkDefinitionFixture} from "./check-definition.test.mjs";

export const digest = (character) => `sha256:${character.repeat(64)}`;
export const oid = (character) => ({algorithm: "sha1", hex: character.repeat(40)});

export function subjectFixture(overrides = {}) {
	const result = createGateSubject({
		kind: "change",
		repositoryId: "cw:repository:test",
		changeId: "CHG-test-semantic-kernel",
		workId: null,
		projectCommit: oid("1"),
		projectTree: oid("2"),
		changeTip: oid("3"),
		artifactCommit: null,
		artifactTree: null,
		facts: {"codewiki.subject:safety-critical": true},
		subjectDigest: digest("4"),
		...overrides,
	});
	assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
	return result.value;
}

export function registrationFixture(overrides = {}) {
	const result = createCheckRegistration({
		source: "product",
		packId: "semantic-kernel",
		stage: "decision",
		enforcement: "required",
		universalSafety: false,
		applicability: {changeTypes: [], realizations: [], subjectKinds: [], workTypes: [], facts: {}},
		definition: checkDefinitionFixture(),
		...overrides,
	});
	assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
	return result.value;
}

export function gateFixture(overrides = {}) {
	const subject = overrides.subject ?? subjectFixture();
	const activeChecks = overrides.activeChecks ?? [registrationFixture()];
	const result = createGate({
		stage: "decision",
		subject,
		selectionInputs: {changeType: "correction", realization: "project", workType: subject.kind === "work" ? "codewiki.work:source" : null, enabledProjectPacks: []},
		availablePolicyDigest: digest("4"),
		resolver: {id: "codewiki:active-check-resolver", version: "1.0.0"},
		activeChecks,
		inputs: overrides.inputs ?? [{source: "subject", ref: "cw:gate-input:subject", digest: subject.subjectDigest}],
		omissions: [],
		selectionComplete: true,
		kernelBuildDigest: digest("5"),
		...overrides,
	});
	assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
	return result.value;
}

function receiptFixture(subjectDigest, id = "execution") {
	const result = createEvidenceReference({
		evidenceId: `cw:evidence:${id}`,
		evidenceDigest: digest("6"),
		schema: {id: "codewiki.execution-receipt", version: "1.0.0"},
		mediaType: "application/json",
		subjectDigest,
		subjectOids: [],
		materialDigests: [],
		producerId: "cw:actor:check-runner",
		method: "codewiki.method:local-process",
		receiptDigest: digest("7"),
		authority: "observed",
		coverage: "complete",
		freshness: "current",
		capturePolicy: "metadata_only",
		retentionPolicy: "pinned",
		limitations: [],
	});
	assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
	return result.value;
}

export function completedRunFixture(gate = gateFixture(), registration = gate.activeChecks[0], overrides = {}) {
	const execution = {kind: "code", executorId: "check-runner", executorVersion: "1.0.0", profile: "bounded", route: null, configurationDigest: digest("8")};
	const executionDigest = semanticDigest("codewiki.check-execution@1.0.0", execution).value;
	const runId = checkRunIdentity(gate.gateDigest, registration.registrationDigest, 1).value;
	const resultValue = createResult({
		gateDigest: gate.gateDigest,
		runId,
		subjectDigest: gate.subject.subjectDigest,
		registrationDigest: registration.registrationDigest,
		definitionDigest: registration.definitionDigest,
		inputs: gate.inputs,
		measurement: {kind: "binary", value: true},
		evidence: [],
		executionDigest,
		status: "passed",
		summary: "Passed.",
		details: [],
		failure: null,
		...overrides.result,
	});
	assert.equal(resultValue.ok, true, resultValue.ok ? undefined : resultValue.error.message);
	const run = createCheckRun({
		gateDigest: gate.gateDigest,
		subjectDigest: gate.subject.subjectDigest,
		registrationDigest: registration.registrationDigest,
		definitionDigest: registration.definitionDigest,
		inputs: gate.inputs,
		execution,
		attempt: 1,
		predecessorRunDigest: null,
		quiescenceReceipt: null,
		status: "completed",
		resultDigest: resultValue.value.resultDigest,
		executionReceipt: receiptFixture(gate.subject.subjectDigest),
		...overrides.run,
	});
	assert.equal(run.ok, true, run.ok ? undefined : run.error.message);
	return {run: run.value, result: resultValue.value};
}

test("Gate, Check Run, and Result contracts bind exact frozen identities", () => {
	const gate = gateFixture();
	const {run, result} = completedRunFixture(gate);
	assert.equal(decodeGate(gate).ok, true);
	assert.equal(decodeCheckRun(run).ok, true);
	assert.equal(decodeResult(result).ok, true);
	assert.equal(run.resultDigest, result.resultDigest);
	assert.equal(result.runId, run.runId);
});

test("Gate subject retains exact lifecycle semantic digest", () => {
	const semanticSubject = digest("a");
	const subject = subjectFixture({subjectDigest: semanticSubject});
	assert.equal(subject.subjectDigest, semanticSubject);
	const first = gateFixture({subject});
	const second = gateFixture({subject: subjectFixture({projectTree: oid("f"), subjectDigest: semanticSubject})});
	assert.notEqual(first.gateDigest, second.gateDigest);
});

test("Gate contract rejects stale digest, mixed stage, and unknown authority fields", () => {
	const gate = gateFixture();
	assert.equal(decodeGate({...gate, gateDigest: digest("f")}).ok, false);
	const wrongStage = registrationFixture({stage: "review"});
	assert.equal(createGate({...gate, activeChecks: [wrongStage], gateId: undefined, protocol: undefined, gateDigest: undefined}).ok, false);
	assert.equal(decodeGate({...gate, disposition: "approve"}).ok, false);
});

test("Gate input references bind source, opaque ref, and digest in canonical order", () => {
	const inputs = [
		{source: "evidence", ref: "cw:evidence:one", digest: digest("1")},
		{source: "repository", ref: "src/index.ts", digest: digest("2")},
	];
	const gate = gateFixture({inputs});
	assert.deepEqual(gate.inputs, inputs);
	assert.equal(createGateBody({...gate, inputs: [...inputs].reverse()}).ok, false);
	assert.equal(createGateBody({...gate, inputs: [{source: "repository", ref: "https://example.invalid", digest: digest("2")}]}).ok, false);
});

test("Check registration rejects definition forgery and Domain identity", () => {
	const registration = registrationFixture();
	assert.equal(decodeCheckRegistration({...registration, definitionDigest: digest("f")}).ok, false);
	assert.equal(decodeCheckRegistration({...registration, domainId: "software-development"}).ok, false);
});

test("Check Run retry and Result status contracts fail closed", () => {
	const gate = gateFixture();
	const {run, result} = completedRunFixture(gate);
	assert.equal(decodeCheckRun({...run, attempt: 2}).ok, false);
	assert.equal(decodeCheckRun({...run, status: "error", resultDigest: result.resultDigest}).ok, false);
	assert.equal(decodeResult({...result, status: "failed", failure: null}).ok, false);
	assert.equal(decodeResult({...result, runId: "cw:check-run:forged"}).ok, false);
});

function createGateBody(gate) {
	const {protocol, gateId, gateDigest, ...body} = gate;
	void protocol;
	void gateId;
	void gateDigest;
	return createGate(body);
}
