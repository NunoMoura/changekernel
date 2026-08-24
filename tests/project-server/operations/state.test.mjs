import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {
	chmod,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rm,
	stat,
	symlink,
	writeFile,
} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import test from "node:test";

import {
	createBackendBuildBinding,
	DEFAULT_BACKEND_BUILD,
	LEGACY_BACKEND_BUILD_PROTOCOL,
} from "../../../src/project-server/operations/build.ts";
import {projectServerStatePaths} from "../../../src/project-server/operations/paths.ts";
import {
	activateBackendBuild,
	bootstrapBackendState,
	canonicalProjectSnapshotDigest,
	createBackendStateBackup,
	legacyProjectStateSnapshotDigest,
	migrateBackendState,
	pruneBackendStateBackups,
	readBackendStateBackup,
	readBackendStateManifest,
	recoverBackendStateManifest,
	restoreBackendStateBackup,
	BACKEND_STATE_RESTORE_PROTOCOL,
} from "../../../src/project-server/operations/state.ts";
import {canonicalJsonDigest} from "../../../src/utils/canonical-json.ts";
import {ensureProjectCoordinatorService} from "../../../src/project-server/coordinator/process.ts";
import {authorizeDshAgentSessionCustody} from "../../../src/project-server/operations/session-custody.ts";
import {
	createProjectSessionContinuity,
	readProjectSessionContinuity,
} from "../../../src/project-server/sessions/project-continuity-store.ts";

const ALL_SCOPES = ["canonical-project", "project-server-private", "runtime-private"];

async function fixture(suffix) {
	const base = await mkdtemp(join(tmpdir(), `codewiki-b7-state-${suffix}-`));
	const repoRoot = join(base, "project");
	const stateRoot = join(base, "state");
	await mkdir(join(repoRoot, ".codewiki", "kb"), {recursive: true});
	await mkdir(join(repoRoot, ".codewiki", "traces"), {recursive: true});
	await mkdir(join(repoRoot, ".codewiki", "check-packs"), {recursive: true});
	await writeFile(join(repoRoot, ".codewiki", "config.json"), '{"project":"fixture"}\n');
	await writeFile(join(repoRoot, ".codewiki", "kb", "topic.md"), "# Topic\n");
	await writeFile(join(repoRoot, ".codewiki", "traces", "trace.jsonl"), "{}\n");
	return {
		base,
		repoRoot,
		stateRoot,
		paths: projectServerStatePaths({repoRoot, stateRoot}),
		async cleanup() {
			await rm(base, {recursive: true, force: true});
		},
	};
}

