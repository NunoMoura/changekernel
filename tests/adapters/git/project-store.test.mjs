import assert from "node:assert/strict";
import {chmod, mkdir, mkdtemp, readFile, rename, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import test from "node:test";
import {createGitProjectStore} from "../../../src/adapters/git/project-store.ts";
import {loadMarkdownMaterialSource} from "../../../src/server/queries/material-source.ts";
import {decodeGitRef, gitOid} from "../../../src/kernel/identity/git.ts";
import {
	projectStoreBlobWriteRequestDigest,
	projectStoreCasRequestDigest,
	projectStoreCommitRequestDigest,
	projectStoreTreeWriteRequestDigest,
} from "../../../src/ports/project-store.ts";

const execFileAsync = promisify(execFile);

/**
 * The single hardened entry point for every Git command this fixture harness
 * runs, mirroring the accepted local-read-purity harness contract: an explicit
 * cwd, inherited GIT_* environment overrides scrubbed (so an adversarial
 * environment under test cannot contaminate setup or oracle commands),
 * global/system Git configuration ignored, and hooks, commit signing, and
 * automatic garbage collection disabled. Fixture repositories always pin an
 * explicit branch and object format at init time.
 */
async function fixtureGit(root, args, options = {}) {
	/** @type {Record<string, string>} */
	const env = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined && !key.startsWith("GIT_")) env[key] = value;
	}
	env.GIT_CONFIG_GLOBAL = "/dev/null";
	env.GIT_CONFIG_SYSTEM = "/dev/null";
	const {stdout} = await execFileAsync(
		"git",
		["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "-c", "gc.auto=0", ...args],
		{cwd: root, env, ...options},
	);
	return stdout;
}

async function git(root, args) {
	return (await fixtureGit(root, args)).trim();
}

function oid(algorithm, hex) {
	const result = gitOid(algorithm, hex);
	assert.equal(result.ok, true);
	return result.value;
}

/**
 * Applies an adversarial process environment for the duration of one serial
 * body and restores the previous environment deterministically, including
 * removing keys the override introduced. Nothing leaks across tests.
 */
async function withProcessEnv(overrides, body) {
	const saved = {...process.env};
	try {
		Object.assign(process.env, overrides);
		await body();
	} finally {
		for (const key of Object.keys(process.env)) {
			if (!(key in saved)) delete process.env[key];
		}
		for (const [key, value] of Object.entries(saved)) process.env[key] = value;
	}
}

async function pathExists(path) {
	try {
		await (await import("node:fs/promises")).lstat(path);
		return true;
	} catch (error) {
		if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return false;
		throw error;
	}
}

async function sortedEntries(root) {
	return [...await (await import("node:fs/promises")).readdir(root)].sort();
}

/** Initializes a disposable repository with explicit branch and object format. */
async function initRepository(root, objectFormat = "sha1") {
	await mkdir(root, {recursive: true});
	await git(root, ["init", "-q", "-b", "main", `--object-format=${objectFormat}`]);
	await git(root, ["config", "user.name", "Fixture"]);
	await git(root, ["config", "user.email", "fixture@example.invalid"]);
}

async function commitFile(root, path, content, message) {
	await writeFile(join(root, path), content);
	await git(root, ["add", path]);
	await git(root, ["commit", "-q", "--no-verify", "-m", message]);
}

async function repository(objectFormat = "sha1") {
	const root = await mkdtemp(join(tmpdir(), "codewiki-project-store-"));
	await initRepository(root, objectFormat);
	await commitFile(root, "README.md", "fixture\n", "initial");
	const made = createGitProjectStore({repositoryRoot: root, repositoryId: "cw:repository:test"});
	assert.equal(made.ok, true, made.ok ? undefined : made.error.message);
	return {root, store: made.value, objectFormat};
}

async function commitRequest(repo, overrides = {}) {
	const head = oid(repo.objectFormat, await git(repo.root, ["rev-parse", "HEAD"]));
	const tree = oid(repo.objectFormat, await git(repo.root, ["rev-parse", "HEAD^{tree}"]));
	const request = {
		repositoryId: "cw:repository:test",
		objectFormat: repo.objectFormat,
		tree,
		parents: [head],
		message: "deterministic candidate\n",
		author: {name: "ChangeKernel", email: "changekernel@example.invalid", timestamp: "2026-09-01T00:00:00Z"},
		committer: {name: "ChangeKernel", email: "changekernel@example.invalid", timestamp: "2026-09-01T00:00:00Z"},
		authorizationId: "cw:authorization:test",
		requestDigest: "sha256:" + "0".repeat(64),
		...overrides,
	};
	const requestDigest = projectStoreCommitRequestDigest(request);
	assert.equal(requestDigest.ok, true);
	return {...request, requestDigest: requestDigest.value};
}

function casRequest(overrides) {
	const request = {requestDigest: "sha256:" + "0".repeat(64), ...overrides};
	const requestDigest = projectStoreCasRequestDigest(request);
	assert.equal(requestDigest.ok, true);
	return {...request, requestDigest: requestDigest.value};
}

test("Git Project Store reads complete snapshots and bounded blobs", async (t) => {
	const repo = await repository();
	t.after(() => rm(repo.root, {recursive: true, force: true}));
	const main = decodeGitRef("refs/heads/main").value;
	const snapshot = await repo.store.readSnapshot({repositoryId: "cw:repository:test", objectFormat: "sha1", selector: {kind: "ref", ref: main}});
	assert.equal(snapshot.ok, true, snapshot.ok ? undefined : snapshot.error.message);
	assert.equal(snapshot.value.complete, true);
	const blobOid = oid("sha1", await git(repo.root, ["rev-parse", "HEAD:README.md"]));
	const blob = await repo.store.readBlob({repositoryId: "cw:repository:test", objectFormat: "sha1", commit: snapshot.value.commit, path: "README.md", maximumBytes: 100});
	assert.equal(blob.ok, true);
	assert.equal(new TextDecoder().decode(blob.value.bytes), "fixture\n");
	assert.equal(blob.value.oid.hex, blobOid.hex);
	assert.equal((await repo.store.readBlob({repositoryId: "cw:repository:test", objectFormat: "sha1", commit: snapshot.value.commit, path: "README.md", maximumBytes: 1})).error.code, "limit_exceeded");
});

test("incomplete transitive object closure is rejected without fetching", async (t) => {
	const repo = await repository();
	t.after(() => rm(repo.root, {recursive: true, force: true}));
	const head = oid("sha1", await git(repo.root, ["rev-parse", "HEAD"]));
	const blob = await git(repo.root, ["rev-parse", "HEAD:README.md"]);
	await rm(join(repo.root, ".git", "objects", blob.slice(0, 2), blob.slice(2)));
	const read = await repo.store.readSnapshot({repositoryId: "cw:repository:test", objectFormat: "sha1", selector: {kind: "oid", oid: head}});
	assert.equal(read.ok, false);
	assert.ok(["incomplete_object", "command_failed"].includes(read.error.code));
});

test("commit object creation is deterministic and crash-before-CAS leaves refs unchanged", async (t) => {
	const repo = await repository();
	t.after(() => rm(repo.root, {recursive: true, force: true}));
	const before = await git(repo.root, ["show-ref"]);
	const first = await repo.store.createCommit(await commitRequest(repo));
	const second = await repo.store.createCommit(await commitRequest(repo));
	assert.equal(first.ok, true, first.ok ? undefined : first.error.message);
	assert.equal(second.ok, true);
	assert.deepEqual(second.value, first.value);
	assert.equal(await git(repo.root, ["show-ref"]), before);
});

test("managed ref CAS is atomic, stale-safe, and hook-isolated", async (t) => {
	const repo = await repository();
	t.after(() => rm(repo.root, {recursive: true, force: true}));
	const hooks = join(repo.root, "hooks");
	await mkdir(hooks);
	const marker = join(repo.root, "hook-ran");
	const hook = join(hooks, "reference-transaction");
	await writeFile(hook, `#!/bin/sh\ntouch '${marker}'\n`);
	await chmod(hook, 0o755);
	await git(repo.root, ["config", "core.hooksPath", hooks]);
	const candidate = await repo.store.createCommit(await commitRequest(repo));
	assert.equal(candidate.ok, true);
	const ref = decodeGitRef("refs/codewiki/changes/CHG-test").value;
	const request = casRequest({repositoryId: "cw:repository:test", objectFormat: "sha1", updates: [{ref, expectedOld: null, newOid: candidate.value}], authorizationId: "cw:authorization:test", reflogMessage: "codewiki test CAS"});
	const first = await repo.store.compareAndSwapRefs(request);
	assert.equal(first.ok, true, first.ok ? undefined : first.error.message);
	assert.equal(first.value.repositoryId, "cw:repository:test");
	assert.equal(first.value.authorizationId, request.authorizationId);
	assert.equal(first.value.objectFormat, "sha1");
	assert.equal(await git(repo.root, ["rev-parse", ref]), candidate.value.hex);
	const tampered = await repo.store.compareAndSwapRefs({...request, reflogMessage: "tampered"});
	assert.equal(tampered.error.code, "authorization_binding_invalid");
	assert.equal(await readFile(marker, "utf8").then(() => true, () => false), false);
	const stale = await repo.store.compareAndSwapRefs(request);
	assert.equal(stale.ok, true);
	assert.equal(stale.value.status, "reconciled");
	assert.equal(await git(repo.root, ["rev-parse", ref]), candidate.value.hex);
});

