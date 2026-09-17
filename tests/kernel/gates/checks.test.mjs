import assert from "node:assert/strict";
import test from "node:test";
import {canonicalJson} from "../../../src/kernel/data-contracts/canonical-json.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {createCheckDefinition, decodeCheckDefinition, createCheckPack, decodeCheckPack, createCheckAdoption, decodeCheckAdoption, createCheckInput, decodeCheckInput, createCheckResult, decodeCheckResult, prepareCheckSelection, reduceCheckResults, checkExecutionDigest} from "../../../src/kernel/gates/checks.ts";
import {fixture, result, ok, body, digest, oid, limits} from "./check-fixtures.mjs";
import {frozen} from "./fixtures.mjs";
const prepare = f => ok(prepareCheckSelection(f.selection));
const reduce = (f, results = [result(f)]) => ok(reduceCheckResults({selection: f.selection, results}));
const changedInput = (f, patch) => {
	const input = ok(createCheckInput({...body(f.input), ...patch}));
	return {...f, input, selection: {...f.selection, current: {...f.selection.current, stage: input.stage, effects: input.effects, effectsComplete: input.effectsComplete}, inputs: [input]}};
};

test("shared Check machinery supports four stages without cross-stage verdict substitution", () => {
	const stages = ["decision", "planning", "implementation", "review"];
	const f = fixture({definition: {activation: {stages: [...stages].sort(), effectKinds: ["cw:effect:wiki"]}}});
	const cases = stages.map(stage => changedInput(f, {stage}));
	assert.equal(new Set(cases.map(c => c.input.digest)).size, stages.length);
	for (const current of cases) {
		assert.equal(current.input.executionDigest, f.input.executionDigest);
		assert.equal(prepare(current).entries[0].readiness, "ready");
		assert.equal(reduce(current).passed, true);
		assert.equal(reduce(current, []).passed, false);
		for (const other of cases) {
			if (other.input.stage === current.input.stage) continue;
			assert.equal(reduceCheckResults({selection: current.selection, results: [result(other)]}).ok, false);
		}
		const restricted = fixture({definition: {activation: {stages: [current.input.stage], effectKinds: ["cw:effect:wiki"]}}, input: {stage: current.input.stage}});
		assert.equal(prepare(restricted).entries[0].readiness, "ready");
		for (const stage of stages.filter(stage => stage !== current.input.stage)) {
			const inactive = changedInput(restricted, {stage});
			assert.equal(prepare(inactive).entries[0].applicability, "inactive");
			assert.deepEqual(reduce(inactive, []).blockers, ["no-validation"]);
		}
	}
});

for (const algorithm of ["sha1", "sha256"]) test(`unified Check ${algorithm}: exact adoption, frozen records, deterministic replay`, () => {
	const f = fixture({algorithm});
	const records = [[decodeCheckDefinition, f.definition], [decodeCheckPack, f.pack], [decodeCheckAdoption, f.adoption], [decodeCheckInput, f.input], [decodeCheckResult, result(f)]];
	for (const [decode, value] of records) {
		assert.deepEqual(ok(decode(JSON.parse(ok(canonicalJson(value))))), value); frozen(value);
		assert.equal(value.digest, ok(semanticDigest(value.protocol, (({digest, ...content}) => content)(value))));
		const copy = structuredClone(value); assert.deepEqual(ok(decode(copy)), value);
		copy.protocol = "codewiki.gate@2.0.0"; assert.equal(decode(copy).ok, false);
	}
	assert.equal(prepare(f).entries[0].readiness, "ready");
	assert.equal(reduce(f).passed, true); frozen(prepare(f)); frozen(reduce(f));
	assert.deepEqual(reduce(f), ok(reduceCheckResults(JSON.parse(ok(canonicalJson({selection: f.selection, results: [result(f)]}))))));
});

