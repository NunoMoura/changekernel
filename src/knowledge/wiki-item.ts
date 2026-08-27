import type {CanonicalJsonValue} from "../utils/canonical-json.ts";
import {sha256Base32Nfc} from "../utils/base32.ts";
import {
	assertRequiredExactKeys as assertExactKeys,
	plainRecord as record,
} from "../utils/json.ts";
import {
	assertNfcString,
	assertSemanticJsonValue,
	canonicalSemanticJson,
	parseCanonicalSemanticJson,
} from "../utils/semantic-digest.ts";
import {assertStableId} from "../project/git-store-profile.ts";

export const WIKI_ITEM_PROTOCOL = "codewiki.wiki-item@1.0.0" as const;
export const WIKI_ITEM_ROOT = ".codewiki/wiki/items" as const;

export interface WikiRelationship {
	readonly predicate: string;
	readonly targetItemId: string;
	readonly attributes: Readonly<Record<string, CanonicalJsonValue>>;
}

export interface WikiProvenanceRef {
	readonly kind: string;
	readonly subjectId: string;
	readonly attributes: Readonly<Record<string, CanonicalJsonValue>>;
}

export interface WikiItem {
	readonly protocol: typeof WIKI_ITEM_PROTOCOL;
	readonly itemId: string;
	readonly itemType: string;
	readonly title: string;
	readonly aliases: readonly string[];
	readonly attributes: Readonly<Record<string, CanonicalJsonValue>>;
	readonly relationships: readonly WikiRelationship[];
	readonly provenance: readonly WikiProvenanceRef[];
	readonly body: string;
}

export interface CreateWikiItemInput {
	readonly itemId: string;
	readonly itemType: string;
	readonly title: string;
	readonly aliases?: readonly string[];
	readonly attributes?: Readonly<Record<string, CanonicalJsonValue>>;
	readonly relationships?: readonly WikiRelationship[];
	readonly provenance?: readonly WikiProvenanceRef[];
	readonly body: string;
}

export type WikiItemFileFormat = "markdown" | "yaml";

export function createWikiItem(input: CreateWikiItemInput): WikiItem {
	const item = {
		protocol: WIKI_ITEM_PROTOCOL,
		itemId: input.itemId,
		itemType: input.itemType,
		title: input.title,
		aliases: input.aliases ?? [],
		attributes: input.attributes ?? {},
		relationships: input.relationships ?? [],
		provenance: input.provenance ?? [],
		body: input.body,
	};
	const normalized = parseCanonicalSemanticJson(canonicalSemanticJson(item));
	assertWikiItem(normalized);
	return normalized;
}

export function assertWikiItem(value: unknown): asserts value is WikiItem {
	const item = record(value, "Wiki Item");
	assertExactKeys(item, [
		"aliases",
		"attributes",
		"body",
		"itemId",
		"itemType",
		"protocol",
		"provenance",
		"relationships",
		"title",
	]);
	if (item.protocol !== WIKI_ITEM_PROTOCOL) {
		throw new Error(`Wiki Item protocol must be ${WIKI_ITEM_PROTOCOL}.`);
	}
	assertStableId(item.itemId, "itemId");
	assertNamespacedValue(item.itemType, "itemType");
	assertNfcString(item.title, "title", 1, 512);
	assertStringArray(item.aliases, "aliases", 64, 512, false);
	assertAttributeMap(item.attributes, "attributes", 128);
	assertRelationships(item.relationships);
	assertProvenance(item.provenance);
	assertWikiBody(item.body);
}

export function serializeWikiItemFile(
	item: WikiItem,
	format: WikiItemFileFormat,
): string {
	assertWikiItem(item);
	if (format === "yaml") return `${canonicalSemanticJson(item)}\n`;
	const {body, ...frontmatter} = item;
	return `---\n${canonicalSemanticJson(frontmatter)}\n---\n${body}${body.length === 0 ? "" : "\n"}`;
}

