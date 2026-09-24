import type {CandidateOutcome, CandidateRequest, ChangeCandidate, ContainerDescription, DefinitionRequest, EntityObservation, RecordDefinition} from "../kernel/containers/candidate.ts";
import type {ContainerIdentity} from "../kernel/containers/intake.ts";
import type {Sha256Digest} from "../kernel/identity/sha256.ts";

/** Draft custody only. Historical intake contracts remain unchanged. */
export interface ContainerCandidateStore {
	readonly protocol: "changekernel.container-candidate-batch-store@1.0.0";
	install(input: DefinitionRequest, actor: string): CandidateOutcome<RecordDefinition>;
	describe(input: ContainerIdentity, actor: string): CandidateOutcome<ContainerDescription>;
	prepare(input: CandidateRequest, actor: string): CandidateOutcome<ChangeCandidate>;
	read(input: ContainerIdentity, candidateId: Sha256Digest, actor: string): CandidateOutcome<ChangeCandidate>;
}

/** Trusted, bounded synchronous source observation. No mutation or publication capability.
 * The host enforces source access/scope on every call, returning denied when access is lost.
 * Unknown means the actor remains authorized but coverage cannot currently be established.
 * bindingDigest identifies the exact source/scope interpretation, not just a display label.
 */
export interface CandidateObservationSource {
	readonly sourceId: string;
	readonly bindingDigest: Sha256Digest;
	observe(input: Readonly<{containerId: string; actor: string; entityId: string}>): EntityObservation;
}
