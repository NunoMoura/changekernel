import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {describe, it} from "node:test";
import {
	changeTracePath,
	createChangeTraceHeader,
} from "../../src/changes/trace/semantic-kernel.ts";
import {
	createKbToWikiLegacyEquivalenceProof,
	createKbToWikiMigrationPlan,
} from "../../src/knowledge/kb-to-wiki-migration.ts";
import {
	assertKbToWikiMigrationReceipt,
	createKbToWikiActiveProposalOperation,
	createKbToWikiMigrationReceipt,
} from "../../src/knowledge/kb-to-wiki-receipt.ts";

const sourceFixtureUrl = new URL(
	"../fixtures/semantic-kernel/migration/source.json",
	import.meta.url,
);
const digest = `sha256:${"a".repeat(64)}`;

function oid(hex = "1".repeat(40)) {
	return {algorithm: "sha1", hex};
}

async function fixture() {
	const source = JSON.parse(await readFile(sourceFixtureUrl, "utf8"));
	const plan = createKbToWikiMigrationPlan(source);
	const legacyEquivalence = createKbToWikiLegacyEquivalenceProof({plan, source});
	const activePlan = {
		changeId: "CHG-active",
		expectedManagedRef: "refs/codewiki/changes/CHG-active",
		proposalOperation: {
			operationId: "op:active:proposed",
			actorId: "actor:migration:owner",
			authorityId: "authority:migration:owner",
			occurredAt: "2026-08-27T16:00:04.000Z",
			payload: {
				intent: "Preserve active legacy Change through migration.",
				rationale: "Active intent must remain represented.",
				desiredOutcomes: ["Active Change remains available."],
				authorityIntent: ["project.change.propose"],
				relatedChangeIds: [],
				compensatesChangeIds: [],
				supersedesChangeIds: [],
				targetRefs: ["cw:demo:item:architecture"],
				completionRequirements: [],
				completionRationale: "Legacy unresolved intent remains explicit.",
			},
		},
		proposedWiki: [],
		commit: {
			author: "CodeWiki Migration <migration@example.test> 1787846404 +0000",
			committer: "CodeWiki Migration <migration@example.test> 1787846404 +0000",
			message: "active proposal\n",
		},
	};
	const itemBlobOids = Object.fromEntries(
		plan.items.map(({path}, index) => [path, oid(String(index + 2).repeat(40))]),
	);
	const input = {
		plan,
		legacyEquivalence,
		kernelBuildDigest: digest,
		migrationImplementationDigest: `sha256:${"b".repeat(64)}`,
		configurationPlan: {
			path: ".codewiki/config.json",
			sourceBlobOid: oid("7".repeat(40)),
			sourceDigest: `sha256:${"7".repeat(64)}`,
			targetBlobOid: oid("8".repeat(40)),
			targetDigest: `sha256:${"8".repeat(64)}`,
			targetProtocol: {id: "codewiki.project-config", version: "2.0.0"},
		},
		privateStatePlan: {
			backupId: plan.source.privateBackupDigest,
			sourceGeneration: 1,
			sourceStateDigest: `sha256:${"6".repeat(64)}`,
			sourceBackendBuildDigest: plan.source.sourceBuildDigest,
			targetGeneration: 2,
			targetBackendBuildDigest: `sha256:${"5".repeat(64)}`,
		},
		wikiItemsTreeOid: oid("c".repeat(40)),
		itemBlobOids,
		convertedTraceBlobOids: {
			[changeTracePath("CHG-old")]: oid("d".repeat(40)),
			[changeTracePath("CHG-active")]: oid("e".repeat(40)),
		},
		migrationTracePreOperationBlobOid: oid("f".repeat(40)),
		activeChangePlans: [activePlan],
	};
	return {source, plan, activePlan, input};
}

describe("KB-to-Wiki Migration Receipt", () => {
	it("binds candidate-independent migration and active-Change plans", async () => {
		const {plan, activePlan, input} = await fixture();
		const receipt = createKbToWikiMigrationReceipt(input);
		assert.doesNotThrow(() => assertKbToWikiMigrationReceipt(receipt));
		const serialized = JSON.stringify(receipt);
		assert.doesNotMatch(serialized, /candidateCommit|proposalCommit|expectedCanonical/u);
		const header = createChangeTraceHeader({
			changeId: activePlan.changeId,
			projectId: plan.projectId,
			repositoryId: plan.source.repositoryId,
			objectFormat: plan.source.objectFormat,
			createdAt: "2026-08-27T16:00:03.000Z",
			createdBy: "actor:migration:owner",
		});
		const candidateCommit = oid("9".repeat(40));
		const operation = createKbToWikiActiveProposalOperation({
			plan: receipt.activeChangePlans[0],
			migrationPlan: receipt.plan,
			candidateCommit,
			traceHeader: header,
		});
		assert.deepEqual(
			structuredClone(operation.payload.expectedCanonical),
			candidateCommit,
		);
	});

	it("rejects omitted, fabricated, tampered, and candidate-dependent bindings", async () => {
		const {input} = await fixture();
		const missingItem = structuredClone(input);
		delete missingItem.itemBlobOids[Object.keys(missingItem.itemBlobOids)[0]];
		assert.throws(
			() => createKbToWikiMigrationReceipt(missingItem),
			/Item blob paths/u,
		);
		const candidateDependent = structuredClone(input);
		candidateDependent.activeChangePlans[0].proposalOperation.payload.expectedCanonical = oid();
		assert.throws(
			() => createKbToWikiMigrationReceipt(candidateDependent),
			/candidate-dependent expectedCanonical/u,
		);
		const duplicateWiki = structuredClone(input);
		duplicateWiki.activeChangePlans[0].proposedWiki = [{
			path: ".codewiki/wiki/items/custom/duplicate.md",
			bytes: input.plan.items[0].bytes,
		}];
		assert.throws(
			() => createKbToWikiMigrationReceipt(duplicateWiki),
			/occurs at .* and/u,
		);
		const wrongRef = structuredClone(input);
		wrongRef.activeChangePlans[0].expectedManagedRef = "refs/codewiki/changes/CHG-other";
		assert.throws(
			() => createKbToWikiMigrationReceipt(wrongRef),
			/managed ref does not match/u,
		);
		const receipt = structuredClone(createKbToWikiMigrationReceipt(input));
		receipt.legacyEquivalence.proofDigest = `sha256:${"0".repeat(64)}`;
		assert.throws(
			() => assertKbToWikiMigrationReceipt(receipt),
			/proof digest does not replay/u,
		);
		const fabricated = structuredClone(createKbToWikiMigrationReceipt(input));
		fabricated.proposalCommit = oid();
		assert.throws(
			() => assertKbToWikiMigrationReceipt(fabricated),
			/Unexpected fields/u,
		);
	});
});
