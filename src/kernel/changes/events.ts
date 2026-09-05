import {
	arrayField,
	assertDigestMatch,
	decodeContract,
	exactRecord,
	isNamespacedIdentifier,
	literalField,
	nullableValue,
	protocolField,
	protocolIdentity,
	rejectContract,
	requiredField,
	sortedUniqueTextArray,
	textField,
	type CanonicalRecord,
	type ContractIssue,
} from "../canonical/contract.ts";
import type {CanonicalValue} from "../canonical/json.ts";
import {failure, type Outcome} from "../canonical/outcome.ts";
import {CHECK_STAGES, type CheckStage} from "../gates/contracts.ts";
import {decodeGitOidValue, gitOidText, type GitOid} from "../identity/git.ts";
import {semanticDigest, type SemanticIdentityIssue} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";
import {decodeWorkValue, validateWorkPlan, workPlanDigest, type Work} from "../work/contracts.ts";
import {decodeChangeValue, type Change} from "./contracts.ts";

export const CHANGE_EVENT_PROTOCOL = protocolIdentity("codewiki.change-event", "1.1.0");
export const CONTAINING_COMMIT = "containing_commit" as const;
export const CHANGE_EVENT_KINDS = Object.freeze([
	"change.committed",
	"change.completed",
	"change.deferred",
	"change.planned",
	"change.proposed",
	"change.rejected",
	"change.resumed",
	"change.revised",
	"change.superseded",
	"change.withdrawn",
	"effect.recorded",
	"gate.recorded",
	"review.reconciled",
	"work.assigned",
	"work.attempt.recorded",
	"work.claimed",
	"work.integrated",
] as const);

export type ChangeEventKind = (typeof CHANGE_EVENT_KINDS)[number];
export type SemanticEventOwners = Readonly<{[event: string]: string}>;

export interface ProposedPayload {readonly change: Change;}
export interface DecisionPayload {readonly reason: string; readonly gateDigest: Sha256Digest;}
export interface ResumedPayload {readonly reason: string;}
export interface CommittedPayload {readonly decisionGateDigest: Sha256Digest; readonly wikiTree: GitOid;}
export interface PlannedPayload {readonly planningGateDigest: Sha256Digest; readonly planDigest: Sha256Digest; readonly work: readonly Work[];}
export type RecordedGateStatus = "failed" | "passed" | "stopped";

export interface GateRecordedPayload {
	readonly gateDigest: Sha256Digest;
	readonly outcomeDigest: Sha256Digest;
	readonly stage: CheckStage;
	readonly status: RecordedGateStatus;
	readonly subjectDigest: Sha256Digest;
	readonly workId: string | null;
	readonly runDigests: readonly Sha256Digest[];
	readonly resultDigests: readonly Sha256Digest[];
	readonly evidenceDigests: readonly Sha256Digest[];
}
export interface WorkClaimedPayload {readonly workId: string; readonly claimId: string; readonly receiptDigest: Sha256Digest;}
export interface WorkAssignedPayload {
	readonly workId: string;
	readonly claimId: string;
	readonly assignmentId: string;
	readonly baseCommit: GitOid;
	readonly baseTree: GitOid;
	readonly runRequestDigest: Sha256Digest;
}
export interface WorkAttemptPayload {
	readonly workId: string;
	readonly assignmentId: string;
	readonly runId: string;
	readonly runReceiptDigest: Sha256Digest;
	readonly resultCommit: GitOid;
	readonly resultTree: GitOid;
}
export interface WorkIntegratedPayload {
	readonly workId: string;
	readonly resultCommit: GitOid;
	readonly resultTree: GitOid;
	readonly implementationGateDigest: Sha256Digest;
}
export interface ReviewReconciledPayload {
	readonly prospectiveTree: GitOid;
	readonly integratedWorkIds: readonly string[];
	readonly reviewSubjectDigest: Sha256Digest;
}
export interface CompletedPayload {readonly completionTree: GitOid; readonly reviewGateDigest: Sha256Digest | null;}
export interface SupersededPayload {readonly supersedingChangeId: string; readonly supersedingCommit: GitOid;}
export interface EffectRecordedPayload {
	readonly capability: string;
	readonly authorizationId: string;
	readonly kernelBuildDigest: Sha256Digest;
	readonly requestDigest: Sha256Digest;
	readonly receiptDigest: Sha256Digest;
	readonly status: "failed" | "passed" | "stopped";
	readonly subjectOids: readonly GitOid[];
}

