import {fromMarkdown} from "mdast-util-from-markdown";
import {Composer, Parser, isMap, isScalar, isSeq, type CST} from "yaml";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {decodeGitOid, type GitOid} from "../../kernel/identity/git.ts";
import {
	decodeWikiMetadata,
	resolveKernelWikiContract,
	wikiIssue,
	wikiPath,
	WIKI_PROFILE_ID,
	WIKI_PROFILE_LIMITS,
	type WikiIssue,
	type WikiMapping,
	type WikiValue,
	type ProfiledWikiFile,
} from "../../kernel/wiki/profile.ts";

export interface WikiFileInput {
	readonly path: string;
	readonly mode: string;
	readonly blob: GitOid;
	readonly bytes: Uint8Array;
}

const UTF8 = new TextEncoder();
const UTF8_DECODER = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true});
// Read internal slots, not shadowable properties on caller-owned byte views.
const TYPED_ARRAY = Object.getPrototypeOf(Uint8Array.prototype);
const BYTE_LENGTH = Object.getOwnPropertyDescriptor(TYPED_ARRAY, "byteLength")!.get!;
const BYTE_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY, "buffer")!.get!;
const ARRAY_BUFFER_LENGTH = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!;

class ProfileParseError extends Error {
	readonly code: WikiIssue["code"];

	constructor(message: string, code: WikiIssue["code"] = "invalid_yaml") {
		super(message);
		this.name = "ProfileParseError";
		this.code = code;
	}
}

function reject(message: string, code: WikiIssue["code"] = "invalid_yaml"): never {
	throw new ProfileParseError(message, code);
}

interface OwnDataProperty {
	readonly value: unknown;
}

function ownDataProperty(input: unknown, key: string): OwnDataProperty {
	if (typeof input !== "object" || input === null) throw new ProfileParseError("File input must be an object.", "invalid_file");
	const descriptor = Object.getOwnPropertyDescriptor(input, key);
	if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
		throw new ProfileParseError("File input properties must be enumerable data.", "invalid_file");
	}
	return {value: descriptor.value};
}

function snapshotBytes(bytes: Uint8Array): Uint8Array {
	let length: number;
	try {
		length = BYTE_LENGTH.call(bytes);
		// Reject shared storage: concurrent mutation cannot supply one exact byte subject.
		ARRAY_BUFFER_LENGTH.call(BYTE_BUFFER.call(bytes));
	} catch {
		throw new ProfileParseError("File bytes must be a non-shared byte view.", "invalid_file");
	}
	if (length > WIKI_PROFILE_LIMITS.fileBytes) reject("Wiki file byte limit exceeded.", "limit_exceeded");
	try {
		const copy = new Uint8Array(length);
		// Intrinsic set rejects detached views and avoids subclass iterators/species.
		Uint8Array.prototype.set.call(copy, bytes);
		return copy;
	} catch {
		throw new ProfileParseError("File bytes must be an attached byte view.", "invalid_file");
	}
}

