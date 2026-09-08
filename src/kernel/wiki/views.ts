import {isNamespacedIdentifier} from "../data-contracts/validation.ts";
import {canonicalJson, isCanonicalObject, type CanonicalValue} from "../data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../data-contracts/outcome.ts";
import {decodeGitOid, sameGitOid, type GitOid} from "../identity/git.ts";
import {semanticDigest} from "../identity/semantic-digest.ts";
import type {Sha256Digest} from "../identity/sha256.ts";
import {LEGACY_ATTRIBUTE_PREFIX} from "./attributes.ts";
import type {WikiFile} from "./file.ts";
import {wikiItemSemanticProjection} from "./item.ts";
import {decodeWikiInlineLinks, WIKI_INLINE_LINK_PREDICATE} from "./links.ts";
import type {ValidatedWikiTransaction, WikiChangeKind, WikiItemVersion} from "./transaction.ts";
import type {WikiMaterialization} from "./tree.ts";

export const WIKI_VIEW_PROTOCOL = Object.freeze({id: "codewiki.wiki-view", version: "1.0.0"});

export type WikiViewKind =
	| "dictionary"
	| "wiki-attribution"
	| "wiki-get"
	| "wiki-graph"
	| "wiki-history"
	| "wiki-list"
	| "wiki-provenance-inspection"
	| "wiki-search"
	| "wiki-semantic-diff";

export type WikiViewAuthorization =
	| Readonly<{authorizationId: string; visibility: "all"}>
	| Readonly<{authorizationId: string; visibility: "allowlist"; itemIds: readonly string[]}>;

export interface WikiCitation {
	readonly itemId: string;
	readonly path: string;
	readonly blob: GitOid;
	readonly semanticDigest: Sha256Digest;
}

export interface WikiViewMetadata {
	readonly protocol: typeof WIKI_VIEW_PROTOCOL;
	readonly kind: WikiViewKind;
	readonly source: Readonly<{
		repositoryId: string;
		objectFormat: string;
		commit: GitOid;
		tree: GitOid;
		kernelBuildDigest: Sha256Digest;
	}>;
	readonly derivation: Readonly<{id: string; version: "1.0.0"}>;
	readonly authorization: Readonly<{authorizationId: string; redaction: "none" | "filtered"}>;
	readonly coverage: Readonly<{
		scope: "authorized-source";
		examined: number;
		matched: number;
		returned: number;
		complete: boolean;
	}>;
	readonly ordering: string;
	readonly truncation: Readonly<{limit: number; truncated: boolean; nextCursor: string | null}>;
	readonly freshness: "exact";
	readonly unknowns: readonly string[];
	readonly citations: readonly WikiCitation[];
	readonly channels: Readonly<{exact: true; approximate: false}>;
}

export interface WikiView<Data> {
	readonly metadata: WikiViewMetadata;
	readonly data: Data;
	readonly viewDigest: Sha256Digest;
}

export interface WikiItemSummary {
	readonly itemId: string;
	readonly itemType: string | null;
	readonly title: string;
	readonly aliases: readonly string[];
	readonly semanticDigest: Sha256Digest;
}

export interface WikiHistoryRevision {
	readonly kind: WikiChangeKind;
	readonly commit: GitOid;
	readonly current: WikiFile | null;
	readonly previous: WikiFile | null;
}

export interface WikiHistory {
	readonly sourceCommit: GitOid;
	readonly itemId: string;
	readonly examinedCommits: number;
	readonly complete: boolean;
	readonly unknowns: readonly string[];
	readonly revisions: readonly WikiHistoryRevision[];
}

export type WikiViewIssueCode =
	| "identity_failure"
	| "incompatible_source"
	| "invalid_authorization"
	| "invalid_cursor"
	| "invalid_request"
	| "not_found";

export interface WikiViewIssue {
	readonly code: WikiViewIssueCode;
	readonly path: string;
	readonly message: string;
}

interface PageRequest {
	readonly limit: number;
	readonly cursor: string | null;
}

interface Page<Row> {
	readonly rows: readonly Row[];
	readonly truncated: boolean;
	readonly nextCursor: string | null;
}

