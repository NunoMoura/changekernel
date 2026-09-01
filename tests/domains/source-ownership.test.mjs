import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import {
	CODEWIKI_SOURCE_OWNERSHIP_DEFAULTS,
	CODEWIKI_SOURCE_OWNERSHIP_ID,
	CODEWIKI_SOURCE_OWNERSHIP_REFS,
	okfSourceOwnershipExtensionsFromBundle,
	sourceOwnershipComponentById,
	sourceOwnershipMapFromOkfBundle,
	sourceOwnershipOwnerForPath,
	sourceOwnershipSupportsSourcePath,
	sourceOwnershipSupportsTestPath,
	validateSourceOwnershipFromOkfBundle,
} from "../../src/domains/software-development/source-ownership.ts";
import {
	LEGACY_SOURCE_FILES,
	LEGACY_SOURCE_ROOTS,
} from "../../src/project/source-architecture.ts";
import {repositoryLegacyOkfFiles} from "../helpers/repository-wiki.mjs";

function collectFiles(root) {
	return readdirSync(root)
		.sort()
		.flatMap((name) => {
			const path = `${root}/${name}`;
			return statSync(path).isDirectory() ? collectFiles(path) : [path];
		});
}

function knowledgeBundleFiles() {
	return repositoryLegacyOkfFiles({fullPaths: true});
}

describe("migrated OKF source-ownership compatibility", () => {
	it("builds one compatibility realization map from retained Component metadata", () => {
		const ownership = sourceOwnershipMapFromOkfBundle(knowledgeBundleFiles());
		const components = new Map(
			ownership.components.map((component) => [component.id, component]),
		);

		assert.equal(ownership.id, CODEWIKI_SOURCE_OWNERSHIP_ID);
		assert.deepEqual(ownership.sourceRefs, CODEWIKI_SOURCE_OWNERSHIP_REFS);
		assert.deepEqual(ownership.defaults, CODEWIKI_SOURCE_OWNERSHIP_DEFAULTS);
		assert.equal(ownership.components.length, 20);
		assert.equal(
			components.get("cw:component:knowledge")?.doc,
			".codewiki/kb/system/components/knowledge.md",
		);
		assert.equal(
			components.get("cw:component:clients")?.doc,
			".codewiki/kb/system/components/clients.md",
		);
		assert.equal(
			components.get("cw:component:package")?.doc,
			".codewiki/kb/system/components/package.md",
		);
	});

	it("answers owner and test queries without requiring paths to exist yet", () => {
		const bundle = knowledgeBundleFiles();
		assert.equal(
			sourceOwnershipComponentById(bundle, "cw:component:runtime")?.doc,
			".codewiki/kb/system/components/runtime.md",
		);
		assert.equal(
			sourceOwnershipOwnerForPath(bundle, "src/alignment/queries/context.ts")?.id,
			"cw:component:alignment",
		);
		assert.equal(
			sourceOwnershipOwnerForPath(bundle, "src/clients/pi/extension.ts")?.id,
			"cw:component:clients",
		);
		assert.equal(
			sourceOwnershipOwnerForPath(bundle, "src/pi-extension.ts")?.id,
			"cw:component:package",
		);
		assert.equal(
			sourceOwnershipOwnerForPath(bundle, "src/plugins/executable.ts")?.id,
			"cw:component:package",
		);
		assert.equal(
			sourceOwnershipOwnerForPath(bundle, "src/runtime/dsh/runtime-bridge.ts")?.id,
			"cw:component:runtime",
		);
		assert.equal(
			sourceOwnershipSupportsTestPath(
				sourceOwnershipComponentById(bundle, "cw:component:checks"),
				"tests/checks/runner.test.mjs",
			),
			true,
		);
	});

	it("keeps retained ownership declarations structurally valid and non-duplicated", () => {
		const bundle = knowledgeBundleFiles();
		const ownership = sourceOwnershipMapFromOkfBundle(bundle);
		const sourcePatterns = ownership.components.flatMap((component) =>
			component.sourcePatterns.map((pattern) => `${pattern} -> ${component.id}`),
		);
		const rawPatterns = sourcePatterns.map((entry) => entry.split(" -> ")[0]);

		assert.deepEqual(validateSourceOwnershipFromOkfBundle(bundle), []);
		assert.equal(new Set(rawPatterns).size, rawPatterns.length);
	});

	it("accounts every active source file as one owner or explicit legacy debt", () => {
		const ownership = sourceOwnershipMapFromOkfBundle(knowledgeBundleFiles());
		for (const path of collectFiles("src")) {
			const owners = ownership.components.filter((component) =>
				sourceOwnershipSupportsSourcePath(component, path),
			);
			const legacy =
				LEGACY_SOURCE_FILES.includes(path) ||
				LEGACY_SOURCE_ROOTS.some((root) => path.startsWith(`src/${root}/`));
			assert.equal(owners.length, legacy ? 0 : 1, path);
		}
	});

	it("exports compatibility realization metadata from Component concepts only", () => {
		const extensions = okfSourceOwnershipExtensionsFromBundle(
			knowledgeBundleFiles(),
		);
		const packageExtension = extensions.find(
			(extension) => extension.path === ".codewiki/kb/system/components/package.md",
		);

		assert.equal(extensions.length, 20);
		assert.ok(packageExtension);
		assert.deepEqual(packageExtension.fields.codewiki_components, ["cw:component:package"]);
		assert.equal(
			packageExtension.fields.codewiki_source_map.every(
				(component) =>
					component.doc === ".codewiki/kb/system/components/package.md",
			),
			true,
		);
	});
});
