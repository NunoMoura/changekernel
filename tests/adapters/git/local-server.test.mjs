import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {promisify} from "node:util";
import test from "node:test";

import {createChangeKernelClient} from "../../../src/api/client/index.ts";
import {bootstrapChangeKernelProject} from "../../../src/adapters/git/bootstrap.ts";
import {createLocalProjectServer} from "../../../src/adapters/git/local-server.ts";
import {gitOid} from "../../../src/kernel/identity/git.ts";

const execFileAsync = promisify(execFile);
const sourceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const WIKI_ITEMS_SOURCE = join(sourceRoot, ".changekernel", "wiki", "items");
const EXPIRES_AT = "2036-01-01T00:00:00Z";

/**
 * The single hardened entry point for every Git command this fixture runs,
 * mirroring the accepted local-read-purity harness contract: an explicit cwd,
 * inherited GIT_* environment overrides scrubbed, global/system Git
 * configuration ignored, and hooks, commit signing, and automatic garbage
 * collection disabled. Fixture repositories pin the sha1 object format and
 * the main branch at init time instead of relying on ambient Git defaults.
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

async function makeGitProject(label) {
	const root = await mkdtemp(join(tmpdir(), `codewiki-local-${label}-`));
	await fixtureGit(root, ["init", "-q", "-b", "main", "--object-format=sha1"]);
	await fixtureGit(root, ["config", "user.email", "console@test"]);
	await fixtureGit(root, ["config", "user.name", "Console Test"]);
	return root;
}

/**
 * Explicit initialization: fixtures bootstrap ChangeKernel state during setup,
 * before composition. Composition itself never bootstraps.
 */
async function bootstrapFixture(root, project) {
	const boot = await bootstrapChangeKernelProject({projectRoot: root, project});
	assert.equal(boot.ok, true, boot.ok ? "" : boot.error.message);
}

async function commitChangeKernel(root) {
	await cp(WIKI_ITEMS_SOURCE, join(root, ".changekernel", "wiki", "items"), {recursive: true});
	await fixtureGit(root, ["add", ".changekernel"]);
	await fixtureGit(root, ["commit", "-q", "--no-verify", "--allow-empty", "-m", "bootstrap ChangeKernel"]);
}

async function commitFixture(root, message) {
	await fixtureGit(root, ["commit", "-q", "--no-verify", "--allow-empty", "-m", message]);
}

