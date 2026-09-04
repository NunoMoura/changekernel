import {isNamespacedIdentifier} from "../canonical/contract.ts";
import {failure, success, type Outcome} from "../canonical/outcome.ts";
import {decodeProjectSnapshot, type ProjectSnapshot} from "../changes/snapshot.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";
import {decodeWikiFile, type WikiFile, type WikiFileInput, type WikiFileIssue} from "./file.ts";
import {decodeWikiInlineLinks, type WikiInlineLinkIssue} from "./links.ts";

export const MAXIMUM_WIKI_ITEMS = 4_096;
export const MAXIMUM_WIKI_TOTAL_BYTES = 32 * 1024 * 1024;
export const MAXIMUM_RETIRED_WIKI_ITEM_IDS = 65_536;

export interface WikiSource {
	readonly snapshot: ProjectSnapshot;
	readonly kernelBuildDigest: Sha256Digest;
}

export interface WikiTreeInput {
	readonly snapshot: ProjectSnapshot;
	readonly kernelBuildDigest: Sha256Digest;
	readonly entries: readonly WikiFileInput[];
	readonly retiredItemIds: readonly string[];
}

export interface WikiMaterialization {
	readonly source: WikiSource;
	readonly items: readonly WikiFile[];
	readonly retiredItemIds: readonly string[];
	readonly totalBytes: number;
}

export type WikiTreeIssueCode =
	| "dangling_relationship"
	| "duplicate_item_id"
	| "invalid_file"
	| "invalid_inline_link"
	| "invalid_retired_ids"
	| "invalid_source"
	| "limit_exceeded"
	| "non_canonical_order"
	| "retired_item_id";

export interface WikiTreeIssue {
	readonly code: WikiTreeIssueCode;
	readonly path: string;
	readonly message: string;
	readonly cause?: WikiFileIssue | WikiInlineLinkIssue;
}

export function validateWikiTree(input: WikiTreeInput): Outcome<WikiMaterialization, WikiTreeIssue> {
	if (typeof input !== "object" || input === null || !Array.isArray(input.entries) || !Array.isArray(input.retiredItemIds)) {
		return failure(treeIssue("invalid_source", "$", "Wiki tree input is malformed."));
	}
	const snapshot = decodeProjectSnapshot(input.snapshot);
	const kernelBuildDigest = decodeSha256Digest(input.kernelBuildDigest);
	if (!snapshot.ok || !snapshot.value.complete || !kernelBuildDigest.ok) {
		return failure(treeIssue("invalid_source", "$.source", "Wiki materialization requires a complete exact snapshot and Kernel Build digest."));
	}
	if (input.entries.length > MAXIMUM_WIKI_ITEMS) {
		return failure(treeIssue("limit_exceeded", "$.entries", `Wiki tree exceeds ${MAXIMUM_WIKI_ITEMS} Item files.`));
	}
	const retiredItemIds = validateRetiredItemIds(input.retiredItemIds);
	if (!retiredItemIds.ok) return retiredItemIds;
	const files: WikiFile[] = [];
	let totalBytes = 0;
	let previousPath = "";
	for (let index = 0; index < input.entries.length; index += 1) {
		const entry = input.entries[index] as WikiFileInput;
		if (typeof entry?.path !== "string" || (index > 0 && previousPath >= entry.path)) {
			return failure(treeIssue("non_canonical_order", `$.entries[${index}]`, "Wiki tree entries must be path-sorted and unique."));
		}
		previousPath = entry.path;
		const decoded = decodeWikiFile(entry);
		if (!decoded.ok) return failure(treeIssue("invalid_file", entry.path, decoded.error.message, decoded.error));
		if (decoded.value.blob.algorithm !== snapshot.value.objectFormat) {
			return failure(treeIssue("invalid_source", entry.path, "Wiki blob object format differs from the source snapshot."));
		}
		totalBytes += decoded.value.byteLength;
		if (!Number.isSafeInteger(totalBytes) || totalBytes > MAXIMUM_WIKI_TOTAL_BYTES) {
			return failure(treeIssue("limit_exceeded", "$.entries", `Wiki tree exceeds ${MAXIMUM_WIKI_TOTAL_BYTES} total bytes.`));
		}
		files.push(decoded.value);
	}
	files.sort((left, right) => compareText(left.item.itemId, right.item.itemId));
	for (let index = 1; index < files.length; index += 1) {
		if (files[index - 1]?.item.itemId === files[index]?.item.itemId) {
			return failure(treeIssue("duplicate_item_id", files[index]?.path ?? "$.entries", "Stable Wiki Item IDs must be unique across the complete tree."));
		}
	}
	const liveIds = new Set(files.map((file) => file.item.itemId));
	const retiredIds = new Set(retiredItemIds.value);
	for (const file of files) {
		if (retiredIds.has(file.item.itemId)) {
			return failure(treeIssue("retired_item_id", file.path, `Retired Wiki Item ID ${file.item.itemId} cannot be reused.`));
		}
		for (const relationship of file.item.relationships) {
			if (!liveIds.has(relationship.targetItemId)) {
				return failure(treeIssue(
					"dangling_relationship",
					file.path,
					`Relationship ${relationship.predicate} targets absent Item ${relationship.targetItemId}.`,
				));
			}
		}
		const inlineLinks = decodeWikiInlineLinks(file.item.body);
		if (!inlineLinks.ok) {
			return failure(treeIssue("invalid_inline_link", file.path, inlineLinks.error.message, inlineLinks.error));
		}
		for (const targetItemId of inlineLinks.value) {
			if (!liveIds.has(targetItemId)) {
				return failure(treeIssue("dangling_relationship", file.path, `Inline Wiki link targets absent Item ${targetItemId}.`));
			}
		}
	}
	return success(Object.freeze({
		source: Object.freeze({snapshot: snapshot.value, kernelBuildDigest: kernelBuildDigest.value}),
		items: Object.freeze(files),
		retiredItemIds: retiredItemIds.value,
		totalBytes,
	}));
}

function validateRetiredItemIds(input: readonly string[]): Outcome<readonly string[], WikiTreeIssue> {
	if (input.length > MAXIMUM_RETIRED_WIKI_ITEM_IDS) {
		return failure(treeIssue("limit_exceeded", "$.retiredItemIds", `Retired Item IDs exceed ${MAXIMUM_RETIRED_WIKI_ITEM_IDS}.`));
	}
	let previous = "";
	const output: string[] = [];
	for (let index = 0; index < input.length; index += 1) {
		const itemId = input[index];
		if (typeof itemId !== "string" || !isNamespacedIdentifier(itemId) || (index > 0 && previous >= itemId)) {
			return failure(treeIssue("invalid_retired_ids", `$.retiredItemIds[${index}]`, "Retired Item IDs must be canonical, sorted, and unique."));
		}
		previous = itemId;
		output.push(itemId);
	}
	return success(Object.freeze(output));
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function treeIssue(
	code: WikiTreeIssueCode,
	path: string,
	message: string,
	cause?: WikiFileIssue | WikiInlineLinkIssue,
): WikiTreeIssue {
	return cause === undefined
		? Object.freeze({code, path, message})
		: Object.freeze({code, path, message, cause});
}
