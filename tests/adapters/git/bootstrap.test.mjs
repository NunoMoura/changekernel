import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {
	lstat,
	mkdtemp,
	mkdir,
	readFile,
	readdir,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, relative} from "node:path";
import test from "node:test";
import {bootstrapChangeKernelProject} from "../../../src/adapters/git/bootstrap.ts";

async function withProject(run) {
	const root = await mkdtemp(join(tmpdir(), "codewiki-sk3b-bootstrap-"));
	try {
		execFileSync("git", ["init", "--quiet", root]);
		await run(root);
	} finally {
		await rm(root, {recursive: true, force: true});
	}
}

async function filesUnder(root) {
	const output = [];
	const visit = async (path) => {
		for (const name of (await readdir(path)).sort()) {
			if (name === ".git") continue;
			const nested = join(path, name);
			const stat = await lstat(nested);
			if (stat.isDirectory()) await visit(nested);
			else output.push(relative(root, nested).split("\\").join("/"));
		}
	};
	await visit(root);
	return output;
}

async function treeIdentity(root) {
	const entries = [];
	for (const path of await filesUnder(root)) {
		const bytes = await readFile(join(root, path));
		entries.push([path, createHash("sha256").update(bytes).digest("hex")]);
	}
	return entries;
}

test("bootstrap creates current Wiki and Change roots without legacy policy or invented adoption", async () => {
	await withProject(async root => {
		const result = await bootstrapChangeKernelProject({projectRoot: root, project: "example"});
		assert.equal(result.ok, true);
		assert.deepEqual(result.value.createdPaths, [".changekernel/config.json"]);
		assert.deepEqual(await filesUnder(root), result.value.createdPaths);
		assert.deepEqual(await readdir(join(root, ".changekernel/wiki")), []);
		assert.deepEqual(await readdir(join(root, ".changekernel/changes")), []);
		for (const forbidden of ["wiki/items", "check-packs", "check-packs.lock.json", "kb", "traces", "runtime", "views"]) await assert.rejects(lstat(join(root, ".changekernel", forbidden)), {code: "ENOENT"});
		await assert.rejects(lstat(join(root, ".changekernel.bootstrap")), {code: "ENOENT"});
		await assert.rejects(lstat(join(root, ".codewiki")), {code: "ENOENT"});
		const bytes = await readFile(join(root, ".changekernel/config.json"));
		assert.deepEqual(JSON.parse(bytes), {project: "example", protocol: {id: "codewiki.project-config", version: "2.0.0"}});
		assert.equal(result.value.configDigest, `sha256:${createHash("sha256").update(bytes).digest("hex")}`);
		assert.equal("checkPackLockDigest" in result.value, false);
	});
});

test("bootstrap conflicts are typed and preserve every existing byte", async () => {
	await withProject(async (root) => {
		await mkdir(join(root, ".changekernel"));
		await writeFile(join(root, ".changekernel", "custody.txt"), "preserve\n");
		const before = await treeIdentity(root);
		const result = await bootstrapChangeKernelProject({projectRoot: root, project: "example"});
		assert.deepEqual(result, {
			ok: false,
			error: {
				code: "already_exists",
				path: ".changekernel",
				message: "Managed .changekernel state already exists.",
			},
		});
		assert.deepEqual(await treeIdentity(root), before);
	});
});

test("bootstrap rejects legacy roots instead of creating parallel state or rewriting history", async () => {
	for (const legacyPath of [".codewiki", ".codewiki.bootstrap"]) {
		await withProject(async root => {
			await mkdir(join(root, legacyPath));
			await writeFile(join(root, legacyPath, "custody.txt"), "retained legacy bytes\n");
			const before = await treeIdentity(root);
			const result = await bootstrapChangeKernelProject({projectRoot: root, project: "example"});
			assert.equal(result.ok, false);
			assert.equal(result.error.code, "legacy_state");
			assert.equal(result.error.path, legacyPath);
			assert.deepEqual(await treeIdentity(root), before);
			await assert.rejects(lstat(join(root, ".changekernel")), {code: "ENOENT"});
			await assert.rejects(lstat(join(root, ".changekernel.bootstrap")), {code: "ENOENT"});
		});
	}
});

test("bootstrap rejects stale staging, invalid project identity, and symbolic roots without writes", async () => {
	await withProject(async (root) => {
		await mkdir(join(root, ".changekernel.bootstrap"));
		const stale = await bootstrapChangeKernelProject({projectRoot: root, project: "example"});
		assert.equal(stale.ok, false);
		assert.equal(stale.error.code, "staging_exists");
		assert.deepEqual(await filesUnder(root), []);
	});
	await withProject(async (root) => {
		const invalid = await bootstrapChangeKernelProject({projectRoot: root, project: "../escape"});
		assert.equal(invalid.ok, false);
		assert.equal(invalid.error.code, "invalid_project");
		assert.deepEqual(await filesUnder(root), []);
	});
	await withProject(async (root) => {
		const target = join(root, "target");
		const link = join(root, "link");
		await mkdir(target);
		await symlink(target, link);
		const symbolic = await bootstrapChangeKernelProject({projectRoot: link, project: "example"});
		assert.equal(symbolic.ok, false);
		assert.equal(symbolic.error.code, "invalid_root");
		assert.deepEqual(await filesUnder(target), []);
	});
});
