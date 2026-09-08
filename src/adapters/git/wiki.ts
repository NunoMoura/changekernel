import {createHash} from "node:crypto";

import {isNamespacedIdentifier} from "../../kernel/data-contracts/validation.ts";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {decodeGitOid, sameGitOid, type GitOid} from "../../kernel/identity/git.ts";
import {decodeSha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {MAXIMUM_WIKI_FILE_BYTES, type WikiFile, type WikiFileInput} from "../../kernel/wiki/file.ts";
import {
	MAXIMUM_WIKI_ITEMS,
	MAXIMUM_WIKI_TOTAL_BYTES,
	validateWikiTree,
	type WikiMaterialization,
	type WikiTreeIssue,
} from "../../kernel/wiki/tree.ts";
import type {WikiChangeKind} from "../../kernel/wiki/transaction.ts";
import type {WikiHistory, WikiHistoryRevision} from "../../kernel/wiki/views.ts";
import type {
	ProjectStoreIssue,
	ProjectStorePort,
	ProjectStoreReadRequest,
	ProjectStoreTree,
} from "../../ports/project-store.ts";

export interface WikiReadLimits {
	readonly maximumItems: number;
	readonly maximumFileBytes: number;
	readonly maximumTotalBytes: number;
}

export interface WikiPrivateIndexCandidate {
	readonly commit: GitOid;
	readonly tree: GitOid;
	readonly kernelBuildDigest: Sha256Digest;
	readonly entries: readonly WikiFileInput[];
}

export interface ExactWikiReadRequest extends ProjectStoreReadRequest {
	readonly kernelBuildDigest: Sha256Digest;
	readonly retiredItemIds: readonly string[];
	readonly limits?: Partial<WikiReadLimits>;
	readonly privateIndex?: WikiPrivateIndexCandidate;
}

export interface ExactWikiReadResult {
	readonly wiki: WikiMaterialization;
	readonly sourceChannel: "git" | "private-index";
	readonly privateIndexStatus: "absent" | "fresh" | "invalid" | "stale";
}

export interface WikiHistoryReadRequest extends ExactWikiReadRequest {
	readonly itemId: string;
	readonly maximumCommits?: number;
	readonly maximumHistoryBytes?: number;
}

export type WikiReadIssueCode =
	| "invalid_limits"
	| "invalid_request"
	| "limit_exceeded"
	| "project_store_failure"
	| "wiki_validation_failure";

export interface WikiReadIssue {
	readonly code: WikiReadIssueCode;
	readonly operation: "read_history" | "read_wiki";
	readonly message: string;
	readonly cause?: ProjectStoreIssue | WikiTreeIssue;
}

const DEFAULT_LIMITS: WikiReadLimits = Object.freeze({
	maximumItems: MAXIMUM_WIKI_ITEMS,
	maximumFileBytes: MAXIMUM_WIKI_FILE_BYTES,
	maximumTotalBytes: MAXIMUM_WIKI_TOTAL_BYTES,
});
const DEFAULT_MAXIMUM_HISTORY_COMMITS = 64;
const MAXIMUM_HISTORY_COMMITS = 256;
const DEFAULT_MAXIMUM_HISTORY_BYTES = 32 * 1024 * 1024;
const MAXIMUM_HISTORY_BYTES = 64 * 1024 * 1024;

export async function readExactWiki(
	store: ProjectStorePort,
	request: ExactWikiReadRequest,
): Promise<Outcome<ExactWikiReadResult, WikiReadIssue>> {
	if (typeof request !== "object" || request === null) {
		return failure(readIssue("invalid_request", "read_wiki", "Wiki read request is malformed."));
	}
	const limits = readLimits(request.limits);
	if (!limits.ok) return limits;
	if (!decodeSha256Digest(request.kernelBuildDigest).ok || !Array.isArray(request.retiredItemIds)) {
		return failure(readIssue("invalid_request", "read_wiki", "Wiki read identity or retired-ID input is invalid."));
	}
	const snapshot = await store.readSnapshot(request);
	if (!snapshot.ok) return failure(readIssue("project_store_failure", "read_wiki", snapshot.error.message, snapshot.error));
	let privateIndexStatus: ExactWikiReadResult["privateIndexStatus"] = "absent";
	let listedTree: ProjectStoreTree | null = null;
	if (request.privateIndex !== undefined) {
		privateIndexStatus = privateIndexMatches(request.privateIndex, snapshot.value, request.kernelBuildDigest) ? "fresh" : "stale";
		if (privateIndexStatus === "fresh") {
			if (!entriesFitLimits(request.privateIndex.entries, limits.value)) {
				privateIndexStatus = "invalid";
			} else {
				const listed = await readWikiTree(store, request, snapshot.value.commit, limits.value.maximumItems);
				if (!listed.ok) return listed;
				listedTree = listed.value;
				if (indexMatchesTree(request.privateIndex.entries, listedTree) && request.privateIndex.entries.every(gitBlobMatches)) {
					const indexed = validateWikiTree({
						snapshot: snapshot.value,
						kernelBuildDigest: request.kernelBuildDigest,
						entries: request.privateIndex.entries,
						retiredItemIds: request.retiredItemIds,
					});
					if (indexed.ok) return success(Object.freeze({
						wiki: indexed.value,
						sourceChannel: "private-index" as const,
						privateIndexStatus: "fresh" as const,
					}));
				}
				privateIndexStatus = "invalid";
			}
		}
	}
	if (listedTree === null) {
		const listed = await readWikiTree(store, request, snapshot.value.commit, limits.value.maximumItems);
		if (!listed.ok) return listed;
		listedTree = listed.value;
	}
	const entries: WikiFileInput[] = [];
	let totalBytes = 0;
	for (const entry of listedTree.entries) {
		if (entry.kind !== "blob") {
			return failure(readIssue("wiki_validation_failure", "read_wiki", `Wiki path ${entry.path} is not a blob.`));
		}
		const blob = await store.readBlob({
			repositoryId: request.repositoryId,
			objectFormat: request.objectFormat,
			commit: snapshot.value.commit,
			path: entry.path,
			maximumBytes: limits.value.maximumFileBytes,
		});
		if (!blob.ok) return failure(readIssue("project_store_failure", "read_wiki", blob.error.message, blob.error));
		if (!sameGitOid(blob.value.oid, entry.oid)) {
			return failure(readIssue("wiki_validation_failure", "read_wiki", `Blob response for ${entry.path} has the wrong identity.`));
		}
		totalBytes += blob.value.bytes.byteLength;
		if (!Number.isSafeInteger(totalBytes) || totalBytes > limits.value.maximumTotalBytes) {
			return failure(readIssue("limit_exceeded", "read_wiki", `Wiki source exceeds ${limits.value.maximumTotalBytes} bytes.`));
		}
		entries.push(Object.freeze({path: entry.path, mode: entry.mode, blob: entry.oid, bytes: blob.value.bytes}));
	}
	const materialized = validateWikiTree({
		snapshot: snapshot.value,
		kernelBuildDigest: request.kernelBuildDigest,
		entries: Object.freeze(entries),
		retiredItemIds: request.retiredItemIds,
	});
	if (!materialized.ok) {
		return failure(readIssue("wiki_validation_failure", "read_wiki", materialized.error.message, materialized.error));
	}
	return success(Object.freeze({wiki: materialized.value, sourceChannel: "git", privateIndexStatus}));
}

async function readWikiTree(
	store: ProjectStorePort,
	request: Pick<ExactWikiReadRequest, "repositoryId" | "objectFormat">,
	commit: GitOid,
	maximumEntries: number,
): Promise<Outcome<ProjectStoreTree, WikiReadIssue>> {
	const listed = await store.readTree({
		repositoryId: request.repositoryId,
		objectFormat: request.objectFormat,
		commit,
		pathPrefix: ".codewiki/wiki/items",
		maximumEntries,
	});
	if (!listed.ok) return failure(readIssue("project_store_failure", "read_wiki", listed.error.message, listed.error));
	if (!sameGitOid(listed.value.commit, commit)) {
		return failure(readIssue("wiki_validation_failure", "read_wiki", "Project Store tree response is not bound to the resolved commit."));
	}
	return success(listed.value);
}

function indexMatchesTree(entries: readonly WikiFileInput[], tree: ProjectStoreTree): boolean {
	return entries.length === tree.entries.length && entries.every((entry, index) => {
		const expected = tree.entries[index];
		return expected !== undefined && expected.kind === "blob" && entry.path === expected.path && entry.mode === expected.mode &&
			sameGitOid(entry.blob, expected.oid);
	});
}

function gitBlobMatches(entry: WikiFileInput): boolean {
	const oid = decodeGitOid(entry.blob);
	if (!oid.ok || !(entry.bytes instanceof Uint8Array)) return false;
	const hash = createHash(oid.value.algorithm)
		.update(`blob ${entry.bytes.byteLength}\0`, "utf8")
		.update(entry.bytes)
		.digest("hex");
	return hash === oid.value.hex;
}

export async function readExactWikiHistory(
	store: ProjectStorePort,
	request: WikiHistoryReadRequest,
): Promise<Outcome<WikiHistory, WikiReadIssue>> {
	if (typeof request !== "object" || request === null || typeof request.itemId !== "string" || !isNamespacedIdentifier(request.itemId)) {
		return failure(readIssue("invalid_request", "read_history", "Wiki history Item ID is invalid."));
	}
	const maximumCommits = request.maximumCommits ?? DEFAULT_MAXIMUM_HISTORY_COMMITS;
	const maximumHistoryBytes = request.maximumHistoryBytes ?? DEFAULT_MAXIMUM_HISTORY_BYTES;
	if (!Number.isSafeInteger(maximumCommits) || maximumCommits < 1 || maximumCommits > MAXIMUM_HISTORY_COMMITS ||
		!Number.isSafeInteger(maximumHistoryBytes) || maximumHistoryBytes < 1 || maximumHistoryBytes > MAXIMUM_HISTORY_BYTES) {
		return failure(readIssue("invalid_limits", "read_history", "Wiki history limits are invalid."));
	}
	const states: Readonly<{commit: GitOid; item: WikiFile | null}>[] = [];
	const unknowns = new Set<string>();
	let selector = request.selector;
	let first = true;
	let complete = false;
	let retainedBytes = 0;
	while (states.length < maximumCommits) {
		const read = await readExactWiki(store, {
			...request,
			selector,
			privateIndex: first ? request.privateIndex : undefined,
		});
		if (!read.ok) return failure(readIssue(read.error.code, "read_history", read.error.message, read.error.cause));
		first = false;
		const item = read.value.wiki.items.find((file) => file.item.itemId === request.itemId) ?? null;
		if (item !== null && retainedBytes + item.byteLength > maximumHistoryBytes) {
			unknowns.add("history-byte-limit-reached");
			break;
		}
		retainedBytes += item?.byteLength ?? 0;
		states.push(Object.freeze({commit: read.value.wiki.source.snapshot.commit, item}));
		const parents = read.value.wiki.source.snapshot.parents;
		if (parents.length === 0) {
			complete = true;
			break;
		}
		if (parents.length > 1) unknowns.add("secondary-parent-history-not-expanded");
		selector = Object.freeze({kind: "oid" as const, oid: parents[0] as GitOid});
	}
	if (!complete && states.length >= maximumCommits) unknowns.add("history-commit-limit-reached");
	const revisions = historyRevisions(states, complete);
	const sourceCommit = states[0]?.commit;
	if (sourceCommit === undefined) {
		return failure(readIssue("limit_exceeded", "read_history", "Wiki history byte limit cannot retain the selected source state."));
	}
	return success(Object.freeze({
		sourceCommit,
		itemId: request.itemId,
		examinedCommits: states.length,
		complete,
		unknowns: Object.freeze([...unknowns].sort(compareText)),
		revisions,
	}));
}

function historyRevisions(
	states: readonly Readonly<{commit: GitOid; item: WikiFile | null}>[],
	complete: boolean,
): readonly WikiHistoryRevision[] {
	const output: WikiHistoryRevision[] = [];
	for (let index = 0; index < states.length; index += 1) {
		const currentState = states[index] as Readonly<{commit: GitOid; item: WikiFile | null}>;
		const previousState = states[index + 1];
		if (previousState === undefined && !complete) break;
		const previous = previousState?.item ?? null;
		const kind = historyChangeKind(currentState.item, previous);
		if (kind !== null) output.push(Object.freeze({
			kind,
			commit: currentState.commit,
			current: currentState.item,
			previous,
		}));
	}
	return Object.freeze(output);
}

function historyChangeKind(current: WikiFile | null, previous: WikiFile | null): WikiChangeKind | null {
	if (current === null && previous === null) return null;
	if (current === null) return "retired";
	if (previous === null) return "added";
	const moved = current.path !== previous.path;
	const semanticChanged = current.item.semanticDigest !== previous.item.semanticDigest;
	const blobChanged = !sameGitOid(current.blob, previous.blob);
	if (!moved && !blobChanged) return null;
	if (moved) return semanticChanged ? "moved_and_edited" : "moved";
	return semanticChanged ? "edited" : "provenance_changed";
}

function readLimits(input: Partial<WikiReadLimits> | undefined): Outcome<WikiReadLimits, WikiReadIssue> {
	const value = Object.freeze({...DEFAULT_LIMITS, ...input});
	if (!Number.isSafeInteger(value.maximumItems) || value.maximumItems < 1 || value.maximumItems > MAXIMUM_WIKI_ITEMS ||
		!Number.isSafeInteger(value.maximumFileBytes) || value.maximumFileBytes < 1 || value.maximumFileBytes > MAXIMUM_WIKI_FILE_BYTES ||
		!Number.isSafeInteger(value.maximumTotalBytes) || value.maximumTotalBytes < 1 || value.maximumTotalBytes > MAXIMUM_WIKI_TOTAL_BYTES ||
		value.maximumFileBytes > value.maximumTotalBytes) {
		return failure(readIssue("invalid_limits", "read_wiki", "Wiki read limits are invalid."));
	}
	return success(value);
}

function entriesFitLimits(entries: readonly WikiFileInput[], limits: WikiReadLimits): boolean {
	if (!Array.isArray(entries) || entries.length > limits.maximumItems) return false;
	let total = 0;
	for (const entry of entries) {
		if (!(entry?.bytes instanceof Uint8Array) || entry.bytes.byteLength > limits.maximumFileBytes) return false;
		total += entry.bytes.byteLength;
		if (!Number.isSafeInteger(total) || total > limits.maximumTotalBytes) return false;
	}
	return true;
}

function privateIndexMatches(
	index: WikiPrivateIndexCandidate,
	snapshot: Readonly<{commit: GitOid; tree: GitOid}>,
	kernelBuildDigest: Sha256Digest,
): boolean {
	if (typeof index !== "object" || index === null) return false;
	const commit = decodeGitOid(index.commit);
	const tree = decodeGitOid(index.tree);
	const build = decodeSha256Digest(index.kernelBuildDigest);
	return commit.ok && tree.ok && build.ok && sameGitOid(commit.value, snapshot.commit) &&
		sameGitOid(tree.value, snapshot.tree) && build.value === kernelBuildDigest;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function readIssue(
	code: WikiReadIssueCode,
	operation: WikiReadIssue["operation"],
	message: string,
	cause?: ProjectStoreIssue | WikiTreeIssue,
): WikiReadIssue {
	return cause === undefined
		? Object.freeze({code, operation, message})
		: Object.freeze({code, operation, message, cause});
}
