import {
	createGitCommandRunner,
	type GitCommandRunner,
} from "../../changes/trace/git-command.ts";
import type {
	AuthorityBinding,
	GitObjectId,
} from "../../changes/trace/contracts.ts";
import type {ReplayAdmissionPolicy} from "../../changes/trace/reducer.ts";
import type {SchedulingPolicy, WorkerOffer} from "../../changes/trace/scheduling.ts";
import {
	createCurrentGitSynchronizer,
	pushSynchronizedStateBatch,
	type ProjectAuthoritySnapshot,
	type SynchronizationObservation,
} from "../../changes/trace/synchronization.ts";
import type {Sha256Digest} from "../../utils/canonical-json.ts";
import {
	createProjectSchedulingPlan,
	createSchedulingOperationSequence,
	type SchedulingOperationSequence,
	type SchedulingPlan,
} from "./scheduler.ts";

export interface CommitProjectSchedulingPlanInput {
	readonly repoRoot: string;
	readonly remote: string;
	readonly repositoryIdentity: Sha256Digest;
	readonly currentProject: () => ProjectAuthoritySnapshot | Promise<ProjectAuthoritySnapshot>;
	readonly replayPolicy: ReplayAdmissionPolicy;
	readonly workerOffers: readonly WorkerOffer[];
	readonly policy: SchedulingPolicy;
	readonly sourceBase: GitObjectId;
	readonly observedAt: string;
	readonly recordedAt: string;
	readonly claimAuthority: AuthorityBinding;
	readonly assignmentAuthority: AuthorityBinding;
	readonly runner?: GitCommandRunner;
	readonly materializationRoot?: string;
	readonly signal?: AbortSignal;
}

export type ProjectSchedulingCommitReceipt = Readonly<{
	status: "idle" | "accepted";
	plan: SchedulingPlan;
	sequence: SchedulingOperationSequence | null;
	stateHead: string;
	observation: SynchronizationObservation;
}>;

export async function commitProjectSchedulingPlan(
	input: CommitProjectSchedulingPlanInput,
): Promise<ProjectSchedulingCommitReceipt> {
	const runner = input.runner ?? createGitCommandRunner();
	const synchronizeCurrent = createCurrentGitSynchronizer({
		repoRoot: input.repoRoot,
		remote: input.remote,
		repositoryIdentity: input.repositoryIdentity,
		currentProject: input.currentProject,
		policy: input.replayPolicy,
		runner,
		materializationRoot: input.materializationRoot,
		signal: input.signal,
	});
	const {observation} = await synchronizeCurrent();
	if (observation.status !== "fresh" || !observation.workState || !observation.teamSnapshot) {
		throw new Error(
			`Scheduling commit requires fresh synchronization; current status is ${observation.status}.`,
		);
	}
	if (!observation.workState.stateHead) {
		throw new Error("Scheduling commit requires accepted WorkState head.");
	}
	if (input.sourceBase !== observation.teamSnapshot.protectedSourceHead) {
		throw new Error("Scheduling source base is stale.");
	}
	const plan = createProjectSchedulingPlan({
		state: observation.workState,
		workerOffers: input.workerOffers,
		policy: input.policy,
		sourceBase: input.sourceBase,
		observedAt: input.observedAt,
	});
	if (plan.admissions.length === 0) {
		return Object.freeze({
			status: "idle",
			plan,
			sequence: null,
			stateHead: observation.workState.stateHead,
			observation,
		});
	}
	const sequence = createSchedulingOperationSequence({
		state: observation.workState,
		plan,
		policy: input.policy,
		baseSnapshot: {
			remoteStateHead: observation.teamSnapshot.remoteStateHead,
			sourceHead: observation.teamSnapshot.protectedSourceHead,
			knowledgeDigest: observation.teamSnapshot.knowledgeDigest,
			configDigest: observation.teamSnapshot.configDigest,
			policyDigest: observation.teamSnapshot.policyDigest,
		},
		claimAuthority: input.claimAuthority,
		assignmentAuthority: input.assignmentAuthority,
		recordedAt: input.recordedAt,
	});
	const {pushResult} = await pushSynchronizedStateBatch({
		repoRoot: input.repoRoot,
		remote: input.remote,
		state: observation.workState,
		records: sequence.operations,
		policy: input.replayPolicy,
		observation,
		runner,
		signal: input.signal,
	});
	if (pushResult.status === "stale") {
		throw new Error("Scheduling push became stale; Project Server must refetch and reschedule.");
	}
	const {observation: verified} = await synchronizeCurrent();
	const acceptedIds = new Set(verified.workState?.acceptedOperationIds ?? []);
	if (
		verified.status !== "fresh" ||
		!verified.workState?.stateHead ||
		!sequence.operations.every((operation) => acceptedIds.has(operation.operationId))
	) {
		throw new Error("Accepted Scheduling plan could not be verified.");
	}
	return Object.freeze({
		status: "accepted",
		plan,
		sequence,
		stateHead: verified.workState.stateHead,
		observation: verified,
	});
}
