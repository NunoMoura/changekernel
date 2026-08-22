import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {createKnowledgePostStateArtifact} from "../../../src/changes/trace/identity.ts";
import {expandProjectContextKnowledgeTransition} from "../../../src/project-server/project-context/handle-expansion.ts";
import {createTestProjectContextSnapshot} from "../../helpers/project-context.mjs";
import {canonicalJsonDigest} from "../../../src/utils/canonical-json.ts";

describe("Project Context revision-authoring handles", () => {
	it("expands exact snapshot-bound handles before canonical revision identity", () => {
		const snapshot = createTestProjectContextSnapshot();
		const transition = expandProjectContextKnowledgeTransition({
			snapshot,
			expectedSnapshotDigest: snapshot.snapshotDigest,
			transition: {
				kind: "effects",
				effects: [{
					action: "set",
					target: {contextHandle: snapshot.handles[0].handle},
					expected: canonicalJsonDigest("prior"),
					postState: createKnowledgePostStateArtifact({
						mediaType: "text/markdown",
						content: "---\ncodewiki_id: cw:component:runtime\ntype: System Component\ntitle: Runtime\nstatus: stable\n---\n# Runtime\n\nUpdated.",
					}),
				}],
			},
		});
		assert.deepEqual(transition.effects[0].target, {subjectId: "cw:component:runtime"});
		assert.equal(JSON.stringify(transition).includes("pch:"), false);
	});

	it("rejects foreign snapshots and handles", () => {
		const first = createTestProjectContextSnapshot();
		const later = createTestProjectContextSnapshot({capturedAt: "2026-08-18T14:00:00.000Z"});
		assert.throws(
			() => expandProjectContextKnowledgeTransition({
				snapshot: later,
				expectedSnapshotDigest: first.snapshotDigest,
				transition: {kind: "unchanged", refs: [], rationale: "No Knowledge change."},
			}),
			/exact expected snapshot/u,
		);
		assert.throws(
			() => expandProjectContextKnowledgeTransition({
				snapshot: later,
				expectedSnapshotDigest: later.snapshotDigest,
				transition: {
					kind: "unchanged",
					refs: [{contextHandle: first.handles[0].handle}],
					rationale: "No Knowledge change.",
				},
			}),
			/foreign or stale/u,
		);
	});
});
