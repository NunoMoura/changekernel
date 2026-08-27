import {assertStableId} from "../project/git-store-profile.ts";
import {parseWikiItemFile, type WikiItem} from "./wiki-item.ts";

export interface WikiTreeEntry {
	readonly path: string;
	readonly bytes: string;
}

export interface ValidatedWikiTree {
	readonly entries: readonly Readonly<WikiTreeEntry & {readonly item: WikiItem}>[];
	readonly itemById: ReadonlyMap<string, WikiItem>;
	readonly pathByItemId: ReadonlyMap<string, string>;
}

export function validateWikiTree(
	entries: readonly WikiTreeEntry[],
	options: {readonly retiredItemIds?: readonly string[]} = {},
): ValidatedWikiTree {
	if (entries.length > 100_000) {
		throw new Error("Wiki tree exceeds 100000 Items.");
	}
	const retired = new Set<string>();
	for (const [index, itemId] of (options.retiredItemIds ?? []).entries()) {
		assertStableId(itemId, `retiredItemIds[${index}]`);
		if (retired.has(itemId)) throw new Error("Retired Item IDs must be duplicate-free.");
		retired.add(itemId);
	}
	const itemById = new Map<string, WikiItem>();
	const pathByItemId = new Map<string, string>();
	const seenPaths = new Set<string>();
	const foldedPaths = new Map<string, string>();
	const parsed: Array<Readonly<WikiTreeEntry & {readonly item: WikiItem}>> = [];
	for (const entry of entries) {
		if (seenPaths.has(entry.path)) throw new Error(`Duplicate Wiki path ${entry.path}.`);
		seenPaths.add(entry.path);
		const folded = entry.path.toLowerCase();
		const collision = foldedPaths.get(folded);
		if (collision !== undefined && collision !== entry.path) {
			throw new Error(`Case-folding Wiki path collision: ${collision} and ${entry.path}.`);
		}
		foldedPaths.set(folded, entry.path);
		const item = parseWikiItemFile(entry.path, entry.bytes);
		if (retired.has(item.itemId)) {
			throw new Error(`Retired Wiki Item ID cannot be reused: ${item.itemId}.`);
		}
		const existingPath = pathByItemId.get(item.itemId);
		if (existingPath !== undefined) {
			throw new Error(`Wiki Item ID ${item.itemId} occurs at ${existingPath} and ${entry.path}.`);
		}
		itemById.set(item.itemId, item);
		pathByItemId.set(item.itemId, entry.path);
		parsed.push(Object.freeze({...entry, item}));
	}
	const lookupOwners = new Map<string, string>();
	for (const item of itemById.values()) {
		claimLookupKey(lookupOwners, item.itemId, item.itemId);
	}
	for (const item of itemById.values()) {
		for (const alias of item.aliases) claimLookupKey(lookupOwners, alias, item.itemId);
		for (const relationship of item.relationships) {
			if (!itemById.has(relationship.targetItemId) && !retired.has(relationship.targetItemId)) {
				throw new Error(
					`Wiki relationship from ${item.itemId} has unresolved target ${relationship.targetItemId}.`,
				);
			}
		}
	}
	parsed.sort((left, right) => compare(left.path, right.path));
	return Object.freeze({
		entries: Object.freeze(parsed),
		itemById: readonlyMap(itemById),
		pathByItemId: readonlyMap(pathByItemId),
	});
}

function claimLookupKey(
	owners: Map<string, string>,
	key: string,
	itemId: string,
): void {
	const owner = owners.get(key);
	if (owner !== undefined && owner !== itemId) {
		throw new Error(`Wiki lookup key ${key} is ambiguous between ${owner} and ${itemId}.`);
	}
	owners.set(key, itemId);
}

function readonlyMap<Key, Value>(source: Map<Key, Value>): ReadonlyMap<Key, Value> {
	return new Map(source);
}

function compare(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
