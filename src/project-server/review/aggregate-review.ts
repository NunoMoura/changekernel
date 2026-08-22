import type {ChangeWorkState, ProjectWorkState} from "../../changes/trace/state.ts";
import {
	createReviewAttempt,
	reviewContinuityKey,
	type ReviewAttempt,
} from "../../loops/review/contracts.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export interface CreateAggregateReviewAttemptInput {
	readonly state: ProjectWorkState;
	readonly changeId: string;
	readonly integratedTree: string;
	readonly targetBranch: string;
	readonly producerSessionId: string;
	readonly producingRunId: string;
	readonly producerRunReceiptDigest: Sha256Digest;
	readonly projectContextSnapshotDigest: Sha256Digest;
	readonly checkPackSnapshotDigest: Sha256Digest;
	readonly providerReceiptDigests: readonly Sha256Digest[];
	readonly evidenceRecordDigests: readonly Sha256Digest[];
}

export function createAggregateReviewAttempt(
	input: CreateAggregateReviewAttemptInput,
): ReviewAttempt {
	const change = input.state.changes.find((entry) => entry.changeId === input.changeId);
	if (!change?.currentRevision) {
		throw new Error("Aggregate Review requires one current ratified Change revision.");
	}
	const aggregate = change.implementationAggregate;
	const lineage = change.privateIntegrationLineage;
	const knowledgeHead = input.state.knowledgeHead;
	if (!aggregate || !lineage || !knowledgeHead) {
		throw new Error("Aggregate Review requires frozen Implementation, private lineage, and accepted Knowledge heads.");
	}
	if (
		aggregate.lineageDigest !== lineage.lineageDigest ||
		aggregate.changeRevisionId !== change.currentRevision.revisionId ||
		aggregate.workGraphDigest !== input.state.workGraph.graphDigest
	) {
		throw new Error("Aggregate Review observed stale Implementation or Work Graph authority.");
	}
	const artifacts = implementationArtifacts(change, aggregate.contributingCandidateIds);
	assertExactSet(artifacts.candidateDigests, aggregate.contributingCandidateDigests, "Candidate digest");
	assertExactSet(artifacts.gateReportDigests, aggregate.gateReportDigests, "Implementation Gate Report digest");
	return createReviewAttempt({
		changeId: change.changeId,
		changeRevisionId: change.currentRevision.revisionId,
		knowledgeTransitionDigest: canonicalJsonDigest(change.currentRevision.content.knowledge),
		knowledgeStateDigest: knowledgeHead.stateDigest,
		knowledgeProjectionDigest: knowledgeHead.projectionDigest,
		planningDeltaIds: aggregate.workGraphDeltaIds,
		workGraphDigest: aggregate.workGraphDigest,
		aggregateDigest: aggregate.aggregateDigest,
		lineageDigest: aggregate.lineageDigest,
		targetBaseCommit: aggregate.baseCommit,
		integratedHead: aggregate.headCommit,
		integratedTree: input.integratedTree,
		integratedTreeDigest: aggregate.headTreeDigest,
		targetBranch: input.targetBranch,
		workUnitIds: aggregate.requiredWorkUnitIds,
		candidateIds: aggregate.contributingCandidateIds,
		candidateDigests: aggregate.contributingCandidateDigests,
		implementationGateReportDigests: aggregate.gateReportDigests,
		implementationEvidenceRecordIds: artifacts.evidenceRecordIds,
		implementationResultDigests: artifacts.resultDigests,
		continuityKey: reviewContinuityKey(change.changeId, aggregate.lineageDigest),
		producerSessionId: input.producerSessionId,
		producingRunId: input.producingRunId,
		producerRunReceiptDigest: input.producerRunReceiptDigest,
		projectContextSnapshotDigest: input.projectContextSnapshotDigest,
		checkPackSnapshotDigest: input.checkPackSnapshotDigest,
		providerReceiptDigests: input.providerReceiptDigests,
		evidenceRecordDigests: input.evidenceRecordDigests,
	});
}

