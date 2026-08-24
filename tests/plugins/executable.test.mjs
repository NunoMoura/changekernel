import assert from "node:assert/strict";
import {mkdir, mkdtemp, rm, symlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {describe, it} from "node:test";
import {
	createExecutablePluginInventory,
	createExecutablePluginManifest,
} from "../../src/plugins/executable.ts";
import {sha256Digest} from "../../src/utils/canonical-json.ts";

function manifest(overrides = {}) {
	return createExecutablePluginManifest({
		pluginId: "@codewiki/runtime-bridge",
		kind: "runtime-bridge",
		version: "1.0.0",
		integrity: sha256Digest("runtime-bridge-package"),
		trustPlane: "run-process",
		capabilities: ["runtime.events", "runtime.run"],
		dependencies: [],
		entrypoints: [{name: "runtime.bridge", packageExport: "./runtime-bridge"}],
		...overrides,
	});
}

function dependency(value) {
	return {
		pluginId: value.pluginId,
		version: value.version,
		integrity: value.integrity,
		manifestDigest: value.manifestDigest,
	};
}

describe("executable Plugin contracts", () => {
	it("binds exact kind, trust plane, capabilities, dependencies, and entrypoints", () => {
		const credentials = manifest({
			pluginId: "@codewiki/credentials",
			kind: "infrastructure-provider",
			trustPlane: "broker-host",
			integrity: sha256Digest("credentials-package"),
			capabilities: ["credential.read"],
			entrypoints: [{name: "credential.provider", packageExport: "."}],
		});
		const provider = manifest({
			pluginId: "@deepseek-ai/dsh-llm-pi-ai",
			kind: "dsh-plugin",
			version: "0.1.1-rc.2",
			integrity: sha256Digest("dsh-llm-pi-ai-package"),
			trustPlane: "broker-host",
			capabilities: ["provider.stream", "provider.models"],
			dependencies: [dependency(credentials)],
			entrypoints: [{name: "dsh.plugin", packageExport: "."}],
		});

		assert.deepEqual(provider.capabilities, ["provider.models", "provider.stream"]);
		assert.deepEqual(provider.dependencies, [dependency(credentials)]);
		assert.match(provider.manifestDigest, /^sha256:[0-9a-f]{64}$/);
		assert.equal(Object.isFrozen(provider), true);
		assert.equal(
			manifest({capabilities: ["runtime.run", "runtime.events"]}).manifestDigest,
			manifest().manifestDigest,
		);
	});

	it("rejects authority-plane drift and non-exact executable declarations", () => {
		assert.throws(
			() => manifest({trustPlane: "project-server"}),
			/cannot enter trust plane/,
		);
		assert.throws(
			() => manifest({version: "latest"}),
			/exact semantic version/,
		);
		assert.throws(
			() => manifest({capabilities: ["runtime.run", "runtime.run"]}),
			/capability must be unique/,
		);
		assert.throws(
			() => manifest({entrypoints: [{name: "runtime.bridge", packageExport: "../local.mjs"}]}),
			/package export is invalid/,
		);
		assert.throws(
			() => manifest({dependencies: [{
				pluginId: "@codewiki/runtime-bridge",
				version: "1.0.0",
				integrity: sha256Digest("runtime-bridge-package"),
				manifestDigest: sha256Digest("self"),
			}]}),
			/cannot depend on itself/,
		);
	});

	it("admits only exact installed closure outside the governed repository", async () => {
		const root = await mkdtemp(join(tmpdir(), "codewiki-plugin-inventory-"));
		try {
			const projectRoot = join(root, "project");
			const operatorRoot = join(root, "operator");
			const credentialsRoot = join(operatorRoot, "credentials");
			const providerRoot = join(operatorRoot, "provider");
			const mirrorCredentialsRoot = join(operatorRoot, "mirror-credentials");
			const mirrorProviderRoot = join(operatorRoot, "mirror-provider");
			await Promise.all([
				mkdir(join(projectRoot, "local-plugin"), {recursive: true}),
				mkdir(credentialsRoot, {recursive: true}),
				mkdir(providerRoot, {recursive: true}),
				mkdir(mirrorCredentialsRoot, {recursive: true}),
				mkdir(mirrorProviderRoot, {recursive: true}),
			]);
			const credentials = manifest({
				pluginId: "@codewiki/credentials",
				kind: "infrastructure-provider",
				trustPlane: "broker-host",
				integrity: sha256Digest("credentials-package"),
				capabilities: ["credential.read"],
				entrypoints: [{name: "credential.provider", packageExport: "."}],
			});
			const provider = manifest({
				pluginId: "@deepseek-ai/dsh-llm-pi-ai",
				kind: "dsh-plugin",
				version: "0.1.1-rc.2",
				integrity: sha256Digest("dsh-llm-pi-ai-package"),
				trustPlane: "broker-host",
				capabilities: ["provider.stream"],
				dependencies: [dependency(credentials)],
				entrypoints: [{name: "dsh.plugin", packageExport: "."}],
			});
			const inventory = createExecutablePluginInventory({
				generation: 1,
				generatedAt: "2026-08-24T01:00:00.000Z",
				projectRoot,
				plugins: [
					{source: "operator", packageName: provider.pluginId, installationRoot: providerRoot, manifest: provider},
					{source: "release", packageName: credentials.pluginId, installationRoot: credentialsRoot, manifest: credentials},
				],
			});

			assert.deepEqual(
				inventory.plugins.map((entry) => entry.manifest.pluginId),
				["@codewiki/credentials", "@deepseek-ai/dsh-llm-pi-ai"],
			);
			assert.match(inventory.pluginClosureDigest, /^sha256:[0-9a-f]{64}$/);
			assert.match(inventory.inventoryDigest, /^sha256:[0-9a-f]{64}$/);
			const mirrorInventory = createExecutablePluginInventory({
				generation: 1,
				generatedAt: "2026-08-24T01:00:00.000Z",
				projectRoot,
				plugins: [
					{source: "operator", packageName: provider.pluginId, installationRoot: mirrorProviderRoot, manifest: provider},
					{source: "release", packageName: credentials.pluginId, installationRoot: mirrorCredentialsRoot, manifest: credentials},
				],
			});
			assert.equal(mirrorInventory.pluginClosureDigest, inventory.pluginClosureDigest);
			assert.notEqual(mirrorInventory.inventoryDigest, inventory.inventoryDigest);

			assert.throws(
				() => createExecutablePluginInventory({
					generation: 1,
					generatedAt: "2026-08-24T01:00:00.000Z",
					projectRoot,
					plugins: [{
						source: "operator",
						packageName: provider.pluginId,
						installationRoot: providerRoot,
						manifest: provider,
					}],
				}),
				/not installed at its exact identity/,
			);
			const crossPlaneBridge = manifest({dependencies: [dependency(credentials)]});
			assert.throws(
				() => createExecutablePluginInventory({
					generation: 1,
					generatedAt: "2026-08-24T01:00:00.000Z",
					projectRoot,
					plugins: [
						{source: "release", packageName: credentials.pluginId, installationRoot: credentialsRoot, manifest: credentials},
						{source: "release", packageName: crossPlaneBridge.pluginId, installationRoot: providerRoot, manifest: crossPlaneBridge},
					],
				}),
				/cannot cross trust planes/,
			);

			const localLink = join(root, "local-plugin-link");
			await symlink(join(projectRoot, "local-plugin"), localLink, "dir");
			for (const installationRoot of [join(projectRoot, "local-plugin"), localLink]) {
				assert.throws(
					() => createExecutablePluginInventory({
						generation: 1,
						generatedAt: "2026-08-24T01:00:00.000Z",
						projectRoot,
						plugins: [{
							source: "release",
							packageName: credentials.pluginId,
							installationRoot,
							manifest: credentials,
						}],
					}),
					/Repository-local executable Plugin loading is prohibited/,
				);
			}
		} finally {
			await rm(root, {recursive: true, force: true});
		}
	});
});
