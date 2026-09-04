import assert from "node:assert/strict";
import test from "node:test";
import {
	createProjectSnapshot,
	decodeProjectSnapshot,
	validateChangeCommitSnapshot,
	validateCompletionCommitSnapshot,
} from "../../../src/kernel/changes/snapshot.ts";
import {oid} from "./events.test.mjs";
import {validTrace} from "./reducer.test.mjs";

function snapshot(commit, tree, parents, complete = true) {
	const result = createProjectSnapshot({repositoryId: "cw:repository:test", objectFormat: "sha1", commit, tree, parents, complete});
	assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
	return result.value;
}

function validationFixture() {
	const event = validTrace().trace.events.find((entry) => entry.kind === "change.committed");
	const projectBefore = snapshot(oid("1"), oid("2"), [oid("3")]);
	const changeBefore = snapshot(oid("9"), oid("4"), [oid("5")]);
	const result = snapshot(oid("8"), oid("6"), [projectBefore.commit, changeBefore.commit]);
	const traceDelta = {path: ".codewiki/changes/TRACE-test.jsonl", beforeBlob: oid("a"), afterBlob: oid("b"), prefixPreserved: true};
	const changes = [{path: traceDelta.path, kind: "modified", before: traceDelta.beforeBlob, after: traceDelta.afterBlob}];
	return {projectBefore, changeBefore, result, event, traceDelta, changes, authorizedPaths: [traceDelta.path], wikiIdentityClosure: true, wikiRelationshipClosure: true, fullTreeMaterialized: true};
}

test("Project Snapshot binds object format, parents, and complete closure fact", () => {
	const value = snapshot(oid("a"), oid("b"), [oid("c"), oid("d")]);
	assert.equal(decodeProjectSnapshot(value).ok, true);
	assert.equal(value.snapshotDigest, snapshot(oid("a"), oid("b"), [oid("c"), oid("d")]).snapshotDigest);
	assert.equal(decodeProjectSnapshot({...value, objectFormat: "sha256"}).ok, false);
	assert.equal(decodeProjectSnapshot({...value, complete: false}).ok, false, "snapshot digest binds completeness");
});

test("Change Commit requires exact ordered two-parent full snapshot", () => {
	const fixture = validationFixture();
	assert.equal(validateChangeCommitSnapshot(fixture).ok, true);
	assert.equal(validateChangeCommitSnapshot({...fixture, result: snapshot(oid("8"), oid("6"), [fixture.changeBefore.commit, fixture.projectBefore.commit])}).error.code, "invalid_parent_order");
	assert.equal(validateChangeCommitSnapshot({...fixture, result: snapshot(oid("8"), oid("6"), [fixture.projectBefore.commit])}).error.code, "invalid_parent_order");
	assert.equal(validateChangeCommitSnapshot({...fixture, result: snapshot(oid("8"), oid("6"), [fixture.projectBefore.commit, fixture.changeBefore.commit], false)}).error.code, "incomplete_objects");
});

test("snapshot validation enforces expected heads, exact authorized paths, and Trace append", () => {
	const fixture = validationFixture();
	assert.equal(validateChangeCommitSnapshot({...fixture, event: {...fixture.event, expectedProjectHead: oid("7")}}).error.code, "stale_head");
	assert.equal(validateChangeCommitSnapshot({...fixture, authorizedPaths: []}).error.code, "invalid_delta");
	assert.equal(validateChangeCommitSnapshot({...fixture, authorizedPaths: ["../escape"]}).error.code, "invalid_delta");
	assert.equal(validateChangeCommitSnapshot({...fixture, traceDelta: {...fixture.traceDelta, prefixPreserved: false}}).error.code, "invalid_delta");
	assert.equal(validateChangeCommitSnapshot({...fixture, wikiIdentityClosure: false}).error.code, "invalid_delta");
	assert.equal(validateChangeCommitSnapshot({...fixture, changes: [{path: "src/other.ts", kind: "added", before: null, after: oid("c")}, ...fixture.changes], authorizedPaths: [fixture.traceDelta.path, "src/other.ts"]}).error.code, "invalid_delta", "changed paths must be canonical sorted");
});

test("Completion snapshot binds reviewed tip and preserves reviewed project-artifact tree", () => {
	const fixture = validationFixture();
	const event = validTrace().trace.events.find((entry) => entry.kind === "change.completed");
	const input = {...fixture, event, reviewedChangeTip: fixture.changeBefore.commit, artifactTreeBefore: oid("d"), artifactTreeAfter: oid("d")};
	assert.equal(validateCompletionCommitSnapshot(input).ok, true);
	assert.equal(validateCompletionCommitSnapshot({...input, artifactTreeAfter: oid("e")}).error.code, "invalid_delta");
	assert.equal(validateCompletionCommitSnapshot({...input, reviewedChangeTip: oid("e")}).error.code, "stale_head");
});
