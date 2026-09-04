import assert from "node:assert/strict";
import test from "node:test";
import {createProjectSnapshot} from "../../../src/kernel/changes/snapshot.ts";
import {reduceChangeTrace} from "../../../src/kernel/changes/reducer.ts";
import {createEvidenceReference} from "../../../src/kernel/evidence/reference.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {deriveWorkState} from "../../../src/kernel/work/state.ts";
import {changeFixture} from "../changes/contracts.test.mjs";
import {digest, oid} from "../changes/events.test.mjs";
import {validTrace} from "../changes/reducer.test.mjs";
import {completedRunFixture, gateFixture, registrationFixture, subjectFixture} from "../gates/contracts.test.mjs";

function projectFixture() {
	const result = createProjectSnapshot({repositoryId: "cw:repository:test", objectFormat: "sha1", commit: oid("1"), tree: oid("2"), parents: [oid("3")], complete: true});
	assert.equal(result.ok, true);
	return result.value;
}

function evidenceFixture(receiptDigest, evidenceId = `cw:evidence:${receiptDigest.slice(-8)}`) {
	const result = createEvidenceReference({
		evidenceId,
		evidenceDigest: digest("1"),
		schema: {id: "codewiki.receipt", version: "1.0.0"},
		mediaType: "application/json",
		subjectDigest: digest("2"),
		subjectOids: [],
		materialDigests: [],
		producerId: "cw:authority:project-server",
		method: "codewiki.method:receipt",
		receiptDigest,
		authority: "observed",
		coverage: "complete",
		freshness: "current",
		capturePolicy: "metadata_only",
		retentionPolicy: "pinned",
		limitations: [],
	});
	assert.equal(result.ok, true);
	return result.value;
}

function planningGate(kernelBuildDigest = digest("f")) {
	const subject = subjectFixture({
		kind: "plan",
		projectCommit: oid("1"),
		projectTree: oid("2"),
		changeTip: oid("9"),
		facts: {},
		subjectDigest: digest("d"),
	});
	return gateFixture({
		stage: "planning",
		subject,
		activeChecks: [registrationFixture({stage: "planning"})],
		kernelBuildDigest,
	});
}

function recordedGate(gate, outcomeDigest, resultDigests = [], runDigests = []) {
	return Object.freeze({
		gateDigest: gate.gateDigest,
		outcomeDigest,
		stage: gate.stage,
		status: "passed",
		subjectDigest: gate.subject.subjectDigest,
		workId: null,
		runDigests: Object.freeze(runDigests),
		resultDigests: Object.freeze(resultDigests),
		evidenceDigests: Object.freeze([]),
		expectedProjectHead: gate.subject.projectCommit,
		expectedChangeTip: gate.subject.changeTip,
		implementationResultCommit: null,
		implementationResultTree: null,
		eventDigest: digest("0"),
	});
}

function withPendingPlanningGate(reduced, gate) {
	const {stateDigest: ignored, ...body} = reduced;
	void ignored;
	const nextBody = Object.freeze({...body, state: "committed", completionTree: null, review: null, effects: Object.freeze([]), gates: Object.freeze([...body.gates, gate])});
	const stateDigest = semanticDigest("codewiki.reduced-change@1.0.0", nextBody);
	assert.equal(stateDigest.ok, true);
	return Object.freeze({...nextBody, stateDigest: stateDigest.value});
}

function gateOutcome(gate, resultDigest) {
	const body = Object.freeze({
		gateDigest: gate.gateDigest,
		subjectDigest: gate.subject.subjectDigest,
		status: "passed",
		requiredResults: Object.freeze([resultDigest]),
		advisoryResults: Object.freeze([]),
		observedResults: Object.freeze([]),
		failedResults: Object.freeze([]),
		stopReasons: Object.freeze([]),
	});
	const outcomeDigest = semanticDigest("codewiki.gate-outcome@1.0.0", body);
	assert.equal(outcomeDigest.ok, true);
	return Object.freeze({...body, outcomeDigest: outcomeDigest.value});
}

test("WorkState is disposable deterministic projection from snapshot and facts", () => {
	const reduced = reduceChangeTrace(validTrace().trace);
	assert.equal(reduced.ok, true);
	const input = {project: projectFixture(), kernelBuildDigest: digest("f"), changes: [reduced.value], gates: [], gateOutcomes: [], results: [], evidence: []};
	const first = deriveWorkState(input);
	const second = deriveWorkState(input);
	assert.equal(first.ok, true, first.ok ? undefined : first.error.message);
	assert.equal(first.value.projectionDigest, second.value.projectionDigest);
	assert.equal(first.value.changes[0].projectedState, "completed");
	assert.equal(first.value.changes[0].work[0].status, "integrated");
	assert.equal(first.value.kernelBuildDigest, digest("f"));
	assert.match(first.value.changes[0].projectionDigest, /^sha256:[0-9a-f]{64}$/);
	assert.match(first.value.changes[0].work[0].projectionDigest, /^sha256:[0-9a-f]{64}$/);
	assert.deepEqual(first.value.changes[0].work[0].claimIds, ["cw:claim:one"]);
	assert.deepEqual(first.value.changes[0].work[0].assignmentIds, ["cw:assignment:one"]);
	assert.deepEqual(first.value.changes[0].work[0].runIds, ["cw:dsh-run:one"]);
	assert.ok(first.value.changes[0].blockers.some((entry) => entry.startsWith("gate_fact_missing_or_conflicting:")));
});

