import {spawnSync, type SpawnSyncReturns} from "node:child_process";
import {basename, isAbsolute, resolve} from "node:path";
import {failure, success, type Outcome} from "../../kernel/canonical/outcome.ts";
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
	projectStoreCasRequestDigest,
	projectStoreCommitRequestDigest,
	type GitCommitIdentity,
	type ProjectStoreBlob,
	type ProjectStoreBlobRequest,
	type ProjectStoreCasReceipt,
	type ProjectStoreCasRequest,
	type ProjectStoreCommitRequest,
	type ProjectStoreIssue,
	type ProjectStorePort,
	type ProjectStoreReadRequest,
	type ProjectStoreTree,
	type ProjectStoreTreeEntry,
	type ProjectStoreTreeRequest,
} from "../../ports/project-store.ts";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_COMMIT_MESSAGE_BYTES = 1024 * 1024;
const TEXT = new TextDecoder("utf-8", {fatal: true});

export interface GitProjectStoreOptions {
	readonly repositoryRoot: string;
	readonly repositoryId: string;
	readonly gitBinary?: string;
	readonly timeoutMs?: number;
	readonly maximumOutputBytes?: number;
}

interface GitCommandFailure {
	readonly kind: "failed" | "limit" | "timeout";
	readonly message: string;
}

class GitProjectStoreAdapter implements ProjectStorePort {
	readonly protocol = PROJECT_STORE_PORT;
	readonly #repositoryRoot: string;
	readonly #repositoryId: string;
	readonly #gitBinary: string;
	readonly #timeoutMs: number;
	readonly #maximumOutputBytes: number;
	readonly #objectFormat: GitObjectFormat;

