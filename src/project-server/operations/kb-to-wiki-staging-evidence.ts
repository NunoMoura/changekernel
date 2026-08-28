import {changeContentDigest} from "../../changes/digest.ts";
import {assertStableId} from "../../project/git-store-profile.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {assertKbToWikiMigrationReadiness} from "./kb-to-wiki-readiness.ts";
import {
	buildKbToWikiLegacySourceSnapshot,
	type BuildKbToWikiLegacySourceSnapshotInput,
	type KbToWikiLegacySourceSnapshot,
} from "./kb-to-wiki-source.ts";
import type {WorkStateChange} from "../../work-state/types.ts";
import {
	collectBackendStateSnapshotDigests,
	readBackendStateBackup,
	type BackendBackupScope,
	type BackendStateBackupManifest,
} from "./state.ts";

export const KB_TO_WIKI_MIGRATION_STAGING_EVIDENCE_PROTOCOL = Object.freeze({
	id: "codewiki.kb-to-wiki-migration-staging-evidence",
	version: "1.0.0",
} as const);

export interface KbToWikiMigrationAuthorityEvidence {
	readonly migrationChangeId: string;
	readonly changeRevision: number;
	readonly recordRevision: number;
	readonly changeDigest: Sha256Digest;
	readonly approvalEventId: string;
	readonly actorId: string;
	readonly authorityId: string;
	readonly approvalRef: string;
	readonly approvedAt: string;
	readonly sourceSnapshotDigest: Sha256Digest;
	readonly authorityDigest: Sha256Digest;
}

export interface KbToWikiPrivateBackupEvidence {
	readonly backupId: Sha256Digest;
	readonly generatedAt: string;
	readonly repositoryIdentity: Sha256Digest;
	readonly sourceStateGeneration: number;
	readonly sourceStateDigest: Sha256Digest;
	readonly sourceBackendBuildDigest: Sha256Digest;
	readonly snapshotDigests: Readonly<Record<BackendBackupScope, Sha256Digest>>;
	readonly entryCount: number;
}

export interface KbToWikiMigrationStagingEvidence {
	readonly protocol: typeof KB_TO_WIKI_MIGRATION_STAGING_EVIDENCE_PROTOCOL;
	readonly sourceSnapshot: KbToWikiLegacySourceSnapshot;
	readonly authority: KbToWikiMigrationAuthorityEvidence;
	readonly privateBackup: KbToWikiPrivateBackupEvidence;
	readonly evidenceDigest: Sha256Digest;
}

export type BindKbToWikiMigrationStagingEvidenceInput =
	BuildKbToWikiLegacySourceSnapshotInput & {
		readonly migrationChangeId: string;
		readonly backupId: Sha256Digest;
	};

/**
 * Bind one accepted legacy Change and one exact pre-existing private backup to
 * the stopped migration source. This operation validates only; backup creation
 * remains the explicit Backend maintenance operation.
 */
export async function bindKbToWikiMigrationStagingEvidence(
	input: BindKbToWikiMigrationStagingEvidenceInput,
): Promise<KbToWikiMigrationStagingEvidence> {
	assertStableId(input.migrationChangeId, "Migration authority Change ID");
	const sourceBefore = await buildKbToWikiLegacySourceSnapshot(input);
	const backupBefore = await readBackendStateBackup(input);
	const scopesBefore = await collectBackendStateSnapshotDigests(input);
	assertBackupBinding(sourceBefore, backupBefore, scopesBefore);

	const sourceAfter = await buildKbToWikiLegacySourceSnapshot(input);
	const scopesAfter = await collectBackendStateSnapshotDigests(input);
	const backupAfter = await readBackendStateBackup(input);
	const finalReadiness = await assertKbToWikiMigrationReadiness(input);
	if (
		sourceBefore.snapshotDigest !== sourceAfter.snapshotDigest ||
		canonicalJson(sourceAfter.readiness) !== canonicalJson(finalReadiness)
	) {
		throw new Error("KB-to-Wiki source changed while migration staging evidence was bound.");
	}
	if (
		canonicalJson(scopesBefore) !== canonicalJson(scopesAfter) ||
		canonicalJson(backupBefore) !== canonicalJson(backupAfter)
	) {
		throw new Error("Backend private state changed while migration staging evidence was bound.");
	}
	assertBackupBinding(sourceAfter, backupAfter, scopesAfter);

	const authority = migrationAuthority(sourceAfter, input.migrationChangeId);
	const privateBackup = privateBackupEvidence(backupAfter);
	const body = {
		protocol: KB_TO_WIKI_MIGRATION_STAGING_EVIDENCE_PROTOCOL,
		sourceSnapshot: sourceAfter,
		authority,
		privateBackup,
	};
	// SAFETY: all nested values were parsed or created by exact protocol boundaries above.
	return toCanonicalJsonValue({
		...body,
		evidenceDigest: canonicalJsonDigest(body),
	}) as unknown as KbToWikiMigrationStagingEvidence;
}

