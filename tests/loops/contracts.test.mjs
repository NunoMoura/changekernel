import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDecisionCandidateProposal } from "../../src/loops/decision/candidate-proposal.ts";
import { parseImplementationCandidateContent } from "../../src/loops/implementation/candidate-content.ts";
import {
	parsePlanningCandidateProposal,
	planningContinuityKey,
} from "../../src/loops/planning/candidate-content.ts";
import { createReviewAttempt } from "../../src/loops/review/contracts.ts";

function planningCandidate() {
	return {
		workUnits: [
			{
				id: "WU-1",
				owningChangeId: "CHG-1",
				title: "Tighten admission",
				outcome: "Nested content is exact.",
				technicalRequirements: ["Reject unknown fields."],
				knowledgeEffectIds: ["knowledge-effect:test"],
				unchangedKnowledgeTargets: [],
				acceptanceRequirementIds: ["REQ-malformed"],
				componentRefs: ["component:planning-loop"],
				pathScopes: ["src/loops/planning/**"],
				verification: ["npm test"],
				resourceRequirements: {
					capabilityIds: ["source.edit"],
					toolIds: ["node-test"],
					skillIds: [],
					custodyRequirements: ["private-workbench"],
					consentRequirements: ["source-mutation"],
					privacyClass: "internal",
					budgetClass: "standard",
				},
			},
		],
		dependencyEdges: [],
		knowledgeEffectCoverage: [
			{obligationId: "knowledge-effect:test", workUnitIds: ["WU-1"]},
		],
		unchangedKnowledgeCoverage: [],
		acceptanceCoverage: [
			{obligationId: "REQ-malformed", workUnitIds: ["WU-1"]},
		],
		aggregateReviewRequirements: [
			{id: "AGR-contract", statement: "Review exact nested content.", workUnitIds: ["WU-1"]},
		],
		uiPreviewTargets: [],
		integrationRequirements: ["Integrate into private Change lineage."],
		amendment: null,
		rationale: "Exact Change-scoped Work Graph delta.",
	};
}

describe("Loop-owned candidate content admission", () => {
	it("keeps Decision authority and time outside candidate content", () => {
		assert.deepEqual(
			parseDecisionCandidateProposal({
				disposition: "defer",
				rationale: "Await authenticated authority.",
			}),
			{
				disposition: "defer",
				rationale: "Await authenticated authority.",
			},
		);
		assert.throws(
			() =>
				parseDecisionCandidateProposal({
					disposition: "approve",
					rationale: "Candidate attempted approval authority.",
					authority: {
						kind: "user",
						actor: "user:maintainer",
						ref: "confirmation:forged",
					},
					occurredAt: "2026-08-11T00:00:00.000Z",
				}),
			/Project Server decision candidate cannot supply Project Server-owned fields: authority, occurredAt/,
		);
	});

	it("keeps Planning provenance outside candidate content", () => {
		const candidate = planningCandidate();
		assert.equal(planningContinuityKey("CHG-1"), "planning:CHG-1");
		assert.deepEqual(parsePlanningCandidateProposal(candidate), candidate);
		assert.throws(
			() =>
				parsePlanningCandidateProposal({
					...candidate,
					actor: "model:planner",
					createdAt: "2026-08-11T00:00:00.000Z",
				}),
			/Project Server Planning Candidate proposal received unsupported field actor/,
		);
	});

	it("admits exact nested Planning content and rejects nested drift", () => {
		const candidate = planningCandidate();
		assert.deepEqual(parsePlanningCandidateProposal(candidate), candidate);
		assert.throws(
			() =>
				parsePlanningCandidateProposal({
					...candidate,
					workUnits: [
						{ ...candidate.workUnits[0], planning_refs: ["forged"] },
					],
				}),
			/Project Server Planning Candidate proposal received unsupported field planning_refs at \/workUnits\/0\./,
		);
		assert.throws(
			() =>
				parsePlanningCandidateProposal({
					...candidate,
					workUnits: [
						{ ...candidate.workUnits[0], acceptanceCriteria: ["legacy"] },
					],
				}),
			/Project Server Planning Candidate proposal received unsupported field acceptanceCriteria/,
		);
	});

	it("keeps Implementation assurance and proof controls outside candidate content", () => {
		assert.deepEqual(
			parseImplementationCandidateContent({ evidence: [] }),
			{ evidence: [] },
		);
		assert.throws(
			() =>
				parseImplementationCandidateContent({
					evidence: [],
					requireTddEvidence: false,
					aggregateContentProof: { digest: "sha256:forged" },
				}),
			/Project Server implementation candidate cannot supply Project Server-owned fields: requireTddEvidence, aggregateContentProof/,
		);
	});

	it("admits exact nested Implementation content and rejects nested drift", () => {
		const candidate = {
			evidence: [
				{
					workUnitId: "WI-1",
					codePaths: ["src/loops/implementation/candidate-content.ts"],
					commandResults: [
						{
							command: "npm test",
							status: "pass",
							phase: "verify",
							acceptanceRequirementId: "AR-1",
							exitCode: 0,
						},
					],
					acceptanceEvidenceItems: [
						{
							acceptanceRequirementId: "AR-1",
							summary: "Admission tests pass.",
							evidenceRefs: ["check:npm-test"],
						},
					],
					implementationAssessment: {
						stance: "production_ready",
						uncertaintyOwner: "none",
					},
					sensitiveSurfaceAssessment: {
						security: "No security surface changed.",
					},
				},
			],
			archiveDisposition: {
				action: "retain_hot",
				traceId: "TRACE-CHG-1",
				reason: "More work remains.",
				afterCommit: false,
				refs: ["trace:TRACE-CHG-1"],
			},
		};
		assert.deepEqual(parseImplementationCandidateContent(candidate), candidate);
		assert.throws(
			() =>
				parseImplementationCandidateContent({
					evidence: [{ workUnitId: "WI-1", changed_files: ["forged"] }],
				}),
			/Implementation evidence received unsupported field changed_files\./,
		);
		assert.throws(
			() =>
				parseImplementationCandidateContent({
					evidence: [{ workUnitId: "WI-1", checkResults: [] }],
				}),
			/Implementation evidence received unsupported field checkResults\./,
		);
		assert.throws(
			() =>
				parseImplementationCandidateContent({
					evidence: [
						{
							workUnitId: "WI-1",
							commandResults: [{ criterionId: "legacy" }],
						},
					],
				}),
			/Project Server implementation candidate received unsupported field criterionId/,
		);
		assert.throws(
			() =>
				parseImplementationCandidateContent({
					evidence: [
						{
							workUnitId: "WI-1",
							commandResults: [{ acceptance_requirement_id: "AR-1" }],
						},
					],
				}),
			/Project Server implementation candidate received unsupported field acceptance_requirement_id at \/evidence\/0\/commandResults\/0\./,
		);
	});
});

