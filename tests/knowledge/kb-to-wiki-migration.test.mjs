import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {describe, it} from "node:test";
import {
	assertRetentionStubsHydrated,
	assertSemanticRootState,
	createKbToWikiLegacyEquivalenceProof,
	createKbToWikiMigrationPlan,
	migrationRollbackMode,
	verifyKbToWikiLegacyEquivalenceProof,
	verifyKbToWikiMigrationPlan,
} from "../../src/knowledge/kb-to-wiki-migration.ts";
import {parseWikiItemFile} from "../../src/knowledge/wiki-item.ts";
import {
	createChangeTraceHeader,
	createChangeTraceOperation,
	parseChangeTrace,
	serializeChangeTrace,
} from "../../src/changes/trace/semantic-kernel.ts";

const fixtureRoot = new URL("../fixtures/semantic-kernel/migration/", import.meta.url);

async function fixture() {
	return JSON.parse(await readFile(new URL("source.json", fixtureRoot), "utf8"));
}

function summary(plan) {
	return {
		protocol: plan.protocol,
		migrationIntentDigest: plan.migrationIntentDigest,
		omittedLexiconSourceIds: plan.omittedLexiconSourceIds,
		itemIdentityMap: plan.itemIdentityMap,
		pathMap: plan.pathMap,
		provenanceMap: plan.provenanceMap,
		retirementMap: plan.retirementMap,
		legacyRecordMap: plan.legacyRecordMap,
		itemDigests: plan.items.map(({sourceId, item, path, bytes}) => ({
			sourceId,
			itemId: item.itemId,
			path,
			bytesSha256: createHash("sha256").update(bytes).digest("hex"),
		})),
	};
}

