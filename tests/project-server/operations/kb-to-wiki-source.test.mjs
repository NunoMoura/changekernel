import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtemp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";

import {
	createChangeRecordTraceEvent,
	createChangeTraceHead,
} from "../../../src/changes/trace/change-record.ts";
import {
	createChangeTraceHeader,
	serializeChangeTrace,
} from "../../../src/changes/trace/semantic-kernel.ts";
import {createGitCommandRunner} from "../../../src/changes/trace/git-command.ts";
import {buildTraceArchiveCompactPlan} from "../../../src/changes/trace/retention.ts";
import {
	acceptChangeRecord,
	createChangeRecord,
} from "../../../src/changes/records.ts";
import {loadKnowledgeCheckpoint} from "../../../src/knowledge/checkpoint-store.ts";
import {buildKbToWikiLegacySourceSnapshot} from "../../../src/project-server/operations/kb-to-wiki-source.ts";
import {bindKbToWikiMigrationStagingEvidence} from "../../../src/project-server/operations/kb-to-wiki-staging-evidence.ts";
import {stageKbToWikiMigration} from "../../../src/project-server/operations/kb-to-wiki-stage.ts";
import {
	activateStagedKbToWikiMigration,
	inspectKbToWikiMigrationRestart,
	recoverStagedKbToWikiMigration,
	rollbackStagedKbToWikiMigration,
} from "../../../src/project-server/operations/kb-to-wiki-activate.ts";
import {activateKbToWikiMigrationRefsCas} from "../../../src/knowledge/kb-to-wiki-git.ts";
import {DEFAULT_SEMANTIC_KERNEL_BACKEND_BUILD} from "../../../src/project-server/operations/build.ts";
import {
	bootstrapBackendState,
	createBackendStateBackup,
	readBackendStateManifest,
} from "../../../src/project-server/operations/state.ts";
import {createGitStoreProfile} from "../../../src/project/git-store-profile.ts";
import {projectServerStatePaths} from "../../../src/project/private-state.ts";
import {acceptedChangeFixture} from "../../helpers/accepted-change.mjs";

const KNOWLEDGE_BYTES = `---
codewiki_id: cw:component:source-topic
title: Source topic
---
# Source topic

Canonical legacy meaning.
`;

async function fixture(options = {}) {
	const base = await mkdtemp(join(tmpdir(), "codewiki-sk2-source-"));
	const repoRoot = join(base, "project");
	const stateRoot = join(base, "state");
	await mkdir(join(repoRoot, ".codewiki", "kb"), {recursive: true});
	await writeFile(join(repoRoot, ".codewiki", "config.json"), '{"project":"fixture"}\n');
	await writeFile(join(repoRoot, ".codewiki", "kb", "topic.md"), KNOWLEDGE_BYTES);
	git(repoRoot, [
		"init",
		"-q",
		"-b",
		"main",
		...(options.objectFormat ? [`--object-format=${options.objectFormat}`] : []),
	]);
	if (options.traceRecords) {
		await mkdir(join(repoRoot, ".codewiki", "traces"), {recursive: true});
		await writeFile(
			join(repoRoot, ".codewiki", "traces", `${options.traceId}.jsonl`),
			traceBytes(options.traceRecords),
		);
	}
	commit(repoRoot, "legacy source");
	const archiveCommit = git(repoRoot, ["rev-parse", "HEAD"]);
	if (options.compactTrace) {
		const restoreRef = `refs/codewiki/archive/${options.traceId}`;
		git(repoRoot, ["update-ref", restoreRef, archiveCommit]);
		const compact = buildTraceArchiveCompactPlan({
			records: options.traceRecords,
			gitRestoreRef: restoreRef,
			headRef: `trace:${options.traceId}`,
			reason: "Legacy Trace retained for migration.",
			createdAt: "2026-08-28T11:00:04.000Z",
			allowIncomplete: true,
		});
		await writeFile(
			join(repoRoot, ".codewiki", "traces", `${options.traceId}.jsonl`),
			traceBytes(compact.compactRecords),
		);
		commit(repoRoot, "compact legacy trace");
	}
	const objectFormat = git(repoRoot, ["rev-parse", "--show-object-format"]);
	const sourceCommit = oid(repoRoot, objectFormat);
	const profile = createGitStoreProfile({
		repositoryId: "cw:repository:sk2-source",
		objectFormat,
		canonicalRef: "refs/heads/main",
	});
	const state = await bootstrapBackendState({
		repoRoot,
		stateRoot,
		createdAt: "2026-08-28T11:01:00.000Z",
	});
	return {
		base,
		repoRoot,
		stateRoot,
		profile,
		sourceCommit,
		state,
		archiveCommit,
		backupRef: "refs/codewiki/backups/migrations/sk2-source",
		async cleanup() {
			await rm(base, {recursive: true, force: true});
		},
	};
}

