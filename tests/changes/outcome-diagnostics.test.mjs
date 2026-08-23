import assert from "node:assert/strict";
import test from "node:test";

import {diagnoseOutcomes} from "../../src/changes/intake/outcome-diagnostics.ts";

const digest = (character) => `sha256:${character.repeat(64)}`;

function observation(character, overrides = {}) {
	return {
		changeRevisionId: digest("a"),
		stage: "implementation",
		subjectRef: "trace:work-unit:runtime",
		gateReportDigest: digest(character),
		outcome: "failed",
		failureCodes: ["check.timeout"],
		sourceRefs: [`trace:gate-report:${character}`],
		...overrides,
	};
}

test("Outcome Diagnostics deterministically emits only repeated findings as ordinary intake", () => {
	const suggestion = {
		target: "check",
		targetRef: ".codewiki/check-packs/implementation/runtime/check.json",
		unifiedDiff: "--- a/check.json\n+++ b/check.json\n@@ -1 +1 @@\n-1000\n+2000",
	};
	const findings = diagnoseOutcomes({
		observations: [
			observation("2", {suggestion}),
			observation("1", {suggestion}),
			observation("3", {failureCodes: ["different.failure"]}),
		],
	});
	assert.equal(findings.length, 1);
	assert.equal(findings[0].materialType, "outcome_finding");
	assert.equal(findings[0].content.claimedCategory, "outcome");
	assert.match(findings[0].content.desiredBehavior, /Proposed check change/);
	assert.deepEqual(
		diagnoseOutcomes({observations: [...[observation("2", {suggestion}), observation("1", {suggestion})].reverse()]}),
		diagnoseOutcomes({observations: [observation("1", {suggestion}), observation("2", {suggestion})]}),
	);
});

test("Outcome Diagnostics cannot repair one failure or accept malformed privileged suggestions", () => {
	assert.deepEqual(diagnoseOutcomes({observations: [observation("1")]}), []);
	assert.throws(
		() => diagnoseOutcomes({
			observations: [observation("1", {
				suggestion: {target: "check", targetRef: "check.json", unifiedDiff: "replace timeout"},
			})],
		}),
		/exact unified diff/,
	);
	assert.throws(
		() => diagnoseOutcomes({observations: [observation("1", {outcome: "passed"})]}),
		/cannot carry failure codes/,
	);
});
