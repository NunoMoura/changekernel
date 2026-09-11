import {failure, success, type Outcome} from "../data-contracts/outcome.ts";
import {decodeGitOid, type GitOid} from "../identity/git.ts";

export const WIKI_PROFILE_ID = "codewiki.wiki-profile@1.0.0" as const;

export interface WikiProfileLimits {
	readonly fileBytes: number;
	readonly headerBytes: number;
	readonly pathBytes: number;
	readonly depth: number;
	readonly nodes: number;
	readonly collectionEntries: number;
	readonly files: number;
	readonly contextBytes: number;
}

export interface WikiProfile {
	readonly id: "codewiki.wiki-profile";
	readonly version: "1.0.0";
	readonly identifier: typeof WIKI_PROFILE_ID;
	readonly limits: WikiProfileLimits;
}

export const WIKI_PROFILE_LIMITS: WikiProfileLimits = Object.freeze({
	fileBytes: 1024 * 1024,
	headerBytes: 64 * 1024,
	pathBytes: 4096,
	depth: 32,
	nodes: 8192,
	collectionEntries: 1024,
	files: 512,
	contextBytes: 8 * 1024 * 1024,
});

export const WIKI_PROFILE: WikiProfile = Object.freeze({
	id: "codewiki.wiki-profile",
	version: "1.0.0",
	identifier: WIKI_PROFILE_ID,
	limits: WIKI_PROFILE_LIMITS,
});

export const WIKI_CORE_TYPES = Object.freeze([
	"Definition",
	"Entity",
	"Contract",
	"Procedure",
	"Claim",
	"TypeDefinition",
] as const);
export type WikiCoreType = typeof WIKI_CORE_TYPES[number];
export type WikiBaseType = Exclude<WikiCoreType, "TypeDefinition">;
export type WikiValue = null | boolean | number | string | readonly WikiValue[] | WikiMapping;
export interface WikiMapping {readonly [key: string]: WikiValue}

export interface WikiIssue {
	readonly code:
		| "unsupported_profile"
		| "invalid_file"
		| "invalid_yaml"
		| "invalid_metadata"
		| "invalid_heading"
		| "invalid_type"
		| "unresolved_type"
		| "limit_exceeded";
	readonly path: string;
	readonly message: string;
}

export interface WikiReference {
	readonly reference: string;
	readonly path: string;
}

export interface WikiMetadata {
	readonly fields: WikiMapping;
	readonly type: string;
	readonly title: string;
	readonly origins: readonly WikiReference[];
	readonly revision: WikiReference;
	readonly base?: WikiBaseType;
}

export interface ProfiledWikiFile {
	readonly profile: typeof WIKI_PROFILE_ID;
	readonly path: string;
	readonly blob: GitOid;
	readonly byteLength: number;
	readonly text: string;
	readonly body: string;
	readonly metadata: WikiMetadata;
}

export interface WikiTypeBinding {
	readonly item: Readonly<{path: string; blob: GitOid}>;
	readonly definition: Readonly<{path: string; blob: GitOid}>;
	readonly type: string;
	readonly base: WikiCoreType;
}

export interface WikiTypeContext {
	readonly profile: typeof WIKI_PROFILE_ID;
	readonly snapshot: GitOid;
	readonly bindings: readonly WikiTypeBinding[];
}

const UTF8 = new TextEncoder();
const UNPAIRED_SURROGATE = /[\uD800-\uDFFF]/u;
const FORBIDDEN_PATH_CHARACTER = /[\\\u0000-\u001f\u007f\uFEFF]/u;
const TYPE_NAME = /^[A-Z][A-Za-z0-9]*$/u;
const RESERVED_FIELDS = new Set(["codewiki-origin", "codewiki-revision", "codewiki-base"]);

export function wikiIssue(code: WikiIssue["code"], path: string, message: string): WikiIssue {
	return Object.freeze({code, path, message});
}