test("deterministic computation and bounded inference share one definition and result contract", () => {
	const f = fixture({definition: {limits: {...limits, modelCalls: 2, modelInputTokens: 4096, modelOutputTokens: 1024}},
		selected: {model: {routeDigest: digest("2"), settingsDigest: digest("3")}}});
	assert.equal(prepare(f).entries[0].readiness, "ready"); assert.equal(reduce(f).passed, true);
	assert.notEqual(f.input.executionDigest, fixture().input.executionDigest);
	for (const patch of [{modelCalls: 1}, {modelInputTokens: 1}, {milliseconds: 0}, {modelCalls: 33}, {inputBytes: 262145}]) {
		assert.equal(createCheckDefinition({...body(f.definition), limits: {...limits, ...patch}}).ok, false);
	}
	assert.equal(createCheckAdoption({...body(f.adoption), checks: [{...f.adoption.checks[0], model: null}]}).ok, false);
	const exceeded = ok(createCheckAdoption({...body(f.adoption), checks: [{...f.adoption.checks[0], limits: {...f.definition.limits, milliseconds: 1001}}]}));
	assert.equal(checkExecutionDigest({definition: f.definition, adoption: exceeded, checkId: f.definition.checkId, kernelBuildDigest: digest()}).ok, false);
});

test("installation, first-party naming and candidate policy changes grant no adoption or permission", () => {
	const f = fixture();
	for (const patch of [{packs: []}, {definitions: []}, {inputs: []}, {packs: [f.pack, f.pack]}, {definitions: [f.definition, f.definition]}]) {
		assert.equal(prepareCheckSelection({...f.selection, ...patch}).ok, false);
	}
	const foreignPack = ok(createCheckPack({...body(f.pack), packId: "changekernel:pack:first-party"}));
	assert.equal(prepareCheckSelection({...f.selection, packs: [foreignPack]}).ok, false);
	const weakened = ok(createCheckAdoption({...body(f.adoption), wiki: {...f.adoption.wiki, snapshot: f.input.subject.candidate}, checks: []}));
	assert.equal(prepareCheckSelection({...f.selection, adoption: weakened, definitions: [], inputs: []}).ok, false);
	assert.equal(prepareCheckSelection({...f.selection, current: {...f.selection.current, adoptionDigest: weakened.digest}, adoption: weakened, packs: [], definitions: [], inputs: []}).ok, false);
	for (const permissionDigests of [[], [digest("2")]]) assert.equal(prepareCheckSelection({...f.selection, current: {...f.selection.current, permissionDigests}}).ok, false);
});

test("exact definition, Pack, Wiki, Change, parameters, permissions and model settings change execution identity", () => {
	const f = fixture();
	for (const patch of [
		{reason: "Adopt a different obligation."}, {wiki: {...f.adoption.wiki, blob: oid("7")}},
		{adoptedBy: {...f.adoption.adoptedBy, blob: oid("7")}},
		...[{parameters: {threshold: 2}}, {permissionDigest: digest("2")}, {limits: {...limits, milliseconds: 500}}, {packDigest: digest("2")}].map(p => ({checks: [{...f.adoption.checks[0], ...p}]})),
	]) {
		const adoption = ok(createCheckAdoption({...body(f.adoption), ...patch}));
		assert.notEqual(ok(checkExecutionDigest({definition: f.definition, adoption, checkId: f.definition.checkId, kernelBuildDigest: f.input.kernelBuildDigest})), f.input.executionDigest);
		assert.equal(prepareCheckSelection({...f.selection, adoption}).ok, false);
	}
	for (const patch of [{version: "2.0.0"}, {passingCondition: "Weaker condition."}, {implementation: {...f.definition.implementation, artifactDigest: digest("2")}},
		{activation: {stages: ["review"], effectKinds: []}}]) {
		const definition = ok(createCheckDefinition({...body(f.definition), ...patch}));
		assert.equal(prepareCheckSelection({...f.selection, definitions: [definition]}).ok, false);
	}
	const m = fixture({definition: {limits: {...limits, modelCalls: 1, modelInputTokens: 100, modelOutputTokens: 100}}, selected: {model: {routeDigest: digest("2"), settingsDigest: digest("3")}}});
	for (const key of ["routeDigest", "settingsDigest"]) {
		const adoption = ok(createCheckAdoption({...body(m.adoption), checks: [{...m.adoption.checks[0], model: {...m.adoption.checks[0].model, [key]: digest("4")}}]}));
		assert.notEqual(ok(checkExecutionDigest({definition: m.definition, adoption, checkId: m.definition.checkId, kernelBuildDigest: m.input.kernelBuildDigest})), m.input.executionDigest);
	}
});

