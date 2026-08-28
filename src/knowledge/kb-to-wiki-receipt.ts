import {
	canonicalJson,
	canonicalJsonDigest,
	parseCanonicalJson,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../utils/canonical-json.ts";
import {
	assertRequiredExactKeys as assertExactKeys,
	plainRecord as record,
} from "../utils/json.ts";
import {assertNfcString} from "../utils/semantic-digest.ts";
import {
	assertCanonicalRef,
	assertGitOid,
	assertStableId,
	type GitOid,
} from "../project/git-store-profile.ts";
import {
	changeTracePath,
	createChangeTraceHeader,
	createChangeTraceOperation,
	serializeChangeTrace,
	type ChangeTraceHeader,
	type ChangeTraceOperation,
} from "../changes/trace/semantic-kernel.ts";
import {
	assertPortableWikiItemPath,
	parseWikiItemFile,
} from "./wiki-item.ts";
import {validateWikiTree} from "./wiki-tree.ts";
import {
	verifyKbToWikiLegacyEquivalenceProof,
	verifyKbToWikiMigrationPlan,
	type KbToWikiLegacyEquivalenceProof,
	type KbToWikiMigrationPlan,
} from "./kb-to-wiki-migration.ts";

export const KB_TO_WIKI_MIGRATION_RECEIPT_PROTOCOL =
	"codewiki.kb-to-wiki-migration-receipt@2.0.0" as const;

export interface MigrationProposalOperationPlan {
	readonly operationId: string;
	readonly actorId: string;
	readonly authorityId: string;
	readonly occurredAt: string;
	readonly payload: Readonly<Record<string, CanonicalJsonValue>>;
}

export interface MigrationProposalWikiFile {
	readonly path: string;
	readonly bytes: string | null;
}

export interface MigrationProposalCommitPlan {
	readonly author: string;
	readonly committer: string;
	readonly message: string;
}

export interface MigrationActiveChangePlan {
	readonly changeId: string;
	readonly expectedManagedRef: string;
	readonly proposalOperation: MigrationProposalOperationPlan;
	readonly proposedWiki: readonly MigrationProposalWikiFile[];
	readonly commit: MigrationProposalCommitPlan;
}

interface MigrationConfigurationPlan {
	readonly path: ".codewiki/config.json";
	readonly sourceBlobOid: GitOid;
	readonly sourceDigest: Sha256Digest;
	readonly targetBlobOid: GitOid;
	readonly targetDigest: Sha256Digest;
	readonly targetProtocol: Readonly<{
		readonly id: "codewiki.project-config";
		readonly version: "2.0.0";
	}>;
}

interface MigrationPrivateStatePlan {
	readonly backupId: Sha256Digest;
	readonly sourceGeneration: number;
	readonly sourceStateDigest: Sha256Digest;
	readonly sourceBackendBuildDigest: Sha256Digest;
	readonly targetGeneration: number;
	readonly targetBackendBuildDigest: Sha256Digest;
}

export interface KbToWikiMigrationReceipt {
	readonly protocol: typeof KB_TO_WIKI_MIGRATION_RECEIPT_PROTOCOL;
	readonly plan: KbToWikiMigrationPlan;
	readonly legacyEquivalence: KbToWikiLegacyEquivalenceProof;
	readonly kernelBuildDigest: Sha256Digest;
	readonly migrationImplementationDigest: Sha256Digest;
	readonly configurationPlan: MigrationConfigurationPlan;
	readonly privateStatePlan: MigrationPrivateStatePlan;
	readonly wikiItemsTreeOid: GitOid | null;
	readonly itemBlobOids: Readonly<Record<string, GitOid>>;
	readonly convertedTraceBlobOids: Readonly<Record<string, GitOid>>;
	readonly migrationTracePreOperationBlobOid: GitOid;
	readonly activeChangePlans: readonly MigrationActiveChangePlan[];
	readonly receiptDigest: Sha256Digest;
}

export type CreateKbToWikiMigrationReceiptInput = Omit<
	KbToWikiMigrationReceipt,
	"protocol" | "receiptDigest"
>;

export function createKbToWikiMigrationReceipt(
	input: CreateKbToWikiMigrationReceiptInput,
): KbToWikiMigrationReceipt {
	// SAFETY: canonical serialization plus assertion below validate every Receipt field.
	const normalized = parseCanonicalJson(canonicalJson({
		protocol: KB_TO_WIKI_MIGRATION_RECEIPT_PROTOCOL,
		...input,
	})) as unknown as Omit<KbToWikiMigrationReceipt, "receiptDigest">;
	const receipt = Object.freeze({
		...normalized,
		receiptDigest: migrationReceiptDigest(normalized),
	});
	assertKbToWikiMigrationReceipt(receipt);
	return receipt;
}

export function assertKbToWikiMigrationReceipt(
	value: unknown,
): asserts value is KbToWikiMigrationReceipt {
	const receipt = record(value, "Migration Receipt");
	assertExactKeys(receipt, [
		"activeChangePlans",
		"configurationPlan",
		"convertedTraceBlobOids",
		"itemBlobOids",
		"kernelBuildDigest",
		"legacyEquivalence",
		"migrationImplementationDigest",
		"migrationTracePreOperationBlobOid",
		"plan",
		"privateStatePlan",
		"protocol",
		"receiptDigest",
		"wikiItemsTreeOid",
	]);
	if (receipt.protocol !== KB_TO_WIKI_MIGRATION_RECEIPT_PROTOCOL) {
		throw new Error(`Migration Receipt protocol must be ${KB_TO_WIKI_MIGRATION_RECEIPT_PROTOCOL}.`);
	}
	const plan = receipt.plan as KbToWikiMigrationPlan;
	verifyKbToWikiMigrationPlan(plan);
	verifyKbToWikiLegacyEquivalenceProof(
		receipt.legacyEquivalence as KbToWikiLegacyEquivalenceProof,
		plan,
	);
	assertDigest(receipt.kernelBuildDigest, "Migration Receipt kernelBuildDigest");
	assertDigest(
		receipt.migrationImplementationDigest,
		"Migration Receipt migrationImplementationDigest",
	);
	// SAFETY: both validators below replay every required field before use.
	assertConfigurationPlan(
		receipt.configurationPlan as MigrationConfigurationPlan,
		plan,
	);
	assertPrivateStatePlan(receipt.privateStatePlan as MigrationPrivateStatePlan, plan);
	const wikiItemsTreeOid = receipt.wikiItemsTreeOid;
	if (wikiItemsTreeOid === null) {
		if (plan.items.length !== 0) {
			throw new Error("Migration Receipt requires Wiki Items tree identity for emitted Items.");
		}
	} else {
		assertGitOid(wikiItemsTreeOid, "Migration Receipt Wiki Items tree", plan.source.objectFormat);
	}
	const itemBlobOids = oidMap(
		receipt.itemBlobOids,
		"Migration Receipt Item blob",
		plan.source.objectFormat,
	);
	const expectedItemPaths = plan.items.map(({path}) => path).sort(compareText);
	assertSameStrings(Object.keys(itemBlobOids).sort(compareText), expectedItemPaths, "Item blob paths");
	const convertedTraceBlobOids = oidMap(
		receipt.convertedTraceBlobOids,
		"Migration Receipt converted Trace blob",
		plan.source.objectFormat,
	);
	const migrationTracePath = changeTracePath(plan.migrationChangeId);
	if (Object.hasOwn(convertedTraceBlobOids, migrationTracePath)) {
		throw new Error("Migration Receipt converted Trace map must exclude migration Trace.");
	}
	assertGitOid(
		receipt.migrationTracePreOperationBlobOid,
		"Migration Receipt predecessor Trace blob",
		plan.source.objectFormat,
	);
	if (!Array.isArray(receipt.activeChangePlans)) {
		throw new Error("Migration Receipt activeChangePlans must be an array.");
	}
	const changeIds = new Set<string>();
	let previousChangeId: string | null = null;
	for (const activePlan of receipt.activeChangePlans) {
		assertActiveChangePlan(activePlan, plan);
		if (changeIds.has(activePlan.changeId) || (
			previousChangeId !== null && compareText(previousChangeId, activePlan.changeId) >= 0
		)) {
			throw new Error("Migration Receipt active Change plans must be unique and sorted.");
		}
		changeIds.add(activePlan.changeId);
		previousChangeId = activePlan.changeId;
		if (
			activePlan.changeId !== plan.migrationChangeId &&
			!Object.hasOwn(convertedTraceBlobOids, changeTracePath(activePlan.changeId))
		) {
			throw new Error("Active Change plan lacks an exact converted Trace blob binding.");
		}
	}
	assertDigest(receipt.receiptDigest, "Migration Receipt receiptDigest");
	const {receiptDigest: _receiptDigest, ...body} = receipt;
	if (
		receipt.receiptDigest !== migrationReceiptDigest(
			body as Omit<KbToWikiMigrationReceipt, "receiptDigest">,
		)
	) {
		throw new Error("Migration Receipt digest does not replay.");
	}
}

function migrationReceiptDigest(
	body: Omit<KbToWikiMigrationReceipt, "receiptDigest">,
): Sha256Digest {
	return canonicalJsonDigest({
		protocol: "codewiki.kb-to-wiki-migration-receipt-digest@1.0.0",
		receipt: body,
	});
}

export function createKbToWikiActiveProposalOperation(input: {
	readonly plan: MigrationActiveChangePlan;
	readonly migrationPlan: KbToWikiMigrationPlan;
	readonly candidateCommit: GitOid;
	readonly traceHeader: ChangeTraceHeader;
}): ChangeTraceOperation {
	assertActiveChangePlan(input.plan, input.migrationPlan);
	assertGitOid(
		input.candidateCommit,
		"Migration candidate commit",
		input.migrationPlan.source.objectFormat,
	);
	if (
		input.traceHeader.changeId !== input.plan.changeId ||
		input.traceHeader.projectId !== input.migrationPlan.projectId ||
		input.traceHeader.repositoryId !== input.migrationPlan.source.repositoryId ||
		input.traceHeader.objectFormat !== input.migrationPlan.source.objectFormat
	) {
		throw new Error("Active Change plan and converted Trace header disagree.");
	}
	return createKbToWikiActiveProposalOperationUnchecked(input);
}

function assertConfigurationPlan(
	value: MigrationConfigurationPlan,
	migrationPlan: KbToWikiMigrationPlan,
): asserts value is MigrationConfigurationPlan {
	const plan = record(value, "Migration configuration plan");
	assertExactKeys(plan, [
		"path",
		"sourceBlobOid",
		"sourceDigest",
		"targetBlobOid",
		"targetDigest",
		"targetProtocol",
	]);
	if (plan.path !== ".codewiki/config.json") {
		throw new Error("Migration configuration path is invalid.");
	}
	assertGitOid(
		plan.sourceBlobOid,
		"Migration source configuration blob",
		migrationPlan.source.objectFormat,
	);
	assertGitOid(
		plan.targetBlobOid,
		"Migration target configuration blob",
		migrationPlan.source.objectFormat,
	);
	if ((plan.sourceBlobOid as GitOid).hex === (plan.targetBlobOid as GitOid).hex) {
		throw new Error("Migration configuration must remove legacy Domain selection.");
	}
	assertDigest(plan.sourceDigest, "Migration source configuration digest");
	assertDigest(plan.targetDigest, "Migration target configuration digest");
	const protocol = record(plan.targetProtocol, "Migration target configuration protocol");
	assertExactKeys(protocol, ["id", "version"]);
	if (protocol.id !== "codewiki.project-config" || protocol.version !== "2.0.0") {
		throw new Error("Migration target configuration protocol is invalid.");
	}
}

function assertPrivateStatePlan(
	value: MigrationPrivateStatePlan,
	migrationPlan: KbToWikiMigrationPlan,
): asserts value is MigrationPrivateStatePlan {
	const plan = record(value, "Migration private state plan");
	assertExactKeys(plan, [
		"backupId",
		"sourceBackendBuildDigest",
		"sourceGeneration",
		"sourceStateDigest",
		"targetBackendBuildDigest",
		"targetGeneration",
	]);
	assertDigest(plan.backupId, "Migration private state backupId");
	if (plan.backupId !== migrationPlan.source.privateBackupDigest) {
		throw new Error("Migration private state backup does not match migration source.");
	}
	assertDigest(plan.sourceStateDigest, "Migration private source state digest");
	assertDigest(plan.sourceBackendBuildDigest, "Migration private source Backend Build digest");
	if (plan.sourceBackendBuildDigest !== migrationPlan.source.sourceBuildDigest) {
		throw new Error("Migration private source Backend Build does not match migration source.");
	}
	assertDigest(plan.targetBackendBuildDigest, "Migration private target Backend Build digest");
	if (!Number.isSafeInteger(plan.sourceGeneration) || (plan.sourceGeneration as number) < 1) {
		throw new Error("Migration private source generation is invalid.");
	}
	if (plan.targetGeneration !== (plan.sourceGeneration as number) + 1) {
		throw new Error("Migration private target generation must advance exactly once.");
	}
}

function assertActiveChangePlan(
	value: unknown,
	migrationPlan: KbToWikiMigrationPlan,
): asserts value is MigrationActiveChangePlan {
	const plan = record(value, "Migration active Change plan");
	assertExactKeys(plan, [
		"changeId",
		"commit",
		"expectedManagedRef",
		"proposalOperation",
		"proposedWiki",
	]);
	assertStableId(plan.changeId, "Migration active Change plan changeId");
	changeTracePath(plan.changeId);
	assertCanonicalRef(plan.expectedManagedRef);
	if (plan.expectedManagedRef !== `refs/codewiki/changes/${plan.changeId}`) {
		throw new Error("Migration active Change plan managed ref does not match Change identity.");
	}
	const operation = record(plan.proposalOperation, "Migration proposal operation plan");
	assertExactKeys(operation, [
		"actorId",
		"authorityId",
		"occurredAt",
		"operationId",
		"payload",
	]);
	assertStableId(operation.operationId, "Migration proposal operationId");
	assertStableId(operation.actorId, "Migration proposal actorId");
	assertStableId(operation.authorityId, "Migration proposal authorityId");
	assertIsoTimestamp(operation.occurredAt, "Migration proposal occurredAt");
	const payload = record(operation.payload, "Migration proposal payload");
	if (Object.hasOwn(payload, "expectedCanonical")) {
		throw new Error("Migration active Change plan cannot contain candidate-dependent expectedCanonical.");
	}
	const placeholder = {
		algorithm: migrationPlan.source.objectFormat,
		hex: (migrationPlan.source.objectFormat === "sha1" ? "0".repeat(40) : "0".repeat(64)),
	} as const;
	const header = createChangeTraceHeader({
		changeId: plan.changeId,
		projectId: migrationPlan.projectId,
		repositoryId: migrationPlan.source.repositoryId,
		objectFormat: migrationPlan.source.objectFormat,
		createdAt: operation.occurredAt as string,
		createdBy: operation.actorId as string,
	});
	// SAFETY: exact-key and field assertions above validate active-plan shape.
	createKbToWikiActiveProposalOperationUnchecked({
		plan: plan as unknown as MigrationActiveChangePlan,
		candidateCommit: placeholder,
		traceHeader: header,
	});
	if (!Array.isArray(plan.proposedWiki)) {
		throw new Error("Migration active Change proposedWiki must be an array.");
	}
	let previousPath: string | null = null;
	for (const fileValue of plan.proposedWiki) {
		const file = record(fileValue, "Migration proposed Wiki file");
		assertExactKeys(file, ["bytes", "path"]);
		assertPortableWikiItemPath(file.path);
		if (file.bytes === null) {
			if (!migrationPlan.items.some(({path}) => path === file.path)) {
				throw new Error("Migration proposed Wiki deletion must target a migrated Item path.");
			}
		} else {
			assertNfcString(file.bytes, "Migration proposed Wiki bytes", 1, 1024 * 1024);
			parseWikiItemFile(file.path, file.bytes);
		}
		if (previousPath !== null && compareText(previousPath, file.path) >= 0) {
			throw new Error("Migration proposed Wiki files must be unique and sorted.");
		}
		previousPath = file.path;
	}
	// SAFETY: exact-key and proposed-Wiki field checks above validate this plan shape.
	validateProposedWiki(plan as unknown as MigrationActiveChangePlan, migrationPlan);
	const commit = record(plan.commit, "Migration proposal commit plan");
	assertExactKeys(commit, ["author", "committer", "message"]);
	assertGitIdentity(commit.author, "Migration proposal author");
	assertGitIdentity(commit.committer, "Migration proposal committer");
	assertNfcString(commit.message, "Migration proposal commit message", 1, 16_384);
	if (commit.message.includes("\r") || !commit.message.endsWith("\n")) {
		throw new Error("Migration proposal commit message must use LF and end with LF.");
	}
}

function validateProposedWiki(
	plan: MigrationActiveChangePlan,
	migrationPlan: KbToWikiMigrationPlan,
): void {
	const entries = new Map(migrationPlan.items.map(({path, bytes}) => [path, bytes]));
	for (const file of plan.proposedWiki) {
		if (file.bytes === null) entries.delete(file.path);
		else entries.set(file.path, file.bytes);
	}
	validateWikiTree(
		[...entries].map(([path, bytes]) => ({path, bytes})),
		{retiredItemIds: migrationPlan.retirementMap.map(({targetItemId}) => targetItemId)},
	);
}

function createKbToWikiActiveProposalOperationUnchecked(input: {
	readonly plan: MigrationActiveChangePlan;
	readonly candidateCommit: GitOid;
	readonly traceHeader: ChangeTraceHeader;
}): ChangeTraceOperation {
	const operation = createChangeTraceOperation({
		...input.plan.proposalOperation,
		kind: "change.proposed",
		authorityBearing: true,
		payload: {
			...input.plan.proposalOperation.payload,
			expectedCanonical: {
				algorithm: input.candidateCommit.algorithm,
				hex: input.candidateCommit.hex,
			},
		},
	});
	serializeChangeTrace(input.traceHeader, [operation]);
	return operation;
}

function oidMap(
	value: unknown,
	field: string,
	objectFormat: "sha1" | "sha256",
): Record<string, GitOid> {
	const map = record(value, field);
	for (const [path, oid] of Object.entries(map)) {
		assertNfcString(path, `${field} path`, 1, 16_384);
		assertGitOid(oid, `${field} ${path}`, objectFormat);
	}
	return map as Record<string, GitOid>;
}

function assertGitIdentity(value: unknown, field: string): asserts value is string {
	assertNfcString(value, field, 1, 1024);
	if (!/^[^\n<>]+ <[^\n<>]+> [0-9]+ [+-][0-9]{4}$/u.test(value)) {
		throw new Error(`${field} must be an exact Git identity header value.`);
	}
}

function assertIsoTimestamp(value: unknown, field: string): asserts value is string {
	assertNfcString(value, field, 20, 64);
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)) {
		throw new Error(`${field} must be an ISO-8601 UTC timestamp.`);
	}
}

function assertDigest(value: unknown, field: string): asserts value is Sha256Digest {
	if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
		throw new Error(`${field} must be a lowercase SHA-256 digest.`);
	}
}

function assertSameStrings(
	actual: readonly string[],
	expected: readonly string[],
	field: string,
): void {
	if (
		actual.length !== expected.length ||
		actual.some((value, index) => value !== expected[index])
	) {
		throw new Error(`Migration Receipt ${field} do not match the migration plan.`);
	}
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