export function parseWikiItemFile(
	path: string,
	bytes: string,
): WikiItem {
	assertPortableWikiItemPath(path);
	assertCanonicalText(bytes, path);
	const format = wikiItemFileFormat(path);
	let value: CanonicalJsonValue;
	if (format === "yaml") {
		value = parseCanonicalSemanticJson(bytes.slice(0, -1));
	} else {
		const match = /^---\n([^\n]+)\n---\n([\s\S]*)$/u.exec(bytes);
		if (!match) {
			throw new Error(`${path} must contain canonical JSON frontmatter.`);
		}
		const frontmatter = parseCanonicalSemanticJson(match[1] ?? "");
		const frontmatterRecord = record(frontmatter, `${path} frontmatter`);
		if (Object.hasOwn(frontmatterRecord, "body")) {
			throw new Error(`${path} frontmatter must not contain body.`);
		}
		const serializedBody = match[2] ?? "";
		const body = serializedBody.endsWith("\n")
			? serializedBody.slice(0, -1)
			: serializedBody;
		value = parseCanonicalSemanticJson(
			canonicalSemanticJson({...frontmatterRecord, body}),
		);
	}
	assertWikiItem(value);
	const item = value as WikiItem;
	if (serializeWikiItemFile(item, format) !== bytes) {
		throw new Error(`${path} is not in canonical Wiki Item form.`);
	}
	return item;
}

export function generatedWikiItemPath(itemId: string): string {
	assertStableId(itemId, "itemId");
	const encoded = sha256Base32Nfc(itemId, "itemId");
	return `${WIKI_ITEM_ROOT}/${encoded.slice(0, 2)}/item-${encoded}.md`;
}

export function assertPortableWikiItemPath(path: unknown): asserts path is string {
	assertNfcString(path, "Wiki Item path", 1, 240);
	if (path.includes("\\") || path.startsWith("/") || path.endsWith("/")) {
		throw new Error("Wiki Item path must be a relative POSIX path.");
	}
	const segments = path.split("/");
	if (
		segments.length < 5 ||
		segments.slice(0, 3).join("/") !== WIKI_ITEM_ROOT
	) {
		throw new Error(`Wiki Item path must be below ${WIKI_ITEM_ROOT}/.`);
	}
	for (const segment of segments) assertPortableSegment(segment);
	wikiItemFileFormat(path);
}

export function assertGeneratedWikiItemPath(path: string, itemId: string): void {
	assertPortableWikiItemPath(path);
	if (path !== generatedWikiItemPath(itemId)) {
		throw new Error("Generated Wiki Item path does not match itemId.");
	}
}

function wikiItemFileFormat(path: string): WikiItemFileFormat {
	if (path.endsWith(".md")) return "markdown";
	if (path.endsWith(".yaml")) return "yaml";
	throw new Error("Wiki Item path must end in .md or .yaml.");
}

function assertCanonicalText(bytes: string, path: string): void {
	assertNfcString(bytes, path, 1, 1024 * 1024);
	if (bytes.startsWith("\uFEFF")) throw new Error(`${path} must not contain a BOM.`);
	if (bytes.includes("\r")) throw new Error(`${path} must use LF line endings.`);
	if (!bytes.endsWith("\n") || bytes.endsWith("\n\n")) {
		throw new Error(`${path} must have exactly one final LF.`);
	}
	for (const line of bytes.slice(0, -1).split("\n")) {
		if (/[\t ]$/u.test(line)) {
			throw new Error(`${path} must not contain trailing whitespace.`);
		}
	}
}

function assertWikiBody(value: unknown): asserts value is string {
	assertNfcString(value, "body", 0, 1024 * 1024);
	if (value.includes("\r")) throw new Error("body must use LF line endings.");
	if (value.endsWith("\n")) {
		throw new Error("body excludes the canonical file terminator.");
	}
	for (const line of value.split("\n")) {
		if (/[\t ]$/u.test(line)) {
			throw new Error("body must not contain trailing whitespace.");
		}
	}
}

