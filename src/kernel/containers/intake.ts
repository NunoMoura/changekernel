import {failure, type Outcome} from "../data-contracts/outcome.ts";
import {decodeContract, exactRecord, isIdentifier, isNamespacedIdentifier, textField, type ContractIssue} from "../data-contracts/validation.ts";
import {semanticDigest} from "../identity/semantic-digest.ts";
import type {Sha256Digest} from "../identity/sha256.ts";

export const CONTAINER_INTAKE_PROTOCOL = "changekernel.container-intake@1.0.0";
const CONTRACT = "Container intake";
const ID = /^[a-z][a-z0-9.-]*:[A-Za-z0-9][A-Za-z0-9._:@/-]*$/u;

export interface IntakeIssue {
	readonly code: "invalid_input" | "denied" | "conflict" | "unavailable";
	readonly message: string;
}
export interface ContainerIdentity {
	readonly containerId: string;
}
export interface ProposedIntake extends ContainerIdentity {
	readonly requestId: string;
	readonly what: string;
	readonly why: string;
}
export interface IntakeReceipt extends ProposedIntake {
	readonly changeId: Sha256Digest;
	readonly inputDigest: Sha256Digest;
	readonly state: "awaiting-assessment";
}

export function decodeContainerIdentity(value: unknown): Outcome<ContainerIdentity, ContractIssue> {
	return decodeContract(CONTRACT, value, input => {
		const record = exactRecord(CONTRACT, input, "$", ["containerId"]);
		const containerId = textField(CONTRACT, record, "containerId", "$", {maximumBytes: 256, pattern: ID});
		if (!isNamespacedIdentifier(containerId)) throw new Error("Invalid container identity.");
		return Object.freeze({containerId});
	}, {maximumDepth: 3, maximumEntriesPerContainer: 4, maximumNodes: 8, maximumTextBytes: 512});
}

export function decodeIntake(value: unknown): Outcome<ProposedIntake, ContractIssue> {
	return decodeContract(CONTRACT, value, input => {
		const record = exactRecord(CONTRACT, input, "$", ["containerId", "requestId", "what", "why"]);
		const containerId = textField(CONTRACT, record, "containerId", "$", {maximumBytes: 256, pattern: ID});
		if (!isNamespacedIdentifier(containerId)) throw new Error("Invalid container identity.");
		return Object.freeze({
			containerId,
			requestId: textField(CONTRACT, record, "requestId", "$", {maximumBytes: 256, pattern: ID}),
			what: textField(CONTRACT, record, "what", "$", {maximumBytes: 65_536}),
			why: textField(CONTRACT, record, "why", "$", {maximumBytes: 65_536}),
		});
	}, {maximumDepth: 3, maximumEntriesPerContainer: 5, maximumNodes: 12, maximumTextBytes: 132_096});
}

/** Actor identity comes from a trusted host boundary, never from submitted content. */
export function validIntakeActor(actor: unknown): actor is string {
	return typeof actor === "string" && isIdentifier(actor) && actor.length <= 128;
}

export function intakeIdentity(actor: string, input: ProposedIntake): Readonly<{changeId: Sha256Digest; inputDigest: Sha256Digest}> {
	const change = semanticDigest(CONTAINER_INTAKE_PROTOCOL + ":identity", {containerId: input.containerId, actor, requestId: input.requestId});
	const content = semanticDigest(CONTAINER_INTAKE_PROTOCOL + ":input", input);
	if (!change.ok || !content.ok) throw new Error("Validated intake failed identity derivation.");
	return Object.freeze({changeId: change.value, inputDigest: content.value});
}

export function intakeIssue(code: IntakeIssue["code"], message: string): IntakeIssue {
	return Object.freeze({code, message});
}

export function invalidIntake(issue: ContractIssue): Outcome<never, IntakeIssue> {
	return failure(intakeIssue("invalid_input", `${issue.path}: ${issue.message}`));
}

export function intakeReceipt(input: ProposedIntake, identity: ReturnType<typeof intakeIdentity>): IntakeReceipt {
	// Keep exact admitted text; do not silently normalize or rewrite user intent.
	return Object.freeze({...input, ...identity, state: "awaiting-assessment"});
}

export type IntakeOutcome<T> = Outcome<T, IntakeIssue>;
