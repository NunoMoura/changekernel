import assert from "node:assert/strict";
import test from "node:test";
import {canonicalJson} from "../../../src/kernel/data-contracts/canonical-json.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {DECISION_CHECK_OUTPUT_PROTOCOL, DECISION_CHECK_OUTPUT_SCHEMA, decodeDecisionCheckOutput, parseDecisionCheckOutput, decodeDecisionSourceCitations, createSemanticGate, decodeSemanticGate, createGateFinding, decodeGateFinding, reduceSemanticGate, verifySemanticGateOutcome} from "../../../src/kernel/gates/semantic.ts";

import {ok, digest, oid, without, gate, finding, reduce, frozen, checkOutput} from "./fixtures.mjs";

test("Gate 2 preserves exact grounds, independent frozen data and both Git formats", () => {
	for (const algorithm of ["sha1", "sha256"]) {
		const g = gate({}, algorithm), f = finding(g);
		assert.deepEqual(ok(decodeSemanticGate(g)), g); assert.deepEqual(ok(decodeGateFinding(f)), f);
		const outcome = reduce(g, [f]); assert.equal(outcome.status, "passed");
		assert.equal(outcome.outcomeDigest, ok(semanticDigest("codewiki.gate-outcome@2.0.0", without(outcome, "outcomeDigest"))));
		frozen(g); frozen(f); frozen(outcome);
		const copy = structuredClone(g); const admitted = ok(decodeSemanticGate(copy)); copy.checks[0].purpose = "Changed";
		assert.deepEqual(admitted, g); assert.equal(decodeSemanticGate(copy).ok, false);
	}
});

test("semantic contradiction differs from unresolved or unavailable assurance; none can pass", () => {
	const g = gate();
	for (const [status, expected] of [["supported", "passed"], ["contradicted", "failed"], ["unresolved", "stopped"], ["unavailable", "stopped"]]) {
		const outcome = reduce(g, [finding(g, {status})]); assert.equal(outcome.status, expected);
		assert.deepEqual(outcome.contradictedChecks, status === "contradicted" ? [g.checks[0].checkId] : []);
	}
	for (const patch of [{evidenceDigests: []}, {assumptions: ["An unverified precondition holds."]}]) {
		assert.equal(reduce(g, [finding(g, patch)]).status, "stopped");
	}
	assert.deepEqual(reduce(g, []).stopReasons, ["missing:cw:check:alignment"]);
	assert.deepEqual(reduce(gate({checks: []}), []).stopReasons, ["empty_checks"]);
	const incomplete = gate({contextComplete: false});
	assert.deepEqual(reduce(incomplete, [finding(incomplete)]).stopReasons, ["incomplete_context"]);
});

test("any changed proposal, context, build, execution or configuration requires new findings", () => {
	const g = gate(), f = finding(g);
	for (const patch of [
		{contextDigest: digest("1")}, {kernelBuildDigest: digest("1")}, {configurationDigest: digest("1")},
		{subject: {...g.subject, subjectDigest: digest("1")}}, {subject: {...g.subject, changeTip: oid("4")}},
		{subject: {...g.subject, projectCommit: oid("4")}},
		{subject: {...g.subject, artifactCommit: oid("4"), artifactTree: oid("5")}},
		{checks: [{...g.checks[0], executionDigest: digest("1")}]},
		{checks: [{...g.checks[0], purpose: "Different obligation"}]},
	]) {
		const current = gate(patch); assert.notEqual(current.gateDigest, g.gateDigest);
		assert.deepEqual(reduce(g, [f], current).stopReasons, ["stale_gate"]);
		assert.equal(decodeSemanticGate({...g, ...patch}).ok, false);
	}
});