/** Current managed documents use the contract selected by an exact Kernel release. */
export function decodeKernelWikiFile(kernelVersion: unknown, input: WikiFileInput): Outcome<ProfiledWikiFile, WikiIssue> {
	const contract = resolveKernelWikiContract(kernelVersion);
	if (!contract.ok) return contract;
	let path: unknown;
	try {
		path = ownDataProperty(input, "path").value;
		const mode = ownDataProperty(input, "mode").value;
		const rawBlob = ownDataProperty(input, "blob").value;
		const rawBytes = ownDataProperty(input, "bytes").value;
		if (!wikiPath(path) || mode !== "100644" || !(rawBytes instanceof Uint8Array)) {
			return failure(wikiIssue("invalid_file", typeof path === "string" ? path : "$", "Expected a regular managed Markdown blob."));
		}
		const blob = decodeGitOid(rawBlob);
		if (!blob.ok) return failure(wikiIssue("invalid_file", path, "Invalid blob identity."));
		const bytes = snapshotBytes(rawBytes);
		let text: string;
		try {
			text = UTF8_DECODER.decode(bytes);
		} catch {
			return failure(wikiIssue("invalid_file", path, "Expected lossless UTF-8."));
		}
		if (text.startsWith("\uFEFF") || text.includes("\r") || text.includes("\0")) {
			return failure(wikiIssue("invalid_file", path, "Expected LF-only Markdown without BOM or NUL."));
		}
		if (!text.startsWith("---\n")) {
			return failure(wikiIssue("invalid_yaml", path, "Frontmatter must begin with an exact opening delimiter."));
		}
		const scan = text.slice(0, WIKI_PROFILE_LIMITS.headerBytes + 9);
		const end = scan.indexOf("\n---\n", 4);
		if (end < 4) {
			const inspectedHeaderBytes = UTF8.encode(scan.slice(4)).byteLength;
			return failure(wikiIssue(inspectedHeaderBytes > WIKI_PROFILE_LIMITS.headerBytes || text.length > scan.length ? "limit_exceeded" : "invalid_yaml", path,
				"Missing or oversized frontmatter."));
		}
		const header = text.slice(4, end);
		if (UTF8.encode(header).byteLength > WIKI_PROFILE_LIMITS.headerBytes) {
			return failure(wikiIssue("limit_exceeded", path, "Frontmatter byte limit exceeded."));
		}
		const body = text.slice(end + 5);
		const fields = parseFrontmatter(header);
		const metadata = decodeWikiMetadata(path, fields);
		if (!metadata.ok) return metadata;
		checkMarkdown(body, metadata.value.title);
		return success(Object.freeze({
			profile: WIKI_PROFILE_ID,
			path,
			blob: blob.value,
			byteLength: bytes.byteLength,
			text,
			body,
			metadata: metadata.value,
		}));
	} catch (error) {
		const issuePath = typeof path === "string" ? path : "$";
		return failure(wikiIssue(error instanceof ProfileParseError ? error.code : "invalid_yaml", issuePath,
			error instanceof Error ? error.message : "Malformed document could not be parsed."));
	}
}

const FORBIDDEN_TOKENS = new Set([
	"anchor",
	"alias",
	"tag",
	"directive",
	"directive-line",
	"byte-order-mark",
	"doc-mode",
	"doc-start",
	"doc-end",
	"flow-error-end",
	"error",
]);
const COLLECTION_TOKENS = new Set(["block-map", "block-seq", "flow-collection"]);

/** Admits YAML structure and finite budgets before Composer recursively constructs nodes. */
function checkCst(tokens: readonly CST.Token[]): void {
	if (tokens.filter((token) => token.type === "document").length !== 1) reject("Expected exactly one YAML document.");
	const pending: {value: unknown; depth: number}[] = tokens.map((value) => ({value, depth: 0}));
	let nodes = 0;
	while (pending.length > 0) {
		const current = pending.pop();
		if (!current || typeof current.value !== "object" || current.value === null) continue;
		if (++nodes > WIKI_PROFILE_LIMITS.nodes) reject("YAML CST node limit exceeded.", "limit_exceeded");
		if (Array.isArray(current.value)) {
			if (current.value.length > WIKI_PROFILE_LIMITS.collectionEntries) reject("YAML collection limit exceeded.", "limit_exceeded");
			for (const value of current.value) pending.push({value, depth: current.depth});
			continue;
		}
		const token = current.value as {type?: unknown; items?: unknown};
		if (typeof token.type === "string" && FORBIDDEN_TOKENS.has(token.type)) {
			reject("YAML directives, tags, references and extra documents are not supported.");
		}
		const collection = typeof token.type === "string" && COLLECTION_TOKENS.has(token.type);
		const nextDepth = current.depth + (collection ? 1 : 0);
		if (nextDepth > WIKI_PROFILE_LIMITS.depth) reject("YAML depth limit exceeded.", "limit_exceeded");
		if (collection && token.items !== undefined && (!Array.isArray(token.items) || token.items.length > WIKI_PROFILE_LIMITS.collectionEntries)) {
			reject("YAML collection limit exceeded.", "limit_exceeded");
		}
		for (const value of Object.values(current.value)) pending.push({value, depth: nextDepth});
	}
}

function parseFrontmatter(header: string): WikiMapping {
	const tokens = [...new Parser().parse(header)];
	checkCst(tokens);
	const documents = [...new Composer({schema: "failsafe", version: "1.2", strict: true, uniqueKeys: false}).compose(tokens)];
	const document = documents[0];
	if (documents.length !== 1 || !document || document.errors.length > 0 || document.warnings.length > 0 || !isMap(document.contents)) {
		reject("Expected one well-formed YAML mapping.");
	}
	return convertNode(document.contents) as WikiMapping;
}

