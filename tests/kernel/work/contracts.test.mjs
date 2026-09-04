import assert from "node:assert/strict";
import test from "node:test";
import {
	createWork,
	decodeWork,
	validateWorkPlan,
	workIdentity,
	workPlanDigest,
	workScopesConflict,
} from "../../../src/kernel/work/contracts.ts";

export const CHANGE_ID = "CHG-test-semantic-kernel";

export function workFixture(ordinal = 1, overrides = {}) {
	const result = createWork({
		changeId: CHANGE_ID,
		ordinal,
		workType: "codewiki.work:source",
		targets: [{itemId: "cw:component:semantic-kernel", facets: ["body"]}],
		writablePaths: [`src/unit-${ordinal}/**`],
		dependencies: [],
		capabilities: ["codewiki.capability:project-artifact-write"],
		acceptance: [`Work ${ordinal} is complete.`],
		...overrides,
	});
	assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
	return result.value;
}

test("Work identity is Change-owned, ordinal-stable, and digest-bound", () => {
	const work = workFixture();
	assert.equal(work.workId, workIdentity(CHANGE_ID, 1).value);
	assert.equal(decodeWork(work).ok, true);
	assert.equal(workFixture().workDigest, work.workDigest);
	assert.equal(decodeWork({...work, ordinal: 2}).ok, false);
});

test("Work forbids semantic roots and unbounded or non-judgeable scope", () => {
	for (const writablePaths of [[".codewiki/wiki/**"], [".git/refs/**"], ["**"], ["../outside"]]) {
		const result = createWork({
			changeId: CHANGE_ID,
			ordinal: 1,
			workType: "codewiki.work:source",
			targets: [{itemId: "cw:component:semantic-kernel", facets: ["body"]}],
			writablePaths,
			dependencies: [],
			capabilities: [],
			acceptance: ["Bounded."],
		});
		assert.equal(result.ok, false, writablePaths[0]);
	}
	const valid = workFixture();
	assert.equal(decodeWork({...valid, acceptance: []}).ok, false);
});

test("Work plan accepts one deterministic DAG and rejects missing/cyclic dependencies", () => {
	const first = workFixture(1);
	const second = workFixture(2, {dependencies: [first.workId]});
	const valid = validateWorkPlan(CHANGE_ID, [second, first]);
	assert.equal(valid.ok, true);
	assert.deepEqual(valid.value.map((entry) => entry.ordinal), [1, 2]);
	assert.equal(workPlanDigest([second, first]).value, workPlanDigest([first, second]).value);
	const absent = workFixture(2, {dependencies: [workIdentity(CHANGE_ID, 3).value]});
	assert.equal(validateWorkPlan(CHANGE_ID, [first, absent]).ok, false);
	const firstId = workIdentity(CHANGE_ID, 1).value;
	const secondId = workIdentity(CHANGE_ID, 2).value;
	const cyclicFirst = workFixture(1, {dependencies: [secondId]});
	const cyclicSecond = workFixture(2, {dependencies: [firstId]});
	assert.equal(validateWorkPlan(CHANGE_ID, [cyclicFirst, cyclicSecond]).ok, false);
});

test("writable scope conflict is conservative and deterministic", () => {
	const left = workFixture(1, {writablePaths: ["src/kernel/**"]});
	const right = workFixture(2, {writablePaths: ["src/kernel/gates/**"]});
	const separate = workFixture(3, {writablePaths: ["tests/kernel/**"]});
	assert.equal(workScopesConflict(left, right), true);
	assert.equal(workScopesConflict(left, separate), false);
});