interface ViewOptions {
	readonly examined: number;
	readonly matched: number;
	readonly returned: number;
	readonly limit: number;
	readonly truncated: boolean;
	readonly nextCursor: string | null;
	readonly ordering: string;
	readonly complete?: boolean;
	readonly unknowns?: readonly string[];
	readonly citations: readonly WikiCitation[];
}

export function createWikiListView(
	wiki: WikiMaterialization,
	request: Readonly<{authorization: WikiViewAuthorization}> & PageRequest,
): Outcome<WikiView<Readonly<{items: readonly WikiItemSummary[]}>>, WikiViewIssue> {
	const visible = authorizedFiles(wiki, request.authorization);
	if (!visible.ok) return visible;
	const selected = page(visible.value, request, (file) => file.item.itemId);
	if (!selected.ok) return selected;
	return buildView(wiki, request.authorization, "wiki-list", Object.freeze({
		items: Object.freeze(selected.value.rows.map(itemSummary)),
	}), {
		examined: visible.value.length,
		matched: visible.value.length,
		returned: selected.value.rows.length,
		limit: request.limit,
		truncated: selected.value.truncated,
		nextCursor: selected.value.nextCursor,
		ordering: "item-id-ascending",
		citations: selected.value.rows.map(citation),
	});
}

export function createWikiGetView(
	wiki: WikiMaterialization,
	request: Readonly<{authorization: WikiViewAuthorization; itemId: string}>,
): Outcome<WikiView<Readonly<{item: CanonicalValue; semanticDigest: Sha256Digest}>>, WikiViewIssue> {
	const found = authorizedItem(wiki, request.authorization, request.itemId);
	if (!found.ok) return found;
	const projection = wikiItemSemanticProjection(found.value.item, found.value.item.body);
	return buildView(wiki, request.authorization, "wiki-get", Object.freeze({
		item: projection,
		semanticDigest: found.value.item.semanticDigest,
	}), oneItemOptions(found.value, "single-item"));
}

export function createDictionaryView(
	wiki: WikiMaterialization,
	request: Readonly<{authorization: WikiViewAuthorization; term: string}> & PageRequest,
): Outcome<WikiView<Readonly<{term: string; ambiguous: boolean; senses: readonly WikiItemSummary[]}>>, WikiViewIssue> {
	const term = normalizedQuery(request.term, "$.term");
	if (!term.ok) return term;
	const visible = authorizedFiles(wiki, request.authorization);
	if (!visible.ok) return visible;
	const matching = visible.value.filter((file) => file.item.itemType === "codewiki.wiki:definition" &&
		[file.item.title, ...file.item.aliases].some((label) => label.toLowerCase() === term.value.folded));
	const selected = page(matching, request, (file) => file.item.itemId);
	if (!selected.ok) return selected;
	return buildView(wiki, request.authorization, "dictionary", Object.freeze({
		term: term.value.exact,
		ambiguous: matching.length > 1,
		senses: Object.freeze(selected.value.rows.map(itemSummary)),
	}), {
		examined: visible.value.length,
		matched: matching.length,
		returned: selected.value.rows.length,
		limit: request.limit,
		truncated: selected.value.truncated,
		nextCursor: selected.value.nextCursor,
		ordering: "item-id-ascending",
		citations: selected.value.rows.map(citation),
	});
}