test("concurrent expected-old CAS admits one writer and rejects one stale writer", async (t) => {
	const repo = await repository();
	t.after(() => rm(repo.root, {recursive: true, force: true}));
	const firstCommit = await repo.store.createCommit(await commitRequest(repo, {message: "first\n"}));
	const secondCommit = await repo.store.createCommit(await commitRequest(repo, {message: "second\n"}));
	const ref = decodeGitRef("refs/codewiki/changes/CHG-race").value;
	const base = {repositoryId: "cw:repository:test", objectFormat: "sha1", authorizationId: "cw:authorization:test", reflogMessage: "race"};
	const outcomes = await Promise.all([
		repo.store.compareAndSwapRefs(casRequest({...base, updates: [{ref, expectedOld: null, newOid: firstCommit.value}]})),
		repo.store.compareAndSwapRefs(casRequest({...base, updates: [{ref, expectedOld: null, newOid: secondCommit.value}]})),
	]);
	assert.deepEqual(outcomes.map((entry) => entry.ok).sort(), [false, true]);
	assert.equal(outcomes.find((entry) => !entry.ok).error.code, "stale_ref");
});

test("adapter rejects unsafe refs, repository mismatch, and malformed commit authorization", async (t) => {
	const repo = await repository();
	t.after(() => rm(repo.root, {recursive: true, force: true}));
	const head = oid("sha1", await git(repo.root, ["rev-parse", "HEAD"]));
	const tag = decodeGitRef("refs/tags/not-writable").value;
	const rejected = await repo.store.compareAndSwapRefs(casRequest({repositoryId: "cw:repository:test", objectFormat: "sha1", updates: [{ref: tag, expectedOld: null, newOid: head}], authorizationId: "cw:authorization:test", reflogMessage: "reject"}));
	assert.equal(rejected.error.code, "invalid_ref");
	assert.equal((await repo.store.readSnapshot({repositoryId: "cw:repository:other", objectFormat: "sha1", selector: {kind: "oid", oid: head}})).error.code, "repository_mismatch");
	assert.equal((await repo.store.createCommit(await commitRequest(repo, {message: "missing terminal newline"}))).ok, false);
	assert.equal((await repo.store.createCommit(await commitRequest(repo, {message: "invalid \ud800\n"}))).error.code, "limit_exceeded");
	assert.equal((await repo.store.createCommit(await commitRequest(repo, {authorizationId: "invalid"}))).error.code, "authorization_binding_invalid");
	const bound = await commitRequest(repo);
	assert.equal((await repo.store.createCommit({...bound, message: "tampered\n"})).error.code, "authorization_binding_invalid");
	assert.equal(createGitProjectStore({repositoryRoot: repo.root, repositoryId: "cw:repository:test", gitBinary: "/bin/sh"}).ok, false);
});

test("SHA-256 repositories are supported on this recorded Git profile without a skip", async (t) => {
	const repo = await repository("sha256");
	t.after(() => rm(repo.root, {recursive: true, force: true}));
	const oracle = await git(repo.root, ["rev-parse", "--show-object-format"]);
	assert.equal(oracle, "sha256");
	assert.equal(repo.store.objectFormat, "sha256");
	const head = oid("sha256", await git(repo.root, ["rev-parse", "HEAD"]));
	const snapshot = await repo.store.readSnapshot({repositoryId: "cw:repository:test", objectFormat: "sha256", selector: {kind: "oid", oid: head}});
	assert.equal(snapshot.ok, true, snapshot.ok ? undefined : snapshot.error.message);
	const tree = await repo.store.readTree({
		repositoryId: "cw:repository:test",
		objectFormat: "sha256",
		commit: head,
		pathPrefix: "README.md",
		maximumEntries: 1,
	});
	assert.equal(tree.ok, true, tree.ok ? undefined : tree.error.message);
	assert.equal(tree.value.entries[0].oid.algorithm, "sha256");
});

// D4-T1: the Store's object-format observation is Git's own reported format
// across both supported formats, unborn and committed repositories, a SHA-1
// repository without an extensions.objectFormat setting, and unborn bare
// roots. Unborn repositories report a typed missing canonical ref instead of
// a fabricated snapshot.
test("Store observation matches Git's reported format for sha1 and sha256, unborn and committed, including a sha1 repository without an objectFormat setting", async (t) => {
	const roots = [];
	t.after(async () => {
		for (const root of roots) await rm(root, {recursive: true, force: true});
	});
	for (const objectFormat of ["sha1", "sha256"]) {
		for (const state of ["unborn", "committed"]) {
			const root = await mkdtemp(join(tmpdir(), `codewiki-project-store-obs-${objectFormat}-${state}-`));
			roots.push(root);
			await initRepository(root, objectFormat);
			if (objectFormat === "sha1") {
				const settingPresent = await fixtureGit(root, ["config", "--get", "extensions.objectformat"])
					.then(() => true, (error) => error.code === 1 ? false : Promise.reject(error));
				assert.equal(settingPresent, false, "the sha1 fixture must not rely on an extensions.objectFormat setting");
			}
			if (state === "committed") {
				await commitFile(root, "README.md", `content-${objectFormat}-${state}\n`, "initial");
			}
			const oracle = await git(root, ["rev-parse", "--show-object-format"]);
			const made = createGitProjectStore({repositoryRoot: root, repositoryId: "cw:repository:test"});
			assert.equal(made.ok, true, made.ok ? undefined : made.error.message);
			assert.equal(made.value.objectFormat, oracle);
			assert.equal(made.value.objectFormat, objectFormat);
			assert.throws(() => {
				made.value.objectFormat = "sha1";
			}, TypeError, "the observed format must be runtime-readonly");
			const main = decodeGitRef("refs/heads/main").value;
			if (state === "committed") {
				const head = oid(objectFormat, await git(root, ["rev-parse", "HEAD"]));
				const snapshot = await made.value.readSnapshot({repositoryId: "cw:repository:test", objectFormat, selector: {kind: "ref", ref: main}});
				assert.equal(snapshot.ok, true, snapshot.ok ? undefined : snapshot.error.message);
				assert.equal(snapshot.value.commit.hex, head.hex, "exact committed reads must return the intended commit");
				const blob = await made.value.readBlob({repositoryId: "cw:repository:test", objectFormat, commit: head, path: "README.md", maximumBytes: 100});
				assert.equal(blob.ok, true, blob.ok ? undefined : blob.error.message);
				assert.equal(new TextDecoder().decode(blob.value.bytes), `content-${objectFormat}-${state}\n`);
			} else {
				const unborn = await made.value.readSnapshot({repositoryId: "cw:repository:test", objectFormat, selector: {kind: "ref", ref: main}});
				assert.equal(unborn.ok, false, "unborn repositories must not fabricate a snapshot");
				assert.equal(unborn.error.code, "not_found");
			}
		}
	}
	const bare = await mkdtemp(join(tmpdir(), "codewiki-project-store-obs-bare-"));
	roots.push(bare);
	await git(bare, ["init", "-q", "-b", "main", "--bare", "--object-format=sha256"]);
	const bareOracle = await git(bare, ["rev-parse", "--show-object-format"]);
	const bareStore = createGitProjectStore({repositoryRoot: bare, repositoryId: "cw:repository:test"});
	assert.equal(bareStore.ok, true, bareStore.ok ? undefined : bareStore.error.message);
	assert.equal(bareStore.value.objectFormat, bareOracle);
});

