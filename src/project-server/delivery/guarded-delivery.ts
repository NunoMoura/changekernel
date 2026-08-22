import {createNextChangeOperation} from "../../changes/trace/builder.ts";
import type {
	AuthorityBinding,
	BaseSnapshot,
	CanonicalChangeOperation,
} from "../../changes/trace/contracts.ts";
import {
	createGitCommandRunner,
	type GitCommandRunner,
} from "../../changes/trace/git-command.ts";
import {reduceChangeOperation} from "../../changes/trace/reduce-operation.ts";
import type {ReplayAdmissionPolicy} from "../../changes/trace/reducer.ts";
import {currentPassedReviewTransition} from "../../changes/trace/review.ts";
import {changeById, type ProjectWorkState} from "../../changes/trace/state.ts";
import {
	createCurrentGitSynchronizer,
	pushSynchronizedStateBatch,
	type ProjectAuthoritySnapshot,
	type SynchronizationObservation,
} from "../../changes/trace/synchronization.ts";
import type {GateReport} from "../../checks/contracts.ts";
import {
	reviewSubjectFromAttempt,
	type ReviewAttempt,
} from "../../loops/review/contracts.ts";
import type {ReviewLifecycleTransition} from "../lifecycle/gates.ts";
import {assertCurrentAggregateReviewAttempt} from "../review/aggregate-review.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {inlineSemanticArtifact} from "../effects/gate-operations.ts";

export const DELIVERY_AUTHORITY_SCHEMA_VERSION = "1.0.0" as const;

export interface DeliveryAuthorityInput {
	readonly actor: string;
	readonly authorityRef: string;
	readonly targetRef: string;
	readonly reviewAttemptDigest: Sha256Digest;
	readonly gateReportDigest: Sha256Digest;
	readonly expectedTargetHead: string;
}

export type DeliveryAuthority = Readonly<DeliveryAuthorityInput & {
	readonly schemaVersion: typeof DELIVERY_AUTHORITY_SCHEMA_VERSION;
	readonly authorityDigest: Sha256Digest;
}>;

export interface CreateGuardedDeliveryOperationInput {
	readonly state: ProjectWorkState;
	readonly changeId: string;
	readonly baseSnapshot: BaseSnapshot;
	readonly authorityBinding: AuthorityBinding;
	readonly recordedAt: string;
	readonly attempt: ReviewAttempt;
	readonly report: GateReport;
	readonly transition: ReviewLifecycleTransition;
	readonly deliveryAuthority: DeliveryAuthority;
}

export interface GuardedDeliveryPlan {
	readonly authority: DeliveryAuthority;
	readonly operation: CanonicalChangeOperation<"delivery.applied">;
}

export interface CommitGuardedDeliveryInput {
	readonly repoRoot: string;
	readonly remote: string;
	readonly repositoryIdentity: Sha256Digest;
	readonly currentProject: () => ProjectAuthoritySnapshot | Promise<ProjectAuthoritySnapshot>;
	readonly replayPolicy: ReplayAdmissionPolicy;
	readonly expectedTeamSnapshotDigest: Sha256Digest;
	readonly expectedWorkStateDigest: Sha256Digest;
	readonly authorityBinding: AuthorityBinding;
	readonly recordedAt: string;
	readonly attempt: ReviewAttempt;
	readonly report: GateReport;
	readonly transition: ReviewLifecycleTransition;
	readonly deliveryAuthority: DeliveryAuthority;
	readonly runner?: GitCommandRunner;
	readonly materializationRoot?: string;
	readonly signal?: AbortSignal;
}

export interface GuardedDeliveryReceipt {
	readonly plan: GuardedDeliveryPlan;
	readonly stateHead: string;
	readonly observation: SynchronizationObservation;
}

export function createDeliveryAuthority(input: DeliveryAuthorityInput): DeliveryAuthority {
	const body = {
		schemaVersion: DELIVERY_AUTHORITY_SCHEMA_VERSION,
		actor: identity(input.actor, "Delivery actor"),
		authorityRef: identity(input.authorityRef, "Delivery authority reference"),
		targetRef: branchRef(input.targetRef),
		reviewAttemptDigest: digest(input.reviewAttemptDigest, "Delivery Review attempt digest"),
		gateReportDigest: digest(input.gateReportDigest, "Delivery Gate Report digest"),
		expectedTargetHead: gitObject(input.expectedTargetHead, "Delivery expected target head"),
	};
	return Object.freeze({...body, authorityDigest: canonicalJsonDigest(body)});
}

