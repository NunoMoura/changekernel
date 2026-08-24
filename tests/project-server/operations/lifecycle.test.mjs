import assert from "node:assert/strict";
import {mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";

import {startProjectCoordinatorService} from "../../../src/project-server/coordinator/service.ts";
import {
	bootstrapStandaloneProjectServer,
	readStandaloneProjectServerStatus,
	stopStandaloneProjectServer,
	uninstallStandaloneBackendState,
} from "../../../src/project-server/operations/lifecycle.ts";
import {canonicalProjectSnapshotDigest} from "../../../src/project-server/operations/state.ts";
import {projectServerStatePaths} from "../../../src/project/private-state.ts";
import {createRuntimeBuildRegistrySnapshot} from "../../../src/runtime/contracts.ts";

async function project(base, name) {
	const repoRoot = join(base, name);
	await mkdir(join(repoRoot, ".codewiki", "kb"), {recursive: true});
	await mkdir(join(repoRoot, ".codewiki", "traces"), {recursive: true});
	await mkdir(join(repoRoot, ".codewiki", "check-packs"), {recursive: true});
	await writeFile(join(repoRoot, ".codewiki", "config.json"), `{"project":"${name}"}\n`);
	await writeFile(join(repoRoot, ".codewiki", "kb", "topic.md"), `# ${name}\n`);
	return repoRoot;
}

test("standalone lifecycle reports redacted running state and stops idempotently", async () => {
	const base = await mkdtemp(join(tmpdir(), "codewiki-b7-lifecycle-"));
	const repoRoot = await project(base, "project");
	const stateRoot = join(base, "state");
	let service;
	try {
		assert.equal(
			(await readStandaloneProjectServerStatus({repoRoot, stateRoot})).lifecycle,
			"unbootstrapped",
		);
		const state = await bootstrapStandaloneProjectServer({
			repoRoot,
			stateRoot,
			createdAt: "2026-09-06T10:00:00.000Z",
		});
		assert.equal(
			(await readStandaloneProjectServerStatus({repoRoot, stateRoot})).lifecycle,
			"stopped",
		);
		const observedRuntime = await readStandaloneProjectServerStatus({
			repoRoot,
			stateRoot,
			runtimeBuildRegistry: createRuntimeBuildRegistrySnapshot({
				generatedAt: "2026-09-06T10:00:01.000Z",
			}),
		});
		assert.equal(observedRuntime.runtimeBuildRegistryObserved, true);
		assert.equal(observedRuntime.backend.activeRuntimeBuildDigest, null);
		service = await startProjectCoordinatorService(repoRoot, {
			stateRoot,
			generationId: "generation:lifecycle",
		});
		const running = await readStandaloneProjectServerStatus({repoRoot, stateRoot});
		assert.equal(running.lifecycle, "running");
		assert.equal(running.stateDigest, state.stateDigest);
		assert.equal(running.backend.backendBuildDigest, state.activeBuild.backendBuildDigest);
		assert.deepEqual(
			running.backend.dshProfiles.map(({id}) => id),
			["codewiki.dsh.broker-host", "codewiki.dsh.managed-run"],
		);
		assert.equal("token" in running.process, false);
		const stopped = await stopStandaloneProjectServer(repoRoot, {stateRoot, timeoutMs: 2_000});
		assert.equal(stopped.lifecycle, "stopped");
		service = undefined;
		assert.equal(
			(await stopStandaloneProjectServer(repoRoot, {stateRoot})).lifecycle,
			"stopped",
		);
	} finally {
		if (service) await service.close();
		await rm(base, {recursive: true, force: true});
	}
});

test("Project Server process control refuses symbolic private-state paths", async () => {
	const base = await mkdtemp(join(tmpdir(), "codewiki-b7-process-symlink-"));
	const repoRoot = await project(base, "project");
	const stateRoot = join(base, "state");
	const external = join(base, "external");
	try {
		await bootstrapStandaloneProjectServer({repoRoot, stateRoot});
		const paths = projectServerStatePaths({repoRoot, stateRoot});
		await mkdir(paths.projectServerRoot, {recursive: true});
		await mkdir(external);
		await symlink(external, paths.processControlRoot);
		await assert.rejects(
			startProjectCoordinatorService(repoRoot, {
				stateRoot,
				generationId: "generation:symlink",
			}),
			/private state path must be a non-symbolic directory/,
		);
	} finally {
		await rm(base, {recursive: true, force: true});
	}
});

test("one external state root isolates multiple Project Servers", async () => {
	const base = await mkdtemp(join(tmpdir(), "codewiki-b7-multi-project-"));
	const stateRoot = join(base, "state");
	const firstRoot = await project(base, "first");
	const secondRoot = await project(base, "second");
	let first;
	let second;
	try {
		await bootstrapStandaloneProjectServer({repoRoot: firstRoot, stateRoot});
		await bootstrapStandaloneProjectServer({repoRoot: secondRoot, stateRoot});
		[first, second] = await Promise.all([
			startProjectCoordinatorService(firstRoot, {stateRoot, generationId: "generation:first"}),
			startProjectCoordinatorService(secondRoot, {stateRoot, generationId: "generation:second"}),
		]);
		const [firstStatus, secondStatus] = await Promise.all([
			readStandaloneProjectServerStatus({repoRoot: firstRoot, stateRoot}),
			readStandaloneProjectServerStatus({repoRoot: secondRoot, stateRoot}),
		]);
		assert.equal(firstStatus.lifecycle, "running");
		assert.equal(secondStatus.lifecycle, "running");
		assert.notEqual(firstStatus.repositoryIdentity, secondStatus.repositoryIdentity);
		await stopStandaloneProjectServer(firstRoot, {stateRoot, timeoutMs: 2_000});
		first = undefined;
		assert.equal(
			(await readStandaloneProjectServerStatus({repoRoot: secondRoot, stateRoot})).lifecycle,
			"running",
		);
		await stopStandaloneProjectServer(secondRoot, {stateRoot, timeoutMs: 2_000});
		second = undefined;
	} finally {
		if (first) await first.close();
		if (second) await second.close();
		await rm(base, {recursive: true, force: true});
	}
});

test("uninstall preserves canonical meaning and private state unless explicit purge is backed up", async () => {
	const base = await mkdtemp(join(tmpdir(), "codewiki-b7-uninstall-"));
	const repoRoot = await project(base, "project");
	const stateRoot = join(base, "state");
	try {
		const state = await bootstrapStandaloneProjectServer({repoRoot, stateRoot});
		const expectedCanonicalSnapshotDigest = await canonicalProjectSnapshotDigest({repoRoot, stateRoot});
		const retained = await uninstallStandaloneBackendState({
			repoRoot,
			stateRoot,
			expectedStateDigest: state.stateDigest,
			expectedCanonicalSnapshotDigest,
			uninstalledAt: "2026-09-07T10:00:00.000Z",
		});
		assert.equal(retained.privateStateRemoved, false);
		assert.equal(
			(await readStandaloneProjectServerStatus({repoRoot, stateRoot})).lifecycle,
			"stopped",
		);
		const purged = await uninstallStandaloneBackendState({
			repoRoot,
			stateRoot,
			expectedStateDigest: state.stateDigest,
			expectedCanonicalSnapshotDigest,
			removePrivateState: true,
			uninstalledAt: "2026-09-07T10:05:00.000Z",
		});
		assert.equal(purged.privateStateRemoved, true);
		assert.equal(
			(await readStandaloneProjectServerStatus({repoRoot, stateRoot})).lifecycle,
			"unbootstrapped",
		);
		assert.match(await readFile(join(repoRoot, ".codewiki", "config.json"), "utf8"), /project/);
		assert.equal(
			await stat(join(repoRoot, ".codewiki", "kb", "topic.md")).then(() => true, () => false),
			true,
		);
		assert.equal(
			await stat(
				join(
					stateRoot,
					"backups",
					purged.backup.repositoryIdentity.slice(7),
					purged.backup.backupId.slice(7),
					"manifest.json",
				),
			).then(() => true, () => false),
			true,
		);
	} finally {
		await rm(base, {recursive: true, force: true});
	}
});
