import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {
	chmod,
	cp,
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	readlink,
	readdir,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {promisify} from "node:util";
import test from "node:test";

import {createChangeKernelClient} from "../../../src/api/client/index.ts";
import {bootstrapChangeKernelProject} from "../../../src/adapters/git/bootstrap.ts";
import {createLocalProjectServer} from "../../../src/adapters/git/local-server.ts";

/**
 * Read-purity regression coverage for the local Project Server composition.
 *
 * These tests bind the real source Git adapter and the real Client SDK against
 * disposable external Git fixtures. The evidence mechanism is snapshot
 * comparison: `snapshotProjectState` records the fixture root itself (under
 * the stable path ".") plus every reachable path with exact permission modes,
 * file SHA-256 content digests, and symlink targets, `.git` and `.changekernel`
 * included, and the tests require composition and bounded authenticated reads
 * to leave that recorded state unchanged. Symlinks are never followed.
 *
 * What these snapshots measure is the final filesystem state observed at
 * snapshot time. They are test evidence, not physical sandbox custody, and
 * they cannot prove that no transient create/delete happened between two
 * snapshots. Timestamps are ignored by design; ownership (uid/gid) and
 * extended attributes are not observed and no claim is made about them.
 * Unsupported filesystem node kinds fail the observation instead of collapsing
 * into an indistinguishable generic entry. Inspection uses the filesystem
 * directly and never runs Git commands that can refresh the index.
 *
 * Every Git command the harness itself runs goes through one hardened helper
 * (`fixtureGit`): an explicit working directory, inherited GIT_* environment
 * overrides scrubbed, global/system Git configuration files ignored, and
 * hooks, commit signing, and automatic garbage collection disabled; fixture
 * repositories pin the sha1 object format at init time instead of relying on
 * ambient Git defaults. Nothing here alters this checkout's or the user's Git
 * configuration.
 */

const execFileAsync = promisify(execFile);
const sourceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const WIKI_ITEMS_SOURCE = join(sourceRoot, ".changekernel", "wiki", "items");
const EXPIRES_AT = "2036-01-01T00:00:00Z";

/**
 * The single hardened entry point for every Git command the harness runs
 * against a fixture: an explicit cwd, every inherited GIT_* environment
 * override scrubbed (GIT_DIR, GIT_WORK_TREE, GIT_CONFIG_*, GIT_EDITOR, ...),
 * global/system Git configuration files ignored, and controlled in-process
 * settings disabling hooks, commit signing, and automatic garbage collection.
 * The normal process environment (PATH and the like) is preserved. This helper
 * never changes this checkout's or the user's Git configuration.
 */
async function fixtureGit(root, args) {
	/** @type {Record<string, string>} */
	const env = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined && !key.startsWith("GIT_")) env[key] = value;
	}
	env.GIT_CONFIG_GLOBAL = "/dev/null";
	env.GIT_CONFIG_SYSTEM = "/dev/null";
	return execFileAsync(
		"git",
		["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "-c", "gc.auto=0", ...args],
		{cwd: root, env},
	);
}

/**
 * Initializes a disposable Git fixture repository. The object format is pinned
 * to sha1 at init time so ambient Git defaults cannot change fixture identity,
 * and the branch is pinned to main because the composition's canonical ref is
 * refs/heads/main.
 */
async function initFixtureRepo(root) {
	await fixtureGit(root, ["init", "-q", "-b", "main", "--object-format=sha1"]);
	await fixtureGit(root, ["config", "user.email", "purity@test"]);
	await fixtureGit(root, ["config", "user.name", "Purity Test"]);
}

async function makeGitRoot(label) {
	const root = await mkdtemp(join(tmpdir(), `codewiki-purity-${label}-`));
	await initFixtureRepo(root);
	return root;
}

/**
 * Commits fixture state through the hardened fixture Git helper. `--no-verify`
 * alone does not disable post-commit hooks; the real protection is the
 * helper's `core.hooksPath` override, with `--no-verify` retained as ordinary
 * defense in depth for pre-commit-style hooks.
 */
async function commitFixture(root, message) {
	await fixtureGit(root, [
		"commit",
		"--allow-empty",
		"-q",
		"--no-verify",
		"-m",
		message,
	]);
}