// D4-T2: ambient PATH, foreign repository-selection variables, object
// directory overrides, and injected configuration cannot change the selected
// repository, reported format, or actual read subject. Two distinct
// repositories with distinct commits are the oracle, not two indistinguishable
// fixtures.
test("misleading ambient PATH, foreign Git target variables, object-directory overrides, and injected configuration cannot retarget the Store", async (t) => {
	const holder = await mkdtemp(join(tmpdir(), "codewiki-project-store-env-"));
	t.after(() => rm(holder, {recursive: true, force: true}));
	const a = join(holder, "repo-a");
	const b = join(holder, "repo-b");
	const noGitPath = join(holder, "no-git-here");
	const globalConfig = join(holder, "global-gitconfig");
	await initRepository(a, "sha256");
	await commitFile(a, "README.md", "alpha-a\n", "a-commit");
	await initRepository(b, "sha1");
	await commitFile(b, "README.md", "alpha-b\n", "b-commit");
	await mkdir(noGitPath);
	await writeFile(globalConfig, "[extensions]\n\tobjectFormat = sha1\n");
	const aHead = oid("sha256", await git(a, ["rev-parse", "HEAD"]));
	const bHead = oid("sha1", await git(b, ["rev-parse", "HEAD"]));
	const aOracle = await git(a, ["rev-parse", "--show-object-format"]);
	const bRefsBefore = await git(b, ["show-ref"]);
	assert.equal(aOracle, "sha256");
	assert.notEqual(aHead.hex, bHead.hex);

	await withProcessEnv({
		PATH: noGitPath,
		GIT_DIR: join(b, ".git"),
		GIT_WORK_TREE: b,
		GIT_COMMON_DIR: join(b, ".git"),
		GIT_OBJECT_DIRECTORY: join(b, ".git", "objects"),
		GIT_CONFIG_COUNT: "1",
		GIT_CONFIG_KEY_0: "extensions.objectFormat",
		GIT_CONFIG_VALUE_0: "sha1",
		GIT_CONFIG_GLOBAL: globalConfig,
		GIT_CONFIG_SYSTEM: globalConfig,
	}, async () => {
		const made = createGitProjectStore({repositoryRoot: a, repositoryId: "cw:repository:test"});
		assert.equal(made.ok, true, made.ok ? undefined : made.error.message);
		assert.equal(made.value.objectFormat, "sha256", "the reported format must be repository A's own, not the injected sha1");
		const main = decodeGitRef("refs/heads/main").value;
		const snapshot = await made.value.readSnapshot({repositoryId: "cw:repository:test", objectFormat: "sha256", selector: {kind: "ref", ref: main}});
		assert.equal(snapshot.ok, true, snapshot.ok ? undefined : snapshot.error.message);
		assert.equal(snapshot.value.commit.hex, aHead.hex, "the actual read subject must be repository A, not the foreign GIT_DIR target");
		const blob = await made.value.readBlob({repositoryId: "cw:repository:test", objectFormat: "sha256", commit: aHead, path: "README.md", maximumBytes: 100});
		assert.equal(blob.ok, true, blob.ok ? undefined : blob.error.message);
		assert.equal(new TextDecoder().decode(blob.value.bytes), "alpha-a\n");
	});

	assert.equal(await git(b, ["show-ref"]), bRefsBefore, "the foreign repository must remain untouched");
});

// D4-T3: missing, non-Git, nested, malformed, and symbolic roots fail with
// the specified typed categories, never bind their valid parent, and leave no
// state behind.
test("invalid roots fail typed, never bind their valid parent, and write nothing", async (t) => {
	const holder = await mkdtemp(join(tmpdir(), "codewiki-project-store-roots-"));
	t.after(() => rm(holder, {recursive: true, force: true}));

	const missing = join(holder, "missing-root");
	assert.equal(createGitProjectStore({repositoryRoot: missing, repositoryId: "cw:repository:test"}).error.code, "repository_mismatch");
	assert.equal(await pathExists(missing), false, "a rejected opening must not create the missing root");

	const plain = join(holder, "plain");
	await mkdir(plain);
	const plainBefore = await sortedEntries(plain);
	const plainOutcome = createGitProjectStore({repositoryRoot: plain, repositoryId: "cw:repository:test"});
	assert.equal(plainOutcome.ok, false);
	assert.equal(plainOutcome.error.code, "command_failed", "a non-Git root is a failed observation");
	assert.deepEqual(await sortedEntries(plain), plainBefore);

	const fileRoot = join(holder, "a-file");
	await writeFile(fileRoot, "not a directory\n");
	assert.equal(createGitProjectStore({repositoryRoot: fileRoot, repositoryId: "cw:repository:test"}).error.code, "repository_mismatch");

	const outer = join(holder, "outer");
	await initRepository(outer, "sha1");
	await commitFile(outer, "README.md", "outer\n", "outer-commit");
	const outerRefsBefore = await git(outer, ["show-ref"]);

	const ordinaryNested = join(outer, "ordinary");
	await mkdir(ordinaryNested);
	const ordinaryBefore = await sortedEntries(ordinaryNested);
	const ordinary = createGitProjectStore({repositoryRoot: ordinaryNested, repositoryId: "cw:repository:test"});
	assert.equal(ordinary.ok, false, "an ordinary nested path must not bind its parent repository");
	assert.equal(ordinary.error.code, "repository_mismatch");
	assert.deepEqual(await sortedEntries(ordinaryNested), ordinaryBefore);
	assert.equal(await git(outer, ["show-ref"]), outerRefsBefore, "failed probes must not write or repair the parent");

	const invalidNested = join(outer, "invalid-own-git");
	await mkdir(join(invalidNested, ".git"), {recursive: true});
	const invalidBefore = await sortedEntries(invalidNested);
	const invalid = createGitProjectStore({repositoryRoot: invalidNested, repositoryId: "cw:repository:test"});
	assert.equal(invalid.ok, false, "an invalid own .git must not be ignored in favor of the ancestor");
	assert.equal(invalid.error.code, "repository_mismatch");
	assert.deepEqual(await sortedEntries(invalidNested), invalidBefore, "the malformed own .git entry must be left exactly as it was");
	assert.equal(await git(outer, ["show-ref"]), outerRefsBefore);

	const garbageGitFile = join(holder, "garbage-gitfile");
	await mkdir(garbageGitFile);
	await writeFile(join(garbageGitFile, ".git"), "not a gitfile\n");
	const garbageBefore = await sortedEntries(garbageGitFile);
	const garbage = createGitProjectStore({repositoryRoot: garbageGitFile, repositoryId: "cw:repository:test"});
	assert.equal(garbage.ok, false);
	assert.equal(garbage.error.code, "command_failed", "Git rejecting a malformed gitfile is a failed observation");
	assert.deepEqual(await sortedEntries(garbageGitFile), garbageBefore);

	const badConfig = join(holder, "bad-config");
	await initRepository(badConfig, "sha1");
	await writeFile(join(badConfig, ".git", "config"), "nonsense here\n", {flag: "a"});
	const badConfigBefore = await sortedEntries(join(badConfig, ".git"));
	const badConfigOutcome = createGitProjectStore({repositoryRoot: badConfig, repositoryId: "cw:repository:test"});
	assert.equal(badConfigOutcome.ok, false);
	assert.equal(badConfigOutcome.error.code, "command_failed", "Git rejecting malformed metadata is a failed observation");
	assert.deepEqual(await sortedEntries(join(badConfig, ".git")), badConfigBefore, "a failed probe must not repair the malformed configuration");

	const linkRoot = join(holder, "root-link");
	const {symlink} = await import("node:fs/promises");
	await symlink(outer, linkRoot);
	assert.equal(createGitProjectStore({repositoryRoot: linkRoot, repositoryId: "cw:repository:test"}).error.code, "repository_mismatch");

	const gitLinkRoot = join(holder, "git-state-link");
	await mkdir(gitLinkRoot);
	await symlink(join(outer, ".git"), join(gitLinkRoot, ".git"));
	const gitLinkBefore = await sortedEntries(gitLinkRoot);
	assert.equal(createGitProjectStore({repositoryRoot: gitLinkRoot, repositoryId: "cw:repository:test"}).error.code, "repository_mismatch");
	assert.deepEqual(await sortedEntries(gitLinkRoot), gitLinkBefore);

	const adminDir = join(holder, "outer", ".git");
	assert.equal(createGitProjectStore({repositoryRoot: adminDir, repositoryId: "cw:repository:test"}).error.code, "repository_mismatch", "the administrative directory of a non-bare tree is not a working-tree root");
	assert.equal(await git(outer, ["show-ref"]), outerRefsBefore, "failed probes must leave the parent repository untouched");
});

