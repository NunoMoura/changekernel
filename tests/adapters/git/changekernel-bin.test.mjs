import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {cp, mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename, join} from "node:path";
import {fileURLToPath} from "node:url";
import {promisify} from "node:util";
import test from "node:test";

import {bootstrapChangeKernelProject} from "../../../src/adapters/git/bootstrap.ts";

const sourceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const bin = join(sourceRoot, "bin", "changekernel.mjs");
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
	const root = await mkdtemp(join(tmpdir(), `changekernel-bin-${label}-`));
	await fixtureGit(root, ["init", "-q", "-b", "main", "--object-format=sha1"]);
	await fixtureGit(root, ["config", "user.email", "console@test"]);
	await fixtureGit(root, ["config", "user.name", "Console Test"]);
	// Explicit initialization during fixture setup: the bin composition itself
	// never bootstraps, so committed semantic state must exist before invocation.
	const boot = await bootstrapChangeKernelProject({projectRoot: root, project: basename(root)});
	assert.equal(boot.ok, true, boot.ok ? "" : boot.error.message);
	await cp(join(sourceRoot, ".changekernel", "wiki", "items"), join(root, ".changekernel", "wiki", "items"), {recursive: true});
	await fixtureGit(root, ["add", ".changekernel"]);
	await fixtureGit(root, ["commit", "-q", "--no-verify", "--allow-empty", "-m", "bootstrap ChangeKernel"]);
	return root;
}

test("changekernel status reports unavailable instead of inventing legacy readiness", async () => {
	const root = await makeGovernedProject("status");
	try {
		const out = await execFileAsync(process.execPath, [bin, "status", root]);
		assert.equal(out.code, 2);
		assert.match(out.stdout + out.stderr, /not implemented|unavailable/i);
		assert.doesNotMatch(out.stdout, /Ready|all clear/u);
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("changekernel changes does not fabricate an empty list when projection is unimplemented", async () => {
	const root = await makeGovernedProject("changes");
	try {
		const out = await execFileAsync(process.execPath, [bin, "changes", root]);
		assert.equal(out.code, 2);
		assert.match(out.stdout + out.stderr, /not implemented|unavailable/i);
		assert.doesNotMatch(out.stdout, /No Changes/u);
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("changekernel fails closed with exit code 2 on a non-project root", async () => {
	const empty = await mkdtemp(join(tmpdir(), "changekernel-bin-empty-"));
	try {
		const out = await execFileAsync(process.execPath, [bin, "status", empty]);
		assert.equal(out.code, 2);
		assert.match(out.stderr, /changekernel:/u);
	} finally {
		await rm(empty, {recursive: true, force: true});
	}
});

test("changekernel rejects unknown verbs with usage", async () => {
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
