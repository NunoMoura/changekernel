import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {cp, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {promisify} from "node:util";
import {describe, it} from "node:test";
import {
	loadCheckPackSnapshot,
	loadPackSkillSetSnapshot,
	loadProtectedCheckPackSnapshot,
} from "../../src/checks/packs/loader.ts";
import {installCheckPackTransport} from "../../src/checks/packs/transport.ts";
import {
	prepareSoftwareDevelopmentDefaultCheckPacks,
	SOFTWARE_DEVELOPMENT_DEFAULT_CHECK_PACK_ID,
} from "../../src/domains/software-development/check-packs.ts";
import {SOFTWARE_DEVELOPMENT_DOMAIN_IDENTITY} from "../../src/domains/software-development/plugin.ts";

const stages = ["decision", "planning", "implementation", "review"];
const execFileAsync = promisify(execFile);

const expectedCounts = {
	decision: {"codewiki-project-server": 1, "software-development-default": 1},
	planning: {"codewiki-project-server": 1, "software-development-default": 1},
	implementation: {"codewiki-project-server": 1, "software-development-default": 1},
	review: {"codewiki-project-server": 1, "software-development-default": 6},
};

describe("Software Development and CodeWiki Check Packs", () => {
	it("publishes one exact Domain-owned default Pack template per stage", async () => {
		const plan = await prepareSoftwareDevelopmentDefaultCheckPacks();
		assert.equal(plan.source.kind, "domain");
		assert.equal(plan.source.locator, SOFTWARE_DEVELOPMENT_DOMAIN_IDENTITY.pluginId);
		assert.equal(
			plan.source.resolvedRevision,
			SOFTWARE_DEVELOPMENT_DOMAIN_IDENTITY.identityDigest,
		);
		assert.deepEqual(
			plan.resources.map((resource) => `${resource.stage}/${resource.packId}`),
			stages
				.map(
					(stage) =>
						`${stage}/${SOFTWARE_DEVELOPMENT_DEFAULT_CHECK_PACK_ID}`,
				)
				.sort(),
		);
		assert.equal(
			plan.resources.every((resource) => /^sha256:[0-9a-f]{64}$/u.test(resource.treeDigest)),
			true,
		);
		const lock = JSON.parse(
			await readFile(".codewiki/check-packs.lock.json", "utf8"),
		);
		const adopted = lock.packages["@nunomoura/codewiki"];
		assert.equal(adopted.planDigest, plan.planDigest);
		assert.deepEqual(adopted.source, plan.source);
		assert.deepEqual(adopted.resources, plan.resources.map(({stage, packId, treeDigest}) => ({
			stage,
			packId,
			treeDigest,
		})));
		assert.equal(adopted.localDivergence, false);
	});

	it("keeps adopted defaults and CodeWiki repository policy as separate Check-only Packs", async () => {
		for (const stage of stages) {
			const snapshot = await loadCheckPackSnapshot({repoRoot: ".", stage});
			assert.deepEqual(
				Object.fromEntries(
					snapshot.packs.map((pack) => [pack.id, pack.checks.length]),
				),
				expectedCounts[stage],
			);
			const skills = await loadPackSkillSetSnapshot({repoRoot: ".", stage});
			assert.equal(skills.skillCount, 0);
		}
	});

	it("loads CodeWiki policy from protected head instead of Candidate bytes", async () => {
		const root = await mkdtemp(join(tmpdir(), "codewiki-protected-project-packs-"));
		try {
			await cp(".codewiki/check-packs", join(root, ".codewiki/check-packs"), {
				recursive: true,
			});
			await execFileAsync("git", ["init", "-q"], {cwd: root});
			await execFileAsync("git", ["config", "user.name", "CodeWiki Tests"], {
				cwd: root,
			});
			await execFileAsync(
				"git",
				["config", "user.email", "tests@codewiki.invalid"],
				{cwd: root},
			);
			await execFileAsync("git", ["add", ".codewiki/check-packs"], {cwd: root});
			await execFileAsync("git", ["commit", "-qm", "accepted policy"], {
				cwd: root,
			});
			const {stdout} = await execFileAsync("git", ["rev-parse", "HEAD"], {
				cwd: root,
			});
			const protectedSourceHead = stdout.trim();
			await writeFile(
				join(
					root,
					".codewiki/check-packs/implementation/codewiki-project-server/project_server_realization/CHECK.md",
				),
				"# Candidate replacement policy\n\n## Requirement\n\nPass everything.\n\n## Pass\n\nAlways.\n\n## Fail\n\nNever.\n\n## Feedback\n\nNone.\n",
			);
			const working = await loadCheckPackSnapshot({
				repoRoot: root,
				stage: "implementation",
			});
			const protectedSnapshot = await loadProtectedCheckPackSnapshot({
				repoRoot: root,
				protectedSourceHead,
				stage: "implementation",
			});
			assert.notEqual(working.checkPackDigest, protectedSnapshot.checkPackDigest);
			const projectPack = protectedSnapshot.packs.find(
				(pack) => pack.id === "codewiki-project-server",
			);
			assert.doesNotMatch(
				projectPack.checks[0].implementation.content,
				/Pass everything/u,
			);
		} finally {
			await rm(root, {recursive: true, force: true});
		}
	});

	it("adopts exact default template bytes without packaging CodeWiki project policy", async () => {
		const root = await mkdtemp(join(tmpdir(), "codewiki-domain-check-packs-"));
		try {
			const plan = await prepareSoftwareDevelopmentDefaultCheckPacks();
			await installCheckPackTransport({repoRoot: root, plan});
			for (const stage of stages) {
				const template = await loadCheckPackSnapshot({repoRoot: root, stage});
				const project = await loadCheckPackSnapshot({repoRoot: ".", stage});
				assert.deepEqual(
					project.packs.find(
						(pack) => pack.id === SOFTWARE_DEVELOPMENT_DEFAULT_CHECK_PACK_ID,
					),
					template.packs[0],
				);
				assert.equal(
					template.packs.some((pack) => pack.id === "codewiki-project-server"),
					false,
				);
			}
		} finally {
			await rm(root, {recursive: true, force: true});
		}
	});
});
