import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtemp, mkdir, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";

import {
	acquireProjectCoordinatorOwnership,
	releaseProjectCoordinatorOwnership,
} from "../../../src/project-server/coordinator/endpoint.ts";
import {assertKbToWikiMigrationReadiness} from "../../../src/project-server/operations/kb-to-wiki-readiness.ts";
import {bootstrapBackendState} from "../../../src/project-server/operations/state.ts";
import {createGitStoreProfile} from "../../../src/project/git-store-profile.ts";

async function fixture(options = {}) {
	const base = await mkdtemp(join(tmpdir(), "codewiki-sk2-readiness-"));
	const repoRoot = join(base, "project");
	const stateRoot = join(base, "state");
	await mkdir(join(repoRoot, ".codewiki", "kb"), {recursive: true});
	await mkdir(join(repoRoot, ".codewiki", "traces"), {recursive: true});
	await writeFile(join(repoRoot, ".codewiki", "config.json"), '{"project":"fixture"}\n');
	await writeFile(join(repoRoot, ".codewiki", "kb", "topic.md"), "# Topic\n");
	await writeFile(
		join(repoRoot, ".codewiki", "traces", "TRACE-CHG-fixture.jsonl"),
		"{}\n",
	);
	git(repoRoot, ["init", "-q", "-b", "main"]);
	git(repoRoot, ["add", ".codewiki"]);
	git(repoRoot, [
		"-c",
		"user.name=CodeWiki Test",
		"-c",
		"user.email=test@invalid",
		"commit",
		"-qm",
		"source",
	]);
	const objectFormat = git(repoRoot, ["rev-parse", "--show-object-format"]);
	const sourceCommit = oid(repoRoot, objectFormat);
	const profile = createGitStoreProfile({
		repositoryId: "cw:repository:sk2-readiness",
		objectFormat,
		canonicalRef: "refs/heads/main",
	});
	const state = options.bootstrapState === false
		? undefined
		: await bootstrapBackendState({
			repoRoot,
			stateRoot,
			createdAt: "2026-08-28T10:00:00.000Z",
		});
	return {
		base,
		repoRoot,
		stateRoot,
		profile,
		sourceCommit,
		state,
		backupRef: "refs/codewiki/backups/migrations/sk2-readiness-source",
		async cleanup() {
			await rm(base, {recursive: true, force: true});
		},
	};
}

function git(repoRoot, args) {
	return execFileSync("git", args, {cwd: repoRoot, encoding: "utf8"}).trim();
}

function oid(repoRoot, algorithm) {
	return {algorithm, hex: git(repoRoot, ["rev-parse", "HEAD"])};
}

async function readiness(context, overrides = {}) {
	return assertKbToWikiMigrationReadiness({
		repoRoot: context.repoRoot,
		stateRoot: context.stateRoot,
		profile: context.profile,
		expectedCanonical: context.sourceCommit,
		backupRef: context.backupRef,
		...overrides,
	});
}

test("SK2 readiness binds one clean stopped legacy Git source without writing target state", async () => {
	const context = await fixture();
	try {
		const result = await readiness(context);
		assert.deepEqual(result.profile, context.profile);
		assert.deepEqual(result.sourceCommit, context.sourceCommit);
		assert.equal(result.backupRef, context.backupRef);
		assert.equal(result.stateGeneration, context.state.generation);
		assert.equal(result.stateDigest, context.state.stateDigest);
		assert.equal(result.backendBuildDigest, context.state.activeBuild.backendBuildDigest);
		assert.equal(result.legacyTraceRootPresent, true);
		assert.equal(git(context.repoRoot, ["for-each-ref", "refs/codewiki"]), "");
	} finally {
		await context.cleanup();
	}
});

