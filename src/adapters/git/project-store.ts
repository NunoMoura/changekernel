import {spawnSync, type SpawnSyncReturns} from "node:child_process";
import {lstatSync, realpathSync} from "node:fs";
import {basename, isAbsolute, join, resolve} from "node:path";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {createProjectSnapshot, type ProjectSnapshot} from "../../kernel/changes/snapshot.ts";
import {
	decodeGitOid,
	decodeGitRef,
	isManagedProjectRef,
	sameGitOid,
	type GitObjectFormat,
	type GitOid,
	type GitRef,
} from "../../kernel/identity/git.ts";
import {semanticDigest} from "../../kernel/identity/semantic-digest.ts";
import {decodeSha256Digest} from "../../kernel/identity/sha256.ts";
import {
	PROJECT_STORE_PORT,
	projectStoreBlobWriteRequestDigest,
	projectStoreCasRequestDigest,
	projectStoreCommitRequestDigest,
	projectStoreTreeWriteRequestDigest,
	type GitCommitIdentity,
	type ProjectStoreBlob,
	type ProjectStoreBlobRequest,
	type ProjectStoreBlobWriteReceipt,
	type ProjectStoreBlobWriteRequest,
	type ProjectStoreCasReceipt,
	type ProjectStoreCasRequest,
	type ProjectStoreCommitRequest,
	type ProjectStoreIssue,
	type ProjectStorePort,
	type ProjectStoreReadRequest,
	type ProjectStoreRefUpdate,
	type ProjectStoreTree,
	type ProjectStoreTreeEntry,
	type ProjectStoreTreeMutation,
	type ProjectStoreTreeRequest,
	type ProjectStoreTreeWriteReceipt,
	type ProjectStoreTreeWriteRequest,
} from "../../ports/project-store.ts";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_COMMIT_MESSAGE_BYTES = 1024 * 1024;
const MAX_OBJECT_BYTES = 4 * 1024 * 1024;
const MAX_TREE_MUTATIONS = 65_536;
const PROBE_OUTPUT_LIMIT_BYTES = 4_096;
const TEXT = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true});

/** Fixed Git invocation profile shared by every process this module spawns. */
const GIT_INVOCATION_OPTIONS: readonly string[] = [
	"--no-pager",
	"--no-replace-objects",
	"-c", "core.hooksPath=/dev/null",
	"-c", "core.fsmonitor=false",
	"-c", "core.attributesFile=/dev/null",
	"-c", "credential.helper=",
	"-c", "commit.gpgSign=false",
	"-c", "i18n.commitEncoding=UTF-8",
];

export interface GitProjectStoreOptions {
	readonly repositoryRoot: string;
	readonly repositoryId: string;
	readonly gitBinary?: string;
	readonly timeoutMs?: number;
	readonly maximumOutputBytes?: number;
}

type GitCommandFailure =
	| Readonly<{kind: "exit"; exitCode: number; stdoutEmpty: boolean; message: string}>
	| Readonly<{kind: "failed" | "limit" | "timeout"; message: string}>;

interface MutableTreeNode {
	readonly entries: Map<string, ProjectStoreTreeEntry>;
	readonly directories: Map<string, MutableTreeNode>;
}

class GitProjectStoreAdapter implements ProjectStorePort {
	readonly protocol = PROJECT_STORE_PORT;
	readonly #repositoryRoot: string;
	readonly #repositoryId: string;
	readonly #gitBinary: string;
	readonly #gitDir: string;
	readonly #timeoutMs: number;
	readonly #maximumOutputBytes: number;
	readonly #objectFormat: GitObjectFormat;

	constructor(options: Required<GitProjectStoreOptions>, gitDir: string, objectFormat: GitObjectFormat) {
		this.#repositoryRoot = options.repositoryRoot;
		this.#repositoryId = options.repositoryId;
		this.#gitBinary = options.gitBinary;
		this.#gitDir = gitDir;
		this.#timeoutMs = options.timeoutMs;
		this.#maximumOutputBytes = options.maximumOutputBytes;
		this.#objectFormat = objectFormat;
	}

	/**
	 * Runtime-readonly storage-format observation captured when the repository
	 * was opened; the same value backs OID and request validation below.
	 */
	get objectFormat(): GitObjectFormat {
		return this.#objectFormat;
	}

