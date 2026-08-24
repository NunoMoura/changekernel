import {randomBytes} from "node:crypto";
import {
	chmod,
	copyFile,
	lstat,
	mkdir,
	open,
	readdir,
	readFile,
	rename,
	rm,
} from "node:fs/promises";
import {basename, dirname, join, relative, resolve} from "node:path";

import {
	canonicalJson,
	canonicalJsonDigest,
	sha256Digest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {
	projectCoordinatorEndpointPath,
	projectCoordinatorOwnershipPath,
} from "../coordinator/endpoint.ts";
import {
	assertBackendBuildBinding,
	backendBuildSupportsStateSchema,
	DEFAULT_BACKEND_BUILD,
	type BackendBuildBinding,
} from "./build.ts";
import {
	projectServerStatePaths,
	type ProjectServerStatePaths,
} from "./paths.ts";

export const BACKEND_STATE_PROTOCOL = Object.freeze({
	id: "codewiki.backend-state",
	version: "1.0.0",
} as const);

export const BACKEND_BACKUP_PROTOCOL = Object.freeze({
	id: "codewiki.backend-state-backup",
	version: "1.0.0",
} as const);

export const BACKEND_STATE_MIGRATION_PROTOCOL = Object.freeze({
	id: "codewiki.backend-state-migration",
	version: "1.0.0",
} as const);

export const BACKEND_STATE_RESTORE_PROTOCOL = Object.freeze({
	id: "codewiki.backend-state-restore",
	version: "1.0.0",
} as const);

export const BACKEND_STATE_RECOVERY_PROTOCOL = Object.freeze({
	id: "codewiki.backend-state-recovery",
	version: "1.0.0",
} as const);

export const BACKEND_BUILD_TRANSITION_PROTOCOL = Object.freeze({
	id: "codewiki.backend-build-transition",
	version: "1.0.0",
} as const);

export type BackendBackupScope =
	| "canonical-project"
	| "project-server-private"
	| "runtime-private"
	| "backend-audit";

export interface BackendStateManifest {
	readonly protocol: typeof BACKEND_STATE_PROTOCOL;
	readonly repositoryIdentity: Sha256Digest;
	readonly generation: number;
	readonly activeBuild: BackendBuildBinding;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly lastMigrationDigest: Sha256Digest | null;
	readonly lastRestoreDigest: Sha256Digest | null;
	readonly lastRecoveryDigest: Sha256Digest | null;
	readonly lastBuildTransitionDigest: Sha256Digest | null;
	readonly stateDigest: Sha256Digest;
}

export interface BackendBackupEntry {
	readonly scope: BackendBackupScope;
	readonly path: string;
	readonly size: number;
	readonly mode: number;
	readonly digest: Sha256Digest;
}

export interface BackendStateBackupManifest {
	readonly protocol: typeof BACKEND_BACKUP_PROTOCOL;
	readonly backupId: Sha256Digest;
	readonly repositoryIdentity: Sha256Digest;
	readonly generatedAt: string;
	readonly sourceState: BackendStateManifest;
	readonly snapshotDigests: Readonly<Record<BackendBackupScope, Sha256Digest>>;
	readonly entries: readonly BackendBackupEntry[];
}

export interface LegacyProjectStateEntry {
	readonly path: string;
	readonly size: number;
	readonly mode: number;
	readonly digest: Sha256Digest;
}

export interface BackendStateMigrationReceipt {
	readonly protocol: typeof BACKEND_STATE_MIGRATION_PROTOCOL;
	readonly repositoryIdentity: Sha256Digest;
	readonly sourceKind: "schema-less-project-local-state";
	readonly legacySnapshotDigest: Sha256Digest;
	readonly quarantineId: Sha256Digest;
	readonly migratedPaths: readonly string[];
	readonly quarantinedOnlyPaths: readonly string[];
	readonly targetStateGeneration: number;
	readonly targetBackendBuildDigest: Sha256Digest;
	readonly migratedAt: string;
	readonly migrationDigest: Sha256Digest;
}

export interface BackendStateRestoreReceipt {
	readonly protocol: typeof BACKEND_STATE_RESTORE_PROTOCOL;
	readonly repositoryIdentity: Sha256Digest;
	readonly backupId: Sha256Digest;
	readonly restoredScopes: readonly BackendBackupScope[];
	readonly previousStateDigest: Sha256Digest;
	readonly targetStateGeneration: number;
	readonly targetBackendBuildDigest: Sha256Digest;
	readonly previousSnapshotDigests: Readonly<Record<BackendBackupScope, Sha256Digest>>;
	readonly restoredSnapshotDigests: Readonly<Record<BackendBackupScope, Sha256Digest>>;
	readonly activatedBackupBuild: boolean;
	readonly restoredAt: string;
	readonly restoreDigest: Sha256Digest;
}

export interface BackendStateRecoveryReceipt {
	readonly protocol: typeof BACKEND_STATE_RECOVERY_PROTOCOL;
	readonly repositoryIdentity: Sha256Digest;
	readonly backupId: Sha256Digest;
	readonly quarantinedStateDigest: Sha256Digest;
	readonly quarantinedAuditDigests: readonly Sha256Digest[];
	readonly quarantineId: Sha256Digest;
	readonly canonicalSnapshotDigest: Sha256Digest;
	readonly targetStateGeneration: number;
	readonly targetBackendBuildDigest: Sha256Digest;
	readonly recoveredAt: string;
	readonly recoveryDigest: Sha256Digest;
}

export interface BackendBuildTransitionReceipt {
	readonly protocol: typeof BACKEND_BUILD_TRANSITION_PROTOCOL;
	readonly repositoryIdentity: Sha256Digest;
	readonly kind: "upgrade";
	readonly previousStateDigest: Sha256Digest;
	readonly previousBackendBuildDigest: Sha256Digest;
	readonly targetBackendBuildDigest: Sha256Digest;
	readonly targetStateGeneration: number;
	readonly backupId: Sha256Digest;
	readonly requiresSessionRollover: true;
	readonly transitionedAt: string;
	readonly transitionDigest: Sha256Digest;
}

interface CollectedFile extends BackendBackupEntry {
	readonly sourcePath: string;
}

interface LegacyCollectedFile extends LegacyProjectStateEntry {
	readonly sourcePath: string;
}

interface BackendRestoreTransaction {
	readonly protocol: typeof BACKEND_STATE_RESTORE_PROTOCOL;
	readonly transactionId: Sha256Digest;
	readonly backupId: Sha256Digest;
	readonly expectedStateDigest: Sha256Digest;
	readonly expectedCanonicalSnapshotDigest: Sha256Digest;
	readonly scopes: readonly BackendBackupScope[];
	readonly activateBackupBuild: boolean;
	readonly previousSnapshotDigests: Readonly<Record<BackendBackupScope, Sha256Digest>>;
	readonly restoredAt: string;
}

const BACKUP_MANIFEST_FILE = "manifest.json";
const QUARANTINE_MANIFEST_FILE = "manifest.json";
const MAX_BACKUP_FILES = 20_000;
const MAX_BACKUP_BYTES = 1_073_741_824;
const CANONICAL_ROOTS = Object.freeze([
	"config.json",
	"kb",
	"traces",
	"check-packs",
	"check-packs.lock.json",
] as const);
const PROJECT_SERVER_BACKUP_ROOTS = Object.freeze([
	"continuity",
	"synchronization",
	"worker-assignments",
	"effects",
] as const);
const PROJECT_SERVER_AUDIT_ROOTS = Object.freeze([
	"migrations",
	"build-transitions",
	"restore-receipts",
	"recovery-receipts",
] as const);
const RUNTIME_BACKUP_ROOTS = Object.freeze([
	"dsh-agent-sessions",
	"execution-evidence",
	"worker-reports",
	"preview-evidence",
	"publications",
] as const);
const LEGACY_RUNTIME_DIRECTORY_ROOTS = new Set([
	"continuity",
	"coordinator",
	"empty-hooks",
	"evidence",
	"implementation-workers",
	"integration",
	"locks",
	"logs",
	"preview-evidence",
	"publications",
	"pushes",
	"releases",
	"sessions",
	"snapshots",
	"tmp",
	"worker-assignments",
	"workers",
	"worktrees",
]);
const LEGACY_RUNTIME_FILE_ROOTS = new Set([
	"knowledge-apply.lock",
	"synchronization.json",
]);
const LEGACY_PUBLICATION_ROOTS = new Set(["artifacts", "manifests"]);
const RESTORABLE_SCOPES = Object.freeze([
	"canonical-project",
	"project-server-private",
	"runtime-private",
] as const satisfies readonly BackendBackupScope[]);
const ALL_SCOPES = Object.freeze([
	...RESTORABLE_SCOPES,
	"backend-audit",
] as const satisfies readonly BackendBackupScope[]);

export async function bootstrapBackendState(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly activeBuild?: BackendBuildBinding;
	readonly createdAt?: string;
}): Promise<BackendStateManifest> {
	const paths = projectServerStatePaths(input);
	await assertCodeWikiProject(paths);
	await assertNoLegacyProjectState(paths);
	await ensureStateDirectory(paths, paths.projectStateRoot);
	const current = await readBackendStateManifest(input);
	if (current) {
		await reconcileCompletedRestoreTransaction(paths, current);
		await assertNoPendingRestore(paths);
		return current;
	}
	await discardEmptyPreBootstrapState(paths);
	const createdAt = timestamp(input.createdAt);
	const manifest = createStateManifest({
		paths,
		generation: 1,
		activeBuild: input.activeBuild ?? DEFAULT_BACKEND_BUILD,
		createdAt,
		updatedAt: createdAt,
		lastMigrationDigest: null,
		lastRestoreDigest: null,
		lastRecoveryDigest: null,
		lastBuildTransitionDigest: null,
	});
	await writePrivateCanonicalJson(paths, paths.stateManifestPath, manifest);
	return manifest;
}

