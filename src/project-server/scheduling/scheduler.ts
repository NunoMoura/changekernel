import {createNextChangeOperation} from "../../changes/trace/builder.ts";
import type {
	AuthorityBinding,
	BaseSnapshot,
	CanonicalChangeOperation,
	GitObjectId,
} from "../../changes/trace/contracts.ts";
import {reduceChangeOperation} from "../../changes/trace/reduce-operation.ts";
import {
	createScheduledAssignment,
	createWorkbenchBinding,
	schedulingArtifact,
	assertSchedulingPolicy,
	assertWorkerOffer,
	assertWorkerOfferMatches,
	type ScheduledAssignment,
	type SchedulingPolicy,
	type WorkbenchBinding,
	type WorkerOffer,
} from "../../changes/trace/scheduling.ts";
import {
	changeById,
	type ChangeWorkState,
	type ProjectWorkState,
} from "../../changes/trace/state.ts";
import type {PlanningWorkUnitCandidate} from "../../loops/planning/candidate-content.ts";
import {
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export const SCHEDULING_PLAN_PROTOCOL = Object.freeze({
	id: "codewiki.scheduling-plan",
	version: "1.0.0",
} as const);

export interface ReadyWorkUnit {
	readonly workGraphDeltaId: Sha256Digest;
	readonly workUnit: PlanningWorkUnitCandidate;
}

export interface SchedulingAdmission {
	readonly workGraphDeltaId: Sha256Digest;
	readonly workUnit: PlanningWorkUnitCandidate;
	readonly workerOffer: WorkerOffer;
	readonly workbench: WorkbenchBinding;
	readonly assignment: ScheduledAssignment;
}

export interface SchedulingHold {
	readonly workUnitId: string;
	readonly reason:
		| "dependency_incomplete"
		| "active_authority"
		| "no_eligible_worker"
		| "capacity_exhausted";
	readonly detail: string;
}

export type SchedulingPlan = CanonicalJsonValue & {
	readonly protocol: typeof SCHEDULING_PLAN_PROTOCOL;
	readonly observedWorkStateDigest: Sha256Digest;
	readonly observedWorkGraphDigest: Sha256Digest;
	readonly observedAt: string;
	readonly sourceBase: GitObjectId;
	readonly schedulingPolicyDigest: Sha256Digest;
	readonly admissions: readonly SchedulingAdmission[];
	readonly holds: readonly SchedulingHold[];
	readonly planDigest: Sha256Digest;
};

export interface SchedulingOperationSequence {
	readonly operations: readonly CanonicalChangeOperation[];
	readonly projectedChanges: readonly ChangeWorkState[];
	readonly assignmentOperationIds: readonly Sha256Digest[];
}

export function deriveReadyWorkUnits(state: ProjectWorkState): ReadyWorkUnit[] {
	const result: ReadyWorkUnit[] = [];
	for (const entry of state.workGraph.workUnits) {
		if (entry.status !== "accepted") continue;
		const owningChange = changeById(state, entry.workUnit.owningChangeId);
		if (!owningChange?.currentRevision || owningChange.withdrawn) continue;
		if (!dependenciesComplete(state, entry.workUnit.id)) continue;
		if (hasActiveAuthority(state, entry.workUnit.id)) continue;
		result.push({workGraphDeltaId: entry.deltaId, workUnit: entry.workUnit});
	}
	return result.sort((left, right) => compareText(left.workUnit.id, right.workUnit.id));
}

export function createProjectSchedulingPlan(input: {
	readonly state: ProjectWorkState;
	readonly workerOffers: readonly WorkerOffer[];
	readonly policy: SchedulingPolicy;
	readonly sourceBase: GitObjectId;
	readonly observedAt: string;
}): SchedulingPlan {
	assertSchedulingPolicy(input.policy);
	const observedAt = timestamp(input.observedAt);
	const sourceBase = gitObjectId(input.sourceBase);
	const offers = [...input.workerOffers].sort((left, right) =>
		compareText(left.offerId, right.offerId),
	);
	const offerIds = new Set<string>();
	for (const offer of offers) {
		assertWorkerOffer(offer);
		if (offerIds.has(offer.offerId)) throw new Error(`Worker Offer ${offer.offerId} is duplicated.`);
		offerIds.add(offer.offerId);
	}
	const ready = deriveReadyWorkUnits(input.state);
	const activeByWorker = activeClaimsByWorker(input.state);
	const selectedByWorker = new Map<string, number>();
	const admissions: SchedulingAdmission[] = [];
	const holds: SchedulingHold[] = readinessHolds(input.state);
	for (const candidate of ready) {
		if (admissions.length >= input.policy.maximumAssignments) {
			holds.push({
				workUnitId: candidate.workUnit.id,
				reason: "capacity_exhausted",
				detail: "Project scheduling policy capacity is exhausted.",
			});
			continue;
		}
		const offer = eligibleOffer({
			candidate,
			offers,
			policy: input.policy,
			observedAt,
			activeByWorker,
			selectedByWorker,
		});
		if (!offer) {
			holds.push({
				workUnitId: candidate.workUnit.id,
				reason: "no_eligible_worker",
				detail: "No current Worker Offer satisfies capability, custody, consent, privacy, budget, isolation, and capacity requirements.",
			});
			continue;
		}
		const assignmentAttemptId = assignmentAttemptIdentity({
			state: input.state,
			candidate,
			offer,
			policy: input.policy,
			sourceBase,
			observedAt,
		});
		const isolationKind = input.policy.isolationPreference.find((kind) =>
			offer.isolationKinds.includes(kind),
		);
		if (!isolationKind) throw new Error("Eligible Worker Offer lost isolation compatibility.");
		const workbench = createWorkbenchBinding({
			assignmentAttemptId,
			workUnitId: candidate.workUnit.id,
			workerId: offer.workerId,
			sourceBase,
			workbenchRoot: input.policy.workbenchRoot,
			isolationKind,
			pathScopes: candidate.workUnit.pathScopes,
			custodyCapabilities: candidate.workUnit.resourceRequirements.custodyRequirements,
		});
		const leaseExpiresAt = new Date(
			Date.parse(observedAt) + input.policy.leaseDurationMs,
		).toISOString();
		const assignment = createScheduledAssignment({
			assignmentAttemptId,
			workGraphDeltaId: candidate.workGraphDeltaId,
			workUnitId: candidate.workUnit.id,
			owningChangeId: candidate.workUnit.owningChangeId,
			workerId: offer.workerId,
			workerOfferId: offer.offerId,
			workerOfferDigest: offer.offerDigest,
			workbenchId: workbench.workbenchId,
			workbenchDigest: workbench.workbenchDigest,
			sourceBase,
			expectedWorkStateDigest: input.state.workStateDigest,
			expectedWorkGraphDigest: input.state.workGraph.graphDigest,
			scopeDigest: scopeDigest(candidate.workUnit),
			budgetDigest: budgetDigest(candidate.workUnit),
			obligationDigest: obligationDigest(candidate.workUnit),
			leaseExpiresAt,
		});
		admissions.push({
			workGraphDeltaId: candidate.workGraphDeltaId,
			workUnit: candidate.workUnit,
			workerOffer: offer,
			workbench,
			assignment,
		});
		selectedByWorker.set(
			offer.workerId,
			(selectedByWorker.get(offer.workerId) ?? 0) + 1,
		);
	}
	const body = toCanonicalJsonValue({
		protocol: SCHEDULING_PLAN_PROTOCOL,
		observedWorkStateDigest: input.state.workStateDigest,
		observedWorkGraphDigest: input.state.workGraph.graphDigest,
		observedAt,
		sourceBase,
		schedulingPolicyDigest: input.policy.policyDigest,
		admissions,
		holds,
	});
	// SAFETY: plan body contains validated canonical scheduling inputs and derived admissions.
	return toCanonicalJsonValue({
		...(body as Record<string, CanonicalJsonValue>),
		planDigest: canonicalJsonDigest(body),
	}) as SchedulingPlan;
}

export function createSchedulingOperationSequence(input: {
	readonly state: ProjectWorkState;
	readonly plan: SchedulingPlan;
	readonly policy: SchedulingPolicy;
	readonly baseSnapshot: BaseSnapshot;
	readonly claimAuthority: AuthorityBinding;
	readonly assignmentAuthority: AuthorityBinding;
	readonly recordedAt: string;
}): SchedulingOperationSequence {
	assertPlanBase(input.state, input.plan, input.policy);
	if (timestamp(input.recordedAt) !== input.plan.observedAt) {
		throw new Error("Scheduling operation time must match observed plan time.");
	}
	const projected = new Map(
		input.state.changes.map((change) => [change.changeId, change]),
	);
	const operations: CanonicalChangeOperation[] = [];
	const assignmentOperationIds: Sha256Digest[] = [];
	for (const admission of input.plan.admissions) {
		const change = projected.get(admission.workUnit.owningChangeId);
		if (!change) throw new Error(`Scheduling Change ${admission.workUnit.owningChangeId} is absent.`);
		const assignment = admission.assignment;
		const offerBinding = schedulingArtifact(
			admission.workerOffer.offerId,
			WORKER_OFFER_SCHEMA_VERSION,
			admission.workerOffer,
		);
		const policyBinding = schedulingArtifact(
			`scheduling-policy:${input.policy.policyDigest.slice("sha256:".length)}`,
			SCHEDULING_POLICY_SCHEMA_VERSION,
			input.policy,
		);
		const claim = createNextChangeOperation(change, {
			changeId: change.changeId,
			kind: "work_unit_claim.acquired",
			baseSnapshot: input.baseSnapshot,
			authorityBinding: input.claimAuthority,
			recordedAt: operationTimestamp(input.recordedAt, operations.length),
			payload: {
				...schedulingCorePayload(assignment),
				expectedWorkStateDigest: assignment.expectedWorkStateDigest,
				expectedWorkGraphDigest: assignment.expectedWorkGraphDigest,
				workerOfferId: assignment.workerOfferId,
				workerOfferDigest: assignment.workerOfferDigest,
				workerOffer: offerBinding,
				schedulingPolicyDigest: input.policy.policyDigest,
				schedulingPolicy: policyBinding,
				leaseExpiresAt: assignment.leaseExpiresAt,
			},
		});
		const afterClaim = reduceChangeOperation(change, claim, {});
		operations.push(claim);
		const workbenchBinding = schedulingArtifact(
			admission.workbench.workbenchId,
			WORKBENCH_SCHEMA_VERSION,
			admission.workbench,
		);
		const assignmentBinding = schedulingArtifact(
			`scheduled-assignment:${assignment.assignmentDigest.slice("sha256:".length)}`,
			SCHEDULED_ASSIGNMENT_SCHEMA_VERSION,
			assignment,
		);
		const dispatched = createNextChangeOperation(afterClaim, {
			changeId: change.changeId,
			kind: "assignment.dispatched",
			baseSnapshot: input.baseSnapshot,
			authorityBinding: input.assignmentAuthority,
			recordedAt: operationTimestamp(input.recordedAt, operations.length),
			payload: {
				claimOperationId: claim.operationId,
				...schedulingCorePayload(assignment),
				workerOfferId: assignment.workerOfferId,
				workerOfferDigest: assignment.workerOfferDigest,
				workbenchDigest: assignment.workbenchDigest,
				workbench: workbenchBinding,
				assignmentDigest: assignment.assignmentDigest,
				assignment: assignmentBinding,
			},
		});
		const afterAssignment = reduceChangeOperation(afterClaim, dispatched, {});
		projected.set(change.changeId, afterAssignment);
		operations.push(dispatched);
		assignmentOperationIds.push(dispatched.operationId);
	}
	return Object.freeze({
		operations,
		projectedChanges: [...projected.values()].sort((left, right) =>
			compareText(left.changeId, right.changeId),
		),
		assignmentOperationIds,
	});
}

const WORKER_OFFER_SCHEMA_VERSION = "1.0.0";
const SCHEDULING_POLICY_SCHEMA_VERSION = "1.0.0";
const WORKBENCH_SCHEMA_VERSION = "1.0.0";
const SCHEDULED_ASSIGNMENT_SCHEMA_VERSION = "1.0.0";

function schedulingCorePayload(assignment: ScheduledAssignment) {
	return {
		workGraphDeltaId: assignment.workGraphDeltaId,
		workUnitId: assignment.workUnitId,
		assignmentAttemptId: assignment.assignmentAttemptId,
		workerId: assignment.workerId,
		workbenchId: assignment.workbenchId,
		sourceBase: assignment.sourceBase,
		scopeDigest: assignment.scopeDigest,
		budgetDigest: assignment.budgetDigest,
		obligationDigest: assignment.obligationDigest,
	};
}

function readinessHolds(state: ProjectWorkState): SchedulingHold[] {
	const holds: SchedulingHold[] = [];
	for (const entry of state.workGraph.workUnits) {
		if (entry.status === "claimed" || entry.status === "assigned") {
			holds.push({
				workUnitId: entry.workUnit.id,
				reason: "active_authority",
				detail: "Work Unit already has active Claim or Assignment authority.",
			});
			continue;
		}
		if (entry.status === "accepted" && !dependenciesComplete(state, entry.workUnit.id)) {
			holds.push({
				workUnitId: entry.workUnit.id,
				reason: "dependency_incomplete",
				detail: "Work Unit dependencies are not completed.",
			});
		}
	}
	return holds.sort((left, right) => compareText(left.workUnitId, right.workUnitId));
}

function eligibleOffer(input: {
	candidate: ReadyWorkUnit;
	offers: readonly WorkerOffer[];
	policy: SchedulingPolicy;
	observedAt: string;
	activeByWorker: ReadonlyMap<string, number>;
	selectedByWorker: ReadonlyMap<string, number>;
}): WorkerOffer | null {
	for (const offer of input.offers) {
		const used = (input.activeByWorker.get(offer.workerId) ?? 0) +
			(input.selectedByWorker.get(offer.workerId) ?? 0);
		if (used >= offer.maximumConcurrentAssignments) continue;
		try {
			assertWorkerOfferMatches(
				offer,
				input.candidate.workUnit.resourceRequirements,
				input.policy,
				input.observedAt,
			);
			return offer;
		} catch {
			continue;
		}
	}
	return null;
}

function assignmentAttemptIdentity(input: {
	state: ProjectWorkState;
	candidate: ReadyWorkUnit;
	offer: WorkerOffer;
	policy: SchedulingPolicy;
	sourceBase: GitObjectId;
	observedAt: string;
}): string {
	const digest = canonicalJsonDigest({
		workStateDigest: input.state.workStateDigest,
		workGraphDigest: input.state.workGraph.graphDigest,
		workGraphDeltaId: input.candidate.workGraphDeltaId,
		workUnitId: input.candidate.workUnit.id,
		workerOfferDigest: input.offer.offerDigest,
		schedulingPolicyDigest: input.policy.policyDigest,
		sourceBase: input.sourceBase,
		observedAt: input.observedAt,
	});
	return `assignment-attempt:${digest.slice("sha256:".length)}`;
}

function assertPlanBase(
	state: ProjectWorkState,
	plan: SchedulingPlan,
	policy: SchedulingPolicy,
): void {
	if (
		plan.observedWorkStateDigest !== state.workStateDigest ||
		plan.observedWorkGraphDigest !== state.workGraph.graphDigest ||
		plan.schedulingPolicyDigest !== policy.policyDigest
	) {
		throw new Error("Scheduling plan base is stale.");
	}
	if (state.observedBase && plan.sourceBase !== state.observedBase.sourceHead) {
		throw new Error("Scheduling source base is stale.");
	}
	const body = toCanonicalJsonValue({
		protocol: plan.protocol,
		observedWorkStateDigest: plan.observedWorkStateDigest,
		observedWorkGraphDigest: plan.observedWorkGraphDigest,
		observedAt: plan.observedAt,
		sourceBase: plan.sourceBase,
		schedulingPolicyDigest: plan.schedulingPolicyDigest,
		admissions: plan.admissions,
		holds: plan.holds,
	});
	if (canonicalJsonDigest(body) !== plan.planDigest) {
		throw new Error("Scheduling plan identity is invalid.");
	}
}

function activeClaimsByWorker(state: ProjectWorkState): Map<string, number> {
	const result = new Map<string, number>();
	for (const change of state.changes) {
		for (const claim of change.workUnitClaims) {
			if (claim.status !== "active") continue;
			result.set(claim.workerId, (result.get(claim.workerId) ?? 0) + 1);
		}
	}
	return result;
}

function dependenciesComplete(state: ProjectWorkState, workUnitId: string): boolean {
	return state.workGraph.dependencyEdges
		.filter((edge) => edge.fromWorkUnitId === workUnitId)
		.every((edge) =>
			state.workGraph.workUnits.some(
				(entry) => entry.workUnit.id === edge.toWorkUnitId && entry.status === "completed",
			),
		);
}

function hasActiveAuthority(state: ProjectWorkState, workUnitId: string): boolean {
	return state.changes.some(
		(change) =>
			change.workUnitClaims.some(
				(claim) => claim.workUnitId === workUnitId && claim.status === "active",
			) ||
			change.assignments.some(
				(assignment) => assignment.workUnitId === workUnitId && assignment.status === "active",
			),
	);
}

function scopeDigest(workUnit: PlanningWorkUnitCandidate): Sha256Digest {
	return canonicalJsonDigest({
		componentRefs: workUnit.componentRefs,
		pathScopes: workUnit.pathScopes,
	});
}

function budgetDigest(workUnit: PlanningWorkUnitCandidate): Sha256Digest {
	return canonicalJsonDigest({
		budgetClass: workUnit.resourceRequirements.budgetClass,
		privacyClass: workUnit.resourceRequirements.privacyClass,
		consentRequirements: workUnit.resourceRequirements.consentRequirements,
		custodyRequirements: workUnit.resourceRequirements.custodyRequirements,
	});
}

function obligationDigest(workUnit: PlanningWorkUnitCandidate): Sha256Digest {
	return canonicalJsonDigest({
		knowledgeEffectIds: workUnit.knowledgeEffectIds,
		unchangedKnowledgeTargets: workUnit.unchangedKnowledgeTargets,
		acceptanceRequirementIds: workUnit.acceptanceRequirementIds,
		verification: workUnit.verification,
	});
}

function operationTimestamp(base: string, offset: number): string {
	return new Date(Date.parse(timestamp(base)) + offset).toISOString();
}

function timestamp(value: string): string {
	if (!Number.isFinite(Date.parse(value))) throw new Error("Scheduling timestamp is invalid.");
	return new Date(Date.parse(value)).toISOString();
}

function gitObjectId(value: string): string {
	if (!/^[0-9a-f]{40}$/u.test(value)) throw new Error("Scheduling sourceBase must be Git object ID.");
	return value;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