test("stale or substituted exact subject, build, policy and execution cannot admit input", () => {
	const f = fixture();
	for (const patch of [{definitionDigest: digest("2")}, {adoptionDigest: digest("2")}, {executionDigest: digest("2")}, {kernelBuildDigest: digest("2")}, {permissionDigest: digest("2")},
		{subject: {...f.input.subject, subjectDigest: digest("2")}}, {subject: {...f.input.subject, candidate: {...f.input.subject.candidate, commit: oid("7")}}},
		{subject: {...f.input.subject, baseline: {...f.input.subject.baseline, tree: oid("7")}}}]) {
		assert.equal(prepareCheckSelection(changedInput(f, patch).selection).ok, false);
	}
});

for (const status of ["missing", "stale", "denied"]) test(`${status} required input remains active and unready, never inactive or semantic false`, () => {
	const f = fixture();
	const missing = changedInput(f, {slots: [{...f.input.slots[0], status, value: null, omissions: ["Required source is unavailable."]}]});
	assert.equal(prepare(missing).entries[0].applicability, "active");
	assert.equal(prepare(missing).entries[0].readiness, "unready");
	assert.deepEqual(reduce(missing, []).failed, []); assert.equal(reduce(missing, []).passed, false);
	assert.equal(reduceCheckResults({selection: missing.selection, results: [result(missing, {passed: false, failureKind: "insufficient-support"})]}).ok, false);
});

test("missing actual effect facts are unknown, positive matches activate, no match needs complete facts", () => {
	const f = fixture();
	const unknown = changedInput(f, {effects: [], effectsComplete: false});
	assert.equal(prepare(unknown).entries[0].applicability, "unknown"); assert.equal(prepare(unknown).entries[0].readiness, "unready");
	assert.equal(prepare(changedInput(f, {effectsComplete: false})).entries[0].applicability, "active");
	for (const patch of [{effects: [], effectsComplete: true}, {stage: "review"}]) {
		const inactive = changedInput(f, patch);
		assert.equal(prepare(inactive).entries[0].applicability, "inactive"); assert.deepEqual(reduce(inactive, []).blockers, ["no-validation"]);
		assert.equal(reduceCheckResults({selection: inactive.selection, results: [result(inactive)]}).ok, false);
	}
});

test("empty adopted selection never claims validation; absent adoption cannot be inferred", () => {
	const f = fixture();
	const adoption = ok(createCheckAdoption({...body(f.adoption), checks: []}));
	const selection = {...f.selection, current: {...f.selection.current, adoptionDigest: adoption.digest}, adoption, packs: [], definitions: [], inputs: []};
	assert.equal(ok(prepareCheckSelection(selection)).entries.length, 0);
	assert.deepEqual(ok(reduceCheckResults({selection, results: []})).blockers, ["no-validation"]);
	assert.equal(prepareCheckSelection({...selection, adoption: null}).ok, false);
});

test("declared input structures, whole-record bounds and omissions are enforced", () => {
	const f = fixture();
	for (const slots of [[], [...f.input.slots, ...f.input.slots], [{...f.input.slots[0], name: "cw:input:unknown"}],
		[{...f.input.slots[0], value: false}], [{...f.input.slots[0], value: "x".repeat(8193)}]]) {
		const input = createCheckInput({...body(f.input), slots});
		assert.equal(input.ok && prepareCheckSelection({...f.selection, inputs: [input.value]}).ok, false);
	}
	assert.equal(createCheckInput({...body(f.input), slots: [{...f.input.slots[0], status: "missing"}]}).ok, false);
	const omitted = changedInput(f, {slots: [{...f.input.slots[0], omissions: ["Some necessary intent was excluded."]}]});
	assert.equal(prepare(omitted).entries[0].readiness, "unready");
	const optional = fixture({definition: {inputs: [{...f.definition.inputs[0], required: false}]}, input: {slots: [{...f.input.slots[0], status: "missing", value: null, omissions: ["Optional source absent."]}]}});
	assert.equal(prepare(optional).entries[0].readiness, "ready");
	assert.equal(prepareCheckSelection(fixture({selected: {limits: {...limits, inputBytes: 1}}}).selection).ok, false);
});

