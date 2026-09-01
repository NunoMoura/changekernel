import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateOkfDirectoryIndex } from "../../src/knowledge/okf-index.ts";
import { validateOkfBundle } from "../../src/knowledge/okf-validation.ts";
import {repositoryLegacyOkfFiles} from "../helpers/repository-wiki.mjs";

function readKbBundle() {
	return repositoryLegacyOkfFiles();
}

describe("migrated OKF index compatibility", () => {
	it("generates disposable indexes from retained semantic metadata", () => {
		const bundle = readKbBundle();
		const root = generateOkfDirectoryIndex(bundle, { includeRootVersion: true });
		const components = generateOkfDirectoryIndex(bundle, { directory: "system/components" });
		assert.match(root.content, /# CodeWiki Knowledge Index/);
		assert.match(root.content, /14 concepts under `product\/`/);
		assert.match(root.content, /29 concepts under `system\/`/);
		assert.match(components.content, /Change Intake/);
		assert.match(components.content, /Domains/);
		assert.match(components.content, /Checks/);
		assert.match(components.content, /Review/);
	});

	it("does not reconstruct disposable navigation projections as concepts", () => {
		const paths = new Set(readKbBundle().map((file) => file.path));
		assert.equal(paths.has("index.md"), false);
		assert.equal(paths.has("log.md"), false);
	});

	it("treats retained migrated metadata as semantic concepts only", () => {
		const result = validateOkfBundle(readKbBundle());
		assert.deepEqual(result.issues, []);
		assert.equal(result.conceptCount, 43);
		assert.equal(result.reservedCount, 0);
	});

	it("uses progressive disclosure instead of linking every nested concept", () => {
		const bundle = readKbBundle();
		const root = generateOkfDirectoryIndex(bundle, {
			includeRootVersion: true,
		});
		const product = generateOkfDirectoryIndex(bundle, { directory: "product" });
		const system = generateOkfDirectoryIndex(bundle, { directory: "system" });

		assert.match(root.content, /\(product\/\)/);
		assert.match(root.content, /\(system\/\)/);
		assert.doesNotMatch(root.content, /system\/runtime\.md/);
		assert.doesNotMatch(root.content, /product\/stories\/intent\.md/);

		assert.match(product.content, /\(stories\/\)/);
		assert.doesNotMatch(product.content, /stories\/intent\.md/);

		assert.match(system.content, /\(components\/\)/);
		assert.doesNotMatch(system.content, /components\/runtime\.md/);
		const components = generateOkfDirectoryIndex(bundle, {
			directory: "system/components",
		});
		assert.match(components.content, /\(runtime\.md\)/);
	});
});
