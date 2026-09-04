import assert from "node:assert/strict";
import test from "node:test";
import {createCheckRun} from "../../../src/kernel/gates/contracts.ts";
import {decodeGateOutcome, reduceGate} from "../../../src/kernel/gates/reducer.ts";
import {
	completedRunFixture,
	gateFixture,
	registrationFixture,
	subjectFixture,
} from "./contracts.test.mjs";

function reduce(gate, runs, results, overrides = {}) {
	return reduceGate({gate, currentSubject: gate.subject, currentKernelBuildDigest: gate.kernelBuildDigest, kernelValidation: "passed", runs, results, ...overrides});
}

test("Gate passes only with current subject, complete selection, Kernel validation, and required pass", () => {
	const gate = gateFixture();
	const {run, result} = completedRunFixture(gate);
	const outcome = reduce(gate, [run], [result]);
	assert.equal(outcome.ok, true);
	assert.equal(outcome.value.status, "passed");
	assert.deepEqual(outcome.value.requiredResults, [result.resultDigest]);
	assert.equal(decodeGateOutcome(outcome.value).ok, true);
	assert.equal(decodeGateOutcome({...outcome.value, extra: true}).ok, false);
	assert.equal(reduceGate({gate, currentSubject: subjectFixture({projectCommit: {algorithm: "sha1", hex: "9".repeat(40)}}), currentKernelBuildDigest: gate.kernelBuildDigest, kernelValidation: "passed", runs: [run], results: [result]}).value.status, "stopped");
	assert.equal(reduce(gate, [run], [result], {currentKernelBuildDigest: `sha256:${"f".repeat(64)}`}).value.status, "stopped");
	assert.equal(reduce(gate, [run], [result], {kernelValidation: "failed"}).value.status, "stopped");
});

test("required semantic failure fails Gate while advisory failure remains factual", () => {
	const requiredGate = gateFixture();
	const failedRequired = completedRunFixture(requiredGate, requiredGate.activeChecks[0], {
		result: {
			measurement: {kind: "binary", value: false},
			status: "failed",
			failure: {code: "semantic_integrity_failed", message: "Failed.", remediation: ["Fix it."]},
		},
	});
	assert.equal(reduce(requiredGate, [failedRequired.run], [failedRequired.result]).value.status, "failed");
	const advisory = registrationFixture({enforcement: "advisory"});
	const advisoryGate = gateFixture({activeChecks: [advisory]});
	const failedAdvisory = completedRunFixture(advisoryGate, advisory, {
		result: {
			measurement: {kind: "binary", value: false},
			status: "failed",
			failure: {code: "semantic_integrity_failed", message: "Failed.", remediation: ["Inspect."]},
		},
	});
	const outcome = reduce(advisoryGate, [failedAdvisory.run], [failedAdvisory.result]);
	assert.equal(outcome.value.status, "passed");
	assert.deepEqual(outcome.value.failedResults, [failedAdvisory.result.resultDigest]);
});

test("missing inputs, stopped Runs, orphaned Results, and inconsistent facts stop Gate", () => {
	const gate = gateFixture();
	assert.equal(reduce(gate, [], []).value.status, "stopped");
	const missingInputGate = gateFixture({inputs: []});
	const missingInputRun = completedRunFixture(missingInputGate);
	const missingInputOutcome = reduce(missingInputGate, [missingInputRun.run], [missingInputRun.result]);
	assert.equal(missingInputOutcome.value.status, "stopped");
	assert.ok(missingInputOutcome.value.stopReasons.some((reason) => reason.startsWith("missing_required_input:")));
	const completed = completedRunFixture(gate);
	const {protocol, runId, runDigest, ...body} = completed.run;
	void protocol;
	void runId;
	void runDigest;
	const stopped = createCheckRun({...body, status: "stopped", resultDigest: null});
	assert.equal(stopped.ok, true);
	assert.equal(reduce(gate, [stopped.value], []).value.status, "stopped");
	assert.equal(reduce(gate, [], [completed.result]).value.status, "stopped");
	const inconsistent = completedRunFixture(gate, gate.activeChecks[0], {
		result: {measurement: {kind: "binary", value: false}, status: "passed", failure: null},
	});
	assert.equal(reduce(gate, [inconsistent.run], [inconsistent.result]).value.status, "stopped");
	const duplicate = reduce(gate, [completed.run, completed.run, completed.run], [completed.result]);
	assert.equal(duplicate.value.status, "stopped");
	assert.equal(new Set(duplicate.value.stopReasons).size, duplicate.value.stopReasons.length);
	assert.equal(decodeGateOutcome(duplicate.value).ok, true);
});

test("Gate reduction is deterministic under input ordering", () => {
	const first = registrationFixture();
	const second = registrationFixture({
		packId: "second-pack",
		definition: {...first.definition, id: "second_check"},
		enforcement: "advisory",
	});
	const gate = gateFixture({activeChecks: [second, first].sort((left, right) => `${left.stage}/${left.packId}`.localeCompare(`${right.stage}/${right.packId}`))});
	const a = completedRunFixture(gate, first);
	const b = completedRunFixture(gate, second);
	const left = reduce(gate, [a.run, b.run], [a.result, b.result]);
	const right = reduce(gate, [b.run, a.run], [b.result, a.result]);
	assert.equal(left.ok, true);
	assert.equal(right.value.outcomeDigest, left.value.outcomeDigest);
});
