import assert from "node:assert/strict";
import test from "node:test";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {decodeCheckResult} from "../../../src/kernel/gates/checks.ts";
import {canonicalJson} from "../../../src/kernel/data-contracts/canonical-json.ts";
import {DECISION_CHECK_OUTPUT_PROTOCOL, DECISION_CHECK_OUTPUT_SCHEMA, decodeDecisionCheckOutput, parseDecisionCheckOutput, decodeDecisionSourceCitations} from "../../../src/kernel/gates/decision-output.ts";
import {ok, digest, frozen, checkOutput} from "./fixtures.mjs";

test("Decision Check draft is bounded proposed interpretation, not a Gate finding", () => {
	const input = checkOutput(), value = ok(decodeDecisionCheckOutput(input));
	frozen(value); frozen(DECISION_CHECK_OUTPUT_SCHEMA);
	assert.deepEqual(value, input);
	input.citations[0].endByte = 9;
	assert.equal(value.citations[0].endByte, 4);
	for (const status of ["supported", "contradicted", "unresolved"]) assert.equal(decodeDecisionCheckOutput(checkOutput({status})).ok, true);
	assert.equal(decodeDecisionCheckOutput(checkOutput({status: "unresolved", citations: []})).ok, true);
	assert.equal(decodeDecisionCheckOutput(checkOutput({assumptions: ["An unverified condition holds."]})).ok, true, "Conditional proposals remain drafts, not accepted support");
});
test("Decision Check output rejects verdicts, operational claims, fabricated evidence references and empty support", () => {
	for (const patch of [{status: "passed"}, {status: "unavailable"}, {citations: []}, {status: "contradicted", citations: []},
		{reason: " "}, {contextComplete: true}, {producerId: "cw:actor:claimed"}, {evidenceDigests: [digest()]},
		{assumptions: ["Repeated", "Repeated"]}, {assumptions: ["Z", "A"]}, {protocol: {...DECISION_CHECK_OUTPUT_PROTOCOL, version: "2.0.0"}}]) {
		assert.equal(decodeDecisionCheckOutput(checkOutput(patch)).ok, false, JSON.stringify(patch));
	}
});
test("Decision Check output parser requires unambiguous canonical JSON without invoking hostile data", () => {
	const value = checkOutput(), text = ok(canonicalJson(value));
	assert.deepEqual(ok(parseDecisionCheckOutput(text)), value);
	for (const input of [null, value, text + "\n", JSON.stringify(value, null, 2), '{"status":"supported",' + text.slice(1), "```json\n" + text + "\n```", text.replace("quoted", "e\u0301")]) {
		assert.equal(parseDecisionCheckOutput(input).ok, false);
	}
	let accessed = 0;
	const hostile = {...value}; Object.defineProperty(hostile, "reason", {get() {accessed++; throw new Error("must not run");}});
	assert.equal(decodeDecisionCheckOutput(hostile).ok, false);
	assert.equal(accessed, 0);
});
test("Decision Check outputs share exact source-coordinate limits with backend citation admission", () => {
	const citation = checkOutput().citations[0];
	assert.deepEqual(ok(decodeDecisionSourceCitations([citation])), [citation]);
	for (const patch of [{pathUtf8Hex: "a"}, {pathUtf8Hex: "AA"}, {sourceDigest: "claimed"}, {startByte: -1}, {startByte: 0.5}, {endByte: 0}, {endByte: 256 * 1024 + 1}]) {
		assert.equal(decodeDecisionCheckOutput(checkOutput({citations: [{...citation, ...patch}]})).ok, false);
	}
	assert.equal(decodeDecisionSourceCitations([citation, citation]).ok, false);
	assert.equal(decodeDecisionSourceCitations(Array.from({length: 65}, (_, i) => ({...citation, startByte: i, endByte: i + 1}))).ok, false);
	assert.equal(decodeDecisionCheckOutput(checkOutput({reason: "x".repeat(4096)})).ok, true);
	assert.equal(decodeDecisionCheckOutput(checkOutput({reason: "é".repeat(2049)})).ok, false);
	assert.equal(decodeDecisionCheckOutput(checkOutput({assumptions: Array.from({length: 33}, (_, i) => String(i).padStart(2, "0"))})).ok, false);
});

test("historical interpretation schema identity remains unchanged and cannot become a unified result", () => {
	assert.equal(ok(semanticDigest("codewiki.agent-output-schema@2.0.0", DECISION_CHECK_OUTPUT_SCHEMA)), "sha256:495d2b9ed0fe96edc8719b867e650cd668fdab7029e06f0fb1b18174f0589358");
	assert.equal(decodeCheckResult(checkOutput()).ok, false);
});