export function createWikiSearchView(
	wiki: WikiMaterialization,
	request: Readonly<{authorization: WikiViewAuthorization; query: string}> & PageRequest,
): Outcome<WikiView<Readonly<{
	query: string;
	results: readonly Readonly<{item: WikiItemSummary; score: number}>[];
}>>, WikiViewIssue> {
	const query = normalizedQuery(request.query, "$.query");
	if (!query.ok) return query;
	const terms = [...new Set(query.value.folded.split(/\s+/u))].sort(compareText);
	if (terms.length > 16) return failure(viewIssue("invalid_request", "$.query", "Wiki search accepts at most 16 unique terms."));
	const visible = authorizedFiles(wiki, request.authorization);
	if (!visible.ok) return visible;
	const ranked: {file: WikiFile; score: number}[] = [];
	for (const file of visible.value) {
		const encoded = canonicalJson(wikiItemSemanticProjection(file.item, file.item.body));
		if (!encoded.ok) return failure(viewIssue("identity_failure", file.path, encoded.error.message));
		const haystack = encoded.value.toLowerCase();
		if (!terms.every((term) => haystack.includes(term))) continue;
		ranked.push({file, score: lexicalScore(file, query.value.folded, terms, haystack)});
	}
	ranked.sort((left, right) => right.score - left.score || compareText(left.file.item.itemId, right.file.item.itemId));
	const selected = page(ranked, request, (row) => row.file.item.itemId);
	if (!selected.ok) return selected;
	return buildView(wiki, request.authorization, "wiki-search", Object.freeze({
		query: query.value.exact,
		results: Object.freeze(selected.value.rows.map((row) => Object.freeze({item: itemSummary(row.file), score: row.score}))),
	}), {
		examined: visible.value.length,
		matched: ranked.length,
		returned: selected.value.rows.length,
		limit: request.limit,
		truncated: selected.value.truncated,
		nextCursor: selected.value.nextCursor,
		ordering: "score-descending,item-id-ascending",
		citations: selected.value.rows.map((row) => citation(row.file)),
	});
}

export function createWikiGraphView(
	wiki: WikiMaterialization,
	request: Readonly<{
		authorization: WikiViewAuthorization;
		itemId: string;
		direction: "inbound" | "outbound" | "both";
	}> & PageRequest,
): Outcome<WikiView<Readonly<{
	rootItemId: string;
	nodes: readonly WikiItemSummary[];
	edges: readonly Readonly<{sourceItemId: string; predicate: string; targetItemId: string}>[];
}>>, WikiViewIssue> {
	if (!(["inbound", "outbound", "both"] as const).includes(request.direction)) {
		return failure(viewIssue("invalid_request", "$.direction", "Wiki graph direction is invalid."));
	}
	const root = authorizedItem(wiki, request.authorization, request.itemId);
	if (!root.ok) return root;
	const visible = authorizedFiles(wiki, request.authorization);
	if (!visible.ok) return visible;
	const visibleIds = new Set(visible.value.map((file) => file.item.itemId));
	const edges: Readonly<{sourceItemId: string; predicate: string; targetItemId: string}>[] = [];
	for (const file of visible.value) {
		for (const relationship of file.item.relationships) {
			if (relationship.predicate.startsWith(LEGACY_ATTRIBUTE_PREFIX) || !visibleIds.has(relationship.targetItemId) ||
				!edgeInDirection(file.item.itemId, relationship.targetItemId, request.itemId, request.direction)) continue;
			edges.push(Object.freeze({
				sourceItemId: file.item.itemId,
				predicate: relationship.predicate,
				targetItemId: relationship.targetItemId,
			}));
		}
		const inlineLinks = decodeWikiInlineLinks(file.item.body);
		if (!inlineLinks.ok) return failure(viewIssue("identity_failure", file.path, inlineLinks.error.message));
		for (const targetItemId of inlineLinks.value) {
			if (!visibleIds.has(targetItemId) || !edgeInDirection(file.item.itemId, targetItemId, request.itemId, request.direction)) continue;
			edges.push(Object.freeze({sourceItemId: file.item.itemId, predicate: WIKI_INLINE_LINK_PREDICATE, targetItemId}));
		}
	}
	const orderedEdges = [...new Map(edges.map((edge) => [edgeKey(edge), edge])).values()]
		.sort((left, right) => compareText(edgeKey(left), edgeKey(right)));
	const selected = page(orderedEdges, request, edgeKey);
	if (!selected.ok) return selected;
	const nodeIds = new Set<string>([request.itemId]);
	for (const edge of selected.value.rows) {
		nodeIds.add(edge.sourceItemId);
		nodeIds.add(edge.targetItemId);
	}
	const nodes = visible.value.filter((file) => nodeIds.has(file.item.itemId));
	return buildView(wiki, request.authorization, "wiki-graph", Object.freeze({
		rootItemId: request.itemId,
		nodes: Object.freeze(nodes.map(itemSummary)),
		edges: Object.freeze(selected.value.rows),
	}), {
		examined: visible.value.length,
		matched: orderedEdges.length,
		returned: selected.value.rows.length,
		limit: request.limit,
		truncated: selected.value.truncated,
		nextCursor: selected.value.nextCursor,
		ordering: "source-item-id,predicate,target-item-id-ascending",
		citations: nodes.map(citation),
	});
}

