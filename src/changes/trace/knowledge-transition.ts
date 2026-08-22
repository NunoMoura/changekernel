import type {
	KnowledgeTargetRef,
	KnowledgeTransition,
} from "./contracts.ts";

export function knowledgeTargetKey(target: KnowledgeTargetRef): string {
	return `${target.subjectId}\u0000${target.facetId ?? ""}`;
}

export function knowledgeTransitionTargets(
	transition: KnowledgeTransition,
): readonly KnowledgeTargetRef[] {
	const targets =
		transition.kind === "effects"
			? transition.effects.map((effect) => effect.target)
			: transition.refs;
	return [...targets].sort((left, right) =>
		knowledgeTargetKey(left).localeCompare(knowledgeTargetKey(right)),
	);
}

export function knowledgeTransitionSubjectIds(
	transition: KnowledgeTransition,
): readonly string[] {
	return [
		...new Set(
			knowledgeTransitionTargets(transition).map((target) => target.subjectId),
		),
	].sort((left, right) => left.localeCompare(right));
}