function byteDigest(bytes) {
	return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function legacyBackendBuild() {
	const domainPlugins = DEFAULT_BACKEND_BUILD.domainPlugins.map((entry) => ({
		pluginId: entry.pluginId,
		pluginVersion: entry.pluginVersion,
		admissionDigest: entry.admissionDigest,
		identityDigest: entry.identityDigest,
	}));
	const body = {
		protocol: LEGACY_BACKEND_BUILD_PROTOCOL,
		packageName: "@nunomoura/codewiki",
		packageVersion: "0.3.0",
		packageLockDigest: DEFAULT_BACKEND_BUILD.packageLockDigest,
		dshProfiles: DEFAULT_BACKEND_BUILD.dshProfiles,
		domainPlugins,
		domainPluginClosureDigest: canonicalJsonDigest(domainPlugins),
		fileSchemas: DEFAULT_BACKEND_BUILD.fileSchemas.map((entry) =>
			entry.id === "codewiki.runtime-build-manifest"
				? {id: entry.id, version: "3.0.0"}
				: entry,
		),
		protocols: DEFAULT_BACKEND_BUILD.protocols.filter(
			({id}) => !id.startsWith("codewiki.backend-") && id !== "codewiki.runtime-production-qualification",
		),
	};
	return Object.freeze({...body, backendBuildDigest: canonicalJsonDigest(body)});
}

test("Backend state bootstrap is private, permission-bounded, and never creates legacy roots", async () => {
	const context = await fixture("bootstrap");
	try {
		await mkdir(context.paths.locksRoot, {recursive: true});
		const state = await bootstrapBackendState({
			repoRoot: context.repoRoot,
			stateRoot: context.stateRoot,
			createdAt: "2026-09-01T10:00:00.000Z",
		});
		assert.equal(state.generation, 1);
		assert.equal(state.repositoryIdentity, context.paths.repositoryIdentity);
		assert.equal((await readBackendStateManifest(context))?.stateDigest, state.stateDigest);
		const custody = await authorizeDshAgentSessionCustody({
			...context,
			sessionId: "session:bootstrap",
		});
		assert.equal(custody.sessionRoot.startsWith(context.paths.dshSessionsRoot), true);
		assert.match(
			custody.sessionRootRef,
			/^codewiki-state:\/\/project\/runtime\/dsh-agent-sessions\//,
		);
		assert.match(custody.custodyDigest, /^sha256:[a-f0-9]{64}$/);
		await assert.rejects(readFile(join(context.repoRoot, ".codewiki", "runtime")), /ENOENT/);
		await assert.rejects(readFile(join(context.repoRoot, ".codewiki", "views")), /ENOENT/);
		if (process.platform !== "win32") {
			assert.equal((await stat(context.paths.projectStateRoot)).mode & 0o777, 0o700);
			assert.equal((await stat(context.paths.stateManifestPath)).mode & 0o777, 0o600);
		}
	} finally {
		await context.cleanup();
	}
});

test("Backend bootstrap rejects undeclared private bytes without a manifest", async () => {
	const context = await fixture("bootstrap-residue");
	try {
		await mkdir(context.paths.projectServerRoot, {recursive: true});
		await writeFile(join(context.paths.projectServerRoot, "foreign.json"), "{}\n");
		await assert.rejects(
			bootstrapBackendState(context),
			/Private project state exists without a Backend state manifest/,
		);
	} finally {
		await context.cleanup();
	}
});

test("legacy project-local state migrates declared durable bytes and quarantines disposable residue", async () => {
	const context = await fixture("migration");
	try {
		const opaqueSession = Buffer.from([0, 255, 17, 128, 10]);
		const legacyTmpSessionDirectory = join(
			context.repoRoot,
			".codewiki",
			"runtime",
			"tmp",
			"TRACE-old",
			"dsh",
			"sessions",
		);
		await mkdir(join(context.repoRoot, ".codewiki", "runtime", "sessions"), {recursive: true});
		await mkdir(legacyTmpSessionDirectory, {recursive: true});
		await mkdir(join(context.repoRoot, ".codewiki", "views"), {recursive: true});
		await writeFile(
			join(context.repoRoot, ".codewiki", "runtime", "sessions", "run.session"),
			opaqueSession,
		);
		await writeFile(join(context.repoRoot, ".codewiki", "runtime", "tmp", "scratch.log"), "scratch\n");
		await writeFile(join(legacyTmpSessionDirectory, "old.session"), opaqueSession);
		await writeFile(join(context.repoRoot, ".codewiki", "views", "status.json"), "{}\n");
		const expectedLegacySnapshotDigest = await legacyProjectStateSnapshotDigest(context);
		await assert.rejects(
			migrateBackendState({
				...context,
				expectedLegacySnapshotDigest: `sha256:${"0".repeat(64)}`,
			}),
			/expected legacy snapshot is stale/,
		);
		const receipt = await migrateBackendState({
			...context,
			expectedLegacySnapshotDigest,
			migratedAt: "2026-09-01T11:00:00.000Z",
		});
		assert.deepEqual(receipt.migratedPaths, [
			"runtime/sessions",
			"runtime/tmp/TRACE-old/dsh/sessions/old.session",
		]);
		assert.deepEqual(receipt.quarantinedOnlyPaths, ["runtime/tmp", "views"]);
		assert.deepEqual(
			await readFile(join(context.paths.dshSessionsRoot, "run.session")),
			opaqueSession,
		);
		assert.deepEqual(
			await readFile(
				join(context.paths.dshSessionsRoot, "legacy", "TRACE-old", "old.session"),
			),
			opaqueSession,
		);
		assert.deepEqual(
			await readFile(
				join(
					context.paths.quarantineRoot,
					receipt.quarantineId.slice(7),
					"project-local",
					"runtime",
					"sessions",
					"run.session",
				),
			),
			opaqueSession,
		);
		await assert.rejects(stat(join(context.repoRoot, ".codewiki", "runtime")), /ENOENT/);
		await assert.rejects(stat(join(context.repoRoot, ".codewiki", "views")), /ENOENT/);
		assert.equal((await readBackendStateManifest(context))?.lastMigrationDigest, receipt.migrationDigest);
		await mkdir(join(context.repoRoot, ".codewiki", "runtime", "sessions"), {recursive: true});
		await mkdir(legacyTmpSessionDirectory, {recursive: true});
		await mkdir(join(context.repoRoot, ".codewiki", "views"), {recursive: true});
		await writeFile(
			join(context.repoRoot, ".codewiki", "runtime", "sessions", "run.session"),
			opaqueSession,
		);
		await writeFile(join(context.repoRoot, ".codewiki", "runtime", "tmp", "scratch.log"), "scratch\n");
		await writeFile(join(legacyTmpSessionDirectory, "old.session"), opaqueSession);
		await writeFile(join(context.repoRoot, ".codewiki", "views", "status.json"), "{}\n");
		const resumed = await migrateBackendState({
			...context,
			expectedLegacySnapshotDigest,
		});
		assert.equal(resumed.migrationDigest, receipt.migrationDigest);
		assert.equal(await stat(join(context.repoRoot, ".codewiki", "runtime")).then(() => true, () => false), false);
		assert.equal(await stat(join(context.repoRoot, ".codewiki", "views")).then(() => true, () => false), false);
	} finally {
		await context.cleanup();
	}
});

test("legacy migration rejects undeclared residue and symbolic paths", async () => {
	const context = await fixture("legacy-reject");
	const external = join(context.base, "external");
	try {
		await mkdir(join(context.repoRoot, ".codewiki", "runtime", "foreign"), {recursive: true});
		await assert.rejects(
			legacyProjectStateSnapshotDigest(context),
			/undeclared entry foreign/,
		);
		await rm(join(context.repoRoot, ".codewiki", "runtime"), {recursive: true});
		await mkdir(join(context.repoRoot, ".codewiki", "runtime"), {recursive: true});
		await mkdir(external);
		await symlink(external, join(context.repoRoot, ".codewiki", "runtime", "sessions"));
		await assert.rejects(
			legacyProjectStateSnapshotDigest(context),
			/cannot contain symbolic links/,
		);
	} finally {
		await context.cleanup();
	}
});

test("backup copies opaque Session bytes exactly, verifies digests, and restores by expected-head CAS", async () => {
	const context = await fixture("backup-restore");
	try {
		const initial = await bootstrapBackendState({...context, createdAt: "2026-09-02T10:00:00.000Z"});
		const continuity = await createProjectSessionContinuity({
			...context,
			continuityKey: "implementation:WU-backup",
			sessionId: "session-backup",
			runtimeBuild: {
				buildDigest: `sha256:${"9".repeat(64)}`,
				runProtocolVersion: "3.0.0",
			},
			createdAt: "2026-09-02T10:01:00.000Z",
		});
		assert.equal(
			(await readProjectSessionContinuity({
				...context,
				continuityKey: continuity.continuityKey,
			}))?.recordDigest,
			continuity.recordDigest,
		);
		const originalConfig = await readFile(join(context.repoRoot, ".codewiki", "config.json"));
		const opaqueSession = Buffer.from([222, 173, 190, 239, 0, 10]);
		await mkdir(context.paths.dshSessionsRoot, {recursive: true, mode: 0o700});
		await writeFile(join(context.paths.dshSessionsRoot, "run.session"), opaqueSession, {mode: 0o600});
		const backup = await createBackendStateBackup({
			...context,
			generatedAt: "2026-09-02T10:05:00.000Z",
		});
		const backedSession = join(
			context.paths.backupsRoot,
			backup.backupId.slice(7),
			"runtime-private",
			"dsh-agent-sessions",
			"run.session",
		);
		assert.deepEqual(await readFile(backedSession), opaqueSession);
		await writeFile(join(context.repoRoot, ".codewiki", "config.json"), '{"project":"changed"}\n');
		await writeFile(join(context.paths.dshSessionsRoot, "run.session"), Buffer.from("changed\n"));
		const expectedCanonicalSnapshotDigest = await canonicalProjectSnapshotDigest(context);
		await assert.rejects(
			restoreBackendStateBackup({
				...context,
				backupId: backup.backupId,
				scopes: ["backend-audit"],
				expectedStateDigest: initial.stateDigest,
				expectedCanonicalSnapshotDigest,
				activateBackupBuild: false,
			}),
			/audit scope is backup-only/,
		);
		await assert.rejects(
			restoreBackendStateBackup({
				...context,
				backupId: backup.backupId,
				scopes: ALL_SCOPES,
				expectedStateDigest: `sha256:${"0".repeat(64)}`,
				expectedCanonicalSnapshotDigest,
				activateBackupBuild: false,
			}),
			/expected state is stale/,
		);
		assert.deepEqual(await readFile(backedSession), opaqueSession);
		const receipt = await restoreBackendStateBackup({
			...context,
			backupId: backup.backupId,
			scopes: ALL_SCOPES,
			expectedStateDigest: initial.stateDigest,
			expectedCanonicalSnapshotDigest,
			activateBackupBuild: false,
			restoredAt: "2026-09-02T10:10:00.000Z",
		});
		assert.equal(receipt.previousStateDigest, initial.stateDigest);
		assert.deepEqual(await readFile(join(context.repoRoot, ".codewiki", "config.json")), originalConfig);
		assert.deepEqual(await readFile(join(context.paths.dshSessionsRoot, "run.session")), opaqueSession);
		assert.deepEqual(await readFile(backedSession), opaqueSession);
		const restoredState = await readBackendStateManifest(context);
		assert.equal(restoredState?.generation, 2);
		assert.equal(
			(await readBackendStateBackup({...context, backupId: backup.backupId})).backupId,
			backup.backupId,
		);
		const transactionIdentity = {
			protocol: BACKEND_STATE_RESTORE_PROTOCOL,
			backupId: backup.backupId,
			expectedStateDigest: initial.stateDigest,
			expectedCanonicalSnapshotDigest,
			scopes: ALL_SCOPES,
			activateBackupBuild: false,
			restoredAt: "2026-09-02T10:10:00.000Z",
		};
		const transactionId = canonicalJsonDigest(transactionIdentity);
		const transactionPath = join(
			context.paths.restoreTransactionsRoot,
			`${transactionId.slice(7)}.json`,
		);
		await mkdir(context.paths.restoreTransactionsRoot, {recursive: true});
		await writeFile(transactionPath, `${JSON.stringify({
			...transactionIdentity,
			transactionId,
			previousSnapshotDigests: receipt.previousSnapshotDigests,
		})}\n`);
		assert.equal(
			(await bootstrapBackendState(context)).stateDigest,
			restoredState.stateDigest,
		);
		assert.equal(await stat(transactionPath).then(() => true, () => false), false);
		assert.equal(await stat(join(context.repoRoot, ".codewiki", "runtime")).then(() => true, () => false), false);
	} finally {
		await context.cleanup();
	}
});

test("backup tampering, live process state, and private symlinks fail closed", async () => {
	const context = await fixture("backup-reject");
	const external = join(context.base, "external");
	try {
		await bootstrapBackendState(context);
		await mkdir(context.paths.dshSessionsRoot, {recursive: true, mode: 0o700});
		await writeFile(join(context.paths.dshSessionsRoot, "run.session"), "one\n", {
			mode: 0o600,
		});
		const backup = await createBackendStateBackup({
			...context,
			generatedAt: "2026-09-03T10:00:00.000Z",
		});
		const backedSession = join(
			context.paths.backupsRoot,
			backup.backupId.slice(7),
			"runtime-private",
			"dsh-agent-sessions",
			"run.session",
		);
		await writeFile(backedSession, "tampered\n");
		await assert.rejects(
			readBackendStateBackup({...context, backupId: backup.backupId}),
			/failed digest verification/,
		);
		await writeFile(backedSession, "one\n", {mode: 0o600});
		const undeclared = join(
			context.paths.backupsRoot,
			backup.backupId.slice(7),
			"undeclared.txt",
		);
		await writeFile(undeclared, "undeclared\n", {mode: 0o600});
		await assert.rejects(
			readBackendStateBackup({...context, backupId: backup.backupId}),
			/undeclared or missing files/,
		);
		await rm(undeclared);
		await mkdir(context.paths.processControlRoot, {recursive: true});
		await writeFile(join(context.paths.processControlRoot, "endpoint.json"), "{}\n");
		await assert.rejects(
			createBackendStateBackup(context),
			/requires the Project Server to be stopped/,
		);
		await rm(context.paths.processControlRoot, {recursive: true});
		if (process.platform !== "win32") {
			await chmod(join(context.paths.dshSessionsRoot, "run.session"), 0o644);
			await assert.rejects(
				createBackendStateBackup(context),
				/private state permissions must be owner-only/,
			);
			await chmod(join(context.paths.dshSessionsRoot, "run.session"), 0o600);
		}
		await rm(context.paths.dshSessionsRoot, {recursive: true});
		await mkdir(external);
		await symlink(external, context.paths.dshSessionsRoot);
		await assert.rejects(createBackendStateBackup(context), /cannot contain symbolic links/);
	} finally {
		await context.cleanup();
	}
});

test("corrupt state recovery requires exact backup and preserves opaque Runtime custody", async () => {
	const context = await fixture("recovery");
	try {
		await bootstrapBackendState({...context, createdAt: "2026-09-04T10:00:00.000Z"});
		const originalSession = Buffer.from([1, 2, 3, 0, 254]);
		await mkdir(context.paths.dshSessionsRoot, {recursive: true, mode: 0o700});
		await writeFile(join(context.paths.dshSessionsRoot, "run.session"), originalSession, {
			mode: 0o600,
		});
		const backup = await createBackendStateBackup({
			...context,
			generatedAt: "2026-09-04T10:05:00.000Z",
		});
		const corruptBytes = Buffer.from("not-json\n");
		await writeFile(context.paths.stateManifestPath, corruptBytes);
		await writeFile(join(context.paths.dshSessionsRoot, "run.session"), "wrong\n");
		const receipt = await recoverBackendStateManifest({
			...context,
			backupId: backup.backupId,
			expectedCorruptDigest: byteDigest(corruptBytes),
			expectedCanonicalSnapshotDigest: await canonicalProjectSnapshotDigest(context),
			recoveredAt: "2026-09-04T10:10:00.000Z",
		});
		assert.deepEqual(await readFile(join(context.paths.dshSessionsRoot, "run.session")), originalSession);
		assert.equal((await readBackendStateManifest(context))?.lastRecoveryDigest, receipt.recoveryDigest);
		assert.deepEqual(
			await readFile(
				join(context.paths.quarantineRoot, receipt.quarantineId.slice(7), "state.json"),
			),
			corruptBytes,
		);
	} finally {
		await context.cleanup();
	}
});

test("explicit Backend upgrade converts exact v1 identity and Runtime Build schema bindings", async () => {
	const context = await fixture("v1-upgrade");
	try {
		const legacyBuild = legacyBackendBuild();
		const initial = await bootstrapBackendState({
			...context,
			activeBuild: legacyBuild,
			createdAt: "2026-09-05T07:00:00.000Z",
		});
		const targetBuild = createBackendBuildBinding({
			packageVersion: "0.3.1",
			packageLockDigest: DEFAULT_BACKEND_BUILD.packageLockDigest,
			supportMatrixDigest: DEFAULT_BACKEND_BUILD.supportMatrixDigest,
			dshProfiles: DEFAULT_BACKEND_BUILD.dshProfiles,
			domainPlugins: DEFAULT_BACKEND_BUILD.domainPlugins,
			fileSchemas: DEFAULT_BACKEND_BUILD.fileSchemas,
			protocols: DEFAULT_BACKEND_BUILD.protocols,
		});
		const transition = await activateBackendBuild({
			...context,
			expectedStateDigest: initial.stateDigest,
			targetBuild,
			transitionedAt: "2026-09-05T07:01:00.000Z",
		});
		const upgraded = await readBackendStateManifest(context);
		assert.equal(transition.previousBackendBuildDigest, legacyBuild.backendBuildDigest);
		assert.equal(upgraded.activeBuild.protocol.version, "2.0.0");
		assert.equal(upgraded.activeBuild.backendBuildDigest, targetBuild.backendBuildDigest);
		assert.equal(upgraded.generation, 2);
		assert.equal(transition.requiresSessionRollover, true);
	} finally {
		await context.cleanup();
	}
});

test("upgrade backs up expected-head state and rollback restores build without erasing audit receipts", async () => {
	const context = await fixture("upgrade-rollback");
	try {
		const initial = await bootstrapBackendState({
			...context,
			createdAt: "2026-09-05T08:00:00.000Z",
		});
		const targetBuild = createBackendBuildBinding({
			packageVersion: "0.4.0",
			packageLockDigest: `sha256:${"b".repeat(64)}`,
			supportMatrixDigest: DEFAULT_BACKEND_BUILD.supportMatrixDigest,
			dshProfiles: DEFAULT_BACKEND_BUILD.dshProfiles,
			domainPlugins: DEFAULT_BACKEND_BUILD.domainPlugins,
			fileSchemas: DEFAULT_BACKEND_BUILD.fileSchemas,
			protocols: DEFAULT_BACKEND_BUILD.protocols,
		});
		const incompatibleBuild = createBackendBuildBinding({
			packageVersion: "0.4.0",
			packageLockDigest: `sha256:${"c".repeat(64)}`,
			supportMatrixDigest: DEFAULT_BACKEND_BUILD.supportMatrixDigest,
			dshProfiles: DEFAULT_BACKEND_BUILD.dshProfiles,
			domainPlugins: DEFAULT_BACKEND_BUILD.domainPlugins,
			fileSchemas: DEFAULT_BACKEND_BUILD.fileSchemas.filter(
				({id}) => id !== "codewiki.backend-state-backup",
			),
			protocols: DEFAULT_BACKEND_BUILD.protocols,
		});
		await assert.rejects(
			activateBackendBuild({
				...context,
				expectedStateDigest: initial.stateDigest,
				targetBuild: incompatibleBuild,
			}),
			/requires an explicit codewiki\.backend-state-backup@1\.0\.0 state migration/,
		);
		const upgrade = await activateBackendBuild({
			...context,
			expectedStateDigest: initial.stateDigest,
			targetBuild,
			transitionedAt: "2026-09-05T08:05:00.000Z",
		});
		assert.equal(upgrade.requiresSessionRollover, true);
		const upgradedState = await readBackendStateManifest(context);
		assert.equal(upgradedState?.activeBuild.backendBuildDigest, targetBuild.backendBuildDigest);
		assert.equal(upgradedState?.lastBuildTransitionDigest, upgrade.transitionDigest);
		await assert.rejects(
			ensureProjectCoordinatorService(context.repoRoot, {
				stateRoot: context.stateRoot,
				spawnDaemon() {
					assert.fail("Build mismatch must fail before process spawn.");
				},
			}),
			/Installed Backend Build is not the active project Backend Build/,
		);
		const laterBackup = await createBackendStateBackup({
			...context,
			generatedAt: "2026-09-05T08:07:00.000Z",
		});
		assert.deepEqual(
			await pruneBackendStateBackups({...context, retain: 1}),
			[laterBackup.backupId],
		);
		assert.equal(
			await stat(
				join(
					context.paths.backupsRoot,
					upgrade.backupId.slice(7),
					"manifest.json",
				),
			).then(() => true, () => false),
			true,
		);
		await writeFile(join(context.repoRoot, ".codewiki", "config.json"), '{"project":"after-upgrade"}\n');
		const rollback = await restoreBackendStateBackup({
			...context,
			backupId: upgrade.backupId,
			scopes: ALL_SCOPES,
			expectedStateDigest: upgradedState.stateDigest,
			expectedCanonicalSnapshotDigest: await canonicalProjectSnapshotDigest(context),
			activateBackupBuild: true,
			restoredAt: "2026-09-05T08:10:00.000Z",
		});
		assert.equal(rollback.activatedBackupBuild, true);
		const rolledBackState = await readBackendStateManifest(context);
		assert.equal(
			rolledBackState?.activeBuild.backendBuildDigest,
			DEFAULT_BACKEND_BUILD.backendBuildDigest,
		);
		assert.equal(rolledBackState?.generation, 3);
		assert.equal(
			await stat(
				join(context.paths.buildTransitionsRoot, `${upgrade.transitionDigest.slice(7)}.json`),
			).then(() => true, () => false),
			true,
		);
	} finally {
		await context.cleanup();
	}
});

test("backup retention removes only oldest verified backups", async () => {
	const context = await fixture("retention");
	try {
		await bootstrapBackendState(context);
		const backups = [];
		for (let index = 1; index <= 3; index += 1) {
			backups.push(await createBackendStateBackup({
				...context,
				generatedAt: `2026-09-05T10:0${index}:00.000Z`,
			}));
		}
		assert.deepEqual(
			await pruneBackendStateBackups({...context, retain: 2}),
			[backups[0].backupId],
		);
		assert.deepEqual(
			(await readdir(context.paths.backupsRoot)).sort(),
			backups.slice(1).map(({backupId}) => backupId.slice(7)).sort(),
		);
	} finally {
		await context.cleanup();
	}
});
