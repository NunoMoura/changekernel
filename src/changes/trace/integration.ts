import type {KnowledgeTargetRef} from "./contracts.ts";
import {
	assertSha256Digest,
	canonicalJson,
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export const PRIVATE_INTEGRATION_RECEIPT_SCHEMA_VERSION = "1.0.0" as const;
export const PRIVATE_CHANGE_INTEGRATION_LINEAGE_SCHEMA_VERSION = "1.0.0" as const;
export const IMPLEMENTATION_AGGREGATE_SCHEMA_VERSION = "1.0.0" as const;

export type ExpectedIntegrationLineage = Sha256Digest | "absent";
export type PrivateIntegrationStatus = "integrated" | "conflicted";

export interface PrivateIntegrationAcceptanceSlice {
	readonly knowledgeEffectIds: readonly string[];
	readonly unchangedKnowledgeTargets: readonly KnowledgeTargetRef[];
	readonly acceptanceRequirementIds: readonly string[];
};

export interface PrivateIntegrationReceipt {
	readonly schemaVersion: typeof PRIVATE_INTEGRATION_RECEIPT_SCHEMA_VERSION;
	readonly receiptId: string;
	readonly receiptDigest: Sha256Digest;
	readonly changeId: string;
	readonly changeRevisionId: Sha256Digest;
	readonly workGraphDigest: Sha256Digest;
	readonly workGraphDeltaId: Sha256Digest;
	readonly workUnitId: string;
	readonly workUnitDigest: Sha256Digest;
	readonly dependencyWorkUnitIds: readonly string[];
	readonly candidateId: string;
	readonly candidateDigest: Sha256Digest;
	readonly gateReportDigest: Sha256Digest;
	readonly assignmentAttemptId: string;
	readonly assignmentDigest: Sha256Digest;
	readonly workbenchId: string;
	readonly workbenchDigest: Sha256Digest;
	readonly custodyReceiptDigests: readonly Sha256Digest[];
	readonly candidateTreeDigest: Sha256Digest;
	readonly changedPaths: readonly string[];
	readonly acceptanceSlice: PrivateIntegrationAcceptanceSlice;
	readonly targetRef: string;
	readonly expectedLineageDigest: ExpectedIntegrationLineage;
	readonly baseCommit: string;
	readonly status: PrivateIntegrationStatus;
	readonly resultCommit: string | null;
	readonly resultTreeDigest: Sha256Digest | null;
	readonly conflictRefs: readonly string[];
	readonly recordedAt: string;
};

export interface CreatePrivateIntegrationReceiptInput {
	readonly changeId: string;
	readonly changeRevisionId: Sha256Digest;
	readonly workGraphDigest: Sha256Digest;
	readonly workGraphDeltaId: Sha256Digest;
	readonly workUnitId: string;
	readonly workUnitDigest: Sha256Digest;
	readonly dependencyWorkUnitIds: readonly string[];
	readonly candidateId: string;
	readonly candidateDigest: Sha256Digest;
	readonly gateReportDigest: Sha256Digest;
	readonly assignmentAttemptId: string;
	readonly assignmentDigest: Sha256Digest;
	readonly workbenchId: string;
	readonly workbenchDigest: Sha256Digest;
	readonly custodyReceiptDigests: readonly Sha256Digest[];
	readonly candidateTreeDigest: Sha256Digest;
	readonly changedPaths: readonly string[];
	readonly acceptanceSlice: PrivateIntegrationAcceptanceSlice;
	readonly expectedLineageDigest: ExpectedIntegrationLineage;
	readonly baseCommit: string;
	readonly status: PrivateIntegrationStatus;
	readonly resultCommit: string | null;
	readonly resultTreeDigest: Sha256Digest | null;
	readonly conflictRefs?: readonly string[];
	readonly recordedAt: string;
}

export interface PrivateIntegratedWorkUnit {
	readonly workUnitId: string;
	readonly candidateId: string;
	readonly candidateDigest: Sha256Digest;
	readonly gateReportDigest: Sha256Digest;
	readonly receiptId: string;
	readonly receiptDigest: Sha256Digest;
	readonly resultCommit: string;
	readonly resultTreeDigest: Sha256Digest;
	readonly acceptanceSlice: PrivateIntegrationAcceptanceSlice;
};

export interface PrivateIntegrationReceiptProjection {
	readonly receiptId: string;
	readonly receiptDigest: Sha256Digest;
	readonly workUnitId: string;
	readonly candidateId: string;
	readonly status: PrivateIntegrationStatus;
};

export interface PrivateChangeIntegrationLineageBody {
	readonly schemaVersion: typeof PRIVATE_CHANGE_INTEGRATION_LINEAGE_SCHEMA_VERSION;
	readonly changeId: string;
	readonly changeRevisionId: Sha256Digest;
	readonly targetRef: string;
	readonly baseCommit: string;
	readonly headCommit: string;
	readonly headTreeDigest: Sha256Digest | null;
	readonly receipts: readonly PrivateIntegrationReceiptProjection[];
	readonly integratedWorkUnits: readonly PrivateIntegratedWorkUnit[];
};

export type PrivateChangeIntegrationLineage = PrivateChangeIntegrationLineageBody & {
	readonly lineageDigest: Sha256Digest;
};

export interface FrozenImplementationAggregateBody {
	readonly schemaVersion: typeof IMPLEMENTATION_AGGREGATE_SCHEMA_VERSION;
	readonly changeId: string;
	readonly changeRevisionId: Sha256Digest;
	readonly workGraphDigest: Sha256Digest;
	readonly workGraphDeltaIds: readonly Sha256Digest[];
	readonly lineageDigest: Sha256Digest;
	readonly targetRef: string;
	readonly baseCommit: string;
	readonly headCommit: string;
	readonly headTreeDigest: Sha256Digest;
	readonly requiredWorkUnitIds: readonly string[];
	readonly integrationReceiptIds: readonly string[];
	readonly contributingCandidateIds: readonly string[];
	readonly contributingCandidateDigests: readonly Sha256Digest[];
	readonly gateReportDigests: readonly Sha256Digest[];
	readonly knowledgeEffectIds: readonly string[];
	readonly unchangedKnowledgeTargets: readonly KnowledgeTargetRef[];
	readonly acceptanceRequirementIds: readonly string[];
	readonly frozenAt: string;
};

export type FrozenImplementationAggregate = FrozenImplementationAggregateBody & {
	readonly aggregateDigest: Sha256Digest;
};

export function privateChangeIntegrationRef(changeId: string): string {
	const id = requiredText(changeId, "Change ID");
	return `refs/codewiki/private-integration/${canonicalJsonDigest(id).slice(7)}`;
}

export function createPrivateIntegrationReceipt(
	input: CreatePrivateIntegrationReceiptInput,
): PrivateIntegrationReceipt {
	const status = input.status;
	if (status === "integrated" && (!input.resultCommit || !input.resultTreeDigest)) {
		throw new Error("Integrated private lineage receipt requires result commit and tree.");
	}
	if (status === "conflicted" && (input.resultCommit || input.resultTreeDigest)) {
		throw new Error("Conflicted private lineage receipt cannot claim result bytes.");
	}
	const conflictRefs = normalizedIds(input.conflictRefs ?? [], "Conflict ref");
	if ((status === "conflicted") !== (conflictRefs.length > 0)) {
		throw new Error("Private integration conflict status and refs disagree.");
	}
	const targetRef = privateChangeIntegrationRef(input.changeId);
	const body = {
		schemaVersion: PRIVATE_INTEGRATION_RECEIPT_SCHEMA_VERSION,
		changeId: requiredText(input.changeId, "Change ID"),
		changeRevisionId: assertSha256Digest(input.changeRevisionId, "Change revision digest"),
		workGraphDigest: assertSha256Digest(input.workGraphDigest, "Work Graph digest"),
		workGraphDeltaId: assertSha256Digest(input.workGraphDeltaId, "Work Graph delta digest"),
		workUnitId: requiredText(input.workUnitId, "Work Unit ID"),
		workUnitDigest: assertSha256Digest(input.workUnitDigest, "Work Unit digest"),
		dependencyWorkUnitIds: normalizedIds(input.dependencyWorkUnitIds, "Dependency Work Unit ID"),
		candidateId: requiredText(input.candidateId, "Candidate ID"),
		candidateDigest: assertSha256Digest(input.candidateDigest, "Candidate digest"),
		gateReportDigest: assertSha256Digest(input.gateReportDigest, "Gate Report digest"),
		assignmentAttemptId: requiredText(input.assignmentAttemptId, "Assignment attempt ID"),
		assignmentDigest: assertSha256Digest(input.assignmentDigest, "Assignment digest"),
		workbenchId: requiredText(input.workbenchId, "Workbench ID"),
		workbenchDigest: assertSha256Digest(input.workbenchDigest, "Workbench digest"),
		custodyReceiptDigests: normalizedDigests(input.custodyReceiptDigests, "Custody receipt digest"),
		candidateTreeDigest: assertSha256Digest(input.candidateTreeDigest, "Candidate tree digest"),
		changedPaths: normalizedIds(input.changedPaths, "Changed path"),
		acceptanceSlice: normalizedAcceptanceSlice(input.acceptanceSlice),
		targetRef,
		expectedLineageDigest:
			input.expectedLineageDigest === "absent"
				? "absent"
				: assertSha256Digest(input.expectedLineageDigest, "Expected lineage digest"),
		baseCommit: normalizedGitObject(input.baseCommit, "Private lineage base commit"),
		status,
		resultCommit: input.resultCommit ? normalizedGitObject(input.resultCommit, "Integration result commit") : null,
		resultTreeDigest: input.resultTreeDigest
			? assertSha256Digest(input.resultTreeDigest, "Integration result tree digest")
			: null,
		conflictRefs,
		recordedAt: normalizedTimestamp(input.recordedAt),
	};
	const receiptDigest = canonicalJsonDigest(body);
	// SAFETY: every field is normalized above and this conversion only deep-freezes canonical JSON.
	return toCanonicalJsonValue({
		...body,
		receiptId: `private-integration-receipt:${receiptDigest.slice(7)}`,
		receiptDigest,
	}) as unknown as PrivateIntegrationReceipt;
}

export function assertPrivateIntegrationReceipt(receipt: PrivateIntegrationReceipt): void {
	const expected = createPrivateIntegrationReceipt({
		changeId: receipt.changeId,
		changeRevisionId: receipt.changeRevisionId,
		workGraphDigest: receipt.workGraphDigest,
		workGraphDeltaId: receipt.workGraphDeltaId,
		workUnitId: receipt.workUnitId,
		workUnitDigest: receipt.workUnitDigest,
		dependencyWorkUnitIds: receipt.dependencyWorkUnitIds,
		candidateId: receipt.candidateId,
		candidateDigest: receipt.candidateDigest,
		gateReportDigest: receipt.gateReportDigest,
		assignmentAttemptId: receipt.assignmentAttemptId,
		assignmentDigest: receipt.assignmentDigest,
		workbenchId: receipt.workbenchId,
		workbenchDigest: receipt.workbenchDigest,
		custodyReceiptDigests: receipt.custodyReceiptDigests,
		candidateTreeDigest: receipt.candidateTreeDigest,
		changedPaths: receipt.changedPaths,
		acceptanceSlice: receipt.acceptanceSlice,
		expectedLineageDigest: receipt.expectedLineageDigest,
		baseCommit: receipt.baseCommit,
		status: receipt.status,
		resultCommit: receipt.resultCommit,
		resultTreeDigest: receipt.resultTreeDigest,
		conflictRefs: receipt.conflictRefs,
		recordedAt: receipt.recordedAt,
	});
	if (canonicalJson(receipt) !== canonicalJson(expected)) {
		throw new Error("Private integration receipt identity is invalid.");
	}
}

export function applyPrivateIntegrationReceipt(
	current: PrivateChangeIntegrationLineage | null,
	receipt: PrivateIntegrationReceipt,
	options: { readonly allowWorkUnitReplacement?: boolean } = {},
): PrivateChangeIntegrationLineage {
	assertPrivateIntegrationReceipt(receipt);
	const expectedDigest = current?.lineageDigest ?? "absent";
	if (receipt.expectedLineageDigest !== expectedDigest) {
		throw new Error("Private integration lineage expected-head CAS failed.");
	}
	if (
		current &&
		(current.changeId !== receipt.changeId ||
			current.changeRevisionId !== receipt.changeRevisionId ||
			current.targetRef !== receipt.targetRef)
	) {
		throw new Error("Private integration receipt targets another Change lineage.");
	}
	const currentHead = current?.headCommit ?? receipt.baseCommit;
	if (receipt.baseCommit !== currentHead) {
		throw new Error("Private integration receipt base is stale.");
	}
	if (current?.receipts.some((entry) => entry.receiptId === receipt.receiptId)) {
		throw new Error("Private integration receipt was already reduced.");
	}
	const existingWorkUnitIndex =
		current?.integratedWorkUnits.findIndex(
			(entry) => entry.workUnitId === receipt.workUnitId,
		) ?? -1;
	if (
		receipt.status === "integrated" &&
		existingWorkUnitIndex >= 0 &&
		!options.allowWorkUnitReplacement
	) {
		throw new Error(`Work Unit ${receipt.workUnitId} is already integrated.`);
	}
	const receipts = [
		...(current?.receipts ?? []),
		{
			receiptId: receipt.receiptId,
			receiptDigest: receipt.receiptDigest,
			workUnitId: receipt.workUnitId,
			candidateId: receipt.candidateId,
			status: receipt.status,
		},
	];
	const integratedWorkUnits = [...(current?.integratedWorkUnits ?? [])];
	if (receipt.status === "integrated") {
		const integrated = {
			workUnitId: receipt.workUnitId,
			candidateId: receipt.candidateId,
			candidateDigest: receipt.candidateDigest,
			gateReportDigest: receipt.gateReportDigest,
			receiptId: receipt.receiptId,
			receiptDigest: receipt.receiptDigest,
			resultCommit: requiredText(receipt.resultCommit ?? "", "Integration result commit"),
			resultTreeDigest: requiredDigest(receipt.resultTreeDigest, "Integration result tree"),
			acceptanceSlice: receipt.acceptanceSlice,
		};
		if (existingWorkUnitIndex >= 0) {
			integratedWorkUnits.splice(existingWorkUnitIndex, 1, integrated);
		} else {
			integratedWorkUnits.push(integrated);
		}
	}
	return materializePrivateIntegrationLineage({
		schemaVersion: PRIVATE_CHANGE_INTEGRATION_LINEAGE_SCHEMA_VERSION,
		changeId: receipt.changeId,
		changeRevisionId: receipt.changeRevisionId,
		targetRef: receipt.targetRef,
		baseCommit: current?.baseCommit ?? receipt.baseCommit,
		headCommit: receipt.resultCommit ?? currentHead,
		headTreeDigest: receipt.resultTreeDigest ?? current?.headTreeDigest ?? null,
		receipts,
		integratedWorkUnits,
	});
}

export function materializePrivateIntegrationLineage(
	body: PrivateChangeIntegrationLineageBody,
): PrivateChangeIntegrationLineage {
	// SAFETY: body is already typed as the complete lineage body; conversion only deep-freezes it.
	const canonical = toCanonicalJsonValue(body) as unknown as PrivateChangeIntegrationLineageBody;
	// SAFETY: adding the digest completes the exact lineage interface.
	return toCanonicalJsonValue({
		...canonical,
		lineageDigest: canonicalJsonDigest(canonical),
	}) as unknown as PrivateChangeIntegrationLineage;
}

export function assertPrivateIntegrationLineage(
	lineage: PrivateChangeIntegrationLineage,
): void {
	const {lineageDigest: _lineageDigest, ...body} = lineage;
	const expected = materializePrivateIntegrationLineage(body as PrivateChangeIntegrationLineageBody);
	if (canonicalJson(lineage) !== canonicalJson(expected)) {
		throw new Error("Private Change integration lineage identity is invalid.");
	}
}

export function materializeFrozenImplementationAggregate(
	body: FrozenImplementationAggregateBody,
): FrozenImplementationAggregate {
	// SAFETY: body is already typed as the complete aggregate body; conversion only deep-freezes it.
	const canonical = toCanonicalJsonValue(body) as unknown as FrozenImplementationAggregateBody;
	// SAFETY: adding the digest completes the exact aggregate interface.
	return toCanonicalJsonValue({
		...canonical,
		aggregateDigest: canonicalJsonDigest(canonical),
	}) as unknown as FrozenImplementationAggregate;
}

export function assertFrozenImplementationAggregate(
	aggregate: FrozenImplementationAggregate,
): void {
	const {aggregateDigest: _aggregateDigest, ...body} = aggregate;
	const expected = materializeFrozenImplementationAggregate(body as FrozenImplementationAggregateBody);
	if (canonicalJson(aggregate) !== canonicalJson(expected)) {
		throw new Error("Frozen Implementation aggregate identity is invalid.");
	}
}

function normalizedAcceptanceSlice(
	value: PrivateIntegrationAcceptanceSlice,
): PrivateIntegrationAcceptanceSlice {
	const unchangedKnowledgeTargets = [...value.unchangedKnowledgeTargets].sort((left, right) =>
		compareText(canonicalJson(left), canonicalJson(right)),
	);
	if (
		new Set(unchangedKnowledgeTargets.map((target) => canonicalJson(target))).size !==
		unchangedKnowledgeTargets.length
	) {
		throw new Error("Unchanged Knowledge targets must be unique.");
	}
	return {
		knowledgeEffectIds: normalizedIds(value.knowledgeEffectIds, "Knowledge Effect ID"),
		unchangedKnowledgeTargets,
		acceptanceRequirementIds: normalizedIds(
			value.acceptanceRequirementIds,
			"Acceptance requirement ID",
		),
	};
}

function normalizedDigests(
	values: readonly Sha256Digest[],
	label: string,
): readonly Sha256Digest[] {
	const normalized = values.map((value) => assertSha256Digest(value, label)).sort(compareText);
	if (new Set(normalized).size !== normalized.length) {
		throw new Error(`${label} values must be unique.`);
	}
	return normalized;
}

function normalizedGitObject(value: string, label: string): string {
	const normalized = requiredText(value, label);
	if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(normalized)) {
		throw new Error(`${label} must be a lowercase Git object ID.`);
	}
	return normalized;
}

function normalizedIds(values: readonly string[], label: string): readonly string[] {
	const normalized = values.map((value) => requiredText(value, label)).sort(compareText);
	if (new Set(normalized).size !== normalized.length) {
		throw new Error(`${label} values must be unique.`);
	}
	return normalized;
}

function normalizedTimestamp(value: string): string {
	const normalized = requiredText(value, "Integration timestamp");
	if (Number.isNaN(Date.parse(normalized))) {
		throw new Error("Integration timestamp is invalid.");
	}
	return normalized;
}

function requiredText(value: string, label: string): string {
	const normalized = value.trim();
	if (!normalized) throw new Error(`${label} must be non-empty text.`);
	return normalized;
}

function requiredDigest(value: Sha256Digest | null, label: string): Sha256Digest {
	if (!value) throw new Error(`${label} is required.`);
	return value;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