export async function readBackendStateManifest(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
}): Promise<BackendStateManifest | undefined> {
	const paths = projectServerStatePaths(input);
	const value = await readCanonicalJsonFile(paths, paths.stateManifestPath);
	if (value === undefined) return undefined;
	const state = normalizeStateManifest(value, paths);
	await verifyStateOperationHeads(paths, state);
	return state;
}

export async function legacyProjectStateSnapshotDigest(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
}): Promise<Sha256Digest> {
	const paths = projectServerStatePaths(input);
	return legacySnapshotDigest(await collectLegacyProjectState(paths));
}

export async function migrateBackendState(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly expectedLegacySnapshotDigest: Sha256Digest;
	readonly activeBuild?: BackendBuildBinding;
	readonly migratedAt?: string;
}): Promise<BackendStateMigrationReceipt> {
	const paths = projectServerStatePaths(input);
	await assertCodeWikiProject(paths);
	await assertProjectStopped(paths);
	const legacyEntries = await collectLegacyProjectState(paths);
	if (legacyEntries.length === 0) {
		throw new Error("Legacy project-local state does not exist.");
	}
	const legacyDigest = legacySnapshotDigest(legacyEntries);
	if (legacyDigest !== digest(input.expectedLegacySnapshotDigest, "Legacy snapshot digest")) {
		throw new Error("Backend state migration expected legacy snapshot is stale.");
	}
	const existing = await readBackendStateManifest(input);
	if (existing) {
		return completeCommittedLegacyMigration(paths, existing, legacyEntries, legacyDigest);
	}
	await ensureStateDirectory(paths, paths.projectStateRoot);
	const privateEntries = await topLevelNames(paths.projectStateRoot);
	if (privateEntries.length > 0) {
		throw new Error("Backend state migration found undeclared private project state.");
	}
	const migratedAt = timestamp(input.migratedAt);
	const quarantineBody = {
		protocol: BACKEND_STATE_MIGRATION_PROTOCOL,
		repositoryIdentity: paths.repositoryIdentity,
		sourceKind: "schema-less-project-local-state" as const,
		legacySnapshotDigest: legacyDigest,
		createdAt: migratedAt,
		entries: legacyEntries.map(withoutSourcePath),
	};
	const quarantineId = canonicalJsonDigest(quarantineBody);
	await writeLegacyQuarantine(paths, quarantineId, quarantineBody, legacyEntries);
	const {migratedPaths, quarantinedOnlyPaths} = await migrateLegacyEntries(paths);
	const activeBuild = input.activeBuild ?? DEFAULT_BACKEND_BUILD;
	const receiptBody = {
		protocol: BACKEND_STATE_MIGRATION_PROTOCOL,
		repositoryIdentity: paths.repositoryIdentity,
		sourceKind: "schema-less-project-local-state" as const,
		legacySnapshotDigest: legacyDigest,
		quarantineId,
		migratedPaths,
		quarantinedOnlyPaths,
		targetStateGeneration: 1,
		targetBackendBuildDigest: activeBuild.backendBuildDigest,
		migratedAt,
	};
	const receipt = Object.freeze({
		...receiptBody,
		migrationDigest: canonicalJsonDigest(receiptBody),
	}) as BackendStateMigrationReceipt;
	const manifest = createStateManifest({
		paths,
		generation: receipt.targetStateGeneration,
		activeBuild,
		createdAt: migratedAt,
		updatedAt: migratedAt,
		lastMigrationDigest: receipt.migrationDigest,
		lastRestoreDigest: null,
		lastRecoveryDigest: null,
		lastBuildTransitionDigest: null,
	});
	await writePrivateCanonicalJson(
		paths,
		join(paths.migrationsRoot, `${receipt.migrationDigest.slice(7)}.json`),
		receipt,
	);
	await writePrivateCanonicalJson(paths, paths.stateManifestPath, manifest);
	await rm(join(paths.projectRoot, ".codewiki", "runtime"), {recursive: true, force: true});
	await rm(join(paths.projectRoot, ".codewiki", "views"), {recursive: true, force: true});
	await syncDirectory(join(paths.projectRoot, ".codewiki"));
	return receipt;
}

export async function createBackendStateBackup(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly generatedAt?: string;
	readonly retain?: number;
}): Promise<BackendStateBackupManifest> {
	const paths = projectServerStatePaths(input);
	await assertCodeWikiProject(paths);
	await assertNoLegacyProjectState(paths);
	await assertProjectStopped(paths);
	await assertNoPendingRestore(paths);
	const state = await requireStateManifest(input);
	const entries = await collectBackupEntries(paths);
	const body = {
		protocol: BACKEND_BACKUP_PROTOCOL,
		repositoryIdentity: paths.repositoryIdentity,
		generatedAt: timestamp(input.generatedAt),
		sourceState: state,
		snapshotDigests: snapshotDigests(entries),
		entries: entries.map(withoutSourcePath),
	};
	const backupId = canonicalJsonDigest(body);
	const manifest = Object.freeze({...body, backupId}) as BackendStateBackupManifest;
	const target = backupDirectory(paths, backupId);
	const staging = `${target}.staging.${process.pid}.${randomBytes(8).toString("hex")}`;
	await ensureStateDirectory(paths, paths.backupsRoot);
	try {
		await mkdir(staging, {recursive: false, mode: 0o700});
		for (const entry of entries) {
			await copyPrivateFile(
				paths,
				entry.sourcePath,
				join(staging, entry.scope, ...entry.path.split("/")),
			);
		}
		await writePrivateCanonicalJson(paths, join(staging, BACKUP_MANIFEST_FILE), manifest);
		await rename(staging, target);
		await syncDirectory(paths.backupsRoot);
	} catch (error) {
		await rm(staging, {recursive: true, force: true});
		if (error instanceof Error && "code" in error && error.code === "EEXIST") {
			const existing = await readBackendStateBackup({...input, backupId});
			if (canonicalJson(existing) === canonicalJson(manifest)) return existing;
		}
		throw error;
	}
	if (input.retain !== undefined) {
		await pruneBackendStateBackups({...input, retain: input.retain});
	}
	return manifest;
}

export async function activateBackendBuild(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly expectedStateDigest: Sha256Digest;
	readonly targetBuild: BackendBuildBinding;
	readonly transitionedAt?: string;
	readonly retainBackups?: number;
}): Promise<BackendBuildTransitionReceipt> {
	const paths = projectServerStatePaths(input);
	await assertCodeWikiProject(paths);
	await assertNoLegacyProjectState(paths);
	await assertProjectStopped(paths);
	await assertNoPendingRestore(paths);
	const current = await requireStateManifest(input);
	if (current.stateDigest !== digest(input.expectedStateDigest, "Expected Backend state digest")) {
		throw new Error("Backend Build transition expected state is stale.");
	}
	assertBackendBuildBinding(input.targetBuild);
	if (input.targetBuild.backendBuildDigest === current.activeBuild.backendBuildDigest) {
		throw new Error("Backend Build transition target is already active.");
	}
	if (!backendBuildSupportsStateSchema(input.targetBuild, BACKEND_STATE_PROTOCOL.version)) {
		throw new Error("Target Backend Build does not support the active state schema.");
	}
	for (const schema of current.activeBuild.fileSchemas) {
		if (!input.targetBuild.fileSchemas.some(
			(candidate) => candidate.id === schema.id && candidate.version === schema.version,
		)) {
			throw new Error(
				`Backend upgrade requires an explicit ${schema.id}@${schema.version} state migration.`,
			);
		}
	}
	if (
		input.targetBuild.domainPluginClosureDigest !==
		current.activeBuild.domainPluginClosureDigest
	) {
		throw new Error("Backend upgrade requires an explicit Domain Plugin migration.");
	}
	if (compareVersions(input.targetBuild.packageVersion, current.activeBuild.packageVersion) <= 0) {
		throw new Error("Backend upgrade target version must advance the active version.");
	}
	const transitionedAt = timestamp(input.transitionedAt);
	const backup = await createBackendStateBackup({
		...input,
		generatedAt: transitionedAt,
		retain: input.retainBackups,
	});
	const receiptBody = {
		protocol: BACKEND_BUILD_TRANSITION_PROTOCOL,
		repositoryIdentity: paths.repositoryIdentity,
		kind: "upgrade" as const,
		previousStateDigest: current.stateDigest,
		previousBackendBuildDigest: current.activeBuild.backendBuildDigest,
		targetBackendBuildDigest: input.targetBuild.backendBuildDigest,
		targetStateGeneration: current.generation + 1,
		backupId: backup.backupId,
		requiresSessionRollover: true as const,
		transitionedAt,
	};
	const receipt = Object.freeze({
		...receiptBody,
		transitionDigest: canonicalJsonDigest(receiptBody),
	}) as BackendBuildTransitionReceipt;
	const targetState = createStateManifest({
		paths,
		generation: receipt.targetStateGeneration,
		activeBuild: input.targetBuild,
		createdAt: current.createdAt,
		updatedAt: transitionedAt,
		lastMigrationDigest: current.lastMigrationDigest,
		lastRestoreDigest: current.lastRestoreDigest,
		lastRecoveryDigest: current.lastRecoveryDigest,
		lastBuildTransitionDigest: receipt.transitionDigest,
	});
	await writePrivateCanonicalJson(
		paths,
		join(paths.buildTransitionsRoot, `${receipt.transitionDigest.slice(7)}.json`),
		receipt,
	);
	await writePrivateCanonicalJson(paths, paths.stateManifestPath, targetState);
	return receipt;
}

