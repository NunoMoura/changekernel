import type {
	AuthorityBinding,
	BaseSnapshot,
	CanonicalChangeOperation,
} from "../../changes/trace/contracts.ts";
import {createNextChangeOperation} from "../../changes/trace/builder.ts";
import {
	applyPrivateIntegrationReceipt,
	createPrivateIntegrationReceipt,
	materializeFrozenImplementationAggregate,
	privateChangeIntegrationRef,
	type ExpectedIntegrationLineage,
	type FrozenImplementationAggregate,
	type PrivateChangeIntegrationLineage,
	type PrivateIntegrationReceipt,
	type PrivateIntegrationStatus,
} from "../../changes/trace/integration.ts";
import {operationPayload} from "../../changes/trace/identity.ts";
import {reduceChangeOperation} from "../../changes/trace/reduce-operation.ts";
import {reviewReworkAllowsWorkUnit} from "../../changes/trace/review.ts";
import {
	changeById,
	type ChangeWorkState,
	type ProjectWorkState,
} from "../../changes/trace/state.ts";
import type {GateReport} from "../../checks/contracts.ts";
import {knowledgeEffectId} from "../../knowledge/materialization.ts";
import {knowledgeTargetKey} from "../../knowledge/state.ts";
import {
	assertCurrentWorkUnitCandidate,
	type WorkUnitCandidate,
} from "../../loops/implementation/work-unit-candidate.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {
	idFromDigest,
	inlineSemanticArtifact,
} from "../effects/gate-operations.ts";

export interface PrivateIntegrationObservation {
	readonly expectedLineageDigest: ExpectedIntegrationLineage;
	readonly workGraphDigest: Sha256Digest;
	readonly candidateTreeDigest: Sha256Digest;
	readonly changedPaths: readonly string[];
	readonly workbenchDigest: Sha256Digest;
	readonly custodyReceiptDigests: readonly Sha256Digest[];
	readonly baseCommit: string;
	readonly status: PrivateIntegrationStatus;
	readonly resultCommit: string | null;
	readonly resultTreeDigest: Sha256Digest | null;
	readonly conflictRefs?: readonly string[];
	readonly recordedAt: string;
}

export interface CreatePrivateIntegrationAdmissionInput {
	readonly state: ProjectWorkState;
	readonly candidate: WorkUnitCandidate;
	readonly gateReport: GateReport;
	readonly observation: PrivateIntegrationObservation;
	readonly baseSnapshot: BaseSnapshot;
	readonly authorityBinding: AuthorityBinding;
}

export interface PrivateIntegrationAdmission {
	readonly operation: CanonicalChangeOperation<"integration.candidate_admitted">;
	readonly receipt: PrivateIntegrationReceipt;
	readonly lineage: PrivateChangeIntegrationLineage;
	readonly state: ChangeWorkState;
}

export interface CreateImplementationAggregateInput {
	readonly state: ProjectWorkState;
	readonly changeId: string;
	readonly expectedLineageDigest: Sha256Digest;
	readonly frozenAt: string;
	readonly baseSnapshot: BaseSnapshot;
	readonly authorityBinding: AuthorityBinding;
}

export interface ImplementationAggregateFreeze {
	readonly operation: CanonicalChangeOperation<"implementation.aggregate_frozen">;
	readonly aggregate: FrozenImplementationAggregate;
	readonly state: ChangeWorkState;
}