export type ChangeEventPayload =
	| ProposedPayload
	| DecisionPayload
	| ResumedPayload
	| CommittedPayload
	| PlannedPayload
	| GateRecordedPayload
	| WorkClaimedPayload
	| WorkAssignedPayload
	| WorkAttemptPayload
	| WorkIntegratedPayload
	| ReviewReconciledPayload
	| CompletedPayload
	| SupersededPayload
	| EffectRecordedPayload;

export interface ChangeEventBody {
	readonly protocol: typeof CHANGE_EVENT_PROTOCOL;
	readonly kind: ChangeEventKind;
	readonly ownerItemId: string;
	readonly actorId: string;
	readonly authorityId: string;
	readonly commandId: string;
	readonly commandDigest: Sha256Digest;
	readonly occurredAt: string;
	readonly expectedProjectHead: GitOid;
	readonly expectedChangeTip: GitOid | null;
	readonly containingCommit: typeof CONTAINING_COMMIT;
	readonly predecessorEventDigest: Sha256Digest | null;
	readonly payload: ChangeEventPayload;
}

export interface ChangeEvent extends ChangeEventBody {
	readonly eventDigest: Sha256Digest;
}

export function createChangeEvent(
	body: Omit<ChangeEventBody, "protocol" | "containingCommit">,
	owners: SemanticEventOwners,
): Outcome<ChangeEvent, ContractIssue | SemanticIdentityIssue> {
	const value = {...body, protocol: CHANGE_EVENT_PROTOCOL, containingCommit: CONTAINING_COMMIT};
	const digest = semanticDigest(protocolLabel(), value);
	if (!digest.ok) return failure(digest.error);
	return decodeChangeEvent({...value, eventDigest: digest.value}, owners);
}

export function decodeChangeEvent(
	input: unknown,
	owners: SemanticEventOwners,
): Outcome<ChangeEvent, ContractIssue> {
	return decodeContract("Change event", input, (value) => decodeChangeEventValue(value, owners));
}

export function decodeChangeEventValue(
	value: CanonicalValue,
	owners: SemanticEventOwners,
	path = "$",
): ChangeEvent {
	const record = exactRecord("Change event", value, path, [
		"actorId",
		"authorityId",
		"commandDigest",
		"commandId",
		"containingCommit",
		"eventDigest",
		"expectedChangeTip",
		"expectedProjectHead",
		"kind",
		"occurredAt",
		"ownerItemId",
		"payload",
		"predecessorEventDigest",
		"protocol",
	]);
	protocolField("Change event", record, path, CHANGE_EVENT_PROTOCOL);
	const kind = literalField("Change event", record, "kind", CHANGE_EVENT_KINDS, path);
	const ownerItemId = namespacedField(record, "ownerItemId", path);
	const expectedOwner = owners[kind];
	if (expectedOwner === undefined || expectedOwner !== ownerItemId) {
		rejectContract("invalid_field", "Change event", `${path}.ownerItemId`, "Semantic event owner is absent or does not match native ownership.");
	}
	const marker = textField("Change event", record, "containingCommit", path, {maximumBytes: 32});
	if (marker !== CONTAINING_COMMIT) rejectContract("invalid_field", "Change event", `${path}.containingCommit`, `Expected ${CONTAINING_COMMIT}.`);
	const expectedProjectHead = decodeGitOidValue(requiredField("Change event", record, "expectedProjectHead", path), `${path}.expectedProjectHead`);
	const expectedChangeTip = nullableValue(requiredField("Change event", record, "expectedChangeTip", path), (entry) => decodeGitOidValue(entry, `${path}.expectedChangeTip`));
	if (expectedChangeTip !== null && expectedChangeTip.algorithm !== expectedProjectHead.algorithm) {
		rejectContract("invalid_field", "Change event", `${path}.expectedChangeTip`, "Expected heads must use one Git object format.");
	}
	const predecessorEventDigest = nullableDigestField(record, "predecessorEventDigest", path);
	const eventDigest = digestField(record, "eventDigest", path);
	const result = Object.freeze({
		protocol: CHANGE_EVENT_PROTOCOL,
		kind,
		ownerItemId,
		actorId: namespacedField(record, "actorId", path),
		authorityId: namespacedField(record, "authorityId", path),
		commandId: namespacedField(record, "commandId", path),
		commandDigest: digestField(record, "commandDigest", path),
		occurredAt: textField("Change event", record, "occurredAt", path, {
			maximumBytes: 35,
			pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u,
		}),
		expectedProjectHead,
		expectedChangeTip,
		containingCommit: CONTAINING_COMMIT,
		predecessorEventDigest,
		payload: decodePayload(kind, requiredField("Change event", record, "payload", path), `${path}.payload`),
		eventDigest,
	});
	const {eventDigest: _eventDigest, ...body} = result;
	const expected = semanticDigest(protocolLabel(), body);
	if (!expected.ok) rejectContract("invalid_field", "Change event", `${path}.eventDigest`, expected.error.message);
	assertDigestMatch("Change event", `${path}.eventDigest`, eventDigest, expected.value);
	return result;
}