test("operational errors carry no fabricated Boolean; semantic false distinguishes contradiction from insufficient support", () => {
	const f = fixture();
	for (const failureKind of ["contradiction", "insufficient-support"]) {
		const failed = result(f, {passed: false, failureKind});
		assert.deepEqual(reduce(f, [failed]).failed, [f.definition.checkId]); assert.deepEqual(reduce(f, [failed]).blockers, []);
	}
	const error = result(f, {status: "operational-error", passed: null, evidenceDigests: [], limitations: ["Execution exceeded its budget."]});
	assert.equal(reduce(f, [error]).passed, false); assert.deepEqual(reduce(f, [error]).failed, []);
	for (const patch of [{status: "operational-error"}, {passed: false}, {passed: null}, {failureKind: "contradiction"}, {status: "unresolved"}, {status: "inactive"},
		{passed: false, failureKind: "contradiction", status: "operational-error"}, {evidenceDigests: []}, {evidenceDigests: [digest("1"), digest("1")]}]) {
		assert.equal(createCheckResult({...body(result(f)), ...patch}).ok, false);
	}
});

test("results bind exact inputs, execution, bounded feedback and admitted Evidence references", () => {
	const f = fixture();
	for (const patch of [{inputDigest: digest("2")}, {executionDigest: digest("2")}, {checkId: "cw:check:other"}, {evidenceDigests: [digest("2")]}]) {
		assert.equal(reduceCheckResults({selection: f.selection, results: [result(f, patch)]}).ok, false);
	}
	assert.equal(reduceCheckResults({selection: f.selection, results: [result(f), result(f)]}).ok, false);
	assert.equal(reduce(f, []).passed, false);
	const r = result(f);
	for (const field of ["summary", "where", "reason"]) assert.equal(createCheckResult({...body(r), feedback: {...r.feedback, [field]: " "}}).ok, false);
	assert.equal(createCheckResult({...body(r), feedback: {...r.feedback, summary: "x".repeat(4097)}}).ok, false);
	const small = fixture({selected: {limits: {...limits, outputBytes: 1}}});
	assert.equal(reduceCheckResults({selection: small.selection, results: [result(small)]}).ok, false);
	const moved = changedInput(f, {slots: [{...f.input.slots[0], value: "Different intent."}]});
	assert.equal(reduceCheckResults({selection: moved.selection, results: [r]}).ok, false);
});

test("independent conditions all report; contradiction cannot be averaged away or hide missing execution", () => {
	const a = fixture(), b = fixture({definition: {checkId: "cw:check:preservation", question: "Are adopted commitments preserved?"}});
	const adoption = ok(createCheckAdoption({...body(a.adoption), checks: [a.adoption.checks[0], b.adoption.checks[0]]}));
	const inputs = [a, b].map(f => ok(createCheckInput({...body(f.input), adoptionDigest: adoption.digest,
		executionDigest: ok(checkExecutionDigest({definition: f.definition, adoption, checkId: f.definition.checkId, kernelBuildDigest: f.input.kernelBuildDigest}))})));
	const selection = {...a.selection, current: {...a.selection.current, adoptionDigest: adoption.digest}, adoption,
		packs: [a.pack, b.pack].sort((a, b) => a.digest.localeCompare(b.digest)), definitions: [a.definition, b.definition], inputs};
	const results = [result({...a, input: inputs[0]}), result({...b, input: inputs[1]}, {passed: false, failureKind: "contradiction"})];
	const reduced = ok(reduceCheckResults({selection, results}));
	assert.equal(reduced.passed, false); assert.deepEqual(reduced.failed, [b.definition.checkId]);
	assert.deepEqual(ok(reduceCheckResults({selection, results: [...results].reverse()})), reduced);
	const missing = ok(reduceCheckResults({selection, results: [results[1]]}));
	assert.deepEqual(missing.failed, [b.definition.checkId]); assert.ok(missing.blockers.includes(`missing-result:${a.definition.checkId}`));
	const changed = ok(createCheckInput({...body(inputs[1]), effects: []}));
	assert.equal(prepareCheckSelection({...selection, inputs: [inputs[0], changed]}).ok, false);
});

