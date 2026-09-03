import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import test from "node:test";
import * as publicApi from "../../src/index.ts";
import {
	CODEWIKI_PRODUCT,
	CODEWIKI_PRODUCT_POLICY_DIGEST,
} from "../../src/product.ts";
import {semanticDigest} from "../../src/kernel/identity/semantic-digest.ts";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("Product policy is immutable canonical build data", () => {
	assert.ok(Object.isFrozen(CODEWIKI_PRODUCT));
	assert.ok(Object.isFrozen(CODEWIKI_PRODUCT.lifecycle));
	assert.ok(Object.isFrozen(CODEWIKI_PRODUCT.checks.resources));
	assert.deepEqual(CODEWIKI_PRODUCT.lifecycle.stages, [
		"decision",
		"planning",
		"implementation",
		"review",
	]);
	assert.deepEqual(CODEWIKI_PRODUCT.projectConfiguration.semanticRoots, [
		".codewiki/wiki/items",
		".codewiki/changes",
	]);
	assert.equal(
		semanticDigest("codewiki.product-policy@1.0.0", CODEWIKI_PRODUCT).value,
		CODEWIKI_PRODUCT_POLICY_DIGEST,
	);
});

test("root package surface exposes Product and bootstrap, not direct Kernel operations", () => {
	assert.deepEqual(Object.keys(publicApi).sort(), [
		"CODEWIKI_PRODUCT",
		"CODEWIKI_PRODUCT_POLICY_DIGEST",
		"bootstrapCodewikiProject",
	]);
	for (const forbidden of ["canonicalJson", "semanticDigest", "bindProjectServerFoundation", "CODEWIKI_EXTENSION_AVAILABLE"]) {
		assert.equal(forbidden in publicApi, false, forbidden);
	}
});

test("package metadata has one narrow export and no production or Pi runtime dependencies", async () => {
	const pkg = JSON.parse(await readFile(`${repoRoot}/package.json`, "utf8"));
	assert.equal(pkg.name, "@nunomoura/codewiki");
	assert.equal(pkg.version, CODEWIKI_PRODUCT.package.version);
	assert.deepEqual(Object.keys(pkg.exports), [".", "./package.json"]);
	assert.equal(pkg.dependencies, undefined);
	assert.equal(pkg.peerDependencies, undefined);
	assert.equal(pkg.pi, undefined);
	assert.equal(pkg.private, true);
	assert.deepEqual(Object.keys(pkg.devDependencies).sort(), ["@types/node", "typescript"]);
});
