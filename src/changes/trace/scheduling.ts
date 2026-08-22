import type {
	CanonicalChangeOperation,
	CanonicalInlineSemanticArtifact,
	GitObjectId,
} from "./contracts.ts";
import {operationPayload} from "./identity.ts";
import type {ProjectWorkState} from "./state.ts";
import type {PlanningResourceRequirements} from "../../loops/planning/candidate-content.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export const WORKER_OFFER_PROTOCOL = Object.freeze({
	id: "codewiki.worker-offer",
	version: "1.0.0",
} as const);

export const SCHEDULING_POLICY_PROTOCOL = Object.freeze({
	id: "codewiki.scheduling-policy",
	version: "1.0.0",
} as const);

export const WORKBENCH_BINDING_PROTOCOL = Object.freeze({
	id: "codewiki.workbench-binding",
	version: "1.0.0",
} as const);

export const SCHEDULED_ASSIGNMENT_PROTOCOL = Object.freeze({
	id: "codewiki.scheduled-assignment",
	version: "1.0.0",
} as const);

export type WorkbenchIsolationKind = "worktree" | "container";

export interface WorkerOfferInput {
	readonly workerId: string;
	readonly capabilityIds: readonly string[];
	readonly toolIds: readonly string[];
	readonly skillIds: readonly string[];
	readonly custodyCapabilities: readonly string[];
	readonly consentIds: readonly string[];
	readonly privacyClasses: readonly string[];
	readonly budgetClasses: readonly string[];
	readonly isolationKinds: readonly WorkbenchIsolationKind[];
	readonly maximumConcurrentAssignments: number;
	readonly validFrom: string;
	readonly validUntil: string;
}

export type WorkerOffer = CanonicalJsonValue & WorkerOfferInput & {
	readonly protocol: typeof WORKER_OFFER_PROTOCOL;
	readonly offerId: string;
	readonly offerDigest: Sha256Digest;
};

export interface SchedulingPolicyInput {
	readonly maximumAssignments: number;
	readonly leaseDurationMs: number;
	readonly allowedPrivacyClasses: readonly string[];
	readonly allowedBudgetClasses: readonly string[];
	readonly acceptedConsentIds: readonly string[];
	readonly allowedCustodyCapabilities: readonly string[];
	readonly isolationPreference: readonly WorkbenchIsolationKind[];
	readonly workbenchRoot: string;
}

export type SchedulingPolicy = CanonicalJsonValue & SchedulingPolicyInput & {
	readonly protocol: typeof SCHEDULING_POLICY_PROTOCOL;
	readonly policyDigest: Sha256Digest;
};

export type WorkbenchBinding = CanonicalJsonValue & {
	readonly protocol: typeof WORKBENCH_BINDING_PROTOCOL;
	readonly workbenchId: string;
	readonly workbenchDigest: Sha256Digest;
	readonly assignmentAttemptId: string;
	readonly workUnitId: string;
	readonly workerId: string;
	readonly sourceBase: GitObjectId;
	readonly path: string;
	readonly isolation: {
		readonly kind: WorkbenchIsolationKind;
		readonly ref: string;
	};
	readonly pathScopes: readonly string[];
	readonly custodyCapabilities: readonly string[];
};

export type ScheduledAssignment = CanonicalJsonValue & {
	readonly protocol: typeof SCHEDULED_ASSIGNMENT_PROTOCOL;
	readonly assignmentAttemptId: string;
	readonly assignmentDigest: Sha256Digest;
	readonly workGraphDeltaId: Sha256Digest;
	readonly workUnitId: string;
	readonly owningChangeId: string;
	readonly workerId: string;
	readonly workerOfferId: string;
	readonly workerOfferDigest: Sha256Digest;
	readonly workbenchId: string;
	readonly workbenchDigest: Sha256Digest;
	readonly sourceBase: GitObjectId;
	readonly expectedWorkStateDigest: Sha256Digest;
	readonly expectedWorkGraphDigest: Sha256Digest;
	readonly scopeDigest: Sha256Digest;
	readonly budgetDigest: Sha256Digest;
	readonly obligationDigest: Sha256Digest;
	readonly leaseExpiresAt: string;
};

