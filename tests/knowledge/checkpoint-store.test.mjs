import assert from "node:assert/strict";
import {
	mkdtemp,
	mkdir,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {describe, it} from "node:test";
import {createKnowledgePostStateArtifact} from "../../src/changes/trace/identity.ts";
import {
	applyKnowledgeCandidateCheckpoint,
	loadKnowledgeCheckpoint,
} from "../../src/knowledge/checkpoint-store.ts";
import {compileKnowledgeTransition} from "../../src/knowledge/materialization.ts";
import {knowledgeCellByTarget} from "../../src/knowledge/state.ts";

const target = {subjectId: "cw:component:stored"};

function document(meaning) {
	return `---\ncodewiki_id: cw:component:stored\ntype: System Component\ntitle: Stored\nstatus: stable\n---\n# Stored\n\n${meaning}\n`;
}

async function fixture() {
	const root = await mkdtemp(join(tmpdir(), "codewiki-knowledge-store-"));
	const knowledge = join(root, ".codewiki/kb/system/components");
	await mkdir(knowledge, {recursive: true});
	await writeFile(join(knowledge, "stored.md"), document("Current."));
	return root;
}

describe("Knowledge checkpoint storage", () => {
	it("applies only exact compiled projection bytes under a checkpoint CAS", async () => {
		const root = await fixture();
		try {
			const base = await loadKnowledgeCheckpoint({repoRoot: root});
			const transition = {
				kind: "effects",
				effects: [
					{
						action: "set",
						target,
						expected: knowledgeCellByTarget(base, target).digest,
						postState: createKnowledgePostStateArtifact({
							mediaType: "text/markdown",
							content: document("Projected."),
						}),
					},
				],
			};
			const checkpoint = compileKnowledgeTransition({base, transition});
			const applied = await applyKnowledgeCandidateCheckpoint({
				repoRoot: root,
				checkpoint,
				transition,
			});
			assert.equal(applied.checkpointDigest, checkpoint.projected.checkpointDigest);
			assert.equal(
				await readFile(
					join(root, ".codewiki/kb/system/components/stored.md"),
					"utf8",
				),
				document("Projected."),
			);
		} finally {
			await rm(root, {recursive: true, force: true});
		}
	});

	it("fails closed on changed bytes and symlink traversal", async () => {
		const root = await fixture();
		try {
			const base = await loadKnowledgeCheckpoint({repoRoot: root});
			const transition = {
				kind: "effects",
				effects: [
					{
						action: "set",
						target,
						expected: knowledgeCellByTarget(base, target).digest,
						postState: createKnowledgePostStateArtifact({
							mediaType: "text/markdown",
							content: document("Projected."),
						}),
					},
				],
			};
			const checkpoint = compileKnowledgeTransition({base, transition});
			await writeFile(
				join(root, ".codewiki/kb/system/components/stored.md"),
				document("Concurrent change."),
			);
			await assert.rejects(
				applyKnowledgeCandidateCheckpoint({repoRoot: root, checkpoint, transition}),
				/base is stale/u,
			);
			await symlink(
				join(root, ".codewiki/kb/system/components/stored.md"),
				join(root, ".codewiki/kb/alias.md"),
			);
			await assert.rejects(
				loadKnowledgeCheckpoint({repoRoot: root}),
				/cannot contain symlink/u,
			);
		} finally {
			await rm(root, {recursive: true, force: true});
		}
	});
});
