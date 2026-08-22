import type {ChangeRevisionContent} from "../../changes/trace/contracts.ts";
import {knowledgeEffectId} from "../../knowledge/materialization.ts";
import {knowledgeTargetKey} from "../../knowledge/state.ts";
import {
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import type {
	DecisionActiveChangeBinding,
	DecisionSemanticRevision,
} from "./accepted-active-types.ts";

export const ACCEPTED_EFFECT_INDEX_PROTOCOL = Object.freeze({
	id: "codewiki.accepted-effect-index",
	version: "1.0.0",
} as const);

export type AcceptedChangeExpansionReason =
	| "effect_target_overlap"
	| "shared_invariant"
	| "explicit_relationship"
	| "unknown_semantics";

export interface AcceptedEffectIndexEntry {
	readonly effectId: string;
	readonly targetKey: string;
	readonly action: "set" | "retire";
}

export interface AcceptedChangeIndexEntry {
	readonly changeId: string;
	readonly revisionId: Sha256Digest;
	readonly effects: readonly AcceptedEffectIndexEntry[];
	readonly invariantIds: readonly string[];
	readonly relationshipChangeIds: readonly string[];
	readonly unknownSemantics: boolean;
	readonly digest: Sha256Digest;
}

export interface AcceptedEffectInvariantIndex {
	readonly schemaVersion: typeof ACCEPTED_EFFECT_INDEX_PROTOCOL.version;
	readonly acceptedActiveChangesDigest: Sha256Digest;
	readonly changes: readonly AcceptedChangeIndexEntry[];
	readonly targetChangeIds: Readonly<Record<string, readonly string[]>>;
	readonly invariantChangeIds: Readonly<Record<string, readonly string[]>>;
	readonly digest: Sha256Digest;
}

export interface AcceptedChangeCompatibilityCoverage {
	readonly changeId: string;
	readonly revisionId: Sha256Digest;
	readonly disposition: "index_only" | "expanded";
	readonly reasons: readonly AcceptedChangeExpansionReason[];
}

export interface AcceptedChangeCompatibilityContext {
	readonly schemaVersion: typeof ACCEPTED_EFFECT_INDEX_PROTOCOL.version;
	readonly acceptedActiveChangesDigest: Sha256Digest;
	readonly indexDigest: Sha256Digest;
	readonly expectedChangeIds: readonly string[];
	readonly coverage: readonly AcceptedChangeCompatibilityCoverage[];
	readonly expandedRevisions: readonly DecisionActiveChangeBinding[];
	readonly coverageStatus: "complete";
	readonly digest: Sha256Digest;
}

export function createAcceptedEffectInvariantIndex(input: {
	readonly acceptedChanges: readonly DecisionActiveChangeBinding[];
}): AcceptedEffectInvariantIndex {
	const acceptedChanges = input.acceptedChanges;
	const acceptedActiveChangesDigest = canonicalJsonDigest(acceptedChanges);
	const changes = acceptedChanges.map(indexChange).sort(compareChange);
	const targetChangeIds = invertedIndex(
		changes.flatMap((change) =>
			change.effects.map((effect) => [effect.targetKey, change.changeId] as const),
		),
	);
	const invariantChangeIds = invertedIndex(
		changes.flatMap((change) =>
			change.invariantIds.map((invariantId) => [invariantId, change.changeId] as const),
		),
	);
	const body = toCanonicalJsonValue({
		schemaVersion: ACCEPTED_EFFECT_INDEX_PROTOCOL.version,
		acceptedActiveChangesDigest,
		changes,
		targetChangeIds,
		invariantChangeIds,
	});
	// SAFETY: canonical conversion preserves fields validated and assembled above.
	return Object.freeze({
		...(body as unknown as Omit<AcceptedEffectInvariantIndex, "digest">),
		digest: canonicalJsonDigest(body),
	});
}

export function createAcceptedChangeCompatibilityContext(input: {
	readonly acceptedChanges: readonly DecisionActiveChangeBinding[];
	readonly subjectChangeId: string;
	readonly subjectRevisionId: Sha256Digest;
	readonly subjectRevision: ChangeRevisionContent;
	readonly subjectRelationshipChangeIds: readonly string[];
}): AcceptedChangeCompatibilityContext {
	const acceptedChanges = input.acceptedChanges;
	const acceptedActiveChangesDigest = canonicalJsonDigest(acceptedChanges);
	const index = createAcceptedEffectInvariantIndex({acceptedChanges});
	const subjectSummary = semanticSummary(
		input.subjectChangeId,
		input.subjectRevisionId,
		input.subjectRevision,
		input.subjectRelationshipChangeIds,
	);
	const acceptedById = new Map(acceptedChanges.map((change) => [change.changeId, change]));
	const coverage = index.changes.map((change) => {
		const reasons = expansionReasons(subjectSummary, change);
		return Object.freeze({
			changeId: change.changeId,
			revisionId: change.revisionId,
			disposition: reasons.length > 0 ? "expanded" as const : "index_only" as const,
			reasons,
		});
	});
	const expandedRevisions = coverage.flatMap((entry) => {
		if (entry.disposition !== "expanded") return [];
		const change = acceptedById.get(entry.changeId);
		if (!change) throw new Error(`Accepted Change ${entry.changeId} is absent from coverage.`);
		return [change];
	});
	const body = toCanonicalJsonValue({
		schemaVersion: ACCEPTED_EFFECT_INDEX_PROTOCOL.version,
		acceptedActiveChangesDigest,
		indexDigest: index.digest,
		expectedChangeIds: index.changes.map((change) => change.changeId),
		coverage,
		expandedRevisions,
		coverageStatus: "complete",
	});
	// SAFETY: canonical conversion preserves fields validated and assembled above.
	return Object.freeze({
		...(body as unknown as Omit<AcceptedChangeCompatibilityContext, "digest">),
		digest: canonicalJsonDigest(body),
	});
}

export function assertAcceptedEffectInvariantIndex(
	value: AcceptedEffectInvariantIndex,
): void {
	if (
		value.schemaVersion !== ACCEPTED_EFFECT_INDEX_PROTOCOL.version ||
		new Set(value.changes.map((change) => change.changeId)).size !== value.changes.length
	) {
		throw new Error("Accepted Effect index coverage is invalid.");
	}
	const {digest: _digest, ...body} = value;
	if (canonicalJsonDigest(body) !== value.digest) {
		throw new Error("Accepted Effect index digest is invalid.");
	}
}

export function assertAcceptedChangeCompatibilityContext(
	value: AcceptedChangeCompatibilityContext,
): void {
	if (
		value.schemaVersion !== ACCEPTED_EFFECT_INDEX_PROTOCOL.version ||
		value.coverageStatus !== "complete" ||
		value.expectedChangeIds.length !== value.coverage.length ||
		new Set(value.expectedChangeIds).size !== value.expectedChangeIds.length
	) {
		throw new Error("Accepted Change compatibility coverage is incomplete.");
	}
	for (let index = 0; index < value.coverage.length; index += 1) {
		if (value.coverage[index]?.changeId !== value.expectedChangeIds[index]) {
			throw new Error("Accepted Change compatibility coverage order is invalid.");
		}
	}
	const expandedIds = value.expandedRevisions.map((change) => change.changeId);
	const expectedExpandedIds = value.coverage
		.filter((entry) => entry.disposition === "expanded")
		.map((entry) => entry.changeId);
	if (JSON.stringify(expandedIds) !== JSON.stringify(expectedExpandedIds)) {
		throw new Error("Accepted Change compatibility expansion is incomplete.");
	}
	const {digest: _digest, ...body} = value;
	if (canonicalJsonDigest(body) !== value.digest) {
		throw new Error("Accepted Change compatibility digest is invalid.");
	}
}

function indexChange(change: DecisionActiveChangeBinding): AcceptedChangeIndexEntry {
	return semanticSummary(
		change.changeId,
		change.revision.revisionId,
		change.revision,
		change.relationships.map((relationship) => relationship.targetChangeId),
	);
}

function semanticSummary(
	changeId: string,
	revisionId: Sha256Digest,
	revision: ChangeRevisionContent | DecisionSemanticRevision,
	relationshipChangeIds: readonly string[],
): AcceptedChangeIndexEntry {
	const effects = revision.knowledge.kind === "effects"
		? revision.knowledge.effects
			.map((effect) => ({
				effectId: knowledgeEffectId(effect),
				targetKey: knowledgeTargetKey(effect.target),
				action: effect.action,
			}))
			.sort(compareEffect)
		: [];
	const invariantIds = revision.safety.invariants.map(invariantId).sort(compareText);
	const body = toCanonicalJsonValue({
		changeId,
		revisionId,
		effects,
		invariantIds,
		relationshipChangeIds: sortedUnique(relationshipChangeIds),
		unknownSemantics:
			revision.classification.kind === "unknown" ||
			revision.classification.type === "unknown" ||
			revision.classification.scope === "unknown",
	});
	// SAFETY: canonical conversion preserves fields validated and assembled above.
	return Object.freeze({
		...(body as unknown as Omit<AcceptedChangeIndexEntry, "digest">),
		digest: canonicalJsonDigest(body),
	});
}

function expansionReasons(
	subject: AcceptedChangeIndexEntry,
	accepted: AcceptedChangeIndexEntry,
): readonly AcceptedChangeExpansionReason[] {
	const subjectTargets = new Set(subject.effects.map((effect) => effect.targetKey));
	const subjectInvariants = new Set(subject.invariantIds);
	const relationship =
		subject.relationshipChangeIds.includes(accepted.changeId) ||
		accepted.relationshipChangeIds.includes(subject.changeId);
	const reasons: AcceptedChangeExpansionReason[] = [];
	if (accepted.effects.some((effect) => subjectTargets.has(effect.targetKey))) {
		reasons.push("effect_target_overlap");
	}
	if (accepted.invariantIds.some((id) => subjectInvariants.has(id))) {
		reasons.push("shared_invariant");
	}
	if (relationship) reasons.push("explicit_relationship");
	if (subject.unknownSemantics || accepted.unknownSemantics) reasons.push("unknown_semantics");
	return Object.freeze(reasons);
}

function invertedIndex(
	entries: readonly (readonly [string, string])[],
): Readonly<Record<string, readonly string[]>> {
	const values = new Map<string, string[]>();
	for (const [key, changeId] of entries) {
		const ids = values.get(key) ?? [];
		ids.push(changeId);
		values.set(key, ids);
	}
	return Object.freeze(Object.fromEntries(
		[...values.entries()]
			.sort(([left], [right]) => compareText(left, right))
			.map(([key, ids]) => [key, sortedUnique(ids)]),
	));
}

function invariantId(statement: string): string {
	return `invariant:${canonicalJsonDigest({statement: statement.trim()}).slice(7)}`;
}

function sortedUnique(values: readonly string[]): readonly string[] {
	return Object.freeze([...new Set(values)].sort(compareText));
}

function compareChange(left: AcceptedChangeIndexEntry, right: AcceptedChangeIndexEntry): number {
	return compareText(left.changeId, right.changeId);
}

function compareEffect(left: AcceptedEffectIndexEntry, right: AcceptedEffectIndexEntry): number {
	return compareText(left.targetKey, right.targetKey) || compareText(left.effectId, right.effectId);
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

