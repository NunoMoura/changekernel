import {
	assertValidCanonicalChangeOperation,
	assertValidStateCommitManifest,
	createStateCommitManifest,
	operationPayload,
	sameBaseSnapshot,
	type CreateStateCommitManifestInput,
} from "./identity.ts";
import type {
	AuthorityEvaluator,
	BaseSnapshot,
	CanonicalChangeOperation,
	ChangeOperationKind,
	GitObjectId,
	OperationAdmissionRequest,
	OperationId,
	StateCommitManifest,
} from "./contracts.ts";
import { OPERATION_DEFINITIONS } from "./catalog.ts";
import { reduceChangeOperation } from "./reduce-operation.ts";
import {
	changeById,
	createInitialProjectWorkState,
	materializeProjectWorkState,
	type AcceptedKnowledgeHead,
	type ChangeWorkState,
	type ProjectWorkState,
} from "./state.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type CanonicalJsonValue,
} from "../../utils/canonical-json.ts";
import { throwProtocolFailure } from "./errors.ts";
import {
	assertKnowledgeCandidateCheckpoint,
	type KnowledgeCandidateCheckpoint,
} from "../../knowledge/materialization.ts";
import type {KnowledgeTransition} from "./contracts.ts";
import { compareText, sameText } from "./order.ts";
import {assertAcceptedSchedulingOperations} from "./scheduling.ts";
import {
	assertPlanningCandidate,
	type PlanningCandidate,
} from "../../loops/planning/candidate.ts";
import type {ReviewAttempt} from "../../loops/review/contracts.ts";
import {
	applyAcceptedPlanningDelta,
	refreshWorkGraphStatuses,
	type CanonicalWorkGraph,
} from "../../loops/planning/work-graph.ts";
import {
	assertPrivateIntegrationReceipt,
	type PrivateIntegrationReceipt,
} from "./integration.ts";
import {
	assertWorkUnitCandidate,
	type WorkUnitCandidate,
} from "../../loops/implementation/work-unit-candidate.ts";
import {knowledgeTargetKey} from "../../knowledge/state.ts";

export type AcceptedProtocolRecord = CanonicalChangeOperation;

export interface AcceptedStateBatch {
	readonly stateHead: GitObjectId;
	readonly manifest: StateCommitManifest;
	readonly records: readonly AcceptedProtocolRecord[];
}

export interface SnapshotAdmissionRequest {
	readonly operationId: OperationId;
	readonly kind: AcceptedProtocolRecord["body"]["kind"];
	readonly baseSnapshot: BaseSnapshot;
	readonly expectedPreviousStateHead: GitObjectId | null;
}

export interface ReplayAdmissionPolicy {
	readonly authorize: AuthorityEvaluator;
	readonly acceptSnapshot: (request: SnapshotAdmissionRequest) => boolean;
}

export type StateBatchReductionErrorCode =
	| "INVALID_STATE_HEAD"
	| "MANIFEST_HEAD_MISMATCH"
	| "MANIFEST_RECORD_MISMATCH"
	| "DUPLICATE_OPERATION"
	| "UNAUTHORIZED_ACTOR"
	| "STALE_BASE"
	| "BATCH_BASE_MISMATCH"
	| "ATOMIC_BINDING_MISSING"
	| "TAIL_MISMATCH";

export function reduceAcceptedStateBatch(
	state: ProjectWorkState,
	batch: AcceptedStateBatch,
	policy: ReplayAdmissionPolicy,
): ProjectWorkState {
	validateBatchEnvelope(state, batch);
	const changeOperations = batch.records;
	validateRecordIdentities(batch.records);
	validateRecordOrder(state, batch);
	const observedBase = validateAdmission(state, batch, policy);
	validateAtomicMerges(changeOperations);
	validateAtomicSplits(changeOperations);
	try {
		assertAcceptedSchedulingOperations(state, changeOperations);
	} catch (error) {
		batchInvalid(
			"STALE_BASE",
			changeOperations.find(
				(operation) => operation.body.kind === "work_unit_claim.acquired",
			)?.operationId ?? null,
			error instanceof Error ? error.message : "Scheduling admission is invalid.",
		);
	}
	let changes = [...state.changes];
	for (const operation of changeOperations) {
		const current = changes.find(
			(change) => change.changeId === operation.body.changeId,
		);
		const next = reduceChangeOperation(current ?? null, operation, {});
		changes = replaceChange(changes, next);
	}
	validateManifestTails(state, changes, changeOperations, batch.manifest);
	const knowledgeHead = reduceAcceptedKnowledgeHead({
		state,
		changes,
		operations: changeOperations,
	});
	const workGraph = reduceAcceptedWorkGraph({
		state,
		changes,
		operations: changeOperations,
	});
	validatePrivateIntegrationAdmissions({state, changes, operations: changeOperations});
	validateFrozenImplementationAggregates({changes, workGraph, operations: changeOperations});
	validateGuardedDeliveries({changes, knowledgeHead, workGraph, operations: changeOperations});
	return materializeProjectWorkState({
		reducer: state.reducer,
		stateHead: batch.stateHead,
		observedBase,
		knowledgeHead,
		workGraph,
		changes: changes.sort((left, right) => compareText(left.changeId, right.changeId)),
		acceptedOperationIds: [
			...state.acceptedOperationIds,
			...batch.records.map(recordId),
		],
	});
}