export async function readBackendStateBackup(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly backupId: Sha256Digest;
}): Promise<BackendStateBackupManifest> {
	const paths = projectServerStatePaths(input);
	const backupId = digest(input.backupId, "Backup ID");
	const root = backupDirectory(paths, backupId);
	const value = await readCanonicalJsonFile(paths, join(root, BACKUP_MANIFEST_FILE));
	if (value === undefined) throw new Error(`Backend state backup ${backupId} does not exist.`);
	const manifest = normalizeBackupManifest(value, paths, backupId);
	await assertExactBackupTree(root, manifest);
	for (const entry of manifest.entries) {
		await verifyBackupFile(join(root, entry.scope, ...entry.path.split("/")), entry);
	}
	return manifest;
}

export async function restoreBackendStateBackup(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly backupId: Sha256Digest;
	readonly scopes: readonly BackendBackupScope[];
	readonly expectedStateDigest: Sha256Digest;
	readonly expectedCanonicalSnapshotDigest: Sha256Digest;
	readonly activateBackupBuild: boolean;
	readonly restoredAt?: string;
}): Promise<BackendStateRestoreReceipt> {
	const paths = projectServerStatePaths(input);
	await assertCodeWikiProject(paths);
	await assertNoLegacyProjectState(paths);
	await assertProjectStopped(paths);
	const scopes = normalizedScopes(input.scopes);
	if (scopes.includes("backend-audit")) {
		throw new Error("Backend audit scope is backup-only and cannot be restored destructively.");
	}
	if (
		input.activateBackupBuild &&
		canonicalJson(scopes) !== canonicalJson(RESTORABLE_SCOPES)
	) {
		throw new Error("Backend Build rollback requires every restorable backup scope and no audit rollback.");
	}
	const current = await requireStateManifest(input);
	if (current.stateDigest !== digest(input.expectedStateDigest, "Expected Backend state digest")) {
		throw new Error("Backend restore expected state is stale.");
	}
	const expectedCanonicalSnapshotDigest = digest(
		input.expectedCanonicalSnapshotDigest,
		"Expected canonical snapshot digest",
	);
	const backup = await readBackendStateBackup(input);
	const restoredAt = timestamp(input.restoredAt);
	const transactionIdentity = {
		protocol: BACKEND_STATE_RESTORE_PROTOCOL,
		backupId: backup.backupId,
		expectedStateDigest: current.stateDigest,
		expectedCanonicalSnapshotDigest,
		scopes,
		activateBackupBuild: input.activateBackupBuild,
		restoredAt,
	};
	const transactionId = canonicalJsonDigest(transactionIdentity);
	const transactionPath = join(paths.restoreTransactionsRoot, `${transactionId.slice(7)}.json`);
	const pending = await readMatchingRestoreTransaction(
		paths,
		transactionPath,
		transactionIdentity,
	);
	let beforeDigests = pending?.previousSnapshotDigests;
	if (!beforeDigests) {
		beforeDigests = snapshotDigests(await collectBackupEntries(paths));
		if (beforeDigests["canonical-project"] !== expectedCanonicalSnapshotDigest) {
			throw new Error("Backend restore expected canonical snapshot is stale.");
		}
		const transaction: BackendRestoreTransaction = Object.freeze({
			...transactionIdentity,
			transactionId,
			previousSnapshotDigests: beforeDigests,
		});
		await writePrivateCanonicalJson(paths, transactionPath, transaction);
	}
	let completed = false;
	try {
		await applyBackupScopes(paths, backup, scopes);
		const restoredEntries = await collectBackupEntries(paths);
		const restoredDigests = snapshotDigests(restoredEntries);
		for (const scope of scopes) {
			if (restoredDigests[scope] !== backup.snapshotDigests[scope]) {
				throw new Error(`Backend restore verification failed for ${scope}.`);
			}
		}
		const baseState = input.activateBackupBuild ? backup.sourceState : current;
		const targetBuild = baseState.activeBuild;
		const receiptBody = {
			protocol: BACKEND_STATE_RESTORE_PROTOCOL,
			repositoryIdentity: paths.repositoryIdentity,
			backupId: backup.backupId,
			restoredScopes: scopes,
			previousStateDigest: current.stateDigest,
			targetStateGeneration: current.generation + 1,
			targetBackendBuildDigest: targetBuild.backendBuildDigest,
			previousSnapshotDigests: beforeDigests,
			restoredSnapshotDigests: restoredDigests,
			activatedBackupBuild: input.activateBackupBuild,
			restoredAt,
		};
		const receipt = Object.freeze({
			...receiptBody,
			restoreDigest: canonicalJsonDigest(receiptBody),
		}) as BackendStateRestoreReceipt;
		const target = createStateManifest({
			paths,
			generation: receipt.targetStateGeneration,
			activeBuild: targetBuild,
			createdAt: baseState.createdAt,
			updatedAt: restoredAt,
			lastMigrationDigest: baseState.lastMigrationDigest,
			lastRestoreDigest: receipt.restoreDigest,
			lastRecoveryDigest: baseState.lastRecoveryDigest,
			lastBuildTransitionDigest: baseState.lastBuildTransitionDigest,
		});
		await writePrivateCanonicalJson(
			paths,
			join(paths.restoreReceiptsRoot, `${receipt.restoreDigest.slice(7)}.json`),
			receipt,
		);
		await writePrivateCanonicalJson(paths, paths.stateManifestPath, target);
		completed = true;
		return receipt;
	} finally {
		if (completed) await rm(transactionPath, {force: true});
	}
}

export async function recoverBackendStateManifest(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly backupId: Sha256Digest;
	readonly expectedCorruptDigest: Sha256Digest;
	readonly expectedCanonicalSnapshotDigest: Sha256Digest;
	readonly recoveredAt?: string;
}): Promise<BackendStateRecoveryReceipt> {
	const paths = projectServerStatePaths(input);
	await assertCodeWikiProject(paths);
	await assertNoLegacyProjectState(paths);
	await assertProjectStopped(paths);
	await assertNoPendingRestore(paths);
	const corruptMetadata = await statNoFollow(paths.stateManifestPath);
	if (!corruptMetadata?.isFile() || corruptMetadata.isSymbolicLink()) {
		throw new Error("Corrupt Backend state must be a non-symbolic regular file.");
	}
	const corruptBytes = await readFile(paths.stateManifestPath);
	const corruptDigest = sha256Digest(corruptBytes);
	if (corruptDigest !== digest(input.expectedCorruptDigest, "Expected corrupt state digest")) {
		throw new Error("Backend corruption recovery expected digest is stale.");
	}
	const currentCanonical = await canonicalProjectSnapshotDigest(input);
	if (
		currentCanonical !==
		digest(input.expectedCanonicalSnapshotDigest, "Expected canonical snapshot digest")
	) {
		throw new Error("Backend corruption recovery expected canonical snapshot is stale.");
	}
	const backup = await readBackendStateBackup(input);
	const recoveredAt = timestamp(input.recoveredAt);
	const quarantineId = canonicalJsonDigest({
		kind: "corrupt-backend-state",
		repositoryIdentity: paths.repositoryIdentity,
		corruptDigest,
		recoveredAt,
	});
	const quarantinePath = join(paths.quarantineRoot, quarantineId.slice(7), "state.json");
	await writePrivateBytes(paths, quarantinePath, corruptBytes);
	await applyBackupScopes(paths, backup, ["project-server-private", "runtime-private"]);
	const quarantinedAuditDigests = await restoreMissingAuditEntries(
		paths,
		backup,
		quarantineId,
	);
	const receiptBody = {
		protocol: BACKEND_STATE_RECOVERY_PROTOCOL,
		repositoryIdentity: paths.repositoryIdentity,
		backupId: backup.backupId,
		quarantinedStateDigest: corruptDigest,
		quarantinedAuditDigests,
		quarantineId,
		canonicalSnapshotDigest: currentCanonical,
		targetStateGeneration: backup.sourceState.generation + 1,
		targetBackendBuildDigest: backup.sourceState.activeBuild.backendBuildDigest,
		recoveredAt,
	};
	const receipt = Object.freeze({
		...receiptBody,
		recoveryDigest: canonicalJsonDigest(receiptBody),
	}) as BackendStateRecoveryReceipt;
	const state = createStateManifest({
		paths,
		generation: receipt.targetStateGeneration,
		activeBuild: backup.sourceState.activeBuild,
		createdAt: backup.sourceState.createdAt,
		updatedAt: recoveredAt,
		lastMigrationDigest: backup.sourceState.lastMigrationDigest,
		lastRestoreDigest: backup.sourceState.lastRestoreDigest,
		lastRecoveryDigest: receipt.recoveryDigest,
		lastBuildTransitionDigest: backup.sourceState.lastBuildTransitionDigest,
	});
	await writePrivateCanonicalJson(
		paths,
		join(paths.recoveryReceiptsRoot, `${receipt.recoveryDigest.slice(7)}.json`),
		receipt,
	);
	await writePrivateCanonicalJson(paths, paths.stateManifestPath, state);
	return receipt;
}

