import assert from "node:assert/strict";
import {lstat, readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import test from "node:test";
import * as publicApi from "../../src/index.ts";
import {
	CODEWIKI_PRODUCT,
	CODEWIKI_PRODUCT_POLICY_DIGEST,
} from "../../src/product.ts";
import {semanticDigest} from "../../src/kernel/identity/semantic-digest.ts";
import {PRODUCT_OPERATIONS} from "../../src/api/transport/envelope.ts";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("Product policy is immutable canonical build data", () => {
	assert.ok(Object.isFrozen(CODEWIKI_PRODUCT));
	assert.ok(Object.isFrozen(CODEWIKI_PRODUCT.lifecycle));
	assert.ok(Object.isFrozen(CODEWIKI_PRODUCT.checks));
	assert.deepEqual({...CODEWIKI_PRODUCT.checks}, {selectionAuthority: "project", proposalSelection: "forbidden"});
	assert.ok(Object.isFrozen(CODEWIKI_PRODUCT.api));
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
	assert.deepEqual(CODEWIKI_PRODUCT.api.operations, PRODUCT_OPERATIONS);
	assert.equal(CODEWIKI_PRODUCT.api.requestProtocol.id, "codewiki.product-request");
	assert.deepEqual(CODEWIKI_PRODUCT.api.unavailable, ["Agent Work", "Preview"]);
	assert.equal(
		semanticDigest("codewiki.product-policy@1.0.0", CODEWIKI_PRODUCT).value,
		CODEWIKI_PRODUCT_POLICY_DIGEST,
	);
});

test("root package surface exposes curated Product, Client, and Project Server operations without direct Kernel access", () => {
	assert.deepEqual(Object.keys(publicApi).sort(), [
		"CODEWIKI_PRODUCT",
		"CODEWIKI_PRODUCT_POLICY_DIGEST",
		"LOCAL_PROJECT_SERVER_PROTOCOL",
		"PRODUCT_TRANSPORT_REQUEST_PROTOCOL",
		"PRODUCT_TRANSPORT_RESPONSE_PROTOCOL",
		"PROJECT_SERVER_PROTOCOL",
		"bootstrapCodewikiProject",
		"createCodewikiClient",
		"createLocalProjectServer",
		"createMemoryProjectServerFacts",
		"createProductTransportRequest",
		"createProductTransportResponse",
		"createProjectAccessPolicy",
		"createProjectServer",
		"decodeProductTransportResponse",
		"projectAccessProofDigest",
		"renderChangeDetailConsole",
		"renderChangesConsole",
		"renderChecksConsole",
		"renderConsole",
		"renderProjectStatusConsole",
		"sanitizeTerminalText",
	]);
	for (const forbidden of ["canonicalJson", "semanticDigest", "bindProjectServerFoundation", "readExactWiki", "CODEWIKI_EXTENSION_AVAILABLE"]) {
		assert.equal(forbidden in publicApi, false, forbidden);
	}
});

test("package metadata has one narrow export, exact DSH closure, and no Pi runtime dependency", async () => {
	const pkg = JSON.parse(await readFile(`${repoRoot}/package.json`, "utf8"));
	assert.equal(pkg.name, "@nunomoura/codewiki");
	assert.equal(pkg.version, CODEWIKI_PRODUCT.package.version);
	assert.deepEqual(Object.keys(pkg.exports), [".", "./package.json"]);
	assert.deepEqual(pkg.dependencies, {
		"@deepseek-ai/cordis": "4.0.1",
		"@deepseek-ai/dsh-agent": "0.1.1-rc.2",
		"@deepseek-ai/dsh-agent-loop": "0.1.1-rc.2",
		"@deepseek-ai/dsh-invariants": "0.1.1-rc.2",
		"@deepseek-ai/dsh-llm": "0.1.1-rc.2",
		"@deepseek-ai/dsh-session": "0.1.1-rc.2",
		"@deepseek-ai/dsh-session-persistence-jsonl": "0.1.1-rc.2",
		"@deepseek-ai/dsh-system-prompt": "0.1.1-rc.2",
		"@deepseek-ai/dsh-tools": "0.1.1-rc.2",
	});
	assert.equal(pkg.peerDependencies, undefined);
	assert.equal(pkg.pi, undefined);
	assert.equal(pkg.private, true);
	assert.deepEqual(Object.keys(pkg.devDependencies).sort(), ["@deepseek-ai/dsh-llm-replay", "@types/node", "koffi", "typescript", "zod"]);
});


test("package and source tree contain no bundled Check policy or historical converter", async () => {
	const pkg = JSON.parse(await readFile(`${repoRoot}/package.json`, "utf8"));
	assert.equal(pkg.codewiki, undefined);
	assert.equal(pkg.files.includes("check-packs"), false);
	for (const path of ["check-packs", "src/adapters/git/handoff-converter.ts", "dist/adapters/git/handoff-converter.js"]) {
		await assert.rejects(lstat(`${repoRoot}/${path}`), {code: "ENOENT"}, path);
	}
});
