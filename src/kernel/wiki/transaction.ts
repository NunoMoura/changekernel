import {failure, success, type Outcome} from "../canonical/outcome.ts";
import {decodeGitOid, sameGitOid, type GitOid} from "../identity/git.ts";
import {semanticDigest} from "../identity/semantic-digest.ts";
import type {Sha256Digest} from "../identity/sha256.ts";
import type {WikiFile} from "./file.ts";
import type {WikiMaterialization} from "./tree.ts";

export const VALIDATED_WIKI_TRANSACTION_PROTOCOL = Object.freeze({
	id: "codewiki.validated-wiki-transaction",
	version: "1.0.0",
});

export type WikiChangeKind =
	| "added"
	| "edited"
	| "moved"
	| "moved_and_edited"
	| "provenance_changed"
	| "retired";

export interface WikiItemVersion {
	readonly path: string;
	readonly blob: GitOid;
	readonly semanticDigest: Sha256Digest;
}

export interface WikiChange {
	readonly itemId: string;
	readonly kind: WikiChangeKind;
	readonly before: WikiItemVersion | null;
	readonly after: WikiItemVersion | null;
	readonly semanticChanged: boolean;
	readonly provenanceChanged: boolean;
}

export interface ValidatedWikiTransaction {
	readonly protocol: typeof VALIDATED_WIKI_TRANSACTION_PROTOCOL;
	readonly before: WikiMaterialization;
	readonly after: WikiMaterialization;
	readonly changes: readonly WikiChange[];
	readonly retiredItemIds: readonly string[];
	readonly transactionDigest: Sha256Digest;
}

export type WikiTransactionIssueCode =
	| "identity_mismatch"
	| "invalid_reservation_delta"
	| "invalid_source";

export interface WikiTransactionIssue {
	readonly code: WikiTransactionIssueCode;
	readonly path: string;
	readonly message: string;
}

export function validateWikiTransaction(input: Readonly<{
	before: WikiMaterialization;
	after: WikiMaterialization;
}>): Outcome<ValidatedWikiTransaction, WikiTransactionIssue> {
	if (typeof input !== "object" || input === null || !isWikiMaterialization(input.before) || !isWikiMaterialization(input.after)) {
		return failure(transactionIssue("invalid_source", "$", "Wiki transaction input is malformed."));
	}
	const compatible = validateCompatibleSources(input.before, input.after);
	if (compatible) return failure(compatible);
	const beforeById = new Map(input.before.items.map((file) => [file.item.itemId, file]));
	const afterById = new Map(input.after.items.map((file) => [file.item.itemId, file]));
	const reservation = validateReservationDelta(input.before, input.after, beforeById, afterById);
	if (!reservation.ok) return reservation;
	const itemIds = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort(compareText);
	const changes: WikiChange[] = [];
	for (const itemId of itemIds) {
		const before = beforeById.get(itemId) ?? null;
		const after = afterById.get(itemId) ?? null;
		const change = classifyChange(itemId, before, after);
		if (!change.ok) return change;
		if (change.value !== null) changes.push(change.value);
	}
	const body = Object.freeze({
		protocol: VALIDATED_WIKI_TRANSACTION_PROTOCOL,
		before: sourceIdentity(input.before),
		after: sourceIdentity(input.after),
		changes: Object.freeze(changes),
		retiredItemIds: reservation.value,
	});
	const digest = semanticDigest(`${VALIDATED_WIKI_TRANSACTION_PROTOCOL.id}@${VALIDATED_WIKI_TRANSACTION_PROTOCOL.version}`, body);
	if (!digest.ok) return failure(transactionIssue("invalid_source", "$", digest.error.message));
	return success(Object.freeze({
		...body,
		before: input.before,
		after: input.after,
		transactionDigest: digest.value,
	}));
}

function isWikiMaterialization(value: unknown): value is WikiMaterialization {
	if (typeof value !== "object" || value === null || !Array.isArray((value as WikiMaterialization).items) ||
		!Array.isArray((value as WikiMaterialization).retiredItemIds)) return false;
	const materialization = value as WikiMaterialization;
	if (typeof materialization.source !== "object" || materialization.source === null ||
		typeof materialization.source.snapshot !== "object" || materialization.source.snapshot === null ||
		typeof materialization.source.kernelBuildDigest !== "string") return false;
	return materialization.items.every((file) => typeof file === "object" && file !== null && typeof file.path === "string" &&
		decodeGitOid(file.blob).ok && typeof file.item === "object" && file.item !== null && typeof file.item.itemId === "string" &&
		typeof file.item.semanticDigest === "string");
}