test("new records reject missing or extra fields, tampering, hostile objects and historical protocol reinterpretation", () => {
	const f = fixture(); let accessed = 0;
	for (const [decode, value] of [[decodeCheckDefinition, f.definition], [decodeCheckPack, f.pack], [decodeCheckAdoption, f.adoption], [decodeCheckInput, f.input], [decodeCheckResult, result(f)]]) {
		for (const key of Object.keys(value)) {
			const copy = {...value}; delete copy[key]; assert.equal(decode(copy).ok, false);
		}
		const hidden = {...value}; Object.defineProperty(hidden, "hidden", {value: true});
		const getter = {...value}; Object.defineProperty(getter, "digest", {get() {accessed++; throw Error("Do not run");}});
		const cycle = {...value}; cycle.extra = cycle;
		for (const bad of [hidden, getter, cycle, {...value, confidence: 1}, {...value, approved: true}, {...value, digest: digest("0")},
			{...value, protocol: "codewiki.gate@2.0.0"}, {...value, [Symbol("hidden")]: true}, Object.assign(Object.create({inherited: true}), value)]) assert.equal(decode(bad).ok, false);
	}
	assert.equal(accessed, 0);
	assert.equal(createCheckDefinition({...body(f.definition), question: "e\u0301"}).ok, false);
	assert.equal(createCheckDefinition({...body(f.definition), question: "\ud800"}).ok, false);
	assert.equal(createCheckDefinition({...body(f.definition), inputs: [f.definition.inputs[0], f.definition.inputs[0]]}).ok, false);
	for (const path of [".changekernel/wiki/../policy", "/.changekernel/wiki/policy", "README.md"]) assert.equal(createCheckAdoption({...body(f.adoption), wiki: {...f.adoption.wiki, path}}).ok, false);
	assert.equal(createCheckInput({...body(f.input), subject: {...f.input.subject, baseline: {...f.input.subject.baseline, tree: oid("1", "sha256")}}}).ok, false);
});

test("caller-controlled activation cannot override exact host-observed stage, effects or completeness", () => {
	const f = fixture();
	for (const patch of [{stage: "review"}, {effects: []}, {effectsComplete: false}]) {
		const input = ok(createCheckInput({...body(f.input), ...patch}));
		assert.equal(prepareCheckSelection({...f.selection, inputs: [input]}).ok, false);
	}
	for (const patch of [{subject: null}, {kernelBuildDigest: "bad"}, {effects: ["unknown"]}, {stage: "other"}]) {
		assert.equal(prepareCheckSelection({...f.selection, current: {...f.selection.current, ...patch}}).ok, false);
	}
});

test("available null is not an object, declaration and version bounds are closed", () => {
	const f = fixture({definition: {inputs: [{name: "cw:input:intent", type: "object", required: true, selection: "An exact structured case.", maximumBytes: 8192}]}, input: {slots: [{name: "cw:input:intent", status: "available", value: null, sources: [], evidenceDigests: [], omissions: []}]}});
	assert.equal(prepareCheckSelection(f.selection).ok, false);
	for (const patch of [{resultProtocol: "codewiki.gate-finding@1.0.0"}, {version: "latest"}, {activation: {stages: [], effectKinds: []}},
		{inputs: Array(65).fill(f.definition.inputs[0])}, {activation: {stages: ["review", "decision"], effectKinds: []}}]) {
		assert.equal(createCheckDefinition({...body(f.definition), ...patch}).ok, false);
	}
});