export function createWorkerOffer(input: WorkerOfferInput): WorkerOffer {
	const normalized = {
		protocol: WORKER_OFFER_PROTOCOL,
		workerId: requiredText(input.workerId, "Worker Offer workerId"),
		capabilityIds: uniqueSorted(input.capabilityIds, "Worker Offer capabilities", true),
		toolIds: uniqueSorted(input.toolIds, "Worker Offer tools", true),
		skillIds: uniqueSorted(input.skillIds, "Worker Offer skills"),
		custodyCapabilities: uniqueSorted(
			input.custodyCapabilities,
			"Worker Offer custody capabilities",
			true,
		),
		consentIds: uniqueSorted(input.consentIds, "Worker Offer consent IDs"),
		privacyClasses: uniqueSorted(input.privacyClasses, "Worker Offer privacy classes", true),
		budgetClasses: uniqueSorted(input.budgetClasses, "Worker Offer budget classes", true),
		isolationKinds: normalizedIsolationKinds(input.isolationKinds),
		maximumConcurrentAssignments: positiveInteger(
			input.maximumConcurrentAssignments,
			"Worker Offer maximumConcurrentAssignments",
		),
		validFrom: timestamp(input.validFrom, "Worker Offer validFrom"),
		validUntil: timestamp(input.validUntil, "Worker Offer validUntil"),
	};
	if (Date.parse(normalized.validUntil) <= Date.parse(normalized.validFrom)) {
		throw new Error("Worker Offer validUntil must follow validFrom.");
	}
	const offerDigest = canonicalJsonDigest(normalized);
	// SAFETY: normalized body contains only validated JSON-domain Worker Offer fields.
	return toCanonicalJsonValue({
		...normalized,
		offerId: `worker-offer:${offerDigest.slice("sha256:".length)}`,
		offerDigest,
	}) as WorkerOffer;
}

export function createSchedulingPolicy(input: SchedulingPolicyInput): SchedulingPolicy {
	const normalized = {
		protocol: SCHEDULING_POLICY_PROTOCOL,
		maximumAssignments: positiveInteger(input.maximumAssignments, "Scheduling maximumAssignments"),
		leaseDurationMs: boundedInteger(
			input.leaseDurationMs,
			1_000,
			24 * 60 * 60 * 1_000,
			"Scheduling leaseDurationMs",
		),
		allowedPrivacyClasses: uniqueSorted(
			input.allowedPrivacyClasses,
			"Scheduling allowed privacy classes",
			true,
		),
		allowedBudgetClasses: uniqueSorted(
			input.allowedBudgetClasses,
			"Scheduling allowed budget classes",
			true,
		),
		acceptedConsentIds: uniqueSorted(input.acceptedConsentIds, "Scheduling accepted consent IDs"),
		allowedCustodyCapabilities: uniqueSorted(
			input.allowedCustodyCapabilities,
			"Scheduling custody capabilities",
			true,
		),
		isolationPreference: normalizedIsolationKinds(input.isolationPreference),
		workbenchRoot: normalizedPath(input.workbenchRoot, "Scheduling workbenchRoot"),
	};
	// SAFETY: normalized body contains only validated JSON-domain Scheduling policy fields.
	return toCanonicalJsonValue({
		...normalized,
		policyDigest: canonicalJsonDigest(normalized),
	}) as SchedulingPolicy;
}

export function createWorkbenchBinding(input: {
	readonly assignmentAttemptId: string;
	readonly workUnitId: string;
	readonly workerId: string;
	readonly sourceBase: GitObjectId;
	readonly workbenchRoot: string;
	readonly isolationKind: WorkbenchIsolationKind;
	readonly pathScopes: readonly string[];
	readonly custodyCapabilities: readonly string[];
}): WorkbenchBinding {
	const body = {
		protocol: WORKBENCH_BINDING_PROTOCOL,
		assignmentAttemptId: requiredText(input.assignmentAttemptId, "Workbench assignmentAttemptId"),
		workUnitId: requiredText(input.workUnitId, "Workbench workUnitId"),
		workerId: requiredText(input.workerId, "Workbench workerId"),
		sourceBase: gitObjectId(input.sourceBase, "Workbench sourceBase"),
		path: `${normalizedPath(input.workbenchRoot, "Workbench root")}/${safeSegment(input.workUnitId)}/${safeSegment(input.assignmentAttemptId)}`,
		isolation: {
			kind: input.isolationKind,
			ref: `${input.isolationKind}:${input.assignmentAttemptId}`,
		},
		pathScopes: uniqueSorted(input.pathScopes, "Workbench path scopes", true),
		custodyCapabilities: uniqueSorted(
			input.custodyCapabilities,
			"Workbench custody capabilities",
			true,
		),
	};
	const workbenchDigest = canonicalJsonDigest(body);
	// SAFETY: body contains only validated JSON-domain Workbench fields.
	return toCanonicalJsonValue({
		...body,
		workbenchId: `workbench:${workbenchDigest.slice("sha256:".length)}`,
		workbenchDigest,
	}) as WorkbenchBinding;
}