export function createGuardedDeliveryOperation(
	input: CreateGuardedDeliveryOperationInput,
): GuardedDeliveryPlan {
	assertCurrentAggregateReviewAttempt(input.state, input.attempt);
	const change = changeById(input.state, input.changeId);
	const currentTransition = change ? currentPassedReviewTransition(change) : null;
	if (!change?.implementationAggregate || !currentTransition || change.delivery) {
		throw new Error("Guarded delivery requires one current undelivered passed aggregate Review.");
	}
	if (
		input.attempt.changeId !== input.changeId ||
		input.deliveryAuthority.actor !== input.authorityBinding.actorId ||
		input.report.stage !== "review" ||
		input.report.status !== "passed" ||
		input.report.subjectDigest !== reviewSubjectFromAttempt(input.attempt).digest ||
		input.report.reportDigest !== input.transition.gateReportDigest ||
		canonicalJson(input.transition) !== canonicalJson(currentTransition) ||
		input.deliveryAuthority.reviewAttemptDigest !== input.attempt.attemptDigest ||
		input.deliveryAuthority.gateReportDigest !== input.report.reportDigest ||
		input.deliveryAuthority.targetRef !== input.attempt.targetBranch ||
		input.deliveryAuthority.expectedTargetHead !== input.attempt.targetBaseCommit
	) {
		throw new Error("Guarded delivery authority does not bind exact current Review.");
	}
	const authority = createDeliveryAuthority(input.deliveryAuthority);
	if (canonicalJson(authority) !== canonicalJson(input.deliveryAuthority)) {
		throw new Error("Guarded delivery authority identity is invalid.");
	}
	const authorityArtifact = inlineSemanticArtifact(
		`delivery-authority:${authority.authorityDigest.slice("sha256:".length)}`,
		authority.schemaVersion,
		authority,
	);
	const attemptArtifact = inlineSemanticArtifact(
		`review-attempt:${input.attempt.attemptDigest.slice("sha256:".length)}`,
		input.attempt.schemaVersion,
		input.attempt,
	);
	const operation = createNextChangeOperation(change, {
		changeId: change.changeId,
		kind: "delivery.applied",
		baseSnapshot: input.baseSnapshot,
		authorityBinding: input.authorityBinding,
		recordedAt: input.recordedAt,
		payload: {
			reviewAttempt: attemptArtifact,
			reviewAttemptDigest: input.attempt.attemptDigest,
			aggregateDigest: change.implementationAggregate.aggregateDigest,
			gateReportDigest: input.report.reportDigest,
			transitionDigest: input.transition.transitionDigest,
			authority: authorityArtifact,
			targetRef: authority.targetRef,
			expectedTargetHead: authority.expectedTargetHead,
			deliveredCommit: input.attempt.integratedHead,
			deliveredTree: input.attempt.integratedTree,
		},
	});
	reduceChangeOperation(change, operation, {});
	return Object.freeze({authority, operation});
}