export function replayAcceptedStateBatches(
	batches: readonly AcceptedStateBatch[],
	policy: ReplayAdmissionPolicy,
	initialState: ProjectWorkState = createInitialProjectWorkState(),
): ProjectWorkState {
	return batches.reduce(
		(state, batch) => reduceAcceptedStateBatch(state, batch, policy),
		initialState,
	);
}

export function createManifestForRecords(
	state: ProjectWorkState,
	records: readonly AcceptedProtocolRecord[],
): StateCommitManifest {
	if (records.length === 0) {
		throw new Error("Accepted state batch must contain at least one record.");
	}
	const tails = new Map<
		string,
		{previousTail: OperationId | null; nextTail: OperationId}
	>();
	for (const operation of records) {
		const current = tails.get(operation.body.changeId);
		tails.set(operation.body.changeId, {
			previousTail:
				current?.previousTail ??
				changeById(state, operation.body.changeId)?.tailOperationId ??
				null,
			nextTail: operation.operationId,
		});
	}
	const input: CreateStateCommitManifestInput = {
		previousStateHead: state.stateHead,
		operationIds: records.map(recordId),
		changedTraceTails: [...tails]
			.map(([changeId, tail]) => ({changeId, ...tail}))
			.sort((left, right) => compareText(left.changeId, right.changeId)),
	};
	return createStateCommitManifest(input);
}

function reduceAcceptedWorkGraph(input: {
	readonly state: ProjectWorkState;
	readonly changes: readonly ChangeWorkState[];
	readonly operations: readonly CanonicalChangeOperation[];
}): CanonicalWorkGraph {
	let graph = input.state.workGraph;
	for (const operation of input.operations) {
		if (operation.body.kind !== "planning.delta_accepted") continue;
		const payload = operationPayload(operation, "planning.delta_accepted");
		if (payload.expectedWorkStateDigest !== input.state.workStateDigest) {
			batchInvalid(
				"STALE_BASE",
				operation.operationId,
				"Planning acceptance WorkState compare-and-swap failed.",
			);
		}
		if (payload.expectedKnowledgeStateDigest !== input.state.knowledgeHead?.stateDigest) {
			batchInvalid(
				"STALE_BASE",
				operation.operationId,
				"Planning acceptance Knowledge State compare-and-swap failed.",
			);
		}
		if (payload.expectedWorkGraphDigest !== graph.graphDigest) {
			batchInvalid(
				"STALE_BASE",
				operation.operationId,
				"Planning acceptance Work Graph compare-and-swap failed.",
			);
		}
		const change = input.changes.find(
			(candidate) => candidate.changeId === operation.body.changeId,
		);
		const candidateOperation = change?.operations.find(
			(candidate) =>
				candidate.body.kind === "planning.candidate_recorded" &&
				operationPayload(candidate, "planning.candidate_recorded").candidate.id ===
					payload.candidateId,
		);
		const artifact = candidateOperation
			? operationPayload(candidateOperation, "planning.candidate_recorded").candidate.artifact
			: undefined;
		if (!artifact) {
			batchInvalid(
				"ATOMIC_BINDING_MISSING",
				operation.operationId,
				"Planning acceptance Candidate artifact is unavailable.",
			);
		}
		// SAFETY: semantic assertion below reconstructs and verifies full Planning Candidate identity.
		const planningCandidate = artifact as unknown as PlanningCandidate;
		try {
			assertPlanningCandidate(planningCandidate, input.state);
			if (
				planningCandidate.digest !== payload.candidateDigest ||
				planningCandidate.content.delta.deltaId !== payload.deltaId
			) {
				throw new Error("Planning acceptance Candidate bindings do not match payload.");
			}
			graph = applyAcceptedPlanningDelta({
				graph,
				delta: planningCandidate.content.delta,
				candidateId: planningCandidate.id,
				candidateDigest: planningCandidate.digest,
				acceptanceOperationId: operation.operationId,
				changes: input.changes,
			});
		} catch (error) {
			batchInvalid(
				"ATOMIC_BINDING_MISSING",
				operation.operationId,
				error instanceof Error ? error.message : "Planning acceptance is invalid.",
			);
		}
	}
	return refreshWorkGraphStatuses(graph, input.changes);
}

