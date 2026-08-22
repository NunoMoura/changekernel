import {createNextChangeOperation} from "../../src/changes/trace/index.ts";
import {knowledgeEffectId} from "../../src/knowledge/materialization.ts";
import {createPlanningCandidate} from "../../src/loops/planning/candidate.ts";
import {createNativeDecisionOperationSequence} from "../../src/project-server/effects/gate-operations.ts";
import {createPlanningOperationSequence} from "../../src/project-server/effects/planning-operations.ts";
import {
	createDecisionGate,
	createPlanningGate,
} from "../../src/project-server/lifecycle/gates.ts";
import {baseSnapshotFor, reduceBatch} from "./change-trace-replay-v1.mjs";
import {authorityBinding, digest, gitObject} from "./change-trace-v1.mjs";
import {checkSnapshot} from "./checks.mjs";
import {
	nativeDecisionCandidate,
	nativeDecisionRevision,
	nativeDecisionState,
} from "./native-decision.mjs";

export async function nativePlanningContext(options = {}) {
	const changeId = options.changeId ?? "CHG-native-planning";
	const revision = options.revision ?? nativeDecisionRevision({
		changeId,
		acceptanceRequirements: [
			{id: "REQ-plan", statement: "Accepted Change has exact executable coverage."},
		],
	});
	let state = nativeDecisionState([{changeId, revision}]);
	const decisionAttempt = startAttempt(state, changeId, "decision", "a", "2026-08-10T10:00:00.000Z");
	state = reduceBatch(state, [decisionAttempt], gitObject("a"));
	const decisionCandidate = nativeDecisionCandidate({state, changeId});
	const decisionGate = await createDecisionGate({
		packSnapshot: checkSnapshot([], {stage: "decision"}),
	}).run({candidate: decisionCandidate, changeRef: `change:${changeId}`});
	const decisionSequence = createNativeDecisionOperationSequence({
		state,
		changeId,
		attemptOperationId: decisionAttempt.operationId,
		baseSnapshot: baseSnapshotFor(state),
		authorityBinding: authorityBinding(),
		recordedAt: "2026-08-10T10:01:00.000Z",
		candidate: decisionCandidate,
		packSnapshot: decisionGate.packSnapshot,
		evidenceRecords: [],
		report: decisionGate.report,
		transition: decisionGate.transition,
		confirmation: {
			candidateDigest: decisionCandidate.digest,
			gateReportDigest: decisionGate.report.reportDigest,
			knowledgeCheckpointDigest: decisionCandidate.content.knowledgeCheckpoint.checkpointDigest,
			authorityBinding: authorityBinding(),
		},
	});
	state = reduceBatch(state, decisionSequence.operations, gitObject("b"));
	const planningAttempt = startAttempt(state, changeId, "planning", "c", "2026-08-10T10:02:00.000Z");
	state = reduceBatch(state, [planningAttempt], gitObject("c"));
	const proposal = options.proposal ?? planningProposal(revision, changeId);
	return {
		state,
		changeId,
		revision,
		planningAttempt,
		proposal,
		candidate: createPlanningCandidate({state, changeId, proposal}),
	};
}

export async function acceptedPlanningContext(options = {}) {
	const context = await nativePlanningContext(options);
	const gate = await createPlanningGate({
		packSnapshot: checkSnapshot([], {stage: "planning"}),
	}).run({candidate: context.candidate});
	const sequence = createPlanningOperationSequence({
		state: context.state,
		changeId: context.changeId,
		attemptOperationId: context.planningAttempt.operationId,
		baseSnapshot: baseSnapshotFor(context.state),
		authorityBinding: authorityBinding(),
		acceptanceAuthorityBinding: authorityBinding(),
		recordedAt: "2026-08-10T10:03:00.000Z",
		candidate: context.candidate,
		packSnapshot: gate.packSnapshot,
		evidenceRecords: [],
		report: gate.report,
		transition: gate.transition,
	});
	return {
		...context,
		planningGate: gate,
		planningSequence: sequence,
		state: reduceBatch(context.state, sequence.operations, gitObject("d")),
	};
}

export function planningProposal(revision, changeId, overrides = {}) {
	const {unitId: requestedUnitId, ...proposalOverrides} = overrides;
	const effects = revision.content.knowledge.kind === "effects"
		? revision.content.knowledge.effects.map(knowledgeEffectId)
		: [];
	const unchanged = revision.content.knowledge.kind === "unchanged"
		? revision.content.knowledge.refs
		: [];
	const unitId = requestedUnitId ?? `WU-${changeId}`;
	const workUnit = {
		id: unitId,
		owningChangeId: changeId,
		title: "Implement accepted Change",
		outcome: "Accepted Knowledge and source realization align.",
		technicalRequirements: ["Apply exact accepted intent."],
		knowledgeEffectIds: effects,
		unchangedKnowledgeTargets: unchanged,
		acceptanceRequirementIds: revision.content.acceptanceRequirements.map((entry) => entry.id),
		componentRefs: ["component:planning"],
		pathScopes: ["src/planning"],
		verification: ["Run exact Planning and implementation tests."],
		resourceRequirements: {
			capabilityIds: ["typescript"],
			toolIds: ["pi-lens"],
			skillIds: [],
			custodyRequirements: ["isolated_worktree"],
			consentRequirements: ["source-mutation"],
			privacyClass: "internal",
			budgetClass: "standard",
		},
	};
	return {
		workUnits: [workUnit],
		dependencyEdges: [],
		knowledgeEffectCoverage: effects.map((obligationId) => ({obligationId, workUnitIds: [unitId]})),
		unchangedKnowledgeCoverage: unchanged.map((target) => ({target, workUnitIds: [unitId]})),
		acceptanceCoverage: revision.content.acceptanceRequirements.map((entry) => ({
			obligationId: entry.id,
			workUnitIds: [unitId],
		})),
		aggregateReviewRequirements: [
			{id: "AGR-cross-unit", statement: "Review aggregate Change behavior.", workUnitIds: [unitId]},
		],
		uiPreviewTargets: [],
		integrationRequirements: ["Integrate only after Work Unit evidence passes."],
		amendment: null,
		rationale: "Map every accepted obligation to immutable executable work.",
		...proposalOverrides,
	};
}

function startAttempt(state, changeId, loop, marker, recordedAt) {
	const change = state.changes.find((entry) => entry.changeId === changeId);
	return createNextChangeOperation(change, {
		changeId,
		kind: "loop.attempt_started",
		baseSnapshot: baseSnapshotFor(state),
		authorityBinding: authorityBinding({
			authenticationEvidenceId: `auth:${loop}-${marker}`,
		}),
		recordedAt,
		payload: {
			loop,
			changeRevisionId: change.currentRevision.revisionId,
			loopProtocolDigest: digest(marker),
			routeId: `${loop}-native-v1`,
			privateAttemptDigest: digest(marker === "f" ? "e" : "f"),
		},
	});
}