function assertRelationships(value: unknown): asserts value is readonly WikiRelationship[] {
	if (!Array.isArray(value) || value.length > 256) {
		throw new Error("relationships must contain 0..256 entries.");
	}
	for (const [index, candidate] of value.entries()) {
		const relationship = record(candidate, `relationships[${index}]`);
		assertExactKeys(relationship, ["attributes", "predicate", "targetItemId"]);
		assertNamespacedValue(relationship.predicate, `relationships[${index}].predicate`);
		assertStableId(relationship.targetItemId, `relationships[${index}].targetItemId`);
		assertAttributeMap(
			relationship.attributes,
			`relationships[${index}].attributes`,
			32,
		);
	}
}

function assertProvenance(value: unknown): asserts value is readonly WikiProvenanceRef[] {
	if (!Array.isArray(value) || value.length > 128) {
		throw new Error("provenance must contain 0..128 entries.");
	}
	for (const [index, candidate] of value.entries()) {
		const reference = record(candidate, `provenance[${index}]`);
		assertExactKeys(reference, ["attributes", "kind", "subjectId"]);
		assertNamespacedValue(reference.kind, `provenance[${index}].kind`);
		assertStableId(reference.subjectId, `provenance[${index}].subjectId`);
		assertAttributeMap(reference.attributes, `provenance[${index}].attributes`, 128);
	}
}

function assertAttributeMap(
	value: unknown,
	field: string,
	maximumEntries: number,
): asserts value is Readonly<Record<string, CanonicalJsonValue>> {
	const attributes = record(value, field);
	const entries = Object.entries(attributes);
	if (entries.length > maximumEntries) {
		throw new Error(`${field} exceeds ${maximumEntries} entries.`);
	}
	for (const [key, entry] of entries) {
		assertNamespacedValue(key, `${field} key`);
		assertSemanticJsonValue(entry, `${field}.${key}`);
	}
}

function assertStringArray(
	value: unknown,
	field: string,
	maximumEntries: number,
	maximumBytes: number,
	sorted: boolean,
): asserts value is readonly string[] {
	if (!Array.isArray(value) || value.length > maximumEntries) {
		throw new Error(`${field} must contain 0..${maximumEntries} entries.`);
	}
	const seen = new Set<string>();
	let previous: string | undefined;
	for (const [index, entry] of value.entries()) {
		assertNfcString(entry, `${field}[${index}]`, 1, maximumBytes);
		if (seen.has(entry)) throw new Error(`${field} must be duplicate-free.`);
		if (sorted && previous !== undefined && previous >= entry) {
			throw new Error(`${field} must be sorted.`);
		}
		seen.add(entry);
		previous = entry;
	}
}

function assertNamespacedValue(value: unknown, field: string): asserts value is string {
	assertNfcString(value, field, 1, 256);
	if (!/^[A-Za-z][A-Za-z0-9_-]*(?:[.:/][A-Za-z0-9][A-Za-z0-9._:/-]*)+$/u.test(value)) {
		throw new Error(`${field} must be namespaced.`);
	}
}

function assertPortableSegment(segment: string): void {
	assertNfcString(segment, "Wiki Item path segment", 1, 64);
	if (
		segment === "." ||
		segment === ".." ||
		/[\u0000-\u001f\u007f<>:"|?*]/u.test(segment) ||
		/[. ]$/u.test(segment)
	) {
		throw new Error(`Invalid portable path segment ${JSON.stringify(segment)}.`);
	}
	const stem = segment.split(".", 1)[0]?.toUpperCase() ?? "";
	if (
		/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/u.test(stem)
	) {
		throw new Error(`Reserved Windows path segment ${JSON.stringify(segment)}.`);
	}
}