test("SK2 readiness fails closed on unbootstrapped, dirty, dual-root, and preexisting-ref state", async (t) => {
	await t.test("Project Server state is unbootstrapped", async () => {
		const context = await fixture({bootstrapState: false});
		try {
			await assert.rejects(readiness(context), /observed unbootstrapped/);
		} finally {
			await context.cleanup();
		}
	});

	await t.test("Project Server ownership remains held", async () => {
		const context = await fixture();
		try {
			const ownership = await acquireProjectCoordinatorOwnership({
				repoRoot: context.repoRoot,
				stateRoot: context.stateRoot,
				generationId: "generation:sk2-readiness",
				startedAt: "2026-08-28T10:01:00.000Z",
			});
			await assert.rejects(readiness(context), /requires released Project Server ownership/);
			await releaseProjectCoordinatorOwnership(ownership, context.stateRoot);
		} finally {
			await context.cleanup();
		}
	});

	await t.test("canonical CodeWiki paths are dirty", async () => {
		const context = await fixture();
		try {
			await writeFile(join(context.repoRoot, ".codewiki", "kb", "topic.md"), "# Changed\n");
			await assert.rejects(readiness(context), /must be clean/);
		} finally {
			await context.cleanup();
		}
	});

	await t.test("legacy and target semantic roots coexist", async () => {
		const context = await fixture();
		try {
			await mkdir(join(context.repoRoot, ".codewiki", "wiki", "items"), {recursive: true});
			await writeFile(join(context.repoRoot, ".codewiki", "wiki", "items", "item.md"), "target\n");
			git(context.repoRoot, ["add", ".codewiki/wiki"]);
			git(context.repoRoot, [
				"-c",
				"user.name=CodeWiki Test",
				"-c",
				"user.email=test@invalid",
				"commit",
				"-qm",
				"dual root",
			]);
			await assert.rejects(
				readiness(context, {
					expectedCanonical: oid(context.repoRoot, context.profile.objectFormat),
				}),
				/cannot coexist/,
			);
		} finally {
			await context.cleanup();
		}
	});

	await t.test("target Change root is already active", async () => {
		const context = await fixture();
		try {
			await mkdir(join(context.repoRoot, ".codewiki", "changes"), {recursive: true});
			await writeFile(
				join(context.repoRoot, ".codewiki", "changes", "TRACE-CHG-target.jsonl"),
				"{}\n",
			);
			git(context.repoRoot, ["add", ".codewiki/changes"]);
			git(context.repoRoot, [
				"-c",
				"user.name=CodeWiki Test",
				"-c",
				"user.email=test@invalid",
				"commit",
				"-qm",
				"target Change root",
			]);
			await assert.rejects(
				readiness(context, {
					expectedCanonical: oid(context.repoRoot, context.profile.objectFormat),
				}),
				/target Change root/,
			);
		} finally {
			await context.cleanup();
		}
	});

	await t.test("canonical Runtime residue exists", async () => {
		const context = await fixture();
		try {
			await mkdir(join(context.repoRoot, ".codewiki", "runtime"), {recursive: true});
			await writeFile(join(context.repoRoot, ".codewiki", "runtime", "state.json"), "{}\n");
			git(context.repoRoot, ["add", ".codewiki/runtime"]);
			git(context.repoRoot, [
				"-c",
				"user.name=CodeWiki Test",
				"-c",
				"user.email=test@invalid",
				"commit",
				"-qm",
				"runtime residue",
			]);
			await assert.rejects(
				readiness(context, {
					expectedCanonical: oid(context.repoRoot, context.profile.objectFormat),
				}),
				/prohibited Runtime or View residue/,
			);
		} finally {
			await context.cleanup();
		}
	});

	await t.test("migration backup ref already exists", async () => {
		const context = await fixture();
		try {
			git(context.repoRoot, ["update-ref", context.backupRef, context.sourceCommit.hex]);
			await assert.rejects(readiness(context), /backup ref already exists/);
		} finally {
			await context.cleanup();
		}
	});

	await t.test("target managed Change ref already exists", async () => {
		const context = await fixture();
		try {
			git(context.repoRoot, [
				"update-ref",
				"refs/codewiki/changes/CHG-active",
				context.sourceCommit.hex,
			]);
			await assert.rejects(readiness(context), /managed Change refs must be absent/);
		} finally {
			await context.cleanup();
		}
	});
});