export function wikiPath(path: unknown): path is string {
	return typeof path === "string" && path.length <= WIKI_PROFILE_LIMITS.pathBytes &&
		UTF8.encode(path).byteLength <= WIKI_PROFILE_LIMITS.pathBytes &&
		path.startsWith(".codewiki/wiki/") && /\.(?:md|markdown)$/u.test(path) &&
		!FORBIDDEN_PATH_CHARACTER.test(path) && !UNPAIRED_SURROGATE.test(path) &&
		path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function boundedReference(value: unknown): value is string {
	return typeof value === "string" && value.length > 0 && value.length <= WIKI_PROFILE_LIMITS.pathBytes &&
		UTF8.encode(value).byteLength <= WIKI_PROFILE_LIMITS.pathBytes &&
		!FORBIDDEN_PATH_CHARACTER.test(value) && !UNPAIRED_SURROGATE.test(value);
}

/** Lexical navigation only: no existence, identity, authorization or historical receipt is inferred. */
export function resolveChangeReference(itemPath: string, reference: unknown): Outcome<WikiReference, WikiIssue> {
	const issuePath = typeof itemPath === "string" ? itemPath : "$";
	if (!wikiPath(itemPath) || !boundedReference(reference) || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(reference)) {
		return failure(wikiIssue("invalid_metadata", issuePath, "Change reference must be a bounded relative UTF-8 path."));
	}
	const segments = itemPath.split("/").slice(0, -1);
	for (const part of reference.split("/")) {
		if (part === "") {
			return failure(wikiIssue("invalid_metadata", issuePath, "Change reference contains an empty segment."));
		}
		if (part === ".") continue;
		if (part === "..") {
			if (segments.length === 0) {
				return failure(wikiIssue("invalid_metadata", issuePath, "Change reference escapes the Project."));
			}
			segments.pop();
			continue;
		}
		segments.push(part);
	}
	const path = segments.join("/");
	if (UTF8.encode(path).byteLength > WIKI_PROFILE_LIMITS.pathBytes) {
		return failure(wikiIssue("limit_exceeded", issuePath, "Resolved Change reference exceeds the path byte limit."));
	}
	if (!path.startsWith(".codewiki/changes/") || segments.length < 3) {
		return failure(wikiIssue("invalid_metadata", issuePath, "Change reference must resolve inside .codewiki/changes/."));
	}
	return success(Object.freeze({reference, path}));
}

class DataCopyError extends Error {
	readonly code: "invalid_metadata" | "limit_exceeded";

	constructor(message: string, code: DataCopyError["code"] = "invalid_metadata") {
		super(message);
		this.name = "DataCopyError";
		this.code = code;
	}
}

interface CopyBudget {
	nodes: number;
	textBytes: number;
}

function consumeText(value: string, budget: CopyBudget): void {
	// UTF-16 length is a lower bound on UTF-8 bytes; reject before scanning/allocating.
	if (value.length > WIKI_PROFILE_LIMITS.headerBytes - budget.textBytes) {
		throw new DataCopyError("Metadata string/key byte limit exceeded.", "limit_exceeded");
	}
	if (UNPAIRED_SURROGATE.test(value)) throw new DataCopyError("Strings cannot contain unpaired surrogates.");
	const bytes = UTF8.encode(value).byteLength;
	if (budget.textBytes > WIKI_PROFILE_LIMITS.headerBytes - bytes) {
		throw new DataCopyError("Metadata string/key byte limit exceeded.", "limit_exceeded");
	}
	budget.textBytes += bytes;
}

function isArrayIndex(key: string, length: number): boolean {
	if (!/^(?:0|[1-9][0-9]*)$/u.test(key)) return false;
	const index = Number(key);
	return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

/** Copies bounded parser data into immutable null-prototype data without invoking accessors. */
function copyData(value: unknown, budget: CopyBudget, depth = 0): WikiValue {
	if (++budget.nodes > WIKI_PROFILE_LIMITS.nodes) throw new DataCopyError("Metadata node limit exceeded.", "limit_exceeded");
	if (depth > WIKI_PROFILE_LIMITS.depth) throw new DataCopyError("Metadata depth limit exceeded.", "limit_exceeded");
	if (value === null || typeof value === "boolean") return value;
	if (typeof value === "string") {
		consumeText(value, budget);
		return value;
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
			throw new DataCopyError("Numbers must be finite and have safe integer values.");
		}
		return Object.is(value, -0) ? 0 : value;
	}
	if (typeof value !== "object") throw new DataCopyError("Metadata contains an unsupported value.");

	const prototype = Object.getPrototypeOf(value);
	const array = Array.isArray(value);
	if (array && prototype !== Array.prototype) throw new DataCopyError("Arrays must use the intrinsic Array prototype.");
	if (!array && prototype !== null && prototype !== Object.prototype) throw new DataCopyError("Metadata mappings must be plain data.");

	if (array) {
		const length = value.length;
		if (!Number.isSafeInteger(length) || length > WIKI_PROFILE_LIMITS.collectionEntries) {
			throw new DataCopyError("Metadata collection entry limit exceeded.", "limit_exceeded");
		}
		const keys = Reflect.ownKeys(value);
		if (keys.length - 1 !== length || keys.some((key) => typeof key !== "string" || (key !== "length" && !isArrayIndex(key, length)))) {
			throw new DataCopyError("Arrays must be dense indexed data.");
		}
		const output: WikiValue[] = [];
		for (let index = 0; index < length; index += 1) {
			const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
			if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
				throw new DataCopyError("Metadata arrays must contain enumerable data properties.");
			}
			output.push(copyData(descriptor.value, budget, depth + 1));
		}
		return Object.freeze(output);
	}

	const keys = Reflect.ownKeys(value);
	if (keys.length > WIKI_PROFILE_LIMITS.collectionEntries) {
		throw new DataCopyError("Metadata collection entry limit exceeded.", "limit_exceeded");
	}
	const entries: [string, WikiValue][] = [];
	for (const key of keys) {
		if (typeof key !== "string") throw new DataCopyError("Metadata mappings cannot contain symbol keys.");
		consumeText(key, budget);
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
			throw new DataCopyError("Metadata mappings must contain enumerable data properties.");
		}
		entries.push([key, copyData(descriptor.value, budget, depth + 1)]);
	}
	const output = Object.create(null) as Record<string, WikiValue>;
	for (const [key, entry] of entries) {
		Object.defineProperty(output, key, {configurable: true, enumerable: true, value: entry, writable: true});
	}
	return Object.freeze(output);
}