async function activeTraceRecords(changeId = "CHG-source") {
	const pending = createChangeRecord(
		acceptedChangeFixture({
			id: changeId,
			question: "Should legacy source migrate exactly?",
			problem: "Legacy source requires exact migration.",
			objective: "Preserve active Change semantics.",
			rationale: "Stopped migration must hydrate complete history.",
			sourceRefs: ["kb:topic.md"],
			createdAt: "2026-08-28T11:00:00.000Z",
		}),
	);
	const accepted = acceptChangeRecord(pending, {
		changedBy: "user:test",
		changedAt: "2026-08-28T11:00:01.000Z",
		authority: "maintainer",
		ref: "approval:user:test",
	});
	const head = createChangeTraceHead(accepted, "2026-08-28T11:00:00.000Z");
	const event = createChangeRecordTraceEvent({
		records: [head],
		record: accepted,
		operation: "accept",
		actor: "user:test",
		createdAt: "2026-08-28T11:00:01.000Z",
		message: "Accepted exact legacy source Change.",
	});
	return [head, event];
}

function input(context, overrides = {}) {
	return {
		repoRoot: context.repoRoot,
		stateRoot: context.stateRoot,
		profile: context.profile,
		expectedCanonical: context.sourceCommit,
		backupRef: context.backupRef,
		...overrides,
	};
}

const migrationGitIdentity = "CodeWiki Migration <migration@codewiki.invalid> 1787896801 +0000";

function migrationActivePlan() {
	return {
		changeId: "CHG-source",
		expectedManagedRef: "refs/codewiki/changes/CHG-source",
		proposalOperation: {
			operationId: "op:sk2:active-proposal",
			actorId: "user:test",
			authorityId: "maintainer",
			occurredAt: "2026-08-28T11:03:00.000Z",
			payload: {
				intent: "Preserve active legacy Change through migration.",
				rationale: "Active accepted intent remains explicit under target contracts.",
				desiredOutcomes: ["Legacy objective remains governed."],
				authorityIntent: ["project.change.accept"],
				relatedChangeIds: [],
				compensatesChangeIds: [],
				supersedesChangeIds: [],
				targetRefs: [],
				completionRequirements: [],
				completionRationale: "Migration preserves intent for target Decision.",
			},
		},
		proposedWiki: [],
		commit: {
			author: migrationGitIdentity,
			committer: migrationGitIdentity,
			message: "stage active migration proposal\n",
		},
	};
}

function migrationStageInput(context, backupId, runner) {
	const convertedHeader = createChangeTraceHeader({
		changeId: "CHG-source",
		projectId: "fixture",
		repositoryId: context.profile.repositoryId,
		objectFormat: context.profile.objectFormat,
		createdAt: "2026-08-28T11:00:00.000Z",
		createdBy: "user:test",
	});
	const stageInput = {
		...input(context),
		backupId,
		migrationChangeId: "CHG-source",
		migrationId: "migration:sk2-source",
		projectId: "fixture",
		convertedTraces: [{
			sourceTracePath: ".codewiki/traces/TRACE-CHG-source.jsonl",
			targetBytes: serializeChangeTrace(convertedHeader, []),
		}],
		activeChangePlans: [migrationActivePlan()],
		migrationCommit: {
			author: migrationGitIdentity,
			committer: migrationGitIdentity,
			message: "stage KB to Wiki migration\n",
		},
		targetBackendBuild: DEFAULT_SEMANTIC_KERNEL_BACKEND_BUILD,
	};
	if (!runner) return stageInput;
	return Object.assign(stageInput, {runner});
}

