import {createProjectContextSnapshot} from "../../src/project-server/project-context/snapshot.ts";
import {canonicalJsonDigest} from "../../src/utils/canonical-json.ts";

export const PROJECT_CONTEXT_KNOWLEDGE_REQUEST = Object.freeze({
	service: "knowledge",
	operation: "subject",
	arguments: {subjectId: "cw:component:runtime"},
});

export function createTestProjectContextSnapshot(options = {}) {
	const digest = (value) => canonicalJsonDigest(value);
	const subjectId = options.subjectId ?? "subject-dsh";
	const subjectDigest = options.subjectDigest ?? digest(`subject:${subjectId}`);
	return createProjectContextSnapshot({
		stage: options.stage ?? "decision",
		subject: {id: subjectId, digest: subjectDigest},
		changeRevisionDigest: digest(`revision:${subjectId}`),
		sources: {
			workState: digest("context:work-state"),
			knowledgeState: digest("context:knowledge-state"),
			knowledgeProjection: digest("context:knowledge-projection"),
			alignment: digest("context:alignment"),
			repositoryTree: digest("context:repository-tree"),
			acceptedChanges: digest("context:accepted-changes"),
			workGraph: digest("context:work-graph"),
			evidence: digest("context:evidence"),
			results: digest("context:results"),
		},
		producerSkillSetDigest: null,
		gateFeedbackDigest: null,
		queryEngine: {
			id: "codewiki.project-context",
			version: "1.0.0",
			digest: digest("context:query-engine"),
		},
		routes: [{
			request: PROJECT_CONTEXT_KNOWLEDGE_REQUEST,
			items: [{id: "runtime", summary: options.summary ?? "Bounded execution mechanics."}],
			sourceReferences: [{kind: "knowledge", ref: "cw:component:runtime", digest: digest("context:runtime-cell")}],
			coverage: "complete",
			unknowns: [],
		}],
		handles: [{
			targetKey: "cw:component:runtime",
			request: PROJECT_CONTEXT_KNOWLEDGE_REQUEST,
			itemIndex: 0,
		}],
		observation: {
			capturedAt: options.capturedAt ?? "2026-08-18T13:00:00.000Z",
			stale: false,
			coverage: "complete",
			unknowns: [],
		},
	});
}