function stringList(value: WikiValue | undefined): value is readonly string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string") && new Set(value).size === value.length;
}

function coreType(value: string): value is WikiCoreType {
	return (WIKI_CORE_TYPES as readonly string[]).includes(value);
}

export function decodeWikiMetadata(path: string, input: unknown): Outcome<WikiMetadata, WikiIssue> {
	const issuePath = typeof path === "string" ? path : "$";
	if (!wikiPath(path)) return failure(wikiIssue("invalid_file", issuePath, "Expected a bounded managed Markdown path."));
	let fields: WikiValue;
	try {
		fields = copyData(input, {nodes: 0, textBytes: 0});
	} catch (error) {
		const code = error instanceof DataCopyError ? error.code : "invalid_metadata";
		return failure(wikiIssue(code, path, error instanceof Error ? error.message : "Metadata could not be copied safely."));
	}
	if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
		return failure(wikiIssue("invalid_metadata", path, "Frontmatter must be a mapping."));
	}
	const data = fields as WikiMapping;
	const type = data.type;
	const title = data.title;
	const originsValue = data["codewiki-origin"];
	if (typeof type !== "string" || !TYPE_NAME.test(type) || typeof title !== "string" || title.trim() === "" ||
		!stringList(originsValue) || originsValue.length === 0 || typeof data["codewiki-revision"] !== "string" ||
		Object.keys(data).some((key) => key.startsWith("codewiki-") && !RESERVED_FIELDS.has(key))) {
		return failure(wikiIssue("invalid_metadata", path, "Required fields, type name or reserved fields are invalid."));
	}
	if ((data.description !== undefined && typeof data.description !== "string") ||
		(data.aliases !== undefined && !stringList(data.aliases)) || (data.tags !== undefined && !stringList(data.tags))) {
		return failure(wikiIssue("invalid_metadata", path, "Description must be a string; aliases/tags must be unique string lists."));
	}

	let base: WikiBaseType | undefined;
	if (type === "TypeDefinition") {
		if (!path.startsWith(".codewiki/wiki/types/") || !TYPE_NAME.test(title)) {
			return failure(wikiIssue("invalid_type", path, "TypeDefinitions belong under types/ and declare an ASCII PascalCase title."));
		}
		if (!coreType(title)) {
			const declared = data["codewiki-base"];
			if (typeof declared !== "string" || !coreType(declared) || declared === "TypeDefinition") {
				return failure(wikiIssue("invalid_type", path, "Custom TypeDefinitions require exactly one non-meta core base."));
			}
			base = declared;
		}
	}
	if (base === undefined && data["codewiki-base"] !== undefined) {
		return failure(wikiIssue("invalid_type", path, "Only custom TypeDefinitions may declare codewiki-base."));
	}

	const origins: WikiReference[] = [];
	const originPaths = new Set<string>();
	for (const reference of originsValue) {
		const resolved = resolveChangeReference(path, reference);
		if (!resolved.ok) return resolved;
		if (originPaths.has(resolved.value.path)) {
			return failure(wikiIssue("invalid_metadata", path, "Origin references must resolve to unique Change paths."));
		}
		originPaths.add(resolved.value.path);
		origins.push(resolved.value);
	}
	const revision = resolveChangeReference(path, data["codewiki-revision"]);
	if (!revision.ok) return revision;
	return success(Object.freeze({
		fields: data,
		type,
		title,
		origins: Object.freeze(origins),
		revision: revision.value,
		...(base === undefined ? {} : {base}),
	}));
}

