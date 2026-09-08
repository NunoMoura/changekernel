import {isCanonicalObject, parseCanonicalJson, type CanonicalIssue, type CanonicalValue} from "../data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../data-contracts/outcome.ts";
import {decodeGitOid, type GitOid} from "../identity/git.ts";
import {decodeWikiItem, type WikiItem, type WikiItemIssue} from "./item.ts";

export const WIKI_ITEM_ROOT = ".codewiki/wiki/items";
export const MAXIMUM_WIKI_FILE_BYTES = 5 * 1024 * 1024;

export type WikiFileFormat = "markdown" | "yaml";

export interface WikiFileInput {
	readonly path: string;
	readonly mode: string;
	readonly blob: GitOid;
	readonly bytes: Uint8Array;
}

export interface WikiFile {
	readonly path: string;
	readonly format: WikiFileFormat;
	readonly blob: GitOid;
	readonly byteLength: number;
	readonly item: WikiItem;
}

export type WikiFileIssueCode =
	| "invalid_blob"
	| "invalid_encoding"
	| "invalid_item"
	| "invalid_mode"
	| "invalid_path"
	| "limit_exceeded"
	| "non_canonical_file";

export interface WikiFileIssue {
	readonly code: WikiFileIssueCode;
	readonly path: string;
	readonly message: string;
	readonly cause?: CanonicalIssue | WikiItemIssue;
}

const UTF8 = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true});
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/u;
const PORTABLE_SEGMENT = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u;

export function decodeWikiFile(input: WikiFileInput): Outcome<WikiFile, WikiFileIssue> {
	if (typeof input !== "object" || input === null) {
		return failure(fileIssue("invalid_path", "$", "Wiki Item file input is malformed."));
	}
	const format = wikiFileFormat(input.path);
	if (!format.ok) return format;
	if (input.mode !== "100644") {
		return failure(fileIssue("invalid_mode", input.path, "Wiki Item files must be regular non-executable Git blobs."));
	}
	const blob = decodeGitOid(input.blob);
	if (!blob.ok) return failure(fileIssue("invalid_blob", input.path, blob.error.message));
	if (!(input.bytes instanceof Uint8Array)) {
		return failure(fileIssue("invalid_encoding", input.path, "Wiki Item content must be a byte array."));
	}
	if (input.bytes.byteLength > MAXIMUM_WIKI_FILE_BYTES) {
		return failure(fileIssue("limit_exceeded", input.path, `Wiki Item file exceeds ${MAXIMUM_WIKI_FILE_BYTES} bytes.`));
	}
	let text: string;
	try {
		text = UTF8.decode(input.bytes);
	} catch {
		return failure(fileIssue("invalid_encoding", input.path, "Wiki Item file is not valid UTF-8."));
	}
	const textIssue = validateCanonicalText(text, input.path);
	if (textIssue) return failure(textIssue);
	const decoded = format.value === "markdown"
		? decodeMarkdownItem(text, input.path)
		: decodeYamlItem(text, input.path);
	if (!decoded.ok) return decoded;
	return success(Object.freeze({
		path: input.path,
		format: format.value,
		blob: blob.value,
		byteLength: input.bytes.byteLength,
		item: decoded.value,
	}));
}

export function wikiFileFormat(path: unknown): Outcome<WikiFileFormat, WikiFileIssue> {
	if (typeof path !== "string" || path.normalize("NFC") !== path || new TextEncoder().encode(path).byteLength > 1_024) {
		return failure(fileIssue("invalid_path", typeof path === "string" ? path : "$", "Wiki Item path must be bounded NFC text."));
	}
	const prefix = `${WIKI_ITEM_ROOT}/`;
	if (!path.startsWith(prefix)) {
		return failure(fileIssue("invalid_path", path, `Wiki Item path must be below ${WIKI_ITEM_ROOT}/.`));
	}
	const relative = path.slice(prefix.length);
	let extension: ".md" | ".yaml" | ".yml" | null = null;
	if (relative.endsWith(".md")) extension = ".md";
	else if (relative.endsWith(".yaml")) extension = ".yaml";
	else if (relative.endsWith(".yml")) extension = ".yml";
	if (extension === null) return failure(fileIssue("invalid_path", path, "Wiki Item path must end in .md, .yaml, or .yml."));
	const segments = relative.slice(0, -extension.length).split("/");
	if (segments.some((segment) => !portableSegment(segment))) {
		return failure(fileIssue("invalid_path", path, "Wiki Item path must use bounded lowercase category segments and kebab-case filenames."));
	}
	return success(extension === ".md" ? "markdown" : "yaml");
}

