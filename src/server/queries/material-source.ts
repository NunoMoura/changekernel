import type {ProjectSourceSelector} from "../../api/contracts/read.ts";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {sameGitOid} from "../../kernel/identity/git.ts";
import {
	readMarkdownCorpus,
	type MarkdownCorpus,
	type MarkdownCorpusEntryInput,
	type MarkdownCorpusIssue,
	type MarkdownCorpusLimits,
} from "../../kernel/wiki/corpus.ts";
import type {ProjectSnapshot} from "../../kernel/changes/snapshot.ts";
import type {ProjectStoreIssue, ProjectStorePort, ProjectStoreTreeEntry} from "../../ports/project-store.ts";
import {
	resolveProjectSourceDetailed,
	storeIssueCode,
	type DetailedProjectSourceIssue,
	type ProjectReadConfiguration,
	type ProjectSourceIssueCode,
} from "./source.ts";

export interface LoadedMarkdownMaterialSource {
	readonly snapshot: ProjectSnapshot;
	readonly corpus: MarkdownCorpus;
}

export type MarkdownMaterialLimitField =
	| "maximumEntries"
	| "maximumPathBytes"
	| "maximumDocuments"
	| "maximumDocumentBytes"
	| "maximumTotalBytes";

/** Material issue codes: the shared source codes plus typed invalid input. */
export type MarkdownMaterialSourceIssueCode = ProjectSourceIssueCode | "invalid_input";

/**
 * Structured causes retained for diagnosis: invalid input, source
 * selection/binding, Store failures and corpus validation stay
 * distinguishable. These never flow through the legacy `resolveProjectSource`
 * response shape.
 */
export type MarkdownMaterialSourceCause =
	| Readonly<{kind: "invalid_limits"; field: MarkdownMaterialLimitField | null}>
	| Readonly<{kind: "source_resolution"; failure: DetailedProjectSourceIssue}>
	| Readonly<{kind: "store_failure"; store: ProjectStoreIssue}>
	| Readonly<{kind: "material_budget"; budget: "entries" | "path_bytes" | "documents" | "document_bytes" | "total_bytes"}>
	| Readonly<{kind: "material_binding"; check: "snapshot" | "tree_commit" | "entry_array" | "entry_path" | "blob_oid"}>
	| Readonly<{kind: "corpus_failure"; corpus: MarkdownCorpusIssue}>;

export interface MarkdownMaterialSourceIssue {
	readonly code: MarkdownMaterialSourceIssueCode;
	readonly operation: "admit_limits" | "resolve_source" | "read_material";
	readonly message: string;
	readonly cause: MarkdownMaterialSourceCause;
}

const MATERIAL_LIMIT_FIELDS: readonly MarkdownMaterialLimitField[] = [
	"maximumEntries",
	"maximumPathBytes",
	"maximumDocuments",
	"maximumDocumentBytes",
	"maximumTotalBytes",
];

/**
 * Reads passive exact material from one resolved Project source. All five
 * limits are snapshotted as own data fields before any Store call or await;
 * entry, path-byte and document budgets are enforced before any content is
 * loaded; and an exactly exhausted total budget still admits empty blobs
 * through a one-byte-cap probe under the Store's positive-cap API. The
 * unchanged pure corpus remains the final content/descriptor validator; this
 * path adds no normalization, case folding, adoption or authority.
 */
