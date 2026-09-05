import {readExactWiki, type WikiReadIssue} from "../../adapters/git/wiki.ts";
import type {ProjectSourceSelector} from "../../api/contracts/read.ts";
import {CHANGE_EVENT_KINDS, type SemanticEventOwners} from "../../kernel/changes/events.ts";
import {reduceChangeTrace, type ReducedChange} from "../../kernel/changes/reducer.ts";
import {decodeChangeTrace, type ChangeTrace} from "../../kernel/changes/trace.ts";
import {failure, success, type Outcome} from "../../kernel/canonical/outcome.ts";
import {decodeGitRef, sameGitOid, type GitObjectFormat, type GitOid, type GitRef} from "../../kernel/identity/git.ts";
import type {Sha256Digest} from "../../kernel/identity/sha256.ts";
import {
	buildSemanticEventOwnership,
	decodeComponentOwnership,
	type ComponentOwnership,
} from "../../kernel/wiki/ownership.ts";
import type {WikiMaterialization} from "../../kernel/wiki/tree.ts";
import type {ProjectSnapshot} from "../../kernel/changes/snapshot.ts";
import type {ProjectStoreIssue, ProjectStorePort, ProjectStoreReadRequest} from "../../ports/project-store.ts";

export interface ProjectReadLimits {
	readonly maximumWikiItems: number;
	readonly maximumWikiFileBytes: number;
	readonly maximumWikiTotalBytes: number;
	readonly maximumChangeTraces: number;
	readonly maximumTraceBytes: number;
	readonly maximumHistoryCommits: number;
	readonly maximumHistoryBytes: number;
}

export interface ProjectReadConfiguration {
	readonly projectName: string;
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly canonicalRef: GitRef;
	readonly kernelBuildDigest: Sha256Digest;
	readonly retiredWikiItemIds: readonly string[];
	readonly limits: ProjectReadLimits;
}

export interface LoadedWikiSource {
	readonly snapshot: ProjectSnapshot;
	readonly wiki: WikiMaterialization;
	readonly eventOwners: SemanticEventOwners;
}

export interface LoadedChange {
	readonly path: string;
	readonly blob: GitOid;
	readonly trace: ChangeTrace;
	readonly reduced: ReducedChange;
}

export interface LoadedProjectSource extends LoadedWikiSource {
	readonly changes: readonly LoadedChange[];
}

export type ProjectSourceIssueCode =
	| "invalid_project_state"
	| "invalid_source"
	| "limit_exceeded"
	| "source_not_found"
	| "source_stale";

export interface ProjectSourceIssue {
	readonly code: ProjectSourceIssueCode;
	readonly operation: "resolve_source" | "read_wiki" | "read_changes";
	readonly message: string;
}

export async function loadWikiSource(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	source: ProjectSourceSelector,
): Promise<Outcome<LoadedWikiSource, ProjectSourceIssue>> {
	const snapshot = await resolveProjectSource(store, configuration, source);
	if (!snapshot.ok) return snapshot;
	const exactWiki = await readExactWiki(store, {
		repositoryId: configuration.repositoryId,
		objectFormat: configuration.objectFormat,
		selector: Object.freeze({kind: "oid", oid: snapshot.value.commit}),
		kernelBuildDigest: configuration.kernelBuildDigest,
		retiredItemIds: configuration.retiredWikiItemIds,
		limits: {
			maximumItems: configuration.limits.maximumWikiItems,
			maximumFileBytes: configuration.limits.maximumWikiFileBytes,
			maximumTotalBytes: configuration.limits.maximumWikiTotalBytes,
		},
	});
	if (!exactWiki.ok) return failure(wikiIssue(exactWiki.error));
	if (!sameGitOid(exactWiki.value.wiki.source.snapshot.commit, snapshot.value.commit) ||
		!sameGitOid(exactWiki.value.wiki.source.snapshot.tree, snapshot.value.tree)) {
		return failure(issue("source_stale", "read_wiki", "Wiki read did not retain the resolved Project source."));
	}
	const eventOwners = eventOwnership(exactWiki.value.wiki);
	if (!eventOwners.ok) return eventOwners;
	return success(Object.freeze({snapshot: snapshot.value, wiki: exactWiki.value.wiki, eventOwners: eventOwners.value}));
}

export async function loadProjectSource(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	source: ProjectSourceSelector,
	visibleChangeIds: readonly string[] | null = null,
): Promise<Outcome<LoadedProjectSource, ProjectSourceIssue>> {
	const wiki = await loadWikiSource(store, configuration, source);
	if (!wiki.ok) return wiki;
	const changes = await readChanges(store, configuration, wiki.value.snapshot, wiki.value.eventOwners, visibleChangeIds);
	if (!changes.ok) return changes;
	return success(Object.freeze({...wiki.value, changes: changes.value}));
}

export async function resolveProjectSource(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	source: ProjectSourceSelector,
): Promise<Outcome<ProjectSnapshot, ProjectSourceIssue>> {
	const selector = storeSelector(configuration, source);
	if (!selector.ok) return selector;
	const snapshot = await store.readSnapshot({
		repositoryId: configuration.repositoryId,
		objectFormat: configuration.objectFormat,
		selector: selector.value,
	});
	if (!snapshot.ok) return failure(storeIssue(snapshot.error, "resolve_source"));
	return success(snapshot.value);
}

