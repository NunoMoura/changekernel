import type {
	CanonicalInlineSemanticArtifact,
	KnowledgeEffect,
	KnowledgeTargetRef,
	KnowledgeTransition,
} from "../../changes/trace/contracts.ts";
import type {ProjectContextSnapshot} from "../../runtime/contracts.ts";
import {expandProjectContextHandle} from "./snapshot.ts";
import type {Sha256Digest} from "../../utils/canonical-json.ts";

export interface ProjectContextHandleRef {
	readonly contextHandle: string;
}

export type ProjectContextKnowledgeEffectDraft =
	| {
		readonly action: "set";
		readonly target: KnowledgeTargetRef | ProjectContextHandleRef;
		readonly expected: Sha256Digest | "absent";
		readonly postState: CanonicalInlineSemanticArtifact;
	}
	| {
		readonly action: "retire";
		readonly target: KnowledgeTargetRef | ProjectContextHandleRef;
		readonly expected: Sha256Digest;
	};

export type ProjectContextKnowledgeTransitionDraft =
	| {readonly kind: "effects"; readonly effects: readonly ProjectContextKnowledgeEffectDraft[]}
	| {
		readonly kind: "unchanged";
		readonly refs: readonly (KnowledgeTargetRef | ProjectContextHandleRef)[];
		readonly rationale: string;
	};

export function expandProjectContextKnowledgeTransition(input: {
	readonly snapshot: ProjectContextSnapshot;
	readonly expectedSnapshotDigest: Sha256Digest;
	readonly transition: ProjectContextKnowledgeTransitionDraft;
}): KnowledgeTransition {
	if (input.snapshot.snapshotDigest !== input.expectedSnapshotDigest) {
		throw new Error("Project Context handle expansion requires the exact expected snapshot.");
	}
	if (input.transition.kind === "unchanged") {
		return Object.freeze({
			kind: "unchanged",
			refs: Object.freeze(input.transition.refs.map((ref) => expandTarget(input.snapshot, ref))),
			rationale: input.transition.rationale,
		});
	}
	const effects = input.transition.effects.map((effect): KnowledgeEffect => {
		const target = expandTarget(input.snapshot, effect.target);
		return effect.action === "set"
			? Object.freeze({
				action: "set",
				target,
				expected: effect.expected,
				postState: effect.postState,
			})
			: Object.freeze({
				action: "retire",
				target,
				expected: effect.expected,
			});
	});
	return Object.freeze({kind: "effects", effects: Object.freeze(effects)});
}

function expandTarget(
	snapshot: ProjectContextSnapshot,
	value: KnowledgeTargetRef | ProjectContextHandleRef,
): KnowledgeTargetRef {
	if (!("contextHandle" in value)) return Object.freeze({...value});
	const expanded = expandProjectContextHandle(snapshot, value.contextHandle);
	const separator = expanded.targetKey.indexOf("\u0000");
	const subjectId = separator < 0
		? expanded.targetKey
		: expanded.targetKey.slice(0, separator);
	const facetId = separator < 0
		? ""
		: expanded.targetKey.slice(separator + 1);
	if (!subjectId.startsWith("cw:") || (separator >= 0 && facetId.length === 0)) {
		throw new Error("Project Context handle does not resolve to a canonical Knowledge target.");
	}
	return Object.freeze({subjectId, ...(facetId ? {facetId} : {})});
}