export function createWikiAttributionView(
	wiki: WikiMaterialization,
	request: Readonly<{authorization: WikiViewAuthorization; itemId: string}>,
): Outcome<WikiView<Readonly<{item: WikiItemSummary; provenance: readonly CanonicalValue[]}>>, WikiViewIssue> {
	const found = authorizedItem(wiki, request.authorization, request.itemId);
	if (!found.ok) return found;
	return buildView(wiki, request.authorization, "wiki-attribution", Object.freeze({
		item: itemSummary(found.value),
		provenance: semanticProvenance(found.value),
	}), oneItemOptions(found.value, "provenance-kind,subject-id-ascending"));
}

export function inspectExactWikiProvenance(
	wiki: WikiMaterialization,
	request: Readonly<{authorization: WikiViewAuthorization; itemId: string}>,
): Outcome<WikiView<Readonly<{
	itemId: string;
	attributes: WikiFile["item"]["attributes"];
	provenance: WikiFile["item"]["provenance"];
}>>, WikiViewIssue> {
	const found = authorizedItem(wiki, request.authorization, request.itemId);
	if (!found.ok) return found;
	return buildView(wiki, request.authorization, "wiki-provenance-inspection", Object.freeze({
		itemId: found.value.item.itemId,
		attributes: found.value.item.attributes,
		provenance: found.value.item.provenance,
	}), oneItemOptions(found.value, "exact-provenance-record"));
}

export function createWikiSemanticDiffView(
	transaction: ValidatedWikiTransaction,
	request: Readonly<{authorization: WikiViewAuthorization}> & PageRequest,
): Outcome<WikiView<Readonly<{
	baseline: Readonly<{commit: GitOid; tree: GitOid}>;
	changes: readonly Readonly<{
		itemId: string;
		kind: WikiChangeKind;
		before: WikiItemVersion | null;
		after: WikiItemVersion | null;
		fields: readonly Readonly<{field: string; before: CanonicalValue; after: CanonicalValue}>[];
	}>[];
}>>, WikiViewIssue> {
	const authorization = validateAuthorization(request.authorization);
	if (!authorization.ok) return authorization;
	const authorizedChanges = transaction.changes.filter((change) => authorizedId(request.authorization, change.itemId));
	const changes = authorizedChanges.filter((change) => change.semanticChanged);
	const selected = page(changes, request, (change) => change.itemId);
	if (!selected.ok) return selected;
	const citations: WikiCitation[] = [];
	const projectedChanges: Readonly<{
		itemId: string;
		kind: WikiChangeKind;
		before: WikiItemVersion | null;
		after: WikiItemVersion | null;
		fields: readonly Readonly<{field: string; before: CanonicalValue; after: CanonicalValue}>[];
	}>[] = [];
	for (const change of selected.value.rows) {
		const before = transaction.before.items.find((file) => file.item.itemId === change.itemId) ?? null;
		const after = transaction.after.items.find((file) => file.item.itemId === change.itemId) ?? null;
		if (before) citations.push(citation(before));
		if (after) citations.push(citation(after));
		const fields = semanticFieldChanges(before, after);
		if (!fields.ok) return fields;
		projectedChanges.push(Object.freeze({
			itemId: change.itemId,
			kind: change.kind,
			before: change.before,
			after: change.after,
			fields: fields.value,
		}));
	}
	return buildView(transaction.after, request.authorization, "wiki-semantic-diff", Object.freeze({
		baseline: Object.freeze({commit: transaction.before.source.snapshot.commit, tree: transaction.before.source.snapshot.tree}),
		changes: Object.freeze(projectedChanges),
	}), {
		examined: authorizedChanges.length,
		matched: changes.length,
		returned: selected.value.rows.length,
		limit: request.limit,
		truncated: selected.value.truncated,
		nextCursor: selected.value.nextCursor,
		ordering: "item-id-ascending",
		citations,
	});
}