function decodePayload(kind: ChangeEventKind, value: CanonicalValue, path: string): ChangeEventPayload {
	switch (kind) {
		case "change.proposed":
		case "change.revised":
			return decodeProposed(value, path);
		case "change.deferred":
		case "change.rejected":
		case "change.withdrawn":
			return decodeDecision(value, path);
		case "change.resumed":
			return decodeResumed(value, path);
		case "change.committed":
			return decodeCommitted(value, path);
		case "change.planned":
			return decodePlanned(value, path);
		case "gate.recorded":
			return decodeGateRecorded(value, path);
		case "work.claimed":
			return decodeWorkClaimed(value, path);
		case "work.assigned":
			return decodeWorkAssigned(value, path);
		case "work.attempt.recorded":
			return decodeWorkAttempt(value, path);
		case "work.integrated":
			return decodeWorkIntegrated(value, path);
		case "review.reconciled":
			return decodeReviewReconciled(value, path);
		case "change.completed":
			return decodeCompleted(value, path);
		case "change.superseded":
			return decodeSuperseded(value, path);
		case "effect.recorded":
			return decodeEffectRecorded(value, path);
		default:
			rejectContract("invalid_field", "Change Event", path, "Change Event kind has no payload decoder.");
	}
}

function decodeProposed(value: CanonicalValue, path: string): ProposedPayload {
	const record = exactRecord("Change event", value, path, ["change"]);
	return Object.freeze({change: decodeChangeValue(requiredField("Change event", record, "change", path), `${path}.change`)});
}

function decodeDecision(value: CanonicalValue, path: string): DecisionPayload {
	const record = exactRecord("Change event", value, path, ["gateDigest", "reason"]);
	return Object.freeze({
		reason: textField("Change event", record, "reason", path, {maximumBytes: 16_384}),
		gateDigest: digestField(record, "gateDigest", path),
	});
}

function decodeResumed(value: CanonicalValue, path: string): ResumedPayload {
	const record = exactRecord("Change event", value, path, ["reason"]);
	return Object.freeze({reason: textField("Change event", record, "reason", path, {maximumBytes: 16_384})});
}

function decodeCommitted(value: CanonicalValue, path: string): CommittedPayload {
	const record = exactRecord("Change event", value, path, ["decisionGateDigest", "wikiTree"]);
	return Object.freeze({
		decisionGateDigest: digestField(record, "decisionGateDigest", path),
		wikiTree: decodeGitOidValue(requiredField("Change event", record, "wikiTree", path), `${path}.wikiTree`),
	});
}

function decodePlanned(value: CanonicalValue, path: string): PlannedPayload {
	const record = exactRecord("Change event", value, path, ["planDigest", "planningGateDigest", "work"]);
	const work = arrayField("Change event", record, "work", path, 1_024).map((entry, index) => decodeWorkValue(entry, `${path}.work[${index}]`));
	if (work.length === 0) rejectContract("missing_field", "Change event", `${path}.work`, "Project Change plan requires Work.");
	const plan = validateWorkPlan(work[0]?.changeId ?? "", work);
	if (!plan.ok) rejectContract("invalid_field", "Change event", `${path}.work`, plan.error.message);
	const planDigest = digestField(record, "planDigest", path);
	const expectedDigest = workPlanDigest(plan.value);
	if (!expectedDigest.ok || expectedDigest.value !== planDigest) rejectContract("invalid_field", "Change event", `${path}.planDigest`, "Work plan digest mismatch.");
	return Object.freeze({planningGateDigest: digestField(record, "planningGateDigest", path), planDigest, work: plan.value});
}

function decodeGateRecorded(value: CanonicalValue, path: string): GateRecordedPayload {
	const record = exactRecord("Change event", value, path, ["evidenceDigests", "gateDigest", "outcomeDigest", "resultDigests", "runDigests", "stage", "status", "subjectDigest", "workId"]);
	const stage = literalField("Change event", record, "stage", CHECK_STAGES, path);
	const workId = nullableNamespacedField(record, "workId", path);
	if ((stage === "implementation") !== (workId !== null)) {
		rejectContract("invalid_field", "Change event", `${path}.workId`, "Only Implementation Gate records carry Work identity.");
	}
	return Object.freeze({
		gateDigest: digestField(record, "gateDigest", path),
		outcomeDigest: digestField(record, "outcomeDigest", path),
		stage,
		status: literalField("Change event", record, "status", ["failed", "passed", "stopped"] as const, path),
		subjectDigest: digestField(record, "subjectDigest", path),
		workId,
		runDigests: digestSet(record, "runDigests", path),
		resultDigests: digestSet(record, "resultDigests", path),
		evidenceDigests: digestSet(record, "evidenceDigests", path),
	});
}