function git(repoRoot, args) {
	return execFileSync("git", args, {cwd: repoRoot, encoding: "utf8"}).trim();
}

function commit(repoRoot, message) {
	git(repoRoot, ["add", ".codewiki"]);
	git(repoRoot, [
		"-c",
		"user.name=CodeWiki Test",
		"-c",
		"user.email=test@invalid",
		"commit",
		"-qm",
		message,
	]);
}

function oid(repoRoot, algorithm) {
	return {algorithm, hex: git(repoRoot, ["rev-parse", "HEAD"])};
}

function traceBytes(records) {
	return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

test("SK2 source snapshot compiles exact canonical KB bytes without writes", async (t) => {
	for (const objectFormat of ["sha1", "sha256"]) {
		await t.test(objectFormat, async () => {
			const context = await fixture({objectFormat});
			try {
				const expectedCheckpoint = await loadKnowledgeCheckpoint({repoRoot: context.repoRoot});
				const snapshot = await buildKbToWikiLegacySourceSnapshot(input(context));
				assert.equal(snapshot.readiness.sourceCommit.algorithm, context.sourceCommit.algorithm);
				assert.equal(snapshot.readiness.sourceCommit.hex, context.sourceCommit.hex);
				assert.equal(snapshot.knowledgeCheckpoint.checkpointDigest, expectedCheckpoint.checkpointDigest);
				assert.equal(snapshot.knowledgeCheckpoint.state.stateDigest, expectedCheckpoint.state.stateDigest);
				assert.equal(
					snapshot.knowledgeCheckpoint.projection.projectionDigest,
					expectedCheckpoint.projection.projectionDigest,
				);
				assert.deepEqual(snapshot.knowledgeFiles.map(({path}) => path), ["topic.md"]);
				assert.equal(snapshot.knowledgeFiles[0].blobOid.algorithm, objectFormat);
				assert.deepEqual(snapshot.traces, []);
				assert.deepEqual(snapshot.activeChangeIds, []);
				assert.equal(snapshot.workState.sources.recordCount, 0);
				assert.match(snapshot.quiescenceReceiptDigest, /^sha256:[0-9a-f]{64}$/u);
				assert.match(snapshot.snapshotDigest, /^sha256:[0-9a-f]{64}$/u);
				assert.equal(git(context.repoRoot, ["for-each-ref", "refs/codewiki"]), "");
			} finally {
				await context.cleanup();
			}
		});
	}
});

test("SK2 source snapshot reduces active Changes from complete canonical Trace records", async () => {
	const records = await activeTraceRecords();
	const context = await fixture({traceId: "TRACE-CHG-source", traceRecords: records});
	try {
		const snapshot = await buildKbToWikiLegacySourceSnapshot(input(context));
		assert.equal(snapshot.traces.length, 1);
		assert.equal(snapshot.traces[0].canonicalBytes, traceBytes(records));
		assert.equal(snapshot.traces[0].records.length, records.length);
		assert.deepEqual(
			snapshot.traces[0].records.map((record) =>
				record.type === "trace_head" ? record.traceId : record.id
			),
			records.map((record) => (record.type === "trace_head" ? record.traceId : record.id)),
		);
		assert.equal(snapshot.traces[0].restoreRef, null);
		assert.deepEqual(snapshot.activeChangeIds, ["CHG-source"]);
		assert.deepEqual(snapshot.workState.changeIds, ["CHG-source"]);
		assert.equal(snapshot.workState.sources.recordCount, records.length);
	} finally {
		await context.cleanup();
	}
});

test("SK2 source snapshot hydrates compact retention stubs from exact Git restore refs", async () => {
	const records = await activeTraceRecords();
	const context = await fixture({
		traceId: "TRACE-CHG-source",
		traceRecords: records,
		compactTrace: true,
	});
	try {
		const snapshot = await buildKbToWikiLegacySourceSnapshot(input(context));
		const trace = snapshot.traces[0];
		assert.equal(trace.restoreRef, "refs/codewiki/archive/TRACE-CHG-source");
		assert.equal(trace.restoreCommit.hex, context.archiveCommit);
		assert.equal(trace.restoredBytes, traceBytes(records));
		assert.equal(trace.records.length, records.length + 1);
		assert.equal(trace.records.at(-1).type, "trace_close");
		assert.deepEqual(snapshot.activeChangeIds, ["CHG-source"]);
		assert.equal(
			git(context.repoRoot, ["rev-parse", "refs/codewiki/archive/TRACE-CHG-source"]),
			context.archiveCommit,
		);
	} finally {
		await context.cleanup();
	}
});

test("SK2 staging evidence binds accepted authority and an exact private backup", async () => {
	const records = await activeTraceRecords();
	const context = await fixture({traceId: "TRACE-CHG-source", traceRecords: records});
	try {
		const paths = projectServerStatePaths(context);
		await mkdir(paths.dshSessionsRoot, {recursive: true, mode: 0o700});
		await writeFile(join(paths.dshSessionsRoot, "migration.session"), "private-secret\n", {
			mode: 0o600,
		});
		const backup = await createBackendStateBackup({
			repoRoot: context.repoRoot,
			stateRoot: context.stateRoot,
			generatedAt: "2026-08-28T11:02:00.000Z",
		});
		const refsBefore = git(context.repoRoot, ["for-each-ref", "refs/codewiki"]);
		const objectsBefore = git(context.repoRoot, ["count-objects", "-v"]);
		const evidence = await bindKbToWikiMigrationStagingEvidence({
			...input(context),
			migrationChangeId: "CHG-source",
			backupId: backup.backupId,
		});
		assert.equal(evidence.sourceSnapshot.snapshotDigest, evidence.authority.sourceSnapshotDigest);
		assert.equal(evidence.authority.migrationChangeId, "CHG-source");
		assert.equal(evidence.authority.actorId, "user:test");
		assert.equal(evidence.authority.authorityId, "maintainer");
		assert.equal(evidence.authority.approvalRef, "approval:user:test");
		assert.equal(evidence.privateBackup.backupId, backup.backupId);
		assert.equal(evidence.privateBackup.sourceStateDigest, context.state.stateDigest);
		assert.deepEqual({...evidence.privateBackup.snapshotDigests}, backup.snapshotDigests);
		assert.equal(evidence.privateBackup.entryCount, backup.entries.length);
		assert.equal(JSON.stringify(evidence.privateBackup).includes("private-secret"), false);
		assert.equal(Object.hasOwn(evidence.privateBackup, "entries"), false);
		assert.match(evidence.authority.authorityDigest, /^sha256:[0-9a-f]{64}$/u);
		assert.match(evidence.evidenceDigest, /^sha256:[0-9a-f]{64}$/u);
		assert.equal(git(context.repoRoot, ["for-each-ref", "refs/codewiki"]), refsBefore);
		assert.equal(git(context.repoRoot, ["count-objects", "-v"]), objectsBefore);
	} finally {
		await context.cleanup();
	}
});

test("SK2 stages and validates migration objects without advancing authoritative refs", async (t) => {
	for (const objectFormat of ["sha1", "sha256"]) {
		await t.test(objectFormat, async () => {
			const records = await activeTraceRecords();
			const context = await fixture({
				objectFormat,
				traceId: "TRACE-CHG-source",
				traceRecords: records,
			});
			try {
				const backup = await createBackendStateBackup({
					repoRoot: context.repoRoot,
					stateRoot: context.stateRoot,
					generatedAt: "2026-08-28T11:02:00.000Z",
				});
				const refsBefore = git(context.repoRoot, ["for-each-ref", "refs/codewiki/changes"]);
				const staged = await stageKbToWikiMigration(
					migrationStageInput(context, backup.backupId),
				);
				assert.equal(staged.migrationCommit.algorithm, objectFormat);
				assert.equal(staged.validation.candidateCommit.hex, staged.migrationCommit.hex);
				assert.deepEqual(staged.plan.items.map(({item}) => item.itemId), ["cw:component:source-topic"]);
				assert.deepEqual(staged.receipt.activeChangePlans.map(({changeId}) => changeId), ["CHG-source"]);
				assert.equal(staged.activeManagedRefs.length, 1);
				assert.equal(git(context.repoRoot, ["rev-parse", context.profile.canonicalRef]), context.sourceCommit.hex);
				assert.equal(git(context.repoRoot, ["rev-parse", context.backupRef]), context.sourceCommit.hex);
				assert.equal(git(context.repoRoot, ["for-each-ref", "refs/codewiki/changes"]), refsBefore);
				assert.equal(git(context.repoRoot, ["cat-file", "-t", staged.migrationCommit.hex]), "commit");
				assert.equal(
					git(context.repoRoot, ["cat-file", "-t", staged.activeManagedRefs[0].proposalCommit.hex]),
					"commit",
				);
				assert.equal(git(context.repoRoot, ["status", "--short"]), "");
				assert.match(staged.stageDigest, /^sha256:[0-9a-f]{64}$/u);
			} finally {
				await context.cleanup();
			}
		});
	}
});

test("SK2 atomically activates refs, materializes target closure, and rolls back", async (t) => {
	for (const objectFormat of ["sha1", "sha256"]) {
		await t.test(objectFormat, async () => {
			const records = await activeTraceRecords();
			const context = await fixture({
				objectFormat,
				traceId: "TRACE-CHG-source",
				traceRecords: records,
			});
			try {
				const backup = await createBackendStateBackup({
					repoRoot: context.repoRoot,
					stateRoot: context.stateRoot,
					generatedAt: "2026-08-28T11:02:00.000Z",
				});
				const staged = await stageKbToWikiMigration(
					migrationStageInput(context, backup.backupId),
				);
				const before = await inspectKbToWikiMigrationRestart({
					repoRoot: context.repoRoot,
					stateRoot: context.stateRoot,
					staged,
				});
				assert.equal(before.phase, "not_activated");
				assert.equal(before.worktreeClean, true);
				const activation = await activateStagedKbToWikiMigration({
					repoRoot: context.repoRoot,
					stateRoot: context.stateRoot,
					staged,
					activatedAt: "2026-08-28T11:04:00.000Z",
				});
				assert.equal(
					git(context.repoRoot, ["rev-parse", context.profile.canonicalRef]),
					staged.migrationCommit.hex,
				);
				assert.equal(
					git(context.repoRoot, [
						"rev-parse",
						`refs/codewiki/changes/${staged.activeManagedRefs[0].changeId}`,
					]),
					staged.activeManagedRefs[0].proposalCommit.hex,
				);
				const targetConfig = JSON.parse(
					await readFile(join(context.repoRoot, ".codewiki", "config.json"), "utf8"),
				);
				assert.deepEqual(targetConfig.protocol, {
					id: "codewiki.project-config",
					version: "2.0.0",
				});
				assert.equal(Object.hasOwn(targetConfig, "domain"), false);
				const targetState = await readBackendStateManifest(context);
				assert.equal(
					targetState.activeBuild.backendBuildDigest,
					DEFAULT_SEMANTIC_KERNEL_BACKEND_BUILD.backendBuildDigest,
				);
				assert.equal(targetState.generation, context.state.generation + 1);
				assert.equal(activation.targetStateDigest, targetState.stateDigest);
				const restart = await inspectKbToWikiMigrationRestart({
					repoRoot: context.repoRoot,
					stateRoot: context.stateRoot,
					staged,
				});
				assert.equal(restart.phase, "activated");
				if (objectFormat === "sha1") {
					const paths = projectServerStatePaths(context);
					const privateReceiptPath = join(
						paths.projectServerRoot,
						"semantic-kernel-transitions",
						`${activation.privateStateActivationDigest.slice(7)}.json`,
					);
					await writeFile(privateReceiptPath, "{}\n");
					await assert.rejects(
						inspectKbToWikiMigrationRestart({
							repoRoot: context.repoRoot,
							stateRoot: context.stateRoot,
							staged,
						}),
						/private state activation Receipt is missing or invalid/,
					);
				}
				const rollback = await rollbackStagedKbToWikiMigration({
					repoRoot: context.repoRoot,
					stateRoot: context.stateRoot,
					staged,
					targetOnlyCanonicalOperationObserved: false,
					restoredAt: "2026-08-28T11:05:00.000Z",
				});
				assert.equal(rollback.inspection.phase, "rolled_back");
				assert.equal(rollback.inspection.worktreeClean, true);
				assert.equal(
					git(context.repoRoot, ["rev-parse", context.profile.canonicalRef]),
					context.sourceCommit.hex,
				);
				assert.equal(
					git(context.repoRoot, ["for-each-ref", "refs/codewiki/changes"]),
					"",
				);
				const restoredState = await readBackendStateManifest(context);
				assert.equal(
					restoredState.activeBuild.backendBuildDigest,
					context.state.activeBuild.backendBuildDigest,
				);
			} finally {
				await context.cleanup();
			}
		});
	}
});

test("SK2 restart recovery completes an interrupted post-ref activation", async () => {
	const records = await activeTraceRecords();
	const context = await fixture({traceId: "TRACE-CHG-source", traceRecords: records});
	try {
		const backup = await createBackendStateBackup({
			repoRoot: context.repoRoot,
			stateRoot: context.stateRoot,
			generatedAt: "2026-08-28T11:02:00.000Z",
		});
		const staged = await stageKbToWikiMigration(
			migrationStageInput(context, backup.backupId),
		);
		await activateKbToWikiMigrationRefsCas({
			repoRoot: context.repoRoot,
			profile: staged.evidence.sourceSnapshot.readiness.profile,
			plan: staged.plan,
			legacySource: staged.legacySource,
			candidateCommit: staged.migrationCommit,
			receipt: staged.receipt,
			activeManagedRefs: staged.activeManagedRefs,
		});
		const interrupted = await inspectKbToWikiMigrationRestart({
			repoRoot: context.repoRoot,
			stateRoot: context.stateRoot,
			staged,
		});
		assert.equal(interrupted.phase, "refs_activated");
		assert.equal(interrupted.worktreeClean, false);
		await writeFile(
			join(context.repoRoot, ".codewiki", "config.json"),
			'{"project":"post-crash-user-edit"}\n',
		);
		await assert.rejects(
			recoverStagedKbToWikiMigration({
				repoRoot: context.repoRoot,
				stateRoot: context.stateRoot,
				staged,
			}),
			/non-endpoint bytes at \.codewiki\/config\.json/,
		);
		git(context.repoRoot, [
			"checkout",
			context.sourceCommit.hex,
			"--",
			".codewiki/config.json",
		]);
		const recovered = await recoverStagedKbToWikiMigration({
			repoRoot: context.repoRoot,
			stateRoot: context.stateRoot,
			staged,
			recoveredAt: "2026-08-28T11:04:30.000Z",
		});
		assert.equal(recovered.phase, "activated");
		assert.equal(recovered.worktreeClean, true);
		await rollbackStagedKbToWikiMigration({
			repoRoot: context.repoRoot,
			stateRoot: context.stateRoot,
			staged,
			targetOnlyCanonicalOperationObserved: false,
			restoredAt: "2026-08-28T11:05:30.000Z",
		});
	} finally {
		await context.cleanup();
	}
});

test("SK2 staging rejects incomplete conversion before creating backup or authoritative refs", async () => {
	const records = await activeTraceRecords();
	const context = await fixture({traceId: "TRACE-CHG-source", traceRecords: records});
	try {
		const backup = await createBackendStateBackup({
			repoRoot: context.repoRoot,
			stateRoot: context.stateRoot,
			generatedAt: "2026-08-28T11:02:00.000Z",
		});
		const incomplete = migrationStageInput(context, backup.backupId);
		await assert.rejects(
			stageKbToWikiMigration({
				...incomplete,
				convertedTraces: [],
				activeChangePlans: [],
			}),
			/cover every exact legacy Trace/,
		);
		assert.equal(git(context.repoRoot, ["for-each-ref", "refs/codewiki"]), "");
	} finally {
		await context.cleanup();
	}
});

test("SK2 staging removes the backup ref when final object validation is interrupted", async () => {
	const records = await activeTraceRecords();
	const context = await fixture({traceId: "TRACE-CHG-source", traceRecords: records});
	try {
		const backup = await createBackendStateBackup({
			repoRoot: context.repoRoot,
			stateRoot: context.stateRoot,
			generatedAt: "2026-08-28T11:02:00.000Z",
		});
		const baseRunner = createGitCommandRunner();
		let backupCreated = false;
		let interrupted = false;
		const runner = async (request) => {
			const backupRef = git(
				context.repoRoot,
				["for-each-ref", "--format=%(refname)", context.backupRef],
			);
			if (!interrupted && request.args.includes("cat-file") && backupRef === context.backupRef) {
				backupCreated = true;
				interrupted = true;
				return {exitCode: 1, stdout: "", stderr: "injected object validation interruption\n"};
			}
			return baseRunner(request);
		};
		await assert.rejects(
			stageKbToWikiMigration(migrationStageInput(context, backup.backupId, runner)),
			/injected object validation interruption/,
		);
		assert.equal(backupCreated, true);
		assert.equal(interrupted, true);
		assert.equal(git(context.repoRoot, ["for-each-ref", "refs/codewiki"]), "");
		assert.equal(git(context.repoRoot, ["rev-parse", context.profile.canonicalRef]), context.sourceCommit.hex);
	} finally {
		await context.cleanup();
	}
});

test("SK2 staging evidence fails closed on missing authority and stale private state", async (t) => {
	await t.test("migration authority is not an accepted active Change", async () => {
		const context = await fixture();
		try {
			const backup = await createBackendStateBackup({
				repoRoot: context.repoRoot,
				stateRoot: context.stateRoot,
				generatedAt: "2026-08-28T11:02:00.000Z",
			});
			await assert.rejects(
				bindKbToWikiMigrationStagingEvidence({
					...input(context),
					migrationChangeId: "CHG-source",
					backupId: backup.backupId,
				}),
				/accepted active legacy Change/,
			);
		} finally {
			await context.cleanup();
		}
	});

	await t.test("private state changed after backup", async () => {
		const records = await activeTraceRecords();
		const context = await fixture({traceId: "TRACE-CHG-source", traceRecords: records});
		try {
			const backup = await createBackendStateBackup({
				repoRoot: context.repoRoot,
				stateRoot: context.stateRoot,
				generatedAt: "2026-08-28T11:02:00.000Z",
			});
			const paths = projectServerStatePaths(context);
			await mkdir(paths.continuityRoot, {recursive: true, mode: 0o700});
			await writeFile(join(paths.continuityRoot, "drift.json"), "{}\n", {mode: 0o600});
			await assert.rejects(
				bindKbToWikiMigrationStagingEvidence({
					...input(context),
					migrationChangeId: "CHG-source",
					backupId: backup.backupId,
				}),
				/private backup is stale/,
			);
		} finally {
			await context.cleanup();
		}
	});
});

test("SK2 source snapshot fails closed on missing retention history and unsupported source entries", async (t) => {
	await t.test("retention restore ref is missing", async () => {
		const records = await activeTraceRecords();
		const context = await fixture({
			traceId: "TRACE-CHG-source",
			traceRecords: records,
			compactTrace: true,
		});
		try {
			git(context.repoRoot, ["update-ref", "-d", "refs/codewiki/archive/TRACE-CHG-source"]);
			await assert.rejects(
				buildKbToWikiLegacySourceSnapshot(input(context)),
				/Cannot resolve legacy Trace restore ref/,
			);
		} finally {
			await context.cleanup();
		}
	});

	await t.test("Change Trace cannot be completely reduced", async () => {
		const [head] = await activeTraceRecords();
		const context = await fixture({
			traceId: "TRACE-CHG-source",
			traceRecords: [head],
		});
		try {
			await assert.rejects(
				buildKbToWikiLegacySourceSnapshot(input(context)),
				/complete WorkState reduction/,
			);
		} finally {
			await context.cleanup();
		}
	});

	await t.test("legacy Trace root contains an undeclared nested file", async () => {
		const context = await fixture();
		try {
			await mkdir(join(context.repoRoot, ".codewiki", "traces", "nested"), {recursive: true});
			await writeFile(
				join(context.repoRoot, ".codewiki", "traces", "nested", "TRACE-CHG-source.jsonl"),
				"{}\n",
			);
			commit(context.repoRoot, "unsupported trace entry");
			await assert.rejects(
				buildKbToWikiLegacySourceSnapshot(
					input(context, {expectedCanonical: oid(context.repoRoot, context.profile.objectFormat)}),
				),
				/unsupported path/,
			);
		} finally {
			await context.cleanup();
		}
	});
});