export function createScheduledAssignment(input: Omit<
	ScheduledAssignment,
	"protocol" | "assignmentDigest"
>): ScheduledAssignment {
	const body = toCanonicalJsonValue({
		protocol: SCHEDULED_ASSIGNMENT_PROTOCOL,
		...input,
	});
	// SAFETY: caller provides typed canonical scheduling bindings; digest closes assignment identity.
	return toCanonicalJsonValue({
		...(body as Record<string, CanonicalJsonValue>),
		assignmentDigest: canonicalJsonDigest(body),
	}) as ScheduledAssignment;
}

export function schedulingArtifact(
	id: string,
	schemaVersion: string,
	artifact: CanonicalJsonValue,
): CanonicalInlineSemanticArtifact {
	const normalized = toCanonicalJsonValue(artifact);
	return {
		id,
		schemaVersion,
		digest: canonicalJsonDigest(normalized),
		artifact: normalized,
	};
}

export function assertWorkerOfferMatches(
	offer: WorkerOffer,
	requirements: PlanningResourceRequirements,
	policy: SchedulingPolicy,
	observedAt: string,
): void {
	assertWorkerOffer(offer);
	assertSchedulingPolicy(policy);
	const instant = Date.parse(timestamp(observedAt, "Scheduling observedAt"));
	if (instant < Date.parse(offer.validFrom) || instant >= Date.parse(offer.validUntil)) {
		throw new Error(`Worker Offer ${offer.offerId} is not valid at scheduling time.`);
	}
	assertSubset(requirements.capabilityIds, offer.capabilityIds, "capabilities");
	assertSubset(requirements.toolIds, offer.toolIds, "tools");
	assertSubset(requirements.skillIds, offer.skillIds, "skills");
	assertSubset(requirements.custodyRequirements, offer.custodyCapabilities, "custody");
	assertSubset(requirements.custodyRequirements, policy.allowedCustodyCapabilities, "policy custody");
	assertSubset(requirements.consentRequirements, offer.consentIds, "worker consent");
	assertSubset(requirements.consentRequirements, policy.acceptedConsentIds, "project consent");
	if (
		!offer.privacyClasses.includes(requirements.privacyClass) ||
		!policy.allowedPrivacyClasses.includes(requirements.privacyClass)
	) {
		throw new Error(`Worker Offer ${offer.offerId} cannot handle privacy class ${requirements.privacyClass}.`);
	}
	if (
		!offer.budgetClasses.includes(requirements.budgetClass) ||
		!policy.allowedBudgetClasses.includes(requirements.budgetClass)
	) {
		throw new Error(`Worker Offer ${offer.offerId} cannot handle budget class ${requirements.budgetClass}.`);
	}
	if (!policy.isolationPreference.some((kind) => offer.isolationKinds.includes(kind))) {
		throw new Error(`Worker Offer ${offer.offerId} has no allowed isolation kind.`);
	}
}

export function assertAcceptedSchedulingOperations(
	state: ProjectWorkState,
	operations: readonly CanonicalChangeOperation[],
): void {
	if (
		operations.some(
			(operation) => operation.body.kind === "work_unit_claim.takeover_recorded",
		)
	) {
		throw new Error("Work Unit Claim takeover requires Project Server recovery scheduling.");
	}
	const claims = operations.filter(
		(operation): operation is CanonicalChangeOperation<"work_unit_claim.acquired"> =>
			operation.body.kind === "work_unit_claim.acquired",
	);
	const assignments = operations.filter(
		(operation): operation is CanonicalChangeOperation<"assignment.dispatched"> =>
			operation.body.kind === "assignment.dispatched",
	);
	if (claims.length === 0 && assignments.length > 0) {
		throw new Error("Assignment dispatch requires atomic Project Server Claim.");
	}
	if (claims.length === 0) return;
	const claimedUnitIds = new Set<string>();
	const selectedByWorker = activeClaimsByWorker(state);
	const selectedByPolicy = new Map<Sha256Digest, number>();
	for (const claim of claims) {
		assertAcceptedSchedulingClaim({
			state,
			claim,
			assignments,
			claimedUnitIds,
			selectedByWorker,
			selectedByPolicy,
		});
	}
}

