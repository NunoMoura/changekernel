import assert from "node:assert/strict";
import test from "node:test";
import {
	failure,
	flatMapOutcome,
	mapOutcome,
	success,
} from "../../../src/kernel/canonical/outcome.ts";

test("typed outcomes map successful values without mutating either value", () => {
	const initial = success(2);
	const mapped = mapOutcome(initial, (value) => value * 3);
	const flatMapped = flatMapOutcome(mapped, (value) => success(String(value)));
	assert.deepEqual(initial, {ok: true, value: 2});
	assert.deepEqual(mapped, {ok: true, value: 6});
	assert.deepEqual(flatMapped, {ok: true, value: "6"});
	assert.ok(Object.isFrozen(initial));
	assert.ok(Object.isFrozen(mapped));
});

test("typed outcomes preserve expected failures", () => {
	const initial = failure({code: "stopped"});
	let called = false;
	const mapped = mapOutcome(initial, () => {
		called = true;
		return 1;
	});
	assert.equal(called, false);
	assert.strictEqual(mapped, initial);
	assert.deepEqual(mapped, {ok: false, error: {code: "stopped"}});
});
