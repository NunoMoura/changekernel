import type {ContainerIdentity, IntakeOutcome, IntakeReceipt, ProposedIntake} from "../kernel/containers/intake.ts";
import type {Sha256Digest} from "../kernel/identity/sha256.ts";

/** Only intake custody. No managed State, stages, Checks or effect authority. */
export interface ContainerIntakeStore {
	readonly protocol: "changekernel.container-intake-store@1.0.0";
	create(input: ContainerIdentity, actor: string): IntakeOutcome<ContainerIdentity>;
	open(input: ContainerIdentity, actor: string): IntakeOutcome<ContainerIdentity>;
	propose(input: ProposedIntake, actor: string): IntakeOutcome<IntakeReceipt>;
	read(input: ContainerIdentity, changeId: Sha256Digest, actor: string): IntakeOutcome<IntakeReceipt>;
}
