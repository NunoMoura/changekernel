import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, rm, symlink, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";

import {
	installCheckPackTransport,
	prepareCheckPackTransport,
} from "../../src/checks/packs/transport.ts";
import {checkDefinition} from "../helpers/checks.mjs";

async function packageFixture() {
	const root = await mkdtemp(join(tmpdir(), "codewiki-pack-transport-"));
	const checkRoot = join(root, "resources", "decision", "team", "check-one");
	await mkdir(checkRoot, {recursive: true});
	await writeFile(join(checkRoot, "check.json"), JSON.stringify(checkDefinition()));
	await writeFile(join(checkRoot, "CHECK.mjs"), "export default async function check() { return true; }\n");
	await writeFile(join(root, "package.json"), JSON.stringify({
		name: "@fixture/codewiki-checks",
		version: "1.2.3",
		keywords: ["codewiki-check-pack"],
		codewiki: {checkPacks: [{stage: "decision", packId: "team", path: "resources/decision/team"}]},
		scripts: {postinstall: "exit 99"},
	}));
	return root;
}

test("Check Pack transport validates passive exact resources and installs no package code", async () => {
	const packageRoot = await packageFixture();
	const projectRoot = await mkdtemp(join(tmpdir(), "codewiki-pack-project-"));
	try {
		const plan = await prepareCheckPackTransport({
			kind: "local",
			locator: packageRoot,
			resolvedRevision: "local-fixture-1",
			packageRoot,
		});
		assert.equal(plan.resources[0].packId, "team");
		const installed = await installCheckPackTransport({repoRoot: projectRoot, plan});
		assert.deepEqual(installed, [".codewiki/check-packs/decision/team"]);
		assert.match(
			await readFile(join(projectRoot, installed[0], "check-one", "CHECK.mjs"), "utf8"),
			/export default/,
		);
		const lock = JSON.parse(await readFile(join(projectRoot, ".codewiki/check-packs.lock.json"), "utf8"));
		assert.equal(lock.protocolId, "codewiki.check-pack-lock");
		assert.equal(lock.packages["@fixture/codewiki-checks"].planDigest, plan.planDigest);
		await assert.rejects(
			installCheckPackTransport({repoRoot: projectRoot, plan}),
			/transport collision/,
		);
	} finally {
		await rm(packageRoot, {recursive: true, force: true});
		await rm(projectRoot, {recursive: true, force: true});
	}
});

test("Check Pack transport rejects path escape, symlinks, drift, and malformed Packs", async () => {
	const packageRoot = await packageFixture();
	try {
		const manifestPath = join(packageRoot, "package.json");
		const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
		manifest.codewiki.checkPacks[0].path = "../outside";
		await writeFile(manifestPath, JSON.stringify(manifest));
		await assert.rejects(
			prepareCheckPackTransport({kind: "local", locator: packageRoot, resolvedRevision: "1", packageRoot}),
			/escaped package root/,
		);
		manifest.codewiki.checkPacks[0].path = "resources/decision/team";
		await writeFile(manifestPath, JSON.stringify(manifest));
		await symlink("check-one/check.json", join(packageRoot, "resources/decision/team/link.json"));
		await assert.rejects(
			prepareCheckPackTransport({kind: "local", locator: packageRoot, resolvedRevision: "1", packageRoot}),
			/forbids symbolic links/,
		);
	} finally {
		await rm(packageRoot, {recursive: true, force: true});
	}
});