export async function pruneBackendStateBackups(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly retain: number;
}): Promise<readonly Sha256Digest[]> {
	if (!Number.isInteger(input.retain) || input.retain < 1 || input.retain > 1_000) {
		throw new Error("Backend backup retention must be an integer from 1 through 1000.");
	}
	const paths = projectServerStatePaths(input);
	await assertProjectStopped(paths);
	await assertNoPendingRestore(paths);
	let names: string[];
	try {
		names = await readdir(paths.backupsRoot);
	} catch (error) {
		if (missingPath(error)) return Object.freeze([]);
		throw error;
	}
	const backups: BackendStateBackupManifest[] = [];
	for (const name of names.sort(compareText)) {
		if (!/^[a-f0-9]{64}$/u.test(name)) {
			throw new Error("Backend backup root contains an undeclared entry.");
		}
		backups.push(await readBackendStateBackup({...input, backupId: `sha256:${name}`}));
	}
	backups.sort((left, right) =>
		left.generatedAt.localeCompare(right.generatedAt) || left.backupId.localeCompare(right.backupId)
	);
	const protectedIds = await protectedBackupIds(paths, await readBackendStateManifest(input));
	const removalCount = Math.max(0, backups.length - input.retain);
	const removable = backups.filter(({backupId}) => !protectedIds.has(backupId));
	const removed: Sha256Digest[] = [];
	for (const backup of removable.slice(0, removalCount)) {
		await rm(backupDirectory(paths, backup.backupId), {recursive: true, force: false});
		removed.push(backup.backupId);
	}
	return Object.freeze(removed);
}

async function protectedBackupIds(
	paths: ProjectServerStatePaths,
	state: BackendStateManifest | undefined,
): Promise<ReadonlySet<Sha256Digest>> {
	const protectedIds = new Set<Sha256Digest>();
	if (!state) return protectedIds;
	for (const [head, directory] of [
		[state.lastBuildTransitionDigest, paths.buildTransitionsRoot],
		[state.lastRestoreDigest, paths.restoreReceiptsRoot],
		[state.lastRecoveryDigest, paths.recoveryReceiptsRoot],
	] as const) {
		if (head === null) continue;
		const value = await readCanonicalJsonFile(
			paths,
			join(directory, `${head.slice(7)}.json`),
		);
		if (isRecord(value) && typeof value.backupId === "string") {
			protectedIds.add(digest(value.backupId, "Protected backup ID"));
		}
	}
	return protectedIds;
}

export async function canonicalProjectSnapshotDigest(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
}): Promise<Sha256Digest> {
	const paths = projectServerStatePaths(input);
	return snapshotDigest(await collectScope(paths, "canonical-project"));
}

async function verifyStateOperationHeads(
	paths: ProjectServerStatePaths,
	state: BackendStateManifest,
): Promise<void> {
	const heads = [
		{
			digest: state.lastMigrationDigest,
			directory: paths.migrationsRoot,
			field: "migrationDigest",
			protocol: BACKEND_STATE_MIGRATION_PROTOCOL,
		},
		{
			digest: state.lastRestoreDigest,
			directory: paths.restoreReceiptsRoot,
			field: "restoreDigest",
			protocol: BACKEND_STATE_RESTORE_PROTOCOL,
		},
		{
			digest: state.lastRecoveryDigest,
			directory: paths.recoveryReceiptsRoot,
			field: "recoveryDigest",
			protocol: BACKEND_STATE_RECOVERY_PROTOCOL,
		},
		{
			digest: state.lastBuildTransitionDigest,
			directory: paths.buildTransitionsRoot,
			field: "transitionDigest",
			protocol: BACKEND_BUILD_TRANSITION_PROTOCOL,
		},
	] as const;
	for (const head of heads) {
		if (head.digest === null) continue;
		const value = await readCanonicalJsonFile(
			paths,
			join(head.directory, `${head.digest.slice(7)}.json`),
		);
		if (!isRecord(value) || value[head.field] !== head.digest) {
			throw new Error(`Backend state ${head.protocol.id} head is missing or invalid.`);
		}
		const protocol = exactRecord(
			value.protocol,
			["id", "version"],
			`${head.protocol.id} protocol`,
		);
		const body = Object.fromEntries(
			Object.entries(value).filter(([key]) => key !== head.field),
		);
		if (
			protocol.id !== head.protocol.id ||
			protocol.version !== head.protocol.version ||
			value.repositoryIdentity !== paths.repositoryIdentity ||
			canonicalJsonDigest(body) !== head.digest
		) {
			throw new Error(`Backend state ${head.protocol.id} head is missing or invalid.`);
		}
	}
}

async function requireStateManifest(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
}): Promise<BackendStateManifest> {
	const state = await readBackendStateManifest(input);
	if (!state) throw new Error("Backend state is not bootstrapped.");
	return state;
}

async function discardEmptyPreBootstrapState(
	paths: ProjectServerStatePaths,
): Promise<void> {
	const visit = async (path: string): Promise<void> => {
		const metadata = await statNoFollow(path);
		if (!metadata) return;
		if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
			throw new Error("Private project state exists without a Backend state manifest.");
		}
		const names = await readdir(path);
		for (const name of names) await visit(join(path, name));
	};
	await visit(paths.projectStateRoot);
	await rm(paths.projectStateRoot, {recursive: true, force: true});
	await ensureStateDirectory(paths, paths.projectStateRoot);
}

async function completeCommittedLegacyMigration(
	paths: ProjectServerStatePaths,
	state: BackendStateManifest,
	legacyEntries: readonly LegacyCollectedFile[],
	legacyDigest: Sha256Digest,
): Promise<BackendStateMigrationReceipt> {
	if (state.lastMigrationDigest === null) {
		throw new Error("Backend state migration found legacy residue after unrelated state activation.");
	}
	const receiptValue = await readCanonicalJsonFile(
		paths,
		join(paths.migrationsRoot, `${state.lastMigrationDigest.slice(7)}.json`),
	);
	const record = exactRecord(receiptValue, [
		"protocol",
		"repositoryIdentity",
		"sourceKind",
		"legacySnapshotDigest",
		"quarantineId",
		"migratedPaths",
		"quarantinedOnlyPaths",
		"targetStateGeneration",
		"targetBackendBuildDigest",
		"migratedAt",
		"migrationDigest",
	], "Backend migration receipt");
	const protocol = exactRecord(record.protocol, ["id", "version"], "Backend migration protocol");
	const migrationDigest = digest(record.migrationDigest, "Migration receipt digest");
	const {migrationDigest: _migrationDigest, ...receiptBody} = record;
	if (
		protocol.id !== BACKEND_STATE_MIGRATION_PROTOCOL.id ||
		protocol.version !== BACKEND_STATE_MIGRATION_PROTOCOL.version ||
		migrationDigest !== state.lastMigrationDigest ||
		canonicalJsonDigest(receiptBody) !== migrationDigest ||
		record.repositoryIdentity !== paths.repositoryIdentity ||
		record.sourceKind !== "schema-less-project-local-state" ||
		record.legacySnapshotDigest !== legacyDigest ||
		record.targetStateGeneration !== state.generation ||
		record.targetBackendBuildDigest !== state.activeBuild.backendBuildDigest ||
		!Array.isArray(record.migratedPaths) ||
		!record.migratedPaths.every((value) => typeof value === "string") ||
		!Array.isArray(record.quarantinedOnlyPaths) ||
		!record.quarantinedOnlyPaths.every((value) => typeof value === "string")
	) {
		throw new Error("Committed Backend migration receipt is invalid.");
	}
	const quarantineId = digest(record.quarantineId, "Migration quarantine ID");
	const quarantineRoot = join(paths.quarantineRoot, quarantineId.slice(7));
	const quarantineManifest = await readCanonicalJsonFile(
		paths,
		join(quarantineRoot, QUARANTINE_MANIFEST_FILE),
	);
	if (
		quarantineManifest === undefined ||
		canonicalJsonDigest(quarantineManifest) !== quarantineId
	) {
		throw new Error("Committed Backend migration quarantine is invalid.");
	}
	for (const entry of legacyEntries) {
		const bytes = await readFile(join(quarantineRoot, "project-local", ...entry.path.split("/")));
		if (bytes.length !== entry.size || sha256Digest(bytes) !== entry.digest) {
			throw new Error("Committed Backend migration quarantine bytes are invalid.");
		}
	}
	await rm(join(paths.projectRoot, ".codewiki", "runtime"), {recursive: true, force: true});
	await rm(join(paths.projectRoot, ".codewiki", "views"), {recursive: true, force: true});
	await syncDirectory(join(paths.projectRoot, ".codewiki"));
	return Object.freeze({
		protocol: BACKEND_STATE_MIGRATION_PROTOCOL,
		repositoryIdentity: paths.repositoryIdentity,
		sourceKind: "schema-less-project-local-state",
		legacySnapshotDigest: legacyDigest,
		quarantineId,
		migratedPaths: Object.freeze([...(record.migratedPaths as string[])]),
		quarantinedOnlyPaths: Object.freeze([...(record.quarantinedOnlyPaths as string[])]),
		targetStateGeneration: state.generation,
		targetBackendBuildDigest: state.activeBuild.backendBuildDigest,
		migratedAt: timestamp(record.migratedAt),
		migrationDigest,
	});
}

async function collectBackupEntries(paths: ProjectServerStatePaths): Promise<CollectedFile[]> {
	const scopes = await Promise.all(ALL_SCOPES.map((scope) => collectScope(paths, scope)));
	const entries = scopes.flat().sort(compareEntry);
	assertCollectionBounds(entries, "Backend backup");
	return entries;
}

async function collectScope(
	paths: ProjectServerStatePaths,
	scope: BackendBackupScope,
): Promise<CollectedFile[]> {
	if (scope === "canonical-project") {
		return collectFiles({
			scope,
			baseRoot: join(paths.projectRoot, ".codewiki"),
			roots: CANONICAL_ROOTS,
		});
	}
	if (scope === "project-server-private") {
		return collectFiles({
			scope,
			baseRoot: paths.projectServerRoot,
			roots: PROJECT_SERVER_BACKUP_ROOTS,
		});
	}
	if (scope === "backend-audit") {
		return collectFiles({
			scope,
			baseRoot: paths.projectServerRoot,
			roots: PROJECT_SERVER_AUDIT_ROOTS,
		});
	}
	return collectFiles({
		scope,
		baseRoot: paths.runtimeRoot,
		roots: RUNTIME_BACKUP_ROOTS,
	});
}

