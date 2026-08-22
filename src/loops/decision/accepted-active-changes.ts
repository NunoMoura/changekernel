import type {ChangeRevision} from "../../changes/trace/contracts.ts";
import {operationPayload} from "../../changes/trace/identity.ts";
import type {
	ChangeWorkState,
	ProjectWorkState,
	RelationshipProjection,
} from "../../changes/trace/state.ts";
import {
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {
	assertAcceptedEffectInvariantIndex,
	createAcceptedChangeCompatibilityContext,
	createAcceptedEffectInvariantIndex,
	type AcceptedChangeCompatibilityCoverage,
	type AcceptedEffectInvariantIndex,
} from "./accepted-effect-index.ts";
import type {
	DecisionActiveChangeBinding,
	DecisionRelationshipBinding,
	DecisionSemanticRevision,
} from "./accepted-active-types.ts";
export type {
	DecisionActiveChangeBinding,
	DecisionRelationshipBinding,
	DecisionSemanticRevision,
} from "./accepted-active-types.ts";

export const ACCEPTED_ACTIVE_CHANGES_SCHEMA_VERSION = "2.0.0" as const;
export const ACTIVE_CHANGE_COMPATIBILITY_CHECK_ID =
	"active_change_compatibility" as const;

export interface DecisionAcceptedActiveChangesBinding {
	readonly schemaVersion: typeof ACCEPTED_ACTIVE_CHANGES_SCHEMA_VERSION;
	readonly requiredCheckId: typeof ACTIVE_CHANGE_COMPATIBILITY_CHECK_ID;
	readonly digest: Sha256Digest;
	readonly workGraphDigest: Sha256Digest;
	readonly expectedChangeIds: readonly string[];
	readonly comparedChangeIds: readonly string[];
	readonly coverage: "complete";
	readonly effectIndex: AcceptedEffectInvariantIndex;
	readonly changeCoverage: readonly AcceptedChangeCompatibilityCoverage[];
	readonly changes: readonly DecisionActiveChangeBinding[];
}

export function bindDecisionAcceptedActiveChanges(input: {
	readonly state: ProjectWorkState;
	readonly subjectChangeId: string;
}): DecisionAcceptedActiveChangesBinding {
	const allChanges = acceptedActiveChangeBindings(input);
	const subject = input.state.changes.find(
		(change) => change.changeId === input.subjectChangeId,
	);
	if (!subject?.currentRevision) {
		throw new Error("Accepted Change compatibility requires current subject revision.");
	}
	const subjectRelationshipChangeIds = subject.relationships
		.filter(
			(relationship) =>
				!relationship.supersededByOperationId &&
				relationship.sourceRevisionId === subject.currentRevision?.revisionId,
		)
		.map((relationship) => relationship.targetChangeId);
	const effectIndex = createAcceptedEffectInvariantIndex({acceptedChanges: allChanges});
	const compatibility = createAcceptedChangeCompatibilityContext({
		acceptedChanges: allChanges,
		subjectChangeId: input.subjectChangeId,
		subjectRevisionId: subject.currentRevision.revisionId,
		subjectRevision: subject.currentRevision.content,
		subjectRelationshipChangeIds,
	});
	const expectedChangeIds = allChanges.map((change) => change.changeId);
	const workGraphDigest = acceptedWorkGraphDigest(input.state);
	const content = toCanonicalJsonValue({
		schemaVersion: ACCEPTED_ACTIVE_CHANGES_SCHEMA_VERSION,
		requiredCheckId: ACTIVE_CHANGE_COMPATIBILITY_CHECK_ID,
		workGraphDigest,
		expectedChangeIds,
		comparedChangeIds: compatibility.expectedChangeIds,
		coverage: "complete",
		effectIndex,
		changeCoverage: compatibility.coverage,
		changes: compatibility.expandedRevisions,
	});
	// SAFETY: canonical conversion preserves fields assembled from validated state.
	return Object.freeze({
		...(content as unknown as Omit<DecisionAcceptedActiveChangesBinding, "digest">),
		digest: canonicalJsonDigest(content),
	});
}

export function acceptedActiveChangeBindings(input: {
	readonly state: ProjectWorkState;
	readonly subjectChangeId: string;
}): readonly DecisionActiveChangeBinding[] {
	return Object.freeze(input.state.changes
		.flatMap((change) => {
			if (change.changeId === input.subjectChangeId) return [];
			const revision = acceptedNonterminalRevision(change);
			if (!revision) return [];
			return [{
				changeId: change.changeId,
				revision: semanticRevision(change, revision),
				relationships: activeRelationshipBindings(change, revision.revisionId),
			}];
		})
		.sort((left, right) => compareText(left.changeId, right.changeId)));
}

export function assertDecisionAcceptedActiveChangesBinding(
	value: unknown,
): asserts value is DecisionAcceptedActiveChangesBinding {
	if (!value || typeof value !== "object") {
		throw new Error("Decision accepted active Changes binding must be an object.");
	}
	const binding = value as DecisionAcceptedActiveChangesBinding;
	if (
		binding.schemaVersion !== ACCEPTED_ACTIVE_CHANGES_SCHEMA_VERSION ||
		binding.requiredCheckId !== ACTIVE_CHANGE_COMPATIBILITY_CHECK_ID ||
		binding.coverage !== "complete" ||
		!Array.isArray(binding.changes) ||
		!Array.isArray(binding.changeCoverage) ||
		!Array.isArray(binding.expectedChangeIds) ||
		!Array.isArray(binding.comparedChangeIds)
	) {
		throw new Error("Decision accepted active Changes coverage is incomplete.");
	}
	assertAcceptedEffectInvariantIndex(binding.effectIndex);
	const changeIds = binding.changes.map((change) => change.changeId);
	const coverageIds = binding.changeCoverage.map((entry) => entry.changeId);
	const expandedIds = binding.changeCoverage
		.filter((entry) => entry.disposition === "expanded")
		.map((entry) => entry.changeId);
	if (
		JSON.stringify(coverageIds) !== JSON.stringify(binding.expectedChangeIds) ||
		JSON.stringify(binding.expectedChangeIds) !== JSON.stringify(binding.comparedChangeIds) ||
		JSON.stringify(changeIds) !== JSON.stringify(expandedIds) ||
		binding.effectIndex.changes.length !== binding.expectedChangeIds.length ||
		new Set(coverageIds).size !== coverageIds.length ||
		coverageIds.some((changeId, index) => index > 0 && coverageIds[index - 1] >= changeId)
	) {
		throw new Error("Decision accepted active Changes comparison coverage is incomplete.");
	}
	const content = toCanonicalJsonValue({
		schemaVersion: binding.schemaVersion,
		requiredCheckId: binding.requiredCheckId,
		workGraphDigest: binding.workGraphDigest,
		expectedChangeIds: binding.expectedChangeIds,
		comparedChangeIds: binding.comparedChangeIds,
		coverage: binding.coverage,
		effectIndex: binding.effectIndex,
		changeCoverage: binding.changeCoverage,
		changes: binding.changes,
	});
	if (canonicalJsonDigest(content) !== binding.digest) {
		throw new Error("Decision accepted active Changes digest is invalid.");
	}
}

function acceptedNonterminalRevision(
	change: ChangeWorkState,
): ChangeRevision | null {
	if (change.withdrawn || change.trace.status !== "open") return null;
	for (const attempt of [...change.loopAttempts].reverse()) {
		if (attempt.loop !== "decision" || !attempt.routeOperationId) continue;
		const routeOperation = change.operations.find(
			(operation) => operation.operationId === attempt.routeOperationId,
		);
		if (
			routeOperation?.body.kind !== "runtime.route_recorded" ||
			operationPayload(routeOperation, "runtime.route_recorded").route !== "planning"
		) {
			continue;
		}
		return revisionById(change, attempt.changeRevisionId) ?? null;
	}
	return null;
}

function acceptedWorkGraphDigest(state: ProjectWorkState): Sha256Digest {
	const workGraphDeltaIds = state.changes
		.flatMap((change) =>
			change.loopAttempts.flatMap((attempt) => {
				if (
					attempt.loop !== "planning" ||
					!attempt.currentCandidateId ||
					!attempt.routeOperationId
				) {
					return [];
				}
				const routeOperation = change.operations.find(
					(operation) => operation.operationId === attempt.routeOperationId,
				);
				return routeOperation?.body.kind === "runtime.route_recorded" &&
					operationPayload(routeOperation, "runtime.route_recorded").route ===
						"implementation"
					? [attempt.currentCandidateId]
					: [];
			}),
		)
		.sort(compareText);
	return canonicalJsonDigest({
		schemaVersion: ACCEPTED_ACTIVE_CHANGES_SCHEMA_VERSION,
		workGraphDeltaIds,
	});
}

function semanticRevision(
	change: ChangeWorkState,
	revision: ChangeRevision,
): DecisionSemanticRevision {
	const ordinal = change.revisionIds.indexOf(revision.revisionId) + 1;
	if (ordinal < 1) {
		throw new Error(
			`Accepted Change ${change.changeId} revision is absent from revision history.`,
		);
	}
	return {ordinal, revisionId: revision.revisionId, ...revision.content};
}

function revisionById(
	change: ChangeWorkState,
	revisionId: Sha256Digest,
): ChangeRevision | undefined {
	const currentRevision = change.currentRevision;
	if (currentRevision?.revisionId === revisionId) return currentRevision;
	for (const operation of change.operations) {
		if (
			operation.body.kind !== "change.proposed" &&
			operation.body.kind !== "change.revised"
		) {
			continue;
		}
		const payload = operationPayload(operation, operation.body.kind);
		if (payload.revision.revisionId === revisionId) return payload.revision;
	}
	return undefined;
}

function activeRelationshipBindings(
	change: ChangeWorkState,
	revisionId: Sha256Digest,
): DecisionRelationshipBinding[] {
	return change.relationships
		.filter(
			(relationship) =>
				!relationship.supersededByOperationId &&
				relationship.sourceRevisionId === revisionId,
		)
		.map(relationshipBinding)
		.sort(compareRelationships);
}

function relationshipBinding(
	relationship: RelationshipProjection,
): DecisionRelationshipBinding {
	return {
		operationId: relationship.operationId,
		relationshipId: relationship.relationshipId,
		type: relationship.type,
		sourceRevisionId: relationship.sourceRevisionId,
		targetChangeId: relationship.targetChangeId,
		targetRevisionId: relationship.targetRevisionId,
	};
}

function compareRelationships(
	left: DecisionRelationshipBinding,
	right: DecisionRelationshipBinding,
): number {
	return (
		compareText(left.targetChangeId, right.targetChangeId) ||
		compareText(left.relationshipId, right.relationshipId)
	);
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}