// D4-T4: positive normal-root, separate-Git-directory, linked-worktree, and
// direct bare-store cases establish the intended binding and read the
// intended commit, including paths containing spaces.
test("Store binds separate-Git-directory worktrees, linked worktrees, and bare repositories; paths with spaces work", async (t) => {
	const holder = await mkdtemp(join(tmpdir(), "codewiki-project-store-layout-"));
	t.after(() => rm(holder, {recursive: true, force: true}));

	const seed = join(holder, "seed");
	await initRepository(seed, "sha1");
	await commitFile(seed, "README.md", "seed\n", "seed-commit");

	const sepWork = join(holder, "sep work dir");
	const sepState = join(holder, "sep-state.git");
	await git(holder, ["clone", "-q", "--separate-git-dir", sepState, seed, sepWork]);
	await git(sepWork, ["config", "user.name", "Fixture"]);
	await git(sepWork, ["config", "user.email", "fixture@example.invalid"]);
	await commitFile(sepWork, "README.md", "sep-content\n", "sep-commit");
	const sepHead = oid("sha1", await git(sepWork, ["rev-parse", "HEAD"]));
	const sepStore = createGitProjectStore({repositoryRoot: sepWork, repositoryId: "cw:repository:test"});
	assert.equal(sepStore.ok, true, sepStore.ok ? undefined : sepStore.error.message);
	assert.equal(sepStore.value.objectFormat, await git(sepWork, ["rev-parse", "--show-object-format"]));
	const main = decodeGitRef("refs/heads/main").value;
	const sepSnapshot = await sepStore.value.readSnapshot({repositoryId: "cw:repository:test", objectFormat: "sha1", selector: {kind: "ref", ref: main}});
	assert.equal(sepSnapshot.ok, true, sepSnapshot.ok ? undefined : sepSnapshot.error.message);
	assert.equal(sepSnapshot.value.commit.hex, sepHead.hex, "the separate-Git-directory worktree must read its own commit");
	const sepBlob = await sepStore.value.readBlob({repositoryId: "cw:repository:test", objectFormat: "sha1", commit: sepHead, path: "README.md", maximumBytes: 100});
	assert.equal(new TextDecoder().decode(sepBlob.value.bytes), "sep-content\n");
	const sepRef = decodeGitRef("refs/codewiki/changes/CHG-sep").value;
	const sepCandidate = await sepStore.value.createCommit(await commitRequest({root: sepWork, objectFormat: "sha1"}));
	assert.equal(sepCandidate.ok, true, sepCandidate.ok ? undefined : sepCandidate.error.message);
	assert.equal((await sepStore.value.compareAndSwapRefs(casRequest({repositoryId: "cw:repository:test", objectFormat: "sha1", updates: [{ref: sepRef, expectedOld: null, newOid: sepCandidate.value}], authorizationId: "cw:authorization:test", reflogMessage: "sep CAS"}))).ok, true);
	assert.equal(await git(holder, ["--git-dir", sepState, "rev-parse", sepRef]), sepCandidate.value.hex, "writes must land in the separate administrative directory");
	assert.equal(await fixtureGit(seed, ["show-ref", "--verify", "--quiet", sepRef]).then(() => true, (error) => error.code === 1 ? false : Promise.reject(error)), false, "the seed repository must stay a distinct repository");

	const linked = join(holder, "linked worktree");
	await git(seed, ["worktree", "add", "-q", "-b", "topic", linked]);
	await commitFile(linked, "README.md", "linked-content\n", "linked-commit");
	const linkedHead = oid("sha1", await git(linked, ["rev-parse", "refs/heads/topic"]));
	const linkedGitDir = await git(linked, ["rev-parse", "--absolute-git-dir"]);
	const seedHead = oid("sha1", await git(seed, ["rev-parse", "refs/heads/main"]));
	assert.notEqual(linkedHead.hex, seedHead.hex);
	const linkedStore = createGitProjectStore({repositoryRoot: linked, repositoryId: "cw:repository:test"});
	assert.equal(linkedStore.ok, true, linkedStore.ok ? undefined : linkedStore.error.message);
	const linkedSnapshot = await linkedStore.value.readSnapshot({repositoryId: "cw:repository:test", objectFormat: "sha1", selector: {kind: "oid", oid: linkedHead}});
	assert.equal(linkedSnapshot.ok, true, linkedSnapshot.ok ? undefined : linkedSnapshot.error.message);
	assert.equal(linkedSnapshot.value.commit.hex, linkedHead.hex, "the linked worktree must read its own commit, not the primary tree's head");
	const linkedBlob = await linkedStore.value.readBlob({repositoryId: "cw:repository:test", objectFormat: "sha1", commit: linkedHead, path: "README.md", maximumBytes: 100});
	assert.equal(new TextDecoder().decode(linkedBlob.value.bytes), "linked-content\n");
	const linkedRef = decodeGitRef("refs/codewiki/changes/CHG-linked").value;
	const linkedCandidate = await linkedStore.value.createCommit(await commitRequest({root: linked, objectFormat: "sha1"}));
	assert.equal(linkedCandidate.ok, true, linkedCandidate.ok ? undefined : linkedCandidate.error.message);
	assert.equal((await linkedStore.value.compareAndSwapRefs(casRequest({repositoryId: "cw:repository:test", objectFormat: "sha1", updates: [{ref: linkedRef, expectedOld: null, newOid: linkedCandidate.value}], authorizationId: "cw:authorization:test", reflogMessage: "linked CAS"}))).ok, true);
	assert.equal(await git(seed, ["rev-parse", linkedRef]), linkedCandidate.value.hex, "linked-worktree writes must reach the shared repository through the worktree's own administrative directory");
	assert.equal(await readFile(join(linked, ".git"), "utf8"), `gitdir: ${linkedGitDir}\n`, "the worktree's own .git file must keep its distinct Git meaning");

	const bare = join(holder, "bare store.git");
	await git(holder, ["init", "-q", "-b", "main", "--bare", "--object-format=sha256", bare]);
	const bareStore = createGitProjectStore({repositoryRoot: bare, repositoryId: "cw:repository:test"});
	assert.equal(bareStore.ok, true, bareStore.ok ? undefined : bareStore.error.message);
	assert.equal(bareStore.value.objectFormat, "sha256");
	const blobRequest = {repositoryId: "cw:repository:test", objectFormat: "sha256", bytes: new TextEncoder().encode("bare-content\n"), authorizationId: "cw:authorization:test", requestDigest: "sha256:" + "0".repeat(64)};
	const blobDigest = projectStoreBlobWriteRequestDigest(blobRequest);
	assert.equal(blobDigest.ok, true);
	const writtenBlob = await bareStore.value.writeBlob({...blobRequest, requestDigest: blobDigest.value});
	assert.equal(writtenBlob.ok, true, writtenBlob.ok ? undefined : writtenBlob.error.message);
	const treeRequest = {repositoryId: "cw:repository:test", objectFormat: "sha256", baseTree: null, mutations: [{path: "README.md", mode: "100644", kind: "blob", oid: writtenBlob.value.oid}], authorizationId: "cw:authorization:test", requestDigest: "sha256:" + "0".repeat(64)};
	const treeDigest = projectStoreTreeWriteRequestDigest(treeRequest);
	assert.equal(treeDigest.ok, true);
	const writtenTree = await bareStore.value.writeTree({...treeRequest, requestDigest: treeDigest.value});
	assert.equal(writtenTree.ok, true, writtenTree.ok ? undefined : writtenTree.error.message);
	const bareCommit = await bareStore.value.createCommit({
		repositoryId: "cw:repository:test",
		objectFormat: "sha256",
		tree: writtenTree.value.tree,
		parents: [],
		message: "bare fixture commit\n",
		author: {name: "ChangeKernel", email: "changekernel@example.invalid", timestamp: "2026-09-01T00:00:00Z"},
		committer: {name: "ChangeKernel", email: "changekernel@example.invalid", timestamp: "2026-09-01T00:00:00Z"},
		authorizationId: "cw:authorization:test",
		requestDigest: projectStoreCommitRequestDigest({
			repositoryId: "cw:repository:test",
			objectFormat: "sha256",
			tree: writtenTree.value.tree,
			parents: [],
			message: "bare fixture commit\n",
			author: {name: "ChangeKernel", email: "changekernel@example.invalid", timestamp: "2026-09-01T00:00:00Z"},
			committer: {name: "ChangeKernel", email: "changekernel@example.invalid", timestamp: "2026-09-01T00:00:00Z"},
			authorizationId: "cw:authorization:test",
			requestDigest: "sha256:" + "0".repeat(64),
		}).value,
	});
	assert.equal(bareCommit.ok, true, bareCommit.ok ? undefined : bareCommit.error.message);
	const bareRef = decodeGitRef("refs/codewiki/changes/CHG-bare").value;
	assert.equal((await bareStore.value.compareAndSwapRefs(casRequest({repositoryId: "cw:repository:test", objectFormat: "sha256", updates: [{ref: bareRef, expectedOld: null, newOid: bareCommit.value}], authorizationId: "cw:authorization:test", reflogMessage: "bare CAS"}))).ok, true);
	const bareSnapshot = await bareStore.value.readSnapshot({repositoryId: "cw:repository:test", objectFormat: "sha256", selector: {kind: "ref", ref: bareRef}});
	assert.equal(bareSnapshot.ok, true, bareSnapshot.ok ? undefined : bareSnapshot.error.message);
	assert.equal(bareSnapshot.value.commit.hex, bareCommit.value.hex, "the bare root must read its own commit");
	const bareBlob = await bareStore.value.readBlob({repositoryId: "cw:repository:test", objectFormat: "sha256", commit: bareCommit.value, path: "README.md", maximumBytes: 100});
	assert.equal(new TextDecoder().decode(bareBlob.value.bytes), "bare-content\n");
});

