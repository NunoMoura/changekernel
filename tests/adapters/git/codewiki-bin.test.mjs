import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {cp, mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename, join} from "node:path";
import {fileURLToPath} from "node:url";
import {promisify} from "node:util";
import test from "node:test";

import {bootstrapCodewikiProject} from "../../../src/adapters/git/bootstrap.ts";

const sourceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const bin = join(sourceRoot, "bin", "codewiki.mjs");
const execFileAsync = (file, args, opts) => new Promise((resolvePromise) => {
	execFile(file, args, opts, (error, stdout, stderr) => {
		resolvePromise({code: error?.code ?? (error ? 1 : 0), stdout, stderr});
	});
});

const runGit = promisify(execFile);

/**
 * Hardened fixture Git, mirroring the accepted local-read-purity harness
 * contract: an explicit cwd, inherited GIT_* environment overrides scrubbed,
 * global/system Git configuration ignored, hooks and commit signing disabled,
 * and the sha1 object format and main branch pinned at init time.
 */
async function fixtureGit(root, args) {
	/** @type {Record<string, string>} */
	const env = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined && !key.startsWith("GIT_")) env[key] = value;
	}
	env.GIT_CONFIG_GLOBAL = "/dev/null";
	env.GIT_CONFIG_SYSTEM = "/dev/null";
	return runGit("git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "-c", "gc.auto=0", ...args], {cwd: root, env});
}

async function makeGovernedProject(label) {
	const root = await mkdtemp(join(tmpdir(), `codewiki-bin-${label}-`));
	await fixtureGit(root, ["init", "-q", "-b", "main", "--object-format=sha1"]);
	await fixtureGit(root, ["config", "user.email", "console@test"]);
	await fixtureGit(root, ["config", "user.name", "Console Test"]);
	// Explicit initialization during fixture setup: the bin composition itself
	// never bootstraps, so committed semantic state must exist before invocation.
	const boot = await bootstrapCodewikiProject({projectRoot: root, project: basename(root)});
	assert.equal(boot.ok, true, boot.ok ? "" : boot.error.message);
	await cp(join(sourceRoot, ".codewiki", "wiki", "items"), join(root, ".codewiki", "wiki", "items"), {recursive: true});
	await fixtureGit(root, ["add", ".codewiki"]);
	await fixtureGit(root, ["commit", "-q", "--no-verify", "--allow-empty", "-m", "bootstrap CodeWiki"]);
	return root;
}

test("codewiki status answers the five questions in plain language", async () => {
	const root = await makeGovernedProject("status");
	try {
		const out = await execFileAsync(process.execPath, [bin, "status", root]);
		assert.equal(out.code, 0);
		assert.match(out.stdout, /codewiki-bin-status-\S+ — Ready/u);
		assert.match(out.stdout, /Changes: 0\s+Work: 0/u);
		assert.match(out.stdout, /Needs you: nothing — all clear/u);
		assert.match(out.stdout, /read-only/u);
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("codewiki changes reports an empty project without fabricating state", async () => {
	const root = await makeGovernedProject("changes");
	try {
		const out = await execFileAsync(process.execPath, [bin, "changes", root]);
		assert.equal(out.code, 1);
		assert.match(out.stdout, /No Changes in codewiki-bin-changes-\S* yet/u);
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("codewiki fails closed with exit code 2 on a non-project root", async () => {
	const empty = await mkdtemp(join(tmpdir(), "codewiki-bin-empty-"));
	try {
		const out = await execFileAsync(process.execPath, [bin, "status", empty]);
		assert.equal(out.code, 2);
		assert.match(out.stderr, /codewiki:/u);
	} finally {
		await rm(empty, {recursive: true, force: true});
	}
});

test("codewiki rejects unknown verbs with usage", async () => {
	const root = await makeGovernedProject("usage");
	try {
		const out = await execFileAsync(process.execPath, [bin, "frobnicate", root]);
		assert.equal(out.code, 2);
		assert.match(out.stderr, /unknown verb/u);
		assert.match(out.stderr, /Usage:/u);
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});