	async readSnapshot(request: ProjectStoreReadRequest): Promise<Outcome<ProjectSnapshot, ProjectStoreIssue>> {
		const preflight = this.#validateRepositoryBinding(request, "read_snapshot");
		if (preflight) return failure(preflight);
		if (typeof request.selector !== "object" || request.selector === null || !("kind" in request.selector)) {
			return failure(this.#issue("invalid_ref", "read_snapshot", "Snapshot selector is invalid."));
		}
		let revision: string;
		if (request.selector.kind === "ref") {
			const ref = decodeGitRef(request.selector.ref);
			if (!ref.ok || !isManagedProjectRef(ref.value)) return failure(this.#issue("invalid_ref", "read_snapshot", "Ref is not canonical Project Store state."));
			const current = this.#readOptionalRef(ref.value, "read_snapshot");
			if (!current.ok) return current;
			if (current.value === null) return failure(this.#issue("not_found", "read_snapshot", "Requested Project ref is absent."));
			revision = current.value.hex;
		} else {
			const oid = decodeGitOid(request.selector.oid);
			if (!oid.ok || oid.value.algorithm !== this.#objectFormat) return failure(this.#issue("invalid_object", "read_snapshot", "Commit OID is invalid."));
			revision = oid.value.hex;
		}
		const resolved = this.#text(["rev-parse", "--verify", "--end-of-options", `${revision}^{commit}`], "read_snapshot");
		if (!resolved.ok) return failure(this.#commandIssue(resolved.error, "read_snapshot", "Commit could not be resolved."));
		const oid = this.#oid(resolved.value.trim(), "read_snapshot");
		if (!oid.ok) return oid;
		return this.#readCommitSnapshot(oid.value);
	}

	async readBlob(request: ProjectStoreBlobRequest): Promise<Outcome<ProjectStoreBlob, ProjectStoreIssue>> {
		const preflight = this.#validateRepositoryBinding(request, "read_blob");
		if (preflight) return failure(preflight);
		const commit = decodeGitOid(request.commit);
		if (!commit.ok || commit.value.algorithm !== this.#objectFormat || !validRepositoryPath(request.path)) {
			return failure(this.#issue("invalid_object", "read_blob", "Blob commit or path is invalid."));
		}
		if (!Number.isSafeInteger(request.maximumBytes) || request.maximumBytes < 1 || request.maximumBytes > this.#maximumOutputBytes) {
			return failure(this.#issue("limit_exceeded", "read_blob", "Blob byte limit is invalid."));
		}
		const complete = this.#assertCompleteCommit(commit.value, "read_blob");
		if (!complete.ok) return complete;
		const listed = this.#text(["ls-tree", "-z", "--full-tree", commit.value.hex, "--", `:(literal)${request.path}`], "read_blob");
		if (!listed.ok) return failure(this.#commandIssue(listed.error, "read_blob", "Blob path could not be resolved."));
		const match = /^([0-7]{6}) blob ([0-9a-f]+)\t([^\0]+)\0$/u.exec(listed.value);
		const oid = match && match[3] === request.path ? this.#oid(match[2] as string, "read_blob") : null;
		if (!oid?.ok) return failure(this.#issue("invalid_object", "read_blob", "Requested path is absent or is not a blob."));
		const content = this.#bytes(["cat-file", "blob", oid.value.hex], "read_blob", request.maximumBytes);
		if (!content.ok) return failure(this.#commandIssue(content.error, "read_blob", "Blob could not be read."));
		return success(Object.freeze({oid: oid.value, bytes: new Uint8Array(content.value)}));
	}

	async readTree(request: ProjectStoreTreeRequest): Promise<Outcome<ProjectStoreTree, ProjectStoreIssue>> {
		const preflight = this.#validateRepositoryBinding(request, "read_tree");
		if (preflight) return failure(preflight);
		const commit = decodeGitOid(request.commit);
		if (!commit.ok || commit.value.algorithm !== this.#objectFormat) {
			return failure(this.#issue("invalid_object", "read_tree", "Tree commit OID is invalid."));
		}
		if (request.pathPrefix !== "" && !validTreePrefix(request.pathPrefix)) {
			return failure(this.#issue("invalid_object", "read_tree", "Tree path prefix is invalid."));
		}
		if (!Number.isSafeInteger(request.maximumEntries) || request.maximumEntries < 1 || request.maximumEntries > 65_536) {
			return failure(this.#issue("limit_exceeded", "read_tree", "Tree entry limit is invalid."));
		}
		const complete = this.#assertCompleteCommit(commit.value, "read_tree");
		if (!complete.ok) return complete;
		const args = ["ls-tree", "-r", "-z", "--full-tree", commit.value.hex];
		if (request.pathPrefix !== "") args.push("--", `:(literal)${request.pathPrefix}`);
		const listed = this.#text(args, "read_tree");
		if (!listed.ok) return failure(this.#commandIssue(listed.error, "read_tree", "Tree could not be listed."));
		const records = listed.value.split("\0");
		if (records.pop() !== "") return failure(this.#issue("invalid_object", "read_tree", "Git tree listing was not NUL-terminated."));
		if (records.length > request.maximumEntries) {
			return failure(this.#issue("limit_exceeded", "read_tree", `Tree exceeds ${request.maximumEntries} entries.`));
		}
		const entries: ProjectStoreTreeEntry[] = [];
		let previousPath = "";
		for (const record of records) {
			const separator = record.indexOf("\t");
			const metadata = separator < 0 ? "" : record.slice(0, separator);
			const path = separator < 0 ? "" : record.slice(separator + 1);
			const match = /^([0-7]{6}) (blob|commit) ([0-9a-f]+)$/u.exec(metadata);
			if (!match || path.length === 0 || (previousPath.length > 0 && previousPath >= path) ||
				(request.pathPrefix !== "" && !(path === request.pathPrefix || path.startsWith(`${request.pathPrefix}/`)))) {
				return failure(this.#issue("invalid_object", "read_tree", "Git returned a malformed or non-canonical tree listing."));
			}
			const object = this.#oid(match[3] as string, "read_tree");
			if (!object.ok) return object;
			entries.push(Object.freeze({
				path,
				mode: match[1] as string,
				kind: match[2] as "blob" | "commit",
				oid: object.value,
			}));
			previousPath = path;
		}
		return success(Object.freeze({commit: commit.value, entries: Object.freeze(entries)}));
	}

	async writeBlob(request: ProjectStoreBlobWriteRequest): Promise<Outcome<ProjectStoreBlobWriteReceipt, ProjectStoreIssue>> {
		const preflight = this.#validateBlobWriteRequest(request);
		if (preflight) return failure(preflight);
		const written = this.#spawn(["hash-object", "-w", "--stdin"], Buffer.from(request.bytes), undefined, 4_096);
		if (!written.ok) return failure(this.#commandIssue(written.error, "write_blob", "Blob object creation failed."));
		const oid = this.#observedOid(written.value, "write_blob");
		if (!oid.ok) return oid;
		const stored = this.#bytes(["cat-file", "blob", oid.value.hex], "write_blob", request.bytes.byteLength + 1);
		if (!stored.ok) return failure(this.#commandIssue(stored.error, "write_blob", "Created blob could not be verified."));
		if (!stored.value.equals(Buffer.from(request.bytes))) {
			return failure(this.#issue("invalid_object", "write_blob", "Created blob differs from requested exact bytes."));
		}
		const body = Object.freeze({
			repositoryId: this.#repositoryId,
			objectFormat: this.#objectFormat,
			oid: oid.value,
			byteLength: request.bytes.byteLength,
			authorizationId: request.authorizationId,
			requestDigest: request.requestDigest,
		});
		const digest = semanticDigest("codewiki.project-store.write-blob-receipt@1.0.0", body);
		return digest.ok
			? success(Object.freeze({...body, receiptDigest: digest.value}))
			: failure(this.#issue("command_failed", "write_blob", digest.error.message));
	}

	async writeTree(request: ProjectStoreTreeWriteRequest): Promise<Outcome<ProjectStoreTreeWriteReceipt, ProjectStoreIssue>> {
		const preflight = this.#validateTreeWriteRequest(request);
		if (preflight) return failure(preflight);
		const entries = new Map<string, ProjectStoreTreeEntry>();
		if (request.baseTree !== null) {
			const base = this.#readTreeObject(request.baseTree, "write_tree");
			if (!base.ok) return base;
			for (const entry of base.value) entries.set(entry.path, entry);
		}
		for (const mutation of request.mutations) {
			if (mutation.oid === null) entries.delete(mutation.path);
			else entries.set(mutation.path, Object.freeze({path: mutation.path, mode: mutation.mode, kind: mutation.kind, oid: mutation.oid}));
		}
		const written = this.#writeFlatTree([...entries.values()]);
		if (!written.ok) return written;
		const body = Object.freeze({
			repositoryId: this.#repositoryId,
			objectFormat: this.#objectFormat,
			baseTree: request.baseTree,
			tree: written.value,
			changedPaths: Object.freeze(request.mutations.map((entry) => entry.path)),
			authorizationId: request.authorizationId,
			requestDigest: request.requestDigest,
		});
		const digest = semanticDigest("codewiki.project-store.write-tree-receipt@1.0.0", body);
		return digest.ok
			? success(Object.freeze({...body, receiptDigest: digest.value}))
			: failure(this.#issue("command_failed", "write_tree", digest.error.message));
	}

	async createCommit(request: ProjectStoreCommitRequest): Promise<Outcome<GitOid, ProjectStoreIssue>> {
		const preflight = this.#validateCommitRequest(request);
		if (preflight) return failure(preflight);
		const tree = decodeGitOid(request.tree);
		if (!tree.ok) return failure(this.#issue("invalid_object", "create_commit", tree.error.message));
		const treeType = this.#objectType(tree.value, "create_commit");
		if (!treeType.ok) return treeType;
		if (treeType.value !== "tree") return failure(this.#issue("invalid_object", "create_commit", "Commit tree object is absent or has wrong type."));
		for (const parent of request.parents) {
			const complete = this.#assertCompleteCommit(parent, "create_commit");
			if (!complete.ok) return complete;
		}
		const args = ["commit-tree", tree.value.hex];
		for (const parent of request.parents) args.push("-p", parent.hex);
		args.push("-F", "-");
		const environment = {
			GIT_AUTHOR_NAME: request.author.name,
			GIT_AUTHOR_EMAIL: request.author.email,
			GIT_AUTHOR_DATE: request.author.timestamp,
			GIT_COMMITTER_NAME: request.committer.name,
			GIT_COMMITTER_EMAIL: request.committer.email,
			GIT_COMMITTER_DATE: request.committer.timestamp,
		};
		const created = this.#spawn(args, Buffer.from(request.message, "utf8"), environment);
		if (!created.ok) return failure(this.#commandIssue(created.error, "create_commit", "Commit object creation failed."));
		const oid = this.#observedOid(created.value, "create_commit");
		if (!oid.ok) return oid;
		const complete = await this.#readCommitSnapshot(oid.value);
		if (!complete.ok) return failure(complete.error);
		const rawCommit = this.#text(["cat-file", "commit", oid.value.hex], "create_commit");
		if (!rawCommit.ok) return failure(this.#commandIssue(rawCommit.error, "create_commit", "Created commit could not be verified."));
		if (rawCommit.value.slice(rawCommit.value.indexOf("\n\n") + 2) !== request.message) {
			return failure(this.#issue("invalid_object", "create_commit", "Created commit message differs from requested exact bytes."));
		}
		if (!sameGitOid(complete.value.tree, tree.value) || !sameOidList(complete.value.parents, request.parents)) {
			return failure(this.#issue("invalid_object", "create_commit", "Created commit does not match requested tree/parents."));
		}
		return success(oid.value);
	}

	async compareAndSwapRefs(request: ProjectStoreCasRequest): Promise<Outcome<ProjectStoreCasReceipt, ProjectStoreIssue>> {
		const preflight = this.#validateCasRequest(request);
		if (preflight) return failure(preflight);
		const before: (GitOid | null)[] = [];
		let alreadyApplied = true;
		for (const update of request.updates) {
			const current = this.#readOptionalRef(update.ref);
			if (!current.ok) return current;
			before.push(current.value);
			if (!optionalOidEqual(current.value, update.newOid)) alreadyApplied = false;
		}
		if (!alreadyApplied) {
			for (let index = 0; index < request.updates.length; index += 1) {
				if (!optionalOidEqual(before[index] ?? null, request.updates[index]?.expectedOld ?? null)) {
					return failure(this.#issue("stale_ref", "cas", "Expected ref set differs from current Project state."));
				}
			}
			const zero = "0".repeat(this.#objectFormat === "sha1" ? 40 : 64);
			const input = ["start"];
			for (const update of request.updates) input.push(`update ${update.ref} ${update.newOid.hex} ${update.expectedOld?.hex ?? zero}`);
			input.push("prepare", "commit", "");
			const updated = this.#text(["update-ref", "--stdin", "--create-reflog", "-m", request.reflogMessage], "cas", input.join("\n"));
			if (!updated.ok) {
				const reconciled = this.#allRefsEqual(request.updates);
				if (reconciled.ok && reconciled.value) alreadyApplied = true;
				else {
					if (reconciled.ok && updated.error.kind === "exit") {
						const unchanged = this.#allRefsEqual(request.updates, "expectedOld");
						if (unchanged.ok && !unchanged.value) {
							return failure(this.#issue("stale_ref", "cas", "Observed refs differ from expected values after the failed update."));
						}
					}
					return failure(this.#commandIssue(updated.error, "cas", "Atomic ref compare-and-swap failed; desired values could not be reconciled."));
				}
			}
		}
		const verified = this.#allRefsEqual(request.updates);
		if (!verified.ok) return verified;
		if (!verified.value) return failure(this.#issue("command_failed", "cas", "Atomic ref update completed without verifiable resulting values."));
		const receipt = {
			repositoryId: this.#repositoryId,
			objectFormat: this.#objectFormat,
			updates: Object.freeze(request.updates.map((entry) => Object.freeze({ref: entry.ref, oldOid: entry.expectedOld, newOid: entry.newOid}))),
			status: alreadyApplied ? "reconciled" as const : "applied" as const,
			authorizationId: request.authorizationId,
			requestDigest: request.requestDigest,
		};
		const digest = semanticDigest("codewiki.project-store-cas-receipt@1.1.0", receipt);
		if (!digest.ok) return failure(this.#issue("command_failed", "cas", digest.error.message));
		return success(Object.freeze({...receipt, receiptDigest: digest.value}));
	}

	#readTreeObject(tree: GitOid, operation: ProjectStoreIssue["operation"]): Outcome<readonly ProjectStoreTreeEntry[], ProjectStoreIssue> {
		if (tree.algorithm !== this.#objectFormat) return failure(this.#issue("invalid_object", operation, "Tree object format differs from repository."));
		const type = this.#objectType(tree, operation);
		if (!type.ok) return type;
		if (type.value !== "tree") return failure(this.#issue("invalid_object", operation, "Base tree object is absent or has wrong type."));
		const listed = this.#text(["ls-tree", "-r", "-z", "--full-tree", tree.hex], operation);
		if (!listed.ok) return failure(this.#commandIssue(listed.error, operation, "Tree object could not be listed."));
		const records = listed.value.split("\0");
		if (records.pop() !== "" || records.length > MAX_TREE_MUTATIONS) return failure(this.#issue("limit_exceeded", operation, "Tree object exceeds the supported entry bound."));
		const entries: ProjectStoreTreeEntry[] = [];
		let previousPath = "";
		for (const record of records) {
			const separator = record.indexOf("\t");
			const metadata = separator < 0 ? "" : record.slice(0, separator);
			const path = separator < 0 ? "" : record.slice(separator + 1);
			const match = /^([0-7]{6}) (blob|commit) ([0-9a-f]+)$/u.exec(metadata);
			const oid = match ? this.#oid(match[3] as string, operation) : null;
			if (!match || !oid?.ok || !validRepositoryPath(path) || (previousPath !== "" && previousPath >= path)) {
				return failure(this.#issue("invalid_object", operation, "Git returned a malformed tree object."));
			}
			entries.push(Object.freeze({path, mode: match[1] as string, kind: match[2] as "blob" | "commit", oid: oid.value}));
			previousPath = path;
		}
		return success(Object.freeze(entries));
	}

	#writeFlatTree(entries: readonly ProjectStoreTreeEntry[]): Outcome<GitOid, ProjectStoreIssue> {
		const node = (): MutableTreeNode => ({entries: new Map(), directories: new Map()});
		const root = node();
		for (const entry of entries) {
			const segments = entry.path.split("/");
			let cursor = root;
			for (const segment of segments.slice(0, -1)) {
				if (cursor.entries.has(segment)) return failure(this.#issue("invalid_object", "write_tree", "Tree path collides with a file entry."));
				let directory = cursor.directories.get(segment);
				if (!directory) {
					directory = node();
					cursor.directories.set(segment, directory);
				}
				cursor = directory;
			}
			const name = segments.at(-1) as string;
			if (cursor.directories.has(name) || cursor.entries.has(name)) return failure(this.#issue("invalid_object", "write_tree", "Tree path identity is duplicated or colliding."));
			cursor.entries.set(name, entry);
		}
		const materialize = (current: MutableTreeNode): Outcome<GitOid, ProjectStoreIssue> => {
			const values: Readonly<{name: string; mode: string; kind: "blob" | "commit" | "tree"; oid: GitOid}>[] = [];
			for (const [name, entry] of current.entries) values.push({name, mode: entry.mode, kind: entry.kind, oid: entry.oid});
			for (const [name, directory] of current.directories) {
				const child = materialize(directory);
				if (!child.ok) return child;
				values.push({name, mode: "040000", kind: "tree", oid: child.value});
			}
			values.sort((left, right) => Buffer.compare(Buffer.from(`${left.name}${left.kind === "tree" ? "/" : ""}`, "utf8"), Buffer.from(`${right.name}${right.kind === "tree" ? "/" : ""}`, "utf8")));
			const payload = Buffer.concat(values.map((entry) => Buffer.from(`${entry.mode} ${entry.kind} ${entry.oid.hex}\t${entry.name}\0`, "utf8")));
			const created = this.#spawn(["mktree", "-z"], payload, undefined, 4_096);
			if (!created.ok) return failure(this.#commandIssue(created.error, "write_tree", "Tree object creation failed."));
			return this.#observedOid(created.value, "write_tree");
		};
		return materialize(root);
	}

	#allRefsEqual(updates: readonly ProjectStoreRefUpdate[], target: "newOid" | "expectedOld" = "newOid"): Outcome<boolean, ProjectStoreIssue> {
		for (const update of updates) {
			const current = this.#readOptionalRef(update.ref);
			if (!current.ok) return current;
			if (!optionalOidEqual(current.value, update[target])) return success(false);
		}
		return success(true);
	}

	async #readCommitSnapshot(oid: GitOid): Promise<Outcome<ProjectSnapshot, ProjectStoreIssue>> {
		const complete = this.#assertCompleteCommit(oid, "read_snapshot");
		if (!complete.ok) return complete;
		const metadata = this.#text(["show", "-s", "--format=%T%n%P", oid.hex], "read_snapshot");
		if (!metadata.ok) return failure(this.#commandIssue(metadata.error, "read_snapshot", "Commit metadata could not be read."));
		const [treeHex = "", parentLine = ""] = metadata.value.replace(/\n$/u, "").split("\n");
		const tree = this.#oid(treeHex, "read_snapshot");
		if (!tree.ok) return tree;
		const parents: GitOid[] = [];
		for (const hex of parentLine.length === 0 ? [] : parentLine.split(" ")) {
			const parent = this.#oid(hex, "read_snapshot");
			if (!parent.ok) return parent;
			parents.push(parent.value);
		}
		const snapshot = createProjectSnapshot({
			repositoryId: this.#repositoryId,
			objectFormat: this.#objectFormat,
			commit: oid,
			tree: tree.value,
			parents,
			complete: true,
		});
		return snapshot.ok
			? success(snapshot.value)
			: failure(this.#issue("invalid_object", "read_snapshot", snapshot.error.message));
	}

	#assertCompleteCommit(oid: GitOid, operation: ProjectStoreIssue["operation"]): Outcome<null, ProjectStoreIssue> {
		if (oid.algorithm !== this.#objectFormat) return failure(this.#issue("invalid_object", operation, "OID object format differs from repository."));
		const type = this.#objectType(oid, operation);
		if (!type.ok) return type;
		if (type.value !== "commit") return failure(this.#issue("invalid_object", operation, "Object is absent or not a commit."));
		const closure = this.#text(["rev-list", "--objects", "--missing=print", oid.hex, "--"], operation);
		if (!closure.ok) return failure(this.#commandIssue(closure.error, operation, "Commit closure could not be traversed."));
		if (closure.value.split("\n").some((line) => line.startsWith("?"))) return failure(this.#issue("incomplete_object", operation, "Commit closure contains missing objects."));
		return success(null);
	}

	#objectType(oid: GitOid, operation: ProjectStoreIssue["operation"]): Outcome<"commit" | "tree" | "blob" | "tag" | null, ProjectStoreIssue> {
		const result = this.#text(["cat-file", "--batch-check=%(objectname) %(objecttype)"], operation, `${oid.hex}\n`);
		if (!result.ok) return failure(this.#commandIssue(result.error, operation, "Object type could not be observed."));
		if (result.value === `${oid.hex} missing\n`) return success(null);
		for (const type of ["commit", "tree", "blob", "tag"] as const) {
			if (result.value === `${oid.hex} ${type}\n`) return success(type);
		}
		return failure(this.#issue("command_failed", operation, "Object type response did not match the exact requested OID and record format."));
	}

	#readOptionalRef(ref: GitRef, operation: ProjectStoreIssue["operation"] = "cas"): Outcome<GitOid | null, ProjectStoreIssue> {
		// --exists distinguishes absence (2) from lookup failure (1 or another exit).
		// The subsequent hash query resolves the OID once; a race between probes fails closed.
		const exists = this.#text(["show-ref", "--exists", ref], operation);
		if (!exists.ok) return exists.error.kind === "exit" && exists.error.exitCode === 2 && exists.error.stdoutEmpty
			? success(null)
			: failure(this.#commandIssue(exists.error, operation, "Ref existence could not be observed."));
		if (exists.value !== "") return failure(this.#issue("command_failed", operation, "Ref existence response was malformed."));
		const value = this.#spawn(["show-ref", "--verify", "--hash", ref]);
		if (!value.ok) return failure(this.#commandIssue(value.error, operation, "Ref could not be resolved after observing its existence."));
		return this.#observedOid(value.value, operation);
	}

	#validateRepositoryBinding(
		request: Readonly<{repositoryId: string; objectFormat: GitObjectFormat}>,
		operation: ProjectStoreIssue["operation"],
	): ProjectStoreIssue | null {
		if (typeof request !== "object" || request === null || request.repositoryId !== this.#repositoryId || request.objectFormat !== this.#objectFormat) {
			return this.#issue("repository_mismatch", operation, "Request repository identity or object format differs from adapter." );
		}
		return null;
	}

	#validateBlobWriteRequest(request: ProjectStoreBlobWriteRequest): ProjectStoreIssue | null {
		const binding = this.#validateRepositoryBinding(request, "write_blob");
		if (binding) return binding;
		const digest = projectStoreBlobWriteRequestDigest(request);
		if (!(request.bytes instanceof Uint8Array) || request.bytes.byteLength > MAX_OBJECT_BYTES) return this.#issue("limit_exceeded", "write_blob", "Blob bytes are invalid or exceed the write bound.");
		if (!validAuthority(request.authorizationId) || !decodeSha256Digest(request.requestDigest).ok || !digest.ok || digest.value !== request.requestDigest) {
			return this.#issue("authorization_binding_invalid", "write_blob", "Blob write authorization binding is invalid.");
		}
		return null;
	}

	#validateTreeWriteRequest(request: ProjectStoreTreeWriteRequest): ProjectStoreIssue | null {
		const binding = this.#validateRepositoryBinding(request, "write_tree");
		if (binding) return binding;
		const digest = projectStoreTreeWriteRequestDigest(request);
		if (!validAuthority(request.authorizationId) || !decodeSha256Digest(request.requestDigest).ok || !digest.ok || digest.value !== request.requestDigest) {
			return this.#issue("authorization_binding_invalid", "write_tree", "Tree write authorization binding is invalid.");
		}
		if (request.baseTree !== null && (!decodeGitOid(request.baseTree).ok || request.baseTree.algorithm !== this.#objectFormat)) return this.#issue("invalid_object", "write_tree", "Base tree identity is invalid.");
		if (!Array.isArray(request.mutations) || request.mutations.length < 1 || request.mutations.length > MAX_TREE_MUTATIONS) return this.#issue("limit_exceeded", "write_tree", "Tree mutation count is invalid.");
		let previousPath = "";
		for (const mutation of request.mutations) {
			if (!validRepositoryPath(mutation.path) || (previousPath !== "" && previousPath >= mutation.path)) return this.#issue("invalid_object", "write_tree", "Tree mutation paths must be portable, sorted, and unique.");
			previousPath = mutation.path;
			if (mutation.oid === null) {
				if (mutation.mode !== null || mutation.kind !== null) return this.#issue("invalid_object", "write_tree", "Tree deletion must contain only null object fields.");
				continue;
			}
			if (!decodeGitOid(mutation.oid).ok || mutation.oid.algorithm !== this.#objectFormat || !validMutableEntry(mutation)) return this.#issue("invalid_object", "write_tree", "Tree mutation object or mode is invalid.");
			const actualType = this.#objectType(mutation.oid, "write_tree");
			if (!actualType.ok) return actualType.error;
			if (actualType.value !== mutation.kind) return this.#issue("invalid_object", "write_tree", "Tree mutation object is absent or has wrong type.");
		}
		return null;
	}

	#validateCommitRequest(request: ProjectStoreCommitRequest): ProjectStoreIssue | null {
		const binding = this.#validateRepositoryBinding(request, "create_commit");
		if (binding) return binding;
		const requestDigest = projectStoreCommitRequestDigest(request);
		if (!validAuthority(request.authorizationId) || !decodeSha256Digest(request.requestDigest).ok || !requestDigest.ok || requestDigest.value !== request.requestDigest) {
			return this.#issue("authorization_binding_invalid", "create_commit", "Commit authorization binding is invalid.");
		}
		if (!Array.isArray(request.parents) || request.parents.length > 8 || !request.parents.every((parent) => decodeGitOid(parent).ok && parent.algorithm === this.#objectFormat)) return this.#issue("invalid_object", "create_commit", "Commit parents are invalid or exceed bound.");
		if (!decodeGitOid(request.tree).ok || request.tree.algorithm !== this.#objectFormat) return this.#issue("invalid_object", "create_commit", "Commit tree is invalid.");
		if (!validMessage(request.message)) return this.#issue("limit_exceeded", "create_commit", "Commit message is not bounded canonical text.");
		if (!validCommitIdentity(request.author) || !validCommitIdentity(request.committer)) return this.#issue("invalid_object", "create_commit", "Commit identity or timestamp is invalid.");
		return null;
	}

	#validateCasRequest(request: ProjectStoreCasRequest): ProjectStoreIssue | null {
		const binding = this.#validateRepositoryBinding(request, "cas");
		if (binding) return binding;
		const requestDigest = projectStoreCasRequestDigest(request);
		if (!validAuthority(request.authorizationId) || !decodeSha256Digest(request.requestDigest).ok || !requestDigest.ok || requestDigest.value !== request.requestDigest) {
			return this.#issue("authorization_binding_invalid", "cas", "CAS authorization binding is invalid.");
		}
		if (!Array.isArray(request.updates) || request.updates.length < 1 || request.updates.length > 64) return this.#issue("limit_exceeded", "cas", "CAS update count is invalid.");
		let previousRef = "";
		for (const update of request.updates) {
			const ref = decodeGitRef(update.ref);
			if (!ref.ok || !isManagedProjectRef(ref.value) || (previousRef !== "" && previousRef >= ref.value)) return this.#issue("invalid_ref", "cas", "CAS refs must be managed, sorted, and unique.");
			previousRef = ref.value;
			if (!decodeGitOid(update.newOid).ok || update.newOid.algorithm !== this.#objectFormat) return this.#issue("invalid_object", "cas", "CAS new OID is invalid.");
			if (update.expectedOld !== null && (!decodeGitOid(update.expectedOld).ok || update.expectedOld.algorithm !== this.#objectFormat)) return this.#issue("invalid_object", "cas", "CAS expected old OID is invalid.");
			const complete = this.#assertCompleteCommit(update.newOid, "cas");
			if (!complete.ok) return complete.error;
		}
		if (!validMessage(request.reflogMessage, 1_024, false)) return this.#issue("limit_exceeded", "cas", "Reflog message is invalid.");
		return null;
	}

	#observedOid(bytes: Buffer, operation: ProjectStoreIssue["operation"]): Outcome<GitOid, ProjectStoreIssue> {
		let text: string;
		try {
			text = TEXT.decode(bytes);
		} catch {
			return failure(this.#issue("command_failed", operation, "Git OID response was not valid UTF-8."));
		}
		const oid = decodeGitOid({algorithm: this.#objectFormat, hex: text.slice(0, -1)});
		if (!text.endsWith("\n") || !oid.ok) return failure(this.#issue("command_failed", operation, "Git response was not one exact OID line."));
		return success(oid.value);
	}

	#oid(hex: string, operation: ProjectStoreIssue["operation"]): Outcome<GitOid, ProjectStoreIssue> {
		const decoded = decodeGitOid({algorithm: this.#objectFormat, hex});
		return decoded.ok ? success(decoded.value) : failure(this.#issue("invalid_object", operation, decoded.error.message));
	}

	#text(
		args: readonly string[],
		operation: ProjectStoreIssue["operation"],
		input?: string,
		extraEnvironment?: Readonly<Record<string, string>>,
	): Outcome<string, GitCommandFailure> {
		const result = this.#spawn(args, input === undefined ? undefined : Buffer.from(input, "utf8"), extraEnvironment);
		if (!result.ok) return result;
		try {
			return success(TEXT.decode(result.value));
		} catch {
			return failure({kind: "failed", message: `${operation} returned invalid UTF-8.`});
		}
	}

	#bytes(
		args: readonly string[],
		_operation: ProjectStoreIssue["operation"],
		maximumBytes: number,
	): Outcome<Buffer, GitCommandFailure> {
		return this.#spawn(args, undefined, undefined, maximumBytes);
	}

	#spawn(
		args: readonly string[],
		input?: Buffer,
		extraEnvironment: Readonly<Record<string, string>> = {},
		maximumBytes = this.#maximumOutputBytes,
	): Outcome<Buffer, GitCommandFailure> {
		const commandArgs = sanitizedGitArgs(this.#gitDir, args);
		const result = spawnSync(this.#gitBinary, commandArgs, {
			cwd: this.#repositoryRoot,
			env: sanitizedEnvironment(extraEnvironment),
			input,
			encoding: "buffer",
			maxBuffer: maximumBytes,
			timeout: this.#timeoutMs,
			windowsHide: true,
			shell: false,
		});
		return interpretSpawn(result, maximumBytes);
	}

	#commandIssue(failureValue: GitCommandFailure, operation: ProjectStoreIssue["operation"], context: string): ProjectStoreIssue {
		return this.#issue(failureCodeFor(failureValue.kind), operation, `${context} ${failureValue.message}`);
	}

	#issue(code: ProjectStoreIssue["code"], operation: ProjectStoreIssue["operation"], message: string): ProjectStoreIssue {
		return Object.freeze({code, operation, message});
	}
}

/**
 * Git Project Store binding: the Project Store port plus the immutable
 * storage-format observation established when the repository was opened.
 * Existing callers that only need the port methods are unaffected.
 */
export interface GitProjectStore extends ProjectStorePort {
	readonly objectFormat: GitObjectFormat;
}

interface GitRepositoryBinding {
	readonly gitDir: string;
	readonly objectFormat: GitObjectFormat;
}

export function createGitProjectStore(options: GitProjectStoreOptions): Outcome<GitProjectStore, ProjectStoreIssue> {
	if (typeof options !== "object" || options === null || typeof options.repositoryRoot !== "string" || typeof options.repositoryId !== "string") {
		return failure(Object.freeze({code: "repository_mismatch", operation: "read_snapshot", message: "Git Project Store options are invalid."}));
	}
	const repositoryRoot = resolve(options.repositoryRoot);
	if (!isAbsolute(repositoryRoot) || !validAuthority(options.repositoryId)) {
		return failure(Object.freeze({code: "repository_mismatch", operation: "read_snapshot", message: "Git Project Store options are invalid."}));
	}
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const maximumOutputBytes = options.maximumOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
	if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000 || !Number.isSafeInteger(maximumOutputBytes) || maximumOutputBytes < 1 || maximumOutputBytes > 64 * 1024 * 1024) {
		return failure(Object.freeze({code: "limit_exceeded", operation: "read_snapshot", message: "Git Project Store process limits are invalid."}));
	}
	const gitBinary = options.gitBinary ?? "git";
	if (typeof gitBinary !== "string" || (gitBinary !== "git" && (!isAbsolute(gitBinary) || basename(gitBinary) !== "git"))) {
		return failure(Object.freeze({code: "command_failed", operation: "read_snapshot", message: "Git binary identity is invalid."}));
	}
	const resolvedOptions: Required<GitProjectStoreOptions> = {
		repositoryRoot,
		repositoryId: options.repositoryId,
		gitBinary,
		timeoutMs,
		maximumOutputBytes,
	};
	const binding = observeRepositoryBinding(resolvedOptions);
	if (!binding.ok) return binding;
	return success(new GitProjectStoreAdapter(resolvedOptions, binding.value.gitDir, binding.value.objectFormat));
}

/**
 * Establishes the actual repository location and Git-reported storage object
 * format before the adapter is constructed. Opening is a bounded, read-only
 * observation under the fixed invocation profile: the requested root must be
 * a real existing non-symbolic directory whose own `.git` entry, when
 * present, is a non-symbolic directory or regular file, and Git must resolve
 * the requested root itself — as a working-tree root or as the bare repository
 * — never an ancestor, a descendant, or the administrative directory of a
 * non-bare tree. Malformed own Git state that Git would otherwise ignore during
 * discovery (for example an invalid `.git` entry) is rejected by the location
 * check instead of falling through to an ancestor. The validated administrative
 * directory is captured so later commands reuse this exact binding; ambient
 * repository-selection variables, executable search paths, and configuration
 * overlays are excluded by the sanitized environment. These point-in-time
 * checks never write and do not establish physical custody.
 */
function observeRepositoryBinding(options: Required<GitProjectStoreOptions>): Outcome<GitRepositoryBinding, ProjectStoreIssue> {
	let rootStat: ReturnType<typeof lstatSync>;
	try {
		rootStat = lstatSync(options.repositoryRoot);
	} catch {
		return failure(openRepositoryIssue("repository_mismatch", "The repository root does not exist or could not be inspected."));
	}
	if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
		return failure(openRepositoryIssue("repository_mismatch", "The repository root must be an existing non-symbolic directory."));
	}
	let physicalRoot: string;
	try {
		physicalRoot = realpathSync(options.repositoryRoot);
	} catch {
		return failure(openRepositoryIssue("repository_mismatch", "The repository root could not be resolved to its physical path."));
	}
	try {
		const gitEntry = lstatSync(join(options.repositoryRoot, ".git"));
		if (gitEntry.isSymbolicLink() || (!gitEntry.isDirectory() && !gitEntry.isFile())) {
			return failure(openRepositoryIssue("repository_mismatch", "The repository's own Git state must be a non-symbolic directory or regular file."));
		}
	} catch (error) {
		if (!isMissingFileError(error)) {
			return failure(openRepositoryIssue("repository_mismatch", "The repository's own Git state could not be inspected."));
		}
	}
	const bare = observeRepositoryMetadata(options, ["rev-parse", "--is-bare-repository"]);
	if (!bare.ok) return failure(probeIssue(bare.error, "The repository could not be observed."));
	if (bare.value !== "true" && bare.value !== "false") {
		return failure(openRepositoryIssue("command_failed", "Git reported an unsupported repository shape."));
	}
	const gitDir = observeRepositoryMetadata(options, ["rev-parse", "--absolute-git-dir"]);
	if (!gitDir.ok) return failure(probeIssue(gitDir.error, "The repository location could not be observed."));
	if (!isAbsolute(gitDir.value)) {
		return failure(openRepositoryIssue("command_failed", "Git did not report an absolute repository location."));
	}
	if (bare.value === "true") {
		if (gitDir.value !== physicalRoot) {
			return failure(openRepositoryIssue("repository_mismatch", "Git does not resolve the requested root as the bare repository itself."));
		}
	} else {
		if (gitDir.value === physicalRoot) {
			return failure(openRepositoryIssue("repository_mismatch", "The requested root is the administrative directory of a non-bare repository."));
		}
		const topLevel = observeRepositoryMetadata(options, ["rev-parse", "--show-toplevel"]);
		if (!topLevel.ok) return failure(probeIssue(topLevel.error, "The working-tree root could not be observed."));
		if (topLevel.value !== physicalRoot) {
			return failure(openRepositoryIssue("repository_mismatch", "Git does not resolve the requested root as the working-tree root itself."));
		}
	}
	const objectFormat = observeRepositoryMetadata(options, ["rev-parse", "--show-object-format"]);
	if (!objectFormat.ok) return failure(probeIssue(objectFormat.error, "The repository object format could not be observed."));
	if (objectFormat.value !== "sha1" && objectFormat.value !== "sha256") {
		return failure(openRepositoryIssue("command_failed", "Git reported an unsupported repository object format."));
	}
	return success(Object.freeze({gitDir: gitDir.value, objectFormat: objectFormat.value}));
}

/**
 * Runs one bounded metadata observation under the fixed invocation profile and
 * validates process error, exit status, output size, and exact single-line
 * shape before the value is interpreted. Diagnostics stay bounded and never
 * echo the observed output.
 */
function observeRepositoryMetadata(options: Required<GitProjectStoreOptions>, args: readonly string[]): Outcome<string, GitCommandFailure> {
	const result = spawnSync(options.gitBinary, discoveryGitArgs(options.repositoryRoot, args), {
		cwd: options.repositoryRoot,
		env: sanitizedEnvironment(),
		encoding: "buffer",
		maxBuffer: PROBE_OUTPUT_LIMIT_BYTES,
		timeout: options.timeoutMs,
		windowsHide: true,
		shell: false,
	});
	const output = interpretSpawn(result, PROBE_OUTPUT_LIMIT_BYTES);
	if (!output.ok) return output;
	let text: string;
	try {
		text = TEXT.decode(output.value);
	} catch {
		return failure({kind: "failed", message: "Repository observation returned invalid UTF-8."});
	}
	if (!text.endsWith("\n") || text.length < 2 || text.slice(0, -1).includes("\n") || text.includes("\0")) {
		return failure({kind: "failed", message: "Repository observation output was not a single bounded line."});
	}
	return success(text.slice(0, -1));
}

function sanitizedGitArgs(gitDir: string, args: readonly string[]): string[] {
	return [...GIT_INVOCATION_OPTIONS, "--git-dir", gitDir, ...args];
}

function discoveryGitArgs(repositoryRoot: string, args: readonly string[]): string[] {
	return [...GIT_INVOCATION_OPTIONS, "-C", repositoryRoot, ...args];
}

function probeIssue(failureValue: GitCommandFailure, context: string): ProjectStoreIssue {
	return Object.freeze({code: failureCodeFor(failureValue.kind), operation: "read_snapshot", message: `${context} ${failureValue.message}`});
}

function openRepositoryIssue(code: ProjectStoreIssue["code"], message: string): ProjectStoreIssue {
	return Object.freeze({code, operation: "read_snapshot", message});
}

function failureCodeFor(kind: GitCommandFailure["kind"]): ProjectStoreIssue["code"] {
	if (kind === "timeout") return "timeout";
	if (kind === "limit") return "limit_exceeded";
	return "command_failed";
}

function isMissingFileError(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function sanitizedEnvironment(extra: Readonly<Record<string, string>> = {}): NodeJS.ProcessEnv {
	return {
		PATH: "/usr/bin:/bin",
		HOME: "/nonexistent",
		XDG_CONFIG_HOME: "/nonexistent",
		LANG: "C",
		LC_ALL: "C",
		GIT_CONFIG_NOSYSTEM: "1",
		GIT_CONFIG_GLOBAL: "/dev/null",
		GIT_ATTR_NOSYSTEM: "1",
		GIT_TERMINAL_PROMPT: "0",
		GIT_NO_LAZY_FETCH: "1",
		GIT_OPTIONAL_LOCKS: "0",
		...extra,
	};
}

function interpretSpawn(result: SpawnSyncReturns<Buffer>, maximumBytes: number): Outcome<Buffer, GitCommandFailure> {
	if (result.error) {
		const code = (result.error as NodeJS.ErrnoException).code;
		if (code === "ETIMEDOUT") return failure({kind: "timeout", message: "Git command timed out."});
		if (code === "ENOBUFS") return failure({kind: "limit", message: `Git output exceeded ${maximumBytes} bytes.`});
		return failure({kind: "failed", message: `Git process failed: ${code ?? "unknown"}.`});
	}
	if (result.status !== 0) {
		const stderr = boundedDiagnostic(result.stderr);
		const message = `Git exited with status ${result.status ?? "signal"}${stderr.length > 0 ? `: ${stderr}` : "."}`;
		if (result.status !== null) {
			return failure({kind: "exit", exitCode: result.status, stdoutEmpty: result.stdout.length === 0, message});
		}
		return failure({kind: "failed", message});
	}
	return success(result.stdout);
}

function boundedDiagnostic(bytes: Buffer): string {
	try {
		return TEXT.decode(bytes.subarray(0, 2_048)).replace(/[\r\n\t]+/gu, " ").trim();
	} catch {
		return "invalid diagnostic bytes";
	}
}

function validAuthority(value: string): boolean {
	return typeof value === "string" && value.length <= 256 && /^[a-z][a-z0-9.-]*(?::[A-Za-z0-9][A-Za-z0-9._:@/-]*)+$/u.test(value);
}

function validTreePrefix(value: string): boolean {
	return validRepositoryPath(value);
}

function validRepositoryPath(value: string): boolean {
	const forbidden = ["\0", "\r", "\n", "\\", "*", "?", "["];
	return typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= 4_096 &&
		value.normalize("NFC") === value && !value.startsWith("/") && !value.endsWith("/") &&
		!forbidden.some((character) => value.includes(character)) &&
		value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== ".." && segment !== ".git");
}

function validMutableEntry(mutation: Exclude<ProjectStoreTreeMutation, {oid: null}>): boolean {
	return (mutation.kind === "blob" && (mutation.mode === "100644" || mutation.mode === "100755")) ||
		(mutation.kind === "commit" && mutation.mode === "160000");
}

function validMessage(value: string, maximumBytes = MAX_COMMIT_MESSAGE_BYTES, requireTerminalLf = true): boolean {
	if (typeof value !== "string") return false;
	const bytes = Buffer.byteLength(value, "utf8");
	const lineShape = requireTerminalLf
		? value.endsWith("\n") && !value.endsWith("\n\n")
		: !value.includes("\n");
	return bytes >= 1 && bytes <= maximumBytes && scalarText(value) && value.normalize("NFC") === value && !value.includes("\0") && !value.includes("\r") && lineShape;
}

function validCommitIdentity(identity: GitCommitIdentity): boolean {
	if (typeof identity !== "object" || identity === null || typeof identity.name !== "string" || typeof identity.email !== "string" || typeof identity.timestamp !== "string") return false;
	const parsedTimestamp = Date.parse(identity.timestamp);
	return identity.name.length > 0 && identity.name.length <= 256 && scalarText(identity.name) && identity.name.normalize("NFC") === identity.name &&
		identity.email.length > 2 && identity.email.length <= 320 && scalarText(identity.email) && identity.email.normalize("NFC") === identity.email && /^[^<>\s@]+@[^<>\s@]+$/u.test(identity.email) &&
		!/[\u0000\r\n<>]/u.test(identity.name) &&
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(identity.timestamp) && Number.isFinite(parsedTimestamp) &&
		new Date(parsedTimestamp).toISOString().replace(".000Z", "Z") === identity.timestamp;
}

function scalarText(value: string): boolean {
	for (let index = 0; index < value.length; index += 1) {
		const unit = value.charCodeAt(index);
		if (unit >= 0xd800 && unit <= 0xdbff) {
			const next = value.charCodeAt(index + 1);
			if (next < 0xdc00 || next > 0xdfff) return false;
			index += 1;
		} else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
	}
	return true;
}

function sameOidList(left: readonly GitOid[], right: readonly GitOid[]): boolean {
	return left.length === right.length && left.every((entry, index) => right[index] !== undefined && sameGitOid(entry, right[index] as GitOid));
}

function optionalOidEqual(left: GitOid | null, right: GitOid | null): boolean {
	return left === null ? right === null : right !== null && sameGitOid(left, right);
}
