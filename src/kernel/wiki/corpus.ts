import {failure, success, type Outcome} from "../data-contracts/outcome.ts";
import {decodeGitOid, type GitOid} from "../identity/git.ts";

export interface MarkdownCorpusLimits {
	readonly maximumEntries: number;
	readonly maximumPathBytes: number;
	readonly maximumDocuments: number;
	readonly maximumDocumentBytes: number;
	readonly maximumTotalBytes: number;
}

export interface MarkdownCorpusEntryInput {
	readonly path: string;
	readonly mode: string;
	readonly oid: GitOid;
	readonly bytes?: Uint8Array;
}

export interface MarkdownCorpusInput {
	readonly snapshot: GitOid;
	readonly entries: readonly MarkdownCorpusEntryInput[];
	readonly limits: MarkdownCorpusLimits;
}

export interface MarkdownMaterial {
	readonly path: string;
	readonly mode: "100644" | "100755";
	readonly oid: GitOid;
	readonly byteLength: number;
	/** Exact UTF-8 text, including BOM and original line endings; no byte-view alias. */
	readonly text: string;
}

export interface MarkdownCorpusExclusion {
	readonly path: string;
	readonly mode: string;
	readonly oid: GitOid;
	readonly reason: "non_markdown";
}

/** Supplied identities are claims, not authenticated objects or acceptance records. */
export interface MarkdownCorpus {
	readonly snapshot: GitOid;
	readonly documents: readonly MarkdownMaterial[];
	readonly exclusions: readonly MarkdownCorpusExclusion[];
}

export type MarkdownCorpusIssueCode =
	| "invalid_input"
	| "invalid_limits"
	| "invalid_snapshot"
	| "invalid_path"
	| "invalid_mode"
	| "invalid_oid"
	| "invalid_encoding"
	| "duplicate_path"
	| "conflicting_path"
	| "conflicting_content"
	| "limit_exceeded";

export interface MarkdownCorpusIssue {
	readonly code: MarkdownCorpusIssueCode;
	/** Input location, not unbounded or potentially private source text. */
	readonly path: string;
	readonly message: string;
}

const LIMIT_FIELDS = [
	"maximumEntries", "maximumPathBytes", "maximumDocuments",
	"maximumDocumentBytes", "maximumTotalBytes",
] as const;

/**
 * Read passive caller-supplied descriptors, not a repository or authoring format.
 * Admission must bound allocation and authenticate/access-check sources upstream.
 * This synchronous data boundary is not a sandbox for arbitrary JavaScript objects.
 */