// D4-T5: bounded fixture executables exercise failed launch, nonzero exit with
// plausible stdout, unknown or malformed format output, timeout, and excessive
// output. Every case fails typed without fallback and without throwing an
// incidental process error. The timeout fixture uses `exec` so the terminated
// process leaves no uncontrolled descendants. These are process-boundary tests,
// not proof that a replacement Git binary is trustworthy.
test("bounded fixture executables fail typed: failed launch, plausible-but-nonzero exit, malformed or unknown format output, timeout, and excessive output", async (t) => {
	const holder = await mkdtemp(join(tmpdir(), "codewiki-project-store-exe-"));
	t.after(() => rm(holder, {recursive: true, force: true}));
	const probeRoot = join(holder, "probe-root");
	await mkdir(probeRoot);

	async function fixtureExecutable(name, body) {
		const directory = join(holder, name);
		await mkdir(directory);
		const path = join(directory, "git");
		await writeFile(path, body, {mode: 0o755});
		return path;
	}

	function fakeProbeExecutable(formatOutput) {
		return [
			"#!/bin/sh",
			'case "$*" in',
			"*--is-bare-repository*) printf 'true\\n'; exit 0;;",
			'*--absolute-git-dir*) printf \'%s\\n\' "$PWD"; exit 0;;',
			`*--show-object-format*) ${formatOutput}; exit 0;;`,
			"esac",
			"exit 1",
			"",
		].join("\n");
	}

	const open = (gitBinary, overrides = {}) => createGitProjectStore({
		repositoryRoot: probeRoot,
		repositoryId: "cw:repository:test",
		gitBinary,
		...overrides,
	});

	const missing = join(holder, "missing-bin", "git");
	const missingOutcome = open(missing);
	assert.equal(missingOutcome.ok, false);
	assert.equal(missingOutcome.error.code, "command_failed", "a failed launch is a failed observation, not a thrown error");

	const noExec = join(holder, "noexec-bin", "git");
	await mkdir(join(holder, "noexec-bin"));
	await writeFile(noExec, "#!/bin/sh\nexit 0\n", {mode: 0o644});
	const noExecOutcome = open(noExec);
	assert.equal(noExecOutcome.ok, false);
	assert.equal(noExecOutcome.error.code, "command_failed");

	const exitThree = await fixtureExecutable("exit-three", "#!/bin/sh\nprintf 'true\\n'\nexit 3\n");
	const exitThreeOutcome = open(exitThree);
	assert.equal(exitThreeOutcome.ok, false, "plausible stdout with a nonzero exit must not become an observation");
	assert.equal(exitThreeOutcome.error.code, "command_failed");

	const unknownFormat = open(await fixtureExecutable("unknown-format", fakeProbeExecutable("printf 'sha3\\n'")));
	assert.equal(unknownFormat.ok, false);
	assert.equal(unknownFormat.error.code, "command_failed", "an unknown reported format must fail");

	const malformedShape = open(await fixtureExecutable("malformed-shape", fakeProbeExecutable("printf 'sha1\\nsha1\\n'")));
	assert.equal(malformedShape.ok, false);
	assert.equal(malformedShape.error.code, "command_failed", "ambiguous multi-line output must fail");

	const malformedBytes = open(await fixtureExecutable("malformed-bytes", fakeProbeExecutable("printf '\\377\\376\\n'")));
	assert.equal(malformedBytes.ok, false);
	assert.equal(malformedBytes.error.code, "command_failed", "invalid UTF-8 observation bytes must fail");

	const sleeper = await fixtureExecutable("sleeper", "#!/bin/sh\nexec sleep 30\n");
	const startedAt = Date.now();
	const timedOut = open(sleeper, {timeoutMs: 500});
	const elapsedMs = Date.now() - startedAt;
	assert.equal(timedOut.ok, false);
	assert.equal(timedOut.error.code, "timeout");
	assert.ok(elapsedMs < 15_000, `the timeout budget must bound the probe (took ${elapsedMs} ms)`);

	const gushing = await fixtureExecutable("gushing", "#!/bin/sh\nawk 'BEGIN{for(i=0;i<65536;i++)printf \"x\"}'\nexit 0\n");
	const gushingOutcome = open(gushing);
	assert.equal(gushingOutcome.ok, false);
	assert.equal(gushingOutcome.error.code, "limit_exceeded", "output above the fixed metadata cap must fail");

	const rootEntries = await sortedEntries(probeRoot);
	assert.deepEqual(rootEntries, [], "no usable partial Store escapes any failed opening");
});

// D4-T6: changing the inherited environment after opening does not retarget a
// Store; moving the fixture's own .git aside makes subsequent reads fail
// closed instead of falling back to the outer repository, while both
// repositories' saved refs remain intact.
test("a Store keeps its validated binding: environment changes do not retarget it and a moved-aside .git fails closed", async (t) => {
	const holder = await mkdtemp(join(tmpdir(), "codewiki-project-store-retarget-"));
	t.after(() => rm(holder, {recursive: true, force: true}));

	const outer = join(holder, "outer");
	await initRepository(outer, "sha1");
	await commitFile(outer, "README.md", "outer\n", "outer-commit");
	const nested = join(outer, "nested");
	await initRepository(nested, "sha1");
	await commitFile(nested, "README.md", "nested\n", "nested-commit");
	const outerHead = oid("sha1", await git(outer, ["rev-parse", "HEAD"]));
	const nestedHead = oid("sha1", await git(nested, ["rev-parse", "HEAD"]));
	const nestedOracle = await git(nested, ["rev-parse", "--show-object-format"]);
	const outerRefsBefore = await git(outer, ["show-ref"]);
	assert.notEqual(outerHead.hex, nestedHead.hex);

	const made = createGitProjectStore({repositoryRoot: nested, repositoryId: "cw:repository:test"});
	assert.equal(made.ok, true, made.ok ? undefined : made.error.message);
	assert.equal(made.value.objectFormat, nestedOracle);
	const main = decodeGitRef("refs/heads/main").value;
	const first = await made.value.readSnapshot({repositoryId: "cw:repository:test", objectFormat: "sha1", selector: {kind: "ref", ref: main}});
	assert.equal(first.ok, true, first.ok ? undefined : first.error.message);
	assert.equal(first.value.commit.hex, nestedHead.hex, "the Store must bind the genuine nested repository, not its parent");

	await withProcessEnv({
		GIT_DIR: join(outer, ".git"),
		GIT_WORK_TREE: outer,
		GIT_COMMON_DIR: join(outer, ".git"),
		GIT_OBJECT_DIRECTORY: join(outer, ".git", "objects"),
		GIT_CONFIG_COUNT: "1",
		GIT_CONFIG_KEY_0: "extensions.objectFormat",
		GIT_CONFIG_VALUE_0: "sha1",
	}, async () => {
		const stillNested = await made.value.readSnapshot({repositoryId: "cw:repository:test", objectFormat: "sha1", selector: {kind: "ref", ref: main}});
		assert.equal(stillNested.ok, true, stillNested.ok ? undefined : stillNested.error.message);
		assert.equal(stillNested.value.commit.hex, nestedHead.hex, "inherited environment changes must not retarget the opened Store");
	});

	const aside = join(nested, "git-aside");
	await rename(join(nested, ".git"), aside);
	await withProcessEnv({
		GIT_DIR: join(outer, ".git"),
		GIT_WORK_TREE: outer,
		GIT_COMMON_DIR: join(outer, ".git"),
		GIT_OBJECT_DIRECTORY: join(outer, ".git", "objects"),
	}, async () => {
		const failed = await made.value.readSnapshot({repositoryId: "cw:repository:test", objectFormat: "sha1", selector: {kind: "ref", ref: main}});
		assert.equal(failed.ok, false, "subsequent reads must fail rather than read the outer repository");
		assert.equal(failed.error.code, "command_failed", "unavailable administrative state is not evidence of an absent ref");
		const byOid = await made.value.readBlob({repositoryId: "cw:repository:test", objectFormat: "sha1", commit: nestedHead, path: "README.md", maximumBytes: 100});
		assert.equal(byOid.ok, false, "object-bound reads must fail against the vanished administrative directory");
		assert.equal(byOid.error.code, "command_failed", "a vanished administrative directory is a failed command, not an absent object");
	});

	assert.equal(await git(outer, ["show-ref"]), outerRefsBefore, "the outer repository's saved refs must remain intact");
	assert.equal((await git(holder, ["--git-dir", aside, "rev-parse", "refs/heads/main"])).trim(), nestedHead.hex, "the moved-aside nested repository must keep its saved refs intact");
});

// SC-2R fixtures inject only selected post-open Git command outcomes. They are
// disposable process-boundary tests, not proof of an untrusted executable sandbox.
async function faultStore(t, repo, target, action) {
	const holder = await mkdtemp(join(tmpdir(), "codewiki-store-fault-"));
	t.after(() => rm(holder, {recursive: true, force: true}));
	const executable = join(holder, "git");
	const trigger = join(holder, "trigger");
	const calls = join(holder, "calls");
	await writeFile(executable, [
		"#!/bin/sh",
		`if [ -f '${trigger}' ]; then`,
		'case " $* " in',
		`*" ${target} "*)`,
		`printf 'called\\n' >> '${calls}'`,
		action,
		";;", "esac", "fi",
		'exec /usr/bin/git "$@"', "",
	].join("\n"), {mode: 0o700});
	const opened = createGitProjectStore({repositoryRoot: repo.root, repositoryId: "cw:repository:test", gitBinary: executable, timeoutMs: 500, maximumOutputBytes: 512});
	assert.equal(opened.ok, true, opened.ok ? undefined : opened.error.message);
	await writeFile(trigger, "enable selected fault\n");
	return {store: opened.value, executable, calls};
}

