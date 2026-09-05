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
import {fileURLToPath} from "node:url";
import test from "node:test";
import {bootstrapCodewikiProject} from "../../../src/adapters/git/bootstrap.ts";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

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

test("bootstrap creates only Domain-free semantic roots and verified passive Check Packs", async () => {
	await withProject(async (root) => {
		const result = await bootstrapCodewikiProject({projectRoot: root, project: "example"});
		assert.equal(result.ok, true);
		assert.equal(result.value.protocol.id, "codewiki.project-bootstrap-receipt");
		assert.equal(result.value.createdPaths.length, 20);
		assert.deepEqual(await readdir(join(root, ".codewiki", "wiki", "items")), []);
		assert.deepEqual(await readdir(join(root, ".codewiki", "changes")), []);
		for (const forbidden of ["kb", "traces", "runtime", "views"]) {
			await assert.rejects(lstat(join(root, ".codewiki", forbidden)), {code: "ENOENT"});
		}
		await assert.rejects(lstat(join(root, ".codewiki.bootstrap")), {code: "ENOENT"});

		const config = JSON.parse(await readFile(join(root, ".codewiki", "config.json"), "utf8"));
		assert.equal(config.project, "example");
		assert.deepEqual(config.protocol, {id: "codewiki.project-config", version: "2.0.0"});
		assert.equal(config.runtime.automation, "manual");
		assert.equal(config.hosts.pi.enabled, false);
		assert.equal(config.hosts.mcp.enabled, false);
		assert.equal("domain" in config, false);

		const lock = JSON.parse(await readFile(join(root, ".codewiki", "check-packs.lock.json"), "utf8"));
		const installed = lock.packages["@nunomoura/codewiki"];
		assert.equal(lock.protocolId, "codewiki.check-pack-lock");
		assert.equal(lock.protocolVersion, "1.0.0");
		assert.deepEqual(installed.source, {
			kind: "npm",
			locator: "@nunomoura/codewiki",
			resolvedRevision: "0.4.0-sk3g.1",
		});
		assert.equal(installed.planDigest, "sha256:56f6dde3dd5eb1eb9a3e59312277c279e8f3e5eb9c90501983a8b23076cc7951");
		assert.equal(installed.localDivergence, false);
		assert.equal(installed.resources.length, 4);

		const copied = (await filesUnder(join(root, ".codewiki", "check-packs"))).sort();
		const packaged = (await filesUnder(join(repoRoot, "check-packs"))).sort();
		assert.deepEqual(copied, packaged);
		for (const path of packaged) {
			assert.deepEqual(
				await readFile(join(root, ".codewiki", "check-packs", path)),
				await readFile(join(repoRoot, "check-packs", path)),
				path,
			);
		}
	});
});

test("bootstrap conflicts are typed and preserve every existing byte", async () => {
	await withProject(async (root) => {
		await mkdir(join(root, ".codewiki"));
		await writeFile(join(root, ".codewiki", "custody.txt"), "preserve\n");
		const before = await treeIdentity(root);
		const result = await bootstrapCodewikiProject({projectRoot: root, project: "example"});
		assert.deepEqual(result, {
			ok: false,
			error: {
				code: "already_exists",
				path: ".codewiki",
				message: "Managed .codewiki state already exists.",
			},
		});
		assert.deepEqual(await treeIdentity(root), before);
	});
});

test("bootstrap rejects stale staging, invalid project identity, and symbolic roots without writes", async () => {
	await withProject(async (root) => {
		await mkdir(join(root, ".codewiki.bootstrap"));
		const stale = await bootstrapCodewikiProject({projectRoot: root, project: "example"});
		assert.equal(stale.ok, false);
		assert.equal(stale.error.code, "staging_exists");
		assert.deepEqual(await filesUnder(root), []);
	});
	await withProject(async (root) => {
		const invalid = await bootstrapCodewikiProject({projectRoot: root, project: "../escape"});
		assert.equal(invalid.ok, false);
		assert.equal(invalid.error.code, "invalid_project");
		assert.deepEqual(await filesUnder(root), []);
	});
	await withProject(async (root) => {
		const target = join(root, "target");
		const link = join(root, "link");
		await mkdir(target);
		await symlink(target, link);
		const symbolic = await bootstrapCodewikiProject({projectRoot: link, project: "example"});
		assert.equal(symbolic.ok, false);
		assert.equal(symbolic.error.code, "invalid_root");
		assert.deepEqual(await filesUnder(target), []);
	});
});