interface OwnDataProperty {
	readonly value: unknown;
}

function ownDataProperty(input: unknown, key: string): OwnDataProperty {
	if (typeof input !== "object" || input === null) throw new Error("Expected an object subject.");
	const descriptor = Object.getOwnPropertyDescriptor(input, key);
	if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new Error("Subject properties must be enumerable data.");
	return {value: descriptor.value};
}

function sameReference(left: unknown, right: WikiReference): boolean {
	if (typeof left !== "object" || left === null) return false;
	return ownDataProperty(left, "reference").value === right.reference && ownDataProperty(left, "path").value === right.path;
}

function metadataMatches(input: unknown, metadata: WikiMetadata): boolean {
	if (typeof input !== "object" || input === null) return false;
	if (ownDataProperty(input, "type").value !== metadata.type || ownDataProperty(input, "title").value !== metadata.title) return false;
	const origins = ownDataProperty(input, "origins").value;
	if (!Array.isArray(origins) || origins.length !== metadata.origins.length || Reflect.ownKeys(origins).length !== origins.length + 1) return false;
	for (let index = 0; index < metadata.origins.length; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(origins, String(index));
		if (!descriptor || !descriptor.enumerable || !("value" in descriptor) || !sameReference(descriptor.value, metadata.origins[index]!)) return false;
	}
	if (!sameReference(ownDataProperty(input, "revision").value, metadata.revision)) return false;
	if (metadata.base === undefined) return !Object.hasOwn(input, "base");
	return ownDataProperty(input, "base").value === metadata.base;
}

function admittedFile(input: unknown): Outcome<ProfiledWikiFile, WikiIssue> {
	let path: unknown;
	try {
		path = ownDataProperty(input, "path").value;
		const profile = ownDataProperty(input, "profile").value;
		const rawBlob = ownDataProperty(input, "blob").value;
		const byteLength = ownDataProperty(input, "byteLength").value;
		const text = ownDataProperty(input, "text").value;
		const body = ownDataProperty(input, "body").value;
		const rawMetadata = ownDataProperty(input, "metadata").value;
		if (profile !== WIKI_PROFILE_ID || !wikiPath(path) || typeof byteLength !== "number" || !Number.isSafeInteger(byteLength) ||
			byteLength < 0 || byteLength > WIKI_PROFILE_LIMITS.fileBytes || typeof text !== "string" || typeof body !== "string" ||
			text.length > byteLength || body.length > byteLength || UNPAIRED_SURROGATE.test(text) || UNPAIRED_SURROGATE.test(body) || text.startsWith("\uFEFF") || text.includes("\0") ||
			text.includes("\r") || body.includes("\r") || body.includes("\0")) {
			return failure(wikiIssue("invalid_type", typeof path === "string" ? path : "$", "File subject is not an admitted profile result."));
		}
		const blob = decodeGitOid(rawBlob);
		if (!blob.ok) return failure(wikiIssue("invalid_type", path, "File subject has an invalid blob identity."));
		const headerEnd = text.indexOf("\n---\n", 4);
		if (UTF8.encode(text).byteLength !== byteLength || !text.startsWith("---\n") || headerEnd < 4 ||
			UTF8.encode(text.slice(4, headerEnd)).byteLength > WIKI_PROFILE_LIMITS.headerBytes || text.slice(headerEnd + 5) !== body) {
			return failure(wikiIssue("invalid_type", path, "File subject text and byte identity are inconsistent."));
		}
		const fields = ownDataProperty(rawMetadata, "fields").value;
		const metadata = decodeWikiMetadata(path, fields);
		if (!metadata.ok) return metadata;
		if (!metadataMatches(rawMetadata, metadata.value)) {
			return failure(wikiIssue("invalid_type", path, "File metadata derived fields do not match its admitted data."));
		}
		return success(Object.freeze({profile: WIKI_PROFILE_ID, path, blob: blob.value, byteLength, text, body, metadata: metadata.value}));
	} catch (error) {
		return failure(wikiIssue("invalid_type", typeof path === "string" ? path : "$", error instanceof Error ? error.message : "File subject could not be admitted."));
	}
}

interface PathNode {
	readonly children: Map<string, PathNode>;
	file: boolean;
}