/**
 * Records the root directory itself under the stable path "." plus every
 * reachable child path, with permission modes, file SHA-256 content digests,
 * and symlink targets. Symlinks are never followed: they are recorded as leaf
 * entries and their targets are not walked. Unsupported node kinds (FIFOs,
 * sockets, devices, and anything unrecognized) fail the observation with an
 * error instead of collapsing into an indistinguishable generic entry. No Git
 * commands are used, so inspection cannot refresh the index.
 */
async function snapshotProjectState(root) {
	const entries = new Map();
	const rootStats = await lstat(root);
	if (!rootStats.isDirectory()) {
		throw new Error(
			`snapshotProjectState requires a directory root, found ${describeNodeKind(rootStats)} at ${root}`,
		);
	}
	entries.set(".", {kind: "directory", mode: rootStats.mode & 0o7777});
	await walk(root, "");
	return entries;

	async function walk(directory, prefix) {
		const dirents = await readdir(directory, {withFileTypes: true});
		dirents.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
		for (const dirent of dirents) {
			const relative = prefix + dirent.name;
			const absolute = join(directory, dirent.name);
			const stats = await lstat(absolute);
			const mode = stats.mode & 0o7777;
			if (stats.isSymbolicLink()) {
				entries.set(relative, {kind: "symlink", mode, target: await readlink(absolute)});
				continue;
			}
			if (stats.isDirectory()) {
				entries.set(relative, {kind: "directory", mode});
				await walk(absolute, `${relative}/`);
				continue;
			}
			if (stats.isFile()) {
				const bytes = await readFile(absolute);
				entries.set(relative, {
					kind: "file",
					mode,
					digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
				});
				continue;
			}
			throw new Error(`unsupported filesystem node kind: ${describeNodeKind(stats)} at ${relative}`);
		}
	}
}

/**
 * Names the filesystem node kind of an lstat result. Used only to make
 * observation failures precise; classification itself stays inside
 * snapshotProjectState.
 */
function describeNodeKind(stats) {
	if (stats.isFile()) return "file";
	if (stats.isDirectory()) return "directory";
	if (stats.isSymbolicLink()) return "symlink";
	if (stats.isFIFO()) return "fifo";
	if (stats.isSocket()) return "socket";
	if (stats.isCharacterDevice()) return "character device";
	if (stats.isBlockDevice()) return "block device";
	return "unknown kind";
}

async function pathExists(path) {
	try {
		await lstat(path);
		return true;
	} catch (error) {
		if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return false;
		throw error;
	}
}

function describeMode(mode) {
	return `0${mode.toString(8)}`;
}

function describeEntry(entry) {
	const parts = [entry.kind, `mode=${describeMode(entry.mode)}`];
	if (entry.kind === "file") parts.push(`digest=${entry.digest}`);
	if (entry.kind === "symlink") parts.push(`target=${entry.target}`);
	return parts.join(" ");
}

function diffProjectState(before, after) {
	const paths = new Set([...before.keys(), ...after.keys()]);
	const changes = [];
	for (const path of [...paths].sort()) {
		const beforeEntry = before.get(path);
		const afterEntry = after.get(path);
		if (beforeEntry === undefined) {
			changes.push(`added ${path} (${describeEntry(afterEntry)})`);
			continue;
		}
		if (afterEntry === undefined) {
			changes.push(`removed ${path} (${describeEntry(beforeEntry)})`);
			continue;
		}
		if (beforeEntry.kind !== afterEntry.kind) {
			changes.push(`kind changed ${path}: ${beforeEntry.kind} -> ${afterEntry.kind}`);
			continue;
		}
		if (beforeEntry.mode !== afterEntry.mode) {
			changes.push(`mode changed ${path}: ${describeMode(beforeEntry.mode)} -> ${describeMode(afterEntry.mode)}`);
		}
		if (beforeEntry.kind === "file" && beforeEntry.digest !== afterEntry.digest) {
			changes.push(`bytes changed ${path}: ${beforeEntry.digest} -> ${afterEntry.digest}`);
		}
		if (beforeEntry.kind === "symlink" && beforeEntry.target !== afterEntry.target) {
			changes.push(`symlink target changed ${path}: ${beforeEntry.target} -> ${afterEntry.target}`);
		}
	}
	return changes;
}

