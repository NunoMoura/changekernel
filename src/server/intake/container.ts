import {decodeContainerIdentity, decodeIntake, intakeIssue, invalidIntake, validIntakeActor, type ContainerIdentity, type IntakeOutcome, type IntakeReceipt} from "../../kernel/containers/intake.ts";
import {failure} from "../../kernel/data-contracts/outcome.ts";
import {decodeSha256Digest} from "../../kernel/identity/sha256.ts";
import type {ContainerIntakeStore} from "../../ports/container-intake-store.ts";

/** Host must authenticate actor for every call; untrusted input cannot select an actor. */
export function createContainerIntakeClient(store: ContainerIntakeStore) {
	if (store.protocol !== "changekernel.container-intake-store@1.0.0") throw new Error("Unsupported intake store protocol.");
	function prepare(value: unknown, actor: unknown): IntakeOutcome<ContainerIdentity> {
		if (!validIntakeActor(actor)) return failure(intakeIssue("denied", "Trusted actor identity is required."));
		const decoded = decodeContainerIdentity(value);
		return decoded.ok ? decoded : invalidIntake(decoded.error);
	}
	return Object.freeze({
		create(value: unknown, actor: unknown): IntakeOutcome<ContainerIdentity> {
			const prepared = prepare(value, actor);
			return prepared.ok ? store.create(prepared.value, actor as string) : prepared;
		},
		open(value: unknown, actor: unknown): IntakeOutcome<ContainerIdentity> {
			const prepared = prepare(value, actor);
			return prepared.ok ? store.open(prepared.value, actor as string) : prepared;
		},
		propose(value: unknown, actor: unknown): IntakeOutcome<IntakeReceipt> {
			if (!validIntakeActor(actor)) return failure(intakeIssue("denied", "Trusted actor identity is required."));
			const decoded = decodeIntake(value);
			return decoded.ok ? store.propose(decoded.value, actor) : invalidIntake(decoded.error);
		},
		read(value: unknown, changeId: unknown, actor: unknown): IntakeOutcome<IntakeReceipt> {
			const prepared = prepare(value, actor);
			if (!prepared.ok) return prepared;
			const digest = decodeSha256Digest(changeId);
			if (!digest.ok) return failure(intakeIssue("invalid_input", digest.error.message));
			return store.read(prepared.value, digest.value, actor as string);
		},
	});
}