export function createWikiHistoryView(
	wiki: WikiMaterialization,
	history: WikiHistory,
	request: Readonly<{authorization: WikiViewAuthorization}> & PageRequest,
): Outcome<WikiView<Readonly<{
	itemId: string;
	revisions: readonly Readonly<{
		kind: WikiChangeKind;
		commit: GitOid;
		state: WikiItemSummary | null;
	}>[];
}>>, WikiViewIssue> {
	const authorization = validateAuthorization(request.authorization);
	if (!authorization.ok) return authorization;
	const checkedHistory = validateHistory(history, wiki);
	if (!checkedHistory.ok) return checkedHistory;
	if (!sameGitOid(wiki.source.snapshot.commit, history.sourceCommit)) {
		return failure(viewIssue("incompatible_source", "$.history.sourceCommit", "Wiki history does not describe the selected exact source."));
	}
	if (!authorizedId(request.authorization, history.itemId)) {
		return failure(viewIssue("not_found", "$.itemId", "Wiki Item is absent or not authorized."));
	}
	const selected = page(history.revisions, request, (revision) => revision.commit.hex);
	if (!selected.ok) return selected;
	const citations: WikiCitation[] = [];
	const revisions = selected.value.rows.map((revision) => {
		const state = revision.current ?? revision.previous;
		if (state) citations.push(citation(state));
		return Object.freeze({kind: revision.kind, commit: revision.commit, state: state === null ? null : itemSummary(state)});
	});
	return buildView(wiki, request.authorization, "wiki-history", Object.freeze({
		itemId: history.itemId,
		revisions: Object.freeze(revisions),
	}), {
		examined: history.examinedCommits,
		matched: history.revisions.length,
		returned: selected.value.rows.length,
		limit: request.limit,
		truncated: selected.value.truncated,
		nextCursor: selected.value.nextCursor,
		ordering: "first-parent-newest-first",
		complete: history.complete,
		unknowns: history.unknowns,
		citations,
	});
}

function semanticFieldChanges(
	before: WikiFile | null,
	after: WikiFile | null,
): Outcome<readonly Readonly<{field: string; before: CanonicalValue; after: CanonicalValue}>[], WikiViewIssue> {
	const beforeValue = before === null ? null : wikiItemSemanticProjection(before.item, before.item.body);
	const afterValue = after === null ? null : wikiItemSemanticProjection(after.item, after.item.body);
	if ((beforeValue !== null && !isCanonicalObject(beforeValue)) || (afterValue !== null && !isCanonicalObject(afterValue))) {
		return failure(viewIssue("identity_failure", "$.changes", "Wiki semantic projection is malformed."));
	}
	const keys = [...new Set([
		...Object.keys(beforeValue ?? {}),
		...Object.keys(afterValue ?? {}),
	])].sort(compareText);
	const output: Readonly<{field: string; before: CanonicalValue; after: CanonicalValue}>[] = [];
	for (const field of keys) {
		const oldField = beforeValue?.[field] ?? null;
		const newField = afterValue?.[field] ?? null;
		const oldBytes = canonicalJson(oldField);
		const newBytes = canonicalJson(newField);
		if (!oldBytes.ok || !newBytes.ok) return failure(viewIssue("identity_failure", "$.changes", "Wiki semantic field is not canonical."));
		if (oldBytes.value !== newBytes.value) output.push(Object.freeze({field, before: oldField, after: newField}));
	}
	return success(Object.freeze(output));
}

