import assert from "node:assert/strict";
import test from "node:test";
import {
	checkDefinitionDigest,
	decodeCheckDefinition,
} from "../../../src/kernel/gates/check-definition.ts";

export function checkDefinitionFixture(overrides = {}) {
	return {
		schemaVersion: "1.0.0",
		id: "semantic_integrity",
		version: "1.0.0",
		description: "Validate exact subject semantics.",
		requirement: "Subject must satisfy canonical invariants.",
		implementation: {kind: "code", profile: "bounded"},
		inputs: [{source: "subject", refs: [], required: true, maximumBytes: 4096}],
		measurement: {kind: "binary"},
		failure: {code: "semantic_integrity_failed", message: "Semantic integrity failed.", remediation: ["Correct subject."]},
		limits: {timeoutMs: 30_000, maximumAttempts: 1, maximumInputBytes: 4096, maximumOutputBytes: 4096},
		...overrides,
	};
}

test("custom Check Definition digest binds its declared requirement", () => {
	const original = decodeCheckDefinition(checkDefinitionFixture());
	const changed = decodeCheckDefinition(checkDefinitionFixture({requirement: "A different custom requirement."}));
	assert.equal(original.ok, true);
	assert.equal(changed.ok, true);
	assert.match(checkDefinitionDigest(original.value), /^sha256:[0-9a-f]{64}$/u);
	assert.notEqual(checkDefinitionDigest(original.value), checkDefinitionDigest(changed.value));
});

test("Check Definition preserves code/model and binary/quantitative contracts", () => {
	const code = decodeCheckDefinition(checkDefinitionFixture());
	assert.equal(code.ok, true);
	const model = decodeCheckDefinition(checkDefinitionFixture({
		implementation: {kind: "model", route: "review", profile: "strict", maximumTokens: 8192},
		measurement: {kind: "quantitative", minimum: 0.8, maximum: 1},
	}));
	assert.equal(model.ok, true);
	assert.equal(model.value.implementation.kind, "model");
	assert.deepEqual(model.value.measurement, {kind: "quantitative", minimum: 0.8, maximum: 1});
});

test("Check Definition rejects Domain, unknown selectors, and invalid budgets", () => {
	for (const fixture of [
		{...checkDefinitionFixture(), domainId: "software-development"},
		checkDefinitionFixture({inputs: [{source: "producer", refs: [], required: true, maximumBytes: 10}]}),
		checkDefinitionFixture({limits: {timeoutMs: 0, maximumAttempts: 1, maximumInputBytes: 1, maximumOutputBytes: 1}}),
		checkDefinitionFixture({measurement: {kind: "quantitative"}}),
	]) assert.equal(decodeCheckDefinition(fixture).ok, false);
});