export function createPrivateIntegrationAdmission(
	input: CreatePrivateIntegrationAdmissionInput,
): PrivateIntegrationAdmission {
	const change = requireCurrentCandidateAndGate(input);
	const graphUnit = requiredGraphUnit(input.state, input.candidate.content.workUnitId);
	const lineage = change.privateIntegrationLineage;
	assertAdmissionObservation(input, change, lineage);
	assertDependenciesIntegrated(input.state, change, graphUnit.workUnit.id);
	const dependencyWorkUnitIds = input.state.workGraph.dependencyEdges
		.filter((edge) => edge.fromWorkUnitId === graphUnit.workUnit.id)
		.map((edge) => edge.toWorkUnitId)
		.sort(compareText);
	const receipt = createPrivateIntegrationReceipt({
		changeId: change.changeId,
		changeRevisionId: input.candidate.content.changeRevisionId,
		workGraphDigest: input.state.workGraph.graphDigest,
		workGraphDeltaId: graphUnit.deltaId,
		workUnitId: graphUnit.workUnit.id,
		workUnitDigest: input.candidate.content.workUnitDigest,
		dependencyWorkUnitIds,
		candidateId: input.candidate.id,
		candidateDigest: input.candidate.digest,
		gateReportDigest: input.gateReport.reportDigest,
		assignmentAttemptId: input.candidate.content.assignmentAttemptId,
		assignmentDigest: input.candidate.content.assignmentDigest,
		workbenchId: input.candidate.content.workbenchId,
		workbenchDigest: input.candidate.content.workbenchDigest,
		custodyReceiptDigests: input.observation.custodyReceiptDigests,
		candidateTreeDigest: input.candidate.content.resultTreeDigest,
		changedPaths: input.candidate.content.changedPaths,
		acceptanceSlice: input.candidate.content.acceptanceSlice,
		expectedLineageDigest: input.observation.expectedLineageDigest,
		baseCommit: input.observation.baseCommit,
		status: input.observation.status,
		resultCommit: input.observation.resultCommit,
		resultTreeDigest: input.observation.resultTreeDigest,
		conflictRefs: input.observation.conflictRefs,
		recordedAt: input.observation.recordedAt,
	});
	const nextLineage = applyPrivateIntegrationReceipt(lineage, receipt, {
		allowWorkUnitReplacement: reviewReworkAllowsWorkUnit(
			change,
			input.candidate.content.workUnitId,
		),
	});
	const operation = createNextChangeOperation(change, {
		changeId: change.changeId,
		kind: "integration.candidate_admitted",
		baseSnapshot: input.baseSnapshot,
		authorityBinding: input.authorityBinding,
		recordedAt: input.observation.recordedAt,
		payload: {
			receipt: inlineSemanticArtifact(
				receipt.receiptId,
				receipt.schemaVersion,
				receipt,
			),
			expectedLineageDigest: receipt.expectedLineageDigest,
			resultLineageDigest: nextLineage.lineageDigest,
		},
	});
	const projected = reduceChangeOperation(change, operation, {});
	return Object.freeze({operation, receipt, lineage: nextLineage, state: projected});
}