function validateHistory(history: WikiHistory, wiki: WikiMaterialization): Outcome<null, WikiViewIssue> {
	if (typeof history !== "object" || history === null || !isNamespacedIdentifier(history.itemId) ||
		!Number.isSafeInteger(history.examinedCommits) || history.examinedCommits < 1 || history.examinedCommits > 256 ||
		typeof history.complete !== "boolean" || !Array.isArray(history.revisions) || history.revisions.length > history.examinedCommits ||
		!Array.isArray(history.unknowns) || history.unknowns.length > 16) {
		return failure(viewIssue("invalid_request", "$.history", "Wiki history facts are malformed or exceed their bounds."));
	}
	if (!history.complete && history.unknowns.length === 0) {
		return failure(viewIssue("invalid_request", "$.history.unknowns", "Incomplete Wiki history must state at least one bounded unknown."));
	}
	const sourceCommit = decodeGitOid(history.sourceCommit);
	if (!sourceCommit.ok || sourceCommit.value.algorithm !== wiki.source.snapshot.objectFormat) {
		return failure(viewIssue("incompatible_source", "$.history.sourceCommit", "Wiki history source commit has the wrong object format."));
	}
	const commits = new Set<string>();
	for (const revision of history.revisions) {
		const commit = decodeGitOid(revision.commit);
		if (!commit.ok || commit.value.algorithm !== wiki.source.snapshot.objectFormat || commits.has(commit.value.hex) ||
			!validHistoryState(revision.current, history.itemId, wiki) || !validHistoryState(revision.previous, history.itemId, wiki) ||
			!validHistoryShape(revision)) {
			return failure(viewIssue("incompatible_source", "$.history.revisions", "Wiki history revision is not bound to the selected Item and source format."));
		}
		commits.add(commit.value.hex);
	}
	if (history.unknowns.some((value) => typeof value !== "string" || value.length === 0 || value.length > 256 || value.normalize("NFC") !== value || value.includes("\0"))) {
		return failure(viewIssue("invalid_request", "$.history.unknowns", "Wiki history unknowns are malformed."));
	}
	return success(null);
}

function validHistoryState(file: WikiFile | null, itemId: string, wiki: WikiMaterialization): boolean {
	return file === null || (file.item.itemId === itemId && file.blob.algorithm === wiki.source.snapshot.objectFormat);
}

function validHistoryShape(revision: WikiHistoryRevision): boolean {
	if (revision.current === null) return revision.previous !== null && revision.kind === "retired";
	if (revision.previous === null) return revision.kind === "added";
	const moved = revision.current.path !== revision.previous.path;
	const semanticChanged = revision.current.item.semanticDigest !== revision.previous.item.semanticDigest;
	const blobChanged = !sameGitOid(revision.current.blob, revision.previous.blob);
	if (!moved && !blobChanged || !blobChanged && semanticChanged) return false;
	let expected: WikiChangeKind;
	if (moved) expected = semanticChanged ? "moved_and_edited" : "moved";
	else expected = semanticChanged ? "edited" : "provenance_changed";
	return revision.kind === expected;
}

function buildView<Data>(
	wiki: WikiMaterialization,
	authorization: WikiViewAuthorization,
	kind: WikiViewKind,
	data: Data,
	options: ViewOptions,
): Outcome<WikiView<Data>, WikiViewIssue> {
	const checked = validateAuthorization(authorization);
	if (!checked.ok) return checked;
	const snapshot = wiki.source.snapshot;
	const metadata: WikiViewMetadata = Object.freeze({
		protocol: WIKI_VIEW_PROTOCOL,
		kind,
		source: Object.freeze({
			repositoryId: snapshot.repositoryId,
			objectFormat: snapshot.objectFormat,
			commit: snapshot.commit,
			tree: snapshot.tree,
			kernelBuildDigest: wiki.source.kernelBuildDigest,
		}),
		derivation: Object.freeze({id: `codewiki.view:${kind}`, version: "1.0.0" as const}),
		authorization: Object.freeze({
			authorizationId: authorization.authorizationId,
			redaction: authorization.visibility === "all" ? "none" as const : "filtered" as const,
		}),
		coverage: Object.freeze({
			scope: "authorized-source" as const,
			examined: options.examined,
			matched: options.matched,
			returned: options.returned,
			complete: (options.complete ?? true) && !options.truncated,
		}),
		ordering: options.ordering,
		truncation: Object.freeze({limit: options.limit, truncated: options.truncated, nextCursor: options.nextCursor}),
		freshness: "exact" as const,
		unknowns: normalizeUnknowns(options.unknowns ?? []),
		citations: uniqueCitations(options.citations),
		channels: Object.freeze({exact: true as const, approximate: false as const}),
	});
	const digest = semanticDigest(`${WIKI_VIEW_PROTOCOL.id}@${WIKI_VIEW_PROTOCOL.version}`, {metadata, data});
	if (!digest.ok) return failure(viewIssue("identity_failure", "$", digest.error.message));
	return success(Object.freeze({metadata, data, viewDigest: digest.value}));
}

