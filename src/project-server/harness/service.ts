import {
	assertRunReceipt,
	assertRunRequest,
	type RunReceipt,
	type RunRequest,
} from "../../runtime/contracts.ts";
import type {Sha256Digest} from "../../utils/canonical-json.ts";
import {
	createHarnessCandidateSubmission,
	assertHarnessInteractionBinding,
	type HarnessCandidateSubmission,
	type HarnessInteractionBinding,
	type HarnessProducerLoop,
} from "./contracts.ts";

export interface HarnessRuntimeResult<TCandidate> {
	readonly receipt: RunReceipt;
	readonly candidateDigest: Sha256Digest;
	readonly candidate: TCandidate;
}

export interface HarnessRuntimePort<TCandidate> {
	run(request: RunRequest): Promise<HarnessRuntimeResult<TCandidate>>;
}

export interface HarnessSubmissionPort<TCandidate, TResult> {
	submit(input: {
		readonly loop: HarnessProducerLoop;
		readonly candidate: TCandidate;
		readonly binding: HarnessCandidateSubmission;
	}): Promise<TResult>;
}

/**
 * One Harness producer turn. Runtime executes exact role-scoped DSH Run;
 * Project Server receives unchanged Candidate plus receipt-bound submission.
 */
export async function runHarnessProducerTurn<TCandidate, TResult>(input: {
	readonly interaction: HarnessInteractionBinding;
	readonly request: RunRequest;
	readonly expectedWorkStateDigest: Sha256Digest;
	readonly runtime: HarnessRuntimePort<TCandidate>;
	readonly projectServer: HarnessSubmissionPort<TCandidate, TResult>;
}): Promise<Readonly<{
	result: TResult;
	receipt: RunReceipt;
	submission: HarnessCandidateSubmission;
}>> {
	assertHarnessInteractionBinding(input.interaction);
	assertRunRequest(input.request);
	assertHarnessRunBinding(input.interaction, input.request);
	const runtime = await input.runtime.run(input.request);
	assertRunReceipt(runtime.receipt);
	if (
		runtime.receipt.requestDigest !== input.request.requestDigest ||
		runtime.receipt.runId !== input.request.runId ||
		runtime.receipt.outputDigest !== runtime.candidateDigest ||
		runtime.receipt.outcome !== "completed"
	) {
		throw new Error("Harness Runtime result does not bind one completed exact Candidate Run.");
	}
	const submission = createHarnessCandidateSubmission({
		interaction: input.interaction,
		producerLoop: input.interaction.producerLoop,
		candidateDigest: runtime.candidateDigest,
		runRequestDigest: input.request.requestDigest,
		runReceiptDigest: runtime.receipt.receiptDigest,
		expectedWorkStateDigest: input.expectedWorkStateDigest,
	});
	const result = await input.projectServer.submit({
		loop: input.interaction.producerLoop,
		candidate: runtime.candidate,
		binding: submission,
	});
	return Object.freeze({result, receipt: runtime.receipt, submission});
}

function assertHarnessRunBinding(
	interaction: HarnessInteractionBinding,
	request: RunRequest,
): void {
	const role = `${interaction.producerLoop}-producer`;
	if (request.role !== role || request.stage !== interaction.producerLoop) {
		throw new Error("Harness Run must use its exact Decision or Planning producer role.");
	}
	if (request.inputs.projectContextSnapshotDigest !== interaction.contextSnapshotDigest) {
		throw new Error("Harness Run context does not match interaction binding.");
	}
	if (
		request.session.continuityKey !== interaction.continuityKey ||
		request.session.sessionId !== interaction.sessionId
	) {
		throw new Error("Harness Run Session does not match interaction continuity.");
	}
	const expectedHead = interaction.sessionHeadDigest ?? "absent";
	if (request.session.expectedHead !== expectedHead) {
		throw new Error("Harness Run expected Session head does not match interaction continuity.");
	}
}