export function createImplementationAggregateFreeze(
	input: CreateImplementationAggregateInput,
): ImplementationAggregateFreeze {
	const change = changeById(input.state, input.changeId);
	if (!change?.currentRevision || change.withdrawn) {
		throw new Error("Implementation aggregate requires current non-withdrawn Change.");
	}
	if (change.implementationAggregate) {
		throw new Error("Implementation aggregate is already frozen.");
	}
	const lineage = change.privateIntegrationLineage;
	if (!lineage || lineage.lineageDigest !== input.expectedLineageDigest) {
		throw new Error("Implementation aggregate private lineage head is stale.");
	}
	if (!lineage.headTreeDigest) {
		throw new Error("Implementation aggregate requires integrated result tree.");
	}
	const requiredUnits = requiredChangeUnits(input.state, change.changeId);
	assertCompletion(input.state, change, lineage, requiredUnits);
	const integrated = requiredUnits.map((unit) => {
		const entry = lineage.integratedWorkUnits.find(
			(candidate) => candidate.workUnitId === unit.workUnit.id,
		);
		if (!entry) throw new Error(`Required Work Unit ${unit.workUnit.id} is not integrated.`);
		return entry;
	});
	const knowledgeEffectIds = sortedUnique(
		integrated.flatMap((entry) => [...entry.acceptanceSlice.knowledgeEffectIds]),
	);
	const unchangedKnowledgeTargets = integrated
		.flatMap((entry) => [...entry.acceptanceSlice.unchangedKnowledgeTargets])
		.sort((left, right) => compareText(knowledgeTargetKey(left), knowledgeTargetKey(right)));
	const acceptanceRequirementIds = sortedUnique(
		integrated.flatMap((entry) => [...entry.acceptanceSlice.acceptanceRequirementIds]),
	);
	const aggregate = materializeFrozenImplementationAggregate({
		schemaVersion: "1.0.0",
		changeId: change.changeId,
		changeRevisionId: change.currentRevision.revisionId,
		workGraphDigest: input.state.workGraph.graphDigest,
		workGraphDeltaIds: sortedUnique(requiredUnits.map((unit) => unit.deltaId)),
		lineageDigest: lineage.lineageDigest,
		targetRef: lineage.targetRef,
		baseCommit: lineage.baseCommit,
		headCommit: lineage.headCommit,
		headTreeDigest: lineage.headTreeDigest,
		requiredWorkUnitIds: requiredUnits.map((unit) => unit.workUnit.id).sort(compareText),
		integrationReceiptIds: integrated.map((entry) => entry.receiptId).sort(compareText),
		contributingCandidateIds: integrated.map((entry) => entry.candidateId).sort(compareText),
		contributingCandidateDigests: integrated.map((entry) => entry.candidateDigest).sort(compareText),
		gateReportDigests: integrated.map((entry) => entry.gateReportDigest).sort(compareText),
		knowledgeEffectIds,
		unchangedKnowledgeTargets,
		acceptanceRequirementIds,
		frozenAt: normalizedTimestamp(input.frozenAt),
	});
	const operation = createNextChangeOperation(change, {
		changeId: change.changeId,
		kind: "implementation.aggregate_frozen",
		baseSnapshot: input.baseSnapshot,
		authorityBinding: input.authorityBinding,
		recordedAt: input.frozenAt,
		payload: {
			aggregate: inlineSemanticArtifact(
				idFromDigest("implementation-aggregate", aggregate.aggregateDigest),
				aggregate.schemaVersion,
				aggregate,
			),
			lineageDigest: lineage.lineageDigest,
		},
	});
	const projected = reduceChangeOperation(change, operation, {});
	return Object.freeze({operation, aggregate, state: projected});
}

function requireCurrentCandidateAndGate(
	input: CreatePrivateIntegrationAdmissionInput,
): ChangeWorkState {
	assertCurrentWorkUnitCandidate(input.candidate, input.state);
	if (
		input.gateReport.stage !== "implementation" ||
		input.gateReport.status !== "passed" ||
		input.gateReport.subjectDigest !== input.candidate.digest
	) {
		throw new Error("Private integration requires exact passing Work Unit Gate Report.");
	}
	const change = changeById(input.state, input.candidate.content.owningChangeId);
	if (!change?.currentRevision || change.withdrawn) {
		throw new Error("Private integration requires current non-withdrawn owning Change.");
	}
	const attempt = change.loopAttempts.find(
		(entry) =>
			entry.loop === "implementation" &&
			entry.currentCandidateId === input.candidate.id &&
			entry.status === "passed",
	);
	if (!attempt?.exitReportOperationId) {
		throw new Error("Private integration requires canonically recorded passing Candidate Gate.");
	}
	const candidateOperation = change.operations.find(
		(operation) =>
			operation.operationId === attempt.candidateOperationIds.at(-1) &&
			operation.body.kind === "implementation.candidate_recorded",
	);
	if (!candidateOperation) {
		throw new Error("Private integration Candidate operation is missing.");
	}
	const candidateArtifact = operationPayload(
		candidateOperation,
		"implementation.candidate_recorded",
	).candidate;
	if (
		candidateArtifact.id !== input.candidate.id ||
		candidateArtifact.digest !== canonicalJsonDigest(input.candidate) ||
		canonicalJson(candidateArtifact.artifact) !== canonicalJson(input.candidate)
	) {
		throw new Error("Private integration Candidate identity changed after Gate.");
	}
	const reportOperation = change.operations.find(
		(operation) => operation.operationId === attempt.exitReportOperationId,
	);
	if (!reportOperation || reportOperation.body.kind !== "loop.exit_report_recorded") {
		throw new Error("Private integration Gate Report operation is missing.");
	}
	const reportArtifact = operationPayload(reportOperation, "loop.exit_report_recorded").report;
	if (
		reportArtifact.digest !== canonicalJsonDigest(input.gateReport) ||
		canonicalJson(reportArtifact.artifact) !== canonicalJson(input.gateReport)
	) {
		throw new Error("Private integration Gate Report identity changed after Gate.");
	}
	return change;
}

