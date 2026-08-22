import {parse as parseYaml} from "yaml";
import type {
	KnowledgePostStateMediaType,
	KnowledgeTargetRef,
} from "../changes/trace/contracts.ts";
import {
	canonicalJsonDigest,
	sha256Digest,
	toCanonicalJsonValue,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../utils/canonical-json.ts";
import {parseOkfDocument} from "./okf-frontmatter.ts";
import {
	isKnowledgeSubjectId,
	KNOWLEDGE_FACET_ID_PATTERN,
	normalizeOkfPath,
} from "./okf.ts";

export function compareKnowledgeText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

export function canonicalKnowledgeValue<T>(value: T): T {
	// SAFETY: Knowledge callers provide JSON-domain records; canonicalization preserves declared structure.
	return toCanonicalJsonValue(value) as unknown as T;
}

const compareText = compareKnowledgeText;
const canonicalValue = canonicalKnowledgeValue;

export const KNOWLEDGE_STATE_PROTOCOL = Object.freeze({
	id: "codewiki.knowledge-state",
	version: "1.0.0",
} as const);
export const KNOWLEDGE_PROJECTION_PROTOCOL = Object.freeze({
	id: "codewiki.knowledge-projection",
	version: "1.0.0",
} as const);
export const KNOWLEDGE_CHECKPOINT_PROTOCOL = Object.freeze({
	id: "codewiki.knowledge-checkpoint",
	version: "1.0.0",
} as const);
export const KNOWLEDGE_COMPILER_PROTOCOL = Object.freeze({
	id: "codewiki.knowledge-compiler",
	version: "1.0.0",
} as const);

const KNOWLEDGE_PROJECTION_MAX_FILES = 512;
const KNOWLEDGE_PROJECTION_MAX_BYTES = 8 * 1024 * 1024;

export interface KnowledgeCompilerIdentity {
	readonly protocol: typeof KNOWLEDGE_COMPILER_PROTOCOL;
	readonly compilerId: string;
	readonly compilerVersion: string;
	readonly markdownRenderer: string;
	readonly yamlRenderer: string;
	readonly digest: Sha256Digest;
}

export interface KnowledgeProjectionFile {
	readonly path: string;
	readonly mediaType: KnowledgePostStateMediaType;
	readonly bytes: string;
	readonly byteDigest: Sha256Digest;
}

export interface KnowledgeProjection {
	readonly protocol: typeof KNOWLEDGE_PROJECTION_PROTOCOL;
	readonly compiler: KnowledgeCompilerIdentity;
	readonly files: readonly KnowledgeProjectionFile[];
	readonly projectionDigest: Sha256Digest;
}

export interface KnowledgeSemanticCell {
	readonly target: KnowledgeTargetRef;
	readonly mediaType: KnowledgePostStateMediaType;
	readonly semanticValue: CanonicalJsonValue;
	readonly digest: Sha256Digest;
}

export interface KnowledgeTombstone {
	readonly target: KnowledgeTargetRef;
	readonly retiredByEffectId: string;
}

export interface KnowledgeState {
	readonly protocol: typeof KNOWLEDGE_STATE_PROTOCOL;
	readonly cells: readonly KnowledgeSemanticCell[];
	readonly tombstones: readonly KnowledgeTombstone[];
	readonly stateDigest: Sha256Digest;
}

export interface KnowledgeCheckpoint {
	readonly protocol: typeof KNOWLEDGE_CHECKPOINT_PROTOCOL;
	readonly state: KnowledgeState;
	readonly projection: KnowledgeProjection;
	readonly checkpointDigest: Sha256Digest;
}

export interface ResolvedKnowledgeCell extends KnowledgeSemanticCell {
	readonly path: string;
	readonly locator?: KnowledgeFacetLocator;
	readonly characterStart: number;
	readonly characterEnd: number;
}

export type KnowledgeFacetLocator =
	| Readonly<{readonly kind: "heading_path"; readonly path: readonly string[]}>
	| Readonly<{readonly kind: "yaml"; readonly pointer: string}>;

export const DEFAULT_KNOWLEDGE_COMPILER = createKnowledgeCompilerIdentity({
	compilerId: "codewiki.project-server.knowledge",
	compilerVersion: "1.0.0",
	markdownRenderer: "codewiki.markdown-splice/1.0.0",
	yamlRenderer: "codewiki.yaml-splice/1.0.0",
});

export function createKnowledgeCompilerIdentity(input: {
	readonly compilerId: string;
	readonly compilerVersion: string;
	readonly markdownRenderer: string;
	readonly yamlRenderer: string;
}): KnowledgeCompilerIdentity {
	for (const [field, value] of Object.entries(input)) {
		if (!value.trim() || value.length > 128) {
			throw new Error(`Knowledge compiler ${field} must be bounded non-empty text.`);
		}
	}
	const body = {
		protocol: KNOWLEDGE_COMPILER_PROTOCOL,
		compilerId: input.compilerId,
		compilerVersion: input.compilerVersion,
		markdownRenderer: input.markdownRenderer,
		yamlRenderer: input.yamlRenderer,
	};
	return canonicalValue({...body, digest: canonicalJsonDigest(body)});
}

export function createKnowledgeCheckpoint(input: {
	readonly files: readonly Omit<KnowledgeProjectionFile, "byteDigest">[];
	readonly tombstones?: readonly KnowledgeTombstone[];
	readonly compiler?: KnowledgeCompilerIdentity;
}): KnowledgeCheckpoint {
	const compiler = input.compiler ?? DEFAULT_KNOWLEDGE_COMPILER;
	assertKnowledgeCompilerIdentity(compiler);
	const files = normalizeProjectionFiles(input.files);
	const resolved = resolveKnowledgeProjection(files);
	const tombstones = normalizeTombstones(input.tombstones ?? []);
	const activeKeys = new Set(resolved.map((cell) => knowledgeTargetKey(cell.target)));
	for (const tombstone of tombstones) {
		if (activeKeys.has(knowledgeTargetKey(tombstone.target))) {
			throw new Error(
				`Knowledge target ${knowledgeTargetKey(tombstone.target)} cannot be active and tombstoned.`,
			);
		}
	}
	const cells = resolved.map(({path: _path, locator: _locator, characterStart: _start, characterEnd: _end, ...cell}) => cell);
	const stateBody = {
		protocol: KNOWLEDGE_STATE_PROTOCOL,
		cells,
		tombstones,
	};
	const state = canonicalValue({
		...stateBody,
		stateDigest: canonicalJsonDigest(stateBody),
	});
	const projectionBody = {
		protocol: KNOWLEDGE_PROJECTION_PROTOCOL,
		compiler,
		files,
	};
	const projection = canonicalValue({
		...projectionBody,
		projectionDigest: canonicalJsonDigest(projectionBody),
	});
	const checkpointBody = {
		protocol: KNOWLEDGE_CHECKPOINT_PROTOCOL,
		state,
		projection,
	};
	return canonicalValue({
		...checkpointBody,
		checkpointDigest: canonicalJsonDigest(checkpointBody),
	});
}

export function assertKnowledgeCheckpoint(
	checkpoint: KnowledgeCheckpoint,
): void {
	const recreated = createKnowledgeCheckpoint({
		files: checkpoint.projection.files.map((file) => ({
			path: file.path,
			mediaType: file.mediaType,
			bytes: file.bytes,
		})),
		tombstones: checkpoint.state.tombstones,
		compiler: checkpoint.projection.compiler,
	});
	if (recreated.checkpointDigest !== checkpoint.checkpointDigest) {
		throw new Error("Knowledge checkpoint identity is invalid.");
	}
}

export function resolveKnowledgeProjection(
	files: readonly KnowledgeProjectionFile[],
): readonly ResolvedKnowledgeCell[] {
	const cells: ResolvedKnowledgeCell[] = [];
	const subjectIds = new Set<string>();
	for (const file of files) {
		const resolved = resolveProjectionFile(file);
		const subject = resolved[0];
		if (!subject) throw new Error(`Knowledge projection ${file.path} has no subject.`);
		if (subjectIds.has(subject.target.subjectId)) {
			throw new Error(`Duplicate Knowledge subject ${subject.target.subjectId}.`);
		}
		subjectIds.add(subject.target.subjectId);
		cells.push(...resolved);
	}
	validateReferenceClosure(files, subjectIds);
	return cells.sort((left, right) =>
		compareText(knowledgeTargetKey(left.target), knowledgeTargetKey(right.target)),
	);
}

export function knowledgeCellByTarget(
	checkpoint: KnowledgeCheckpoint,
	target: KnowledgeTargetRef,
): KnowledgeSemanticCell | undefined {
	const key = knowledgeTargetKey(target);
	return checkpoint.state.cells.find(
		(cell) => knowledgeTargetKey(cell.target) === key,
	);
}

export function knowledgeTargetKey(target: KnowledgeTargetRef): string {
	return target.facetId
		? `${target.subjectId}#${target.facetId}`
		: target.subjectId;
}

export function compareKnowledgeTargets(
	left: KnowledgeTargetRef,
	right: KnowledgeTargetRef,
): number {
	return compareText(knowledgeTargetKey(left), knowledgeTargetKey(right));
}

function normalizeProjectionFiles(
	values: readonly Omit<KnowledgeProjectionFile, "byteDigest">[],
): readonly KnowledgeProjectionFile[] {
	if (values.length > KNOWLEDGE_PROJECTION_MAX_FILES) {
		throw new Error(
			`Knowledge projection exceeds ${KNOWLEDGE_PROJECTION_MAX_FILES} files.`,
		);
	}
	let totalBytes = 0;
	const paths = new Set<string>();
	const files = values.map((value) => {
		const path = safeKnowledgePath(value.path);
		if (paths.has(path)) throw new Error(`Duplicate Knowledge path ${path}.`);
		paths.add(path);
		if (!isKnowledgeMediaType(value.mediaType)) {
			throw new Error(`Unsupported Knowledge media type ${String(value.mediaType)}.`);
		}
		if (mediaTypeForPath(path) !== value.mediaType) {
			throw new Error(`Knowledge media type does not match ${path}.`);
		}
		const bytes = Buffer.byteLength(value.bytes, "utf8");
		totalBytes += bytes;
		return {
			path,
			mediaType: value.mediaType,
			bytes: value.bytes,
			byteDigest: sha256Digest(value.bytes),
		};
	});
	if (totalBytes > KNOWLEDGE_PROJECTION_MAX_BYTES) {
		throw new Error(
			`Knowledge projection exceeds ${KNOWLEDGE_PROJECTION_MAX_BYTES} bytes.`,
		);
	}
	return canonicalValue(files.sort((left, right) => compareText(left.path, right.path)));
}

function normalizeTombstones(
	values: readonly KnowledgeTombstone[],
): readonly KnowledgeTombstone[] {
	const keys = new Set<string>();
	const result = values.map((value) => {
		assertKnowledgeTarget(value.target);
		if (!/^knowledge-effect:[0-9a-f]{64}$/u.test(value.retiredByEffectId)) {
			throw new Error("Knowledge tombstone requires canonical Effect identity.");
		}
		const key = knowledgeTargetKey(value.target);
		if (keys.has(key)) throw new Error(`Duplicate Knowledge tombstone ${key}.`);
		keys.add(key);
		return value;
	});
	return canonicalValue(
		result.sort((left, right) => compareKnowledgeTargets(left.target, right.target)),
	);
}

function resolveProjectionFile(
	file: KnowledgeProjectionFile,
): ResolvedKnowledgeCell[] {
	if (file.mediaType === "text/markdown") return resolveMarkdownFile(file);
	if (file.mediaType === "application/yaml") return resolveYamlFile(file);
	return resolveJsonFile(file);
}

function resolveMarkdownFile(
	file: KnowledgeProjectionFile,
): ResolvedKnowledgeCell[] {
	const document = parseOkfDocument(file.path, file.bytes);
	if (!document.conceptId || !document.frontmatter) {
		throw new Error(`Knowledge Markdown ${file.path} requires codewiki_id frontmatter.`);
	}
	const target = {subjectId: document.conceptId};
	const cells = [
		semanticCell({
			target,
			mediaType: file.mediaType,
			semanticValue: {
				frontmatter: toCanonicalJsonValue(document.frontmatter),
				body: document.body,
			},
			path: file.path,
			characterStart: 0,
			characterEnd: file.bytes.length,
		}),
	];
	const facets = parseFacetLocators(document.frontmatter.codewiki_facets);
	for (const [facetId, locator] of facets) {
		if (locator.kind !== "heading_path") {
			throw new Error(`Markdown facet ${document.conceptId}#${facetId} requires heading_path.`);
		}
		const span = markdownHeadingSpan(file.bytes, locator.path);
		cells.push(
			semanticCell({
				target: {subjectId: document.conceptId, facetId},
				mediaType: file.mediaType,
				semanticValue: file.bytes.slice(span.start, span.end),
				path: file.path,
				locator,
				characterStart: span.start,
				characterEnd: span.end,
			}),
		);
	}
	return cells;
}

function resolveYamlFile(file: KnowledgeProjectionFile): ResolvedKnowledgeCell[] {
	const value = parseYaml(file.bytes);
	if (!isRecord(value) || !isKnowledgeSubjectId(value.codewiki_id)) {
		throw new Error(`Knowledge YAML ${file.path} requires codewiki_id.`);
	}
	const subjectId = value.codewiki_id;
	const cells = [
		semanticCell({
			target: {subjectId},
			mediaType: file.mediaType,
			semanticValue: toCanonicalJsonValue(value),
			path: file.path,
			characterStart: 0,
			characterEnd: file.bytes.length,
		}),
	];
	for (const [facetId, locator] of parseFacetLocators(value.codewiki_facets)) {
		if (locator.kind !== "yaml") {
			throw new Error(`YAML facet ${subjectId}#${facetId} requires yaml locator.`);
		}
		const facetValue = yamlPointerValue(value, locator.pointer);
		cells.push(
			semanticCell({
				target: {subjectId, facetId},
				mediaType: file.mediaType,
				semanticValue: facetValue,
				path: file.path,
				locator,
				characterStart: 0,
				characterEnd: file.bytes.length,
			}),
		);
	}
	return cells;
}

function resolveJsonFile(file: KnowledgeProjectionFile): ResolvedKnowledgeCell[] {
	let value: unknown;
	try {
		value = JSON.parse(file.bytes);
	} catch (error) {
		throw new Error(
			`Knowledge JSON ${file.path} is invalid: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	if (!isRecord(value) || !isKnowledgeSubjectId(value.codewiki_id)) {
		throw new Error(`Knowledge JSON ${file.path} requires codewiki_id.`);
	}
	return [
		semanticCell({
			target: {subjectId: value.codewiki_id},
			mediaType: file.mediaType,
			semanticValue: toCanonicalJsonValue(value),
			path: file.path,
			characterStart: 0,
			characterEnd: file.bytes.length,
		}),
	];
}

function semanticCell(input: Omit<ResolvedKnowledgeCell, "digest">): ResolvedKnowledgeCell {
	const body = {
		target: input.target,
		mediaType: input.mediaType,
		semanticValue: input.semanticValue,
	};
	return canonicalValue({...input, digest: canonicalJsonDigest(body)});
}

function parseFacetLocators(value: unknown): readonly [string, KnowledgeFacetLocator][] {
	if (value === undefined) return [];
	if (!isRecord(value)) throw new Error("codewiki_facets must be a mapping.");
	return Object.entries(value)
		.map(([facetId, locator]): [string, KnowledgeFacetLocator] => {
			if (!KNOWLEDGE_FACET_ID_PATTERN.test(facetId) || !isRecord(locator)) {
				throw new Error(`Invalid Knowledge facet ${facetId}.`);
			}
			if (
				locator.kind === "heading_path" &&
				Array.isArray(locator.path) &&
				locator.path.length > 0 &&
				locator.path.every((part) => typeof part === "string" && part.trim())
			) {
				return [facetId, {kind: "heading_path", path: locator.path as string[]}];
			}
			if (
				locator.kind === "yaml" &&
				typeof locator.pointer === "string" &&
				/^\/(?:[^~/]|~[01])+(?:\/(?:[^~/]|~[01])+)*$/u.test(locator.pointer)
			) {
				return [facetId, {kind: "yaml", pointer: locator.pointer}];
			}
			throw new Error(`Invalid Knowledge facet locator ${facetId}.`);
		})
		.sort(([left], [right]) => compareText(left, right));
}

export function markdownHeadingSpan(
	source: string,
	path: readonly string[],
): {readonly start: number; readonly end: number; readonly level: number} {
	const headings: Array<{
		readonly start: number;
		readonly end: number;
		readonly level: number;
		readonly title: string;
		readonly ancestry: readonly string[];
	}> = [];
	const stack: Array<{readonly level: number; readonly title: string}> = [];
	const pattern = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*(?:\r?\n|$)/gmu;
	for (const match of source.matchAll(pattern)) {
		const level = match[1]?.length ?? 0;
		const title = match[2]?.trim() ?? "";
		while ((stack.at(-1)?.level ?? 0) >= level) stack.pop();
		const ancestry = [...stack.map((entry) => entry.title), title];
		headings.push({
			start: match.index,
			end: match.index + match[0].length,
			level,
			title,
			ancestry,
		});
		stack.push({level, title});
	}
	const index = headings.findIndex((heading) => sameTextList(heading.ancestry, path));
	if (index < 0) throw new Error(`Markdown heading path ${path.join(" > ")} is unresolved.`);
	const heading = headings[index] as (typeof headings)[number];
	const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
	return {start: heading.start, end: next?.start ?? source.length, level: heading.level};
}

function yamlPointerValue(
	root: unknown,
	pointer: string,
): CanonicalJsonValue {
	let current = root;
	for (const encoded of pointer.slice(1).split("/")) {
		const key = encoded.replace(/~1/g, "/").replace(/~0/g, "~");
		if (Array.isArray(current) && /^(?:0|[1-9][0-9]*)$/u.test(key)) {
			current = current.at(Number(key));
		} else if (isRecord(current) && Object.hasOwn(current, key)) {
			current = Object.getOwnPropertyDescriptor(current, key)?.value;
		} else {
			throw new Error(`YAML pointer ${pointer} is unresolved.`);
		}
	}
	if (current === undefined) throw new Error(`YAML pointer ${pointer} is unresolved.`);
	return toCanonicalJsonValue(current);
}

function validateReferenceClosure(
	files: readonly KnowledgeProjectionFile[],
	subjectIds: ReadonlySet<string>,
): void {
	for (const file of files) {
		let root: unknown;
		if (file.mediaType === "text/markdown") {
			root = parseOkfDocument(file.path, file.bytes).frontmatter;
		} else if (file.mediaType === "application/yaml") {
			root = parseYaml(file.bytes);
		} else {
			root = parseJsonFile(file.path, file.bytes);
		}
		if (!isRecord(root) || !Array.isArray(root.codewiki_relationships)) continue;
		for (const relationship of root.codewiki_relationships) {
			if (
				!isRecord(relationship) ||
				!isKnowledgeSubjectId(relationship.target) ||
				!subjectIds.has(relationship.target)
			) {
				throw new Error(`Knowledge relationship closure is invalid in ${file.path}.`);
			}
		}
	}
}

function parseJsonFile(path: string, bytes: string): CanonicalJsonValue {
	try {
		return toCanonicalJsonValue(JSON.parse(bytes));
	} catch (error) {
		throw new Error(
			`Knowledge JSON ${path} is invalid: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function assertKnowledgeCompilerIdentity(value: KnowledgeCompilerIdentity): void {
	const recreated = createKnowledgeCompilerIdentity({
		compilerId: value.compilerId,
		compilerVersion: value.compilerVersion,
		markdownRenderer: value.markdownRenderer,
		yamlRenderer: value.yamlRenderer,
	});
	if (recreated.digest !== value.digest) {
		throw new Error("Knowledge compiler identity is invalid.");
	}
}

function assertKnowledgeTarget(value: KnowledgeTargetRef): void {
	if (!isKnowledgeSubjectId(value.subjectId)) {
		throw new Error("Knowledge target subject identity is invalid.");
	}
	if (value.facetId !== undefined && !KNOWLEDGE_FACET_ID_PATTERN.test(value.facetId)) {
		throw new Error("Knowledge target facet identity is invalid.");
	}
}

function safeKnowledgePath(value: string): string {
	const path = normalizeOkfPath(value);
	if (
		!path ||
		path.startsWith("/") ||
		path.includes("\0") ||
		path.split("/").some((part) => part === "" || part === "." || part === "..") ||
		!/\.(?:md|yaml|json)$/u.test(path)
	) {
		throw new Error(`Unsafe Knowledge path ${JSON.stringify(value)}.`);
	}
	return path;
}

function mediaTypeForPath(path: string): KnowledgePostStateMediaType {
	if (path.endsWith(".md")) return "text/markdown";
	if (path.endsWith(".yaml")) return "application/yaml";
	return "application/json";
}

function isKnowledgeMediaType(value: unknown): value is KnowledgePostStateMediaType {
	return (
		value === "text/markdown" ||
		value === "application/yaml" ||
		value === "application/json"
	);
}

function sameTextList(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

