import assert from "node:assert/strict";
import test from "node:test";
import {createProjectSnapshot, decodeProjectSnapshot} from "../../../src/kernel/changes/snapshot.ts";

function snapshot(format = "sha1", overrides = {}) {
	const oid = character => ({algorithm: format, hex: character.repeat(format === "sha1" ? 40 : 64)});
	return createProjectSnapshot({repositoryId: "cw:repository:test", objectFormat: format,
		commit: oid("a"), tree: oid("b"), parents: [oid("c"), oid("d")], complete: true, ...overrides});
}

test("Project snapshot binds repository, object format, ordered parents and closure observation", () => {
	for (const format of ["sha1", "sha256"]) {
		const result = snapshot(format);
		assert.equal(result.ok, true);
		const value = result.value;
		assert.deepEqual(decodeProjectSnapshot(value), result);
		assert.equal(snapshot(format).value.snapshotDigest, value.snapshotDigest);
		for (const patch of [{repositoryId: "cw:repository:other"}, {complete: false}, {parents: [...value.parents].reverse()}, {snapshotDigest: `sha256:${"f".repeat(64)}`}]) {
			assert.equal(decodeProjectSnapshot({...value, ...patch}).ok, false);
		}
		assert.notEqual(snapshot(format, {parents: [...value.parents].reverse()}).value.snapshotDigest, value.snapshotDigest);
		assert.equal(snapshot(format, {complete: false}).ok, true, "An incomplete observation is valid data, not sufficient lifecycle evidence");
		assert.equal(snapshot(format, {tree: {algorithm: format === "sha1" ? "sha256" : "sha1", hex: "a".repeat(format === "sha1" ? 64 : 40)}}).ok, false);
	}
});