export async function commitGuardedDelivery(
	input: CommitGuardedDeliveryInput,
): Promise<GuardedDeliveryReceipt> {
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
		throw new Error(`Guarded delivery requires fresh synchronization; current status is ${observation.status}.`);
	}
	if (
		observation.workState.workStateDigest !== input.expectedWorkStateDigest ||
		observation.teamSnapshot.snapshotDigest !== input.expectedTeamSnapshotDigest
	) {
		throw new Error("Guarded delivery authority snapshot is stale.");
	}
	const target = await revParse(runner, input.repoRoot, input.deliveryAuthority.targetRef, input.signal);
	if (
		target !== input.deliveryAuthority.expectedTargetHead &&
		target !== input.attempt.integratedHead
	) {
		throw new Error("Guarded delivery target-head CAS failed.");
	}
	const tree = await revParse(runner, input.repoRoot, `${input.attempt.integratedHead}^{tree}`, input.signal);
	if (tree !== input.attempt.integratedTree) {
		throw new Error("Guarded delivery integrated tree is stale.");
	}
	const ancestry = await runner({
		repoRoot: input.repoRoot,
		args: [
			"merge-base",
			"--is-ancestor",
			input.deliveryAuthority.expectedTargetHead,
			input.attempt.integratedHead,
		],
		signal: input.signal,
	});
	if (ancestry.exitCode !== 0) {
		throw new Error("Guarded delivery requires a fast-forward aggregate lineage.");
	}
	const plan = createGuardedDeliveryOperation({
		state: observation.workState,
		changeId: input.attempt.changeId,
		baseSnapshot: {
			remoteStateHead: observation.teamSnapshot.remoteStateHead,
			sourceHead: observation.teamSnapshot.protectedSourceHead,
			knowledgeDigest: observation.teamSnapshot.knowledgeDigest,
			configDigest: observation.teamSnapshot.configDigest,
			policyDigest: observation.teamSnapshot.policyDigest,
		},
		authorityBinding: input.authorityBinding,
		recordedAt: input.recordedAt,
		attempt: input.attempt,
		report: input.report,
		transition: input.transition,
		deliveryAuthority: input.deliveryAuthority,
	});
	if (target !== input.attempt.integratedHead) {
		const update = await runner({
			repoRoot: input.repoRoot,
			args: [
				"update-ref",
				input.deliveryAuthority.targetRef,
				input.attempt.integratedHead,
				input.deliveryAuthority.expectedTargetHead,
			],
			signal: input.signal,
		});
		if (update.exitCode !== 0) throw new Error("Guarded delivery target-head CAS failed.");
	}
	const {pushResult} = await pushSynchronizedStateBatch({
		repoRoot: input.repoRoot,
		remote: input.remote,
		state: observation.workState,
		records: [plan.operation],
		policy: input.replayPolicy,
		observation,
		runner,
		signal: input.signal,
	});
	if (pushResult.status === "stale") {
		throw new Error("Guarded delivery Trace admission became stale; retry recovery is required.");
	}
	const {observation: verified} = await synchronizeCurrent();
	const change = verified.workState?.changes.find((entry) => entry.changeId === input.attempt.changeId);
	if (
		verified.status !== "fresh" ||
		!verified.workState?.stateHead ||
		change?.delivery?.operationId !== plan.operation.operationId
	) {
		throw new Error(`Guarded delivery ${plan.operation.operationId} could not be verified.`);
	}
	return Object.freeze({plan, stateHead: verified.workState.stateHead, observation: verified});
}

async function revParse(
	runner: GitCommandRunner,
	repoRoot: string,
	revision: string,
	signal?: AbortSignal,
): Promise<string> {
	const result = await runner({repoRoot, args: ["rev-parse", revision], signal});
	if (result.exitCode !== 0) throw new Error(`Guarded delivery cannot resolve ${revision}.`);
	return gitObject(result.stdout.trim(), "Guarded delivery Git object");
}

function branchRef(value: unknown): string {
	const ref = identity(value, "Delivery target ref");
	const short = ref.slice("refs/heads/".length);
	if (
		!ref.startsWith("refs/heads/") ||
		short.length === 0 ||
		short.startsWith("/") ||
		short.endsWith("/") ||
		short.endsWith(".") ||
		short.endsWith(".lock") ||
		short.includes("..") ||
		short.includes("//") ||
		short.includes("@{") ||
		/[~^:?*\\\[\u0000-\u0020\u007f]/u.test(short)
	) {
		throw new Error("Delivery target ref must be an exact safe local branch ref.");
	}
	return ref;
}

function gitObject(value: unknown, label: string): string {
	if (typeof value !== "string" || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value)) {
		throw new Error(`${label} must be a lowercase Git object ID.`);
	}
	return value;
}

function digest(value: unknown, label: string): Sha256Digest {
	if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
		throw new Error(`${label} must be a lowercase sha256 digest.`);
	}
	return value as Sha256Digest;
}

function identity(value: unknown, label: string): string {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > 1024 ||
		/[\u0000-\u001f\u007f]/u.test(value)
	) {
		throw new Error(`${label} is invalid.`);
	}
	return value;
}