test("foreign, duplicate and substituted findings fail admission rather than becoming evidence", () => {
	const g = gate(), f = finding(g);
	for (const findings of [[f, f], [finding(g, {gateDigest: digest("1")})], [finding(g, {checkId: "cw:check:other"})],
		[finding(g, {executionDigest: digest("1")})], [{...f, reason: "Changed"}]]) {
		assert.equal(reduceSemanticGate({gate: g, currentGate: g, findings}).ok, false);
	}
	for (const patch of [{reason: " "}, {reason: "e\u0301"}, {reason: "\ud800"}, {producerId: "unqualified"}, {status: "passed"},
		{evidenceDigests: [digest("f"), digest("f")]}, {assumptions: [""]}]) {
		assert.equal(createGateFinding({...without(f, "protocol", "findingDigest"), ...patch}).ok, false);
	}
});

test("finding order is irrelevant; a pass cannot average away contradiction or missing execution", () => {
	const first = gate().checks[0];
	const g = gate({checks: [first, {...first, checkId: "cw:check:preservation"}]});
	const a = finding(g), b = finding(g, {checkId: g.checks[1].checkId, status: "contradicted"});
	assert.equal(reduce(g, [a, b]).status, "failed");
	assert.equal(ok(canonicalJson(reduce(g, [a, b]))), ok(canonicalJson(reduce(g, [b, a]))));
	const unavailable = finding(g, {status: "unavailable"});
	const stopped = reduce(g, [unavailable, b]); assert.equal(stopped.status, "stopped");
	assert.deepEqual(stopped.contradictedChecks, [b.checkId]);
	assert.equal(reduce(g, [a]).status, "stopped");
});

test("no approval, confidence score or extra authority fields can change reduction", () => {
	const g = gate(), f = finding(g, {status: "contradicted"});
	for (const field of ["approved", "authority", "confidence", "waiver"]) {
		assert.equal(createSemanticGate({...without(g, "protocol", "gateDigest"), [field]: true}).ok, false);
		assert.equal(createGateFinding({...without(f, "protocol", "findingDigest"), [field]: true}).ok, false);
		assert.equal(reduceSemanticGate({gate: g, currentGate: g, findings: [f], [field]: true}).ok, false);
	}
	for (const value of [g, f, reduce(g, [f])]) assert.equal("authorized" in value, false);
});

test("own-data decoding rejects accessors, hidden fields, cycles and malformed current grounds", () => {
	const g = gate(), f = finding(g); let accessed = 0;
	for (const [input, decode] of [[g, decodeSemanticGate], [f, decodeGateFinding], [{gate: g, currentGate: g, findings: [f]}, reduceSemanticGate]]) {
		const key = Object.keys(input)[0]; const accessor = {...input};
		Object.defineProperty(accessor, key, {get() {accessed++; throw new Error("must not run");}});
		const hidden = {...input}; Object.defineProperty(hidden, "hidden", {value: true});
		const cycle = {...input}; cycle.extra = cycle;
		for (const value of [null, accessor, hidden, cycle, {...input, [Symbol("hidden")]: true}, Object.assign(Object.create({inherited: true}), input)]) {
			assert.equal(decode(value).ok, false);
		}
	}
	assert.equal(accessed, 0);
	assert.equal(reduceSemanticGate({gate: g, currentGate: {...g, gateDigest: digest("1")}, findings: [f]}).ok, false);
});

test("retained outcomes replay all statuses and stale grounds without executing checks", () => {
	for (const algorithm of ["sha1", "sha256"]) {
		const g = gate({}, algorithm);
		for (const status of ["supported", "contradicted", "unresolved", "unavailable"]) {
			const findings = [finding(g, {status})];
			for (const currentGate of [g, gate({contextDigest: digest("1")}, algorithm)]) {
				const outcome = reduce(g, findings, currentGate);
				const stored = JSON.parse(ok(canonicalJson({gate: g, currentGate, findings, outcome})));
				const replayed = ok(verifySemanticGateOutcome(stored));
				assert.deepEqual(replayed, outcome);
				frozen(replayed);
				stored.outcome.findingDigests.length = 0;
				assert.deepEqual(replayed, outcome, "Recovered data must not alias stored input");
			}
		}
	}
	const g = gate({checks: []});
	assert.equal(ok(verifySemanticGateOutcome({gate: g, currentGate: g, findings: [], outcome: reduce(g, [])})).status, "stopped");
});

