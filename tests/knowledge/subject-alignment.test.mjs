import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
	captureKnowledgeSubjectAlignmentBaseline,
	knowledgeSubjectIdsFromRecords,
	projectKnowledgeAlignment,
	readKnowledgeSubjectDigests,
} from "../../src/knowledge/subject-alignment.ts";

const ref = "cw:component:overview";
const knowledgePath = ".codewiki/kb/system/components/overview.md";

function decisionRecord(baseline) {
	return {
		type: "trace_event",
		id: "decision-1",
		parentId: null,
		traceId: "TRACE-alignment",
		sequence: 1,
		loop: "decision",
		event: "change_approved",
		refs: [ref],
		createdAt: "2026-07-16T00:00:00.000Z",
		data: {
			output: {
				changeRecord: {
					change: {
						id: "CHG-alignment",
						knowledge: {
							kind: "unchanged",
							refs: [{subjectId: ref}],
							rationale: "Alignment-only fixture.",
						},
					},
				},
				decision: { disposition: "approve" },
				knowledgeAlignmentBaseline: baseline,
			},
		},
	};
}

describe("topic-scoped Knowledge alignment", () => {
	it("captures Decision baselines and distinguishes aligned from review needed", async () => {
		const root = await mkdtemp(join(tmpdir(), "codewiki-topic-alignment-"));
		try {
			const path = join(root, knowledgePath);
			await mkdir(join(root, ".codewiki", "kb", "system", "components"), {
				recursive: true,
			});
			await writeFile(
				path,
				"---\ntype: System Component\ncodewiki_id: cw:component:overview\ntitle: Overview\n---\n# Overview\n",
				"utf8",
			);
			const baseline = await captureKnowledgeSubjectAlignmentBaseline(
				root,
				[ref],
				"2026-07-16T00:00:00.000Z",
			);
			assert.equal(baseline.subjects.length, 1);
			const records = [decisionRecord(baseline)];
			assert.deepEqual(knowledgeSubjectIdsFromRecords(records), [ref]);
			const current = await readKnowledgeSubjectDigests(root, [ref]);
			assert.equal(
				projectKnowledgeAlignment({
					records,
					subjectIds: [ref],
					currentDigests: current,
				}).state,
				"aligned",
			);
			await writeFile(
				path,
				"---\ntype: System Component\ncodewiki_id: cw:component:overview\ntitle: Overview\n---\n# Overview\n\nChanged.\n",
				"utf8",
			);
			const changed = await readKnowledgeSubjectDigests(root, [ref]);
			const projection = projectKnowledgeAlignment({
				records,
				subjectIds: [ref],
				currentDigests: changed,
			});
			assert.equal(projection.state, "review_needed");
			assert.match(
				projection.rationale,
				/changed since the validated baseline/,
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("uses Unknown for insufficient evidence and Misaligned only for grounded findings", () => {
		assert.equal(
			projectKnowledgeAlignment({ records: [], subjectIds: [ref] }).state,
			"unknown",
		);
		assert.equal(
			projectKnowledgeAlignment({
				records: [],
				subjectIds: [],
				noKnowledgeImpactReason: "No Product or System Knowledge is affected.",
			}).state,
			"aligned",
		);
		const finding = {
			type: "trace_event",
			id: "finding-1",
			parentId: null,
			traceId: "TRACE-alignment",
			sequence: 2,
			loop: "implementation",
			event: "alignment_reviewed",
			refs: [ref],
			createdAt: "2026-07-16T01:00:00.000Z",
			data: {
				knowledgeAlignmentFinding: {
					affectedLayer: "product",
					sourceRefs: [ref],
					rationale:
						"Implemented behavior contradicts the declared Product contract.",
					recommendedNextLoop: "decision",
				},
			},
		};
		const projection = projectKnowledgeAlignment({
			records: [finding],
			subjectIds: [ref],
		});
		assert.equal(projection.state, "misaligned");
		assert.equal(projection.findings.length, 1);
	});
});