function assertAdmissionObservation(
	input: CreatePrivateIntegrationAdmissionInput,
	change: ChangeWorkState,
	lineage: PrivateChangeIntegrationLineage | null,
): void {
	const expectedLineageDigest = lineage?.lineageDigest ?? "absent";
	if (input.observation.expectedLineageDigest !== expectedLineageDigest) {
		throw new Error("Private integration expected-head CAS failed.");
	}
	if (input.observation.workGraphDigest !== input.state.workGraph.graphDigest) {
		throw new Error("Private integration Work Graph observation is stale.");
	}
	if (
		input.observation.candidateTreeDigest !== input.candidate.content.resultTreeDigest ||
		!sameSet(input.observation.changedPaths, input.candidate.content.changedPaths)
	) {
		throw new Error("Private integration observed changed bytes differ from passing Candidate.");
	}
	if (input.observation.workbenchDigest !== input.candidate.content.workbenchDigest) {
		throw new Error("Private integration Workbench custody is stale.");
	}
	const expectedCustody = input.candidate.content.runAttempts.map((run) => run.receiptDigest);
	if (!sameSet(input.observation.custodyReceiptDigests, expectedCustody)) {
		throw new Error("Private integration requires exact producing custody receipts.");
	}
	const lineageBase = lineage?.baseCommit ?? input.candidate.content.sourceBase;
	if (input.candidate.content.sourceBase !== lineageBase) {
		throw new Error("Private integration Candidate source base is stale.");
	}
	const currentHead = lineage?.headCommit ?? lineageBase;
	if (input.observation.baseCommit !== currentHead) {
		throw new Error("Private integration commit base is stale.");
	}
	if (
		lineage?.integratedWorkUnits.some(
			(entry) => entry.workUnitId === input.candidate.content.workUnitId,
		) &&
		!reviewReworkAllowsWorkUnit(change, input.candidate.content.workUnitId)
	) {
		throw new Error(`Work Unit ${input.candidate.content.workUnitId} is already integrated.`);
	}
	const assignment = change.assignments.find(
		(entry) => entry.assignmentAttemptId === input.candidate.content.assignmentAttemptId,
	);
	if (
		!assignment ||
		assignment.assignmentDigest !== input.candidate.content.assignmentDigest ||
		assignment.workbenchDigest !== input.candidate.content.workbenchDigest ||
		(assignment.status !== "active" && assignment.status !== "completed")
	) {
		throw new Error("Private integration Assignment authority is stale.");
	}
}

function assertDependenciesIntegrated(
	state: ProjectWorkState,
	change: ChangeWorkState,
	workUnitId: string,
): void {
	const dependencyIds = state.workGraph.dependencyEdges
		.filter((edge) => edge.fromWorkUnitId === workUnitId)
		.map((edge) => edge.toWorkUnitId);
	for (const dependencyId of dependencyIds) {
		const dependency = requiredGraphUnit(state, dependencyId);
		if (dependency.workUnit.owningChangeId === change.changeId) {
			if (!change.privateIntegrationLineage?.integratedWorkUnits.some((entry) => entry.workUnitId === dependencyId)) {
				throw new Error(`Private integration dependency ${dependencyId} is not integrated.`);
			}
			continue;
		}
		const owner = changeById(state, dependency.workUnit.owningChangeId);
		if (!owner?.implementationAggregate?.requiredWorkUnitIds.includes(dependencyId)) {
			throw new Error(`Cross-Change integration dependency ${dependencyId} is incomplete.`);
		}
	}
}

