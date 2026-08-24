import assert from "node:assert/strict";
import {mkdir, mkdtemp, rm, symlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {describe, it} from "node:test";

import {
	createExecutablePluginAdmissionClosure,
} from "../../src/plugins/executable.ts";
import {createRuntimeBuildManifest} from "../../src/runtime/contracts.ts";
import {sha256Digest} from "../../src/utils/canonical-json.ts";

function admission(overrides = {}) {
	return {
		pluginId: "runtime-bridge",
		kind: "runtime-bridge",
		trustPlane: "run-process",
		capabilities: ["runtime.events", "runtime.run"],
		...overrides,
	};
}

describe("executable Plugin admission", () => {
	it("binds only CodeWiki trust policy over composed Plugin identities", async () => {
		await withRoots(async ({projectRoot, releaseRoot, mirrorRoot}) => {
			const admissions = [
				admission({
					pluginId: "llm-pi-ai",
					kind: "dsh-plugin",
					trustPlane: "broker-host",
					capabilities: ["provider.stream", "provider.models"],
				}),
				admission(),
			];
			const closure = createExecutablePluginAdmissionClosure({
				projectRoot,
				sourceRoots: [releaseRoot],
				admissions,
			});
			const mirror = createExecutablePluginAdmissionClosure({
				projectRoot,
				sourceRoots: [mirrorRoot],
				admissions: [...admissions].reverse(),
			});

			assert.deepEqual(
				closure.admissions.map(({pluginId}) => pluginId),
				["llm-pi-ai", "runtime-bridge"],
			);
			assert.deepEqual(closure.admissions[0].capabilities, [
				"provider.models",
				"provider.stream",
			]);
			assert.match(closure.closureDigest, /^sha256:[0-9a-f]{64}$/);
			assert.equal(mirror.closureDigest, closure.closureDigest);
			const build = createRuntimeBuildManifest({
				schemaVersion: "2.0.0",
				runProtocolVersion: "5.0.0",
				nodeVersion: process.version.slice(1),
				dshSourceCommit: "b150a551b8d465e31e418e1b2eaf5e79bbb7d28e",
				dshPackageClosureDigest: sha256Digest("dsh-packages"),
				cordisClosureDigest: sha256Digest("cordis-packages"),
				executablePluginClosureDigest: closure.closureDigest,
				runtimeArtifactDigest: sha256Digest("runtime-artifact"),
			});
			assert.equal(build.executablePluginClosureDigest, closure.closureDigest);
			assert.equal(Object.isFrozen(closure), true);
			assert.equal(Object.isFrozen(closure.admissions), true);
		});
	});

	it("rejects authority-plane drift and duplicate policy declarations", async () => {
		await withRoots(async ({projectRoot, releaseRoot}) => {
			assert.throws(
				() => createExecutablePluginAdmissionClosure({
					projectRoot,
					sourceRoots: [releaseRoot],
					admissions: [admission({trustPlane: "project-server"})],
				}),
				/cannot enter trust plane/,
			);
			assert.throws(
				() => createExecutablePluginAdmissionClosure({
					projectRoot,
					sourceRoots: [releaseRoot],
					admissions: [
						admission(),
						admission({capabilities: ["runtime.run"]}),
					],
				}),
				/admission id must be unique/,
			);
			assert.throws(
				() => createExecutablePluginAdmissionClosure({
					projectRoot,
					sourceRoots: [releaseRoot],
					admissions: [admission({
						capabilities: ["runtime.run", "runtime.run"],
					})],
				}),
				/capability must be unique/,
			);
		});
	});

	it("does not accept duplicate package-manager or DSH Loader declarations", async () => {
		await withRoots(async ({projectRoot, releaseRoot}) => {
			assert.throws(
				() => createExecutablePluginAdmissionClosure({
					projectRoot,
					sourceRoots: [releaseRoot],
					admissions: [{
						...admission(),
						version: "1.0.0",
						integrity: "sha512-not-codewiki-policy",
						dependencies: [],
						entrypoints: [],
					}],
				}),
				/admission shape is invalid/,
			);
		});
	});

	it("rejects governed-repository roots and symlink aliases", async () => {
		await withRoots(async ({root, projectRoot}) => {
			const localRoot = join(projectRoot, "local-plugin");
			const localLink = join(root, "local-plugin-link");
			await mkdir(localRoot, {recursive: true});
			await symlink(localRoot, localLink, "dir");

			for (const sourceRoot of [localRoot, localLink]) {
				assert.throws(
					() => createExecutablePluginAdmissionClosure({
						projectRoot,
						sourceRoots: [sourceRoot],
						admissions: [admission()],
					}),
					/Repository-local executable Plugin loading is prohibited/,
				);
			}
		});
	});
});

async function withRoots(action) {
	const root = await mkdtemp(join(tmpdir(), "codewiki-plugin-admission-"));
	try {
		const projectRoot = join(root, "project");
		const releaseRoot = join(root, "release");
		const mirrorRoot = join(root, "mirror");
		await Promise.all([
			mkdir(projectRoot, {recursive: true}),
			mkdir(releaseRoot, {recursive: true}),
			mkdir(mirrorRoot, {recursive: true}),
		]);
		await action({root, projectRoot, releaseRoot, mirrorRoot});
	} finally {
		await rm(root, {recursive: true, force: true});
	}
}
