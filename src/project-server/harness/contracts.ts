import {
	assertSha256Digest,
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export const HARNESS_OBSERVER_PROJECTION_PROTOCOL = Object.freeze({
	id: "codewiki.harness-observer-projection",
	version: "1.0.0",
	maxExceptionalItems: 32,
	maxReportRefs: 64,
} as const);

export type HarnessProducerLoop = "decision" | "planning";
export type HarnessObservedStage =
	| "decision"
	| "planning"
	| "implementation"
	| "review";

export interface HarnessWorkUnitObservation {
	readonly workUnitId: string;
	readonly status: "queued" | "running" | "passed" | "failed" | "stopped" | "conflicted";
	readonly reportRef?: string;
	readonly failureCode?: string;
}

export interface HarnessReviewObservation {
	readonly status: "not-ready" | "running" | "passed" | "failed" | "stopped";
	readonly aggregateRef?: string;
	readonly gateReportRef?: string;
	readonly routeBack?: HarnessProducerLoop | "implementation";
	readonly relevantResultRefs?: readonly string[];
}

export interface HarnessObserverProjection {
	readonly protocolId: typeof HARNESS_OBSERVER_PROJECTION_PROTOCOL.id;
	readonly protocolVersion: typeof HARNESS_OBSERVER_PROJECTION_PROTOCOL.version;
	readonly changeRevisionId: Sha256Digest;
	readonly workStateDigest: Sha256Digest;
	readonly observedStage: HarnessObservedStage;
	readonly workUnits: Readonly<{
		queued: number;
		running: number;
		passed: number;
		failed: number;
		stopped: number;
		conflicted: number;
	}>;
	readonly exceptionalWorkUnits: readonly HarnessWorkUnitObservation[];
	readonly review: HarnessReviewObservation;
	readonly reportRefs: readonly string[];
	readonly projectionDigest: Sha256Digest;
}

export interface CreateHarnessObserverProjectionInput {
	readonly changeRevisionId: Sha256Digest;
	readonly workStateDigest: Sha256Digest;
	readonly observedStage: HarnessObservedStage;
	readonly workUnits: readonly HarnessWorkUnitObservation[];
	readonly review: HarnessReviewObservation;
}

export interface HarnessInteractionBinding {
	readonly interactionId: string;
	readonly continuityKey: string;
	readonly producerLoop: HarnessProducerLoop;
	readonly sessionId: string;
	readonly sessionHead: number;
	readonly sessionHeadDigest: Sha256Digest | null;
	readonly contextSnapshotDigest: Sha256Digest;
	readonly observerProjectionDigest: Sha256Digest;
	readonly bindingDigest: Sha256Digest;
}

export interface HarnessCandidateSubmission {
	readonly interactionBindingDigest: Sha256Digest;
	readonly producerLoop: HarnessProducerLoop;
	readonly candidateDigest: Sha256Digest;
	readonly runRequestDigest: Sha256Digest;
	readonly runReceiptDigest: Sha256Digest;
	readonly expectedWorkStateDigest: Sha256Digest;
	readonly submissionDigest: Sha256Digest;
}

/** Build only compact current observations; successful report bodies stay out. */
export function createHarnessObserverProjection(
	input: CreateHarnessObserverProjectionInput,
): HarnessObserverProjection {
	assertSha256Digest(input.changeRevisionId, "Harness observation Change revision digest");
	assertSha256Digest(input.workStateDigest, "Harness observation WorkState digest");
	if (!["decision", "planning", "implementation", "review"].includes(input.observedStage)) {
		throw new Error("Harness observed stage is invalid.");
	}
	const units = input.workUnits.map(normalizeWorkUnit).sort((left, right) =>
		left.workUnitId.localeCompare(right.workUnitId),
	);
	const exceptionalWorkUnits = units.filter((unit) =>
		["failed", "stopped", "conflicted"].includes(unit.status),
	);
	if (exceptionalWorkUnits.length > HARNESS_OBSERVER_PROJECTION_PROTOCOL.maxExceptionalItems) {
		throw new Error("Harness observer projection exceeds exceptional Work Unit limit.");
	}
	const review = normalizeReview(input.review);
	const reportRefs = uniqueSorted([
		...exceptionalWorkUnits.flatMap((unit) => unit.reportRef ? [unit.reportRef] : []),
		...(review.gateReportRef ? [review.gateReportRef] : []),
		...(review.relevantResultRefs ?? []),
	]);
	if (reportRefs.length > HARNESS_OBSERVER_PROJECTION_PROTOCOL.maxReportRefs) {
		throw new Error("Harness observer projection exceeds report reference limit.");
	}
	const counts = Object.freeze({
		queued: count(units, "queued"),
		running: count(units, "running"),
		passed: count(units, "passed"),
		failed: count(units, "failed"),
		stopped: count(units, "stopped"),
		conflicted: count(units, "conflicted"),
	});
	const body = {
		protocolId: HARNESS_OBSERVER_PROJECTION_PROTOCOL.id,
		protocolVersion: HARNESS_OBSERVER_PROJECTION_PROTOCOL.version,
		changeRevisionId: input.changeRevisionId,
		workStateDigest: input.workStateDigest,
		observedStage: input.observedStage,
		workUnits: counts,
		exceptionalWorkUnits: Object.freeze(exceptionalWorkUnits),
		review,
		reportRefs: Object.freeze(reportRefs),
	};
	return Object.freeze({...body, projectionDigest: canonicalJsonDigest(body)});
}

export function createHarnessInteractionBinding(input: {
	readonly interactionId: string;
	readonly producerLoop: HarnessProducerLoop;
	readonly sessionId: string;
	readonly sessionHead: number;
	readonly sessionHeadDigest: Sha256Digest | null;
	readonly contextSnapshotDigest: Sha256Digest;
	readonly observerProjection: HarnessObserverProjection;
}): HarnessInteractionBinding {
	const interactionId = identifier(input.interactionId, "Harness interaction ID");
	const sessionId = identifier(input.sessionId, "Harness Session ID");
	if (!Number.isSafeInteger(input.sessionHead) || input.sessionHead < 0) {
		throw new Error("Harness Session head is invalid.");
	}
	if ((input.sessionHead === 0) !== (input.sessionHeadDigest === null)) {
		throw new Error("Harness Session head digest does not match its sequence.");
	}
	if (input.sessionHeadDigest) assertSha256Digest(input.sessionHeadDigest, "Harness Session head digest");
	assertSha256Digest(input.contextSnapshotDigest, "Harness context snapshot digest");
	assertHarnessObserverProjection(input.observerProjection);
	const continuityKey = `${input.producerLoop}:${interactionId}`;
	const body = {
		interactionId,
		continuityKey,
		producerLoop: input.producerLoop,
		sessionId,
		sessionHead: input.sessionHead,
		sessionHeadDigest: input.sessionHeadDigest,
		contextSnapshotDigest: input.contextSnapshotDigest,
		observerProjectionDigest: input.observerProjection.projectionDigest,
	};
	return Object.freeze({...body, bindingDigest: canonicalJsonDigest(body)});
}

export function createHarnessCandidateSubmission(input: {
	readonly interaction: HarnessInteractionBinding;
	readonly producerLoop: HarnessProducerLoop;
	readonly candidateDigest: Sha256Digest;
	readonly runRequestDigest: Sha256Digest;
	readonly runReceiptDigest: Sha256Digest;
	readonly expectedWorkStateDigest: Sha256Digest;
}): HarnessCandidateSubmission {
	assertHarnessInteractionBinding(input.interaction);
	if (input.producerLoop !== input.interaction.producerLoop) {
		throw new Error("Harness submission loop does not match interaction binding.");
	}
	for (const [label, digest] of [
		["Candidate", input.candidateDigest],
		["Run Request", input.runRequestDigest],
		["Run Receipt", input.runReceiptDigest],
		["expected WorkState", input.expectedWorkStateDigest],
	] as const) assertSha256Digest(digest, `Harness ${label} digest`);
	const body = {
		interactionBindingDigest: input.interaction.bindingDigest,
		producerLoop: input.producerLoop,
		candidateDigest: input.candidateDigest,
		runRequestDigest: input.runRequestDigest,
		runReceiptDigest: input.runReceiptDigest,
		expectedWorkStateDigest: input.expectedWorkStateDigest,
	};
	return Object.freeze({...body, submissionDigest: canonicalJsonDigest(body)});
}

export function assertHarnessObserverProjection(value: HarnessObserverProjection): void {
	if (value.protocolId !== HARNESS_OBSERVER_PROJECTION_PROTOCOL.id ||
		value.protocolVersion !== HARNESS_OBSERVER_PROJECTION_PROTOCOL.version) {
		throw new Error("Harness observer projection protocol binding is invalid.");
	}
	const recreated = createHarnessObserverProjection({
		changeRevisionId: value.changeRevisionId,
		workStateDigest: value.workStateDigest,
		observedStage: value.observedStage,
		workUnits: [
			...statusPlaceholders(value.workUnits.queued, "queued"),
			...statusPlaceholders(value.workUnits.running, "running"),
			...statusPlaceholders(value.workUnits.passed, "passed"),
			...value.exceptionalWorkUnits,
		],
		review: value.review,
	});
	// Placeholder recreation cannot preserve IDs for coalesced successful units;
	// exact identity therefore validates directly over the persisted body.
	const {projectionDigest, ...body} = value;
	assertSha256Digest(projectionDigest, "Harness observer projection digest");
	if (canonicalJsonDigest(body) !== projectionDigest || recreated.reportRefs.join("\0") !== value.reportRefs.join("\0")) {
		throw new Error("Harness observer projection digest is invalid.");
	}
}

export function assertHarnessInteractionBinding(value: HarnessInteractionBinding): void {
	const {bindingDigest, ...body} = value;
	assertSha256Digest(bindingDigest, "Harness interaction binding digest");
	if (canonicalJsonDigest(body) !== bindingDigest || value.continuityKey !== `${value.producerLoop}:${value.interactionId}`) {
		throw new Error("Harness interaction binding is invalid.");
	}
}

function normalizeWorkUnit(value: HarnessWorkUnitObservation): HarnessWorkUnitObservation {
	const workUnitId = identifier(value.workUnitId, "Harness Work Unit ID");
	if (!["queued", "running", "passed", "failed", "stopped", "conflicted"].includes(value.status)) {
		throw new Error("Harness Work Unit status is invalid.");
	}
	if (value.status === "passed" && (value.reportRef || value.failureCode)) {
		throw new Error("Passing Harness Work Unit observation must remain coalesced.");
	}
	return Object.freeze({
		workUnitId,
		status: value.status,
		...(value.reportRef ? {reportRef: text(value.reportRef, "Harness report ref")} : {}),
		...(value.failureCode ? {failureCode: text(value.failureCode, "Harness failure code")} : {}),
	});
}

function normalizeReview(value: HarnessReviewObservation): HarnessReviewObservation {
	if (!["not-ready", "running", "passed", "failed", "stopped"].includes(value.status)) {
		throw new Error("Harness Review status is invalid.");
	}
	const routeBack = value.routeBack;
	if (routeBack && !["decision", "planning", "implementation"].includes(routeBack)) {
		throw new Error("Harness Review route-back is invalid.");
	}
	const relevantResultRefs = uniqueSorted(value.relevantResultRefs ?? []);
	if (relevantResultRefs.length > 0 && routeBack !== "decision" && routeBack !== "planning") {
		throw new Error("Harness receives exact Review Results only when routed to Decision or Planning.");
	}
	return Object.freeze({
		status: value.status,
		...(value.aggregateRef ? {aggregateRef: text(value.aggregateRef, "Harness aggregate ref")} : {}),
		...(value.gateReportRef ? {gateReportRef: text(value.gateReportRef, "Harness Gate report ref")} : {}),
		...(routeBack ? {routeBack} : {}),
		...(relevantResultRefs.length ? {relevantResultRefs: Object.freeze(relevantResultRefs)} : {}),
	});
}

function count(values: readonly HarnessWorkUnitObservation[], status: HarnessWorkUnitObservation["status"]): number {
	return values.filter((value) => value.status === status).length;
}

function statusPlaceholders(countValue: number, status: HarnessWorkUnitObservation["status"]): HarnessWorkUnitObservation[] {
	if (!Number.isSafeInteger(countValue) || countValue < 0) throw new Error("Harness Work Unit count is invalid.");
	return Array.from({length: countValue}, (_, index) => ({workUnitId: `coalesced-${status}-${index}`, status}));
}

function uniqueSorted(values: readonly string[]): string[] {
	return [...new Set(values.map((value) => text(value, "Harness report ref")))].sort((left, right) => left.localeCompare(right));
}

function identifier(value: unknown, field: string): string {
	if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value)) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}

function text(value: unknown, field: string): string {
	if (typeof value !== "string" || value.length === 0 || value.length > 512 || value.trim() !== value) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}
