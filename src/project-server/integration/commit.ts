import {
	createGitCommandRunner,
	type GitCommandRunner,
} from "../../changes/trace/git-command.ts";
import type {ReplayAdmissionPolicy} from "../../changes/trace/reducer.ts";
import {
	createCurrentGitSynchronizer,
	pushSynchronizedStateBatch,
	type ProjectAuthoritySnapshot,
	type SynchronizationObservation,
} from "../../changes/trace/synchronization.ts";
import type {AuthorityBinding} from "../../changes/trace/contracts.ts";
import type {GateReport} from "../../checks/contracts.ts";
import type {WorkUnitCandidate} from "../../loops/implementation/work-unit-candidate.ts";
import type {Sha256Digest} from "../../utils/canonical-json.ts";
import {
	createImplementationAggregateFreeze,
	createPrivateIntegrationAdmission,
	type ImplementationAggregateFreeze,
	type PrivateIntegrationAdmission,
	type PrivateIntegrationObservation,
} from "./private-lineage.ts";

interface IntegrationCommitBase {
	readonly repoRoot: string;
	readonly remote: string;
	readonly repositoryIdentity: Sha256Digest;
	readonly currentProject: () => ProjectAuthoritySnapshot | Promise<ProjectAuthoritySnapshot>;
	readonly replayPolicy: ReplayAdmissionPolicy;
	readonly expectedTeamSnapshotDigest: Sha256Digest;
	readonly expectedWorkStateDigest: Sha256Digest;
	readonly expectedWorkGraphDigest: Sha256Digest;
	readonly authorityBinding: AuthorityBinding;
	readonly runner?: GitCommandRunner;
	readonly materializationRoot?: string;
	readonly signal?: AbortSignal;
}

export interface CommitPrivateIntegrationAdmissionInput extends IntegrationCommitBase {
	readonly candidate: WorkUnitCandidate;
	readonly gateReport: GateReport;
	readonly observation: PrivateIntegrationObservation;
}

export interface CommitImplementationAggregateInput extends IntegrationCommitBase {
	readonly changeId: string;
	readonly expectedLineageDigest: Sha256Digest;
	readonly frozenAt: string;
}

export interface PrivateIntegrationCommitReceipt {
	readonly admission: PrivateIntegrationAdmission;
	readonly stateHead: string;
	readonly observation: SynchronizationObservation;
}

export interface ImplementationAggregateCommitReceipt {
	readonly freeze: ImplementationAggregateFreeze;
	readonly stateHead: string;
	readonly observation: SynchronizationObservation;
}

export async function commitPrivateIntegrationAdmission(
	input: CommitPrivateIntegrationAdmissionInput,
): Promise<PrivateIntegrationCommitReceipt> {
	const runner = input.runner ?? createGitCommandRunner();
	const synchronizeCurrent = integrationSynchronizer(input, runner);
	const {observation} = await synchronizeCurrent();
	assertFreshIntegrationBase(input, observation);
	const state = observation.workState;
	const snapshot = observation.teamSnapshot;
	if (!state || !snapshot) throw new Error("Private integration synchronized state is unavailable.");
	const admission = createPrivateIntegrationAdmission({
		state,
		candidate: input.candidate,
		gateReport: input.gateReport,
		observation: input.observation,
		baseSnapshot: {
			remoteStateHead: snapshot.remoteStateHead,
			sourceHead: snapshot.protectedSourceHead,
			knowledgeDigest: snapshot.knowledgeDigest,
			configDigest: snapshot.configDigest,
			policyDigest: snapshot.policyDigest,
		},
		authorityBinding: input.authorityBinding,
	});
	const {pushResult} = await pushSynchronizedStateBatch({
		repoRoot: input.repoRoot,
		remote: input.remote,
		state,
		records: [admission.operation],
		policy: input.replayPolicy,
		observation,
		runner,
		signal: input.signal,
	});
	if (pushResult.status === "stale") {
		throw new Error("Private integration push became stale; exact Candidate must be revalidated.");
	}
	const {observation: verified} = await synchronizeCurrent();
	const change = verified.workState?.changes.find(
		(entry) => entry.changeId === input.candidate.content.owningChangeId,
	);
	if (
		verified.status !== "fresh" ||
		!verified.workState?.stateHead ||
		!verified.workState.acceptedOperationIds.includes(admission.operation.operationId) ||
		change?.privateIntegrationLineage?.lineageDigest !== admission.lineage.lineageDigest
	) {
		throw new Error(`Private integration receipt ${admission.receipt.receiptId} could not be verified.`);
	}
	return Object.freeze({
		admission,
		stateHead: verified.workState.stateHead,
		observation: verified,
	});
}