function assertCompletion(
	state: ProjectWorkState,
	change: ChangeWorkState,
	lineage: PrivateChangeIntegrationLineage,
	requiredUnits: ReturnType<typeof requiredChangeUnits>,
): void {
	const requiredIds = requiredUnits.map((entry) => entry.workUnit.id).sort(compareText);
	const integratedIds = lineage.integratedWorkUnits.map((entry) => entry.workUnitId).sort(compareText);
	if (!sameOrdered(requiredIds, integratedIds)) {
		throw new Error("Implementation completion requires every required Work Unit exactly once.");
	}
	for (const unit of requiredUnits) {
		assertDependenciesIntegrated(state, change, unit.workUnit.id);
	}
	const revision = change.currentRevision;
	if (!revision) throw new Error("Implementation completion requires current Change revision.");
	const expectedEffects = revision.content.knowledge.kind === "effects"
		? revision.content.knowledge.effects.map(knowledgeEffectId).sort(compareText)
		: [];
	const expectedUnchanged = revision.content.knowledge.kind === "unchanged"
		? revision.content.knowledge.refs.map(knowledgeTargetKey).sort(compareText)
		: [];
	const expectedRequirements = revision.content.acceptanceRequirements
		.map((entry) => entry.id)
		.sort(compareText);
	const actualEffects = sortedUnique(
		lineage.integratedWorkUnits.flatMap((entry) => [...entry.acceptanceSlice.knowledgeEffectIds]),
	);
	const actualUnchanged = sortedUnique(
		lineage.integratedWorkUnits.flatMap((entry) =>
			entry.acceptanceSlice.unchangedKnowledgeTargets.map(knowledgeTargetKey),
		),
	);
	const actualRequirements = sortedUnique(
		lineage.integratedWorkUnits.flatMap((entry) => [...entry.acceptanceSlice.acceptanceRequirementIds]),
	);
	if (
		!sameOrdered(expectedEffects, actualEffects) ||
		!sameOrdered(expectedUnchanged, actualUnchanged) ||
		!sameOrdered(expectedRequirements, actualRequirements)
	) {
		throw new Error("Implementation completion acceptance coverage is incomplete.");
	}
}

function requiredChangeUnits(state: ProjectWorkState, changeId: string) {
	const units = state.workGraph.workUnits.filter(
		(entry) => entry.workUnit.owningChangeId === changeId && entry.status !== "retired",
	);
	if (units.length === 0) throw new Error("Implementation completion requires accepted Work Units.");
	return units.sort((left, right) => compareText(left.workUnit.id, right.workUnit.id));
}

function requiredGraphUnit(state: ProjectWorkState, workUnitId: string) {
	const unit = state.workGraph.workUnits.find((entry) => entry.workUnit.id === workUnitId);
	if (!unit || unit.status === "retired" || unit.status === "blocked") {
		throw new Error(`Work Unit ${workUnitId} is not current in canonical Work Graph.`);
	}
	return unit;
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
	return sameOrdered(sortedUnique(left), sortedUnique(right));
}

function sameOrdered(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sortedUnique<T extends string>(values: readonly T[]): T[] {
	return [...new Set(values)].sort(compareText);
}

function normalizedTimestamp(value: string): string {
	if (!value.trim() || Number.isNaN(Date.parse(value))) {
		throw new Error("Implementation aggregate timestamp is invalid.");
	}
	return value.trim();
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

export {privateChangeIntegrationRef};
