import {Type, type Static} from "typebox";
import type {KnowledgeTargetRef} from "../../changes/trace/contracts.ts";
import {assertCandidateSchema, candidateContentRecord} from "../candidate-admission.ts";

const requiredTextSchema = Type.String({minLength: 1, pattern: "\\S"});
const digestSchema = Type.String({pattern: "^sha256:[a-f0-9]{64}$"});
const stringArraySchema = Type.Array(requiredTextSchema, {uniqueItems: true});
const nonEmptyStringArraySchema = Type.Array(requiredTextSchema, {
	minItems: 1,
	uniqueItems: true,
});
const knowledgeTargetSchema = Type.Object(
	{
		subjectId: Type.String({pattern: "^cw:[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._-]*$"}),
		facetId: Type.Optional(Type.String({pattern: "^[a-z0-9][a-z0-9._-]*$"})),
	},
	{additionalProperties: false},
);

export const planningResourceRequirementsSchema = Type.Object(
	{
		capabilityIds: nonEmptyStringArraySchema,
		toolIds: nonEmptyStringArraySchema,
		skillIds: stringArraySchema,
		custodyRequirements: nonEmptyStringArraySchema,
		consentRequirements: stringArraySchema,
		privacyClass: requiredTextSchema,
		budgetClass: requiredTextSchema,
	},
	{additionalProperties: false},
);

export const planningWorkUnitCandidateSchema = Type.Object(
	{
		id: requiredTextSchema,
		owningChangeId: requiredTextSchema,
		title: requiredTextSchema,
		outcome: requiredTextSchema,
		technicalRequirements: nonEmptyStringArraySchema,
		knowledgeEffectIds: stringArraySchema,
		unchangedKnowledgeTargets: Type.Array(knowledgeTargetSchema, {uniqueItems: true}),
		acceptanceRequirementIds: nonEmptyStringArraySchema,
		componentRefs: nonEmptyStringArraySchema,
		pathScopes: nonEmptyStringArraySchema,
		verification: nonEmptyStringArraySchema,
		resourceRequirements: planningResourceRequirementsSchema,
	},
	{additionalProperties: false},
);

export const planningDependencyEdgeSchema = Type.Object(
	{
		fromWorkUnitId: requiredTextSchema,
		toWorkUnitId: requiredTextSchema,
		kind: Type.Union([Type.Literal("requires"), Type.Literal("blocks")]),
	},
	{additionalProperties: false},
);

export const planningObligationCoverageSchema = Type.Object(
	{
		obligationId: requiredTextSchema,
		workUnitIds: Type.Array(requiredTextSchema, {minItems: 1, uniqueItems: true}),
	},
	{additionalProperties: false},
);

export const planningUnchangedKnowledgeCoverageSchema = Type.Object(
	{
		target: knowledgeTargetSchema,
		workUnitIds: Type.Array(requiredTextSchema, {minItems: 1, uniqueItems: true}),
	},
	{additionalProperties: false},
);

export const planningAggregateReviewRequirementSchema = Type.Object(
	{
		id: requiredTextSchema,
		statement: requiredTextSchema,
		workUnitIds: Type.Array(requiredTextSchema, {minItems: 1, uniqueItems: true}),
	},
	{additionalProperties: false},
);

export const planningUiPreviewTargetSchema = Type.Object(
	{
		targetId: requiredTextSchema,
		targetDigest: digestSchema,
		profileId: requiredTextSchema,
		profileDigest: digestSchema,
		workUnitIds: Type.Array(requiredTextSchema, {minItems: 1, uniqueItems: true}),
		changeIds: Type.Array(requiredTextSchema, {minItems: 1, uniqueItems: true}),
		required: Type.Boolean(),
		activation: Type.Literal("implementation"),
		autoOpen: Type.Union([Type.Literal("once_per_target"), Type.Literal("manual")]),
	},
	{additionalProperties: false},
);

export const planningAmendmentSchema = Type.Union([
	Type.Null(),
	Type.Object(
		{
			supersedesDeltaId: digestSchema,
			retireWorkUnitIds: Type.Array(requiredTextSchema, {uniqueItems: true}),
			rationale: requiredTextSchema,
		},
		{additionalProperties: false},
	),
]);

export const planningCandidateProposalSchema = Type.Object(
	{
		workUnits: Type.Array(planningWorkUnitCandidateSchema, {minItems: 1, maxItems: 256}),
		dependencyEdges: Type.Array(planningDependencyEdgeSchema, {maxItems: 4096}),
		knowledgeEffectCoverage: Type.Array(planningObligationCoverageSchema, {maxItems: 1024}),
		unchangedKnowledgeCoverage: Type.Array(planningUnchangedKnowledgeCoverageSchema, {maxItems: 1024}),
		acceptanceCoverage: Type.Array(planningObligationCoverageSchema, {minItems: 1, maxItems: 1024}),
		aggregateReviewRequirements: Type.Array(planningAggregateReviewRequirementSchema, {minItems: 1, maxItems: 1024}),
		uiPreviewTargets: Type.Array(planningUiPreviewTargetSchema, {maxItems: 256}),
		integrationRequirements: nonEmptyStringArraySchema,
		amendment: planningAmendmentSchema,
		rationale: requiredTextSchema,
	},
	{additionalProperties: false},
);

export type PlanningResourceRequirements = Static<typeof planningResourceRequirementsSchema>;
export type PlanningWorkUnitCandidate = Static<typeof planningWorkUnitCandidateSchema> & {
	readonly unchangedKnowledgeTargets: readonly KnowledgeTargetRef[];
};
export type PlanningDependencyEdge = Static<typeof planningDependencyEdgeSchema>;
export type PlanningObligationCoverage = Static<typeof planningObligationCoverageSchema>;
export type PlanningUnchangedKnowledgeCoverage = Static<typeof planningUnchangedKnowledgeCoverageSchema> & {
	readonly target: KnowledgeTargetRef;
};
export type PlanningAggregateReviewRequirement = Static<typeof planningAggregateReviewRequirementSchema>;
export type PlanningUiPreviewTarget = Static<typeof planningUiPreviewTargetSchema>;
export type PlanningAmendment = Static<typeof planningAmendmentSchema>;
export type PlanningCandidateProposal = Static<typeof planningCandidateProposalSchema>;

export function comparePlanningEdges(
	left: PlanningDependencyEdge,
	right: PlanningDependencyEdge,
): number {
	return comparePlanningText(
		`${left.fromWorkUnitId}:${left.toWorkUnitId}:${left.kind}`,
		`${right.fromWorkUnitId}:${right.toWorkUnitId}:${right.kind}`,
	);
}

export function planningPathsOverlap(
	left: readonly string[],
	right: readonly string[],
): boolean {
	return left.some((leftPath) =>
		right.some(
			(rightPath) =>
				leftPath === rightPath ||
				leftPath.startsWith(`${rightPath}/`) ||
				rightPath.startsWith(`${leftPath}/`),
		),
	);
}

export function comparePlanningText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

export function planningContinuityKey(changeId: string): `planning:${string}` {
	if (!changeId.trim()) throw new Error("Planning continuity requires Change identity.");
	return `planning:${changeId}`;
}

export function parsePlanningCandidateProposal(value: unknown): PlanningCandidateProposal {
	const candidate = candidateContentRecord(value, "planning");
	assertCandidateSchema(
		planningCandidateProposalSchema,
		candidate,
		"Project Server Planning Candidate proposal",
	);
	return candidate as PlanningCandidateProposal;
}
