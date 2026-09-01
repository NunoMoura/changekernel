import {readdirSync, readFileSync, statSync} from "node:fs";
import {parse as parseYaml} from "yaml";
import {
	parseWikiItemFile,
} from "../../src/knowledge/wiki-item.ts";
import {validateWikiTree} from "../../src/knowledge/wiki-tree.ts";
import {serializeOkfDocument} from "../../src/knowledge/okf-frontmatter.ts";

const WIKI_ITEMS_ROOT = ".codewiki/wiki/items";
const LEGACY_MEDIA_TYPE = "codewiki.legacy:media-type";
const LEGACY_METADATA = "codewiki.legacy:metadata";
const LEGACY_SOURCE_PATH = "codewiki.legacy:source-path";

function collectFiles(root) {
	return readdirSync(root)
		.sort()
		.flatMap((name) => {
			const path = `${root}/${name}`;
			return statSync(path).isDirectory() ? collectFiles(path) : [path];
		});
}

function requiredLegacyAttribute(item, name) {
	const value = item.attributes[name];
	if (value === undefined) {
		throw new Error(`Wiki Item ${item.itemId} has no ${name} migration attribute.`);
	}
	return value;
}

export function repositoryWikiState() {
	const entries = collectFiles(WIKI_ITEMS_ROOT).map((path) => ({
		path,
		bytes: readFileSync(path, "utf8"),
	}));
	const itemEntries = entries.map((entry) => ({
		...entry,
		item: parseWikiItemFile(entry.path, entry.bytes),
	}));
	return {
		entries,
		itemEntries,
		tree: validateWikiTree(entries),
	};
}

export function repositoryLegacyKnowledgeState() {
	const {entries, itemEntries, tree} = repositoryWikiState();
	const legacyFiles = itemEntries.map(({item}) => {
		const path = requiredLegacyAttribute(item, LEGACY_SOURCE_PATH);
		const mediaType = requiredLegacyAttribute(item, LEGACY_MEDIA_TYPE);
		if (typeof path !== "string" || typeof mediaType !== "string") {
			throw new Error(`Wiki Item ${item.itemId} has invalid legacy file attributes.`);
		}
		if (mediaType === "text/markdown") {
			const frontmatter = requiredLegacyAttribute(item, LEGACY_METADATA);
			if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
				throw new Error(`Wiki Item ${item.itemId} has invalid legacy metadata.`);
			}
			return {
				path,
				mediaType,
				bytes: serializeOkfDocument({frontmatter, body: item.body}),
			};
		}
		return {path, mediaType, bytes: item.body};
	});
	const okfFiles = legacyFiles
		.filter(({mediaType}) => mediaType === "text/markdown")
		.map(({path, bytes}) => ({path, content: bytes}));
	const diagrams = legacyFiles
		.filter(({mediaType}) => mediaType === "application/yaml")
		.map(({bytes}) => parseYaml(bytes));
	return {entries, itemEntries, tree, legacyFiles, okfFiles, diagrams};
}

export function repositoryLegacyOkfFiles({fullPaths = false} = {}) {
	return repositoryLegacyKnowledgeState().okfFiles.map(({path, content}) => ({
		path: fullPaths ? `.codewiki/kb/${path}` : path,
		content,
	}));
}