export async function commitImplementationAggregate(
	input: CommitImplementationAggregateInput,
): Promise<ImplementationAggregateCommitReceipt> {
	const runner = input.runner ?? createGitCommandRunner();
	const synchronizeCurrent = integrationSynchronizer(input, runner);
	const {observation} = await synchronizeCurrent();
	assertFreshIntegrationBase(input, observation);
	const state = observation.workState;
	const snapshot = observation.teamSnapshot;
	if (!state || !snapshot) throw new Error("Implementation aggregate synchronized state is unavailable.");
	const freeze = createImplementationAggregateFreeze({
		state,
		changeId: input.changeId,
		expectedLineageDigest: input.expectedLineageDigest,
		frozenAt: input.frozenAt,
		baseSnapshot: {
			remoteStateHead: snapshot.remoteStateHead,
			sourceHead: snapshot.protectedSourceHead,
			knowledgeDigest: snapshot.knowledgeDigest,
			configDigest: snapshot.configDigest,
			policyDigest: snapshot.policyDigest,
		},
		authorityBinding: input.authorityBinding,
	});
	const {pushResult} = await pushSynchronizedStateBatch({
		repoRoot: input.repoRoot,
		remote: input.remote,
		state,
		records: [freeze.operation],
		policy: input.replayPolicy,
		observation,
		runner,
		signal: input.signal,
	});
	if (pushResult.status === "stale") {
		throw new Error("Implementation aggregate push became stale; completion must be recomputed.");
	}
	const {observation: verified} = await synchronizeCurrent();
	const change = verified.workState?.changes.find((entry) => entry.changeId === input.changeId);
	if (
		verified.status !== "fresh" ||
		!verified.workState?.stateHead ||
		!verified.workState.acceptedOperationIds.includes(freeze.operation.operationId) ||
		change?.implementationAggregate?.aggregateDigest !== freeze.aggregate.aggregateDigest
	) {
		throw new Error(`Implementation aggregate ${freeze.aggregate.aggregateDigest} could not be verified.`);
	}
	return Object.freeze({
		freeze,
		stateHead: verified.workState.stateHead,
		observation: verified,
	});
}

function integrationSynchronizer(
	input: IntegrationCommitBase,
	runner: GitCommandRunner,
) {
	return createCurrentGitSynchronizer({
		repoRoot: input.repoRoot,
		remote: input.remote,
		repositoryIdentity: input.repositoryIdentity,
		currentProject: input.currentProject,
		policy: input.replayPolicy,
		runner,
		materializationRoot: input.materializationRoot,
		signal: input.signal,
	});
}

function assertFreshIntegrationBase(
	input: IntegrationCommitBase,
	observation: SynchronizationObservation,
): void {
	if (observation.status !== "fresh" || !observation.workState || !observation.teamSnapshot) {
		throw new Error(
			`Private integration requires fresh synchronization; current status is ${observation.status}.`,
		);
	}
	if (observation.teamSnapshot.snapshotDigest !== input.expectedTeamSnapshotDigest) {
		throw new Error("Private integration team snapshot is stale.");
	}
	if (observation.workState.workStateDigest !== input.expectedWorkStateDigest) {
		throw new Error("Private integration WorkState is stale.");
	}
	if (observation.workState.workGraph.graphDigest !== input.expectedWorkGraphDigest) {
		throw new Error("Private integration Work Graph is stale.");
	}
}