test("receipt evidence resolves only matching receipt blockers", () => {
	const reduced = reduceChangeTrace(validTrace().trace).value;
	const base = {project: projectFixture(), kernelBuildDigest: digest("f"), changes: [reduced], gates: [], gateOutcomes: [], results: []};
	const without = deriveWorkState({...base, evidence: []}).value;
	const withReceipts = deriveWorkState({...base, evidence: [evidenceFixture(digest("5")), evidenceFixture(digest("7")), evidenceFixture(digest("e"))]}).value;
	assert.ok(without.changes[0].blockers.some((entry) => entry.startsWith("claim_receipt_missing:")));
	assert.equal(withReceipts.changes[0].blockers.some((entry) => entry.startsWith("claim_receipt_missing:")), false);
	assert.equal(withReceipts.changes[0].blockers.some((entry) => entry.startsWith("run_receipt_missing:")), false);
	assert.equal(withReceipts.changes[0].blockers.some((entry) => entry.startsWith("effect_receipt_missing:")), false);
});

test("projection rejects duplicate or forged semantic facts", () => {
	const reduced = reduceChangeTrace(validTrace().trace).value;
	const base = {project: projectFixture(), kernelBuildDigest: digest("f"), changes: [reduced], gates: [], gateOutcomes: [], results: [], evidence: []};
	assert.equal(deriveWorkState({...base, changes: [reduced, reduced]}).error.code, "duplicate_fact");
	assert.equal(deriveWorkState({...base, gateOutcomes: [{gateDigest: digest("1"), subjectDigest: digest("2"), status: "passed", outcomeDigest: digest("3")}] }).error.code, "invalid_fact");
	assert.equal(deriveWorkState({...base, evidence: [evidenceFixture(digest("5")), evidenceFixture(digest("5"))]}).error.code, "duplicate_fact");
	assert.equal(deriveWorkState({...base, evidence: [evidenceFixture(digest("5"), "cw:evidence:same"), evidenceFixture(digest("6"), "cw:evidence:same")]}).error.code, "duplicate_fact");
	const identityGate = planningGate();
	const firstResult = completedRunFixture(identityGate).result;
	const secondResult = completedRunFixture(identityGate, identityGate.activeChecks[0], {result: {summary: "Alternate."}}).result;
	assert.equal(deriveWorkState({...base, results: [firstResult, secondResult]}).error.code, "duplicate_fact");
	assert.equal(deriveWorkState({...base, kernelBuildDigest: "invalid"}).error.code, "invalid_fact");
	const {stateDigest: ignored, ...reducedBody} = reduced;
	void ignored;
	const foreignBody = Object.freeze({...reducedBody, change: changeFixture({repositoryId: "cw:repository:other"})});
	const foreignDigest = semanticDigest("codewiki.reduced-change@1.0.0", foreignBody).value;
	assert.equal(deriveWorkState({...base, changes: [{...foreignBody, stateDigest: foreignDigest}]}).error.code, "invalid_fact");
});

test("pending planning amendment Gate must use current Kernel Build", () => {
	const gate = planningGate(digest("e"));
	const reduced = reduceChangeTrace(validTrace().trace).value;
	const projected = withPendingPlanningGate(reduced, recordedGate(gate, digest("c")));
	const result = deriveWorkState({
		project: projectFixture(),
		kernelBuildDigest: digest("f"),
		changes: [projected],
		gates: [gate],
		gateOutcomes: [],
		results: [],
		evidence: [],
	});
	assert.equal(result.ok, true);
	assert.ok(result.value.changes[0].blockers.includes(`gate_definition_missing_or_conflicting:${gate.gateDigest}`));
});

test("projection accepts internally consistent authoritative Gate facts", () => {
	const gate = planningGate();
	const completed = completedRunFixture(gate);
	const outcome = gateOutcome(gate, completed.result.resultDigest);
	const reduced = reduceChangeTrace(validTrace().trace).value;
	const fact = recordedGate(gate, outcome.outcomeDigest, [completed.result.resultDigest], [completed.run.runDigest]);
	const projected = withPendingPlanningGate(reduced, fact);
	const result = deriveWorkState({
		project: projectFixture(),
		kernelBuildDigest: digest("f"),
		changes: [projected],
		gates: [gate],
		gateOutcomes: [outcome],
		results: [completed.result],
		evidence: [],
	});
	assert.equal(result.ok, true);
	assert.equal(result.value.changes[0].blockers.some((entry) => entry.includes(gate.gateDigest)), false);
});

test("projection rejects Gate outcome that hides factual required failure", () => {
	const gate = planningGate();
	const completed = completedRunFixture(gate, gate.activeChecks[0], {
		result: {
			measurement: {kind: "binary", value: false},
			status: "failed",
			summary: "Failed.",
			failure: {code: "semantic_integrity_failed", message: "Failed.", remediation: ["Fix it."]},
		},
	});
	const outcome = gateOutcome(gate, completed.result.resultDigest);
	const reduced = reduceChangeTrace(validTrace().trace).value;
	const fact = recordedGate(gate, outcome.outcomeDigest, [completed.result.resultDigest], [completed.run.runDigest]);
	const projected = withPendingPlanningGate(reduced, fact);
	const result = deriveWorkState({
		project: projectFixture(),
		kernelBuildDigest: digest("f"),
		changes: [projected],
		gates: [gate],
		gateOutcomes: [outcome],
		results: [completed.result],
		evidence: [],
	});
	assert.equal(result.ok, true);
	assert.ok(result.value.changes[0].blockers.includes(`gate_failed_result_set_conflicting:${gate.gateDigest}`));
});