function addPath(root: PathNode, path: string): boolean {
	let node = root;
	for (const segment of path.split("/")) {
		if (node.file) return false;
		let child = node.children.get(segment);
		if (!child) {
			child = {children: new Map(), file: false};
			node.children.set(segment, child);
		}
		node = child;
	}
	if (node.file || node.children.size > 0) return false;
	node.file = true;
	return true;
}

function snapshotFiles(files: readonly ProfiledWikiFile[]): readonly unknown[] {
	if (!Array.isArray(files)) throw new Error("Expected a file array.");
	const length = Object.getOwnPropertyDescriptor(files, "length")?.value;
	if (!Number.isSafeInteger(length) || length < 0 || length > WIKI_PROFILE_LIMITS.files) {
		throw new Error("Expected a bounded file array.");
	}
	if (Reflect.ownKeys(files).length !== length + 1) throw new Error("Expected a dense file array without extra properties.");
	const result: unknown[] = [];
	for (let index = 0; index < length; index += 1) result.push(ownDataProperty(files, String(index)).value);
	return result;
}

/**
 * Checks supplied parser results, not raw YAML/Markdown or Git object contents.
 * Callers must decode exact files through the selected adapter first; this pure
 * Kernel boundary rechecks metadata and subjects, not byte-to-metadata provenance.
 * Supplied snapshot/blob subjects are not membership or adoption proof.
 */
export function bindWikiTypes(snapshot: unknown, files: readonly ProfiledWikiFile[]): Outcome<WikiTypeContext, WikiIssue> {
	const decodedSnapshot = decodeGitOid(snapshot);
	if (!decodedSnapshot.ok) return failure(wikiIssue("invalid_type", "$", "Expected a valid snapshot."));
	let inputs: readonly unknown[];
	try {
		inputs = snapshotFiles(files);
	} catch {
		return failure(wikiIssue("invalid_type", "$", "Expected a bounded dense own-data file list."));
	}
	const admitted: ProfiledWikiFile[] = [];
	let bytes = 0;
	for (const input of inputs) {
		const file = admittedFile(input);
		if (!file.ok) return file;
		if (file.value.blob.algorithm !== decodedSnapshot.value.algorithm || bytes > WIKI_PROFILE_LIMITS.contextBytes - file.value.byteLength) {
			return failure(wikiIssue(bytes > WIKI_PROFILE_LIMITS.contextBytes - file.value.byteLength ? "limit_exceeded" : "invalid_type", file.value.path,
				bytes > WIKI_PROFILE_LIMITS.contextBytes - file.value.byteLength ? "Type context byte limit exceeded." : "File blob algorithm differs from the snapshot."));
		}
		bytes += file.value.byteLength;
		admitted.push(file.value);
	}
	admitted.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
	const root: PathNode = {children: new Map(), file: false};
	const paths = new Set<string>();
	for (const file of admitted) {
		if (paths.has(file.path) || !addPath(root, file.path)) {
			return failure(wikiIssue("invalid_type", file.path, "Duplicate or file/descendant-colliding file subject."));
		}
		paths.add(file.path);
	}

	const definitions = new Map<string, ProfiledWikiFile>();
	for (const file of admitted) {
		if (file.metadata.type !== "TypeDefinition") continue;
		if (definitions.has(file.metadata.title)) {
			return failure(wikiIssue("invalid_type", file.path, "Duplicate type declaration."));
		}
		definitions.set(file.metadata.title, file);
	}
	for (const name of WIKI_CORE_TYPES) {
		if (!definitions.has(name)) return failure(wikiIssue("unresolved_type", "$", `Missing core TypeDefinition: ${name}.`));
	}

	const bindings: WikiTypeBinding[] = [];
	for (const file of admitted) {
		const definition = definitions.get(file.metadata.type);
		if (!definition) return failure(wikiIssue("unresolved_type", file.path, "No exact TypeDefinition for the declared type."));
		const base = coreType(file.metadata.type) ? file.metadata.type : definition.metadata.base;
		if (base === undefined) return failure(wikiIssue("invalid_type", definition.path, "Missing core base."));
		const itemBlob = decodeGitOid(file.blob);
		const definitionBlob = decodeGitOid(definition.blob);
		if (!itemBlob.ok || !definitionBlob.ok) return failure(wikiIssue("invalid_type", file.path, "Admitted blob identity could not be copied."));
		bindings.push(Object.freeze({
			item: Object.freeze({path: file.path, blob: itemBlob.value}),
			definition: Object.freeze({path: definition.path, blob: definitionBlob.value}),
			type: file.metadata.type,
			base,
		}));
	}
	return success(Object.freeze({profile: WIKI_PROFILE_ID, snapshot: decodedSnapshot.value, bindings: Object.freeze(bindings)}));
}