test("recovery rejects outcome tampering even when the attacker recomputes its hash", () => {
	const g = gate(), findings = [finding(g, {status: "contradicted"})];
	const outcome = reduce(g, findings);
	const envelope = {gate: g, currentGate: g, findings, outcome};
	for (const patch of [{status: "passed"}, {contradictedChecks: []}, {stopReasons: ["invented"]},
		{findingDigests: []}, {gateDigest: digest("1")}, {currentGateDigest: digest("1")}, {approved: true}]) {
		const body = {...without(outcome, "outcomeDigest"), ...patch};
		const forged = {...body, outcomeDigest: ok(semanticDigest("codewiki.gate-outcome@2.0.0", body))};
		assert.equal(verifySemanticGateOutcome({...envelope, outcome: forged}).ok, false);
	}
	for (const key of Object.keys(outcome)) {
		assert.equal(verifySemanticGateOutcome({...envelope, outcome: without(outcome, key)}).ok, false);
	}
	assert.equal(verifySemanticGateOutcome({...envelope, findings: []}).ok, false);
	assert.equal(verifySemanticGateOutcome({...envelope, currentGate: gate({contextDigest: digest("1")})}).ok, false);
	assert.equal(verifySemanticGateOutcome({...envelope, findings: [finding(g)]}).ok, false);
});

test("recovery rejects hostile own data and preserves order-independent reduction", () => {
	const first = gate().checks[0];
	const g = gate({checks: [first, {...first, checkId: "cw:check:preservation"}]});
	const findings = g.checks.map(check => finding(g, {checkId: check.checkId}));
	const input = {gate: g, currentGate: g, findings, outcome: reduce(g, findings)};
	assert.deepEqual(ok(verifySemanticGateOutcome({...input, findings: [...findings].reverse()})), input.outcome);
	let accessed = 0;
	const accessor = {...input.outcome};
	Object.defineProperty(accessor, "status", {get() {accessed++; throw new Error("must not run");}});
	const hidden = {...input.outcome}; Object.defineProperty(hidden, "hidden", {value: true});
	const cycle = {...input.outcome}; cycle.extra = cycle;
	for (const outcome of [null, accessor, hidden, cycle, {...input.outcome, [Symbol("hidden")]: true},
		Object.assign(Object.create({inherited: true}), input.outcome)]) {
		assert.equal(verifySemanticGateOutcome({...input, outcome}).ok, false);
	}
	assert.equal(accessed, 0);
	for (const key of Object.keys(input)) assert.equal(verifySemanticGateOutcome(without(input, key)).ok, false);
	assert.equal(verifySemanticGateOutcome({...input, approved: true}).ok, false);
	assert.equal(verifySemanticGateOutcome({...input, findings: [findings[0], findings[0]]}).ok, false);
});

test("Gate stage, ordering, protocol and bounded collections remain closed", () => {
	const g = gate(), body = without(g, "protocol", "gateDigest");
	assert.equal(createSemanticGate({...body, stage: "planning"}).ok, false);
	assert.equal(decodeSemanticGate({...g, protocol: {...g.protocol, version: "1.0.0"}}).ok, false);
	for (const key of Object.keys(body)) assert.equal(createSemanticGate(without(body, key)).ok, false);
	const checks = Array.from({length: 65}, (_, i) => ({...g.checks[0], checkId: `cw:check:${String(i).padStart(2, "0")}`}));
	const max = gate({checks: checks.slice(0, 64)});
	assert.equal(reduce(max, max.checks.map(check => finding(max, {checkId: check.checkId}))).status, "passed");
	assert.equal(createSemanticGate({...body, checks}).ok, false);
	assert.equal(createSemanticGate({...body, checks: checks.slice(0, 2).reverse()}).ok, false);
	assert.equal(createSemanticGate({...body, checks: [g.checks[0], g.checks[0]]}).ok, false);
	assert.equal(createSemanticGate({...body, checks: [{...g.checks[0], purpose: "x".repeat(4097)}]}).ok, false);
	const f = finding(g);
	assert.equal(createGateFinding({...without(f, "protocol", "findingDigest"), assumptions: Array(33).fill("A condition")}).ok, false);
});

