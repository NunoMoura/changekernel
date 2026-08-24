import type {
	CheckFailure,
	CheckSubject,
	GateReport,
} from "../../checks/contracts.ts";
import type {EvidenceRecord} from "../../evidence/contracts.ts";
import {
	assertDomainPluginIdentity,
	type DomainPluginIdentity,
} from "../../domains/contracts.ts";
import {assertValidEvidenceRecord} from "../../evidence/materialize.ts";
import {
	assertSha256Digest,
	canonicalJson,
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export const REVIEW_ATTEMPT_SCHEMA_VERSION = "5.0.0" as const;

const REVIEW_ATTEMPT_FIELDS = [
	"domainPlugin",
	"changeId",
	"changeRevisionId",
	"knowledgeTransitionDigest",
	"knowledgeStateDigest",
	"knowledgeProjectionDigest",
	"planningDeltaIds",
	"workGraphDigest",
	"aggregateDigest",
	"lineageDigest",
	"targetBaseCommit",
	"integratedHead",
	"integratedTree",
	"integratedTreeDigest",
	"targetBranch",
	"workUnitIds",
	"candidateIds",
	"candidateDigests",
	"implementationGateReportDigests",
	"implementationEvidenceRecordIds",
	"implementationResultDigests",
	"continuityKey",
	"producerSessionId",
	"producingRunId",
	"producerRunReceiptDigest",
	"projectContextSnapshotDigest",
	"checkPackSnapshotDigest",
	"providerReceiptDigests",
	"evidenceRecordDigests",
] as const;
const MAX_BOUND_IDENTITIES = 4_096;
const MAX_IDENTITY_LENGTH = 512;

export interface CreateReviewAttemptInput {
	readonly domainPlugin: DomainPluginIdentity;
	readonly changeId: string;
	readonly changeRevisionId: Sha256Digest;
	readonly knowledgeTransitionDigest: Sha256Digest;
	readonly knowledgeStateDigest: Sha256Digest;
	readonly knowledgeProjectionDigest: Sha256Digest;
	readonly planningDeltaIds: readonly Sha256Digest[];
	readonly workGraphDigest: Sha256Digest;
	readonly aggregateDigest: Sha256Digest;
	readonly lineageDigest: Sha256Digest;
	readonly targetBaseCommit: string;
	readonly integratedHead: string;
	readonly integratedTree: string;
	readonly integratedTreeDigest: Sha256Digest;
	readonly targetBranch: string;
	readonly workUnitIds: readonly string[];
	readonly candidateIds: readonly string[];
	readonly candidateDigests: readonly Sha256Digest[];
	readonly implementationGateReportDigests: readonly Sha256Digest[];
	readonly implementationEvidenceRecordIds: readonly string[];
	readonly implementationResultDigests: readonly Sha256Digest[];
	readonly continuityKey: string;
	readonly producerSessionId: string;
	readonly producingRunId: string;
	readonly producerRunReceiptDigest: Sha256Digest;
	readonly projectContextSnapshotDigest: Sha256Digest;
	readonly checkPackSnapshotDigest: Sha256Digest;
	readonly providerReceiptDigests: readonly Sha256Digest[];
	readonly evidenceRecordDigests: readonly Sha256Digest[];
}

export interface ReviewAttempt extends CreateReviewAttemptInput {
	readonly schemaVersion: typeof REVIEW_ATTEMPT_SCHEMA_VERSION;
	readonly continuityKey: `review:${string}:${string}`;
	readonly attemptDigest: Sha256Digest;
}

export interface ReviewEvidenceSubmission {
	readonly integratedHead: string;
	readonly integratedTree: string;
	readonly record: EvidenceRecord;
}

export interface ReviewProviderReceiptBinding {
	readonly integratedHead: string;
	readonly receiptDigest: Sha256Digest;
}

export interface ReviewFeedbackItem {
	readonly packId: string;
	readonly checkId: string;
	readonly resultDigest: Sha256Digest;
	readonly failure: CheckFailure;
}

export type ReviewFeedbackOwner = "implementation" | "planning" | "decision";

export interface ReviewFailureOwnership {
	readonly resultDigest: Sha256Digest;
	readonly owner: ReviewFeedbackOwner;
	readonly affectedWorkUnitIds: readonly string[];
}

export type ReviewLifecycleTransition = Readonly<{
	readonly schemaVersion: "2.0.0";
	readonly reviewAttemptDigest: Sha256Digest;
	readonly aggregateDigest: Sha256Digest;
	readonly gateReportDigest: Sha256Digest;
	readonly target:
		| "guarded_delivery"
		| "implementation"
		| "planning_amendment"
		| "decision"
		| "preserve_state";
	readonly reasonCode: string;
	readonly failureOwnership: readonly ReviewFailureOwnership[];
	readonly affectedWorkUnitIds: readonly string[];
	readonly transitionDigest: Sha256Digest;
}>;

export function reviewContinuityKey(
	changeId: string,
	lineageDigest: Sha256Digest,
): `review:${string}:${string}` {
	return `review:${identity(changeId, "changeId")}:${assertSha256Digest(lineageDigest, "Review lineage digest")}`;
}

export function createReviewAttempt(input: CreateReviewAttemptInput): ReviewAttempt {
	assertExactKeys(input);
	const changeId = identity(input.changeId, "changeId");
	const changeRevisionId = digest(input.changeRevisionId, "changeRevisionId");
	const lineageDigest = digest(input.lineageDigest, "lineageDigest");
	const continuityKey = identity(input.continuityKey, "continuityKey");
	if (continuityKey !== reviewContinuityKey(changeId, lineageDigest)) {
		throw new Error("Review continuity key must bind the exact Change and implementation lineage.");
	}
	assertDomainPluginIdentity(input.domainPlugin);
	const body = Object.freeze({
		schemaVersion: REVIEW_ATTEMPT_SCHEMA_VERSION,
		domainPlugin: input.domainPlugin,
		changeId,
		changeRevisionId,
		knowledgeTransitionDigest: digest(input.knowledgeTransitionDigest, "knowledgeTransitionDigest"),
		knowledgeStateDigest: digest(input.knowledgeStateDigest, "knowledgeStateDigest"),
		knowledgeProjectionDigest: digest(input.knowledgeProjectionDigest, "knowledgeProjectionDigest"),
		planningDeltaIds: digests(input.planningDeltaIds, "planningDeltaIds", true),
		workGraphDigest: digest(input.workGraphDigest, "workGraphDigest"),
		aggregateDigest: digest(input.aggregateDigest, "aggregateDigest"),
		lineageDigest,
		targetBaseCommit: gitObjectId(input.targetBaseCommit, "targetBaseCommit"),
		integratedHead: gitObjectId(input.integratedHead, "integratedHead"),
		integratedTree: gitObjectId(input.integratedTree, "integratedTree"),
		integratedTreeDigest: digest(input.integratedTreeDigest, "integratedTreeDigest"),
		targetBranch: targetBranch(input.targetBranch),
		workUnitIds: identities(input.workUnitIds, "workUnitIds", true),
		candidateIds: identities(input.candidateIds, "candidateIds", true),
		candidateDigests: digests(input.candidateDigests, "candidateDigests", true),
		implementationGateReportDigests: digests(
			input.implementationGateReportDigests,
			"implementationGateReportDigests",
			true,
		),
		implementationEvidenceRecordIds: identities(
			input.implementationEvidenceRecordIds,
			"implementationEvidenceRecordIds",
			false,
		),
		implementationResultDigests: digests(
			input.implementationResultDigests,
			"implementationResultDigests",
			false,
		),
		continuityKey,
		producerSessionId: identity(input.producerSessionId, "producerSessionId"),
		producingRunId: identity(input.producingRunId, "producingRunId"),
		producerRunReceiptDigest: digest(input.producerRunReceiptDigest, "producerRunReceiptDigest"),
		projectContextSnapshotDigest: digest(
			input.projectContextSnapshotDigest,
			"projectContextSnapshotDigest",
		),
		checkPackSnapshotDigest: digest(input.checkPackSnapshotDigest, "checkPackSnapshotDigest"),
		providerReceiptDigests: digests(input.providerReceiptDigests, "providerReceiptDigests", false),
		evidenceRecordDigests: digests(input.evidenceRecordDigests, "evidenceRecordDigests", false),
	});
	if (
		body.workUnitIds.length !== body.candidateIds.length ||
		body.workUnitIds.length !== body.candidateDigests.length ||
		body.workUnitIds.length !== body.implementationGateReportDigests.length
	) {
		throw new Error("Review Work Unit, Candidate, and Implementation Gate bindings must have equal cardinality.");
	}
	return Object.freeze({...body, attemptDigest: canonicalJsonDigest(body)}) as ReviewAttempt;
}

export function reviewSubjectFromAttempt(attempt: ReviewAttempt): CheckSubject {
	const {attemptDigest: _attemptDigest, schemaVersion: _schemaVersion, ...input} = attempt;
	const expected = createReviewAttempt(input);
	if (canonicalJson(attempt) !== canonicalJson(expected)) {
		throw new Error("Review attempt identity is invalid.");
	}
	const subject = {
		stage: "review" as const,
		id: `review-attempt:${attempt.attemptDigest.slice("sha256:".length)}`,
		schemaVersion: attempt.schemaVersion,
		domainPlugin: attempt.domainPlugin,
		content: toCanonicalJsonValue(attempt),
	};
	return Object.freeze({...subject, digest: canonicalJsonDigest(subject)});
}

export function admitReviewEvidence(input: {
	readonly attempt: ReviewAttempt;
	readonly evidence: readonly ReviewEvidenceSubmission[];
	readonly providerReceipts: readonly ReviewProviderReceiptBinding[];
}): readonly EvidenceRecord[] {
	const evidence = input.evidence.map((submission) => {
		assertOnlyKeys(submission, ["integratedHead", "integratedTree", "record"], "Review Evidence submission");
		if (
			submission.integratedHead !== input.attempt.integratedHead ||
			submission.integratedTree !== input.attempt.integratedTree
		) {
			throw new Error("Review Evidence does not bind the exact integrated head and tree.");
		}
		return submission.record;
	});
	assertReviewEvidenceRecords(input.attempt, evidence);
	const providerDigests = input.providerReceipts.map((receipt) => {
		assertOnlyKeys(receipt, ["integratedHead", "receiptDigest"], "Review provider receipt binding");
		if (receipt.integratedHead !== input.attempt.integratedHead) {
			throw new Error("Review provider receipt does not bind the exact integrated head.");
		}
		return digest(receipt.receiptDigest, "provider receipt digest");
	});
	assertExactDigestSet(providerDigests, input.attempt.providerReceiptDigests, "provider receipt");
	return Object.freeze([...evidence]);
}

export function assertReviewEvidenceRecords(
	attempt: ReviewAttempt,
	evidence: readonly EvidenceRecord[],
): void {
	for (const record of evidence) assertValidEvidenceRecord(record);
	assertExactDigestSet(
		evidence.map((record) => canonicalJsonDigest(record)),
		attempt.evidenceRecordDigests,
		"Evidence",
	);
}

export function reviewFeedbackFromGate(input: {
	readonly attempt: ReviewAttempt;
	readonly report: GateReport;
}): readonly ReviewFeedbackItem[] {
	assertReviewGateIdentity(input.attempt, input.report);
	return Object.freeze(
		input.report.results
			.filter((result) => result.status === "failed" && result.failure !== undefined)
			.map((result) =>
				Object.freeze({
					packId: result.packId,
					checkId: result.checkId,
					resultDigest: result.resultDigest,
					failure: result.failure as CheckFailure,
				}),
			),
	);
}

export function normalizeReviewFailureOwnership(input: {
	readonly attempt: ReviewAttempt;
	readonly report: GateReport;
	readonly ownership?: readonly ReviewFailureOwnership[];
}): readonly ReviewFailureOwnership[] {
	assertReviewGateIdentity(input.attempt, input.report);
	const failed = input.report.results.filter((result) => result.status === "failed");
	if (failed.length === 0) {
		if ((input.ownership?.length ?? 0) > 0) throw new Error("Passed or stopped Review cannot route failure ownership.");
		return Object.freeze([]);
	}
	const supplied = input.ownership ?? failed.map((result) => ({
		resultDigest: result.resultDigest,
		owner: "implementation" as const,
		affectedWorkUnitIds: input.attempt.workUnitIds,
	}));
	const byResult = new Map(supplied.map((entry) => [entry.resultDigest, entry]));
	if (byResult.size !== supplied.length || failed.some((result) => !byResult.has(result.resultDigest))) {
		throw new Error("Review failure ownership must classify every failed Result exactly once.");
	}
	const normalized = failed.map((result) => {
		const entry = byResult.get(result.resultDigest) as ReviewFailureOwnership;
		if (!(["implementation", "planning", "decision"] as const).includes(entry.owner)) {
			throw new Error("Review failure ownership target is invalid.");
		}
		const affected = identities(entry.affectedWorkUnitIds, "affectedWorkUnitIds", entry.owner === "implementation");
		if (affected.some((id) => !input.attempt.workUnitIds.includes(id))) {
			throw new Error("Review failure ownership references a Work Unit outside the aggregate.");
		}
		if (entry.owner !== "implementation" && affected.length > 0) {
			throw new Error("Planning and Decision Review routes cannot claim affected Work Units.");
		}
		return Object.freeze({resultDigest: result.resultDigest, owner: entry.owner, affectedWorkUnitIds: affected});
	});
	return Object.freeze(normalized);
}

function assertReviewGateIdentity(attempt: ReviewAttempt, report: GateReport): void {
	if (report.stage !== "review" || report.subjectDigest !== reviewSubjectFromAttempt(attempt).digest) {
		throw new Error("Review Gate Report identity does not match Review attempt.");
	}
}

function assertExactDigestSet(actual: readonly Sha256Digest[], expected: readonly Sha256Digest[], label: string): void {
	const normalized = [...new Set(actual)].sort(compareText);
	if (
		normalized.length !== actual.length ||
		normalized.length !== expected.length ||
		normalized.some((value, index) => value !== expected[index])
	) {
		throw new Error(`Review ${label} digests do not match the admitted attempt.`);
	}
}

function assertOnlyKeys<T extends object>(value: T, allowed: readonly string[], label: string): void {
	const unsupported = Object.keys(value).filter((key) => !allowed.includes(key));
	if (unsupported.length > 0) throw new Error(`${label} has unsupported fields: ${unsupported.join(", ")}.`);
}

function assertExactKeys<T extends object>(value: T): void {
	const expected = new Set<string>(REVIEW_ATTEMPT_FIELDS);
	const actual = Object.keys(value);
	const unsupported = actual.filter((key) => !expected.has(key)).sort(compareText);
	const missing = REVIEW_ATTEMPT_FIELDS.filter((key) => !Object.hasOwn(value, key));
	if (unsupported.length > 0 || missing.length > 0) {
		throw new Error(
			`Review attempt fields are invalid; unsupported=${unsupported.join(",") || "none"}; missing=${missing.join(",") || "none"}.`,
		);
	}
}

function gitObjectId(value: unknown, field: string): string {
	if (typeof value !== "string" || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value)) {
		throw new Error(`Review ${field} must be a lowercase full Git object id.`);
	}
	return value;
}