function validateCompatibleSources(before: WikiMaterialization, after: WikiMaterialization): WikiTransactionIssue | null {
	if (before.source.snapshot.repositoryId !== after.source.snapshot.repositoryId ||
		before.source.snapshot.objectFormat !== after.source.snapshot.objectFormat) {
		return transactionIssue("invalid_source", "$.source", "Wiki transaction snapshots must belong to one repository identity and object format.");
	}
	if (before.source.kernelBuildDigest !== after.source.kernelBuildDigest) {
		return transactionIssue("invalid_source", "$.source.kernelBuildDigest", "Wiki transaction interpretation must use one exact Kernel Build.");
	}
	return null;
}

function validateReservationDelta(
	before: WikiMaterialization,
	after: WikiMaterialization,
	beforeById: ReadonlyMap<string, WikiFile>,
	afterById: ReadonlyMap<string, WikiFile>,
): Outcome<readonly string[], WikiTransactionIssue> {
	const beforeRetired = new Set(before.retiredItemIds);
	const afterRetired = new Set(after.retiredItemIds);
	for (const itemId of beforeRetired) {
		if (!afterRetired.has(itemId)) {
			return failure(transactionIssue("invalid_reservation_delta", "$.after.retiredItemIds", "Retired Wiki Item reservations cannot be removed."));
		}
	}
	for (const itemId of afterRetired) {
		if (!beforeRetired.has(itemId) && (!beforeById.has(itemId) || afterById.has(itemId))) {
			return failure(transactionIssue("invalid_reservation_delta", "$.after.retiredItemIds", "New reservations must correspond exactly to Items retired by this transaction."));
		}
	}
	const retired = new Set(after.retiredItemIds);
	for (const itemId of beforeById.keys()) {
		if (!afterById.has(itemId)) retired.add(itemId);
	}
	return success(Object.freeze([...retired].sort(compareText)));
}

function classifyChange(
	itemId: string,
	before: WikiFile | null,
	after: WikiFile | null,
): Outcome<WikiChange | null, WikiTransactionIssue> {
	if (before === null && after === null) return success(null);
	if (before === null) return success(Object.freeze({
		itemId,
		kind: "added",
		before: null,
		after: itemVersion(after as WikiFile),
		semanticChanged: true,
		provenanceChanged: false,
	}));
	if (after === null) return success(Object.freeze({
		itemId,
		kind: "retired",
		before: itemVersion(before),
		after: null,
		semanticChanged: true,
		provenanceChanged: false,
	}));
	const sameBlob = sameGitOid(before.blob, after.blob);
	const sameSemantic = before.item.semanticDigest === after.item.semanticDigest;
	const moved = before.path !== after.path;
	if (sameBlob && !sameSemantic) {
		return failure(transactionIssue("identity_mismatch", `$.items[${JSON.stringify(itemId)}]`, "One Git blob identity cannot decode to different Wiki semantics."));
	}
	if (sameBlob && !moved) return success(null);
	let kind: WikiChangeKind;
	if (moved) kind = sameSemantic ? "moved" : "moved_and_edited";
	else kind = sameSemantic ? "provenance_changed" : "edited";
	return success(Object.freeze({
		itemId,
		kind,
		before: itemVersion(before),
		after: itemVersion(after),
		semanticChanged: !sameSemantic,
		provenanceChanged: !sameBlob && sameSemantic,
	}));
}

function itemVersion(file: WikiFile): WikiItemVersion {
	return Object.freeze({path: file.path, blob: file.blob, semanticDigest: file.item.semanticDigest});
}

function sourceIdentity(materialization: WikiMaterialization): Readonly<{
	repositoryId: string;
	objectFormat: string;
	commit: GitOid;
	tree: GitOid;
	kernelBuildDigest: Sha256Digest;
}> {
	const {snapshot, kernelBuildDigest} = materialization.source;
	return Object.freeze({
		repositoryId: snapshot.repositoryId,
		objectFormat: snapshot.objectFormat,
		commit: snapshot.commit,
		tree: snapshot.tree,
		kernelBuildDigest,
	});
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function transactionIssue(code: WikiTransactionIssueCode, path: string, message: string): WikiTransactionIssue {
	return Object.freeze({code, path, message});
}
