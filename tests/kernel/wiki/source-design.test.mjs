import assert from "node:assert/strict";
import {readdir, readFile} from "node:fs/promises";
import {join} from "node:path";
import test from "node:test";
import {parse} from "yaml";
import {decodeKernelWikiFile} from "../../../src/adapters/git/wiki-profile.ts";
import {CHANGEKERNEL_VERSION} from "../../../src/kernel/identity/version.ts";

async function markdownPaths(root) {
	const paths = [];
	for (const entry of await readdir(root, {withFileTypes: true})) {
		const path = join(root, entry.name);
		if (entry.isDirectory()) paths.push(...await markdownPaths(path));
		else if (entry.isFile() && path.endsWith(".md")) paths.push(path);
	}
	return paths.sort();
}

test("source Wiki remains readable desired intent without fabricating managed adoption", async () => {
	const paths = await markdownPaths(".changekernel/wiki");
	assert.ok(paths.length > 0);
	const identities = new Set();
	for (const path of paths) {
		const bytes = new Uint8Array(await readFile(path));
		const text = new TextDecoder().decode(bytes);
		const end = text.indexOf("\n---\n", 4);
		assert.ok(text.startsWith("---\n") && end > 4, path);
		const metadata = parse(text.slice(4, end));
		assert.equal(typeof metadata.title, "string", path);
		assert.ok(metadata.title.length > 0, path);
		assert.equal(typeof metadata["source-id"], "string", path);
		assert.equal(identities.has(metadata["source-id"]), false, path);
		identities.add(metadata["source-id"]);
		assert.equal("protocol" in metadata, false, path);
		assert.equal("codewiki-origin" in metadata, false, path);
		const body = text.slice(end + 5);
		assert.ok(body.trim().length > 0, path);
		// Current presentation uses the adopted name; historical provenance and stable identities are not branding.
		for (const activeText of [metadata.title, ...(metadata.aliases ?? []), body]) {
			assert.doesNotMatch(activeText, /\b(?:CodeWiki|Semantic Kernel|SEMANTIC_KERNEL_VERSION)\b/u, path);
		}
		if (metadata["source-history"]) {
			assert.ok(Array.isArray(metadata["source-history"].provenance), path);
			assert.ok(Array.isArray(metadata["source-history"].relationships), path);
		}
		// Source location and descriptive metadata do not admit a managed Item.
		const admitted = decodeKernelWikiFile(CHANGEKERNEL_VERSION, {path, mode: "100644", blob: {algorithm: "sha1", hex: "a".repeat(40)}, bytes});
		assert.equal(admitted.ok, false, path);
		assert.equal(admitted.error.code, "invalid_metadata", path);
	}
});