test("record and aggregate budgets compose without making large admitted Gates unreadable", () => {
	const checks = Array.from({length: 64}, (_, i) => ({checkId: `cw:check:${String(i).padStart(2, "0")}`, purpose: "x".repeat(3500), executionDigest: digest("e")}));
	const g = gate({checks});
	assert.ok(Buffer.byteLength(ok(canonicalJson(g))) > 200 * 1024);
	const findings = checks.map(check => finding(g, {checkId: check.checkId}));
	assert.equal(reduce(g, findings).status, "passed");
	assert.equal(ok(verifySemanticGateOutcome({gate: g, currentGate: g, findings, outcome: reduce(g, findings)})).status, "passed");
	// Nested records retain their own limits even when the reduction envelope is larger.
	const body = {...without(g, "gateDigest"), checks: checks.map(check => ({...check, purpose: "x".repeat(4096)}))};
	const forged = {...body, gateDigest: ok(semanticDigest("codewiki.gate@2.0.0", body))};
	assert.equal(decodeSemanticGate(forged).ok, false);
	assert.equal(reduceSemanticGate({gate: forged, currentGate: forged, findings: []}).ok, false);
	const largeFindings = checks.map(check => finding(g, {checkId: check.checkId, assumptions: Array(32).fill("x".repeat(1024))}));
	assert.equal(reduceSemanticGate({gate: g, currentGate: g, findings: largeFindings}).ok, false);
	assert.equal(verifySemanticGateOutcome({gate: g, currentGate: g, findings: largeFindings, outcome: reduce(g, findings)}).ok, false);
});
test("Decision Check draft is bounded proposed interpretation, not a Gate finding", () => {
	const input = checkOutput(), value = ok(decodeDecisionCheckOutput(input));
	frozen(value); frozen(DECISION_CHECK_OUTPUT_SCHEMA);
	assert.deepEqual(value, input);
	input.citations[0].endByte = 9;
	assert.equal(value.citations[0].endByte, 4);
	assert.equal(decodeGateFinding(value).ok, false);
	assert.equal(reduceSemanticGate({gate: gate(), currentGate: gate(), findings: [value]}).ok, false);
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

test("Gate subjects reject mixed object formats, unpaired artifacts and invalid scope facts", () => {
	const selected = gate(), body = without(selected, "protocol", "gateDigest");
	for (const patch of [
		{projectTree: {algorithm: "sha256", hex: "a".repeat(64)}},
		{artifactCommit: selected.subject.projectCommit}, {artifactTree: selected.subject.projectTree},
		{workId: "cw:work:unexpected"}, {kind: "effect"}, {repositoryId: "unnamespaced"}, {changeId: "bad"},
		{facts: null}, {facts: []}, {facts: {unnamespaced: true}},
		{facts: Object.fromEntries(Array.from({length: 257}, (_, index) => [`cw:fact:${index}`, true]))},
		{approved: true},
	]) assert.equal(createSemanticGate({...body, subject: {...selected.subject, ...patch}}).ok, false, JSON.stringify(patch));
	let accessed = 0;
	const subject = {...selected.subject};
	Object.defineProperty(subject, "facts", {enumerable: true, get() {accessed++; throw new Error("must not run");}});
	assert.equal(createSemanticGate({...body, subject}).ok, false);
	assert.equal(accessed, 0);
});