async function regressionRequests(repo) {
	const binding = {repositoryId: "cw:repository:test", objectFormat: repo.objectFormat};
	const head = oid(repo.objectFormat, await git(repo.root, ["rev-parse", "HEAD"]));
	const blobOid = oid(repo.objectFormat, await git(repo.root, ["rev-parse", "HEAD:README.md"]));
	const mutation = {path: "README.md", mode: "100644", kind: "blob", oid: blobOid};
	const tree = { ...binding, baseTree: null, mutations: [mutation], authorizationId: "cw:authorization:test", requestDigest: "sha256:" + "0".repeat(64)};
	const blob = {...binding, bytes: new TextEncoder().encode("new blob\n"), authorizationId: "cw:authorization:test", requestDigest: "sha256:" + "0".repeat(64)};
	const creation = await commitRequest(repo);
	const baseTree = {...tree, baseTree: creation.tree, mutations: [{path: "README.md", mode: null, kind: null, oid: null}]};
	return {
		head, blobOid,
		ref: {...binding, selector: {kind: "ref", ref: decodeGitRef("refs/heads/main").value}},
		readBlob: {...binding, commit: head, path: "README.md", maximumBytes: 100},
		readTree: {...binding, commit: head, pathPrefix: "", maximumEntries: 10},
		writeTree: {...tree, requestDigest: projectStoreTreeWriteRequestDigest(tree).value},
		writeBlob: {...blob, requestDigest: projectStoreBlobWriteRequestDigest(blob).value},
		createCommit: creation,
		writeBaseTree: {...baseTree, requestDigest: projectStoreTreeWriteRequestDigest(baseTree).value},
		cas: casRequest({...binding, updates: [{ref: decodeGitRef("refs/codewiki/changes/CHG-fault").value, expectedOld: null, newOid: head}], authorizationId: "cw:authorization:test", reflogMessage: "fault fixture"}),
	};
}

function expectIssue(outcome, code, operation) {
	assert.equal(outcome.ok, false, `Expected ${code} for ${operation}`);
	assert.equal(outcome.error.code, code, outcome.error.message);
	assert.equal(outcome.error.operation, operation);
	assert.equal("value" in outcome, false);
}

function nativeEntries(listing, algorithm) {
	assert.equal(listing.endsWith("\0"), true);
	return listing.slice(0, -1).split("\0").map(record => {
		const tab = record.indexOf("\t");
		const [mode, kind, hex] = record.slice(0, tab).split(" ");
		return {path: record.slice(tab + 1), mode, kind, oid: oid(algorithm, hex)};
	});
}

function materialConfiguration(objectFormat) {
	return {repositoryId: "cw:repository:test", objectFormat, canonicalRef: "refs/heads/main", changeRefPrefix: "refs/codewiki/changes"};
}

for (const algorithm of ["sha1", "sha256"]) {
	test(`SC-2B-R ${algorithm} native paths, order and empty boundaries match exact Git`, async t => {
		const repo = await repository(algorithm);
		t.after(() => rm(repo.root, {recursive: true, force: true}));
		const contents = new Map([
			["README.md", "fixture\n"], ["000-empty.md", ""], ["zzz-empty.md", ""],
			["Cafe\u0301.md", "\uFEFF---\r\ntype: SourceOnly\r\n---\r\nCafe\u0301\r\n"],
			["guide[1].md", "literal brackets"], ["question?.md", "literal question"],
			["star*.md", "literal star"], ["brace{one}.md", "literal braces"],
			[":(literal)guide[1].md", "literal pathspec syntax"],
			["tab\tname.md", "tab"], ["line\nname.md", "newline"],
			["CON.md", "ordinary Store path"], ["colon:name.md", "colon"],
			["\uE000.md", "BMP"], ["\u{10000}.md", "supplementary"], ["\u{10001}-empty.md", ""],
			["nested.c.md", "sibling"], ["nested/inside.md", "nested"],
			["folder[1]/a.md", "literal folder"], ["folder1/a.md", "other folder"],
			["image.png", "excluded"],
		]);
		for (const [path, content] of contents) {
			await mkdir(dirname(join(repo.root, path)), {recursive: true});
			await writeFile(join(repo.root, path), content);
		}
		await fixtureGit(repo.root, ["add", "--all"]);
		// Add a >4KiB path through the index, not the host's filesystem PATH_MAX.
		const longPath = Array.from({length: 24}, (_, i) => `${i}-` + "a".repeat(180)).join("/") + "/note.md";
		const originalBlob = await git(repo.root, ["rev-parse", "HEAD:README.md"]);
		await fixtureGit(repo.root, ["update-index", "--add", "--cacheinfo", `100644,${originalBlob},${longPath}`]);
		contents.set(longPath, "fixture\n");
		await fixtureGit(repo.root, ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "native source names"]);
		const requests = await regressionRequests(repo);
		const native = nativeEntries(await fixtureGit(repo.root, ["ls-tree", "-r", "-z", "--full-tree", requests.head.hex]), algorithm);
		const before = {
			index: await readFile(join(repo.root, ".git/index")),
			refs: await fixtureGit(repo.root, ["show-ref"]),
			reflog: await readFile(join(repo.root, ".git/logs/refs/heads/main")),
			worktree: await readFile(join(repo.root, "README.md")),
		};
		const all = await repo.store.readTree({...requests.readTree, maximumEntries: 100});
		assert.equal(all.ok, true, all.error?.message);
		assert.deepEqual(all.value.entries, native, "Store order and descriptors must match native Git, without sorting the oracle");
		const paths = native.map(item => item.path);
		assert.ok(paths.indexOf("\uE000.md") < paths.indexOf("\u{10000}.md"));
		assert.ok(paths.indexOf("nested.c.md") < paths.indexOf("nested/inside.md"));
		for (const descriptor of native) {
			const blob = await repo.store.readBlob({...requests.readBlob, path: descriptor.path, maximumBytes: 512});
			assert.equal(blob.ok, true, `${JSON.stringify(descriptor.path)}: ${blob.error?.message}`);
			assert.deepEqual(blob.value.oid, descriptor.oid);
			assert.deepEqual(Buffer.from(blob.value.bytes), Buffer.from(contents.get(descriptor.path)));
		}
		for (const pathPrefix of ["folder[1]", "nested", "guide[1].md", ":(literal)guide[1].md", longPath]) {
			const subset = await repo.store.readTree({...requests.readTree, pathPrefix, maximumEntries: 100});
			assert.equal(subset.ok, true, `${JSON.stringify(pathPrefix)}: ${subset.error?.message}`);
			assert.deepEqual(subset.value.entries, native.filter(item => item.path === pathPrefix || item.path.startsWith(pathPrefix + "/")));
		}
		const markdown = native.filter(item => item.path.endsWith(".md"));
		const total = markdown.reduce((sum, item) => sum + Buffer.byteLength(contents.get(item.path)), 0);
		const limits = {maximumEntries: native.length, maximumPathBytes: paths.reduce((sum, path) => sum + Buffer.byteLength(path), 0), maximumDocuments: markdown.length, maximumDocumentBytes: 512, maximumTotalBytes: total};
		const calls = [];
		const tracking = {
			readSnapshot: request => repo.store.readSnapshot(request),
			readTree: request => repo.store.readTree(request),
			readBlob: request => { calls.push(request); return repo.store.readBlob(request); },
		};
		for (const source of [{kind: "canonical"}, {kind: "commit", commit: requests.head}]) {
			calls.length = 0;
			const material = await loadMarkdownMaterialSource(tracking, materialConfiguration(algorithm), source, limits);
			assert.equal(material.ok, true, material.error?.message);
			assert.equal(material.value.corpus.documents.reduce((sum, document) => sum + document.byteLength, 0), total);
			assert.equal(calls.length, markdown.length);
			assert.equal(calls.at(-1).path, "\u{10001}-empty.md");
			assert.equal(calls.at(-1).maximumBytes, 1);
			assert.equal(calls.some(call => call.path === "image.png"), false);
			for (const document of material.value.corpus.documents) assert.equal(document.text, contents.get(document.path));
			const tooSmall = await loadMarkdownMaterialSource(tracking, materialConfiguration(algorithm), source, {...limits, maximumTotalBytes: total - 1});
			expectIssue(tooSmall, "limit_exceeded", "read_material");
		}
		const positiveAfterEmpty = await repo.store.readBlob({...requests.readBlob, path: "README.md", maximumBytes: 1});
		expectIssue(positiveAfterEmpty, "limit_exceeded", "read_blob");
		for (const path of ["000-empty.md", "zzz-empty.md"]) {
			const empty = await repo.store.readBlob({...requests.readBlob, path, maximumBytes: 1});
			assert.equal(empty.ok, true);
			assert.equal(empty.value.bytes.byteLength, 0);
		}
		assert.deepEqual(await readFile(join(repo.root, ".git/index")), before.index);
		assert.equal(await fixtureGit(repo.root, ["show-ref"]), before.refs);
		assert.deepEqual(await readFile(join(repo.root, ".git/logs/refs/heads/main")), before.reflog);
		assert.deepEqual(await readFile(join(repo.root, "README.md")), before.worktree);
		// Read compatibility must not broaden the existing writer admission policy.
		for (const path of ["Cafe\u0301.md", "guide[1].md", "line\nname.md", longPath]) {
			const draft = {...requests.writeTree, mutations: [{path, mode: "100644", kind: "blob", oid: requests.blobOid}]};
			const digest = projectStoreTreeWriteRequestDigest(draft);
			const nonCanonical = path !== path.normalize("NFC");
			assert.equal(digest.ok, !nonCanonical, digest.error?.message);
			expectIssue(await repo.store.writeTree({...draft, requestDigest: digest.ok ? digest.value : requests.writeTree.requestDigest}),
				nonCanonical ? "authorization_binding_invalid" : "invalid_object", "write_tree");
		}
		for (const path of ["CON.md", "tab\tname.md", "brace{one}.md"]) {
			const draft = {...requests.writeTree, mutations: [{path, mode: "100644", kind: "blob", oid: requests.blobOid}]};
			const result = await repo.store.writeTree({...draft, requestDigest: projectStoreTreeWriteRequestDigest(draft).value});
			assert.equal(result.ok, true, "read repair must not narrow previously admitted writer paths");
		}
	});
}