function assertAcceptedSchedulingClaim(input: {
	readonly state: ProjectWorkState;
	readonly claim: CanonicalChangeOperation<"work_unit_claim.acquired">;
	readonly assignments: readonly CanonicalChangeOperation<"assignment.dispatched">[];
	readonly claimedUnitIds: Set<string>;
	readonly selectedByWorker: Map<string, number>;
	readonly selectedByPolicy: Map<Sha256Digest, number>;
}): void {
	const {state, claim} = input;
	const payload = operationPayload(claim, "work_unit_claim.acquired");
	if (
		payload.expectedWorkStateDigest !== state.workStateDigest ||
		payload.expectedWorkGraphDigest !== state.workGraph.graphDigest
	) {
		throw new Error("Scheduling Claim compare-and-swap failed.");
	}
	const graphUnit = state.workGraph.workUnits.find(
		(entry) => entry.workUnit.id === payload.workUnitId,
	);
	if (
		!graphUnit ||
		graphUnit.deltaId !== payload.workGraphDeltaId ||
		graphUnit.workUnit.owningChangeId !== claim.body.changeId ||
		graphUnit.status !== "accepted"
	) {
		throw new Error(`Work Unit ${payload.workUnitId} is not ready for Claim.`);
	}
	if (
		input.claimedUnitIds.has(payload.workUnitId) ||
		activeClaimExists(state, payload.workUnitId)
	) {
		throw new Error(`Work Unit ${payload.workUnitId} already has active scheduling authority.`);
	}
	assertDependenciesComplete(state, payload.workUnitId);
	const offer = workerOfferFromArtifact(payload.workerOffer);
	const policy = schedulingPolicyFromArtifact(payload.schedulingPolicy);
	assertWorkerOfferMatches(
		offer,
		graphUnit.workUnit.resourceRequirements,
		policy,
		claim.body.recordedAt,
	);
	assertClaimBindings(state, claim, offer, policy);
	const workerCount = input.selectedByWorker.get(offer.workerId) ?? 0;
	if (workerCount >= offer.maximumConcurrentAssignments) {
		throw new Error(`Worker Offer ${offer.offerId} capacity is exhausted.`);
	}
	const policyCount = input.selectedByPolicy.get(policy.policyDigest) ?? 0;
	if (policyCount >= policy.maximumAssignments) {
		throw new Error("Scheduling policy assignment capacity is exhausted.");
	}
	const matchingAssignments = input.assignments.filter((operation) =>
		operationPayload(operation, "assignment.dispatched").claimOperationId ===
		claim.operationId,
	);
	if (matchingAssignments.length !== 1) {
		throw new Error(`Scheduling Claim ${claim.operationId} requires exactly one atomic Assignment.`);
	}
	assertSchedulingAssignment(claim, matchingAssignments[0], offer);
	input.claimedUnitIds.add(payload.workUnitId);
	input.selectedByWorker.set(offer.workerId, workerCount + 1);
	input.selectedByPolicy.set(policy.policyDigest, policyCount + 1);
}

function assertClaimBindings(
	state: ProjectWorkState,
	claim: CanonicalChangeOperation<"work_unit_claim.acquired">,
	offer: WorkerOffer,
	policy: SchedulingPolicy,
): void {
	const payload = operationPayload(claim, "work_unit_claim.acquired");
	const expectedLease = new Date(
		Date.parse(claim.body.recordedAt) + policy.leaseDurationMs,
	).toISOString();
	if (
		offer.offerId !== payload.workerOfferId ||
		offer.offerDigest !== payload.workerOfferDigest ||
		policy.policyDigest !== payload.schedulingPolicyDigest ||
		payload.leaseExpiresAt !== expectedLease ||
		(state.observedBase && payload.sourceBase !== state.observedBase.sourceHead)
	) {
		throw new Error("Scheduling Claim offer, policy, source, or lease binding is invalid.");
	}
}

export function assertWorkerOffer(value: WorkerOffer): void {
	const rebuilt = createWorkerOffer(value);
	if (canonicalJson(rebuilt) !== canonicalJson(value)) {
		throw new Error("Worker Offer identity is invalid.");
	}
}

export function assertSchedulingPolicy(value: SchedulingPolicy): void {
	const rebuilt = createSchedulingPolicy(value);
	if (canonicalJson(rebuilt) !== canonicalJson(value)) {
		throw new Error("Scheduling policy identity is invalid.");
	}
}