export async function loadMarkdownMaterialSource(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	source: ProjectSourceSelector,
	limits: MarkdownCorpusLimits,
): Promise<Outcome<LoadedMarkdownMaterialSource, MarkdownMaterialSourceIssue>> {
	const admitted = admitMaterialLimits(limits);
	if (!admitted.ok) return admitted;
	const resolved = await resolveProjectSourceDetailed(store, configuration, source);
	if (!resolved.ok) {
		return failure(materialIssue(resolved.error.code, "resolve_source", resolved.error.message, {kind: "source_resolution", failure: resolved.error}));
	}
	const snapshot = resolved.value;
	if (snapshot.repositoryId !== configuration.repositoryId || snapshot.objectFormat !== configuration.objectFormat ||
		snapshot.commit.algorithm !== configuration.objectFormat || snapshot.tree.algorithm !== configuration.objectFormat ||
		!snapshot.complete || (source.kind === "commit" && !sameGitOid(source.commit, snapshot.commit))) {
		return failure(materialIssue("source_stale", "read_material", "Resolved snapshot does not retain the requested binding.", {kind: "material_binding", check: "snapshot"}));
	}
	const tree = await store.readTree({
		repositoryId: configuration.repositoryId,
		objectFormat: configuration.objectFormat,
		commit: snapshot.commit,
		pathPrefix: "",
		maximumEntries: admitted.value.maximumEntries,
	});
	if (!tree.ok) return failure(storeMaterialIssue(tree.error));
	if (!sameGitOid(tree.value.commit, snapshot.commit)) {
		return failure(materialIssue("source_stale", "read_material", "Material tree read did not retain the resolved Project source.", {kind: "material_binding", check: "tree_commit"}));
	}
	const treeEntries = tree.value.entries;
	if (!Array.isArray(treeEntries)) {
		return failure(materialIssue("invalid_project_state", "read_material", "Material tree response entries are malformed.", {kind: "material_binding", check: "entry_array"}));
	}
	// Entry count is checked independently of Store compliance.
	if (treeEntries.length > admitted.value.maximumEntries) {
		return failure(materialIssue("limit_exceeded", "read_material", "Material entry count exceeds the supplied limit.", {kind: "material_budget", budget: "entries"}));
	}
	// Count paths only within the remaining budget, before loading any content.
	// The corpus retains final grammar, identity, collision and content checks.
	let pathBytesUsed = 0;
	let documents = 0;
	for (const entry of treeEntries) {
		const pathBytes = countablePathBytes(entry, admitted.value.maximumPathBytes - pathBytesUsed);
		if (pathBytes === null) {
			return failure(materialIssue("invalid_project_state", "read_material", "Material descriptor path is not lossless text.", {kind: "material_binding", check: "entry_path"}));
		}
		if (pathBytes === false) {
			return failure(materialIssue("limit_exceeded", "read_material", "Material path bytes exceed the supplied limit.", {kind: "material_budget", budget: "path_bytes"}));
		}
		pathBytesUsed += pathBytes;
		if (isMarkdownDocument(entry)) {
			documents += 1;
			if (documents > admitted.value.maximumDocuments) {
				return failure(materialIssue("limit_exceeded", "read_material", "Material document count exceeds the supplied limit.", {kind: "material_budget", budget: "documents"}));
			}
		}
	}
	// Content loading: inclusive budgets. At positive remaining budget request
	// the smaller of the per-document cap and the remaining total; at zero
	// request exactly one byte and accept only zero bytes, so an exactly
	// exhausted total still admits empty blobs. Returned lengths are rechecked
	// even if a Store ignores its cap, never decoded over budget, and never
	// returned as partial success.
	const entries: MarkdownCorpusEntryInput[] = [];
	let loadedBytes = 0;
	for (const entry of treeEntries) {
		if (!isMarkdownDocument(entry)) {
			entries.push(Object.freeze({path: entry.path, mode: entry.mode, oid: entry.oid}));
			continue;
		}
		const remainingBytes = admitted.value.maximumTotalBytes - loadedBytes;
		const requestedBytes = remainingBytes === 0 ? 1 : Math.min(admitted.value.maximumDocumentBytes, remainingBytes);
		const blob = await store.readBlob({
			repositoryId: configuration.repositoryId,
			objectFormat: configuration.objectFormat,
			commit: snapshot.commit,
			path: entry.path,
			maximumBytes: requestedBytes,
		});
		if (!blob.ok) return failure(storeMaterialIssue(blob.error));
		if (!sameGitOid(blob.value.oid, entry.oid)) {
			return failure(materialIssue("source_stale", "read_material", "Material blob read did not retain the resolved Project source.", {kind: "material_binding", check: "blob_oid"}));
		}
		if (!(blob.value.bytes instanceof Uint8Array)) {
			return failure(materialIssue("invalid_project_state", "read_material", "Material content is not a byte array.", {
				kind: "corpus_failure", corpus: {code: "invalid_input", path: `$.entries[${entries.length}].bytes`, message: "Markdown content requires a byte array."},
			}));
		}
		const byteLength = blob.value.bytes.byteLength;
		if (byteLength > admitted.value.maximumDocumentBytes || byteLength > remainingBytes) {
			const budget = byteLength > remainingBytes ? "total_bytes" : "document_bytes";
			return failure(materialIssue("limit_exceeded", "read_material", "Material content bytes exceed the supplied limit.", {kind: "material_budget", budget}));
		}
		loadedBytes += byteLength;
		entries.push(Object.freeze({path: entry.path, mode: entry.mode, oid: entry.oid, bytes: blob.value.bytes}));
	}
	const corpus = readMarkdownCorpus({snapshot: snapshot.commit, entries, limits: admitted.value});
	if (!corpus.ok) {
		return failure(materialIssue(
			corpus.error.code === "limit_exceeded" ? "limit_exceeded" : "invalid_project_state",
			"read_material",
			corpus.error.message,
			{kind: "corpus_failure", corpus: corpus.error},
		));
	}
	return success(Object.freeze({snapshot, corpus: corpus.value}));
}

