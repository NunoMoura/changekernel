import {
	createGateRunner,
	type CheckExecutor,
	type CheckInputResolver,
	type GateRunnerLimits,
} from "../../checks/runner.ts";
import {
	createCheckPackSnapshot,
	packagedChecks,
	type CheckPackSnapshot,
} from "../../checks/packs/contracts.ts";
import {checkSubjectFromCandidate} from "../../checks/identity.ts";
import type {
	CheckResult,
	GateReport,
	GateStopReason,
} from "../../checks/contracts.ts";
import {createGateReport} from "../../checks/results.ts";
import type {CheckResultCache} from "../../checks/cache.ts";
import type {EvidenceRecord} from "../../evidence/contracts.ts";
import {ACTIVE_CHANGE_COMPATIBILITY_CHECK_ID} from "../../loops/decision/accepted-active-changes.ts";
import type {DecisionCandidate} from "../../loops/decision/candidate.ts";
import type {PlanningCandidate} from "../../loops/planning/candidate.ts";
import {
	admitReviewEvidence,
	normalizeReviewFailureOwnership,
	reviewFeedbackFromGate,
	reviewSubjectFromAttempt,
	type ReviewAttempt,
	type ReviewEvidenceSubmission,
	type ReviewFailureOwnership,
	type ReviewFeedbackItem,
	type ReviewLifecycleTransition,
	type ReviewProviderReceiptBinding,
} from "../../loops/review/contracts.ts";
import {
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {evidenceInputResolver} from "./evidence-input.ts";

export interface DecisionGateEvidenceCollector {
	collect(input: {
		readonly candidate: DecisionCandidate;
		readonly changeRef: string;
		readonly signal: AbortSignal;
	}): readonly EvidenceRecord[] | Promise<readonly EvidenceRecord[]>;
}

export interface CreateDecisionGateInput {
	readonly packSnapshot?: CheckPackSnapshot;
	readonly executors?: readonly CheckExecutor[];
	readonly inputResolver?: CheckInputResolver;
	readonly evidenceCollectors?: readonly DecisionGateEvidenceCollector[];
	readonly stoppedReason?: GateStopReason;
	readonly cache?: CheckResultCache;
	readonly limits?: Partial<GateRunnerLimits>;
}

export interface RunDecisionGateInput {
	readonly candidate: DecisionCandidate;
	readonly changeRef: string;
	readonly evidenceRecords?: readonly EvidenceRecord[];
	readonly signal?: AbortSignal;
}

export type DecisionLifecycleTransition = Readonly<{
	readonly schemaVersion: "1.0.0";
	readonly candidateDigest: Sha256Digest;
	readonly gateReportDigest: Sha256Digest;
	readonly target:
		| "planning"
		| "decision"
		| "terminal"
		| "deferred"
		| "preserve_state";
	readonly reasonCode: string;
	readonly requestedDisposition: DecisionCandidate["content"]["disposition"];
	readonly transitionDigest: Sha256Digest;
}>;

export interface DecisionGateRun {
	readonly candidate: DecisionCandidate;
	readonly packSnapshot: CheckPackSnapshot;
	readonly report: GateReport;
	readonly transition: DecisionLifecycleTransition;
	readonly collectedEvidenceRecords: readonly EvidenceRecord[];
}

export interface CreatePlanningGateInput {
	readonly packSnapshot?: CheckPackSnapshot;
	readonly executors?: readonly CheckExecutor[];
	readonly inputResolver?: CheckInputResolver;
	readonly stoppedReason?: GateStopReason;
	readonly cache?: CheckResultCache;
	readonly limits?: Partial<GateRunnerLimits>;
}

export interface RunPlanningGateInput {
	readonly candidate: PlanningCandidate;
	readonly evidenceRecords?: readonly EvidenceRecord[];
	readonly signal?: AbortSignal;
}

export type PlanningLifecycleTransition = Readonly<{
	readonly schemaVersion: "1.0.0";
	readonly candidateDigest: Sha256Digest;
	readonly gateReportDigest: Sha256Digest;
	readonly target: "implementation" | "planning" | "preserve_state";
	readonly reasonCode: string;
	readonly transitionDigest: Sha256Digest;
}>;

export interface PlanningGateRun {
	readonly candidate: PlanningCandidate;
	readonly packSnapshot: CheckPackSnapshot;
	readonly report: GateReport;
	readonly transition: PlanningLifecycleTransition;
}

export interface CreateReviewGateInput {
	readonly packSnapshot: CheckPackSnapshot;
	readonly executors?: readonly CheckExecutor[];
	readonly inputResolver?: CheckInputResolver;
	readonly stoppedReason?: GateStopReason;
	readonly cache?: CheckResultCache;
	readonly limits?: Partial<GateRunnerLimits>;
	readonly classifyFailure?: (
		attempt: ReviewAttempt,
		result: CheckResult,
	) => Omit<ReviewFailureOwnership, "resultDigest">;
}

export interface RunReviewGateInput {
	readonly attempt: ReviewAttempt;
	readonly evidence: readonly ReviewEvidenceSubmission[];
	readonly providerReceipts: readonly ReviewProviderReceiptBinding[];
	readonly signal?: AbortSignal;
}

export type {ReviewLifecycleTransition} from "../../loops/review/contracts.ts";

export interface ReviewGateRun {
	readonly attempt: ReviewAttempt;
	readonly packSnapshot: CheckPackSnapshot;
	readonly evidenceRecords: readonly EvidenceRecord[];
	readonly report: GateReport;
	readonly feedback: readonly ReviewFeedbackItem[];
	readonly transition: ReviewLifecycleTransition;
}

export function createDecisionGate(input: CreateDecisionGateInput = {}): Readonly<{
	run(runInput: RunDecisionGateInput): Promise<DecisionGateRun>;
}> {
	const packSnapshot =
		input.packSnapshot ?? createCheckPackSnapshot({stage: "decision", packs: []});
	if (packSnapshot.stage !== "decision") {
		throw new Error("Decision Gate requires a Decision Check Pack snapshot.");
	}
	return Object.freeze({
		async run(runInput: RunDecisionGateInput): Promise<DecisionGateRun> {
			assertRunInput(runInput);
			const subject = checkSubjectFromCandidate(runInput.candidate);
			const requiredCompatibilityCheck = packagedChecks(packSnapshot).find(
				(check) => check.checkId === ACTIVE_CHANGE_COMPATIBILITY_CHECK_ID,
			);
			const compatibilityStopReason =
				runInput.candidate.content.acceptedActiveChanges.changes.length > 0 &&
				(!requiredCompatibilityCheck ||
					requiredCompatibilityCheck.definition.implementation.kind !== "model")
					? {
							code: "malformed_check" as const,
							message:
								"When accepted active Changes exist, Decision requires active_change_compatibility as a Model Check.",
							checkId: ACTIVE_CHANGE_COMPATIBILITY_CHECK_ID,
						}
					: undefined;
			const stoppedReason = input.stoppedReason ?? compatibilityStopReason;
			if (stoppedReason) {
				const report = createGateReport({
					snapshot: packSnapshot,
					subjectDigest: subject.digest,
					results: [],
					executions: [],
					stoppedReason,
				});
				return Object.freeze({
					candidate: runInput.candidate,
					packSnapshot,
					report,
					transition: deriveDecisionLifecycleTransition(runInput.candidate, report),
					collectedEvidenceRecords: Object.freeze([]),
				});
			}
			const signal = runInput.signal ?? new AbortController().signal;
			const collectedEvidenceRecords = (
				await Promise.all(
					(input.evidenceCollectors ?? []).map((collector) =>
						collector.collect({
							candidate: runInput.candidate,
							changeRef: runInput.changeRef,
							signal,
						}),
					),
				)
			).flat();
			const evidenceRecords = [
				...(runInput.evidenceRecords ?? []),
				...collectedEvidenceRecords,
			];
			const resolver = evidenceInputResolver({
				evidenceRecords,
				fallback: input.inputResolver,
			});
			const runner = createGateRunner({
				executors: input.executors,
				inputResolver: resolver,
				cache: input.cache,
				limits: input.limits,
			});
			const report = await runner.run({
				subject,
				snapshot: packSnapshot,
				signal: runInput.signal,
			});
			return Object.freeze({
				candidate: runInput.candidate,
				packSnapshot,
				report,
				transition: deriveDecisionLifecycleTransition(runInput.candidate, report),
				collectedEvidenceRecords: Object.freeze(collectedEvidenceRecords),
			});
		},
	});
}

export function createPlanningGate(input: CreatePlanningGateInput = {}): Readonly<{
	run(runInput: RunPlanningGateInput): Promise<PlanningGateRun>;
}> {
	const packSnapshot = input.packSnapshot ?? createCheckPackSnapshot({stage: "planning", packs: []});
	if (packSnapshot.stage !== "planning") {
		throw new Error("Planning Gate requires Planning Check Pack snapshot.");
	}
	return Object.freeze({
		async run(runInput: RunPlanningGateInput): Promise<PlanningGateRun> {
			if (runInput.candidate.loop !== "planning") {
				throw new Error("Planning Gate requires Planning Candidate.");
			}
			const subject = checkSubjectFromCandidate(runInput.candidate);
			const report = input.stoppedReason
				? createGateReport({
						snapshot: packSnapshot,
						subjectDigest: subject.digest,
						results: [],
						executions: [],
						stoppedReason: input.stoppedReason,
					})
				: await createGateRunner({
						executors: input.executors,
						inputResolver: evidenceInputResolver({
							evidenceRecords: runInput.evidenceRecords ?? [],
							fallback: input.inputResolver,
						}),
						cache: input.cache,
						limits: input.limits,
					}).run({subject, snapshot: packSnapshot, signal: runInput.signal});
			return Object.freeze({
				candidate: runInput.candidate,
				packSnapshot,
				report,
				transition: derivePlanningLifecycleTransition(runInput.candidate, report),
			});
		},
	});
}

export function createReviewGate(input: CreateReviewGateInput): Readonly<{
	run(runInput: RunReviewGateInput): Promise<ReviewGateRun>;
}> {
	if (input.packSnapshot.stage !== "review") {
		throw new Error("Review Gate requires a Review Check Pack snapshot.");
	}
	return Object.freeze({
		async run(runInput: RunReviewGateInput): Promise<ReviewGateRun> {
			assertReviewGateRunInput(runInput);
			const subject = reviewSubjectFromAttempt(runInput.attempt);
			if (
				runInput.attempt.checkPackSnapshotDigest !==
				input.packSnapshot.checkPackDigest
			) {
				throw new Error("Review attempt Check Pack snapshot is stale.");
			}
			const evidenceRecords = admitReviewEvidence({
				attempt: runInput.attempt,
				evidence: runInput.evidence,
				providerReceipts: runInput.providerReceipts,
			});
			const report = input.stoppedReason
				? createGateReport({
						snapshot: input.packSnapshot,
						subjectDigest: subject.digest,
						results: [],
						executions: [],
						stoppedReason: input.stoppedReason,
					})
				: await createGateRunner({
						executors: input.executors,
						inputResolver: evidenceInputResolver({
							evidenceRecords,
							fallback: input.inputResolver,
						}),
						cache: input.cache,
						limits: input.limits,
					}).run({
						subject,
						snapshot: input.packSnapshot,
						signal: runInput.signal,
					});
			const failureOwnership = normalizeReviewFailureOwnership({
				attempt: runInput.attempt,
				report,
				ownership: input.classifyFailure
					? report.results
							.filter((result) => result.status === "failed")
							.map((result) => ({
								resultDigest: result.resultDigest,
								...input.classifyFailure!(runInput.attempt, result),
							}))
					: undefined,
			});
			return Object.freeze({
				attempt: runInput.attempt,
				packSnapshot: input.packSnapshot,
				evidenceRecords,
				report,
				feedback: reviewFeedbackFromGate({attempt: runInput.attempt, report}),
				transition: deriveReviewLifecycleTransition(
					runInput.attempt,
					report,
					failureOwnership,
				),
			});
		},
	});
}

function assertReviewGateRunInput(input: RunReviewGateInput): void {
	const unsupported = Object.keys(input).filter(
		(key) => !["attempt", "evidence", "providerReceipts", "signal"].includes(key),
	);
	if (unsupported.length > 0) {
		throw new Error(
			`Review Gate input has unsupported fields: ${unsupported.join(", ")}.`,
		);
	}
	if (!Array.isArray(input.evidence) || !Array.isArray(input.providerReceipts)) {
		throw new Error("Review Gate Evidence and provider receipts must be arrays.");
	}
}

export function derivePlanningLifecycleTransition(
	candidate: PlanningCandidate,
	report: GateReport,
): PlanningLifecycleTransition {
	if (report.stage !== "planning" || report.subjectDigest !== candidate.digest) {
		throw new Error("Planning Gate Report identity does not match Candidate.");
	}
	let selection: {
		target: PlanningLifecycleTransition["target"];
		reasonCode: string;
	};
	if (report.status === "passed") {
		selection = {target: "implementation", reasonCode: "planning_accepted"};
	} else if (report.status === "failed") {
		selection = {target: "planning", reasonCode: "planning_checks_failed"};
	} else {
		selection = {
			target: "preserve_state",
			reasonCode: report.stoppedReason?.code ?? "gate_stopped",
		};
	}
	const body = {
		schemaVersion: "1.0.0" as const,
		candidateDigest: candidate.digest,
		gateReportDigest: report.reportDigest,
		...selection,
	};
	// SAFETY: body contains exact Planning transition fields plus its canonical digest.
	return toCanonicalJsonValue({
		...body,
		transitionDigest: canonicalJsonDigest(body),
	}) as unknown as PlanningLifecycleTransition;
}

export function deriveReviewLifecycleTransition(
	attempt: ReviewAttempt,
	report: GateReport,
	ownership?: readonly ReviewFailureOwnership[],
): ReviewLifecycleTransition {
	if (
		report.stage !== "review" ||
		report.subjectDigest !== reviewSubjectFromAttempt(attempt).digest
	) {
		throw new Error("Review Gate Report identity does not match Review attempt.");
	}
	const failureOwnership = normalizeReviewFailureOwnership({
		attempt,
		report,
		ownership,
	});
	let selection: Pick<ReviewLifecycleTransition, "target" | "reasonCode">;
	if (report.status === "passed") {
		selection = {target: "guarded_delivery", reasonCode: "review_passed"};
	} else if (report.status === "stopped") {
		selection = {
			target: "preserve_state",
			reasonCode: report.stoppedReason?.code ?? "gate_stopped",
		};
	} else if (failureOwnership.some((entry) => entry.owner === "decision")) {
		selection = {target: "decision", reasonCode: "review_meaning_defect"};
	} else if (failureOwnership.some((entry) => entry.owner === "planning")) {
		selection = {
			target: "planning_amendment",
			reasonCode: "review_decomposition_defect",
		};
	} else {
		selection = {target: "implementation", reasonCode: "review_unit_defect"};
	}
	const affectedWorkUnitIds = [
		...new Set(failureOwnership.flatMap((entry) => entry.affectedWorkUnitIds)),
	].sort(compareText);
	const body = {
		schemaVersion: "2.0.0" as const,
		reviewAttemptDigest: attempt.attemptDigest,
		aggregateDigest: attempt.aggregateDigest,
		gateReportDigest: report.reportDigest,
		...selection,
		failureOwnership,
		affectedWorkUnitIds,
	};
	// SAFETY: normalized ownership and fixed routing produce exact transition fields.
	return toCanonicalJsonValue({
		...body,
		transitionDigest: canonicalJsonDigest(body),
	}) as unknown as ReviewLifecycleTransition;
}

export function deriveDecisionLifecycleTransition(
	candidate: DecisionCandidate,
	report: GateReport,
): DecisionLifecycleTransition {
	if (report.stage !== "decision" || report.subjectDigest !== candidate.digest) {
		throw new Error("Decision Gate Report identity does not match Candidate.");
	}
	const selection = decisionLifecycleSelection(candidate, report);
	const body = {
		schemaVersion: "1.0.0" as const,
		candidateDigest: candidate.digest,
		gateReportDigest: report.reportDigest,
		target: selection.target,
		reasonCode: selection.reasonCode,
		requestedDisposition: candidate.content.disposition,
	};
	// SAFETY: body contains exact Decision transition fields plus its canonical digest.
	return toCanonicalJsonValue({
		...body,
		transitionDigest: canonicalJsonDigest(body),
	}) as unknown as DecisionLifecycleTransition;
}

function decisionLifecycleSelection(
	candidate: DecisionCandidate,
	report: GateReport,
): Pick<DecisionLifecycleTransition, "target" | "reasonCode"> {
	if (report.status === "stopped") {
		return {target: "preserve_state", reasonCode: report.stoppedReason?.code ?? "gate_stopped"};
	}
	if (report.status === "failed") {
		return {target: "decision", reasonCode: "decision_checks_failed"};
	}
	switch (candidate.content.disposition) {
		case "approve":
			return {target: "planning", reasonCode: "decision_approved"};
		case "defer":
			return {target: "deferred", reasonCode: "decision_deferred"};
		case "reject":
			return {target: "terminal", reasonCode: "decision_rejected"};
		case "withdraw":
			return {target: "terminal", reasonCode: "decision_withdrawn"};
		default:
			return assertNever(candidate.content.disposition);
	}
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function assertNever(value: never): never {
	throw new Error(`Unsupported Decision disposition ${String(value)}.`);
}

function assertRunInput(input: RunDecisionGateInput): void {
	if (input.candidate.loop !== "decision") {
		throw new Error("Decision Gate requires Decision Candidate.");
	}
	if (!input.changeRef.trim() || input.changeRef !== input.changeRef.trim()) {
		throw new Error("Decision Gate changeRef must be trimmed non-empty text.");
	}
}