async function collectFiles(input: {
	readonly scope: BackendBackupScope;
	readonly baseRoot: string;
	readonly roots: readonly string[];
}): Promise<CollectedFile[]> {
	const output: CollectedFile[] = [];
	const visit = async (path: string): Promise<void> => {
		const metadata = await statNoFollow(path);
		if (!metadata) return;
		if (metadata.isSymbolicLink()) throw new Error("Backend state cannot contain symbolic links.");
		const mode = Number(metadata.mode) & 0o777;
		if (
			input.scope !== "canonical-project" &&
			process.platform !== "win32" &&
			(mode & 0o077) !== 0
		) {
			throw new Error("Backend private state permissions must be owner-only.");
		}
		if (metadata.isDirectory()) {
			const names = await readdir(path);
			for (const name of names.sort(compareText)) await visit(join(path, name));
			return;
		}
		if (!metadata.isFile()) throw new Error("Backend state contains an unsupported file type.");
		const bytes = await readFile(path);
		output.push(Object.freeze({
			scope: input.scope,
			path: portableRelative(input.baseRoot, path),
			size: bytes.length,
			mode,
			digest: sha256Digest(bytes),
			sourcePath: path,
		}));
	};
	for (const root of input.roots) await visit(join(input.baseRoot, root));
	return output;
}

async function collectLegacyProjectState(paths: ProjectServerStatePaths): Promise<LegacyCollectedFile[]> {
	const codewikiRoot = join(paths.projectRoot, ".codewiki");
	const runtimeRoot = join(codewikiRoot, "runtime");
	await validateLegacyRuntime(runtimeRoot);
	await validateLegacyViews(join(codewikiRoot, "views"));
	const entries = await collectLegacyFiles(codewikiRoot, ["runtime", "views"]);
	assertCollectionBounds(entries, "Legacy project-local state");
	return entries;
}

async function validateLegacyRuntime(runtimeRoot: string): Promise<void> {
	const metadata = await statNoFollow(runtimeRoot);
	if (!metadata) return;
	if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
		throw new Error("Legacy .codewiki/runtime must be a non-symbolic directory.");
	}
	const names = await readdir(runtimeRoot);
	for (const name of names) {
		const entry = await statNoFollow(join(runtimeRoot, name));
		if (LEGACY_RUNTIME_DIRECTORY_ROOTS.has(name)) {
			if (entry?.isSymbolicLink()) {
				throw new Error("Legacy project-local state cannot contain symbolic links.");
			}
			if (!entry?.isDirectory()) {
				throw new Error(`Legacy runtime directory ${name} has an invalid type.`);
			}
			continue;
		}
		if (LEGACY_RUNTIME_FILE_ROOTS.has(name)) {
			if (entry?.isSymbolicLink()) {
				throw new Error("Legacy project-local state cannot contain symbolic links.");
			}
			if (!entry?.isFile()) {
				throw new Error(`Legacy runtime file ${name} has an invalid type.`);
			}
			continue;
		}
		throw new Error(`Legacy .codewiki/runtime contains undeclared entry ${name}.`);
	}
	const publications = join(runtimeRoot, "publications");
	const publicationMetadata = await statNoFollow(publications);
	if (publicationMetadata) {
		if (publicationMetadata.isSymbolicLink() || !publicationMetadata.isDirectory()) {
			throw new Error("Legacy publications must be a non-symbolic directory.");
		}
		for (const name of await readdir(publications)) {
			if (!LEGACY_PUBLICATION_ROOTS.has(name)) {
				throw new Error(`Legacy publications contain undeclared entry ${name}.`);
			}
		}
	}
}

async function validateLegacyViews(viewsRoot: string): Promise<void> {
	const metadata = await statNoFollow(viewsRoot);
	if (metadata && (metadata.isSymbolicLink() || !metadata.isDirectory())) {
		throw new Error("Legacy .codewiki/views must be a non-symbolic directory.");
	}
}

async function collectLegacyFiles(
	baseRoot: string,
	roots: readonly string[],
): Promise<LegacyCollectedFile[]> {
	const output: LegacyCollectedFile[] = [];
	const visit = async (path: string): Promise<void> => {
		const metadata = await statNoFollow(path);
		if (!metadata) return;
		if (metadata.isSymbolicLink()) throw new Error("Legacy project-local state cannot contain symbolic links.");
		if (metadata.isDirectory()) {
			const names = await readdir(path);
			for (const name of names.sort(compareText)) await visit(join(path, name));
			return;
		}
		if (!metadata.isFile()) throw new Error("Legacy project-local state contains an unsupported file type.");
		const bytes = await readFile(path);
		output.push(Object.freeze({
			path: portableRelative(baseRoot, path),
			size: bytes.length,
			mode: Number(metadata.mode) & 0o777,
			digest: sha256Digest(bytes),
			sourcePath: path,
		}));
	};
	for (const root of roots) await visit(join(baseRoot, root));
	return output.sort((left, right) => left.path.localeCompare(right.path));
}

async function writeLegacyQuarantine(
	paths: ProjectServerStatePaths,
	quarantineId: Sha256Digest,
	manifest: unknown,
	entries: readonly LegacyCollectedFile[],
): Promise<void> {
	const target = join(paths.quarantineRoot, quarantineId.slice(7));
	const existing = await statNoFollow(target);
	if (existing) throw new Error("Legacy migration quarantine already exists.");
	await ensureStateDirectory(paths, target);
	for (const entry of entries) {
		await copyPrivateFile(
			paths,
			entry.sourcePath,
			join(target, "project-local", ...entry.path.split("/")),
		);
	}
	await writePrivateCanonicalJson(paths, join(target, QUARANTINE_MANIFEST_FILE), manifest);
}

async function migrateLegacyEntries(paths: ProjectServerStatePaths): Promise<{
	readonly migratedPaths: readonly string[];
	readonly quarantinedOnlyPaths: readonly string[];
}> {
	const codewikiRoot = join(paths.projectRoot, ".codewiki");
	const mappings = [
		["runtime/continuity", paths.continuityRoot],
		["runtime/evidence", join(paths.executionEvidenceRoot, "legacy")],
		["runtime/preview-evidence", paths.previewEvidenceRoot],
		["runtime/publications/artifacts", paths.publicationArtifactsRoot],
		["runtime/publications/manifests", paths.publicationManifestsRoot],
		["runtime/pushes", paths.pushManifestsRoot],
		["runtime/releases/manifests", paths.releaseManifestsRoot],
		["runtime/sessions", paths.dshSessionsRoot],
		["runtime/snapshots", paths.snapshotsRoot],
		["runtime/synchronization.json", join(paths.synchronizationRoot, "status.json")],
		["runtime/worker-assignments", paths.workerAssignmentsRoot],
		["runtime/workers", paths.workerReportsRoot],
	] as const;
	const migratedPaths: string[] = [];
	for (const [sourceRef, target] of mappings) {
		const source = join(codewikiRoot, ...sourceRef.split("/"));
		if (!(await statNoFollow(source))) continue;
		await copyLegacyPath(paths, source, target);
		migratedPaths.push(sourceRef);
	}
	const legacyTmpEntries = await collectLegacyFiles(codewikiRoot, ["runtime/tmp"]);
	for (const entry of legacyTmpEntries) {
		const match = /^runtime\/tmp\/([^/]+)\/dsh\/sessions\/(.+)$/u.exec(entry.path);
		if (!match) continue;
		const target = join(
			paths.dshSessionsRoot,
			"legacy",
			match[1],
			...match[2].split("/"),
		);
		await copyLegacyPath(paths, entry.sourcePath, target);
		migratedPaths.push(entry.path);
	}
	const quarantinedOnlyPaths: string[] = [];
	for (const entry of [
		"runtime/coordinator",
		"runtime/empty-hooks",
		"runtime/implementation-workers",
		"runtime/integration",
		"runtime/knowledge-apply.lock",
		"runtime/locks",
		"runtime/logs",
		"runtime/tmp",
		"runtime/worktrees",
		"views",
	]) {
		if (await statNoFollow(join(codewikiRoot, ...entry.split("/")))) {
			quarantinedOnlyPaths.push(entry);
		}
	}
	return Object.freeze({
		migratedPaths: Object.freeze(migratedPaths.sort(compareText)),
		quarantinedOnlyPaths: Object.freeze(quarantinedOnlyPaths.sort(compareText)),
	});
}

async function copyLegacyPath(
	paths: ProjectServerStatePaths,
	source: string,
	target: string,
): Promise<void> {
	if (await statNoFollow(target)) {
		throw new Error("Legacy state migration target already exists.");
	}
	const metadata = await statNoFollow(source);
	if (!metadata) return;
	if (metadata.isSymbolicLink()) {
		throw new Error("Legacy state migration source cannot be symbolic.");
	}
	if (metadata.isFile()) {
		await copyPrivateFile(paths, source, target);
		return;
	}
	if (!metadata.isDirectory()) {
		throw new Error("Legacy state migration source type is unsupported.");
	}
	await ensureStateDirectory(paths, target);
	const names = await readdir(source);
	for (const name of names.sort(compareText)) {
		await copyLegacyPath(paths, join(source, name), join(target, name));
	}
}