function decodeMarkdownItem(text: string, path: string): Outcome<WikiItem, WikiFileIssue> {
	if (!text.startsWith("---\n")) {
		return failure(fileIssue("non_canonical_file", path, "Markdown Wiki Item must begin with an exact front-matter delimiter."));
	}
	const end = text.indexOf("\n---\n", 4);
	if (end < 4) return failure(fileIssue("non_canonical_file", path, "Markdown Wiki Item front matter is not terminated."));
	const header = text.slice(4, end);
	if (header.includes("\n")) {
		return failure(fileIssue("non_canonical_file", path, "Markdown Wiki Item envelope must be one canonical JSON line."));
	}
	const envelope = parseCanonicalJson(header, {requireCanonicalBytes: true});
	if (!envelope.ok) return failure(fileIssue("non_canonical_file", path, envelope.error.message, envelope.error));
	return decodeItem(envelope.value, text.slice(end + 5), path);
}

function decodeYamlItem(text: string, path: string): Outcome<WikiItem, WikiFileIssue> {
	const document = parseCanonicalJson(text.slice(0, -1), {requireCanonicalBytes: true});
	if (!document.ok) {
		return failure(fileIssue(
			"non_canonical_file",
			path,
			"YAML Wiki Items must use the canonical JSON-compatible YAML profile.",
			document.error,
		));
	}
	if (!isCanonicalObject(document.value) || typeof document.value.body !== "string") {
		return failure(fileIssue("invalid_item", path, "YAML Wiki Item must be one envelope object with a text body field."));
	}
	const envelope: {[key: string]: CanonicalValue} = Object.create(null) as {[key: string]: CanonicalValue};
	for (const [key, value] of Object.entries(document.value)) {
		if (key !== "body") envelope[key] = value;
	}
	return decodeItem(Object.freeze(envelope), document.value.body, path);
}

function decodeItem(envelope: CanonicalValue, body: string, path: string): Outcome<WikiItem, WikiFileIssue> {
	if (body.includes("\r") || (body.length > 0 && !body.endsWith("\n"))) {
		return failure(fileIssue("non_canonical_file", path, "Wiki Item body must use LF line endings and end at a line boundary."));
	}
	const item = decodeWikiItem(envelope, body);
	return item.ok ? success(item.value) : failure(fileIssue("invalid_item", path, item.error.message, item.error));
}

function validateCanonicalText(text: string, path: string): WikiFileIssue | null {
	if (text.startsWith("\uFEFF") || text.includes("\0") || text.includes("\r")) {
		return fileIssue("non_canonical_file", path, "Wiki Item text cannot contain BOM, NUL, or carriage return bytes.");
	}
	if (text.normalize("NFC") !== text) {
		return fileIssue("non_canonical_file", path, "Wiki Item text must be NFC-normalized.");
	}
	if (!text.endsWith("\n")) {
		return fileIssue("non_canonical_file", path, "Wiki Item file must end with one LF-delimited line.");
	}
	return null;
}

function portableSegment(segment: string): boolean {
	const bytes = new TextEncoder().encode(segment).byteLength;
	return bytes >= 1 && bytes <= 80 && PORTABLE_SEGMENT.test(segment) && !WINDOWS_RESERVED_NAME.test(segment);
}

function fileIssue(
	code: WikiFileIssueCode,
	path: string,
	message: string,
	cause?: CanonicalIssue | WikiItemIssue,
): WikiFileIssue {
	return cause === undefined
		? Object.freeze({code, path, message})
		: Object.freeze({code, path, message, cause});
}
