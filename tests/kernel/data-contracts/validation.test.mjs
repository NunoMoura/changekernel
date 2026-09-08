import assert from "node:assert/strict";
import test from "node:test";
import {
	decodeContract,
	exactRecord,
	protocolField,
	protocolIdentity,
	requiredField,
	sortedUniqueTextArray,
	textField,
} from "../../../src/kernel/data-contracts/validation.ts";

const PROTOCOL = protocolIdentity("codewiki.test-contract", "1.0.0");
const decodeFixture = (input) => decodeContract("Fixture", input, (value) => {
	const record = exactRecord("Fixture", value, "$", ["names", "name", "protocol"]);
	protocolField("Fixture", record, "$", PROTOCOL);
	return Object.freeze({
		protocol: PROTOCOL,
		name: textField("Fixture", record, "name", "$", {maximumBytes: 8}),
		names: sortedUniqueTextArray("Fixture", requiredField("Fixture", record, "names"), "$.names", {maximumEntries: 3}),
	});
});

test("bounded contract decoder admits exact canonical values", () => {
	const result = decodeFixture({protocol: PROTOCOL, name: "alpha", names: ["a", "b"]});
	assert.equal(result.ok, true);
	assert.equal(Object.isFrozen(result.value), true);
	assert.deepEqual(result.value.names, ["a", "b"]);
});

test("bounded contract decoder rejects unknown, missing, unordered, and oversize fields", () => {
	for (const [input, code] of [
		[{protocol: PROTOCOL, name: "alpha", names: [], extra: true}, "unknown_field"],
		[{protocol: PROTOCOL, names: []}, "missing_field"],
		[{protocol: PROTOCOL, name: "alpha", names: ["b", "a"]}, "non_canonical_order"],
		[{protocol: PROTOCOL, name: "123456789", names: []}, "limit_exceeded"],
	]) {
		const result = decodeFixture(input);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, code);
	}
});

test("protocol identity is exact and decoder failures never throw", () => {
	assert.throws(() => protocolIdentity("Bad Protocol", "1.0.0"));
	const wrong = decodeFixture({protocol: {id: PROTOCOL.id, version: "2.0.0"}, name: "ok", names: []});
	assert.equal(wrong.ok, false);
	assert.equal(wrong.error.code, "invalid_protocol");
	const hostile = {};
	Object.defineProperty(hostile, "name", {get() { throw new Error("boom"); }});
	assert.doesNotThrow(() => decodeFixture(hostile));
	assert.equal(decodeFixture(hostile).ok, false);
});