function storeSelector(
	configuration: ProjectReadConfiguration,
	source: ProjectSourceSelector,
): Outcome<ProjectStoreReadRequest["selector"], ProjectSourceIssue> {
	if (source.kind === "canonical") return success(Object.freeze({kind: "ref", ref: configuration.canonicalRef}));
	if (source.kind === "commit") {
		if (source.commit.algorithm !== configuration.objectFormat) {
			return failure(issue("invalid_source", "resolve_source", "Source commit uses the wrong Git object format."));
		}
		return success(Object.freeze({kind: "oid", oid: source.commit}));
	}
	const ref = decodeGitRef(`refs/codewiki/changes/${source.changeId}`);
	if (!ref.ok) return failure(issue("invalid_source", "resolve_source", "Change source selector is invalid."));
	return success(Object.freeze({kind: "ref", ref: ref.value}));
}

async function readChanges(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	snapshot: ProjectSnapshot,
	eventOwners: SemanticEventOwners,
	visibleChangeIds: readonly string[] | null,
): Promise<Outcome<readonly LoadedChange[], ProjectSourceIssue>> {
	const tree = await store.readTree({
		repositoryId: configuration.repositoryId,
		objectFormat: configuration.objectFormat,
		commit: snapshot.commit,
		pathPrefix: ".codewiki/changes",
		maximumEntries: configuration.limits.maximumChangeTraces,
	});
	if (!tree.ok) return failure(storeIssue(tree.error, "read_changes"));
	const output: LoadedChange[] = [];
	const changeIds = new Set<string>();
	for (const entry of tree.value.entries) {
		const path = /^\.codewiki\/changes\/TRACE-(CHG-[A-Za-z0-9][A-Za-z0-9._-]{0,195})\.jsonl$/u.exec(entry.path);
		if (entry.kind !== "blob" || entry.mode !== "100644" || path === null) {
			return failure(issue("invalid_project_state", "read_changes", "Change root contains an unsupported entry."));
		}
		const pathChangeId = path[1];
		if (pathChangeId === undefined) return failure(issue("invalid_project_state", "read_changes", "Change path is malformed."));
		if (visibleChangeIds !== null && !visibleChangeIds.includes(pathChangeId)) continue;
		const blob = await store.readBlob({
			repositoryId: configuration.repositoryId,
			objectFormat: configuration.objectFormat,
			commit: snapshot.commit,
			path: entry.path,
			maximumBytes: configuration.limits.maximumTraceBytes,
		});
		if (!blob.ok) return failure(storeIssue(blob.error, "read_changes"));
		let text: string;
		try {
			text = new TextDecoder("utf-8", {fatal: true}).decode(blob.value.bytes);
		} catch {
			return failure(issue("invalid_project_state", "read_changes", "Change Trace is not valid UTF-8."));
		}
		const trace = decodeChangeTrace(text, eventOwners);
		if (!trace.ok || trace.value.header.repositoryId !== configuration.repositoryId ||
			trace.value.header.objectFormat !== configuration.objectFormat ||
			entry.path !== `.codewiki/changes/TRACE-${trace.value.header.changeId}.jsonl` ||
			changeIds.has(trace.value.header.changeId)) {
			return failure(issue("invalid_project_state", "read_changes", "Change Trace validation failed."));
		}
		const reduced = reduceChangeTrace(trace.value);
		if (!reduced.ok) return failure(issue("invalid_project_state", "read_changes", "Change reduction failed."));
		changeIds.add(trace.value.header.changeId);
		output.push(Object.freeze({path: entry.path, blob: entry.oid, trace: trace.value, reduced: reduced.value}));
	}
	output.sort((left, right) => compareText(left.reduced.change.changeId, right.reduced.change.changeId));
	return success(Object.freeze(output));
}

function eventOwnership(wiki: WikiMaterialization): Outcome<SemanticEventOwners, ProjectSourceIssue> {
	const ownership: ComponentOwnership[] = [];
	for (const file of wiki.items) {
		const decoded = decodeComponentOwnership(file.item.itemId, file.item.attributes);
		if (!decoded.ok) return failure(issue("invalid_project_state", "read_wiki", "Wiki ownership is invalid."));
		if (decoded.value !== null) ownership.push(decoded.value);
	}
	const built = buildSemanticEventOwnership(ownership, CHANGE_EVENT_KINDS);
	if (!built.ok) return failure(issue("invalid_project_state", "read_wiki", "Wiki event ownership is incomplete."));
	return success(built.value);
}

function wikiIssue(value: WikiReadIssue): ProjectSourceIssue {
	if (value.code === "limit_exceeded") return issue("limit_exceeded", "read_wiki", value.message);
	return issue("invalid_project_state", "read_wiki", value.message);
}

function storeIssue(
	value: ProjectStoreIssue,
	operation: ProjectSourceIssue["operation"],
): ProjectSourceIssue {
	if (value.code === "not_found") return issue("source_not_found", operation, value.message);
	if (value.code === "stale_ref") return issue("source_stale", operation, value.message);
	if (value.code === "limit_exceeded") return issue("limit_exceeded", operation, value.message);
	return issue("invalid_project_state", operation, value.message);
}

function issue(
	code: ProjectSourceIssueCode,
	operation: ProjectSourceIssue["operation"],
	message: string,
): ProjectSourceIssue {
	return Object.freeze({code, operation, message});
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
