import {knowledgeTargetKey, type KnowledgeCheckpoint} from "./state.ts";
import {
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../utils/canonical-json.ts";

export const KNOWLEDGE_FACT_INVENTORY_PROTOCOL = Object.freeze({
	id: "codewiki.knowledge-fact-inventory",
	version: "1.0.0",
} as const);

export type KnowledgeFactClass =
	| "durable_seed"
	| "accepted_semantic_cell"
	| "deterministic_projection"
	| "git_derived_realization";

export interface KnowledgeRealizationBinding {
	readonly targetKey: string;
	readonly sourceRefs: readonly string[];
	readonly testRefs: readonly string[];
	readonly treeDigest: Sha256Digest;
}

export interface KnowledgeFactInventoryEntry {
	readonly id: string;
	readonly classification: KnowledgeFactClass;
	readonly digest: Sha256Digest;
	readonly targetKey: string | null;
	readonly refs: readonly string[];
}

export interface KnowledgeFactInventory {
	readonly schemaVersion: typeof KNOWLEDGE_FACT_INVENTORY_PROTOCOL.version;
	readonly knowledgeStateDigest: Sha256Digest;
	readonly knowledgeProjectionDigest: Sha256Digest;
	readonly entries: readonly KnowledgeFactInventoryEntry[];
	readonly counts: Readonly<Record<KnowledgeFactClass, number>>;
	readonly coverage: "complete";
	readonly digest: Sha256Digest;
}

export function createKnowledgeFactInventory(input: {
	readonly checkpoint: KnowledgeCheckpoint;
	readonly acceptedSemanticTargetKeys?: readonly string[];
	readonly realizations?: readonly KnowledgeRealizationBinding[];
	readonly generatedViewPrefix?: string;
}): KnowledgeFactInventory {
	const acceptedTargets = new Set(input.acceptedSemanticTargetKeys ?? []);
	const generatedViewPrefix = normalizeViewPrefix(input.generatedViewPrefix ?? "views/");
	const semanticEntries = input.checkpoint.state.cells.map((cell) => {
		const targetKey = knowledgeTargetKey(cell.target);
		return inventoryEntry({
			id: `knowledge-cell:${targetKey}`,
			classification: acceptedTargets.has(targetKey)
				? "accepted_semantic_cell"
				: "durable_seed",
			digest: cell.digest,
			targetKey,
			refs: [],
		});
	});
	const projectionEntries = input.checkpoint.projection.files.map((file) =>
		inventoryEntry({
			id: `knowledge-projection:${file.path}`,
			classification: file.path.startsWith(generatedViewPrefix)
				? "deterministic_projection"
				: "durable_seed",
			digest: file.byteDigest,
			targetKey: null,
			refs: [file.path],
		}),
	);
	const realizationEntries = (input.realizations ?? []).map((realization) =>
		inventoryEntry({
			id: `knowledge-realization:${realization.targetKey}:${realization.treeDigest}`,
			classification: "git_derived_realization",
			digest: canonicalJsonDigest(realization),
			targetKey: realization.targetKey,
			refs: sortedUnique([...realization.sourceRefs, ...realization.testRefs]),
		}),
	);
	const entries = [...semanticEntries, ...projectionEntries, ...realizationEntries].sort(
		(left, right) => compareText(left.id, right.id),
	);
	assertCompleteSemanticCoverage(input.checkpoint, entries);
	assertCompleteProjectionCoverage(input.checkpoint, entries);
	const counts = Object.freeze({
		durable_seed: entries.filter((entry) => entry.classification === "durable_seed").length,
		accepted_semantic_cell: entries.filter(
			(entry) => entry.classification === "accepted_semantic_cell",
		).length,
		deterministic_projection: entries.filter(
			(entry) => entry.classification === "deterministic_projection",
		).length,
		git_derived_realization: entries.filter(
			(entry) => entry.classification === "git_derived_realization",
		).length,
	});
	const body = toCanonicalJsonValue({
		schemaVersion: KNOWLEDGE_FACT_INVENTORY_PROTOCOL.version,
		knowledgeStateDigest: input.checkpoint.state.stateDigest,
		knowledgeProjectionDigest: input.checkpoint.projection.projectionDigest,
		entries,
		counts,
		coverage: "complete",
	});
	// SAFETY: canonical conversion preserves fields validated and assembled above.
	return Object.freeze({
		...(body as unknown as Omit<KnowledgeFactInventory, "digest">),
		digest: canonicalJsonDigest(body),
	});
}

export function assertKnowledgeFactInventory(value: KnowledgeFactInventory): void {
	if (
		value.schemaVersion !== KNOWLEDGE_FACT_INVENTORY_PROTOCOL.version ||
		value.coverage !== "complete" ||
		new Set(value.entries.map((entry) => entry.id)).size !== value.entries.length
	) {
		throw new Error("Knowledge fact inventory coverage is incomplete.");
	}
	const {digest: _digest, ...body} = value;
	if (canonicalJsonDigest(body) !== value.digest) {
		throw new Error("Knowledge fact inventory digest is invalid.");
	}
}

function inventoryEntry(
	value: Omit<KnowledgeFactInventoryEntry, "refs"> & {readonly refs: readonly string[]},
): KnowledgeFactInventoryEntry {
	return Object.freeze({...value, refs: sortedUnique(value.refs)});
}

function assertCompleteSemanticCoverage(
	checkpoint: KnowledgeCheckpoint,
	entries: readonly KnowledgeFactInventoryEntry[],
): void {
	const semanticTargetKeys = entries
		.filter(
			(entry) =>
				entry.classification === "durable_seed" ||
				entry.classification === "accepted_semantic_cell",
		)
		.map((entry) => entry.targetKey);
	const expected = checkpoint.state.cells.map((cell) => knowledgeTargetKey(cell.target)).sort(compareText);
	const actual = semanticTargetKeys.filter((value): value is string => value !== null).sort(compareText);
	if (JSON.stringify(expected) !== JSON.stringify(actual)) {
		throw new Error("Knowledge fact inventory omits current semantic cells.");
	}
}

function assertCompleteProjectionCoverage(
	checkpoint: KnowledgeCheckpoint,
	entries: readonly KnowledgeFactInventoryEntry[],
): void {
	const expected = checkpoint.projection.files.map((file) => file.path).sort(compareText);
	const actual = entries
		.filter((entry) => entry.id.startsWith("knowledge-projection:"))
		.flatMap((entry) => entry.refs)
		.sort(compareText);
	if (JSON.stringify(expected) !== JSON.stringify(actual)) {
		throw new Error("Knowledge fact inventory omits current projection files.");
	}
}

function normalizeViewPrefix(value: string): string {
	if (value.length === 0 || value.startsWith("/") || value.includes("..")) {
		throw new Error("Knowledge generated view prefix is invalid.");
	}
	return value.endsWith("/") ? value : `${value}/`;
}

function sortedUnique(values: readonly string[]): readonly string[] {
	return Object.freeze([...new Set(values)].sort(compareText));
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
