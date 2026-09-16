import type {ProjectSourceSelector} from "../../api/contracts/read.ts";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {decodeGitRef, type GitObjectFormat, type GitRef} from "../../kernel/identity/git.ts";
import type {Sha256Digest} from "../../kernel/identity/sha256.ts";
import type {CHANGEKERNEL_VERSION} from "../../kernel/identity/version.ts";
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
	readonly kernelVersion: typeof CHANGEKERNEL_VERSION;
	readonly limits: ProjectReadLimits;
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

export interface DetailedProjectSourceIssue {
	readonly code: ProjectSourceIssueCode;
	readonly message: string;
	readonly kind: "invalid_source" | "store_failure";
	readonly store: ProjectStoreIssue | null;
}

export async function resolveProjectSourceDetailed(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	source: ProjectSourceSelector,
): Promise<Outcome<ProjectSnapshot, DetailedProjectSourceIssue>> {
	const selector = storeSelector(configuration, source);
	if (!selector.ok) return failure(detailedIssue("invalid_source", selector.error.message, null));
	const snapshot = await store.readSnapshot({
		repositoryId: configuration.repositoryId,
		objectFormat: configuration.objectFormat,
		selector: selector.value,
	});
	if (!snapshot.ok) return failure(detailedIssue(storeIssueCode(snapshot.error), snapshot.error.message, snapshot.error));
	return success(snapshot.value);
}

export async function resolveProjectSource(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	source: ProjectSourceSelector,
): Promise<Outcome<ProjectSnapshot, ProjectSourceIssue>> {
	const resolved = await resolveProjectSourceDetailed(store, configuration, source);
	if (resolved.ok) return resolved;
	return failure(issue(resolved.error.code, "resolve_source", resolved.error.message));
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

export function storeIssueCode(value: ProjectStoreIssue): ProjectSourceIssueCode {
	if (value.code === "not_found") return "source_not_found";
	if (value.code === "stale_ref") return "source_stale";
	if (value.code === "limit_exceeded") return "limit_exceeded";
	return "invalid_project_state";
}

function detailedIssue(
	code: ProjectSourceIssueCode,
	message: string,
	store: ProjectStoreIssue | null,
): DetailedProjectSourceIssue {
	return Object.freeze({code, message, kind: store === null ? "invalid_source" : "store_failure", store});
}

function issue(
	code: ProjectSourceIssueCode,
	operation: ProjectSourceIssue["operation"],
	message: string,
): ProjectSourceIssue {
	return Object.freeze({code, operation, message});
}
