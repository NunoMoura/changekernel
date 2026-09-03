import assert from "node:assert/strict";
import test from "node:test";
import {
	canonicalJson,
	decodeCanonicalValue,
	encodeCanonicalValue,
	parseCanonicalJson,
} from "../../../src/kernel/canonical/json.ts";

test("canonical JSON recursively sorts keys and normalizes negative zero", () => {
	const left = canonicalJson({z: -0, a: {two: 2, one: 1}, list: [3, 2, 1]});
	const right = canonicalJson({list: [3, 2, 1], a: {one: 1, two: 2}, z: 0});
	assert.equal(left.ok, true);
	assert.equal(right.ok, true);
	assert.equal(left.value, '{"a":{"one":1,"two":2},"list":[3,2,1],"z":0}');
	assert.equal(right.value, left.value);
	assert.ok(Object.isFrozen(decodeCanonicalValue({nested: [1]}).value));
});

test("canonical permutations produce identical bytes", () => {
	const keys = ["alpha", "beta", "gamma", "delta"];
	const permutations = [
		keys,
		[...keys].reverse(),
		["gamma", "alpha", "delta", "beta"],
		["beta", "delta", "alpha", "gamma"],
	];
	const encoded = permutations.map((order) => {
		const value = Object.fromEntries(order.map((key) => [key, key.length]));
		const result = canonicalJson(value);
		assert.equal(result.ok, true);
		return result.value;
	});
	assert.equal(new Set(encoded).size, 1);
});

test("canonical decoder returns typed failures for hidden or unstable state", () => {
	const cycle = {};
	cycle.self = cycle;
	const accessor = Object.defineProperty({}, "secret", {enumerable: true, get: () => 1});
	const hidden = Object.defineProperty({}, "hidden", {enumerable: false, value: 1});
	const sparse = new Array(2);
	const symbol = {[Symbol("hidden")]: true};
	const proxy = new Proxy({}, {ownKeys: () => { throw new Error("trap"); }});
	for (const [value, code] of [
		[cycle, "cyclic_value"],
		[accessor, "accessor_property"],
		[hidden, "non_enumerable_property"],
		[sparse, "sparse_array"],
		[symbol, "symbol_property"],
		[proxy, "access_failed"],
		[Number.NaN, "invalid_number"],
		[1n, "invalid_type"],
	]) {
		const result = decodeCanonicalValue(value);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, code);
	}
});

test("canonical decoder enforces NFC and explicit bounds", () => {
	const decomposed = "e\u0301";
	assert.equal(decodeCanonicalValue(decomposed).error.code, "non_canonical_text");
	assert.equal(decodeCanonicalValue({[decomposed]: true}).error.code, "non_canonical_text");
	assert.equal(decodeCanonicalValue([1, 2], {
		maximumDepth: 4,
		maximumEntriesPerContainer: 1,
		maximumNodes: 10,
		maximumTextBytes: 10,
	}).error.code, "too_many_entries");
	assert.equal(decodeCanonicalValue({a: {b: 1}}, {
		maximumDepth: 1,
		maximumEntriesPerContainer: 4,
		maximumNodes: 10,
		maximumTextBytes: 10,
	}).error.code, "too_deep");
});

test("exact canonical parsing rejects alternate valid JSON bytes", () => {
	const compact = parseCanonicalJson('{"a":1,"b":2}', {requireCanonicalBytes: true});
	const spaced = parseCanonicalJson('{ "a": 1, "b": 2 }', {requireCanonicalBytes: true});
	assert.equal(compact.ok, true);
	assert.equal(encodeCanonicalValue(compact.value), '{"a":1,"b":2}');
	assert.equal(spaced.ok, false);
	assert.equal(spaced.error.code, "non_canonical_text");
	assert.equal(parseCanonicalJson("not-json").ok, false);
	assert.equal(parseCanonicalJson(`"${"x".repeat(11)}"`, {
		limits: {
			maximumDepth: 4,
			maximumEntriesPerContainer: 4,
			maximumNodes: 10,
			maximumTextBytes: 10,
		},
	}).error.code, "too_much_text");
});