	constructor(options: Required<GitProjectStoreOptions>, objectFormat: GitObjectFormat) {
		this.#repositoryRoot = options.repositoryRoot;
		this.#repositoryId = options.repositoryId;
		this.#gitBinary = options.gitBinary;
		this.#timeoutMs = options.timeoutMs;
		this.#maximumOutputBytes = options.maximumOutputBytes;
		this.#objectFormat = objectFormat;
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
			revision = ref.value;
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
		const oid = decodeGitOid(request.oid);
		if (!oid.ok || oid.value.algorithm !== this.#objectFormat) return failure(this.#issue("invalid_object", "read_blob", "Blob OID is invalid."));
		if (!Number.isSafeInteger(request.maximumBytes) || request.maximumBytes < 1 || request.maximumBytes > this.#maximumOutputBytes) {
			return failure(this.#issue("limit_exceeded", "read_blob", "Blob byte limit is invalid."));
		}
		const type = this.#text(["cat-file", "-t", oid.value.hex], "read_blob");
		if (!type.ok || type.value.trim() !== "blob") return failure(this.#issue("invalid_object", "read_blob", "Requested object is not a blob."));
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
		if (!validTreePrefix(request.pathPrefix)) {
			return failure(this.#issue("invalid_object", "read_tree", "Tree path prefix is invalid."));
		}
		if (!Number.isSafeInteger(request.maximumEntries) || request.maximumEntries < 1 || request.maximumEntries > 65_536) {
			return failure(this.#issue("limit_exceeded", "read_tree", "Tree entry limit is invalid."));
		}
		const complete = this.#assertCompleteCommit(commit.value, "read_tree");
		if (!complete.ok) return complete;
		const listed = this.#text([
			"ls-tree",
			"-r",
			"-z",
			"--full-tree",
			commit.value.hex,
			"--",
			`:(literal)${request.pathPrefix}`,
		], "read_tree");
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
				!(path === request.pathPrefix || path.startsWith(`${request.pathPrefix}/`))) {
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

	async createCommit(request: ProjectStoreCommitRequest): Promise<Outcome<GitOid, ProjectStoreIssue>> {
		const preflight = this.#validateCommitRequest(request);
		if (preflight) return failure(preflight);
		const tree = decodeGitOid(request.tree);
		if (!tree.ok) return failure(this.#issue("invalid_object", "create_commit", tree.error.message));
		const treeType = this.#text(["cat-file", "-t", tree.value.hex], "create_commit");
		if (!treeType.ok || treeType.value.trim() !== "tree") return failure(this.#issue("invalid_object", "create_commit", "Commit tree object is absent or has wrong type."));
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
		const created = this.#text(args, "create_commit", request.message, environment);
		if (!created.ok) return failure(this.#commandIssue(created.error, "create_commit", "Commit object creation failed."));
		const oid = this.#oid(created.value.trim(), "create_commit");
		if (!oid.ok) return oid;
		const complete = await this.#readCommitSnapshot(oid.value);
		if (!complete.ok) return failure(complete.error);
		const rawCommit = this.#text(["cat-file", "commit", oid.value.hex], "create_commit");
		if (!rawCommit.ok || rawCommit.value.slice(rawCommit.value.indexOf("\n\n") + 2) !== request.message) {
			return failure(this.#issue("invalid_object", "create_commit", "Created commit message differs from requested exact bytes."));
		}
		if (!sameGitOid(complete.value.tree, tree.value) || !sameOidList(complete.value.parents, request.parents)) {
			return failure(this.#issue("invalid_object", "create_commit", "Created commit does not match requested tree/parents."));
		}
		return success(oid.value);
	}

	async compareAndSwapRef(request: ProjectStoreCasRequest): Promise<Outcome<ProjectStoreCasReceipt, ProjectStoreIssue>> {
		const preflight = this.#validateCasRequest(request);
		if (preflight) return failure(preflight);
		const ref = decodeGitRef(request.ref);
		const newOid = decodeGitOid(request.newOid);
		if (!ref.ok || !newOid.ok) return failure(this.#issue("invalid_ref", "cas", "CAS ref or new OID is invalid."));
		const complete = this.#assertCompleteCommit(newOid.value, "cas");
		if (!complete.ok) return complete;
		const before = this.#readOptionalRef(ref.value);
		if (!before.ok) return before;
		if (!optionalOidEqual(before.value, request.expectedOld)) return failure(this.#issue("stale_ref", "cas", "Expected-old-OID compare-and-swap failed."));
		const zero = "0".repeat(this.#objectFormat === "sha1" ? 40 : 64);
		const updated = this.#text([
			"update-ref",
			"--create-reflog",
			"-m",
			request.reflogMessage,
			ref.value,
			newOid.value.hex,
			request.expectedOld?.hex ?? zero,
		], "cas");
		if (!updated.ok) {
			const current = this.#readOptionalRef(ref.value);
			if (current.ok && !optionalOidEqual(current.value, request.expectedOld)) return failure(this.#issue("stale_ref", "cas", "Ref changed before compare-and-swap."));
			return failure(this.#commandIssue(updated.error, "cas", "Ref compare-and-swap failed."));
		}
		const after = this.#readOptionalRef(ref.value);
		if (!after.ok || after.value === null || !sameGitOid(after.value, newOid.value)) {
			return failure(this.#issue("command_failed", "cas", "Ref update completed without verifiable resulting value."));
		}
		const receipt = {
			repositoryId: this.#repositoryId,
			objectFormat: this.#objectFormat,
			ref: ref.value,
			oldOid: before.value,
			newOid: newOid.value,
			authorizationId: request.authorizationId,
			requestDigest: request.requestDigest,
		};
		const digest = semanticDigest("codewiki.project-store-cas-receipt@1.0.0", receipt);
		if (!digest.ok) return failure(this.#issue("command_failed", "cas", digest.error.message));
		return success(Object.freeze({...receipt, receiptDigest: digest.value}));
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
		const type = this.#text(["cat-file", "-t", oid.hex], operation);
		if (!type.ok || type.value.trim() !== "commit") return failure(this.#issue("invalid_object", operation, "Object is absent or not a commit."));
		const closure = this.#text(["rev-list", "--objects", "--missing=print", oid.hex, "--"], operation);
		if (!closure.ok) return failure(this.#commandIssue(closure.error, operation, "Commit closure could not be traversed."));
		if (closure.value.split("\n").some((line) => line.startsWith("?"))) return failure(this.#issue("incomplete_object", operation, "Commit closure contains missing objects."));
		return success(null);
	}

	#readOptionalRef(ref: GitRef): Outcome<GitOid | null, ProjectStoreIssue> {
		const value = this.#text(["show-ref", "--verify", "--hash", ref], "cas");
		if (!value.ok) return value.error.kind === "failed" && value.error.message.includes("status 1")
			? success(null)
			: failure(this.#commandIssue(value.error, "cas", "Ref could not be read."));
		return this.#oid(value.value.trim(), "cas");
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
		const ref = decodeGitRef(request.ref);
		if (!ref.ok || !isManagedProjectRef(ref.value)) return this.#issue("invalid_ref", "cas", "Only canonical and managed Change refs may be written.");
		const requestDigest = projectStoreCasRequestDigest(request);
		if (!validAuthority(request.authorizationId) || !decodeSha256Digest(request.requestDigest).ok || !requestDigest.ok || requestDigest.value !== request.requestDigest) {
			return this.#issue("authorization_binding_invalid", "cas", "CAS authorization binding is invalid.");
		}
		if (!decodeGitOid(request.newOid).ok || request.newOid.algorithm !== this.#objectFormat) return this.#issue("invalid_object", "cas", "CAS new OID is invalid.");
		if (request.expectedOld !== null && (!decodeGitOid(request.expectedOld).ok || request.expectedOld.algorithm !== this.#objectFormat)) return this.#issue("invalid_object", "cas", "CAS expected old OID is invalid.");
		if (!validMessage(request.reflogMessage, 1_024, false)) return this.#issue("limit_exceeded", "cas", "Reflog message is invalid.");
		return null;
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
		const commandArgs = [
			"--no-pager",
			"--no-replace-objects",
			"-c", "core.hooksPath=/dev/null",
			"-c", "core.fsmonitor=false",
			"-c", "core.attributesFile=/dev/null",
			"-c", "credential.helper=",
			"-c", "commit.gpgSign=false",
			"-c", "i18n.commitEncoding=UTF-8",
			"-C", this.#repositoryRoot,
			...args,
		];
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
		let code: ProjectStoreIssue["code"] = "command_failed";
		if (failureValue.kind === "timeout") code = "timeout";
		else if (failureValue.kind === "limit") code = "limit_exceeded";
		return this.#issue(code, operation, `${context} ${failureValue.message}`);
	}

	#issue(code: ProjectStoreIssue["code"], operation: ProjectStoreIssue["operation"], message: string): ProjectStoreIssue {
		return Object.freeze({code, operation, message});
	}
}

export function createGitProjectStore(options: GitProjectStoreOptions): Outcome<ProjectStorePort, ProjectStoreIssue> {
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
	const probe = spawnSync(resolvedOptions.gitBinary, sanitizedGitArgs(repositoryRoot, ["rev-parse", "--show-object-format"]), {
		cwd: repositoryRoot,
		env: sanitizedEnvironment(),
		encoding: "utf8",
		maxBuffer: 4_096,
		timeout: timeoutMs,
		windowsHide: true,
		shell: false,
	});
	if (probe.status !== 0 || (probe.stdout !== "sha1\n" && probe.stdout !== "sha256\n")) {
		return failure(Object.freeze({code: "command_failed", operation: "read_snapshot", message: "Repository object format could not be established."}));
	}
	return success(new GitProjectStoreAdapter(resolvedOptions, probe.stdout.trim() as GitObjectFormat));
}

function sanitizedGitArgs(repositoryRoot: string, args: readonly string[]): string[] {
	return [
		"--no-pager",
		"--no-replace-objects",
		"-c", "core.hooksPath=/dev/null",
		"-c", "core.fsmonitor=false",
		"-c", "core.attributesFile=/dev/null",
		"-c", "credential.helper=",
		"-c", "commit.gpgSign=false",
		"-c", "i18n.commitEncoding=UTF-8",
		"-C", repositoryRoot,
		...args,
	];
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
		return failure({kind: "failed", message: `Git exited with status ${result.status ?? "signal"}${stderr.length > 0 ? `: ${stderr}` : "."}`});
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
	const forbidden = ["\0", "\r", "\n", "\\", "*", "?", "["];
	return typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= 4_096 &&
		value.normalize("NFC") === value && !value.startsWith("/") && !forbidden.some((character) => value.includes(character)) &&
		value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
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