async function restoreMissingAuditEntries(
	paths: ProjectServerStatePaths,
	backup: BackendStateBackupManifest,
	quarantineId: Sha256Digest,
): Promise<readonly Sha256Digest[]> {
	const backupRoot = backupDirectory(paths, backup.backupId);
	const quarantined: Sha256Digest[] = [];
	for (const entry of backup.entries.filter(({scope}) => scope === "backend-audit")) {
		const source = join(backupRoot, entry.scope, ...entry.path.split("/"));
		const target = join(paths.projectServerRoot, ...entry.path.split("/"));
		const existing = await statNoFollow(target);
		if (existing) {
			if (!existing.isFile() || existing.isSymbolicLink()) {
				throw new Error("Backend audit recovery target is invalid.");
			}
			const bytes = await readFile(target);
			if (bytes.length === entry.size && sha256Digest(bytes) === entry.digest) {
				continue;
			}
			quarantined.push(sha256Digest(bytes));
			await writePrivateBytes(
				paths,
				join(
					paths.quarantineRoot,
					quarantineId.slice(7),
					"audit",
					...entry.path.split("/"),
				),
				bytes,
			);
			await rm(target, {force: false});
		}
		await ensureStateDirectory(paths, dirname(target));
		await copyFile(source, target);
		if (process.platform !== "win32") await chmod(target, 0o600);
		await syncFile(target);
	}
	return Object.freeze(quarantined.sort(compareText));
}

async function applyBackupScopes(
	paths: ProjectServerStatePaths,
	backup: BackendStateBackupManifest,
	scopes: readonly BackendBackupScope[],
): Promise<void> {
	const backupRoot = backupDirectory(paths, backup.backupId);
	for (const scope of scopes) {
		const baseRoot = scopeBaseRoot(paths, scope);
		if (scope !== "canonical-project") {
			await ensureStateDirectory(paths, baseRoot);
		}
		const roots = scopeRoots(scope);
		const entries = backup.entries.filter((entry) => entry.scope === scope);
		for (const root of roots) {
			await replaceBackupRoot({
				backupRoot,
				scope,
				root,
				baseRoot,
				entries,
			});
		}
	}
}

async function replaceBackupRoot(input: {
	readonly backupRoot: string;
	readonly scope: BackendBackupScope;
	readonly root: string;
	readonly baseRoot: string;
	readonly entries: readonly BackendBackupEntry[];
}): Promise<void> {
	const target = join(input.baseRoot, input.root);
	const nonce = `${process.pid}.${randomBytes(8).toString("hex")}`;
	const staging = join(dirname(target), `.${basename(target)}.restore.${nonce}`);
	const rollback = join(dirname(target), `.${basename(target)}.rollback.${nonce}`);
	const rootEntries = input.entries.filter(
		(entry) => entry.path === input.root || entry.path.startsWith(`${input.root}/`),
	);
	let movedCurrent = false;
	try {
		for (const entry of rootEntries) {
			const suffix = entry.path === input.root ? "" : entry.path.slice(input.root.length + 1);
			const destination = suffix === "" ? staging : join(staging, ...suffix.split("/"));
			await mkdir(dirname(destination), {recursive: true, mode: 0o700});
			await copyFile(
				join(input.backupRoot, input.scope, ...entry.path.split("/")),
				destination,
			);
			if (process.platform !== "win32") await chmod(destination, entry.mode);
			await syncFile(destination);
		}
		const current = await statNoFollow(target);
		if (current?.isSymbolicLink()) throw new Error("Backend restore target cannot be symbolic.");
		if (current) {
			await rename(target, rollback);
			movedCurrent = true;
		}
		if (rootEntries.length > 0) await rename(staging, target);
		if (movedCurrent) await rm(rollback, {recursive: true, force: true});
		await syncDirectory(dirname(target));
	} catch (error) {
		await rm(staging, {recursive: true, force: true});
		if (movedCurrent && !(await statNoFollow(target))) await rename(rollback, target);
		throw error;
	}
}

function scopeRoots(scope: BackendBackupScope): readonly string[] {
	if (scope === "canonical-project") return CANONICAL_ROOTS;
	if (scope === "project-server-private") return PROJECT_SERVER_BACKUP_ROOTS;
	if (scope === "backend-audit") return PROJECT_SERVER_AUDIT_ROOTS;
	return RUNTIME_BACKUP_ROOTS;
}

function scopeBaseRoot(paths: ProjectServerStatePaths, scope: BackendBackupScope): string {
	if (scope === "canonical-project") return join(paths.projectRoot, ".codewiki");
	if (scope === "project-server-private" || scope === "backend-audit") {
		return paths.projectServerRoot;
	}
	return paths.runtimeRoot;
}

function createStateManifest(input: {
	readonly paths: ProjectServerStatePaths;
	readonly generation: number;
	readonly activeBuild: BackendBuildBinding;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly lastMigrationDigest: Sha256Digest | null;
	readonly lastRestoreDigest: Sha256Digest | null;
	readonly lastRecoveryDigest: Sha256Digest | null;
	readonly lastBuildTransitionDigest: Sha256Digest | null;
}): BackendStateManifest {
	assertBackendBuildBinding(input.activeBuild);
	const body = {
		protocol: BACKEND_STATE_PROTOCOL,
		repositoryIdentity: input.paths.repositoryIdentity,
		generation: boundedInteger(input.generation, "Backend state generation", 1, Number.MAX_SAFE_INTEGER),
		activeBuild: input.activeBuild,
		createdAt: timestamp(input.createdAt),
		updatedAt: timestamp(input.updatedAt),
		lastMigrationDigest: optionalDigest(input.lastMigrationDigest, "Last migration digest"),
		lastRestoreDigest: optionalDigest(input.lastRestoreDigest, "Last restore digest"),
		lastRecoveryDigest: optionalDigest(input.lastRecoveryDigest, "Last recovery digest"),
		lastBuildTransitionDigest: optionalDigest(
			input.lastBuildTransitionDigest,
			"Last Backend Build transition digest",
		),
	};
	return Object.freeze({...body, stateDigest: canonicalJsonDigest(body)});
}

function normalizeStateManifest(
	value: unknown,
	paths: ProjectServerStatePaths,
): BackendStateManifest {
	const record = exactRecord(value, [
		"protocol",
		"repositoryIdentity",
		"generation",
		"activeBuild",
		"createdAt",
		"updatedAt",
		"lastMigrationDigest",
		"lastRestoreDigest",
		"lastRecoveryDigest",
		"lastBuildTransitionDigest",
		"stateDigest",
	], "Backend state manifest");
	const protocol = exactRecord(record.protocol, ["id", "version"], "Backend state protocol");
	if (protocol.id !== BACKEND_STATE_PROTOCOL.id || protocol.version !== BACKEND_STATE_PROTOCOL.version) {
		throw new Error("Backend state schema is unsupported.");
	}
	if (record.repositoryIdentity !== paths.repositoryIdentity) {
		throw new Error("Backend state repository identity is invalid.");
	}
	const normalized = createStateManifest({
		paths,
		generation: record.generation as number,
		activeBuild: record.activeBuild as BackendBuildBinding,
		createdAt: record.createdAt as string,
		updatedAt: record.updatedAt as string,
		lastMigrationDigest: record.lastMigrationDigest as Sha256Digest | null,
		lastRestoreDigest: record.lastRestoreDigest as Sha256Digest | null,
		lastRecoveryDigest: record.lastRecoveryDigest as Sha256Digest | null,
		lastBuildTransitionDigest: record.lastBuildTransitionDigest as Sha256Digest | null,
	});
	if (canonicalJson(record) !== canonicalJson(normalized)) {
		throw new Error("Backend state manifest digest or shape is invalid.");
	}
	return normalized;
}

function normalizeBackupManifest(
	value: unknown,
	paths: ProjectServerStatePaths,
	backupId: Sha256Digest,
): BackendStateBackupManifest {
	const record = exactRecord(value, [
		"protocol",
		"backupId",
		"repositoryIdentity",
		"generatedAt",
		"sourceState",
		"snapshotDigests",
		"entries",
	], "Backend backup manifest");
	const protocol = exactRecord(record.protocol, ["id", "version"], "Backend backup protocol");
	if (protocol.id !== BACKEND_BACKUP_PROTOCOL.id || protocol.version !== BACKEND_BACKUP_PROTOCOL.version) {
		throw new Error("Backend backup schema is unsupported.");
	}
	if (record.backupId !== backupId || record.repositoryIdentity !== paths.repositoryIdentity) {
		throw new Error("Backend backup identity is invalid.");
	}
	const sourceState = normalizeStateManifest(record.sourceState, paths);
	if (!Array.isArray(record.entries) || record.entries.length > MAX_BACKUP_FILES) {
		throw new Error("Backend backup entries are invalid.");
	}
	const entries = Object.freeze(record.entries.map(normalizeBackupEntry).sort(compareEntry));
	const digests = normalizeSnapshotDigests(record.snapshotDigests);
	const body = {
		protocol: BACKEND_BACKUP_PROTOCOL,
		repositoryIdentity: paths.repositoryIdentity,
		generatedAt: timestamp(record.generatedAt),
		sourceState,
		snapshotDigests: digests,
		entries,
	};
	if (canonicalJsonDigest(body) !== backupId || canonicalJson({...body, backupId}) !== canonicalJson(record)) {
		throw new Error("Backend backup digest or shape is invalid.");
	}
	if (canonicalJson(snapshotDigests(entries)) !== canonicalJson(digests)) {
		throw new Error("Backend backup snapshot digests are invalid.");
	}
	assertCollectionBounds(entries, "Backend backup");
	return Object.freeze({...body, backupId});
}

function normalizeBackupEntry(value: unknown): BackendBackupEntry {
	const record = exactRecord(value, ["scope", "path", "size", "mode", "digest"], "Backend backup entry");
	if (!ALL_SCOPES.includes(record.scope as BackendBackupScope)) {
		throw new Error("Backend backup entry scope is invalid.");
	}
	return Object.freeze({
		scope: record.scope as BackendBackupScope,
		path: safeRelativePath(record.path),
		size: boundedInteger(record.size, "Backup entry size", 0, MAX_BACKUP_BYTES),
		mode: boundedInteger(record.mode, "Backup entry mode", 0, 0o777),
		digest: digest(record.digest, "Backup entry digest"),
	});
}

