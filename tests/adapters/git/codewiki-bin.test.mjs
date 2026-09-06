import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {cp, mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";

const sourceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const bin = join(sourceRoot, "bin", "codewiki.mjs");
const execFileAsync = (file, args, opts) => new Promise((resolvePromise) => {
	execFile(file, args, opts, (error, stdout, stderr) => {
		resolvePromise({code: error?.code ?? (error ? 1 : 0), stdout, stderr});
	});
});

async function makeGovernedProject(label) {
	const root = await mkdtemp(join(tmpdir(), `codewiki-bin-${label}-`));
	await execFileAsync("git", ["init", "-q", "-b", "main"], {cwd: root});
	await execFileAsync("git", ["config", "user.email", "console@test"], {cwd: root});
	await execFileAsync("git", ["config", "user.name", "Console Test"], {cwd: root});
	await cp(join(sourceRoot, ".codewiki", "wiki", "items"), join(root, ".codewiki", "wiki", "items"), {recursive: true});
	await execFileAsync("git", ["add", ".codewiki"], {cwd: root});
	await execFileAsync("git", ["commit", "-q", "-m", "bootstrap CodeWiki"], {cwd: root});
	return root;
}

test("codewiki status answers the five questions in plain language", async () => {
	const root = await makeGovernedProject("status");
	try {
		const out = await execFileAsync(process.execPath, [bin, "status", root]);
		assert.equal(out.code, 0);
		assert.match(out.stdout, /CodeWiki Project:\s+codewiki-bin-status-/u);
		assert.match(out.stdout, /Overall Status:\s+Ready/u);
		assert.match(out.stdout, /Attention Needed:\s+None/u);
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