function authorizedFiles(
	wiki: WikiMaterialization,
	authorization: WikiViewAuthorization,
): Outcome<readonly WikiFile[], WikiViewIssue> {
	const checked = validateAuthorization(authorization);
	if (!checked.ok) return checked;
	return success(Object.freeze(wiki.items.filter((file) => authorizedId(authorization, file.item.itemId))));
}

function authorizedItem(
	wiki: WikiMaterialization,
	authorization: WikiViewAuthorization,
	itemId: string,
): Outcome<WikiFile, WikiViewIssue> {
	const visible = authorizedFiles(wiki, authorization);
	if (!visible.ok) return visible;
	if (typeof itemId !== "string" || !isNamespacedIdentifier(itemId)) {
		return failure(viewIssue("invalid_request", "$.itemId", "Wiki Item ID is invalid."));
	}
	const found = visible.value.find((file) => file.item.itemId === itemId);
	return found === undefined
		? failure(viewIssue("not_found", "$.itemId", "Wiki Item is absent or not authorized."))
		: success(found);
}

function validateAuthorization(authorization: WikiViewAuthorization): Outcome<null, WikiViewIssue> {
	if (typeof authorization !== "object" || authorization === null || !isNamespacedIdentifier(authorization.authorizationId) ||
		(authorization.visibility !== "all" && authorization.visibility !== "allowlist")) {
		return failure(viewIssue("invalid_authorization", "$.authorization", "Wiki View authorization is invalid."));
	}
	if (authorization.visibility === "allowlist") {
		if (!Array.isArray(authorization.itemIds) || authorization.itemIds.length > 4_096) {
			return failure(viewIssue("invalid_authorization", "$.authorization.itemIds", "Wiki View authorization allowlist is invalid."));
		}
		for (let index = 0; index < authorization.itemIds.length; index += 1) {
			const itemId = authorization.itemIds[index];
			if (typeof itemId !== "string" || !isNamespacedIdentifier(itemId) || (index > 0 && (authorization.itemIds[index - 1] ?? "") >= itemId)) {
				return failure(viewIssue("invalid_authorization", "$.authorization.itemIds", "Authorization Item IDs must be sorted and unique."));
			}
		}
	}
	return success(null);
}

function authorizedId(authorization: WikiViewAuthorization, itemId: string): boolean {
	return authorization.visibility === "all" || authorization.itemIds.includes(itemId);
}

function page<Row>(rows: readonly Row[], request: PageRequest, key: (row: Row) => string): Outcome<Page<Row>, WikiViewIssue> {
	if (!Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > 100) {
		return failure(viewIssue("invalid_request", "$.limit", "Wiki View limit must be an integer from 1 through 100."));
	}
	if (request.cursor !== null && (typeof request.cursor !== "string" || request.cursor.length === 0 ||
		new TextEncoder().encode(request.cursor).byteLength > 1_024 || request.cursor.normalize("NFC") !== request.cursor || request.cursor.includes("\0"))) {
		return failure(viewIssue("invalid_cursor", "$.cursor", "Wiki View cursor is invalid."));
	}
	let start = 0;
	if (request.cursor !== null) {
		const cursorIndex = rows.findIndex((row) => key(row) === request.cursor);
		if (cursorIndex < 0) return failure(viewIssue("invalid_cursor", "$.cursor", "Wiki View cursor is not present in the selected result set."));
		start = cursorIndex + 1;
	}
	const selected = rows.slice(start, start + request.limit);
	const truncated = start + selected.length < rows.length;
	return success(Object.freeze({
		rows: Object.freeze(selected),
		truncated,
		nextCursor: truncated && selected.length > 0 ? key(selected[selected.length - 1] as Row) : null,
	}));
}