function normalizeSnapshotDigests(value: unknown): Readonly<Record<BackendBackupScope, Sha256Digest>> {
	const record = exactRecord(value, ALL_SCOPES, "Backend backup snapshot digests");
	return Object.freeze({
		"canonical-project": digest(record["canonical-project"], "Canonical snapshot digest"),
		"project-server-private": digest(record["project-server-private"], "Project Server snapshot digest"),
		"runtime-private": digest(record["runtime-private"], "Runtime snapshot digest"),
		"backend-audit": digest(record["backend-audit"], "Backend audit snapshot digest"),
	});
}

function snapshotDigests(
	entries: readonly Pick<BackendBackupEntry, "scope" | "path" | "size" | "mode" | "digest">[],
): Readonly<Record<BackendBackupScope, Sha256Digest>> {
	return Object.freeze({
		"canonical-project": snapshotDigest(entries.filter((entry) => entry.scope === "canonical-project")),
		"project-server-private": snapshotDigest(entries.filter((entry) => entry.scope === "project-server-private")),
		"runtime-private": snapshotDigest(entries.filter((entry) => entry.scope === "runtime-private")),
		"backend-audit": snapshotDigest(entries.filter((entry) => entry.scope === "backend-audit")),
	});
}

function snapshotDigest(
	entries: readonly Pick<BackendBackupEntry, "scope" | "path" | "size" | "mode" | "digest">[],
): Sha256Digest {
	return canonicalJsonDigest(entries.map(({scope, path, size, mode, digest: entryDigest}) => ({
		scope,
		path,
		size,
		mode,
		digest: entryDigest,
	})).sort(compareEntry));
}

function legacySnapshotDigest(entries: readonly LegacyProjectStateEntry[]): Sha256Digest {
	return canonicalJsonDigest(entries.map(({path, size, mode, digest: entryDigest}) => ({
		path,
		size,
		mode,
		digest: entryDigest,
	})).sort((left, right) => left.path.localeCompare(right.path)));
}

async function assertExactBackupTree(
	root: string,
	manifest: BackendStateBackupManifest,
): Promise<void> {
	const expected = new Set([
		BACKUP_MANIFEST_FILE,
		...manifest.entries.map((entry) => `${entry.scope}/${entry.path}`),
	]);
	const actual: string[] = [];
	const visit = async (path: string): Promise<void> => {
		const metadata = await statNoFollow(path);
		if (!metadata || metadata.isSymbolicLink()) {
			throw new Error("Backend backup tree contains a missing or symbolic path.");
		}
		if (process.platform !== "win32" && ((Number(metadata.mode) & 0o777) & 0o077) !== 0) {
			throw new Error("Backend backup tree permissions must be owner-only.");
		}
		if (metadata.isDirectory()) {
			const names = await readdir(path);
			for (const name of names.sort(compareText)) await visit(join(path, name));
			return;
		}
		if (!metadata.isFile()) throw new Error("Backend backup tree contains an unsupported file type.");
		actual.push(portableRelative(root, path));
	};
	await visit(root);
	if (canonicalJson(actual.sort(compareText)) !== canonicalJson([...expected].sort(compareText))) {
		throw new Error("Backend backup tree contains undeclared or missing files.");
	}
}