function assertSchedulingAssignment(
	claim: CanonicalChangeOperation<"work_unit_claim.acquired">,
	assignment: CanonicalChangeOperation<"assignment.dispatched">,
	offer: WorkerOffer,
): void {
	const claimPayload = operationPayload(claim, "work_unit_claim.acquired");
	const payload = operationPayload(assignment, "assignment.dispatched");
	const workbench = workbenchFromArtifact(payload.workbench);
	const scheduled = scheduledAssignmentFromArtifact(payload.assignment);
	for (const field of [
		"workGraphDeltaId",
		"workUnitId",
		"assignmentAttemptId",
		"workerId",
		"workbenchId",
		"sourceBase",
		"scopeDigest",
		"budgetDigest",
		"obligationDigest",
	] as const) {
		if (payload[field] !== claimPayload[field]) {
			throw new Error(`Scheduling Assignment ${field} does not match Claim.`);
		}
	}
	if (
		assignment.body.changeId !== claim.body.changeId ||
		payload.workerOfferId !== offer.offerId ||
		payload.workerOfferDigest !== offer.offerDigest ||
		payload.workbenchId !== workbench.workbenchId ||
		payload.workbenchDigest !== workbench.workbenchDigest ||
		payload.assignmentDigest !== scheduled.assignmentDigest ||
		scheduled.assignmentAttemptId !== payload.assignmentAttemptId ||
		scheduled.workbenchDigest !== workbench.workbenchDigest
	) {
		throw new Error("Scheduling Assignment artifact binding is invalid.");
	}
}

function workerOfferFromArtifact(binding: CanonicalInlineSemanticArtifact): WorkerOffer {
	assertArtifact(binding, "Worker Offer");
	const offer = binding.artifact as WorkerOffer;
	assertWorkerOffer(offer);
	if (binding.id !== offer.offerId || binding.schemaVersion !== WORKER_OFFER_PROTOCOL.version) {
		throw new Error("Worker Offer artifact binding is invalid.");
	}
	return offer;
}

function schedulingPolicyFromArtifact(binding: CanonicalInlineSemanticArtifact): SchedulingPolicy {
	assertArtifact(binding, "Scheduling policy");
	const policy = binding.artifact as SchedulingPolicy;
	assertSchedulingPolicy(policy);
	if (
		binding.id !== `scheduling-policy:${policy.policyDigest.slice("sha256:".length)}` ||
		binding.schemaVersion !== SCHEDULING_POLICY_PROTOCOL.version
	) {
		throw new Error("Scheduling policy artifact binding is invalid.");
	}
	return policy;
}

function workbenchFromArtifact(binding: CanonicalInlineSemanticArtifact): WorkbenchBinding {
	assertArtifact(binding, "Workbench");
	// SAFETY: artifact digest is checked above; reconstruction validates every Workbench field.
	const workbench = binding.artifact as WorkbenchBinding;
	const rebuilt = createWorkbenchBinding({
		assignmentAttemptId: workbench.assignmentAttemptId,
		workUnitId: workbench.workUnitId,
		workerId: workbench.workerId,
		sourceBase: workbench.sourceBase,
		workbenchRoot: workbench.path.split("/").slice(0, -2).join("/"),
		isolationKind: workbench.isolation.kind,
		pathScopes: workbench.pathScopes,
		custodyCapabilities: workbench.custodyCapabilities,
	});
	if (
		canonicalJson(rebuilt) !== canonicalJson(workbench) ||
		binding.id !== workbench.workbenchId ||
		binding.schemaVersion !== WORKBENCH_BINDING_PROTOCOL.version
	) {
		throw new Error("Workbench identity is invalid.");
	}
	return workbench;
}

function scheduledAssignmentFromArtifact(
	binding: CanonicalInlineSemanticArtifact,
): ScheduledAssignment {
	assertArtifact(binding, "Scheduled Assignment");
	// SAFETY: artifact digest is checked above; reconstruction validates assignment identity.
	const assignment = binding.artifact as ScheduledAssignment;
	const rebuilt = createScheduledAssignment({
		assignmentAttemptId: assignment.assignmentAttemptId,
		workGraphDeltaId: assignment.workGraphDeltaId,
		workUnitId: assignment.workUnitId,
		owningChangeId: assignment.owningChangeId,
		workerId: assignment.workerId,
		workerOfferId: assignment.workerOfferId,
		workerOfferDigest: assignment.workerOfferDigest,
		workbenchId: assignment.workbenchId,
		workbenchDigest: assignment.workbenchDigest,
		sourceBase: assignment.sourceBase,
		expectedWorkStateDigest: assignment.expectedWorkStateDigest,
		expectedWorkGraphDigest: assignment.expectedWorkGraphDigest,
		scopeDigest: assignment.scopeDigest,
		budgetDigest: assignment.budgetDigest,
		obligationDigest: assignment.obligationDigest,
		leaseExpiresAt: assignment.leaseExpiresAt,
	});
	if (
		canonicalJson(rebuilt) !== canonicalJson(assignment) ||
		binding.id !== `scheduled-assignment:${assignment.assignmentDigest.slice("sha256:".length)}` ||
		binding.schemaVersion !== SCHEDULED_ASSIGNMENT_PROTOCOL.version
	) {
		throw new Error("Scheduled Assignment identity is invalid.");
	}
	return assignment;
}

