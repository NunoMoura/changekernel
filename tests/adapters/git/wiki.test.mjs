import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {chmod, mkdir, mkdtemp, rename, rm, unlink, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {after, before, test} from "node:test";

import {createGitProjectStore} from "../../../src/adapters/git/project-store.ts";
import {readExactWiki, readExactWikiHistory} from "../../../src/adapters/git/wiki.ts";
import {digest, markdownEntry} from "../../kernel/wiki/fixtures.mjs";

let root;
let store;
let commits;
let versions;

before(async () => {
	root = await mkdtemp(join(tmpdir(), "codewiki-sk3d-wiki-"));
	git(["init", "-q", "-b", "main"]);
	git(["config", "user.name", "CodeWiki Test"]);
	git(["config", "user.email", "test@codewiki.invalid"]);
	const oldPath = join(root, ".codewiki/wiki/items/current/alpha.md");
	const movedPath = join(root, ".codewiki/wiki/items/archive/alpha.md");
	await mkdir(join(root, ".codewiki/wiki/items/current"), {recursive: true});

	const first = markdownEntry({path: ".codewiki/wiki/items/current/alpha.md", itemId: "cw:item:alpha", title: "Alpha", body: "First.\n"});
	await writeFile(oldPath, first.bytes);
	const commit1 = commit("add alpha");

	const second = markdownEntry({path: first.path, itemId: "cw:item:alpha", title: "Alpha Two", body: "Second.\n"});
	await writeFile(oldPath, second.bytes);
	const commit2 = commit("edit alpha");

	await mkdir(join(root, ".codewiki/wiki/items/archive"), {recursive: true});
	await rename(oldPath, movedPath);
	const commit3 = commit("move alpha");

	const fourth = markdownEntry({
		path: ".codewiki/wiki/items/archive/alpha.md",
		itemId: "cw:item:alpha",
		title: "Alpha Two",
		body: "Second.\n",
		attributes: {"codewiki.legacy:source": "old-system"},
	});
	await writeFile(movedPath, fourth.bytes);
	const commit4 = commit("record legacy provenance");
	git(["update-ref", "refs/codewiki/changes/CHG-test", commit4]);

	await unlink(movedPath);
	const commit5 = commit("retire alpha");
	commits = {commit1, commit2, commit3, commit4, commit5};
	versions = {fourth};
	const created = createGitProjectStore({repositoryRoot: root, repositoryId: "cw:project:test"});
	if (!created.ok) throw new Error(created.error.message);
	store = created.value;
});

after(async () => {
	if (root) await rm(root, {recursive: true, force: true});
});

test("exact Wiki reads accept canonical and Change refs and bind every blob to one resolved commit", async () => {
	const byRef = await readExactWiki(store, request({kind: "ref", ref: "refs/codewiki/changes/CHG-test"}));
	assert.equal(byRef.ok, true, byRef.ok ? "" : byRef.error.message);
	assert.equal(byRef.value.sourceChannel, "git");
	assert.equal(byRef.value.privateIndexStatus, "absent");
	assert.equal(byRef.value.wiki.source.snapshot.commit.hex, commits.commit4);
	assert.equal(byRef.value.wiki.items[0].path, ".codewiki/wiki/items/archive/alpha.md");
	assert.equal(byRef.value.wiki.items[0].item.title, "Alpha Two");

	const main = await readExactWiki(store, request({kind: "ref", ref: "refs/heads/main"}));
	assert.equal(main.ok, true);
	assert.equal(main.value.wiki.items.length, 0);

	const tree = await store.readTree({
		repositoryId: "cw:project:test",
		objectFormat: "sha1",
		commit: gitOid(commits.commit4),
		pathPrefix: ".codewiki/wiki/items",
		maximumEntries: 1,
	});
	assert.equal(tree.ok, true);
	assert.deepEqual(tree.value.entries.map(({path, mode, kind}) => ({path, mode, kind})), [{
		path: ".codewiki/wiki/items/archive/alpha.md",
		mode: "100644",
		kind: "blob",
	}]);
});

test("fresh private indexes may accelerate exact reads; stale or invalid indexes fall back to Git", async () => {
	const commit = gitOid(commits.commit4);
	const tree = gitOid(git(["rev-parse", `${commits.commit4}^{tree}`]).trim());
	const blob = gitOid(git(["rev-parse", `${commits.commit4}:.codewiki/wiki/items/archive/alpha.md`]).trim());
	const entry = Object.freeze({...versions.fourth, blob});
	const fresh = Object.freeze({commit, tree, kernelBuildDigest: digest(), entries: Object.freeze([entry])});
	const indexed = await readExactWiki(store, {...request({kind: "oid", oid: commit}), privateIndex: fresh});
	assert.equal(indexed.ok, true);
	assert.equal(indexed.value.sourceChannel, "private-index");
	assert.equal(indexed.value.privateIndexStatus, "fresh");

	const stale = Object.freeze({...fresh, commit: gitOid(commits.commit3)});
	const staleRead = await readExactWiki(store, {...request({kind: "oid", oid: commit}), privateIndex: stale});
	assert.equal(staleRead.ok, true);
	assert.equal(staleRead.value.sourceChannel, "git");
	assert.equal(staleRead.value.privateIndexStatus, "stale");

	const forged = markdownEntry({
		path: entry.path,
		itemId: "cw:item:alpha",
		title: "Forged cache content",
		body: "Not in Git.\n",
	});
	const invalid = Object.freeze({...fresh, entries: Object.freeze([{...entry, bytes: forged.bytes}])});
	const recovered = await readExactWiki(store, {...request({kind: "oid", oid: commit}), privateIndex: invalid});
	assert.equal(recovered.ok, true);
	assert.equal(recovered.value.sourceChannel, "git");
	assert.equal(recovered.value.privateIndexStatus, "invalid");
	assert.equal(recovered.value.wiki.items[0].item.title, "Alpha Two");
});

test("exact first-parent history preserves add/edit/move/provenance/retire facts with explicit bounds", async () => {
	const history = await readExactWikiHistory(store, {
		...request({kind: "oid", oid: gitOid(commits.commit5)}),
		itemId: "cw:item:alpha",
		maximumCommits: 10,
		maximumHistoryBytes: 1024 * 1024,
	});
	assert.equal(history.ok, true, history.ok ? "" : history.error.message);
	assert.equal(history.value.complete, true);
	assert.deepEqual(history.value.revisions.map((revision) => revision.kind), [
		"retired",
		"provenance_changed",
		"moved",
		"edited",
		"added",
	]);
	assert.equal(history.value.revisions[2].current.item.itemId, "cw:item:alpha");
	assert.equal(history.value.revisions[2].current.path, ".codewiki/wiki/items/archive/alpha.md");
	assert.equal(history.value.revisions[2].previous.path, ".codewiki/wiki/items/current/alpha.md");

	const bounded = await readExactWikiHistory(store, {
		...request({kind: "oid", oid: gitOid(commits.commit5)}),
		itemId: "cw:item:alpha",
		maximumCommits: 2,
	});
	assert.equal(bounded.ok, true);
	assert.equal(bounded.value.complete, false);
	assert.deepEqual(bounded.value.unknowns, ["history-commit-limit-reached"]);
	assert.deepEqual(bounded.value.revisions.map((revision) => revision.kind), ["retired"]);
});

test("non-regular Wiki files and invalid tree limits fail closed", async () => {
	const path = join(root, ".codewiki/wiki/items/current/executable.md");
	await mkdir(join(root, ".codewiki/wiki/items/current"), {recursive: true});
	const executable = markdownEntry({path: ".codewiki/wiki/items/current/executable.md", itemId: "cw:item:executable", title: "Executable"});
	await writeFile(path, executable.bytes);
	await chmod(path, 0o755);
	const commit6 = commit("add executable wiki file");
	const read = await readExactWiki(store, request({kind: "oid", oid: gitOid(commit6)}));
	assert.equal(read.ok, false);
	assert.equal(read.error.code, "wiki_validation_failure");
	assert.match(read.error.message, /regular non-executable/u);

	const invalidLimit = await store.readTree({
		repositoryId: "cw:project:test",
		objectFormat: "sha1",
		commit: gitOid(commit6),
		pathPrefix: ".codewiki/wiki/items",
		maximumEntries: 0,
	});
	assert.equal(invalidLimit.ok, false);
	assert.equal(invalidLimit.error.code, "limit_exceeded");
});

function request(selector) {
	return {
		repositoryId: "cw:project:test",
		objectFormat: "sha1",
		selector,
		kernelBuildDigest: digest(),
		retiredItemIds: [],
	};
}

function commit(message) {
	git(["add", "-A"]);
	git(["commit", "-q", "-m", message]);
	return git(["rev-parse", "HEAD"]).trim();
}

function gitOid(hex) {
	return Object.freeze({algorithm: "sha1", hex});
}

function git(args) {
	return execFileSync("git", ["-C", root, ...args], {
		encoding: "utf8",
		env: {
			PATH: process.env.PATH,
			HOME: root,
			LANG: "C",
			LC_ALL: "C",
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_TERMINAL_PROMPT: "0",
		},
	});
}
