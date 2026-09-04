import assert from "node:assert/strict";
import {chmod, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import test from "node:test";
import {createGitProjectStore} from "../../../src/adapters/git/project-store.ts";
import {decodeGitRef, gitOid} from "../../../src/kernel/identity/git.ts";
import {projectStoreCasRequestDigest, projectStoreCommitRequestDigest} from "../../../src/ports/project-store.ts";

function git(root, args, options = {}) {
	return execFileSync("git", ["-C", root, ...args], {encoding: "utf8", ...options}).trim();
}

function oid(algorithm, hex) {
	const result = gitOid(algorithm, hex);
	assert.equal(result.ok, true);
	return result.value;
}

async function repository(objectFormat = "sha1") {
	const root = await mkdtemp(join(tmpdir(), "codewiki-project-store-"));
	git(root, ["init", "-q", "-b", "main", `--object-format=${objectFormat}`]);
	git(root, ["config", "user.name", "Fixture"]);
	git(root, ["config", "user.email", "fixture@example.invalid"]);
	await writeFile(join(root, "README.md"), "fixture\n");
	git(root, ["add", "README.md"]);
	git(root, ["commit", "-q", "-m", "initial"]);
	const made = createGitProjectStore({repositoryRoot: root, repositoryId: "cw:repository:test"});
	assert.equal(made.ok, true, made.ok ? undefined : made.error.message);
	return {root, store: made.value, objectFormat};
}

function commitRequest(repo, overrides = {}) {
	const head = oid(repo.objectFormat, git(repo.root, ["rev-parse", "HEAD"]));
	const tree = oid(repo.objectFormat, git(repo.root, ["rev-parse", "HEAD^{tree}"]));
	const request = {
		repositoryId: "cw:repository:test",
		objectFormat: repo.objectFormat,
		tree,
		parents: [head],
		message: "deterministic candidate\n",
		author: {name: "CodeWiki", email: "codewiki@example.invalid", timestamp: "2026-09-01T00:00:00Z"},
		committer: {name: "CodeWiki", email: "codewiki@example.invalid", timestamp: "2026-09-01T00:00:00Z"},
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
	const blobOid = oid("sha1", git(repo.root, ["rev-parse", "HEAD:README.md"]));
	const blob = await repo.store.readBlob({repositoryId: "cw:repository:test", objectFormat: "sha1", oid: blobOid, maximumBytes: 100});
	assert.equal(blob.ok, true);
	assert.equal(new TextDecoder().decode(blob.value.bytes), "fixture\n");
	assert.equal((await repo.store.readBlob({repositoryId: "cw:repository:test", objectFormat: "sha1", oid: blobOid, maximumBytes: 1})).error.code, "limit_exceeded");
});

test("incomplete transitive object closure is rejected without fetching", async (t) => {
	const repo = await repository();
	t.after(() => rm(repo.root, {recursive: true, force: true}));
	const head = oid("sha1", git(repo.root, ["rev-parse", "HEAD"]));
	const blob = git(repo.root, ["rev-parse", "HEAD:README.md"]);
	await rm(join(repo.root, ".git", "objects", blob.slice(0, 2), blob.slice(2)));
	const read = await repo.store.readSnapshot({repositoryId: "cw:repository:test", objectFormat: "sha1", selector: {kind: "oid", oid: head}});
	assert.equal(read.ok, false);
	assert.ok(["incomplete_object", "command_failed"].includes(read.error.code));
});

test("commit object creation is deterministic and crash-before-CAS leaves refs unchanged", async (t) => {
	const repo = await repository();
	t.after(() => rm(repo.root, {recursive: true, force: true}));
	const before = git(repo.root, ["show-ref"]);
	const first = await repo.store.createCommit(commitRequest(repo));
	const second = await repo.store.createCommit(commitRequest(repo));
	assert.equal(first.ok, true, first.ok ? undefined : first.error.message);
	assert.equal(second.ok, true);
	assert.deepEqual(second.value, first.value);
	assert.equal(git(repo.root, ["show-ref"]), before);
});

test("managed ref CAS is atomic, stale-safe, and hook-isolated", async (t) => {
	const repo = await repository();
	t.after(() => rm(repo.root, {recursive: true, force: true}));
	const hooks = join(repo.root, "hooks");
	await import("node:fs/promises").then(({mkdir}) => mkdir(hooks));
	const marker = join(repo.root, "hook-ran");
	const hook = join(hooks, "reference-transaction");
	await writeFile(hook, `#!/bin/sh\ntouch '${marker}'\n`);
	await chmod(hook, 0o755);
	git(repo.root, ["config", "core.hooksPath", hooks]);
	const candidate = await repo.store.createCommit(commitRequest(repo));
	assert.equal(candidate.ok, true);
	const ref = decodeGitRef("refs/codewiki/changes/CHG-test").value;
	const request = casRequest({repositoryId: "cw:repository:test", objectFormat: "sha1", ref, expectedOld: null, newOid: candidate.value, authorizationId: "cw:authorization:test", reflogMessage: "codewiki test CAS"});
	const first = await repo.store.compareAndSwapRef(request);
	assert.equal(first.ok, true, first.ok ? undefined : first.error.message);
	assert.equal(first.value.repositoryId, "cw:repository:test");
	assert.equal(first.value.authorizationId, request.authorizationId);
	assert.equal(first.value.objectFormat, "sha1");
	assert.equal(git(repo.root, ["rev-parse", ref]), candidate.value.hex);
	const tampered = await repo.store.compareAndSwapRef({...request, reflogMessage: "tampered"});
	assert.equal(tampered.error.code, "authorization_binding_invalid");
	assert.equal(await readFile(marker, "utf8").then(() => true, () => false), false);
	const stale = await repo.store.compareAndSwapRef(request);
	assert.equal(stale.ok, false);
	assert.equal(stale.error.code, "stale_ref");
	assert.equal(git(repo.root, ["rev-parse", ref]), candidate.value.hex);
});

test("concurrent expected-old CAS admits one writer and rejects one stale writer", async (t) => {
	const repo = await repository();
	t.after(() => rm(repo.root, {recursive: true, force: true}));
	const firstCommit = await repo.store.createCommit(commitRequest(repo, {message: "first\n"}));
	const secondCommit = await repo.store.createCommit(commitRequest(repo, {message: "second\n"}));
	const ref = decodeGitRef("refs/codewiki/changes/CHG-race").value;
	const base = {repositoryId: "cw:repository:test", objectFormat: "sha1", ref, expectedOld: null, authorizationId: "cw:authorization:test", reflogMessage: "race"};
	const outcomes = await Promise.all([
		repo.store.compareAndSwapRef(casRequest({...base, newOid: firstCommit.value})),
		repo.store.compareAndSwapRef(casRequest({...base, newOid: secondCommit.value})),
	]);
	assert.deepEqual(outcomes.map((entry) => entry.ok).sort(), [false, true]);
	assert.equal(outcomes.find((entry) => !entry.ok).error.code, "stale_ref");
});

test("adapter rejects unsafe refs, repository mismatch, and malformed commit authorization", async (t) => {
	const repo = await repository();
	t.after(() => rm(repo.root, {recursive: true, force: true}));
	const head = oid("sha1", git(repo.root, ["rev-parse", "HEAD"]));
	const tag = decodeGitRef("refs/tags/not-writable").value;
	const rejected = await repo.store.compareAndSwapRef(casRequest({repositoryId: "cw:repository:test", objectFormat: "sha1", ref: tag, expectedOld: null, newOid: head, authorizationId: "cw:authorization:test", reflogMessage: "reject"}));
	assert.equal(rejected.error.code, "invalid_ref");
	assert.equal((await repo.store.readSnapshot({repositoryId: "cw:repository:other", objectFormat: "sha1", selector: {kind: "oid", oid: head}})).error.code, "repository_mismatch");
	assert.equal((await repo.store.createCommit(commitRequest(repo, {message: "missing terminal newline"}))).ok, false);
	assert.equal((await repo.store.createCommit(commitRequest(repo, {message: "invalid \ud800\n"}))).error.code, "limit_exceeded");
	assert.equal((await repo.store.createCommit(commitRequest(repo, {authorizationId: "invalid"}))).error.code, "authorization_binding_invalid");
	const bound = commitRequest(repo);
	assert.equal((await repo.store.createCommit({...bound, message: "tampered\n"})).error.code, "authorization_binding_invalid");
	assert.equal(createGitProjectStore({repositoryRoot: repo.root, repositoryId: "cw:repository:test", gitBinary: "/bin/sh"}).ok, false);
});

test("adapter supports repository-declared SHA-256 object format when Git does", async (t) => {
	let repo;
	try {
		repo = await repository("sha256");
	} catch (error) {
		t.skip(`Git lacks SHA-256 repositories: ${error.message}`);
		return;
	}
	t.after(() => rm(repo.root, {recursive: true, force: true}));
	const head = oid("sha256", git(repo.root, ["rev-parse", "HEAD"]));
	const snapshot = await repo.store.readSnapshot({repositoryId: "cw:repository:test", objectFormat: "sha256", selector: {kind: "oid", oid: head}});
	assert.equal(snapshot.ok, true, snapshot.ok ? undefined : snapshot.error.message);
});
