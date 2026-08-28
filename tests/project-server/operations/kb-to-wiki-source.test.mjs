import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtemp, mkdir, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";

import {
	createChangeRecordTraceEvent,
	createChangeTraceHead,
} from "../../../src/changes/trace/change-record.ts";
import {buildTraceArchiveCompactPlan} from "../../../src/changes/trace/retention.ts";
import {
	acceptChangeRecord,
	createChangeRecord,
} from "../../../src/changes/records.ts";
import {loadKnowledgeCheckpoint} from "../../../src/knowledge/checkpoint-store.ts";
import {buildKbToWikiLegacySourceSnapshot} from "../../../src/project-server/operations/kb-to-wiki-source.ts";
import {bindKbToWikiMigrationStagingEvidence} from "../../../src/project-server/operations/kb-to-wiki-staging-evidence.ts";
import {
	bootstrapBackendState,
	createBackendStateBackup,
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
