import {createKnowledgePostStateArtifact} from "../../src/changes/trace/identity.ts";

export function knowledgeSetTransition({
	subjectId = "cw:component:knowledge",
	facetId,
	expected = "absent",
	content = "Accepted desired state is explicit.",
	mediaType = "text/markdown",
} = {}) {
	const postStateContent =
		mediaType === "text/markdown" && !content.startsWith("---")
			? `---\ncodewiki_id: ${subjectId}\ntype: System Component\ntitle: Knowledge fixture\nstatus: stable\n---\n# Knowledge fixture\n\n${content}\n`
			: content;
	return {
		kind: "effects",
		effects: [
			{
				action: "set",
				target: {subjectId, ...(facetId ? {facetId} : {})},
				expected,
				postState: createKnowledgePostStateArtifact({
					mediaType,
					content: postStateContent,
				}),
			},
		],
	};
}

export function unchangedKnowledgeTransition(
	subjectIds = [],
	rationale = "Realized behavior changes without changing accepted desired Knowledge.",
) {
	return {
		kind: "unchanged",
		refs: [...new Set(subjectIds)].sort().map((subjectId) => ({subjectId})),
		rationale,
	};
}
