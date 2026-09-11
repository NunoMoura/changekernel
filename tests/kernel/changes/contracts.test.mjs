import assert from "node:assert/strict";
import test from "node:test";
import {
	createChange,
	decodeChange,
	createProfileChange,
	decodeProfileChange,
} from "../../../src/kernel/changes/contracts.ts";

import {profileRecord, admitted} from "../wiki/profile-fixtures.mjs";

export const CHANGE_ID = "CHG-test-semantic-kernel";

export function changeFixture(overrides = {}) {
	const result = createChange({
		changeId: CHANGE_ID,
		repositoryId: "cw:repository:test",
		revision: 1,
		changeType: "correction",
		realization: "project",
		intent: "Implement exact semantic lifecycle contracts.",
		rationale: "One deterministic Kernel removes parallel authority.",
		acceptance: ["All bounded reducers pass."],
		targets: [{itemId: "cw:component:semantic-kernel", facets: ["body"]}],
		relationships: [],
		contributorRefs: ["cw:actor:maintainer"],
		producerRunRefs: ["cw:run:planning"],
		...overrides,
	});
	assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
	return result.value;
}

test("Change contract binds intent, targets, realization, attribution, and relationships", () => {
	const change = changeFixture();
	assert.equal(decodeChange(change).ok, true);
	assert.equal(changeFixture().changeDigest, change.changeDigest);
	assert.equal(Object.isFrozen(change), true);
});

test("Change contract rejects unknown authority, target ambiguity, and self relationships", () => {
	const change = changeFixture();
	assert.equal(decodeChange({...change, disposition: "approve"}).ok, false);
	assert.equal(createChange({...withoutProtocolAndDigest(change), targets: []}).ok, false);
	assert.equal(createChange({...withoutProtocolAndDigest(change), relationships: [{kind: "depends_on", changeId: CHANGE_ID}]}).ok, false);
});

test("Change revision and digest are exact", () => {
	const change = changeFixture();
	assert.equal(decodeChange({...change, revision: 2}).ok, false);
	assert.equal(decodeChange({...change, changeDigest: `sha256:${"f".repeat(64)}`}).ok, false);
	assert.equal(createChange({...withoutProtocolAndDigest(change), changeType: "feature"}).ok, false);
});

test("versioned profile Change binds its reference and exact targets without broadening the old grammar", () => {
	const {change, reference} = profileRecord();
	assert.equal(decodeChange(change).ok, false);
	assert.equal(decodeProfileChange(changeFixture()).ok, false);
	assert.deepEqual(admitted(decodeProfileChange(JSON.parse(JSON.stringify(change)))), change);
	assert.equal(change.reference.transactionDigest, reference.transactionDigest);
	const body = withoutProtocolAndDigest(change);
	for (const patch of [
		{targets: []}, {changeType: "feature"}, {changeId: "CHG-other"},
		{targets: change.targets.slice(1)}, {targets: [...change.targets, change.targets[0]]},
		{targets: change.targets.map((target) => ({...target, transactionDigest: `sha256:${"c".repeat(64)}`}))},
	]) assert.equal(createProfileChange({...body, ...patch}).ok, false);
	assert.equal(decodeProfileChange({...change, reference: {...reference, kernelBuildDigest: `sha256:${"c".repeat(64)}`}}).ok, false);
});

function withoutProtocolAndDigest(change) {
	const {protocol, changeDigest, ...body} = change;
	void protocol;
	void changeDigest;
	return body;
}