function normalizedQuery(value: string, path: string): Outcome<Readonly<{exact: string; folded: string}>, WikiViewIssue> {
	if (typeof value !== "string" || value.length === 0 || value.trim() !== value || value.normalize("NFC") !== value ||
		new TextEncoder().encode(value).byteLength > 256 || value.includes("\0")) {
		return failure(viewIssue("invalid_request", path, "Wiki query must be non-empty bounded NFC text without outer whitespace."));
	}
	return success(Object.freeze({exact: value, folded: value.toLowerCase()}));
}

function lexicalScore(file: WikiFile, query: string, terms: readonly string[], haystack: string): number {
	let score = file.item.title.toLowerCase() === query ? 10_000 : 0;
	if (file.item.aliases.some((alias) => alias.toLowerCase() === query)) score += 5_000;
	for (const term of terms) score += Math.min(1_000, occurrenceCount(haystack, term));
	return score;
}

function occurrenceCount(haystack: string, needle: string): number {
	let count = 0;
	let offset = 0;
	while (count < 1_000) {
		const found = haystack.indexOf(needle, offset);
		if (found < 0) break;
		count += 1;
		offset = found + Math.max(1, needle.length);
	}
	return count;
}

function itemSummary(file: WikiFile): WikiItemSummary {
	return Object.freeze({
		itemId: file.item.itemId,
		itemType: file.item.itemType.startsWith(LEGACY_ATTRIBUTE_PREFIX) ? null : file.item.itemType,
		title: file.item.title,
		aliases: file.item.aliases,
		semanticDigest: file.item.semanticDigest,
	});
}

function semanticProvenance(file: WikiFile): readonly CanonicalValue[] {
	const projection = wikiItemSemanticProjection(file.item, file.item.body);
	if (!isCanonicalObject(projection) || !Array.isArray(projection.provenance)) return Object.freeze([]);
	return projection.provenance;
}

function citation(file: WikiFile): WikiCitation {
	return Object.freeze({
		itemId: file.item.itemId,
		path: file.path,
		blob: file.blob,
		semanticDigest: file.item.semanticDigest,
	});
}

function uniqueCitations(input: readonly WikiCitation[]): readonly WikiCitation[] {
	const sorted = [...input].sort((left, right) => compareText(citationKey(left), citationKey(right)));
	return Object.freeze(sorted.filter((entry, index) => index === 0 || citationKey(sorted[index - 1] as WikiCitation) !== citationKey(entry)));
}

function normalizeUnknowns(input: readonly string[]): readonly string[] {
	const valid = input.filter((value) => typeof value === "string" && value.length > 0 && value.length <= 256 && value.normalize("NFC") === value && !value.includes("\0"));
	return Object.freeze([...new Set(valid)].sort(compareText));
}

function citationKey(value: WikiCitation): string {
	return `${value.itemId}\0${value.path}\0${value.blob.algorithm}\0${value.blob.hex}`;
}

function edgeKey(value: Readonly<{sourceItemId: string; predicate: string; targetItemId: string}>): string {
	return JSON.stringify([value.sourceItemId, value.predicate, value.targetItemId]);
}

function edgeInDirection(
	sourceItemId: string,
	targetItemId: string,
	rootItemId: string,
	direction: "inbound" | "outbound" | "both",
): boolean {
	const outbound = sourceItemId === rootItemId;
	const inbound = targetItemId === rootItemId;
	if (direction === "outbound") return outbound;
	if (direction === "inbound") return inbound;
	return outbound || inbound;
}

function oneItemOptions(file: WikiFile, ordering: string): ViewOptions {
	return {
		examined: 1,
		matched: 1,
		returned: 1,
		limit: 1,
		truncated: false,
		nextCursor: null,
		ordering,
		citations: [citation(file)],
	};
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function viewIssue(code: WikiViewIssueCode, path: string, message: string): WikiViewIssue {
	return Object.freeze({code, path, message});
}
