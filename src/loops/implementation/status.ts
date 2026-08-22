import type {GateReport} from "../../checks/contracts.ts";
import type {IntegrationAttemptProjection} from "../../changes/trace/state.ts";
import type {PrivateChangeIntegrationLineage} from "../../changes/trace/integration.ts";
import {
	assertWorkUnitCandidate,
	type WorkUnitCandidate,
} from "./work-unit-candidate.ts";

export type WorkUnitCandidateStatus =
	| "gate_failed"
	| "gate_passed"
	| "integration_pending"
	| "integrated"
	| "stale"
	| "conflicted";

export interface WorkUnitCandidateLifecycle {
	readonly candidateId: string;
	readonly candidateDigest: string;
	readonly gateStatus: "pending" | "passed" | "failed";
	readonly integrationStatus:
		| "not_requested"
		| "pending"
		| "integrated"
		| "stale"
		| "conflicted";
	readonly status: WorkUnitCandidateStatus | null;
}

export function deriveWorkUnitCandidateLifecycle(input: {
	readonly candidate: WorkUnitCandidate;
	readonly gateReport?: GateReport;
	readonly integration?: IntegrationAttemptProjection;
	readonly privateLineage?: PrivateChangeIntegrationLineage;
	readonly stale?: boolean;
}): WorkUnitCandidateLifecycle {
	assertWorkUnitCandidate(input.candidate);
	if (
		input.gateReport &&
		(input.gateReport.stage !== "implementation" ||
			input.gateReport.subjectDigest !== input.candidate.digest)
	) {
		throw new Error("Implementation Gate Report does not bind Work Unit Candidate.");
	}
	if (input.integration && input.privateLineage) {
		throw new Error("Work Unit Candidate lifecycle accepts one Integration projection source.");
	}
	if (
		input.integration &&
		!input.integration.sourceCandidateIds.includes(input.candidate.id)
	) {
		throw new Error("Integration attempt does not bind Work Unit Candidate.");
	}
	const gateStatus = gateLifecycleStatus(input.gateReport);
	const integrationStatus = input.privateLineage
		? privateLineageLifecycleStatus(input.privateLineage, input.candidate.id)
		: integrationLifecycleStatus(input.integration);
	return Object.freeze({
		candidateId: input.candidate.id,
		candidateDigest: input.candidate.digest,
		gateStatus,
		integrationStatus,
		status: currentCandidateStatus({
			stale: input.stale ?? false,
			gateStatus,
			integrationStatus,
		}),
	});
}

function gateLifecycleStatus(
	report: GateReport | undefined,
): WorkUnitCandidateLifecycle["gateStatus"] {
	if (!report) return "pending";
	return report.status === "passed" ? "passed" : "failed";
}

function integrationLifecycleStatus(
	integration: IntegrationAttemptProjection | undefined,
): WorkUnitCandidateLifecycle["integrationStatus"] {
	if (!integration) return "not_requested";
	if (integration.status === "integrated") return "integrated";
	if (integration.status === "conflict") return "conflicted";
	if (integration.status === "failed" || integration.status === "cancelled") {
		return "stale";
	}
	return "pending";
}

function privateLineageLifecycleStatus(
	lineage: PrivateChangeIntegrationLineage,
	candidateId: string,
): WorkUnitCandidateLifecycle["integrationStatus"] {
	if (lineage.integratedWorkUnits.some((entry) => entry.candidateId === candidateId)) {
		return "integrated";
	}
	for (let index = lineage.receipts.length - 1; index >= 0; index -= 1) {
		const receipt = lineage.receipts[index];
		if (receipt?.candidateId === candidateId) {
			return receipt.status === "conflicted" ? "conflicted" : "not_requested";
		}
	}
	return "not_requested";
}

function currentCandidateStatus(input: {
	readonly stale: boolean;
	readonly gateStatus: WorkUnitCandidateLifecycle["gateStatus"];
	readonly integrationStatus: WorkUnitCandidateLifecycle["integrationStatus"];
}): WorkUnitCandidateStatus | null {
	if (input.stale || input.integrationStatus === "stale") return "stale";
	if (input.integrationStatus === "conflicted") return "conflicted";
	if (input.gateStatus === "failed") return "gate_failed";
	if (input.gateStatus === "pending") return null;
	if (input.integrationStatus === "integrated") return "integrated";
	if (input.integrationStatus === "pending") return "integration_pending";
	return "gate_passed";
}