async function headOid(root) {
	const {stdout} = await fixtureGit(root, ["rev-parse", "HEAD"]);
	const oid = gitOid("sha1", stdout.trim());
	assert.equal(oid.ok, true, oid.ok ? "" : oid.error.message);
	return oid.value;
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

async function sortedEntries(root) {
	return [...await readdir(root)].sort();
}

function assertTypedOutcome(outcome, stage) {
	assert.ok(typeof outcome === "object" && outcome !== null, `${stage} must return an outcome value.`);
	assert.equal(typeof outcome.ok, "boolean", `${stage} must return a typed outcome with a boolean ok.`);
	if (!outcome.ok) {
		assert.ok(typeof outcome.error === "object" && outcome.error !== null, `${stage} failure must carry an error value.`);
		assert.equal(typeof outcome.error.code, "string", `${stage} failure must carry an error code.`);
	}
}

function clientFor(local) {
	return createChangeKernelClient({
		repositoryId: local.repositoryId,
		transport: {send: (request) => local.server.handle(request)},
		client: {kind: "cli", instanceId: "cw:client:local-test"},
		authentication: {identityRef: "cw:identity:local-console", proof: `local-console:${local.repositoryId}`},
	}).value;
}

test("local composition binds and serves real reads over explicitly bootstrapped state", async () => {
	const root = await makeGitProject("bind");
	try {
		await bootstrapFixture(root, "Local Test");
		await commitChangeKernel(root);
		const composed = await createLocalProjectServer({projectRoot: root, projectName: "Local Test"});
		assert.equal(composed.ok, true, composed.ok ? "" : composed.error.message);
		assert.equal(composed.value.objectFormat, "sha1");
		assert.match(composed.value.repositoryId, /^cw:repository:local-[0-9a-f]{16}$/u);

		const client = clientFor(composed.value);
		const discover = await client.discover({requestId: "cw:request:d1", expiresAt: EXPIRES_AT});
		assert.equal(discover.ok, true, discover.ok ? "" : discover.error.message);
		assert.equal(discover.value.project, "Local Test");
		assert.equal(discover.value.status, "available");

		const status = await client.status({requestId: "cw:request:s1", expiresAt: EXPIRES_AT, source: {kind: "canonical"}});
		assert.equal(status.ok, false);
		assert.equal(status.error.code, "unavailable");
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("local composition is idempotent and denies a well-formed lifecycle mutation with authorization_denied", async () => {
	const root = await makeGitProject("idem");
	try {
		await bootstrapFixture(root, "Idem");
		await commitChangeKernel(root);
		const first = await createLocalProjectServer({projectRoot: root, projectName: "Idem"});
		assert.equal(first.ok, true, first.ok ? "" : first.error.message);
		const second = await createLocalProjectServer({projectRoot: root, projectName: "Idem"});
		assert.equal(second.ok, true, second.ok ? "" : second.error.message);
		assert.equal(first.value.repositoryId, second.value.repositoryId);

		// A contract-valid proposal reusing the existing lifecycle fixture
		// shape: refusal must come from authorization, not from request shape.
		const projectHead = await headOid(root);
		const path = ".changekernel/wiki/items/system/components/project-server.md";
		const content = await readFile(join(root, path), "utf8");
		const client = clientFor(first.value);
		const denied = await client.proposeChanges({
			requestId: "cw:request:p1",
			expiresAt: EXPIRES_AT,
			commandId: "cw:command:local-readonly",
			expectedProjectHead: projectHead,
			proposals: [{
				proposalKey: "readonly-probe",
				changeType: "correction",
				realization: "wiki-only",
				intent: "Probe that the local read-only composition refuses lifecycle mutations.",
				rationale: "Authorization must deny this well-formed proposal; request-shape rejection is not authorization.",
				acceptance: ["The proposal is denied without changing Project state."],
				targets: [{itemId: "cw:component:project-server", facets: ["body"]}],
				relationships: [],
				contributorRefs: ["cw:actor:local-console"],
				producerRunRefs: ["cw:run:local-readonly-probe"],
				wiki: {upserts: [{path, content: `${content.trimEnd()}\n\nA denied proposal changes no state.\n`}], deletes: []},
			}],
		});
		assert.equal(denied.ok, false, "read-only grants must not authorize proposals");
		assert.equal(
			denied.error.code,
			"authorization_denied",
			"a well-formed mutation must be refused by authorization, not by request validation",
		);
		assert.equal((await headOid(root)).hex, projectHead.hex, "a denied mutation must leave the canonical head unchanged");
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("local composition binds a Git-only root without creating semantic state", async () => {
	const root = await makeGitProject("git-only");
	try {
		await commitFixture(root, "git-only root");
		const before = await sortedEntries(root);
		const composed = await createLocalProjectServer({projectRoot: root, projectName: "Git Only"});
		assert.equal(composed.ok, true, composed.ok ? "" : composed.error.message);
		assert.equal(before.includes(".changekernel"), false, "the fixture must be a Git-only root");
		assert.deepEqual(await sortedEntries(root), before, "composition must not create semantic state in a Git-only root");

		const client = clientFor(composed.value);
		const discover = await client.discover({requestId: "cw:request:g1", expiresAt: EXPIRES_AT});
		assert.equal(discover.ok, true, discover.ok ? "" : discover.error.message);
		// Binding availability is not semantic readiness: the canonical read
		// keeps its existing exact-source validation, so only its typed shape
		// is asserted here, not readiness or success.
		const status = await client.status({requestId: "cw:request:g2", expiresAt: EXPIRES_AT, source: {kind: "canonical"}});
		assertTypedOutcome(status, "canonical read over a Git-only root");
		assert.deepEqual(await sortedEntries(root), before, "bounded reads must not create semantic state");
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("local composition requires an existing project root", async () => {
	const holder = await mkdtemp(join(tmpdir(), "codewiki-local-missing-"));
	await rm(holder, {recursive: true, force: true});
	const composed = await createLocalProjectServer({projectRoot: holder});
	assert.equal(composed.ok, false);
	assert.equal(composed.error.code, "invalid_project_root");
	assert.equal(await pathExists(holder), false, "a rejected composition must not create the missing root");
});

test("local composition rejects non-Git and nested roots without their own .git, writing nothing", async () => {
	const nonGit = await mkdtemp(join(tmpdir(), "codewiki-local-nogit-"));
	const outer = await makeGitProject("outer");
	try {
		const before = await sortedEntries(nonGit);
		const composed = await createLocalProjectServer({projectRoot: nonGit});
		assert.equal(composed.ok, false);
		assert.equal(composed.error.code, "invalid_project_root");
		assert.deepEqual(await sortedEntries(nonGit), before, "rejection must not bootstrap Git or ChangeKernel state");

		const nested = join(outer, "nested");
		await mkdir(nested);
		const nestedBefore = await sortedEntries(nested);
		const nestedComposed = await createLocalProjectServer({projectRoot: nested});
		assert.equal(nestedComposed.ok, false);
		assert.equal(nestedComposed.error.code, "invalid_project_root");
		assert.deepEqual(
			await sortedEntries(nested),
			nestedBefore,
			"a nested path must not fall through to ancestor discovery or gain state",
		);
	} finally {
		await rm(nonGit, {recursive: true, force: true});
		await rm(outer, {recursive: true, force: true});
	}
});

test("local composition rejects symbolic roots and symbolic Git state without writing through them", async () => {
	const target = await makeGitProject("symlink-target");
	await commitFixture(target, "symbolic target root");
	const holder = await mkdtemp(join(tmpdir(), "codewiki-local-link-"));
	try {
		const targetBefore = await sortedEntries(target);

		const rootLink = join(holder, "root-link");
		await symlink(target, rootLink);
		const viaLink = await createLocalProjectServer({projectRoot: rootLink});
		assert.equal(viaLink.ok, false);
		assert.equal(viaLink.error.code, "invalid_project_root");

		const gitLinkRoot = join(holder, "git-state-link");
		await mkdir(gitLinkRoot);
		await symlink(join(target, ".git"), join(gitLinkRoot, ".git"));
		const viaGitLink = await createLocalProjectServer({projectRoot: gitLinkRoot});
		assert.equal(viaGitLink.ok, false);
		assert.equal(viaGitLink.error.code, "invalid_project_root");

		assert.deepEqual(await sortedEntries(target), targetBefore, "symbolic rejection must not write through the link target");
	} finally {
		await rm(holder, {recursive: true, force: true});
		await rm(target, {recursive: true, force: true});
	}
});

test("local composition rejects an unsupported .git kind without writing", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-local-fifo-"));
	try {
		await execFileAsync("mkfifo", [join(root, ".git")]);
		const before = await sortedEntries(root);
		const composed = await createLocalProjectServer({projectRoot: root});
		assert.equal(composed.ok, false);
		assert.equal(composed.error.code, "invalid_project_root");
		assert.deepEqual(await sortedEntries(root), before, "rejection must not remove or replace the unsupported Git state entry");
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});