describe("KB-to-Wiki migration contract", () => {
	it("reproduces exact identity, path, record, Lexicon, and Item goldens", async () => {
		const input = await fixture();
		const expected = JSON.parse(
			await readFile(new URL("expected.json", fixtureRoot), "utf8"),
		);
		const first = createKbToWikiMigrationPlan(input);
		const second = createKbToWikiMigrationPlan(structuredClone(input));
		assert.deepEqual(second, first);
		assert.deepEqual(structuredClone(summary(first)), expected);
		assert.equal(first.dryRun, true);
		assert.equal(first.items.length, 4);
		assert.deepEqual(first.omittedLexiconSourceIds, ["lexicon.md"]);
		assert.equal(
			first.items.some(({item}) => item.itemType.toLowerCase().includes("lexicon")),
			false,
		);
		const architecture = first.items.find(
			({item}) => item.itemId === "cw:demo:item:architecture",
		)?.item;
		assert.ok(architecture);
		assert.deepEqual(architecture.aliases, ["Architecture", "Kernel", "Semantic Kernel"]);
		assert.deepEqual(
			structuredClone(architecture.attributes["codewiki.legacy:terms"]),
			[{
				term: "Kernel",
				definition: "Governed semantic core.",
				aliases: ["Semantic Kernel"],
			}],
		);
		for (const planned of first.items) {
			assert.deepEqual(parseWikiItemFile(planned.path, planned.bytes), planned.item);
		}
	});

	it("keeps target commit and mutable backup proofs outside frozen intent identity", async () => {
		const input = await fixture();
		const first = createKbToWikiMigrationPlan(input);
		const changedProofs = structuredClone(input);
		changedProofs.source.quiescenceReceiptDigest = `sha256:${"d".repeat(64)}`;
		changedProofs.source.privateBackupDigest = `sha256:${"e".repeat(64)}`;
		changedProofs.source.backupRef = "refs/codewiki/backups/migrations/demo-source-2";
		const second = createKbToWikiMigrationPlan(changedProofs);
		assert.equal(second.migrationIntentDigest, first.migrationIntentDigest);
		assert.notDeepEqual(second.source, first.source);
		assert.equal("targetCommit" in first, false);
		assert.equal("receiptDigest" in first, false);
	});

	it("replays plans and rejects tampered path, record-order, and intent bindings", async () => {
		const plan = createKbToWikiMigrationPlan(await fixture());
		const replay = verifyKbToWikiMigrationPlan(plan);
		assert.equal(replay.entries.length, plan.items.length);
		const pathTamper = structuredClone(plan);
		pathTamper.pathMap[0].path = ".codewiki/wiki/items/wrong/item.md";
		assert.throws(
			() => verifyKbToWikiMigrationPlan(pathTamper),
			/path map does not replay/u,
		);
		const orderTamper = structuredClone(plan);
		orderTamper.legacyRecordMap[0].sourceOrder = 99;
		assert.throws(
			() => verifyKbToWikiMigrationPlan(orderTamper),
			/out of source order/u,
		);
		const digestTamper = structuredClone(plan);
		digestTamper.migrationIntentDigest = `sha256:${"0".repeat(64)}`;
		assert.throws(
			() => verifyKbToWikiMigrationPlan(digestTamper),
			/intent digest does not replay/u,
		);
	});

	it("proves complete legacy equivalence including provenance and retirement", async () => {
		const input = await fixture();
		const plan = createKbToWikiMigrationPlan(input);
		const proof = createKbToWikiLegacyEquivalenceProof({plan, source: input});
		assert.doesNotThrow(() => verifyKbToWikiLegacyEquivalenceProof(proof, plan));
		assert.equal(proof.retirementCount, 1);
		assert.equal(proof.legacyRecordCount, 6);
		assert.equal(plan.retirementMap[0].targetItemId, "cw:demo:item:retired-policy");
		assert.deepEqual(
			structuredClone(plan.provenanceMap[0].provenance),
			input.subjects[0].provenance,
		);

		const missing = structuredClone(plan);
		missing.legacyRecordMap.pop();
		assert.throws(
			() => createKbToWikiLegacyEquivalenceProof({plan: missing, source: input}),
			/does not exactly replay/u,
		);
		const fabricated = structuredClone(plan);
		fabricated.legacyRecordMap.push({
			sourceRecordId: "legacy:record:fabricated",
			targetItemId: plan.items[0].item.itemId,
			sourceOrder: fabricated.legacyRecordMap.length,
		});
		assert.throws(
			() => createKbToWikiLegacyEquivalenceProof({plan: fabricated, source: input}),
			/does not exactly replay/u,
		);
		const missingRetirement = structuredClone(plan);
		missingRetirement.retirementMap = [];
		missingRetirement.legacyRecordMap.pop();
		assert.throws(
			() => createKbToWikiLegacyEquivalenceProof({plan: missingRetirement, source: input}),
			/does not exactly replay/u,
		);
		const tamperedProof = structuredClone(proof);
		tamperedProof.sourceSemanticDigest = `sha256:${"0".repeat(64)}`;
		assert.throws(
			() => verifyKbToWikiLegacyEquivalenceProof(tamperedProof, plan),
			/proof digest does not replay/u,
		);
	});

	it("requires complete digest-matched retention-stub hydration", () => {
		const digest = `sha256:${"a".repeat(64)}`;
		const stub = {
			stubId: "stub:trace:one",
			restoreRef: "refs/codewiki/backups/migrations/trace-one",
			expectedDigest: digest,
			restoredDigest: digest,
			complete: true,
		};
		assert.doesNotThrow(() => assertRetentionStubsHydrated([stub]));
		assert.throws(
			() => assertRetentionStubsHydrated([{...stub, complete: false}]),
			/not completely hydrated/u,
		);
		assert.throws(
			() => assertRetentionStubsHydrated([{
				...stub,
				restoredDigest: `sha256:${"b".repeat(64)}`,
			}]),
			/not completely hydrated/u,
		);
	});

	it("binds migration Receipt without containing-commit self-reference", async () => {
		const plan = createKbToWikiMigrationPlan(await fixture());
		const receiptDigest = `sha256:${"f".repeat(64)}`;
		const header = createChangeTraceHeader({
			changeId: plan.migrationChangeId,
			projectId: plan.projectId,
			repositoryId: plan.source.repositoryId,
			objectFormat: plan.source.objectFormat,
			createdAt: "2026-08-27T15:00:00.000Z",
			createdBy: "actor:migration:owner",
		});
		const applied = createChangeTraceOperation({
			operationId: "op:migration:applied",
			kind: "migration.applied",
			authorityBearing: true,
			actorId: "actor:migration:owner",
			authorityId: "authority:migration:owner",
			occurredAt: "2026-08-27T15:00:01.000Z",
			payload: {
				migrationId: plan.migrationId,
				migrationIntentDigest: plan.migrationIntentDigest,
				receiptDigest,
			},
		});
		const traceBytes = serializeChangeTrace(header, [applied]);
		assert.equal(parseChangeTrace(traceBytes).operations.at(-1)?.kind, "migration.applied");
		const selfReferential = structuredClone(applied);
		selfReferential.payload.containingCommitOid = plan.source.sourceCommit;
		assert.throws(
			() => serializeChangeTrace(header, [selfReferential]),
			/Unexpected/u,
		);
	});

	it("allows source-ref restore only before target-only canonical history", () => {
		assert.equal(
			migrationRollbackMode({targetOnlyCanonicalOperationObserved: false}),
			"restore_source_backup",
		);
		assert.equal(
			migrationRollbackMode({targetOnlyCanonicalOperationObserved: true}),
			"target_compatible_restore_or_forward_repair",
		);
	});

	it("rejects dual roots and forces old/new readers to refuse opposite authority", () => {
		assert.equal(
			assertSemanticRootState({
				hasKbRoot: true,
				hasWikiRoot: false,
				activeReader: "legacy",
			}),
			"legacy",
		);
		assert.equal(
			assertSemanticRootState({
				hasKbRoot: false,
				hasWikiRoot: true,
				activeReader: "kernel",
			}),
			"kernel",
		);
		assert.throws(
			() => assertSemanticRootState({
				hasKbRoot: true,
				hasWikiRoot: true,
				activeReader: "kernel",
			}),
			/cannot coexist/u,
		);
		assert.throws(
			() => assertSemanticRootState({
				hasKbRoot: false,
				hasWikiRoot: true,
				activeReader: "legacy",
			}),
			/Legacy reader must refuse/u,
		);
		assert.throws(
			() => assertSemanticRootState({
				hasKbRoot: true,
				hasWikiRoot: false,
				activeReader: "kernel",
			}),
			/Kernel reader must refuse/u,
		);
	});

	it("fails closed on collisions, unresolved owners/relationships, and invalid backup proof", async () => {
		const collision = await fixture();
		collision.subjects[1].codewikiId = "cw:demo:item:architecture";
		assert.throws(
			() => createKbToWikiMigrationPlan(collision),
			/Item ID collision/u,
		);
		const unresolved = await fixture();
		unresolved.subjects[1].relationships[0].targetSourceId = "missing.md";
		assert.throws(
			() => createKbToWikiMigrationPlan(unresolved),
			/target missing\.md is unresolved/u,
		);
		const duplicateSource = await fixture();
		duplicateSource.lexicons[0].sourceId = duplicateSource.subjects[0].sourceId;
		assert.throws(
			() => createKbToWikiMigrationPlan(duplicateSource),
			/Legacy semantic source IDs must be unique/u,
		);
		const owner = await fixture();
		owner.lexicons[0].terms[0].ownerSourceId = "missing.md";
		assert.throws(
			() => createKbToWikiMigrationPlan(owner),
			/does not resolve uniquely/u,
		);
		const backup = await fixture();
		backup.source.backupRef = "refs/heads/not-a-migration-backup";
		assert.throws(
			() => createKbToWikiMigrationPlan(backup),
			/reserved immutable namespace/u,
		);
	});
});