export function readMarkdownCorpus(input: unknown): Outcome<MarkdownCorpus, MarkdownCorpusIssue> {
	const request = dataRecord(input, ["snapshot", "entries", "limits"]);
	if (!request) return issue("invalid_input", "$", "Expected a corpus request with own data fields.");
	const rawLimits = dataRecord(request.limits, LIMIT_FIELDS);
	if (!rawLimits || LIMIT_FIELDS.some((field) =>
		typeof rawLimits[field] !== "number" || !Number.isSafeInteger(rawLimits[field]) || rawLimits[field] <= 0,
	)) return issue("invalid_limits", "$.limits", "All five limits must be positive safe integers.");
	// SAFETY: dataRecord above verified all five LIMIT_FIELDS are own data properties holding
	// positive safe-integer numbers, so the values satisfy the MarkdownCorpusLimits numeric
	// invariants that TypeScript cannot infer from the Record<string, unknown> shape.
	const limits = rawLimits as unknown as MarkdownCorpusLimits;
	const snapshot = suppliedOid(request.snapshot);
	if (!snapshot) return issue("invalid_snapshot", "$.snapshot", "Expected a non-null, exact Git OID.");
	if (!Array.isArray(request.entries)) return issue("invalid_input", "$.entries", "Entries must be an array.");
	if (request.entries.length > limits.maximumEntries) {
		return issue("limit_exceeded", "$.entries", "Entry count exceeds the supplied limit.");
	}

	const pending: {material: Omit<MarkdownMaterial, "text">; bytes: Uint8Array; location: string}[] = [];
	const exclusions: MarkdownCorpusExclusion[] = [];
	const paths: PathNode = {file: false, children: new Map()};
	let totalPathBytes = 0;
	let totalBytes = 0;
	// Preflight the entire admitted scan before decoding or copying any content.
	for (let index = 0; index < request.entries.length; index += 1) {
		const location = `$.entries[${index}]`;
		const slot = Object.getOwnPropertyDescriptor(request.entries, String(index));
		const entry = slot && "value" in slot ? dataRecord(slot.value, ["path", "mode", "oid"], ["bytes"]) : null;
		if (!entry) return issue("invalid_input", location, "Expected a descriptor with own data fields.");
		if (typeof entry.path !== "string" || entry.path.length === 0) {
			return issue("invalid_path", `${location}.path`, "Path must be nonempty text.");
		}
		const pathBytes = boundedPathBytes(entry.path, limits.maximumPathBytes - totalPathBytes);
		if (pathBytes === null) return issue("invalid_path", `${location}.path`, "Path is not lossless UTF-8 text.");
		if (pathBytes === false) return issue("limit_exceeded", `${location}.path`, "Total path bytes exceed the supplied limit.");
		totalPathBytes += pathBytes;
		const segments = entry.path.split("/");
		if (entry.path.includes("\0") || entry.path.includes("\\") || /^[A-Za-z]:/u.test(entry.path) ||
			segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
			return issue("invalid_path", `${location}.path`, "Path must be an unambiguous repository-relative file path.");
		}
		const pathConflict = registerPath(paths, segments);
		if (pathConflict) return issue(pathConflict, `${location}.path`, "Paths must be unique files with no file/descendant collision.");
		const {mode} = entry;
		if (mode !== "100644" && mode !== "100755" && mode !== "120000" && mode !== "160000") {
			return issue("invalid_mode", `${location}.mode`, "Expected a tracked file or gitlink mode.");
		}
		const oid = suppliedOid(entry.oid);
		if (!oid || oid.algorithm !== snapshot.algorithm) {
			return issue("invalid_oid", `${location}.oid`, "Expected an exact OID using the snapshot object format.");
		}
		// ASCII extension case only; no Unicode normalization or path case folding.
		if (!/\.(?:md|markdown)$/i.test(entry.path)) {
			if (entry.bytes !== undefined && !(entry.bytes instanceof Uint8Array)) {
				return issue("invalid_input", `${location}.bytes`, "Optional content must be a byte array.");
			}
			exclusions.push(Object.freeze({path: entry.path, mode, oid, reason: "non_markdown"}));
			continue;
		}
		if (mode !== "100644" && mode !== "100755") {
			return issue("invalid_mode", `${location}.mode`, "Markdown material must be a regular file, never a link.");
		}
		if (pending.length >= limits.maximumDocuments) {
			return issue("limit_exceeded", location, "Document count exceeds the supplied limit.");
		}
		const {bytes} = entry;
		if (!(bytes instanceof Uint8Array) || !(bytes.buffer instanceof ArrayBuffer)) {
			return issue("invalid_input", `${location}.bytes`, "Markdown content requires a non-shared byte array.");
		}
		try {
			// Validate the view without reading content. Detached/out-of-bounds views
			// can otherwise report zero length and decode as a false empty document.
			Uint8Array.prototype.values.call(bytes);
		} catch {
			return issue("invalid_input", `${location}.bytes`, "Markdown bytes must be attached and in bounds.");
		}
		const byteLength = bytes.byteLength;
		if (byteLength > limits.maximumDocumentBytes || byteLength > limits.maximumTotalBytes - totalBytes) {
			return issue("limit_exceeded", `${location}.bytes`, "Content bytes exceed a supplied limit.");
		}
		totalBytes += byteLength;
		pending.push({material: {path: entry.path, mode, oid, byteLength}, bytes, location});
	}

	const decoder = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true});
	const documents: MarkdownMaterial[] = [];
	const objectTexts = new Map<string, string>();
	for (const {material, bytes, location} of pending) {
		let text: string;
		try {
			text = decoder.decode(bytes);
		} catch {
			return issue("invalid_encoding", `${location}.bytes`, "Markdown content is not valid UTF-8.");
		}
		const previous = objectTexts.get(material.oid.hex);
		if (previous !== undefined && previous !== text) {
			return issue("conflicting_content", `${location}.oid`, "One supplied object identity names conflicting Markdown bytes.");
		}
		objectTexts.set(material.oid.hex, text);
		documents.push(Object.freeze({...material, text}));
	}
	return success(Object.freeze({snapshot, documents: Object.freeze(documents), exclusions: Object.freeze(exclusions)}));
}

interface PathNode {
	file: boolean;
	readonly children: Map<string, PathNode>;
}

/** Segment storage is bounded by the preflighted path bytes, including exclusions. */
function registerPath(root: PathNode, segments: readonly string[]): "duplicate_path" | "conflicting_path" | null {
	let node = root;
	for (const segment of segments) {
		if (node.file) return "conflicting_path";
		let child = node.children.get(segment);
		if (!child) {
			child = {file: false, children: new Map()};
			node.children.set(segment, child);
		}
		node = child;
	}
	if (node.file) return "duplicate_path";
	if (node.children.size > 0) return "conflicting_path";
	node.file = true;
	return null;
}

/** Copy only declared own data properties; never evaluate a descriptor accessor. */
function dataRecord(input: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> | null {
	if (typeof input !== "object" || input === null) return null;
	const prototype = Object.getPrototypeOf(input);
	if (prototype !== Object.prototype && prototype !== null) return null;
	const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
	for (const field of [...required, ...optional]) {
		const descriptor = Object.getOwnPropertyDescriptor(input, field);
		if (!descriptor) {
			if (required.includes(field)) return null;
			continue;
		}
		if (!("value" in descriptor)) return null;
		result[field] = descriptor.value;
	}
	return result;
}

function suppliedOid(input: unknown): GitOid | null {
	const value = dataRecord(input, ["algorithm", "hex"]);
	if (!value || (value.algorithm !== "sha1" && value.algorithm !== "sha256") ||
		typeof value.hex !== "string" || value.hex.length > 64) return null;
	const decoded = decodeGitOid(value);
	return decoded.ok ? decoded.value : null;
}

/** Bound Unicode scanning without allocating an encoded copy of a large path. */
function boundedPathBytes(path: string, maximum: number): number | false | null {
	if (path.length > maximum) return false;
	let total = 0;
	for (const character of path) {
		const point = character.codePointAt(0);
		if (point === undefined) return null;
		if (point >= 0xD800 && point <= 0xDFFF) return null;
		let size: number;
		if (point <= 0x7F) size = 1;
		else if (point <= 0x7FF) size = 2;
		else if (point <= 0xFFFF) size = 3;
		else size = 4;
		if (size > maximum - total) return false;
		total += size;
	}
	return total;
}

function issue(code: MarkdownCorpusIssueCode, path: string, message: string): Outcome<never, MarkdownCorpusIssue> {
	return failure(Object.freeze({code, path, message}));
}