function migrationAuthority(
	source: KbToWikiLegacySourceSnapshot,
	migrationChangeId: string,
): KbToWikiMigrationAuthorityEvidence {
	if (!source.activeChangeIds.includes(migrationChangeId)) {
		throw new Error("Migration authority must be an accepted active legacy Change.");
	}
	const workStateChange = source.workState.changes.find(
		(change) => change.id === migrationChangeId,
	);
	if (!workStateChange || workStateChange.approval.status !== "approved") {
		throw new Error("Migration authority Change approval is unavailable.");
	}
	const {record, approval, transition} = acceptedAuthorityFields(workStateChange);
	assertApprovalAgreement(approval, transition);
	const changeDigest = changeContentDigest(record.change);
	if (approval.changeDigest !== changeDigest) {
		throw new Error("Migration authority Change digest disagrees with its accepted record.");
	}
	assertStableId(approval.eventId, "Migration approval event ID");
	assertStableId(transition.changedBy, "Migration actor ID");
	assertStableId(transition.authority, "Migration authority ID");
	assertStableId(transition.ref, "Migration approval ref");
	const body = {
		migrationChangeId,
		changeRevision: record.change.revision,
		recordRevision: record.recordRevision,
		changeDigest,
		approvalEventId: approval.eventId,
		actorId: transition.changedBy,
		authorityId: transition.authority,
		approvalRef: transition.ref,
		approvedAt: transition.changedAt,
		sourceSnapshotDigest: source.snapshotDigest,
	};
	return Object.freeze({...body, authorityDigest: canonicalJsonDigest(body)});
}

function acceptedAuthorityFields(change: WorkStateChange) {
	const {record, approval} = change;
	const transition = record.change.lastStatusTransition;
	if (
		record.change.status !== "accepted" ||
		!transition ||
		transition.to !== "accepted" ||
		!transition.authority ||
		!transition.ref ||
		!approval.eventId ||
		!approval.approvedBy ||
		!approval.approvedAt ||
		!approval.approvalRef
	) {
		throw new Error("Migration authority Change lacks complete acceptance evidence.");
	}
	return {
		record,
		approval: {
			...approval,
			eventId: approval.eventId,
			approvedBy: approval.approvedBy,
			approvedAt: approval.approvedAt,
			approvalRef: approval.approvalRef,
		},
		transition: {...transition, authority: transition.authority, ref: transition.ref},
	};
}

function assertApprovalAgreement(
	approval: ReturnType<typeof acceptedAuthorityFields>["approval"],
	transition: ReturnType<typeof acceptedAuthorityFields>["transition"],
): void {
	if (
		approval.approvedBy !== transition.changedBy ||
		approval.approvedAt !== transition.changedAt ||
		approval.approvalRef !== approval.eventId
	) {
		throw new Error("Migration authority Change approval and acceptance disagree.");
	}
}

function assertBackupBinding(
	source: KbToWikiLegacySourceSnapshot,
	backup: BackendStateBackupManifest,
	currentScopes: Readonly<Record<BackendBackupScope, Sha256Digest>>,
): void {
	if (
		backup.repositoryIdentity !== source.readiness.repositoryIdentity ||
		backup.sourceState.repositoryIdentity !== source.readiness.repositoryIdentity ||
		backup.sourceState.generation !== source.readiness.stateGeneration ||
		backup.sourceState.stateDigest !== source.readiness.stateDigest ||
		backup.sourceState.activeBuild.backendBuildDigest !== source.readiness.backendBuildDigest
	) {
		throw new Error("Backend private backup does not bind the migration source state.");
	}
	if (canonicalJson(backup.snapshotDigests) !== canonicalJson(currentScopes)) {
		throw new Error("Backend private backup is stale for the stopped migration source.");
	}
}

function privateBackupEvidence(
	backup: BackendStateBackupManifest,
): KbToWikiPrivateBackupEvidence {
	return Object.freeze({
		backupId: backup.backupId,
		generatedAt: backup.generatedAt,
		repositoryIdentity: backup.repositoryIdentity,
		sourceStateGeneration: backup.sourceState.generation,
		sourceStateDigest: backup.sourceState.stateDigest,
		sourceBackendBuildDigest: backup.sourceState.activeBuild.backendBuildDigest,
		snapshotDigests: Object.freeze({...backup.snapshotDigests}),
		entryCount: backup.entries.length,
	});
}