const JSON_NUMBER = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?$/u;
const UNSUPPORTED_SCALAR = /^(?:~|null|true|false|yes|no|on|off|y|n|[-+]?\.(?:inf|nan)|[-+]?(?:[0-9][0-9_]*(?:\.[0-9_]*)?(?:[eE][-+]?[0-9_]+)?|\.[0-9_]+)|[-+]?0[xob][0-9a-f_]+|[0-9]+(?::[0-9]+)+(?:\.[0-9]+)?|[0-9]{4}-[0-9]{1,2}(?:-[0-9]{1,2})?(?:[Tt ].*)?)$/iu;

function scalarValue(value: unknown, plain: boolean): WikiValue {
	if (typeof value !== "string") reject("Missing or unsupported scalar.");
	if (!plain) return value;
	if (value === "") reject("Implicit empty scalars are not supported; quote an empty string explicitly.");
	if (value === "null") return null;
	if (value === "true") return true;
	if (value === "false") return false;
	if (JSON_NUMBER.test(value)) {
		const number = Number(value);
		if (!Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number))) {
			reject("Number is not finite or its integer value is unsafe.");
		}
		return Object.is(number, -0) ? 0 : number;
	}
	if (UNSUPPORTED_SCALAR.test(value)) reject("Unsupported implicit scalar; quote it to retain string data.");
	return value;
}

function convertNode(node: unknown): WikiValue {
	if (isScalar(node)) return scalarValue(node.value, node.type === "PLAIN");
	if (isSeq(node)) {
		if (node.items.length > WIKI_PROFILE_LIMITS.collectionEntries) reject("YAML collection limit exceeded.", "limit_exceeded");
		return Object.freeze(node.items.map(convertNode));
	}
	if (!isMap(node)) reject("Expected a scalar, sequence or mapping; implicit empty values are not supported.");
	if (node.items.length > WIKI_PROFILE_LIMITS.collectionEntries) reject("YAML collection limit exceeded.", "limit_exceeded");
	const result = Object.create(null) as Record<string, WikiValue>;
	for (const pair of node.items) {
		if (!isScalar(pair.key)) reject("Mapping keys must be strings.");
		const key = scalarValue(pair.key.value, pair.key.type === "PLAIN");
		if (typeof key !== "string") reject("Mapping keys must be strings.");
		if ((key === "<<" && pair.key.type === "PLAIN") || Object.hasOwn(result, key)) reject("Merge or duplicate mapping key.");
		const value = convertNode(pair.value);
		Object.defineProperty(result, key, {configurable: true, enumerable: true, value, writable: true});
	}
	return Object.freeze(result);
}

interface MarkdownNode {
	readonly type: string;
	readonly depth?: number;
	readonly value?: string;
	readonly alt?: string | null;
	readonly children?: readonly MarkdownNode[];
}

function checkMarkdown(body: string, title: string): void {
	const document = fromMarkdown(body) as MarkdownNode;
	const pending: {node: MarkdownNode; depth: number}[] = [{node: document, depth: 0}];
	let nodes = 0;
	while (pending.length > 0) {
		const current = pending.pop();
		if (!current) continue;
		if (++nodes > WIKI_PROFILE_LIMITS.nodes || current.depth > WIKI_PROFILE_LIMITS.depth) reject("Markdown tree limit exceeded.", "limit_exceeded");
		for (const node of current.node.children ?? []) pending.push({node, depth: current.depth + 1});
	}
	const children = document.children ?? [];
	const index = children.findIndex((node) => node.type === "heading" && node.depth === 1);
	const heading = children[index];
	if (!heading || markdownText(heading) !== title) reject("The first document H1 must match the title.", "invalid_heading");
	const primary = children.slice(index + 1).some((node) => hasPrimaryContent(node));
	if (!primary) reject("Primary content must follow the title; this structural check does not assess meaning.", "invalid_heading");
}

function hasPrimaryContent(node: MarkdownNode): boolean {
	if (node.type === "heading" || node.type === "definition" || node.type === "thematicBreak") return false;
	if (node.type === "html") return (node.value ?? "").replace(/<!--[\s\S]*?(?:-->|$)/gu, "").trim() !== "";
	return markdownText(node).trim() !== "";
}

function markdownText(root: MarkdownNode): string {
	const pending = [root];
	const parts: string[] = [];
	while (pending.length > 0) {
		const node = pending.pop();
		if (!node || node.type === "html" || node.type === "definition") continue;
		if (node.children) {
			for (let index = node.children.length - 1; index >= 0; index -= 1) pending.push(node.children[index]!);
		} else if (node.type === "break") parts.push("\n");
		else parts.push(node.value ?? node.alt ?? "");
	}
	return parts.join("");
}
