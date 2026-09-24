import {candidateInvalid, candidateIssue, decodeCandidateRequest, decodeDefinitionRequest, type CandidateOutcome, type ChangeCandidate, type ContainerDescription, type RecordDefinition} from "../../kernel/containers/candidate.ts";
import {decodeContainerIdentity, validIntakeActor, type ContainerIdentity} from "../../kernel/containers/intake.ts";
import {failure} from "../../kernel/data-contracts/outcome.ts";
import {decodeSha256Digest} from "../../kernel/identity/sha256.ts";
import type {ContainerCandidateStore} from "../../ports/container-candidate-store.ts";

/** Host supplies an authenticated actor per operation, never a user-claimed actor field. */
export function createContainerCandidateClient(store: ContainerCandidateStore) {
	if (store.protocol !== "changekernel.container-candidate-batch-store@1.0.0") throw new Error("Unsupported candidate store protocol.");
	function authorized(actor: unknown): actor is string { return validIntakeActor(actor); }
	function prepareContainer(value: unknown): CandidateOutcome<ContainerIdentity> {
		const decoded = decodeContainerIdentity(value);
		return decoded.ok ? decoded : candidateInvalid(decoded.error);
	}
	return Object.freeze({
		install(value: unknown, actor: unknown): CandidateOutcome<RecordDefinition> {
			if (!authorized(actor)) return failure(candidateIssue("denied", "Trusted actor identity is required."));
			const decoded = decodeDefinitionRequest(value);
			return decoded.ok ? store.install(decoded.value, actor) : candidateInvalid(decoded.error);
		},
		describe(value: unknown, actor: unknown): CandidateOutcome<ContainerDescription> {
			if (!authorized(actor)) return failure(candidateIssue("denied", "Trusted actor identity is required."));
			const decoded = prepareContainer(value);
			return decoded.ok ? store.describe(decoded.value, actor) : decoded;
		},
		prepare(value: unknown, actor: unknown): CandidateOutcome<ChangeCandidate> {
			if (!authorized(actor)) return failure(candidateIssue("denied", "Trusted actor identity is required."));
			const decoded = decodeCandidateRequest(value);
			return decoded.ok ? store.prepare(decoded.value, actor) : candidateInvalid(decoded.error);
		},
		read(value: unknown, candidateId: unknown, actor: unknown): CandidateOutcome<ChangeCandidate> {
			if (!authorized(actor)) return failure(candidateIssue("denied", "Trusted actor identity is required."));
			const decoded = prepareContainer(value);
			if (!decoded.ok) return decoded;
			const candidate = decodeSha256Digest(candidateId);
			if (!candidate.ok) return failure(candidateIssue("invalid_input", candidate.error.message));
			return store.read(decoded.value, candidate.value, actor);
		},
	});
}