function decodeWorkClaimed(value: CanonicalValue, path: string): WorkClaimedPayload {
	const record = exactRecord("Change event", value, path, ["claimId", "receiptDigest", "workId"]);
	return Object.freeze({
		workId: namespacedField(record, "workId", path),
		claimId: namespacedField(record, "claimId", path),
		receiptDigest: digestField(record, "receiptDigest", path),
	});
}

function decodeWorkAssigned(value: CanonicalValue, path: string): WorkAssignedPayload {
	const record = exactRecord("Change event", value, path, ["assignmentId", "baseCommit", "baseTree", "claimId", "runRequestDigest", "workId"]);
	const baseCommit = decodeGitOidValue(requiredField("Change event", record, "baseCommit", path), `${path}.baseCommit`);
	const baseTree = decodeGitOidValue(requiredField("Change event", record, "baseTree", path), `${path}.baseTree`);
	if (baseCommit.algorithm !== baseTree.algorithm) rejectContract("invalid_field", "Change event", path, "Assignment base OIDs must use one format.");
	return Object.freeze({
		workId: namespacedField(record, "workId", path),
		claimId: namespacedField(record, "claimId", path),
		assignmentId: namespacedField(record, "assignmentId", path),
		baseCommit,
		baseTree,
		runRequestDigest: digestField(record, "runRequestDigest", path),
	});
}

function decodeWorkAttempt(value: CanonicalValue, path: string): WorkAttemptPayload {
	const record = exactRecord("Change event", value, path, ["assignmentId", "resultCommit", "resultTree", "runId", "runReceiptDigest", "workId"]);
	const resultCommit = decodeGitOidValue(requiredField("Change event", record, "resultCommit", path), `${path}.resultCommit`);
	const resultTree = decodeGitOidValue(requiredField("Change event", record, "resultTree", path), `${path}.resultTree`);
	if (resultCommit.algorithm !== resultTree.algorithm) rejectContract("invalid_field", "Change event", path, "Work result OIDs must use one format.");
	return Object.freeze({
		workId: namespacedField(record, "workId", path),
		assignmentId: namespacedField(record, "assignmentId", path),
		runId: namespacedField(record, "runId", path),
		runReceiptDigest: digestField(record, "runReceiptDigest", path),
		resultCommit,
		resultTree,
	});
}

function decodeWorkIntegrated(value: CanonicalValue, path: string): WorkIntegratedPayload {
	const record = exactRecord("Change event", value, path, ["implementationGateDigest", "resultCommit", "resultTree", "workId"]);
	const resultCommit = decodeGitOidValue(requiredField("Change event", record, "resultCommit", path), `${path}.resultCommit`);
	const resultTree = decodeGitOidValue(requiredField("Change event", record, "resultTree", path), `${path}.resultTree`);
	if (resultCommit.algorithm !== resultTree.algorithm) rejectContract("invalid_field", "Change event", path, "Integrated Work OIDs must use one format.");
	return Object.freeze({
		workId: namespacedField(record, "workId", path),
		resultCommit,
		resultTree,
		implementationGateDigest: digestField(record, "implementationGateDigest", path),
	});
}

function decodeReviewReconciled(value: CanonicalValue, path: string): ReviewReconciledPayload {
	const record = exactRecord("Change event", value, path, ["integratedWorkIds", "prospectiveTree", "reviewSubjectDigest"]);
	const integratedWorkIds = sortedUniqueTextArray("Change event", requiredField("Change event", record, "integratedWorkIds", path), `${path}.integratedWorkIds`, {
		maximumEntries: 1_024,
		maximumBytes: 256,
	});
	if (integratedWorkIds.some((entry) => !isNamespacedIdentifier(entry))) rejectContract("invalid_field", "Change event", `${path}.integratedWorkIds`, "Integrated Work identities must be namespaced.");
	return Object.freeze({
		prospectiveTree: decodeGitOidValue(requiredField("Change event", record, "prospectiveTree", path), `${path}.prospectiveTree`),
		integratedWorkIds,
		reviewSubjectDigest: digestField(record, "reviewSubjectDigest", path),
	});
}