export function assertCurrentAggregateReviewAttempt(
	state: ProjectWorkState,
	attempt: ReviewAttempt,
): void {
	const expected = createAggregateReviewAttempt({
		state,
		changeId: attempt.changeId,
		integratedTree: attempt.integratedTree,
		targetBranch: attempt.targetBranch,
		producerSessionId: attempt.producerSessionId,
		producingRunId: attempt.producingRunId,
		producerRunReceiptDigest: attempt.producerRunReceiptDigest,
		projectContextSnapshotDigest: attempt.projectContextSnapshotDigest,
		checkPackSnapshotDigest: attempt.checkPackSnapshotDigest,
		providerReceiptDigests: attempt.providerReceiptDigests,
		evidenceRecordDigests: attempt.evidenceRecordDigests,
	});
	if (canonicalJson(expected) !== canonicalJson(attempt)) {
		throw new Error("Review attempt is stale against current aggregate authority.");
	}
}

interface ImplementationArtifacts {
	readonly candidateDigests: readonly Sha256Digest[];
	readonly gateReportDigests: readonly Sha256Digest[];
	readonly evidenceRecordIds: readonly string[];
	readonly resultDigests: readonly Sha256Digest[];
}

function implementationArtifacts(
	change: ChangeWorkState,
	candidateIds: readonly string[],
): ImplementationArtifacts {
	const wanted = new Set(candidateIds);
	const attemptIds = new Set<string>();
	const candidateDigests: Sha256Digest[] = [];
	for (const operation of change.operations) {
		if (operation.body.kind !== "implementation.candidate_recorded") continue;
		const payload = record(operation.body.payload);
		const candidate = record(payload.candidate);
		if (!wanted.has(text(candidate.id))) continue;
		const content = record(candidate.artifact);
		candidateDigests.push(digest(content.digest, "Implementation Candidate digest"));
		attemptIds.add(text(payload.attemptOperationId));
	}
	if (attemptIds.size !== wanted.size || candidateDigests.length !== wanted.size) {
		throw new Error("Aggregate Review cannot resolve every contributing Candidate operation.");
	}
	const evidenceRecordIds: string[] = [];
	const resultDigests: Sha256Digest[] = [];
	const gateReportDigests: Sha256Digest[] = [];
	for (const operation of change.operations) {
		const payload = record(operation.body.payload);
		if (!attemptIds.has(optionalText(payload.attemptOperationId))) continue;
		if (operation.body.kind === "evidence.recorded") {
			evidenceRecordIds.push(text(record(payload.evidence).id));
		} else if (operation.body.kind === "check.result_recorded") {
			const result = record(record(payload.result).artifact);
			resultDigests.push(digest(result.resultDigest, "Implementation Result digest"));
		} else if (operation.body.kind === "loop.exit_report_recorded") {
			const report = record(record(payload.report).artifact);
			gateReportDigests.push(digest(report.reportDigest, "Implementation Gate Report digest"));
		}
	}
	return Object.freeze({
		candidateDigests: normalized(candidateDigests),
		gateReportDigests: normalized(gateReportDigests),
		evidenceRecordIds: normalized(evidenceRecordIds),
		resultDigests: normalized(resultDigests),
	});
}

function assertExactSet(actual: readonly string[], expected: readonly string[], label: string): void {
	if (canonicalJson(normalized(actual)) !== canonicalJson(normalized(expected))) {
		throw new Error(`Aggregate Review ${label} bindings are incomplete or stale.`);
	}
}

function record(value: unknown): Readonly<Record<string, unknown>> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Aggregate Review canonical operation artifact is malformed.");
	}
	return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown): string {
	if (typeof value !== "string" || value.length === 0) {
		throw new Error("Aggregate Review canonical operation identity is malformed.");
	}
	return value;
}

function optionalText(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function digest(value: unknown, label: string): Sha256Digest {
	if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
		throw new Error(`${label} is malformed.`);
	}
	return value as Sha256Digest;
}

function normalized<T extends string>(values: readonly T[]): readonly T[] {
	return Object.freeze([...new Set(values)].sort(compareText));
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