test("SC-2B-R read-path rejection happens before any Git observation", async t => {
	const repo = await repository();
	t.after(() => rm(repo.root, {recursive: true, force: true}));
	const requests = await regressionRequests(repo);
	const injected = await faultStore(t, repo, "rev-parse", "exit 91");
	for (const path of ["/README.md", "C:/README.md", "../README.md", "./README.md", "a//b", "a/../b", "a\\b", "nul\0.md", "lone\uD800.md", "tail.md\uD800", "\uDC00.md", undefined]) {
		expectIssue(await injected.store.readBlob({...requests.readBlob, path}), "invalid_object", "read_blob");
		expectIssue(await injected.store.readTree({...requests.readTree, pathPrefix: path}), "invalid_object", "read_tree");
	}
	expectIssue(await injected.store.readBlob({...requests.readBlob, path: ""}), "invalid_object", "read_blob");
	assert.equal(await pathExists(injected.calls), false);
});

test("SC-2B-R malformed native listings fail rather than being sorted or normalized", async t => {
	const repo = await repository();
	t.after(() => rm(repo.root, {recursive: true, force: true}));
	const requests = await regressionRequests(repo);
	const record = path => Buffer.from(`100644 blob ${requests.blobOid.hex}\t${path}\0`);
	const cases = [
		{bytes: Buffer.concat([record("\u{10000}.md"), record("\uE000.md")])},
		{bytes: Buffer.concat([record("same.md"), record("same.md")])},
		{bytes: Buffer.concat([record("nested/child.md"), record("nested.c.md")])},
		{bytes: record("../escape.md")}, {bytes: record("a//b.md")},
		{bytes: record("unterminated.md").subarray(0, -1)},
		{bytes: Buffer.concat([Buffer.from(`100644 blob ${requests.blobOid.hex}\t`), Buffer.from([0xff, 0])]), code: "command_failed"},
		{bytes: Buffer.concat([record("a.md"), record("b.md")]), maximumEntries: 1, code: "limit_exceeded"},
	];
	for (const item of cases) {
		const encoded = [...item.bytes].map(byte => "\\" + byte.toString(8).padStart(3, "0")).join("");
		const injected = await faultStore(t, repo, "ls-tree", `printf '${encoded}'; exit 0`);
		expectIssue(await injected.store.readTree({...requests.readTree, maximumEntries: item.maximumEntries ?? 10}), item.code ?? "invalid_object", "read_tree");
	}
});

const PROCESS_FAULTS = [
	["exit 1", "exit 1", "command_failed"],
	["exit 12", "exit 12", "command_failed"],
	["exit 128", "exit 128", "command_failed"],
	["unsupported command", "exit 129", "command_failed"],
	["signal", "kill -TERM $$", "command_failed"],
	["timeout", "exec sleep 2", "timeout"],
	["output limit", "exec head -c 65536 /dev/zero", "limit_exceeded"],
];

test("SC-2R healthy absence differs from broken or dangling refs and wrong object types", async t => {
	for (const format of ["sha1", "sha256"]) {
		const repo = await repository(format);
		t.after(() => rm(repo.root, {recursive: true, force: true}));
		const requests = await regressionRequests(repo);
		const missingRef = decodeGitRef("refs/codewiki/changes/CHG-absent").value;
		expectIssue(await repo.store.readSnapshot({...requests.ref, selector: {kind: "ref", ref: missingRef}}), "not_found", "read_snapshot");
		for (const commit of [oid(format, "1".repeat(format === "sha1" ? 40 : 64)), requests.blobOid]) {
			expectIssue(await repo.store.readBlob({...requests.readBlob, commit}), "invalid_object", "read_blob");
			expectIssue(await repo.store.readTree({...requests.readTree, commit}), "invalid_object", "read_tree");
		}
		const before = await git(repo.root, ["show-ref"]);
		assert.equal((await repo.store.writeTree(requests.writeBaseTree)).ok, true);
		const wrongBase = {...requests.writeBaseTree, baseTree: requests.blobOid};
		expectIssue(await repo.store.writeTree({...wrongBase, requestDigest: projectStoreTreeWriteRequestDigest(wrongBase).value}), "invalid_object", "write_tree");
		assert.equal((await repo.store.readSnapshot(requests.ref)).value.commit.hex, requests.head.hex);
		assert.equal(await git(repo.root, ["show-ref"]), before);
		const directory = join(repo.root, ".git", "refs", "codewiki", "changes");
		await mkdir(directory, {recursive: true});
		for (const [name, text] of [["broken", "invalid-oid\n"], ["dangling", "ref: refs/heads/absent\n"]]) {
			await writeFile(join(directory, `CHG-${name}`), text);
			const ref = decodeGitRef(`refs/codewiki/changes/CHG-${name}`).value;
			expectIssue(await repo.store.readSnapshot({...requests.ref, selector: {kind: "ref", ref}}), "command_failed", "read_snapshot");
		}
	}
});

test("SC-2R failed ref observation cannot become absence or permit CAS", async t => {
	const repo = await repository(); t.after(() => rm(repo.root, {recursive: true, force: true}));
	const requests = await regressionRequests(repo);
	const before = await git(repo.root, ["show-ref"]);
	for (const [name, action, code] of PROCESS_FAULTS) await t.test(name, async child => {
		const {store} = await faultStore(child, repo, "show-ref --exists", action);
		expectIssue(await store.readSnapshot(requests.ref), code, "read_snapshot");
		expectIssue(await store.compareAndSwapRefs(requests.cas), code, "cas");
	});
	assert.equal(await git(repo.root, ["show-ref"]), before);
});

test("SC-2R object-type failures preserve categories across reads and write preflights", async t => {
	const repo = await repository(); t.after(() => rm(repo.root, {recursive: true, force: true}));
	const requests = await regressionRequests(repo);
	const before = await git(repo.root, ["show-ref"]);
	for (const [name, action, code] of PROCESS_FAULTS) await t.test(name, async child => {
		const {store} = await faultStore(child, repo, "cat-file", action);
		for (const [method, request, operation] of [
			["readBlob", requests.readBlob, "read_blob"], ["readTree", requests.readTree, "read_tree"],
			["writeTree", requests.writeTree, "write_tree"], ["writeTree", requests.writeBaseTree, "write_tree"],
			["createCommit", requests.createCommit, "create_commit"],
			["compareAndSwapRefs", requests.cas, "cas"],
		]) expectIssue(await store[method](request), code, operation);
	});
	assert.equal(await git(repo.root, ["show-ref"]), before);
});

test("SC-2R launch failures after opening propagate without ref or object claims", async t => {
	const repo = await repository(); t.after(() => rm(repo.root, {recursive: true, force: true}));
	const requests = await regressionRequests(repo);
	const {store, executable} = await faultStore(t, repo, "unused", "exit 12");
	await rm(executable);
	for (const [method, request, operation] of [["readSnapshot", requests.ref, "read_snapshot"], ["readBlob", requests.readBlob, "read_blob"], ["writeTree", requests.writeTree, "write_tree"], ["createCommit", requests.createCommit, "create_commit"], ["compareAndSwapRefs", requests.cas, "cas"]]) {
		expectIssue(await store[method](request), "command_failed", operation);
	}
});

test("SC-2R ref protocols reject malformed records and resolution races", async t => {
	const repo = await repository(); t.after(() => rm(repo.root, {recursive: true, force: true}));
	const requests = await regressionRequests(repo);
	for (const action of ["printf 'unexpected\\n'; exit 0", "printf 'unexpected\\n'; exit 2"]) {
		const {store} = await faultStore(t, repo, "show-ref --exists", action);
		expectIssue(await store.readSnapshot(requests.ref), "command_failed", "read_snapshot");
	}
	for (const action of ["exit 2", "exit 128", "printf '\\377'; exit 0", `printf '${requests.head.hex}'; exit 0`, `printf '${requests.head.hex}\\n\\n'; exit 0`, `printf '\\357\\273\\277${requests.head.hex}\\n'; exit 0`]) {
		const {store} = await faultStore(t, repo, "show-ref --verify --hash", action);
		expectIssue(await store.readSnapshot(requests.ref), "command_failed", "read_snapshot");
	}
	const {store} = await faultStore(t, repo, "show-ref --exists", "exit 2");
	expectIssue(await store.readSnapshot(requests.ref), "not_found", "read_snapshot");
	// An explicit Git missing result is trusted as a protocol observation, not
	// proof that the injected executable tells the truth about the repository.
});

