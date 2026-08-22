import assert from "node:assert/strict";
import {mkdtemp, readdir, rm, stat} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach, describe, it} from "node:test";
import {createProjectContextSnapshot} from "../../../src/project-server/project-context/snapshot.ts";
import {createProjectContextStore} from "../../../src/project-server/project-context/store.ts";
import {mountProjectContextSnapshot} from "../../../src/runtime/context/project-context-mount.ts";
import {canonicalJsonDigest} from "../../../src/utils/canonical-json.ts";

const roots = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, {recursive: true, force: true})));
});

function digest(value) {
	return canonicalJsonDigest(value);
}

function snapshot(capturedAt, item = "same reusable content") {
	return createProjectContextSnapshot({
		stage: "planning",
		subject: {id: "CHG-store", digest: digest("subject")},
		changeRevisionDigest: digest("revision"),
		sources: {
			workState: digest("work-state"),
			knowledgeState: digest("knowledge"),
			knowledgeProjection: digest("projection"),
			alignment: digest("alignment"),
			repositoryTree: digest("tree"),
			acceptedChanges: digest("changes"),
			workGraph: digest("graph"),
			evidence: digest("evidence"),
			results: digest("results"),
		},
		producerSkillSetDigest: null,
		gateFeedbackDigest: null,
		queryEngine: {id: "context", version: "1.0.0", digest: digest("engine")},
		routes: [{
			request: {service: "project_state", operation: "change", arguments: {changeId: "CHG-store"}},
			items: [{item}],
			sourceReferences: [{kind: "trace", ref: "CHG-store", digest: digest("trace")}],
			coverage: "complete",
			unknowns: [],
		}],
		observation: {capturedAt, stale: false, coverage: "complete", unknowns: []},
	});
}

describe("Project Context store and mount", () => {
	it("reuses chunks and mounts exact snapshots read-only", async () => {
		const root = await mkdtemp(join(tmpdir(), "codewiki-context-store-"));
		roots.push(root);
		const store = await createProjectContextStore(root);
		const first = snapshot("2026-08-02T00:00:00.000Z");
		const later = snapshot("2026-08-02T01:00:00.000Z");
		const firstBinding = await store.mountBinding(first);
		const laterBinding = await store.mountBinding(later);
		assert.equal((await readdir(join(root, "chunks"))).length, 1);
		assert.equal((await readdir(join(root, "snapshots"))).length, 2);
		assert.equal((await stat(firstBinding.snapshotPath)).mode & 0o222, 0);
		assert.equal((await mountProjectContextSnapshot(firstBinding)).snapshotDigest, first.snapshotDigest);
		assert.equal((await mountProjectContextSnapshot(laterBinding)).snapshotDigest, later.snapshotDigest);
	});

	it("retains referenced snapshots and prunes only unreferenced snapshots", async () => {
		const root = await mkdtemp(join(tmpdir(), "codewiki-context-retention-"));
		roots.push(root);
		const store = await createProjectContextStore(root);
		const retained = snapshot("2026-08-02T00:00:00.000Z");
		const removable = snapshot("2026-08-02T01:00:00.000Z", "changed content");
		await store.put(retained);
		await store.put(removable);
		await store.retain({
			refId: "session:SESSION-store",
			ownerKind: "session",
			ownerId: "SESSION-store",
			snapshotDigest: retained.snapshotDigest,
			retainedAt: "2026-08-02T02:00:00.000Z",
		});
		assert.deepEqual(await store.retainedSnapshotDigests(), [retained.snapshotDigest]);
		assert.deepEqual(await store.pruneUnreferenced(0), [removable.snapshotDigest]);
		assert.equal((await readdir(join(root, "chunks"))).length, 1);
		await store.release("session:SESSION-store");
		assert.deepEqual(await store.retainedSnapshotDigests(), []);
	});
});
