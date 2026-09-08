import type {CanonicalValue} from "../kernel/data-contracts/canonical-json.ts";
import type {Outcome} from "../kernel/data-contracts/outcome.ts";
import type {EvidenceReference} from "../kernel/evidence/reference.ts";
import type {
	CheckExecutionIdentity,
	CheckMeasurement,
	CheckRegistration,
	Gate,
	ResultDetail,
	ResultFailure,
} from "../kernel/gates/contracts.ts";
import {semanticDigest, type SemanticIdentityIssue} from "../kernel/identity/semantic-digest.ts";
import type {Sha256Digest} from "../kernel/identity/sha256.ts";

export const CHECK_RUNNER_PORT = Object.freeze({
	id: "codewiki.port.check-runner",
	version: "1.0.0",
});
export const CHECK_RUNNER_PORT_PROTOCOL = CHECK_RUNNER_PORT;

export interface CheckRunnerInputItem {
	readonly source: "evidence" | "knowledge" | "provider_receipts" | "repository" | "subject";
	readonly ref: string;
	readonly digest: Sha256Digest;
	readonly content: CanonicalValue;
}

export interface CheckRunnerRequest {
	readonly authorizationId: string;
	readonly requestDigest: Sha256Digest;
	readonly gate: Gate;
	readonly registration: CheckRegistration;
	readonly inputs: readonly CheckRunnerInputItem[];
	readonly attempt: number;
	readonly predecessorRunDigest: Sha256Digest | null;
	readonly quiescenceReceipt: EvidenceReference | null;
}

export function checkRunnerRequestDigest(request: CheckRunnerRequest): Outcome<Sha256Digest, SemanticIdentityIssue> {
	const {requestDigest: ignored, ...body} = request;
	void ignored;
	return semanticDigest("codewiki.check-runner.request@1.0.0", body);
}

export interface CheckRunnerCompletion {
	readonly status: "completed" | "error" | "stopped";
	readonly measurement: CheckMeasurement | null;
	readonly summary: string;
	readonly details: readonly ResultDetail[];
	readonly failure: ResultFailure | null;
	readonly execution: CheckExecutionIdentity;
	readonly evidence: readonly EvidenceReference[];
	readonly executionReceipt: EvidenceReference | null;
}

export interface CheckRunnerIssue {
	readonly code:
		| "authorization_binding_invalid"
		| "budget_exhausted"
		| "cancelled"
		| "execution_failed"
		| "executor_unavailable"
		| "invalid_input"
		| "invalid_output"
		| "stale_subject"
		| "timeout";
	readonly message: string;
}

/** Operational Check execution only; Results and Gate authority remain Project Server/Kernel concerns. */
export interface CheckRunnerPort {
	readonly protocol: typeof CHECK_RUNNER_PORT;
	run(request: CheckRunnerRequest): Promise<Outcome<CheckRunnerCompletion, CheckRunnerIssue>>;
}