function assertProjectUnchanged(before, after, stage) {
	const changes = diffProjectState(before, after);
	assert.deepEqual(
		changes,
		[],
		`${stage} must not mutate project filesystem state. Observed changes:\n${changes.join("\n")}`,
	);
}

function assertTypedOutcome(outcome, stage) {
	assert.ok(typeof outcome === "object" && outcome !== null, `${stage} must return an outcome value.`);
	assert.equal(typeof outcome.ok, "boolean", `${stage} must return a typed outcome with a boolean ok.`);
	if (!outcome.ok) {
		assert.ok(typeof outcome.error === "object" && outcome.error !== null, `${stage} failure must carry an error value.`);
		assert.equal(typeof outcome.error.code, "string", `${stage} failure must carry an error code.`);
		assert.ok(outcome.error.code.length > 0, `${stage} failure error code must not be empty.`);
		assert.equal(typeof outcome.error.message, "string", `${stage} failure must carry an error message.`);
		assert.ok(outcome.error.message.length > 0, `${stage} failure error message must not be empty.`);
	}
}

function clientFor(local) {
	const client = createChangeKernelClient({
		repositoryId: local.repositoryId,
		transport: {send: (request) => local.server.handle(request)},
		client: {kind: "cli", instanceId: "cw:client:local-purity-test"},
		authentication: {identityRef: "cw:identity:local-console", proof: `local-console:${local.repositoryId}`},
	});
	assert.equal(client.ok, true, "Client SDK construction over the local composition must succeed.");
	return client.value;
}

function requestIds() {
	let counter = 0;
	return () => `cw:request:purity-${counter += 1}`;
}

/** Available discovery succeeds; unimplemented projections must fail without writes. */
async function assertBoundedReadsSucceed(client) {
	const nextRequestId = requestIds();
	const source = {kind: "canonical"};

	const discover = await client.discover({requestId: nextRequestId(), expiresAt: EXPIRES_AT});
	assert.equal(discover.ok, true, discover.ok ? "" : discover.error.message);

	const capabilities = await client.capabilities({requestId: nextRequestId(), expiresAt: EXPIRES_AT});
	assert.equal(capabilities.ok, true, capabilities.ok ? "" : capabilities.error.message);

	const status = await client.status({requestId: nextRequestId(), expiresAt: EXPIRES_AT, source});
	assert.equal(status.ok, false);
	assert.equal(status.error.code, "unavailable");

	const wikiList = await client.wiki({
		requestId: nextRequestId(),
		expiresAt: EXPIRES_AT,
		source,
		view: "list",
		limit: 10,
		cursor: null,
	});
	assert.equal(wikiList.ok, false);
	assert.equal(wikiList.error.code, "unavailable");
	const itemId = "cw:item:source-history";

	const wikiGet = await client.wiki({requestId: nextRequestId(), expiresAt: EXPIRES_AT, source, view: "get", itemId});
	assert.equal(wikiGet.ok, false);
	assert.equal(wikiGet.error.code, "unavailable");

	const changes = await client.changes({
		requestId: nextRequestId(),
		expiresAt: EXPIRES_AT,
		source,
		view: "list",
		limit: 10,
		cursor: null,
	});
	assert.equal(changes.ok, false);
	assert.equal(changes.error.code, "unavailable");

	const gates = await client.checks({
		requestId: nextRequestId(),
		expiresAt: EXPIRES_AT,
		source,
		view: "gates",
		changeId: null,
		limit: 10,
		cursor: null,
	});
	assert.equal(gates.ok, false);
	assert.equal(gates.error.code, "unavailable");

	const results = await client.checks({
		requestId: nextRequestId(),
		expiresAt: EXPIRES_AT,
		source,
		view: "results",
		changeId: null,
		limit: 10,
		cursor: null,
	});
	assert.equal(results.ok, false);
	assert.equal(results.error.code, "unavailable");

	const work = await client.work({requestId: nextRequestId(), expiresAt: EXPIRES_AT, source, changeId: null, limit: 10, cursor: null});
	assert.equal(work.ok, false);
	assert.equal(work.error.code, "unavailable");

	const alignment = await client.alignment({
		requestId: nextRequestId(),
		expiresAt: EXPIRES_AT,
		source,
		changeId: null,
		limit: 10,
		cursor: null,
	});
	assert.equal(alignment.ok, false);
	assert.equal(alignment.error.code, "unavailable");

	const audit = await client.audit({requestId: nextRequestId(), expiresAt: EXPIRES_AT, source, view: "source"});
	assert.equal(audit.ok, false);
	assert.equal(audit.error.code, "unavailable");
}