test("SC-2R batch type records must name exactly the requested OID", async t => {
	const repo = await repository(); t.after(() => rm(repo.root, {recursive: true, force: true}));
	const requests = await regressionRequests(repo);
	for (const action of [
		"printf '\\377'; exit 0", "printf 'missing\\n'; exit 0", `printf '${"1".repeat(40)} commit\\n'; exit 0`,
		`printf '${requests.head.hex} commit'; exit 0`, `printf '${requests.head.hex} commit\\n\\n'; exit 0`,
		`printf '${requests.head.hex} strange\\n'; exit 0`, `printf '\\357\\273\\277${requests.head.hex} commit\\n'; exit 0`,
		`printf '${requests.head.hex} missing\\n'; exit 12`,
	]) {
		const {store} = await faultStore(t, repo, "cat-file", action);
		expectIssue(await store.readBlob(requests.readBlob), "command_failed", "read_blob");
	}
});

test("SC-2R binary-writer OID responses fail typed instead of throwing or normalizing", async t => {
	const repo = await repository(); t.after(() => rm(repo.root, {recursive: true, force: true}));
	const requests = await regressionRequests(repo);
	for (const [command, method, request, operation] of [["hash-object", "writeBlob", requests.writeBlob, "write_blob"], ["mktree", "writeTree", requests.writeTree, "write_tree"], ["commit-tree", "createCommit", requests.createCommit, "create_commit"]]) {
		for (const action of ["printf '\\377'; exit 0", `printf '${requests.head.hex}\\n\\n'; exit 0`]) {
			const {store} = await faultStore(t, repo, command, action);
			expectIssue(await store[method](request), "command_failed", operation);
		}
	}
});

test("SC-2R post-write verification preserves command failure without claiming no effect", async t => {
	const repo = await repository(); t.after(() => rm(repo.root, {recursive: true, force: true}));
	const requests = await regressionRequests(repo);
	for (const [target, method, request, operation] of [["cat-file blob", "writeBlob", requests.writeBlob, "write_blob"], ["cat-file commit", "createCommit", requests.createCommit, "create_commit"]]) {
		const {store} = await faultStore(t, repo, target, "exit 12");
		expectIssue(await store[method](request), "command_failed", operation);
	}
});

test("SC-2R failed CAS with unchanged refs preserves the original failure", async t => {
	const repo = await repository(); t.after(() => rm(repo.root, {recursive: true, force: true}));
	const requests = await regressionRequests(repo);
	const before = await git(repo.root, ["show-ref"]);
	for (const [name, action, code] of PROCESS_FAULTS) await t.test(name, async child => {
		const {store, calls} = await faultStore(child, repo, "update-ref", action);
		expectIssue(await store.compareAndSwapRefs(requests.cas), code, "cas");
		assert.equal(await readFile(calls, "utf8"), "called\n", "Do not retry a failed effect");
		assert.equal(await git(repo.root, ["show-ref"]), before);
	});
});

test("SC-2R CAS reconciles observed effects and reports observed conflicts without retry", async t => {
	const repo = await repository(); t.after(() => rm(repo.root, {recursive: true, force: true}));
	const requests = await regressionRequests(repo);
	const ref = requests.cas.updates[0].ref;
	const applied = await faultStore(t, repo, "update-ref", '/usr/bin/git "$@" || exit $?; exit 12');
	const first = await applied.store.compareAndSwapRefs(requests.cas);
	assert.equal(first.ok, true, first.ok ? undefined : first.error.message);
	assert.equal(first.value.status, "reconciled");
	assert.equal(await git(repo.root, ["rev-parse", ref]), requests.head.hex);
	assert.equal((await applied.store.compareAndSwapRefs(requests.cas)).value.status, "reconciled");
	assert.equal(await readFile(applied.calls, "utf8"), "called\n");

	await git(repo.root, ["update-ref", "-d", ref]);
	const other = await repo.store.createCommit(await commitRequest(repo, {message: "concurrent fixture\n"}));
	assert.equal(other.ok, true);
	const conflict = await faultStore(t, repo, "update-ref", `/usr/bin/git -c core.hooksPath=/dev/null --git-dir '${join(repo.root, ".git")}' update-ref '${ref}' '${other.value.hex}' || exit $?; exit 128`);
	expectIssue(await conflict.store.compareAndSwapRefs(requests.cas), "stale_ref", "cas");
	assert.equal(await git(repo.root, ["rev-parse", ref]), other.value.hex, "Do not undo the observed competing write");
	assert.equal(await readFile(conflict.calls, "utf8"), "called\n");
});

test("SC-2R an applied but unreadable CAS remains unresolved rather than falsely absent", async t => {
	const repo = await repository(); t.after(() => rm(repo.root, {recursive: true, force: true}));
	const requests = await regressionRequests(repo);
	const aside = join(repo.root, "git-aside");
	const {store, calls} = await faultStore(t, repo, "update-ref", `/usr/bin/git "$@" || exit $?; mv '${join(repo.root, ".git")}' '${aside}' || exit $?; exit 12`);
	expectIssue(await store.compareAndSwapRefs(requests.cas), "command_failed", "cas");
	assert.equal(await git(repo.root, ["--git-dir", aside, "rev-parse", requests.cas.updates[0].ref]), requests.head.hex, "The fixture oracle observes an effect despite the failed response");
	assert.equal(await readFile(calls, "utf8"), "called\n");
});

for (const algorithm of ["sha1", "sha256"]) test(`tree mutation preserves exact inherited native paths without granting nonportable writes (${algorithm})`, async t => {
	const repo = await repository(algorithm); t.after(() => rm(repo.root, {recursive: true, force: true}));
	for (const path of ["Cafe\u0301.md", "🌱/tip.md", "a.c", "a/child.md", "a0.md", "tab\tname.txt"]) {
		await mkdir(dirname(join(repo.root, path)), {recursive: true});
		await writeFile(join(repo.root, path), `Exact ${path}\n`);
	}
	await git(repo.root, ["add", "--all"]); await git(repo.root, ["commit", "-q", "-m", "native names"]);
	const baseTree = oid(algorithm, await git(repo.root, ["rev-parse", "HEAD^{tree}"]));
	const blob = oid(algorithm, await git(repo.root, ["rev-parse", "HEAD:README.md"]));
	const baseline = {refs: await git(repo.root, ["show-ref"]), config: await readFile(join(repo.root, ".git/config")), index: await readFile(join(repo.root, ".git/index"))};
	const body = {repositoryId: "cw:repository:test", objectFormat: algorithm, baseTree, mutations: [{path: "addition.txt", mode: "100644", kind: "blob", oid: blob}], authorizationId: "cw:authorization:test"};
	const signed = projectStoreTreeWriteRequestDigest(body); assert.equal(signed.ok, true);
	const result = await repo.store.writeTree({...body, requestDigest: signed.value});
	assert.equal(result.ok, true, result.ok ? "" : result.error.message);
	assert.equal(await git(repo.root, ["diff-tree", "--no-commit-id", "--name-only", "-r", baseTree.hex, result.value.tree.hex]), "addition.txt");
	const remove = {...body, baseTree: result.value.tree, mutations: [{path: "addition.txt", mode: null, kind: null, oid: null}]};
	const restored = await repo.store.writeTree({...remove, requestDigest: projectStoreTreeWriteRequestDigest(remove).value});
	assert.equal(restored.ok, true); assert.deepEqual(restored.value.tree, baseTree, "Every retained native tree byte is reproduced");
	const objects = await git(repo.root, ["count-objects", "-v"]);
	for (const path of ["Cafe\u0301.md", "newline\nname.txt", ".git/config", "../outside"]) {
		const denied = {...body, mutations: [{path, mode: "100644", kind: "blob", oid: blob}]};
		const digest = projectStoreTreeWriteRequestDigest(denied);
		assert.equal((await repo.store.writeTree({...denied, requestDigest: digest.ok ? digest.value : "sha256:" + "0".repeat(64)})).ok, false);
	}
	assert.equal(await git(repo.root, ["count-objects", "-v"]), objects);
	assert.equal(await git(repo.root, ["show-ref"]), baseline.refs);
	assert.deepEqual(await readFile(join(repo.root, ".git/config")), baseline.config);
	assert.deepEqual(await readFile(join(repo.root, ".git/index")), baseline.index);
});

test("leaf tree writer rejects an empty inherited subtree instead of dropping its identity", async t => {
	const repo = await repository(); t.after(() => rm(repo.root, {recursive: true, force: true}));
	const scratch = join(repo.root, ".git", "fixture-tree-bytes");
	await writeFile(scratch, "");
	const empty = await git(repo.root, ["hash-object", "-t", "tree", "-w", scratch]);
	await writeFile(scratch, Buffer.concat([Buffer.from("40000 empty\0"), Buffer.from(empty, "hex")]));
	const baseTree = oid("sha1", await git(repo.root, ["hash-object", "-t", "tree", "-w", scratch]));
	const blob = oid("sha1", await git(repo.root, ["rev-parse", "HEAD:README.md"]));
	const body = {repositoryId: "cw:repository:test", objectFormat: "sha1", baseTree, mutations: [{path: "addition.txt", mode: "100644", kind: "blob", oid: blob}], authorizationId: "cw:authorization:test"};
	const refs = await git(repo.root, ["show-ref"]);
	const result = await repo.store.writeTree({...body, requestDigest: projectStoreTreeWriteRequestDigest(body).value});
	assert.equal(result.ok, false); assert.match(result.error.message, /empty subtrees/u);
	assert.equal(await git(repo.root, ["show-ref"]), refs);
});
