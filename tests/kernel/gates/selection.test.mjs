import assert from "node:assert/strict";
import test from "node:test";
import {
	createCheckRegistration,
	decodeCheckRegistration,
} from "../../../src/kernel/gates/contracts.ts";
import {
	createGateFromSelection,
	resolveActiveChecks,
} from "../../../src/kernel/gates/selection.ts";
import {checkDefinitionFixture} from "./check-definition.test.mjs";
import {digest, registrationFixture, subjectFixture} from "./contracts.test.mjs";

const projectRegistration = (id, overrides = {}) => {
	const result = createCheckRegistration({
		source: "project",
		packId: "project-policy",
		stage: "decision",
		enforcement: "advisory",
		universalSafety: false,
		applicability: {changeTypes: ["correction"], realizations: [], subjectKinds: ["change"], workTypes: [], facts: {}},
		definition: checkDefinitionFixture({id}),
		...overrides,
	});
	assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
	return result.value;
};

const selectionInput = (registrations, overrides = {}) => ({
	stage: "decision",
	changeType: "correction",
	realization: "project",
	subject: subjectFixture(),
	workType: null,
	registrations,
	enabledProjectPacks: ["project-policy"],
	...overrides,
});

test("active Check resolution merges Product and enabled Project policy deterministically", () => {
	const product = registrationFixture();
	const project = projectRegistration("project_semantics");
	const left = resolveActiveChecks(selectionInput([project, product]));
	const right = resolveActiveChecks(selectionInput([product, project]));
	assert.equal(left.ok, true);
	assert.equal(right.ok, true);
	assert.equal(left.value.availablePolicyDigest, right.value.availablePolicyDigest);
	assert.deepEqual(left.value.activeChecks.map((entry) => entry.source), ["project", "product"]);
	assert.deepEqual(left.value.omissions, []);
});

test("disabled and inapplicable Project Checks are explicit omissions", () => {
	const disabled = projectRegistration("disabled_check");
	const wrongType = projectRegistration("capability_only", {
		applicability: {changeTypes: ["capability"], realizations: [], subjectKinds: [], workTypes: [], facts: {}},
	});
	const selected = resolveActiveChecks(selectionInput([disabled, wrongType], {enabledProjectPacks: []}));
	assert.equal(selected.ok, true);
	assert.deepEqual(selected.value.activeChecks, []);
	assert.deepEqual(selected.value.omissions.map((entry) => entry.reason), ["optional_pack_disabled", "optional_pack_disabled"]);
});

test("missing applicability fact stops selection instead of becoming omission", () => {
	const registration = projectRegistration("fact_check", {
		applicability: {changeTypes: [], realizations: [], subjectKinds: [], workTypes: [], facts: {"codewiki.fact:required": true}},
	});
	const selected = resolveActiveChecks(selectionInput([registration]));
	assert.equal(selected.ok, false);
	assert.equal(selected.error.code, "invalid_selection");
});

test("universal safety cannot be disabled or changed by producer classification", () => {
	const safety = projectRegistration("universal_safety", {
		universalSafety: true,
		enforcement: "required",
		applicability: {changeTypes: ["policy"], realizations: ["wiki-only"], subjectKinds: ["review"], workTypes: ["codewiki.work:other"], facts: {"codewiki.fact:missing": true}},
	});
	const base = selectionInput([safety], {enabledProjectPacks: [], changeType: "correction"});
	const first = resolveActiveChecks({...base, producerId: "cw:actor:one"});
	const second = resolveActiveChecks({...base, producerId: "cw:actor:two"});
	assert.equal(first.ok, true);
	assert.equal(first.value.activeChecks.length, 1);
	assert.equal(first.value.availablePolicyDigest, second.value.availablePolicyDigest);
});

test("qualified identity duplication and Product shadowing stop selection", () => {
	const product = registrationFixture();
	const forgedProject = decodeCheckRegistration({...product, source: "project"});
	assert.equal(forgedProject.ok, false, "digest binding rejects direct source forgery");
	const duplicate = createCheckRegistration({
		source: "project",
		packId: product.packId,
		stage: product.stage,
		enforcement: product.enforcement,
		universalSafety: false,
		applicability: product.applicability,
		definition: product.definition,
	});
	assert.equal(duplicate.ok, true);
	const selected = resolveActiveChecks(selectionInput([product, duplicate.value]));
	assert.equal(selected.ok, false);
	assert.equal(selected.error.code, "product_shadowed");
});

test("Gate construction freezes complete resolution inputs", () => {
	const input = selectionInput([registrationFixture()]);
	const gate = createGateFromSelection({selectionInput: input, inputs: [], kernelBuildDigest: digest("9")});
	assert.equal(gate.ok, true, gate.ok ? undefined : gate.error.message);
	assert.equal(gate.value.selectionComplete, true);
	assert.deepEqual(gate.value.selectionInputs, {changeType: "correction", realization: "project", workType: null, enabledProjectPacks: ["project-policy"]});
	assert.equal(gate.value.activeChecks.length, 1);
	assert.equal(gate.value.subject.subjectDigest, input.subject.subjectDigest);
	assert.equal(resolveActiveChecks({...input, workType: "codewiki.work:source"}).ok, false);
});