function reduceAcceptedKnowledgeHead(input: {
	readonly state: ProjectWorkState;
	readonly changes: readonly ChangeWorkState[];
	readonly operations: readonly CanonicalChangeOperation[];
}): AcceptedKnowledgeHead | null {
	let head = input.state.knowledgeHead;
	for (const operation of input.operations) {
		if (operation.body.kind !== "decision.confirmed") continue;
		const payload = operationPayload(operation, "decision.confirmed");
		if (payload.expectedWorkStateDigest !== input.state.workStateDigest) {
			batchInvalid(
				"STALE_BASE",
				operation.operationId,
				"Decision confirmation WorkState compare-and-swap failed.",
			);
		}
		const change = input.changes.find(
			(candidate) => candidate.changeId === operation.body.changeId,
		);
		const candidateOperation = change?.operations.find(
			(candidate) =>
				candidate.body.kind === "decision.candidate_recorded" &&
				operationPayload(candidate, "decision.candidate_recorded").candidate.id ===
					payload.candidateId,
		);
		const candidateArtifact = candidateOperation
			? operationPayload(candidateOperation, "decision.candidate_recorded").candidate.artifact
			: undefined;
		const acceptedDigest = decisionCandidateAcceptedActiveChangesDigest(candidateArtifact);
		if (acceptedDigest !== payload.expectedAcceptedActiveChangesDigest) {
			batchInvalid(
				"STALE_BASE",
				operation.operationId,
				"Decision confirmation accepted active Changes compare-and-swap failed.",
			);
		}
		if (payload.disposition !== "approve") continue;
		const checkpoint = decisionCandidateProjectedKnowledgeCheckpoint(
			candidateArtifact,
			payload,
		);
		if (!checkpoint) {
			batchInvalid(
				"STALE_BASE",
				operation.operationId,
				"Decision confirmation Knowledge checkpoint binding is invalid.",
			);
		}
		if (head && head.stateDigest !== payload.baseKnowledgeStateDigest) {
			batchInvalid(
				"STALE_BASE",
				operation.operationId,
				"Decision confirmation Knowledge State compare-and-swap failed.",
			);
		}
		head = {
			confirmationOperationId: operation.operationId,
			candidateId: payload.candidateId,
			checkpointDigest: payload.knowledgeCheckpointDigest,
			baseStateDigest: payload.baseKnowledgeStateDigest,
			stateDigest: payload.resultingKnowledgeStateDigest,
			applicationPlanDigest: payload.applicationPlanDigest,
			projectionDigest: payload.resultingProjectionDigest,
			checkpoint,
		};
	}
	return head;
}

function decisionCandidateProjectedKnowledgeCheckpoint(
	value: unknown,
	payload: Extract<
		ReturnType<typeof operationPayload<"decision.confirmed">>,
		{readonly disposition: "approve"}
	>,
): CanonicalJsonValue | undefined {
	const candidate = plainRecord(value);
	const content = plainRecord(candidate?.content);
	const binding = plainRecord(content?.knowledgeCheckpoint);
	const applicationPlan = plainRecord(binding?.applicationPlan);
	const revision = plainRecord(content?.revision);
	const knowledge = plainRecord(revision?.knowledge);
	const projected = plainRecord(binding?.projected);
	const projectedState = plainRecord(projected?.state);
	const projectedProjection = plainRecord(projected?.projection);
	if (!binding || !knowledge) return undefined;
	try {
		// SAFETY: canonical Candidate bytes are structurally decoded above; compiler replay validates every nested field.
		assertKnowledgeCandidateCheckpoint(
			binding as unknown as KnowledgeCandidateCheckpoint,
			knowledge as unknown as KnowledgeTransition,
		);
	} catch {
		return undefined;
	}
	if (
		binding.checkpointDigest !== payload.knowledgeCheckpointDigest ||
		applicationPlan?.baseStateDigest !== payload.baseKnowledgeStateDigest ||
		applicationPlan?.resultingStateDigest !== payload.resultingKnowledgeStateDigest ||
		applicationPlan?.planDigest !== payload.applicationPlanDigest ||
		applicationPlan?.resultingProjectionDigest !== payload.resultingProjectionDigest ||
		projectedState?.stateDigest !== payload.resultingKnowledgeStateDigest ||
		projectedProjection?.projectionDigest !== payload.resultingProjectionDigest
	) {
		return undefined;
	}
	return toCanonicalJsonValue(projected);
}