function targetBranch(value: unknown): string {
	const branch = identity(value, "targetBranch");
	const short = branch.slice("refs/heads/".length);
	if (
		!branch.startsWith("refs/heads/") ||
		short.length === 0 ||
		short.startsWith("/") ||
		short.endsWith("/") ||
		short.endsWith(".") ||
		short.endsWith(".lock") ||
		short.includes("..") ||
		short.includes("//") ||
		short.includes("@{") ||
		/[~^:?*\\[\u0000-\u0020\u007f]/u.test(short)
	) {
		throw new Error("Review targetBranch must be an exact safe local branch ref.");
	}
	return branch;
}

function identities(values: unknown, field: string, required: boolean): readonly string[] {
	if (!Array.isArray(values) || values.length > MAX_BOUND_IDENTITIES) {
		throw new Error(`Review ${field} must be a bounded array.`);
	}
	const normalized = values.map((value, index) => identity(value, `${field}[${index}]`));
	if (required && normalized.length === 0) throw new Error(`Review ${field} must not be empty.`);
	const unique = [...new Set(normalized)].sort(compareText);
	if (unique.length !== normalized.length) throw new Error(`Review ${field} must not contain duplicates.`);
	return Object.freeze(unique);
}

function digests(values: unknown, field: string, required: boolean): readonly Sha256Digest[] {
	return identities(values, field, required).map((value, index) => digest(value, `${field}[${index}]`));
}

function digest(value: unknown, field: string): Sha256Digest {
	return assertSha256Digest(value, `Review ${field}`);
}

function identity(value: unknown, field: string): string {
	if (typeof value !== "string") throw new Error(`Review ${field} must be text.`);
	const normalized = value.trim();
	if (
		normalized !== value ||
		normalized.length === 0 ||
		normalized.length > MAX_IDENTITY_LENGTH ||
		/[\u0000-\u001f\u007f]/u.test(normalized)
	) {
		throw new Error(`Review ${field} is invalid.`);
	}
	return normalized;
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}