function decodeCompleted(value: CanonicalValue, path: string): CompletedPayload {
	const record = exactRecord("Change event", value, path, ["completionTree", "reviewGateDigest"]);
	return Object.freeze({
		completionTree: decodeGitOidValue(requiredField("Change event", record, "completionTree", path), `${path}.completionTree`),
		reviewGateDigest: nullableDigestField(record, "reviewGateDigest", path),
	});
}

function decodeSuperseded(value: CanonicalValue, path: string): SupersededPayload {
	const record = exactRecord("Change event", value, path, ["supersedingChangeId", "supersedingCommit"]);
	return Object.freeze({
		supersedingChangeId: changeIdField(record, "supersedingChangeId", path),
		supersedingCommit: decodeGitOidValue(requiredField("Change event", record, "supersedingCommit", path), `${path}.supersedingCommit`),
	});
}

function decodeEffectRecorded(value: CanonicalValue, path: string): EffectRecordedPayload {
	const record = exactRecord("Change event", value, path, ["authorizationId", "capability", "kernelBuildDigest", "receiptDigest", "requestDigest", "status", "subjectOids"]);
	const subjectOids = arrayField("Change event", record, "subjectOids", path, 64).map((entry, index) =>
		decodeGitOidValue(entry, `${path}.subjectOids[${index}]`));
	if (subjectOids.length === 0) rejectContract("missing_field", "Change event", `${path}.subjectOids`, "Protected effect requires at least one exact subject OID.");
	assertStrictOrder(subjectOids.map(gitOidText), `${path}.subjectOids`);
	if (new Set(subjectOids.map((entry) => entry.algorithm)).size > 1) rejectContract("invalid_field", "Change event", `${path}.subjectOids`, "Protected effect subject OIDs must use one object format.");
	return Object.freeze({
		capability: namespacedField(record, "capability", path),
		authorizationId: namespacedField(record, "authorizationId", path),
		kernelBuildDigest: digestField(record, "kernelBuildDigest", path),
		requestDigest: digestField(record, "requestDigest", path),
		receiptDigest: digestField(record, "receiptDigest", path),
		status: literalField("Change event", record, "status", ["failed", "passed", "stopped"] as const, path),
		subjectOids: Object.freeze(subjectOids),
	});
}

function namespacedField(record: CanonicalRecord, field: string, path: string): string {
	const value = textField("Change event", record, field, path, {maximumBytes: 256});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", "Change event", `${path}.${field}`, "Identity must be canonical namespaced text.");
	return value;
}

function nullableNamespacedField(record: CanonicalRecord, field: string, path: string): string | null {
	const value = requiredField("Change event", record, field, path);
	if (value === null) return null;
	if (typeof value !== "string" || !isNamespacedIdentifier(value)) {
		rejectContract("invalid_field", "Change event", `${path}.${field}`, "Identity must be canonical namespaced text or null.");
	}
	return value;
}

function changeIdField(record: CanonicalRecord, field: string, path: string): string {
	return textField("Change event", record, field, path, {maximumBytes: 200, pattern: /^CHG-[A-Za-z0-9][A-Za-z0-9._-]*$/u});
}

function digestField(record: CanonicalRecord, field: string, path: string): Sha256Digest {
	const decoded = decodeSha256Digest(record[field]);
	if (!decoded.ok) rejectContract("invalid_field", "Change event", `${path}.${field}`, decoded.error.message);
	return decoded.value;
}

function nullableDigestField(record: CanonicalRecord, field: string, path: string): Sha256Digest | null {
	const value = requiredField("Change event", record, field, path);
	if (value === null) return null;
	const decoded = decodeSha256Digest(value);
	if (!decoded.ok) rejectContract("invalid_field", "Change event", `${path}.${field}`, decoded.error.message);
	return decoded.value;
}

function digestSet(record: CanonicalRecord, field: string, path: string): readonly Sha256Digest[] {
	const values = arrayField("Change event", record, field, path, 256).map((entry, index) => {
		const decoded = decodeSha256Digest(entry);
		if (!decoded.ok) rejectContract("invalid_field", "Change event", `${path}.${field}[${index}]`, decoded.error.message);
		return decoded.value;
	});
	assertStrictOrder(values, `${path}.${field}`);
	return Object.freeze(values);
}

function assertStrictOrder(values: readonly string[], path: string): void {
	for (let index = 1; index < values.length; index += 1) {
		if ((values[index - 1] ?? "") >= (values[index] ?? "")) rejectContract("non_canonical_order", "Change event", path, "Values must be strictly sorted and unique.");
	}
}

function protocolLabel(): string {
	return `${CHANGE_EVENT_PROTOCOL.id}@${CHANGE_EVENT_PROTOCOL.version}`;
}