async function verifyBackupFile(path: string, entry: BackendBackupEntry): Promise<void> {
	const metadata = await statNoFollow(path);
	if (!metadata?.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Backend backup file ${entry.scope}/${entry.path} is missing or invalid.`);
	}
	const bytes = await readFile(path);
	if (bytes.length !== entry.size || sha256Digest(bytes) !== entry.digest) {
		throw new Error(`Backend backup file ${entry.scope}/${entry.path} failed digest verification.`);
	}
}

async function assertCodeWikiProject(paths: ProjectServerStatePaths): Promise<void> {
	const codewiki = await statNoFollow(join(paths.projectRoot, ".codewiki"));
	const config = await statNoFollow(join(paths.projectRoot, ".codewiki", "config.json"));
	if (!codewiki?.isDirectory() || codewiki.isSymbolicLink() || !config?.isFile() || config.isSymbolicLink()) {
		throw new Error("Backend state requires a non-symbolic .codewiki/config.json project.");
	}
}

async function assertNoLegacyProjectState(paths: ProjectServerStatePaths): Promise<void> {
	for (const name of ["runtime", "views"]) {
		if (await statNoFollow(join(paths.projectRoot, ".codewiki", name))) {
			throw new Error("Legacy project-local state requires explicit migration.");
		}
	}
}

async function assertProjectStopped(paths: ProjectServerStatePaths): Promise<void> {
	for (const path of [
		projectCoordinatorEndpointPath(paths.projectRoot, paths.stateRoot),
		projectCoordinatorOwnershipPath(paths.projectRoot, paths.stateRoot),
	]) {
		if (await statNoFollow(path)) {
			throw new Error("Backend state maintenance requires the Project Server to be stopped.");
		}
	}
}

async function reconcileCompletedRestoreTransaction(
	paths: ProjectServerStatePaths,
	state: BackendStateManifest,
): Promise<void> {
	let names: string[];
	try {
		names = await readdir(paths.restoreTransactionsRoot);
	} catch (error) {
		if (missingPath(error)) return;
		throw error;
	}
	if (names.length !== 1 || state.lastRestoreDigest === null) return;
	const transactionPath = join(paths.restoreTransactionsRoot, names[0]);
	const transaction = exactRecord(
		await readCanonicalJsonFile(paths, transactionPath),
		[
			"protocol",
			"transactionId",
			"backupId",
			"expectedStateDigest",
			"expectedCanonicalSnapshotDigest",
			"scopes",
			"activateBackupBuild",
			"previousSnapshotDigests",
			"restoredAt",
		],
		"Backend restore transaction",
	);
	const transactionId = digest(transaction.transactionId, "Restore transaction ID");
	if (names[0] !== `${transactionId.slice(7)}.json`) return;
	const {
		transactionId: _transactionId,
		previousSnapshotDigests: _previousSnapshotDigests,
		...transactionIdentity
	} = transaction;
	if (canonicalJsonDigest(transactionIdentity) !== transactionId) return;
	const receiptPath = join(
		paths.restoreReceiptsRoot,
		`${state.lastRestoreDigest.slice(7)}.json`,
	);
	const receipt = exactRecord(
		await readCanonicalJsonFile(paths, receiptPath),
		[
			"protocol",
			"repositoryIdentity",
			"backupId",
			"restoredScopes",
			"previousStateDigest",
			"targetStateGeneration",
			"targetBackendBuildDigest",
			"previousSnapshotDigests",
			"restoredSnapshotDigests",
			"activatedBackupBuild",
			"restoredAt",
			"restoreDigest",
		],
		"Backend restore receipt",
	);
	const restoreDigest = digest(receipt.restoreDigest, "Restore receipt digest");
	const {restoreDigest: _restoreDigest, ...receiptBody} = receipt;
	if (
		restoreDigest !== state.lastRestoreDigest ||
		canonicalJsonDigest(receiptBody) !== restoreDigest ||
		receipt.repositoryIdentity !== paths.repositoryIdentity ||
		receipt.backupId !== transaction.backupId ||
		receipt.previousStateDigest !== transaction.expectedStateDigest ||
		receipt.targetStateGeneration !== state.generation ||
		receipt.targetBackendBuildDigest !== state.activeBuild.backendBuildDigest ||
		receipt.restoredAt !== transaction.restoredAt ||
		receipt.activatedBackupBuild !== transaction.activateBackupBuild ||
		canonicalJson(receipt.restoredScopes) !== canonicalJson(transaction.scopes)
	) {
		return;
	}
	const previousDigests = normalizeSnapshotDigests(receipt.previousSnapshotDigests);
	if (
		previousDigests["canonical-project"] !==
		transaction.expectedCanonicalSnapshotDigest
	) {
		return;
	}
	const restoredDigests = normalizeSnapshotDigests(receipt.restoredSnapshotDigests);
	const currentDigests = snapshotDigests(await collectBackupEntries(paths));
	for (const scope of normalizedScopes(transaction.scopes as BackendBackupScope[])) {
		if (scope !== "backend-audit" && currentDigests[scope] !== restoredDigests[scope]) return;
	}
	await rm(transactionPath, {force: false});
}

async function assertNoPendingRestore(paths: ProjectServerStatePaths): Promise<void> {
	let names: string[];
	try {
		names = await readdir(paths.restoreTransactionsRoot);
	} catch (error) {
		if (missingPath(error)) return;
		throw error;
	}
	if (names.length > 0) {
		throw new Error("Incomplete Backend restore requires exact resume before state maintenance.");
	}
}

async function readMatchingRestoreTransaction(
	paths: ProjectServerStatePaths,
	transactionPath: string,
	identity: Omit<
		BackendRestoreTransaction,
		"transactionId" | "previousSnapshotDigests"
	>,
): Promise<BackendRestoreTransaction | undefined> {
	let names: string[];
	try {
		names = await readdir(paths.restoreTransactionsRoot);
	} catch (error) {
		if (!missingPath(error)) throw error;
		return undefined;
	}
	const expectedName = basename(transactionPath);
	if (names.some((name) => name !== expectedName)) {
		throw new Error("A different incomplete Backend restore blocks this operation.");
	}
	if (!names.includes(expectedName)) return undefined;
	const record = exactRecord(
		await readCanonicalJsonFile(paths, transactionPath),
		[
			"protocol",
			"transactionId",
			"backupId",
			"expectedStateDigest",
			"expectedCanonicalSnapshotDigest",
			"scopes",
			"activateBackupBuild",
			"previousSnapshotDigests",
			"restoredAt",
		],
		"Backend restore transaction",
	);
	const protocol = exactRecord(record.protocol, ["id", "version"], "Backend restore protocol");
	if (
		protocol.id !== BACKEND_STATE_RESTORE_PROTOCOL.id ||
		protocol.version !== BACKEND_STATE_RESTORE_PROTOCOL.version ||
		typeof record.activateBackupBuild !== "boolean"
	) {
		throw new Error("Backend restore transaction protocol is invalid.");
	}
	const normalized = Object.freeze({
		protocol: BACKEND_STATE_RESTORE_PROTOCOL,
		transactionId: digest(record.transactionId, "Restore transaction ID"),
		backupId: digest(record.backupId, "Restore backup ID"),
		expectedStateDigest: digest(record.expectedStateDigest, "Restore expected state digest"),
		expectedCanonicalSnapshotDigest: digest(
			record.expectedCanonicalSnapshotDigest,
			"Restore expected canonical snapshot digest",
		),
		scopes: normalizedScopes(record.scopes as BackendBackupScope[]),
		activateBackupBuild: record.activateBackupBuild,
		previousSnapshotDigests: normalizeSnapshotDigests(record.previousSnapshotDigests),
		restoredAt: timestamp(record.restoredAt),
	}) as BackendRestoreTransaction;
	const {
		transactionId,
		previousSnapshotDigests: _previousSnapshotDigests,
		...normalizedIdentity
	} = normalized;
	if (
		transactionId !== `sha256:${expectedName.slice(0, 64)}` ||
		canonicalJson(normalizedIdentity) !== canonicalJson(identity)
	) {
		throw new Error("Backend restore resume does not match its durable transaction.");
	}
	return normalized;
}

async function ensureStateDirectory(paths: ProjectServerStatePaths, target: string): Promise<void> {
	const root = resolve(paths.stateRoot);
	const resolvedTarget = resolve(target);
	const child = relative(root, resolvedTarget);
	if (child.startsWith("..") || child === "" && resolvedTarget !== root) {
		throw new Error("Private state directory escaped the Backend state root.");
	}
	await mkdir(root, {recursive: true, mode: 0o700});
	await assertPrivateDirectory(root);
	if (child === "") return;
	let current = root;
	for (const part of child.split(/[\\/]/u)) {
		current = join(current, part);
		const metadata = await statNoFollow(current);
		if (!metadata) await mkdir(current, {recursive: false, mode: 0o700});
		await assertPrivateDirectory(current);
	}
}

async function assertPrivateDirectory(path: string): Promise<void> {
	const metadata = await statNoFollow(path);
	if (!metadata?.isDirectory() || metadata.isSymbolicLink()) {
		throw new Error("Backend private state path must be a non-symbolic directory.");
	}
	if (process.platform !== "win32") await chmod(path, 0o700);
}

async function writePrivateCanonicalJson(
	paths: ProjectServerStatePaths,
	path: string,
	value: unknown,
): Promise<void> {
	await writePrivateBytes(paths, path, Buffer.from(`${canonicalJson(value)}\n`, "utf8"));
}

async function writePrivateBytes(
	paths: ProjectServerStatePaths,
	path: string,
	bytes: Uint8Array,
): Promise<void> {
	await ensureStateDirectory(paths, dirname(path));
	const temporary = `${path}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
	let handle: Awaited<ReturnType<typeof open>> | undefined;
	try {
		handle = await open(temporary, "wx", 0o600);
		await handle.writeFile(bytes);
		await handle.sync();
		await handle.close();
		handle = undefined;
		if (process.platform !== "win32") await chmod(temporary, 0o600);
		await rename(temporary, path);
		await syncDirectory(dirname(path));
	} finally {
		await handle?.close();
		await rm(temporary, {force: true});
	}
}

async function readCanonicalJsonFile(
	paths: ProjectServerStatePaths,
	path: string,
): Promise<unknown | undefined> {
	await assertPrivatePath(paths, path);
	let bytes: Buffer;
	try {
		bytes = await readFile(path);
	} catch (error) {
		if (missingPath(error)) return undefined;
		throw error;
	}
	if (bytes.length > 4 * 1024 * 1024) throw new Error("Backend state JSON exceeds 4 MiB.");
	try {
		return JSON.parse(bytes.toString("utf8"));
	} catch {
		throw new Error("Backend state JSON is invalid.");
	}
}

async function assertPrivatePath(paths: ProjectServerStatePaths, path: string): Promise<void> {
	const root = resolve(paths.stateRoot);
	const target = resolve(path);
	const child = relative(root, target);
	if (child.startsWith("..")) throw new Error("Backend private path escaped state root.");
	let current = root;
	for (const part of child.split(/[\\/]/u).filter(Boolean)) {
		current = join(current, part);
		const metadata = await statNoFollow(current);
		if (!metadata) return;
		if (metadata.isSymbolicLink()) throw new Error("Backend private state path cannot be symbolic.");
	}
}

async function copyPrivateFile(
	paths: ProjectServerStatePaths,
	source: string,
	target: string,
): Promise<void> {
	await ensureStateDirectory(paths, dirname(target));
	await copyFile(source, target);
	if (process.platform !== "win32") await chmod(target, 0o600);
	await syncFile(target);
}

async function topLevelNames(root: string): Promise<string[]> {
	try {
		const names = await readdir(root);
		return names.sort(compareText);
	} catch (error) {
		if (missingPath(error)) return [];
		throw error;
	}
}

function backupDirectory(paths: ProjectServerStatePaths, backupId: Sha256Digest): string {
	return join(paths.backupsRoot, backupId.slice(7));
}

function normalizedScopes(value: readonly BackendBackupScope[]): readonly BackendBackupScope[] {
	if (!Array.isArray(value) || value.length === 0) throw new Error("Backend restore scopes are required.");
	const scopes = [...new Set(value)];
	if (scopes.some((scope) => !ALL_SCOPES.includes(scope))) {
		throw new Error("Backend restore scope is invalid.");
	}
	return Object.freeze(ALL_SCOPES.filter((scope) => scopes.includes(scope)));
}

function withoutSourcePath<T extends {readonly sourcePath: string}>(value: T): Omit<T, "sourcePath"> {
	const {sourcePath: _sourcePath, ...entry} = value;
	return entry;
}

function portableRelative(root: string, path: string): string {
	return safeRelativePath(relative(root, path).split("\\").join("/"));
}

function safeRelativePath(value: unknown): string {
	if (
		typeof value !== "string" ||
		value === "" ||
		value.startsWith("/") ||
		value.endsWith("/") ||
		value.includes("\\") ||
		value.includes("\0") ||
		value.split("/").some((part) => part === "" || part === "." || part === "..")
	) {
		throw new Error("Backend state relative path is invalid.");
	}
	return value;
}

function assertCollectionBounds(
	entries: readonly Pick<BackendBackupEntry, "size">[],
	label: string,
): void {
	if (entries.length > MAX_BACKUP_FILES) throw new Error(`${label} exceeds its file-count limit.`);
	if (entries.reduce((sum, entry) => sum + entry.size, 0) > MAX_BACKUP_BYTES) {
		throw new Error(`${label} exceeds its byte limit.`);
	}
}

function compareText(left: string, right: string): number {
	return left.localeCompare(right);
}

function compareEntry(
	left: Pick<BackendBackupEntry, "scope" | "path">,
	right: Pick<BackendBackupEntry, "scope" | "path">,
): number {
	return left.scope.localeCompare(right.scope) || left.path.localeCompare(right.path);
}

function exactRecord(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
	if (!isRecord(value) || canonicalJson(Object.keys(value).sort(compareText)) !== canonicalJson([...keys].sort(compareText))) {
		throw new Error(`${label} shape is invalid.`);
	}
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function digest(value: unknown, field: string): Sha256Digest {
	if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value)) {
		throw new Error(`${field} is invalid.`);
	}
	return value as Sha256Digest;
}

function optionalDigest(value: unknown, field: string): Sha256Digest | null {
	return value === null ? null : digest(value, field);
}

function timestamp(value: unknown = new Date().toISOString()): string {
	if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
		throw new Error("Backend state timestamp is invalid.");
	}
	return value;
}

function compareVersions(left: string, right: string): number {
	const [leftCore, leftPrerelease] = left.split("-", 2);
	const [rightCore, rightPrerelease] = right.split("-", 2);
	const leftParts = leftCore.split(".").map(Number);
	const rightParts = rightCore.split(".").map(Number);
	for (let index = 0; index < 3; index += 1) {
		const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
		if (difference !== 0) return difference;
	}
	if (leftPrerelease === undefined && rightPrerelease !== undefined) return 1;
	if (leftPrerelease !== undefined && rightPrerelease === undefined) return -1;
	return (leftPrerelease ?? "").localeCompare(rightPrerelease ?? "");
}

function boundedInteger(
	value: unknown,
	field: string,
	minimum: number,
	maximum: number,
): number {
	if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
		throw new Error(`${field} is invalid.`);
	}
	return value as number;
}

async function syncFile(path: string): Promise<void> {
	const handle = await open(path, "r");
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}

async function syncDirectory(path: string): Promise<void> {
	if (process.platform === "win32") return;
	const handle = await open(path, "r");
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}

async function statNoFollow(path: string): Promise<Awaited<ReturnType<typeof lstat>> | undefined> {
	try {
		return await lstat(path);
	} catch (error) {
		if (missingPath(error)) return undefined;
		throw error;
	}
}

const missingPath = (error: unknown): boolean =>
	error instanceof Error && "code" in error && error.code === "ENOENT";