/**
 * Snapshots all five limits as own data fields before any Store call or
 * await. Missing, accessor, inherited, non-number, non-finite, fractional,
 * zero, negative and unsafe-integer fields fail as typed invalid input with no
 * implicit defaults; later caller mutation cannot change the admitted values.
 */
function admitMaterialLimits(limits: MarkdownCorpusLimits): Outcome<MarkdownCorpusLimits, MarkdownMaterialSourceIssue> {
	if (typeof limits !== "object" || limits === null) {
		return failure(materialIssue("invalid_input", "admit_limits", "Material limits must be an object with five own positive safe-integer fields.", {kind: "invalid_limits", field: null}));
	}
	const admitted: {maximumEntries: number; maximumPathBytes: number; maximumDocuments: number; maximumDocumentBytes: number; maximumTotalBytes: number} = {
		maximumEntries: 0,
		maximumPathBytes: 0,
		maximumDocuments: 0,
		maximumDocumentBytes: 0,
		maximumTotalBytes: 0,
	};
	for (const field of MATERIAL_LIMIT_FIELDS) {
		const descriptor = Object.getOwnPropertyDescriptor(limits, field);
		if (descriptor === undefined || !("value" in descriptor)) {
			return failure(limitIssue(field));
		}
		const value = descriptor.value;
		if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
			return failure(limitIssue(field));
		}
		admitted[field] = value;
	}
	return success(Object.freeze(admitted));
}

/** Document classification mirrors the corpus: a regular blob with an ASCII Markdown extension. */
function isMarkdownDocument(entry: ProjectStoreTreeEntry): boolean {
	return entry.kind === "blob" && (entry.mode === "100644" || entry.mode === "100755") &&
		/\.(?:md|markdown)$/i.test(entry.path);
}

/** Bound UTF-8 scanning without allocating an encoded copy; false means over budget. */
function countablePathBytes(entry: ProjectStoreTreeEntry, maximum: number): number | false | null {
	if (typeof entry !== "object" || entry === null || typeof entry.path !== "string") return null;
	const path = entry.path;
	if (path.length > maximum) return false;
	let total = 0;
	for (const character of path) {
		const point = character.codePointAt(0);
		if (point === undefined || (point >= 0xd800 && point <= 0xdfff)) return null;
		const size = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
		if (size > maximum - total) return false;
		total += size;
	}
	return total;
}

function storeMaterialIssue(value: ProjectStoreIssue): MarkdownMaterialSourceIssue {
	return materialIssue(storeIssueCode(value), "read_material", value.message, {kind: "store_failure", store: value});
}

function limitIssue(field: MarkdownMaterialLimitField): MarkdownMaterialSourceIssue {
	return materialIssue("invalid_input", "admit_limits", `Material limit ${field} must be an own positive safe-integer data field.`, {kind: "invalid_limits", field});
}

function materialIssue(
	code: MarkdownMaterialSourceIssueCode,
	operation: MarkdownMaterialSourceIssue["operation"],
	message: string,
	cause: MarkdownMaterialSourceCause,
): MarkdownMaterialSourceIssue {
	return Object.freeze({code, operation, message, cause});
}