function assertArtifact(binding: CanonicalInlineSemanticArtifact, label: string): void {
	if (binding.digest !== canonicalJsonDigest(binding.artifact)) {
		throw new Error(`${label} artifact digest is invalid.`);
	}
}

function assertDependenciesComplete(state: ProjectWorkState, workUnitId: string): void {
	for (const edge of state.workGraph.dependencyEdges) {
		if (edge.fromWorkUnitId !== workUnitId) continue;
		const dependency = state.workGraph.workUnits.find(
			(entry) => entry.workUnit.id === edge.toWorkUnitId,
		);
		if (dependency?.status !== "completed") {
			throw new Error(`Work Unit ${workUnitId} dependency ${edge.toWorkUnitId} is incomplete.`);
		}
	}
}

function activeClaimsByWorker(state: ProjectWorkState): Map<string, number> {
	const counts = new Map<string, number>();
	for (const change of state.changes) {
		for (const claim of change.workUnitClaims) {
			if (claim.status !== "active") continue;
			counts.set(claim.workerId, (counts.get(claim.workerId) ?? 0) + 1);
		}
	}
	return counts;
}

function activeClaimExists(state: ProjectWorkState, workUnitId: string): boolean {
	return state.changes.some((change) =>
		change.workUnitClaims.some(
			(claim) => claim.workUnitId === workUnitId && claim.status === "active",
		),
	);
}

function assertSubset(
	required: readonly string[],
	available: readonly string[],
	label: string,
): void {
	const missing = required.filter((value) => !available.includes(value));
	if (missing.length > 0) throw new Error(`Scheduling ${label} missing: ${missing.join(", ")}.`);
}

function normalizedIsolationKinds(values: readonly WorkbenchIsolationKind[]): WorkbenchIsolationKind[] {
	const normalized = uniqueSorted(values, "Isolation kinds", true);
	if (normalized.some((value) => value !== "worktree" && value !== "container")) {
		throw new Error("Isolation kind is invalid.");
	}
	return normalized as WorkbenchIsolationKind[];
}

function uniqueSorted(values: readonly string[], label: string, nonEmpty = false): string[] {
	if (!Array.isArray(values) || (nonEmpty && values.length === 0)) {
		throw new Error(`${label} is invalid.`);
	}
	const normalized = values.map((value) => requiredText(value, label)).sort(compareText);
	if (new Set(normalized).size !== normalized.length) throw new Error(`${label} must be unique.`);
	return normalized;
}

function requiredText(value: string, label: string): string {
	if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
	return value.trim();
}

function timestamp(value: string, label: string): string {
	if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} is invalid.`);
	return new Date(Date.parse(value)).toISOString();
}

function positiveInteger(value: number, label: string): number {
	if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be positive integer.`);
	return value;
}

function boundedInteger(
	value: number,
	minimum: number,
	maximum: number,
	label: string,
): number {
	if (!Number.isInteger(value) || value < minimum || value > maximum) {
		throw new Error(`${label} must be integer between ${minimum} and ${maximum}.`);
	}
	return value;
}

function normalizedPath(value: string, label: string): string {
	const path = requiredText(value, label).replace(/\\/gu, "/").replace(/\/+$/u, "");
	if (path.includes("..") || !path.startsWith("/")) {
		throw new Error(`${label} must be absolute normalized path without traversal.`);
	}
	return path;
}

function gitObjectId(value: string, label: string): string {
	if (!/^[0-9a-f]{40}$/u.test(value)) throw new Error(`${label} must be Git object ID.`);
	return value;
}

function safeSegment(value: string): string {
	return value.replace(/[^A-Za-z0-9._-]/gu, "-");
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