function decisionCandidateAcceptedActiveChangesDigest(
	value: unknown,
): string | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	const content = (value as {readonly content?: unknown}).content;
	if (!content || typeof content !== "object" || Array.isArray(content)) return undefined;
	const accepted = (content as {readonly acceptedActiveChanges?: unknown})
		.acceptedActiveChanges;
	if (!accepted || typeof accepted !== "object" || Array.isArray(accepted)) {
		return undefined;
	}
	const digest = (accepted as {readonly digest?: unknown}).digest;
	return typeof digest === "string" ? digest : undefined;
}

function plainRecord(value: unknown): Record<string, unknown> | undefined {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function validatePrivateIntegrationAdmissions(input: {
	readonly state: ProjectWorkState;
	readonly changes: readonly ChangeWorkState[];
	readonly operations: readonly CanonicalChangeOperation[];
}): void {
	for (const operation of input.operations) {
		if (operation.body.kind !== "integration.candidate_admitted") continue;
		const payload = operationPayload(operation, "integration.candidate_admitted");
		// SAFETY: inline artifact is schema-bounded; exact receipt assertion checks every canonical field.
		const receipt = payload.receipt.artifact as unknown as PrivateIntegrationReceipt;
		assertPrivateIntegrationReceipt(receipt);
		const change = input.changes.find((entry) => entry.changeId === receipt.changeId);
		const graphUnit = input.state.workGraph.workUnits.find(
			(entry) => entry.workUnit.id === receipt.workUnitId,
		);
		if (
			!change ||
			!graphUnit ||
			graphUnit.status === "retired" ||
			receipt.workGraphDigest !== input.state.workGraph.graphDigest ||
			graphUnit.deltaId !== receipt.workGraphDeltaId ||
			graphUnit.workUnit.owningChangeId !== receipt.changeId ||
			canonicalJsonDigest(graphUnit.workUnit) !== receipt.workUnitDigest
		) {
			batchInvalid("STALE_BASE", operation.operationId, "Private integration Work Graph binding is stale.");
		}
		const candidateOperation = change.operations.find(
			(candidate) =>
				candidate.body.kind === "implementation.candidate_recorded" &&
				operationPayload(candidate, "implementation.candidate_recorded").candidate.id === receipt.candidateId,
		);
		if (!candidateOperation || candidateOperation.body.kind !== "implementation.candidate_recorded") {
			batchInvalid("STALE_BASE", operation.operationId, "Private integration Candidate is not canonical.");
		}
		const candidateArtifact = operationPayload(
			candidateOperation,
			"implementation.candidate_recorded",
		).candidate;
		// SAFETY: exact Work Unit Candidate assertion validates canonical shape and identity.
		const candidate = candidateArtifact.artifact as unknown as WorkUnitCandidate;
		assertWorkUnitCandidate(candidate);
		const receiptAttempts = candidate.content.runAttempts.map((entry) => entry.receiptDigest);
		if (
			candidate.id !== receipt.candidateId ||
			candidate.digest !== receipt.candidateDigest ||
			candidateArtifact.digest !== canonicalJsonDigest(candidate) ||
			candidate.content.resultTreeDigest !== receipt.candidateTreeDigest ||
			candidate.content.assignmentAttemptId !== receipt.assignmentAttemptId ||
			candidate.content.assignmentDigest !== receipt.assignmentDigest ||
			candidate.content.workbenchId !== receipt.workbenchId ||
			candidate.content.workbenchDigest !== receipt.workbenchDigest ||
			!sameTextList(candidate.content.changedPaths, receipt.changedPaths) ||
			!sameTextList(receiptAttempts, receipt.custodyReceiptDigests) ||
			canonicalJson(candidate.content.acceptanceSlice) !== canonicalJson(receipt.acceptanceSlice)
		) {
			batchInvalid("STALE_BASE", operation.operationId, "Private integration Candidate bytes or custody changed after Gate.");
		}
		const attempt = change.loopAttempts.find(
			(entry) =>
				entry.loop === "implementation" &&
				entry.currentCandidateId === receipt.candidateId &&
				entry.status === "passed",
		);
		const reportOperation = change.operations.find(
			(entry) => entry.operationId === attempt?.exitReportOperationId,
		);
		const report =
			reportOperation?.body.kind === "loop.exit_report_recorded"
				? plainRecord(operationPayload(reportOperation, "loop.exit_report_recorded").report.artifact)
				: undefined;
		if (!attempt || report?.reportDigest !== receipt.gateReportDigest) {
			batchInvalid("STALE_BASE", operation.operationId, "Private integration passing Gate binding is stale.");
		}
		const assignment = change.assignments.find(
			(entry) => entry.assignmentAttemptId === receipt.assignmentAttemptId,
		);
		if (
			!assignment ||
			assignment.assignmentDigest !== receipt.assignmentDigest ||
			assignment.workbenchDigest !== receipt.workbenchDigest ||
			(assignment.status !== "active" && assignment.status !== "completed")
		) {
			batchInvalid("STALE_BASE", operation.operationId, "Private integration Assignment custody is stale.");
		}
		assertReceiptDependencies(input.changes, input.state.workGraph, change, receipt, operation.operationId);
	}
}

function assertReceiptDependencies(
	changes: readonly ChangeWorkState[],
	workGraph: CanonicalWorkGraph,
	change: ChangeWorkState,
	receipt: Pick<
		PrivateIntegrationReceipt,
		"workUnitId" | "dependencyWorkUnitIds" | "receiptId"
	>,
	operationId: OperationId,
): void {
	const dependencyIds = workGraph.dependencyEdges
		.filter((edge) => edge.fromWorkUnitId === receipt.workUnitId)
		.map((edge) => edge.toWorkUnitId)
		.sort(compareText);
	if (!sameTextList(dependencyIds, receipt.dependencyWorkUnitIds)) {
		batchInvalid("STALE_BASE", operationId, "Private integration dependency set drifted.");
	}
	const receiptIndex = change.privateIntegrationLineage?.receipts.findIndex(
		(entry) => entry.receiptId === receipt.receiptId,
	) ?? -1;
	for (const dependencyId of dependencyIds) {
		const dependency = workGraph.workUnits.find((entry) => entry.workUnit.id === dependencyId);
		if (!dependency) batchInvalid("STALE_BASE", operationId, `Integration dependency ${dependencyId} is missing.`);
		if (dependency.workUnit.owningChangeId === change.changeId) {
			const integrated = change.privateIntegrationLineage?.integratedWorkUnits.find(
				(entry) => entry.workUnitId === dependencyId,
			);
			const dependencyIndex = change.privateIntegrationLineage?.receipts.findIndex(
				(entry) => entry.receiptId === integrated?.receiptId,
			) ?? -1;
			if (!integrated || dependencyIndex < 0 || dependencyIndex >= receiptIndex) {
				batchInvalid("STALE_BASE", operationId, `Integration dependency ${dependencyId} was not admitted first.`);
			}
			continue;
		}
		const owner = changes.find((entry) => entry.changeId === dependency.workUnit.owningChangeId);
		if (!owner?.implementationAggregate?.requiredWorkUnitIds.includes(dependencyId)) {
			batchInvalid("STALE_BASE", operationId, `Cross-Change dependency ${dependencyId} is incomplete.`);
		}
	}
}

function validateGuardedDeliveries(input: {
	readonly changes: readonly ChangeWorkState[];
	readonly knowledgeHead: AcceptedKnowledgeHead | null;
	readonly workGraph: CanonicalWorkGraph;
	readonly operations: readonly CanonicalChangeOperation[];
}): void {
	for (const operation of input.operations) {
		if (operation.body.kind !== "delivery.applied") continue;
		const payload = operationPayload(operation, "delivery.applied");
		// SAFETY: delivery operation schema and per-Change reduction validate exact Review attempt shape.
		const attempt = payload.reviewAttempt.artifact as unknown as ReviewAttempt;
		const change = input.changes.find(
			(entry) => entry.changeId === operation.body.changeId,
		);
		const aggregate = change?.implementationAggregate;
		if (
			!change?.delivery ||
			!aggregate ||
			!input.knowledgeHead ||
			attempt.knowledgeStateDigest !== input.knowledgeHead.stateDigest ||
			attempt.knowledgeProjectionDigest !== input.knowledgeHead.projectionDigest ||
			attempt.workGraphDigest !== input.workGraph.graphDigest ||
			!sameText(attempt.planningDeltaIds, aggregate.workGraphDeltaIds) ||
			attempt.planningDeltaIds.some(
				(deltaId) =>
					!input.workGraph.deltas.some((entry) => entry.delta.deltaId === deltaId),
			)
		) {
			batchInvalid(
				"STALE_BASE",
				operation.operationId,
				"Guarded delivery Review authority is stale against Knowledge or Planning state.",
			);
		}
	}
}

function validateFrozenImplementationAggregates(input: {
	readonly changes: readonly ChangeWorkState[];
	readonly workGraph: CanonicalWorkGraph;
	readonly operations: readonly CanonicalChangeOperation[];
}): void {
	for (const operation of input.operations) {
		if (operation.body.kind !== "implementation.aggregate_frozen") continue;
		const change = input.changes.find((entry) => entry.changeId === operation.body.changeId);
		const aggregate = change?.implementationAggregate;
		const lineage = change?.privateIntegrationLineage;
		if (!change?.currentRevision || !aggregate || !lineage) {
			batchInvalid("STALE_BASE", operation.operationId, "Implementation aggregate state is missing.");
		}
		const requiredUnits = input.workGraph.workUnits
			.filter(
				(entry) => entry.workUnit.owningChangeId === change.changeId && entry.status !== "retired",
			)
			.sort((left, right) => compareText(left.workUnit.id, right.workUnit.id));
		const requiredIds = requiredUnits.map((entry) => entry.workUnit.id);
		const deltaIds = [...new Set(requiredUnits.map((entry) => entry.deltaId))].sort(compareText);
		const effectIds = uniqueSorted(requiredUnits.flatMap((entry) => [...entry.workUnit.knowledgeEffectIds]));
		const unchangedTargets = uniqueSorted(
			requiredUnits.flatMap((entry) => entry.workUnit.unchangedKnowledgeTargets.map(knowledgeTargetKey)),
		);
		const requirementIds = uniqueSorted(
			requiredUnits.flatMap((entry) => [...entry.workUnit.acceptanceRequirementIds]),
		);
		const integrated = requiredIds.map((workUnitId) =>
			lineage.integratedWorkUnits.find((entry) => entry.workUnitId === workUnitId),
		);
		if (
			requiredUnits.length === 0 ||
			integrated.some((entry) => !entry) ||
			aggregate.workGraphDigest !== input.workGraph.graphDigest ||
			!sameTextList(aggregate.requiredWorkUnitIds, requiredIds) ||
			!sameTextList(aggregate.workGraphDeltaIds, deltaIds) ||
			!sameTextList(aggregate.knowledgeEffectIds, effectIds) ||
			!sameTextList(
				aggregate.unchangedKnowledgeTargets.map(knowledgeTargetKey),
				unchangedTargets,
			) ||
			!sameTextList(aggregate.acceptanceRequirementIds, requirementIds)
		) {
			batchInvalid("STALE_BASE", operation.operationId, "Implementation aggregate coverage is incomplete.");
		}
		for (const unit of requiredUnits) {
			const receipt = lineage.integratedWorkUnits.find((entry) => entry.workUnitId === unit.workUnit.id);
			if (!receipt) continue;
			assertReceiptDependencies(
				input.changes,
				input.workGraph,
				change,
				{
					workUnitId: receipt.workUnitId,
					receiptId: receipt.receiptId,
					dependencyWorkUnitIds: input.workGraph.dependencyEdges
						.filter((edge) => edge.fromWorkUnitId === unit.workUnit.id)
						.map((edge) => edge.toWorkUnitId),
				},
				operation.operationId,
			);
		}
	}
}

function sameTextList(left: readonly string[], right: readonly string[]): boolean {
	const leftSorted = [...left].sort(compareText);
	const rightSorted = [...right].sort(compareText);
	return leftSorted.length === rightSorted.length && leftSorted.every((value, index) => value === rightSorted[index]);
}

function uniqueSorted(values: readonly string[]): string[] {
	return [...new Set(values)].sort(compareText);
}

function validateBatchEnvelope(
	state: ProjectWorkState,
	batch: AcceptedStateBatch,
): void {
	assertValidStateCommitManifest(batch.manifest);
	if (!/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(batch.stateHead)) {
		batchInvalid("INVALID_STATE_HEAD", null, `invalid Git state head ${batch.stateHead}.`);
	}
	if (batch.stateHead === state.stateHead) {
		batchInvalid("INVALID_STATE_HEAD", null, "state head must advance.");
	}
	if (batch.manifest.body.previousStateHead !== state.stateHead) {
		batchInvalid(
			"MANIFEST_HEAD_MISMATCH",
			null,
			`manifest expected ${String(batch.manifest.body.previousStateHead)}, current is ${String(state.stateHead)}.`,
		);
	}
}

function validateRecordIdentities(
	records: readonly AcceptedProtocolRecord[],
): void {
	for (const record of records) {
		assertValidCanonicalChangeOperation(record);
	}
}

function validateRecordOrder(
	state: ProjectWorkState,
	batch: AcceptedStateBatch,
): void {
	const recordIds = batch.records.map(recordId);
	if (!sameText(recordIds, batch.manifest.body.operationIds)) {
		batchInvalid(
			"MANIFEST_RECORD_MISMATCH",
			null,
			"manifest operationIds do not match exact record order.",
		);
	}
	const unique = new Set(recordIds);
	if (unique.size !== recordIds.length) {
		batchInvalid("DUPLICATE_OPERATION", null, "batch contains duplicate operation IDs.");
	}
	const accepted = new Set(state.acceptedOperationIds);
	for (const operationId of recordIds) {
		if (accepted.has(operationId)) {
			batchInvalid(
				"DUPLICATE_OPERATION",
				operationId,
				`operation ${operationId} is already accepted.`,
			);
		}
	}
}

function validateAdmission(
	state: ProjectWorkState,
	batch: AcceptedStateBatch,
	policy: ReplayAdmissionPolicy,
): BaseSnapshot {
	const first = batch.records[0];
	if (!first) {
		batchInvalid("MANIFEST_RECORD_MISMATCH", null, "accepted batch is empty.");
	}
	const expectedBase = baseSnapshotOf(first);
	for (const record of batch.records) {
		const operationId = recordId(record);
		const baseSnapshot = baseSnapshotOf(record);
		if (baseSnapshot.remoteStateHead !== state.stateHead) {
			batchInvalid(
				"STALE_BASE",
				operationId,
				`record base ${String(baseSnapshot.remoteStateHead)} does not match ${String(state.stateHead)}.`,
			);
		}
		if (!sameBaseSnapshot(expectedBase, baseSnapshot)) {
			batchInvalid(
				"BATCH_BASE_MISMATCH",
				operationId,
				"accepted records do not share one exact base snapshot.",
			);
		}
		const definition = OPERATION_DEFINITIONS[record.body.kind];
		const admission: OperationAdmissionRequest = {
			operationId,
			kind: record.body.kind,
			capability: definition.capability,
			authorityBinding: record.body.authorityBinding,
			baseSnapshot,
		};
		if (!policy.authorize(admission)) {
			batchInvalid(
				"UNAUTHORIZED_ACTOR",
				operationId,
				`${record.body.authorityBinding.actorId} lacks ${definition.capability}.`,
			);
		}
		if (
			!policy.acceptSnapshot({
				operationId,
				kind: record.body.kind,
				baseSnapshot,
				expectedPreviousStateHead: state.stateHead,
			})
		) {
			batchInvalid("STALE_BASE", operationId, "snapshot admission rejected.");
		}
	}
	return expectedBase;
}

type MergeOperation = CanonicalChangeOperation<"change.merge_recorded">;
type SplitOperation = CanonicalChangeOperation<"change.split_recorded">;

function validateAtomicMerges(
	operations: readonly CanonicalChangeOperation[],
): void {
	const merges = operations.filter(
		(operation): operation is MergeOperation =>
			isOperationKind(operation, "change.merge_recorded"),
	);
	validateLineageGroups({
		records: merges,
		kind: "change.merge_recorded",
		identityOf: (operation) => operation.body.payload.mergeId,
		participantsOf: (operation) => [
			...operation.body.payload.sources.map((entry) => entry.changeId),
			operation.body.payload.result.changeId,
		],
	});
}

function validateAtomicSplits(
	operations: readonly CanonicalChangeOperation[],
): void {
	const splits = operations.filter(
		(operation): operation is SplitOperation =>
			isOperationKind(operation, "change.split_recorded"),
	);
	validateLineageGroups({
		records: splits,
		kind: "change.split_recorded",
		identityOf: (operation) => operation.body.payload.splitId,
		participantsOf: (operation) => [
			operation.body.payload.source.changeId,
			...operation.body.payload.results.map((entry) => entry.changeId),
		],
	});
}

interface LineageGroupValidation<T extends CanonicalChangeOperation> {
	readonly records: readonly T[];
	readonly kind: "change.merge_recorded" | "change.split_recorded";
	readonly identityOf: (operation: T) => string;
	readonly participantsOf: (operation: T) => readonly string[];
}

function validateLineageGroups<T extends CanonicalChangeOperation>({
	records,
	kind,
	identityOf,
	participantsOf,
}: LineageGroupValidation<T>): void {
	const identities = new Set(records.map(identityOf));
	for (const identity of identities) {
		const group = records.filter((operation) => identityOf(operation) === identity);
		const first = group[0];
		if (!first) continue;
		const expected = new Set(participantsOf(first));
		const actual = new Set(group.map((operation) => operation.body.changeId));
		if (actual.size !== group.length || !sameSet(actual, expected)) {
			batchInvalid(
				"ATOMIC_BINDING_MISSING",
				first.operationId,
				`${kind} ${identity} lacks exact participant operations.`,
			);
		}
	}
}

function validateManifestTails(
	before: ProjectWorkState,
	afterChanges: readonly ChangeWorkState[],
	operations: readonly CanonicalChangeOperation[],
	manifest: StateCommitManifest,
): void {
	const changedIds = [...new Set(operations.map((operation) => operation.body.changeId))].sort(
		compareText,
	);
	const manifestIds = manifest.body.changedTraceTails.map((entry) => entry.changeId);
	if (!sameText(changedIds, manifestIds)) {
		batchInvalid("TAIL_MISMATCH", null, "manifest changed Trace set is incomplete.");
	}
	for (const entry of manifest.body.changedTraceTails) {
		const previous = changeById(before, entry.changeId)?.tailOperationId ?? null;
		const next = afterChanges.find((change) => change.changeId === entry.changeId);
		if (entry.previousTail !== previous || entry.nextTail !== next?.tailOperationId) {
			batchInvalid(
				"TAIL_MISMATCH",
				entry.nextTail,
				`manifest tail transition for ${entry.changeId} is invalid.`,
			);
		}
	}
}

function isOperationKind<K extends ChangeOperationKind>(
	operation: CanonicalChangeOperation,
	kind: K,
): operation is CanonicalChangeOperation<K> {
	return operation.body.kind === kind;
}

function baseSnapshotOf(record: AcceptedProtocolRecord): BaseSnapshot {
	const snapshot = record.body.baseSnapshot;
	return {
		remoteStateHead: snapshot.remoteStateHead,
		sourceHead: snapshot.sourceHead,
		knowledgeDigest: snapshot.knowledgeDigest,
		configDigest: snapshot.configDigest,
		policyDigest: snapshot.policyDigest,
	};
}

function recordId(record: AcceptedProtocolRecord): OperationId {
	return record.operationId;
}

function replaceChange(
	changes: readonly ChangeWorkState[],
	next: ChangeWorkState,
): ChangeWorkState[] {
	const index = changes.findIndex((change) => change.changeId === next.changeId);
	if (index < 0) return [...changes, next];
	return changes.map((change, changeIndex) =>
		changeIndex === index ? next : change,
	);
}

function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
	return left.size === right.size && [...left].every((value) => right.has(value));
}

function batchInvalid(
	code: StateBatchReductionErrorCode,
	operationId: OperationId | null,
	message: string,
): never {
	return throwProtocolFailure(
		"StateBatchReductionError",
		code,
		operationId,
		message,
	);
}

export function sameWorkState(
	left: ProjectWorkState,
	right: ProjectWorkState,
): boolean {
	return canonicalJson(left) === canonicalJson(right);
}
