import type {Outcome} from "../kernel/canonical/outcome.ts";
import type {ProjectSnapshot} from "../kernel/changes/snapshot.ts";
import type {GitObjectFormat, GitOid, GitRef} from "../kernel/identity/git.ts";
import {semanticDigest, type SemanticIdentityIssue} from "../kernel/identity/semantic-digest.ts";
import {sha256Digest, type Sha256Digest} from "../kernel/identity/sha256.ts";

export const PROJECT_STORE_PORT = Object.freeze({
	id: "codewiki.port.project-store",
	version: "1.2.0",
} as const);
export const PROJECT_STORE_PORT_PROTOCOL = PROJECT_STORE_PORT;

export interface ProjectStoreReadRequest {
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly selector: Readonly<{kind: "oid"; oid: GitOid}> | Readonly<{kind: "ref"; ref: GitRef}>;
}

export interface ProjectStoreBlobRequest {
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly commit: GitOid;
	readonly path: string;
	readonly maximumBytes: number;
}

export interface ProjectStoreBlob {
	readonly oid: GitOid;
	readonly bytes: Uint8Array;
}

export interface ProjectStoreTreeRequest {
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly commit: GitOid;
	/** Empty selects the complete tree. */
	readonly pathPrefix: string;
	readonly maximumEntries: number;
}

export interface ProjectStoreTreeEntry {
	readonly path: string;
	readonly mode: string;
	readonly kind: "blob" | "commit";
	readonly oid: GitOid;
}

export interface ProjectStoreTree {
	readonly commit: GitOid;
	readonly entries: readonly ProjectStoreTreeEntry[];
}

export interface ProjectStoreBlobWriteRequest {
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly bytes: Uint8Array;
	readonly authorizationId: string;
	readonly requestDigest: Sha256Digest;
}

export interface ProjectStoreBlobWriteReceipt {
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly oid: GitOid;
	readonly byteLength: number;
	readonly authorizationId: string;
	readonly requestDigest: Sha256Digest;
	readonly receiptDigest: Sha256Digest;
}

export type ProjectStoreTreeMutation =
	| Readonly<{path: string; mode: string; kind: "blob" | "commit"; oid: GitOid}>
	| Readonly<{path: string; mode: null; kind: null; oid: null}>;

export interface ProjectStoreTreeWriteRequest {
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly baseTree: GitOid | null;
	readonly mutations: readonly ProjectStoreTreeMutation[];
	readonly authorizationId: string;
	readonly requestDigest: Sha256Digest;
}

export interface ProjectStoreTreeWriteReceipt {
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly baseTree: GitOid | null;
	readonly tree: GitOid;
	readonly changedPaths: readonly string[];
	readonly authorizationId: string;
	readonly requestDigest: Sha256Digest;
	readonly receiptDigest: Sha256Digest;
}

export interface GitCommitIdentity {
	readonly name: string;
	readonly email: string;
	readonly timestamp: string;
}

export interface ProjectStoreCommitRequest {
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly tree: GitOid;
	readonly parents: readonly GitOid[];
	readonly message: string;
	readonly author: GitCommitIdentity;
	readonly committer: GitCommitIdentity;
	readonly authorizationId: string;
	readonly requestDigest: Sha256Digest;
}

export interface ProjectStoreRefUpdate {
	readonly ref: GitRef;
	readonly expectedOld: GitOid | null;
	readonly newOid: GitOid;
}

export interface ProjectStoreCasRequest {
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly updates: readonly ProjectStoreRefUpdate[];
	readonly reflogMessage: string;
	readonly authorizationId: string;
	readonly requestDigest: Sha256Digest;
}

export function projectStoreBlobWriteRequestDigest(request: ProjectStoreBlobWriteRequest): Outcome<Sha256Digest, SemanticIdentityIssue> {
	const {requestDigest: ignored, bytes, ...body} = request;
	void ignored;
	return semanticDigest("codewiki.project-store.write-blob-request@1.0.0", {...body, byteLength: bytes.byteLength, blobDigest: sha256Digest(bytes)});
}

export function projectStoreTreeWriteRequestDigest(request: ProjectStoreTreeWriteRequest): Outcome<Sha256Digest, SemanticIdentityIssue> {
	const {requestDigest: ignored, ...body} = request;
	void ignored;
	return semanticDigest("codewiki.project-store.write-tree-request@1.0.0", body);
}

export function projectStoreCommitRequestDigest(request: ProjectStoreCommitRequest): Outcome<Sha256Digest, SemanticIdentityIssue> {
	const {requestDigest: ignored, ...body} = request;
	void ignored;
	return semanticDigest("codewiki.project-store.commit-request@1.0.0", body);
}

export function projectStoreCasRequestDigest(request: ProjectStoreCasRequest): Outcome<Sha256Digest, SemanticIdentityIssue> {
	const {requestDigest: ignored, ...body} = request;
	void ignored;
	return semanticDigest("codewiki.project-store.cas-request@1.1.0", body);
}

export interface ProjectStoreCasReceipt {
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly updates: readonly Readonly<{
		ref: GitRef;
		oldOid: GitOid | null;
		newOid: GitOid;
	}>[];
	readonly status: "applied" | "reconciled";
	readonly authorizationId: string;
	readonly requestDigest: Sha256Digest;
	readonly receiptDigest: Sha256Digest;
}

export interface ProjectStoreIssue {
	readonly code:
		| "authorization_binding_invalid"
		| "command_failed"
		| "incomplete_object"
		| "invalid_object"
		| "invalid_ref"
		| "limit_exceeded"
		| "not_found"
		| "repository_mismatch"
		| "stale_ref"
		| "timeout";
	readonly operation: "cas" | "create_commit" | "read_blob" | "read_snapshot" | "read_tree" | "write_blob" | "write_tree";
	readonly message: string;
}

/** Sole persistence boundary for canonical Project snapshots and managed refs. */
export interface ProjectStorePort {
	readonly protocol: typeof PROJECT_STORE_PORT;
	readSnapshot(request: ProjectStoreReadRequest): Promise<Outcome<ProjectSnapshot, ProjectStoreIssue>>;
	readBlob(request: ProjectStoreBlobRequest): Promise<Outcome<ProjectStoreBlob, ProjectStoreIssue>>;
	readTree(request: ProjectStoreTreeRequest): Promise<Outcome<ProjectStoreTree, ProjectStoreIssue>>;
	writeBlob(request: ProjectStoreBlobWriteRequest): Promise<Outcome<ProjectStoreBlobWriteReceipt, ProjectStoreIssue>>;
	writeTree(request: ProjectStoreTreeWriteRequest): Promise<Outcome<ProjectStoreTreeWriteReceipt, ProjectStoreIssue>>;
	createCommit(request: ProjectStoreCommitRequest): Promise<Outcome<GitOid, ProjectStoreIssue>>;
	compareAndSwapRefs(request: ProjectStoreCasRequest): Promise<Outcome<ProjectStoreCasReceipt, ProjectStoreIssue>>;
}