/**
 * Bounded reads over degraded state: every call must return a typed outcome
 * without throwing and without any presumed readiness or success.
 */
async function assertBoundedReadsTyped(client) {
	const nextRequestId = requestIds();
	const source = {kind: "canonical"};
	const calls = [
		["discover", await client.discover({requestId: nextRequestId(), expiresAt: EXPIRES_AT})],
		["status", await client.status({requestId: nextRequestId(), expiresAt: EXPIRES_AT, source})],
		["wiki list", await client.wiki({requestId: nextRequestId(), expiresAt: EXPIRES_AT, source, view: "list", limit: 10, cursor: null})],
		["changes list", await client.changes({requestId: nextRequestId(), expiresAt: EXPIRES_AT, source, view: "list", limit: 10, cursor: null})],
		["checks gates", await client.checks({requestId: nextRequestId(), expiresAt: EXPIRES_AT, source, view: "gates", changeId: null, limit: 10, cursor: null})],
		["work", await client.work({requestId: nextRequestId(), expiresAt: EXPIRES_AT, source, changeId: null, limit: 10, cursor: null})],
	];
	for (const [name, outcome] of calls) {
		assertTypedOutcome(outcome, `degraded ${name} read`);
	}
}

test("snapshot inspection is deterministic, records the root, never follows symlinks, and detects lock files, byte changes, mode changes, and root mode changes", async () => {
	const root = await makeGitRoot("negative-control");
	try {
		await commitFixture(root, "git-only root");
		await mkdir(join(root, ".changekernel", "wiki", "items"), {recursive: true});
		await writeFile(join(root, ".changekernel", "config.json"), '{"project":"Negative Control"}\n', {mode: 0o600});
		await writeFile(join(root, ".changekernel", "wiki", "items", "story.md"), "story bytes\n", {mode: 0o644});
		await symlink("objects", join(root, ".git", "objects-view"));

		const before = await snapshotProjectState(root);
		const repeated = await snapshotProjectState(root);
		assert.deepEqual(
			diffProjectState(before, repeated),
			[],
			"repeated snapshots without any mutation must be identical",
		);

		// The root itself is recorded under the stable path "." so that root
		// metadata is part of the compared state.
		const rootEntry = before.get(".");
		assert.ok(rootEntry !== undefined, "the snapshot must record the fixture root itself under the stable path '.'");
		assert.deepEqual(
			rootEntry,
			{kind: "directory", mode: 0o700},
			"the root entry must record its lstat kind and mode (mkdtemp roots are 0700)",
		);

		const symlinkEntry = before.get(".git/objects-view");
		assert.ok(symlinkEntry !== undefined, "the fixture symlink must be recorded");
		assert.equal(symlinkEntry.kind, "symlink");
		assert.equal(symlinkEntry.target, "objects");
		assert.ok(
			![...before.keys()].some((path) => path.startsWith(".git/objects-view/")),
			"inspection must not follow symlinks into their targets",
		);
		assert.ok(before.get(".git/objects"), "the symlink target directory must only appear once under its real path");

		// Negative control: the harness must observe a new Git lock file,
		// existing-file byte changes, and existing-file mode changes.
		await writeFile(join(root, ".git", "index.lock"), "temporary git lock\n", {mode: 0o600});
		const changedBytes = await readFile(join(root, ".changekernel", "config.json"), "utf8");
		await writeFile(join(root, ".changekernel", "config.json"), `${changedBytes}mutated\n`);
		await chmod(join(root, ".changekernel", "wiki", "items", "story.md"), 0o755);
		await rm(join(root, ".git", "objects-view"));
		await symlink("refs", join(root, ".git", "objects-view"));

		const after = await snapshotProjectState(root);
		const changes = diffProjectState(before, after);
		assert.ok(
			changes.some((change) => change.startsWith("added .git/index.lock ")),
			`the snapshot comparison must detect the new .git lock file, got:\n${changes.join("\n")}`,
		);
		assert.ok(
			changes.some((change) => change.startsWith("bytes changed .changekernel/config.json: ")),
			`the snapshot comparison must detect existing-file byte changes, got:\n${changes.join("\n")}`,
		);
		assert.ok(
			changes.some((change) => change.startsWith("mode changed .changekernel/wiki/items/story.md: ")),
			`the snapshot comparison must detect existing-file mode changes, got:\n${changes.join("\n")}`,
		);
		assert.ok(
			changes.some((change) => change.startsWith("symlink target changed .git/objects-view: objects -> refs")),
			`the snapshot comparison must detect symlink target changes, got:\n${changes.join("\n")}`,
		);

		// Negative control for the first review's root blind spot: the root's
		// own mode mutation (0700 -> 0710) must be detected.
		await chmod(root, 0o710);
		const afterRootMode = await snapshotProjectState(root);
		assert.deepEqual(
			diffProjectState(after, afterRootMode),
			["mode changed .: 0700 -> 0710"],
			"the snapshot comparison must detect root permission-mode mutations",
		);
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("snapshot inspection rejects unsupported filesystem node kinds instead of a generic entry", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-purity-unsupported-"));
	try {
		// A FIFO is a node kind the snapshot cannot faithfully record; the
		// observation must fail loudly rather than collapse it into an
		// indistinguishable generic entry.
		await execFileAsync("mkfifo", [join(root, "fifo-probe")]);
		await assert.rejects(
			() => snapshotProjectState(root),
			/unsupported filesystem node kind: fifo at fifo-probe/u,
			"observation must fail on a filesystem node kind it cannot record",
		);
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("the hardened fixture Git helper never runs configured hooks", async () => {
	const controlRoot = await mkdtemp(join(tmpdir(), "codewiki-purity-hook-control-"));
	try {
		const root = join(controlRoot, "repo");
		await mkdir(root);
		await initFixtureRepo(root);

		// A harmless disposable post-commit hook that only records its own
		// execution. `--no-verify` does not disable post-commit hooks, so this
		// hook would run through an insufficiently hardened commit helper.
		const marker = join(controlRoot, "hook-ran-marker");
		const hookPath = join(root, ".git", "hooks", "post-commit");
		const hook = [
			"#!/bin/sh",
			`printf '%s\\n' 'fixture post-commit hook ran' >> ${JSON.stringify(marker)}`,
			"",
		].join("\n");
		await writeFile(hookPath, hook, {mode: 0o755});

		// Sensitivity: the probe itself is a valid executable script whose
		// effect is observable, so a missing marker means the hook was not
		// invoked, not that the probe is inert.
		await execFileAsync("sh", [hookPath]);
		assert.equal(await pathExists(marker), true, "the control hook must be executable and its effect observable");
		await rm(marker);

		await commitFixture(root, "hook negative control");
		assert.equal(
			await pathExists(marker),
			false,
			"the hardened fixture commit helper must not run configured hooks",
		);
	} finally {
		await rm(controlRoot, {recursive: true, force: true});
	}
});

test("composition and bounded reads leave an explicitly bootstrapped, committed project unchanged", async () => {
	const root = await makeGitRoot("initialized");
	try {
		// Fixture setup: explicit bootstrap and legitimate committed semantic state.
		const boot = await bootstrapChangeKernelProject({projectRoot: root, project: "Purity Fixture"});
		assert.equal(boot.ok, true, boot.ok ? "" : boot.error.message);
		await cp(WIKI_ITEMS_SOURCE, join(root, ".changekernel", "wiki", "items"), {recursive: true});
		await fixtureGit(root, ["add", ".changekernel"]);
		await commitFixture(root, "bootstrap ChangeKernel");

		const before = await snapshotProjectState(root);
		assert.ok(before.get(".git/refs/heads/main"), "the fixture must have a committed canonical ref");
		assert.ok(before.get(".changekernel/config.json"), "the fixture must have committed ChangeKernel state");

		const composed = await createLocalProjectServer({projectRoot: root, projectName: "Purity Fixture"});
		assertTypedOutcome(composed, "initialized composition");
		assert.equal(composed.ok, true, composed.ok ? "" : composed.error.message);
		assert.equal(composed.value.objectFormat, "sha1");
		assert.match(composed.value.repositoryId, /^cw:repository:local-[0-9a-f]{16}$/u);

		const afterCompose = await snapshotProjectState(root);
		assertProjectUnchanged(before, afterCompose, "composition of an initialized project");

		const client = clientFor(composed.value);
		await assertBoundedReadsSucceed(client);

		const afterReads = await snapshotProjectState(root);
		assertProjectUnchanged(before, afterReads, "bounded authenticated reads");
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("composition over a Git-only root without .changekernel is typed and writes nothing", async () => {
	const root = await makeGitRoot("bare-git");
	try {
		await commitFixture(root, "git-only root");
		const before = await snapshotProjectState(root);
		assert.equal(before.has(".changekernel"), false, "the fixture must not contain ChangeKernel state before composition");

		const composed = await createLocalProjectServer({projectRoot: root, projectName: "Purity Bare"});
		assertTypedOutcome(composed, "composition over a Git-only root");

		const afterCompose = await snapshotProjectState(root);
		assertProjectUnchanged(before, afterCompose, "composition over a Git-only root");

		if (composed.ok) {
			const client = clientFor(composed.value);
			await assertBoundedReadsTyped(client);
			const afterReads = await snapshotProjectState(root);
			assertProjectUnchanged(before, afterReads, "bounded reads after composition of a Git-only root");
		}
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("composition and reads over committed partial semantic state stay typed and write nothing", async () => {
	const root = await makeGitRoot("partial");
	try {
		// Partial state: a committed config but no Wiki or Change roots at all.
		await mkdir(join(root, ".changekernel"), {recursive: true});
		await writeFile(
			join(root, ".changekernel", "config.json"),
			'{"protocolId":"codewiki.project-config","protocolVersion":"2.0.0","project":"Partial Fixture","wikiRoot":".changekernel/wiki","changeRoot":".changekernel/changes","worktreeIsolation":"none"}\n',
			{mode: 0o600},
		);
		await fixtureGit(root, ["add", ".changekernel"]);
		await commitFixture(root, "partial ChangeKernel state");

		const before = await snapshotProjectState(root);
		const composed = await createLocalProjectServer({projectRoot: root, projectName: "Partial Fixture"});
		assertTypedOutcome(composed, "composition over partial semantic state");

		const afterCompose = await snapshotProjectState(root);
		assertProjectUnchanged(before, afterCompose, "composition over partial semantic state");

		if (composed.ok) {
			const client = clientFor(composed.value);
			await assertBoundedReadsTyped(client);
			const afterReads = await snapshotProjectState(root);
			assertProjectUnchanged(before, afterReads, "bounded reads over partial semantic state");
		}
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("composition and reads over committed malformed semantic state stay typed and write nothing", async () => {
	const root = await makeGitRoot("malformed");
	try {
		// Malformed state: committed roots that contain undecodable bytes.
		await mkdir(join(root, ".changekernel", "wiki", "items"), {recursive: true});
		await mkdir(join(root, ".changekernel", "changes"), {recursive: true});
		await writeFile(join(root, ".changekernel", "config.json"), '{"project":"Malformed Fixture"}\n', {mode: 0o600});
		await writeFile(join(root, ".changekernel", "wiki", "items", "broken.md"), "\u0000\u0001garbage bytes\n");
		await writeFile(join(root, ".changekernel", "changes", "CHG-d2malformed.jsonl"), "not a trace header\n");
		await fixtureGit(root, ["add", ".changekernel"]);
		await commitFixture(root, "malformed ChangeKernel state");

		const before = await snapshotProjectState(root);
		const composed = await createLocalProjectServer({projectRoot: root, projectName: "Malformed Fixture"});
		assertTypedOutcome(composed, "composition over malformed semantic state");

		const afterCompose = await snapshotProjectState(root);
		assertProjectUnchanged(before, afterCompose, "composition over malformed semantic state");

		if (composed.ok) {
			const client = clientFor(composed.value);
			await assertBoundedReadsTyped(client);
			const afterReads = await snapshotProjectState(root);
			assertProjectUnchanged(before, afterReads, "bounded reads over malformed semantic state");
		}
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});
