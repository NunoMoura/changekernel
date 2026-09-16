import assert from "node:assert/strict";
import test from "node:test";
import {createProfileChange, decodeProfileChange} from "../../../src/kernel/changes/contracts.ts";
import {profileRecord, admitted} from "../wiki/profile-fixtures.mjs";

function body(change) {
	const {protocol, changeDigest, ...value} = change;
	return value;
}

test("concrete Change binds its exact reference, targets, intent and attribution", () => {
	for (const format of ["sha1", "sha256"]) {
		const {change, reference} = profileRecord(format);
		assert.deepEqual(admitted(decodeProfileChange(structuredClone(change))), change);
		assert.equal(change.reference.transactionDigest, reference.transactionDigest);
		assert.notEqual(admitted(createProfileChange({...body(change), intent: "Another intent."})).changeDigest, change.changeDigest);
		assert.equal(decodeProfileChange({...change, revision: 2}).ok, false);
		assert.equal(decodeProfileChange({...change, disposition: "approve"}).ok, false);
		assert.equal(decodeProfileChange({...change, changeDigest: `sha256:${"f".repeat(64)}`}).ok, false);
	}
});

test("concrete Change rejects ambiguous targets, foreign references and self relationships", () => {
	const {change, reference} = profileRecord();
	for (const patch of [
		{targets: []}, {changeType: "feature"}, {changeId: "CHG-other"}, {acceptance: []},
		{targets: change.targets.slice(1)}, {targets: [...change.targets, change.targets[0]]},
		{targets: change.targets.map(target => ({...target, transactionDigest: `sha256:${"c".repeat(64)}`}))},
		{relationships: [{kind: "depends_on", changeId: change.changeId}]},
	]) assert.equal(createProfileChange({...body(change), ...patch}).ok, false);
	assert.equal(decodeProfileChange({...change, reference: {...reference, kernelBuildDigest: `sha256:${"c".repeat(64)}`}}).ok, false);
});
