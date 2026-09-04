import {canonicalJson} from "../../../src/kernel/canonical/json.ts";
import {createProjectSnapshot} from "../../../src/kernel/changes/snapshot.ts";
import {validateWikiTree} from "../../../src/kernel/wiki/tree.ts";

const UTF8 = new TextEncoder();

export function oid(number, algorithm = "sha1") {
	const width = algorithm === "sha1" ? 40 : 64;
	return Object.freeze({algorithm, hex: Number(number).toString(16).padStart(width, "0")});
}

export function digest(character = "a") {
	return `sha256:${character.repeat(64)}`;
}

export function envelope({
	itemId,
	title,
	itemType = "codewiki.wiki:claim",
	aliases = [],
	attributes = {},
	relationships = [],
	provenance = [],
}) {
	return Object.freeze({
		protocol: "codewiki.wiki-item@1.0.0",
		itemId,
		itemType,
		title,
		aliases,
		attributes,
		relationships,
		provenance,
	});
}

export function markdownEntry({path, blob = 10, body = "", ...item}) {
	const encoded = canonicalJson(envelope(item));
	if (!encoded.ok) throw new Error(encoded.error.message);
	return Object.freeze({
		path,
		mode: "100644",
		blob: typeof blob === "number" ? oid(blob) : blob,
		bytes: UTF8.encode(`---\n${encoded.value}\n---\n${body}`),
	});
}

export function yamlEntry({path, blob = 10, body = "", ...item}) {
	const encoded = canonicalJson({...envelope(item), body});
	if (!encoded.ok) throw new Error(encoded.error.message);
	return Object.freeze({
		path,
		mode: "100644",
		blob: typeof blob === "number" ? oid(blob) : blob,
		bytes: UTF8.encode(`${encoded.value}\n`),
	});
}

export function snapshot({commit = 1, tree = 2, parents = [], algorithm = "sha1"} = {}) {
	const created = createProjectSnapshot({
		repositoryId: "cw:project:test",
		objectFormat: algorithm,
		commit: typeof commit === "number" ? oid(commit, algorithm) : commit,
		tree: typeof tree === "number" ? oid(tree, algorithm) : tree,
		parents: parents.map((parent) => typeof parent === "number" ? oid(parent, algorithm) : parent),
		complete: true,
	});
	if (!created.ok) throw new Error(created.error.message);
	return created.value;
}

export function materialize(entries, {
	commit = 1,
	tree = 2,
	parents = [],
	kernelBuildDigest = digest("a"),
	retiredItemIds = [],
} = {}) {
	const result = validateWikiTree({
		snapshot: snapshot({commit, tree, parents}),
		kernelBuildDigest,
		entries: [...entries].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
		retiredItemIds,
	});
	if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
	return result.value;
}