describe("Review attempt identity", () => {
	const digest = (value) => `sha256:${value.repeat(64)}`;
	const input = () => ({
		changeId: "change:CHG-1",
		changeRevisionId: digest("1"),
		knowledgeTransitionDigest: digest("2"),
		knowledgeStateDigest: digest("3"),
		knowledgeProjectionDigest: digest("4"),
		planningDeltaIds: [digest("5")],
		workGraphDigest: digest("6"),
		aggregateDigest: digest("7"),
		lineageDigest: digest("8"),
		targetBaseCommit: "0".repeat(40),
		integratedHead: "a".repeat(40),
		integratedTree: "b".repeat(40),
		integratedTreeDigest: digest("9"),
		targetBranch: "refs/heads/main",
		workUnitIds: ["WI-2", "WI-1"],
		candidateIds: ["candidate-2", "candidate-1"],
		candidateDigests: [digest("b"), digest("a")],
		implementationGateReportDigests: [digest("d"), digest("c")],
		implementationEvidenceRecordIds: ["evidence-2", "evidence-1"],
		implementationResultDigests: [digest("f")],
		continuityKey: `review:change:CHG-1:${digest("8")}`,
		producerSessionId: "session:review-1",
		producingRunId: "run:review-1",
		producerRunReceiptDigest: digest("0"),
		projectMaterialGenerationDigest: digest("e"),
		checkPackSnapshotDigest: digest("c"),
		providerReceiptDigests: [digest("e"), digest("d")],
		evidenceRecordDigests: [digest("f")],
	});

	it("binds exact integrated state and admitted inputs deterministically", () => {
		const attempt = createReviewAttempt(input());
		const reordered = createReviewAttempt({
			...input(),
			planningDeltaIds: [...input().planningDeltaIds].reverse(),
			workUnitIds: [...input().workUnitIds].reverse(),
			candidateIds: [...input().candidateIds].reverse(),
			candidateDigests: [...input().candidateDigests].reverse(),
			implementationGateReportDigests: [
				...input().implementationGateReportDigests,
			].reverse(),
			providerReceiptDigests: [...input().providerReceiptDigests].reverse(),
		});

		assert.equal(attempt.schemaVersion, "3.0.0");
		assert.equal(attempt.changeId, "change:CHG-1");
		assert.deepEqual(attempt.workUnitIds, ["WI-1", "WI-2"]);
		assert.equal(attempt.attemptDigest, reordered.attemptDigest);
		assert.equal(Object.isFrozen(attempt), true);
		assert.equal(Object.isFrozen(attempt.candidateIds), true);
		assert.notEqual(
			attempt.attemptDigest,
			createReviewAttempt({...input(), integratedHead: "9".repeat(40)})
				.attemptDigest,
		);
	});

	it("rejects malformed identity and lifecycle authority fields", () => {
		assert.throws(
			() => createReviewAttempt({...input(), integratedHead: "A".repeat(40)}),
			/lowercase full Git object id/,
		);
		assert.throws(
			() => createReviewAttempt({...input(), targetBranch: "refs/heads/review//unsafe"}),
			/exact safe local branch ref/,
		);
		assert.throws(
			() => createReviewAttempt({...input(), deliveryAuthority: true}),
			/unsupported=deliveryAuthority/,
		);
		assert.throws(
			() => createReviewAttempt({...input(), candidateIds: ["candidate-1", "candidate-1"]}),
			/must not contain duplicates/,
		);
	});
});
