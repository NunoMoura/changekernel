import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
	authorizeProjectContextSnapshot,
	createProjectContextSnapshot,
	expandProjectContextHandle,
	refreshProjectContextSnapshotAtIdleBoundary,
} from "../../../src/project-server/project-context/snapshot.ts";
import {createProjectContextFacade} from "../../../src/runtime/context/project-context-query.ts";
import {canonicalJsonDigest} from "../../../src/utils/canonical-json.ts";

function digest(value) {
	return canonicalJsonDigest(value);
}

function input(capturedAt = "2026-08-01T00:00:00.000Z") {
	const knowledgeRequest = {
		service: "knowledge",
		operation: "subject",
		arguments: {subjectId: "cw:component:knowledge"},
	};
	return {
		stage: "decision",
		subject: {id: "CHG-context", digest: digest("subject")},
		changeRevisionDigest: digest("revision"),
		sources: {
			workState: digest("work-state"),
			knowledgeState: digest("knowledge-state"),
			knowledgeProjection: digest("knowledge-projection"),
			alignment: digest("alignment"),
			repositoryTree: digest("repository-tree"),
			acceptedChanges: digest("accepted-changes"),
			workGraph: digest("work-graph"),
			evidence: digest("evidence"),
			results: digest("results"),
		},
		producerSkillSetDigest: null,
		gateFeedbackDigest: digest("feedback"),
		queryEngine: {id: "codewiki.project-context", version: "1.0.0", digest: digest("engine")},
		routes: [
			{
				request: knowledgeRequest,
				items: [
					{id: "cw:component:knowledge", content: "Accepted Knowledge content."},
					{id: "cw:component:runtime", content: "Accepted Runtime content."},
				],
				sourceReferences: [
					{kind: "knowledge", ref: "cw:component:knowledge", digest: digest("knowledge-cell")},
				],
				coverage: "complete",
				unknowns: [],
			},
			{
				request: {service: "repository", operation: "file", arguments: {path: "src/index.ts"}},
				items: [{path: "src/index.ts", blobDigest: digest("blob"), content: "export {};"}],
				sourceReferences: [{kind: "source", ref: "src/index.ts", digest: digest("blob")}],
				coverage: "complete",
				unknowns: [],
			},
		],
		handles: [{targetKey: "cw:component:knowledge", request: knowledgeRequest, itemIndex: 0}],
		observation: {capturedAt, stale: false, coverage: "complete", unknowns: []},
	};
}

describe("Project Context Snapshot", () => {
	it("separates reusable semantic context from observation identity", () => {
		const first = createProjectContextSnapshot(input());
		const later = createProjectContextSnapshot(input("2026-08-01T01:00:00.000Z"));
		assert.equal(first.manifest.semanticContextDigest, later.manifest.semanticContextDigest);
		assert.notEqual(first.observation.observationDigest, later.observation.observationDigest);
		assert.notEqual(first.snapshotDigest, later.snapshotDigest);
		assert.equal(first.manifest.protocol.id, "codewiki.project-context-snapshot");
	});

	it("serves typed local direct, cursor, and batch queries", () => {
		const snapshot = createProjectContextSnapshot(input());
		const facade = createProjectContextFacade(snapshot);
		const first = facade.knowledge({
			operation: "subject",
			arguments: {subjectId: "cw:component:knowledge"},
			limit: 1,
		});
		assert.equal(first.snapshotDigest, snapshot.snapshotDigest);
		assert.equal(first.items.length, 1);
		assert.equal(first.truncated, true);
		assert.ok(first.nextCursor);
		const second = facade.knowledge({
			operation: "subject",
			arguments: {subjectId: "cw:component:knowledge"},
			limit: 1,
			cursor: first.nextCursor,
		});
		assert.equal(second.items[0].id, "cw:component:runtime");
		assert.equal(second.truncated, false);
		const batch = facade.batch([
			{
				request: {service: "repository", operation: "file", arguments: {path: "src/index.ts"}},
				limit: 10,
			},
		]);
		assert.equal(batch.results[0].items[0].path, "src/index.ts");
	});

	it("expands only exact snapshot-bound context handles", () => {
		const first = createProjectContextSnapshot(input());
		const later = createProjectContextSnapshot(input("2026-08-01T01:00:00.000Z"));
		const handle = first.handles[0].handle;
		assert.equal(expandProjectContextHandle(first, handle).targetKey, "cw:component:knowledge");
		assert.throws(
			() => expandProjectContextHandle(later, handle),
			/foreign or stale/u,
		);
	});

	it("binds authorization and refreshes only at an exact idle boundary", () => {
		const first = createProjectContextSnapshot(input());
		const later = createProjectContextSnapshot(input("2026-08-01T01:00:00.000Z"));
		const authorization = authorizeProjectContextSnapshot({
			snapshot: first,
			runId: "RUN-context",
			actorDigest: digest("actor"),
			authorizedAt: "2026-08-01T00:00:00.000Z",
			expiresAt: "2026-08-01T02:00:00.000Z",
		});
		assert.equal(authorization.snapshotDigest, first.snapshotDigest);
		const boundary = {
			currentSnapshotDigest: first.snapshotDigest,
			sessionId: "SESSION-context",
			idle: true,
			openTurn: false,
			pendingToolCalls: 0,
			pendingChildren: 0,
		};
		assert.equal(
			refreshProjectContextSnapshotAtIdleBoundary({current: first, next: later, boundary}),
			later,
		);
		assert.throws(
			() => refreshProjectContextSnapshotAtIdleBoundary({
				current: first,
				next: later,
				boundary: {...boundary, openTurn: true},
			}),
			/exact idle boundary/u,
		);
	});
});
