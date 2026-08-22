import type {CheckResultCache} from "../../checks/cache.ts";
import type {
	GateReport,
	GateStopReason,
} from "../../checks/contracts.ts";
import type {GateEvaluationPackage} from "../../checks/gate-package.ts";
import {checkSubjectFromCandidate} from "../../checks/identity.ts";
import {createGateReport} from "../../checks/results.ts";
import {
	createGateRunner,
	type CheckExecutor,
	type CheckInputResolver,
	type GateRunnerLimits,
} from "../../checks/runner.ts";
import type {EvidenceRecord} from "../../evidence/contracts.ts";
import {
	assertImplementationStagePolicy,
	type ImplementationStagePolicy,
} from "../../loops/implementation/policy.ts";
import {
	assertWorkUnitCandidate,
	type WorkUnitCandidate,
} from "../../loops/implementation/work-unit-candidate.ts";
import {
	deriveWorkUnitCandidateLifecycle,
	type WorkUnitCandidateLifecycle,
} from "../../loops/implementation/status.ts";
import {evidenceInputResolver} from "./evidence-input.ts";
import {implementationGatePackageContext} from "./gate-package-bindings.ts";

export interface CreateImplementationGateInput {
	readonly policy: ImplementationStagePolicy;
	readonly executors?: readonly CheckExecutor[];
	readonly inputResolver?: CheckInputResolver;
	readonly stoppedReason?: GateStopReason;
	readonly cache?: CheckResultCache;
	readonly limits?: Partial<GateRunnerLimits>;
}

export interface RunImplementationGateInput {
	readonly candidate: WorkUnitCandidate;
	readonly evidenceRecords?: readonly EvidenceRecord[];
	readonly signal?: AbortSignal;
}

export interface ImplementationGateRun {
	readonly candidate: WorkUnitCandidate;
	readonly policy: ImplementationStagePolicy;
	readonly evaluationPackage: GateEvaluationPackage | null;
	readonly report: GateReport;
	readonly lifecycle: WorkUnitCandidateLifecycle;
}

export interface ImplementationStageGate {
	readonly policy: ImplementationStagePolicy;
	run(input: RunImplementationGateInput): Promise<ImplementationGateRun>;
}

export function createImplementationStageGate(
	input: CreateImplementationGateInput,
): ImplementationStageGate {
	assertImplementationStagePolicy(input.policy);
	const policy = input.policy;
	return Object.freeze({
		policy,
		async run(runInput: RunImplementationGateInput): Promise<ImplementationGateRun> {
			assertWorkUnitCandidate(runInput.candidate);
			const evidenceRecords = [...(runInput.evidenceRecords ?? [])];
			assertExactCandidateEvidence(runInput.candidate, evidenceRecords);
			const subject = checkSubjectFromCandidate(runInput.candidate);
			const evaluation = input.stoppedReason
				? Object.freeze({
						evaluationPackage: null,
						report: createGateReport({
						snapshot: policy.packSnapshot,
						subjectDigest: subject.digest,
						results: [],
						executions: [],
							stoppedReason: input.stoppedReason,
						}),
					})
				: await createGateRunner({
						executors: input.executors,
						inputResolver: evidenceInputResolver({
							evidenceRecords,
							fallback: input.inputResolver,
						}),
						cache: input.cache,
						limits: input.limits,
					}).runEvaluation({
						subject,
						snapshot: policy.packSnapshot,
						...implementationGatePackageContext({
							candidate: runInput.candidate,
							snapshot: policy.packSnapshot,
							policyDigest: policy.policyDigest,
							executors: input.executors,
							evidenceRecords,
						}),
						signal: runInput.signal,
					});
			const {evaluationPackage, report} = evaluation;
			return Object.freeze({
				candidate: runInput.candidate,
				policy,
				evaluationPackage,
				report,
				lifecycle: deriveWorkUnitCandidateLifecycle({
					candidate: runInput.candidate,
					gateReport: report,
				}),
			});
		},
	});
}

function assertExactCandidateEvidence(
	candidate: WorkUnitCandidate,
	records: readonly EvidenceRecord[],
): void {
	const expected = [...candidate.content.evidenceRecordIds].sort(compareText);
	const actual = records.map((record) => record.evidenceId).sort(compareText);
	if (
		expected.length !== actual.length ||
		expected.some((evidenceId, index) => evidenceId !== actual[index])
	) {
		throw new Error("Implementation Gate requires exact Candidate Evidence set.");
	}
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
