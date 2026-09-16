import {
	arrayField,
	assertDigestMatch,
	decodeContract,
	exactRecord,
	integerField,
	isNamespacedIdentifier,
	literalField,
	nullableValue,
	protocolField,
	protocolIdentity,
	rejectContract,
	requiredField,
	textField,
	type CanonicalRecord,
	type ContractIssue,
} from "../kernel/data-contracts/validation.ts";
import type {CanonicalValue} from "../kernel/data-contracts/canonical-json.ts";
import {failure, type Outcome} from "../kernel/data-contracts/outcome.ts";
import {decodeEvidenceReferenceValue, type EvidenceReference} from "../kernel/evidence/reference.ts";
import {decodeGitOidValue, sameGitOid, type GitOid} from "../kernel/identity/git.ts";
import {semanticDigest, semanticId, type SemanticIdentityIssue} from "../kernel/identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../kernel/identity/sha256.ts";

export const PREVIEW_PORT = Object.freeze({
	id: "codewiki.port.preview",
	version: "1.0.0",
});
export const PREVIEW_PORT_PROTOCOL = PREVIEW_PORT;
export const PREVIEW_SUBJECT_PROTOCOL = protocolIdentity("codewiki.preview-subject", "1.0.0");
export const PREVIEW_OBSERVATION_PROTOCOL = protocolIdentity("codewiki.preview-observation", "1.0.0");
export const PREVIEW_CAPABILITIES = ["preview.verify", "preview.work"] as const;

export type PreviewCapability = (typeof PREVIEW_CAPABILITIES)[number];

export interface PreviewSubjectBody {
	readonly protocol: typeof PREVIEW_SUBJECT_PROTOCOL;
	readonly previewId: string;
	readonly capability: PreviewCapability;
	readonly repositoryId: string;
	readonly changeId: string;
	readonly workId: string | null;
	readonly projectCommit: GitOid;
	readonly projectTree: GitOid;
	readonly changeTip: GitOid;
	readonly artifactCommit: GitOid | null;
	readonly artifactTree: GitOid | null;
	readonly scope: readonly string[];
	readonly profileId: string;
	readonly environmentDigest: Sha256Digest;
	readonly policyDigest: Sha256Digest;
	readonly generation: number;
	readonly producerId: string;
}

export interface PreviewSubject extends PreviewSubjectBody {
	readonly subjectDigest: Sha256Digest;
}

export interface PreviewObservationBody {
	readonly protocol: typeof PREVIEW_OBSERVATION_PROTOCOL;
	readonly observationId: string;
	readonly previewSubjectDigest: Sha256Digest;
	readonly capability: PreviewCapability;
	readonly producerId: string;
	readonly outputDigest: Sha256Digest;
	readonly evidence: EvidenceReference;
	readonly receiptDigest: Sha256Digest;
	readonly status: "failed" | "passed" | "stopped";
}

export interface PreviewObservation extends PreviewObservationBody {
	readonly observationDigest: Sha256Digest;
}

export interface PreviewRequest {
	readonly authorizationId: string;
	readonly requestDigest: Sha256Digest;
	readonly subject: PreviewSubject;
}

export function previewRequestDigest(request: PreviewRequest): Outcome<Sha256Digest, SemanticIdentityIssue> {
	const {requestDigest: ignored, ...body} = request;
	void ignored;
	return semanticDigest("codewiki.preview.request@1.0.0", body);
}

export interface PreviewIssue {
	readonly code:
		| "authorization_binding_invalid"
		| "environment_unavailable"
		| "invalid_observation"
		| "invalid_subject"
		| "policy_rejected"
		| "stale_subject"
		| "stopped";
	readonly message: string;
}

/** Process/UI mechanics only; Preview observations never authorize lifecycle transitions. */
export interface PreviewPort {
	readonly protocol: typeof PREVIEW_PORT;
	observe(request: PreviewRequest): Promise<Outcome<PreviewObservation, PreviewIssue>>;
}

export function createPreviewSubject(
	body: Omit<PreviewSubjectBody, "protocol" | "previewId">,
): Outcome<PreviewSubject, ContractIssue | SemanticIdentityIssue> {
	const identity = semanticId("cw:preview", protocolLabel(PREVIEW_SUBJECT_PROTOCOL), {
		capability: body.capability,
		repositoryId: body.repositoryId,
		changeId: body.changeId,
		workId: body.workId,
		generation: body.generation,
	});
	if (!identity.ok) return failure(identity.error);
	const value = {...body, protocol: PREVIEW_SUBJECT_PROTOCOL, previewId: identity.value};
	const digest = semanticDigest(protocolLabel(PREVIEW_SUBJECT_PROTOCOL), value);
	if (!digest.ok) return failure(digest.error);
	return decodePreviewSubject({...value, subjectDigest: digest.value});
}

export function decodePreviewSubject(input: unknown): Outcome<PreviewSubject, ContractIssue> {
	return decodeContract("Preview subject", input, (value) => decodePreviewSubjectValue(value));
}

export function decodePreviewSubjectValue(value: CanonicalValue, path = "$"): PreviewSubject {
	const record = exactRecord("Preview subject", value, path, [
		"artifactCommit",
		"artifactTree",
		"capability",
		"changeId",
		"changeTip",
		"environmentDigest",
		"generation",
		"policyDigest",
		"previewId",
		"producerId",
		"profileId",
		"projectCommit",
		"projectTree",
		"protocol",
		"repositoryId",
		"scope",
		"subjectDigest",
		"workId",
	]);
	protocolField("Preview subject", record, path, PREVIEW_SUBJECT_PROTOCOL);
	const capability = literalField("Preview subject", record, "capability", PREVIEW_CAPABILITIES, path);
	const repositoryId = namespacedField("Preview subject", record, "repositoryId", path);
	const changeId = changeIdField(record, "changeId", path);
	const workId = nullableNamespacedField(record, "workId", path);
	if (capability === "preview.work" && workId === null) rejectContract("missing_field", "Preview subject", `${path}.workId`, "preview.work requires Work identity.");
	const projectCommit = decodeGitOidValue(requiredField("Preview subject", record, "projectCommit", path), `${path}.projectCommit`);
	const projectTree = decodeGitOidValue(requiredField("Preview subject", record, "projectTree", path), `${path}.projectTree`);
	const changeTip = decodeGitOidValue(requiredField("Preview subject", record, "changeTip", path), `${path}.changeTip`);
	const artifactCommit = nullableValue(requiredField("Preview subject", record, "artifactCommit", path), (entry) => decodeGitOidValue(entry, `${path}.artifactCommit`));
	const artifactTree = nullableValue(requiredField("Preview subject", record, "artifactTree", path), (entry) => decodeGitOidValue(entry, `${path}.artifactTree`));
	if ((artifactCommit === null) !== (artifactTree === null)) rejectContract("invalid_field", "Preview subject", path, "Artifact commit/tree must both be present or absent.");
	if ([projectTree, changeTip, artifactCommit, artifactTree].some((entry) => entry !== null && entry.algorithm !== projectCommit.algorithm)) {
		rejectContract("invalid_field", "Preview subject", path, "Preview OIDs must use one object format.");
	}
	const scope = arrayField("Preview subject", record, "scope", path, 1_024).map((entry, index) => {
		if (typeof entry !== "string" || !isPortableScope(entry)) rejectContract("invalid_field", "Preview subject", `${path}.scope[${index}]`, "Preview scope is not portable.");
		return entry;
	});
	assertOrdered(scope, `${path}.scope`);
	const generation = integerField("Preview subject", record, "generation", path, 1, Number.MAX_SAFE_INTEGER);
	const producerId = namespacedField("Preview subject", record, "producerId", path);
	const previewId = namespacedField("Preview subject", record, "previewId", path);
	const expectedId = semanticId("cw:preview", protocolLabel(PREVIEW_SUBJECT_PROTOCOL), {capability, repositoryId, changeId, workId, generation});
	if (!expectedId.ok || expectedId.value !== previewId) rejectContract("invalid_field", "Preview subject", `${path}.previewId`, "Preview identity mismatch.");
	const subjectDigest = digestField("Preview subject", record, "subjectDigest", path);
	const result = Object.freeze({
		protocol: PREVIEW_SUBJECT_PROTOCOL,
		previewId,
		capability,
		repositoryId,
		changeId,
		workId,
		projectCommit,
		projectTree,
		changeTip,
		artifactCommit,
		artifactTree,
		scope: Object.freeze(scope),
		profileId: namespacedField("Preview subject", record, "profileId", path),
		environmentDigest: digestField("Preview subject", record, "environmentDigest", path),
		policyDigest: digestField("Preview subject", record, "policyDigest", path),
		generation,
		producerId,
		subjectDigest,
	});
	const {subjectDigest: _subjectDigest, ...body} = result;
	assertSemanticDigest("Preview subject", `${path}.subjectDigest`, PREVIEW_SUBJECT_PROTOCOL, body, subjectDigest);
	return result;
}

export function createPreviewObservation(
	body: Omit<PreviewObservationBody, "protocol" | "observationId">,
): Outcome<PreviewObservation, ContractIssue | SemanticIdentityIssue> {
	const identity = semanticId("cw:preview-observation", protocolLabel(PREVIEW_OBSERVATION_PROTOCOL), {
		previewSubjectDigest: body.previewSubjectDigest,
		producerId: body.producerId,
		outputDigest: body.outputDigest,
	});
	if (!identity.ok) return failure(identity.error);
	const value = {...body, protocol: PREVIEW_OBSERVATION_PROTOCOL, observationId: identity.value};
	const digest = semanticDigest(protocolLabel(PREVIEW_OBSERVATION_PROTOCOL), value);
	if (!digest.ok) return failure(digest.error);
	return decodePreviewObservation({...value, observationDigest: digest.value});
}

export function decodePreviewObservation(input: unknown): Outcome<PreviewObservation, ContractIssue> {
	return decodeContract("Preview observation", input, (value) => {
		const record = exactRecord("Preview observation", value, "$", [
			"capability",
			"evidence",
			"observationDigest",
			"observationId",
			"outputDigest",
			"previewSubjectDigest",
			"producerId",
			"protocol",
			"receiptDigest",
			"status",
		]);
		protocolField("Preview observation", record, "$", PREVIEW_OBSERVATION_PROTOCOL);
		const previewSubjectDigest = digestField("Preview observation", record, "previewSubjectDigest", "$");
		const evidence = decodeEvidenceReferenceValue(requiredField("Preview observation", record, "evidence"), "$.evidence");
		if (evidence.subjectDigest !== previewSubjectDigest) rejectContract("invalid_field", "Preview observation", "$.evidence.subjectDigest", "Preview Evidence targets another subject.");
		const result = Object.freeze({
			protocol: PREVIEW_OBSERVATION_PROTOCOL,
			observationId: namespacedField("Preview observation", record, "observationId", "$"),
			previewSubjectDigest,
			capability: literalField("Preview observation", record, "capability", PREVIEW_CAPABILITIES),
			producerId: namespacedField("Preview observation", record, "producerId", "$"),
			outputDigest: digestField("Preview observation", record, "outputDigest", "$"),
			evidence,
			receiptDigest: digestField("Preview observation", record, "receiptDigest", "$"),
			status: literalField("Preview observation", record, "status", ["failed", "passed", "stopped"] as const),
			observationDigest: digestField("Preview observation", record, "observationDigest", "$"),
		});
		if (result.evidence.producerId !== result.producerId || result.evidence.receiptDigest !== result.receiptDigest || result.evidence.evidenceDigest !== result.outputDigest) {
			rejectContract("invalid_field", "Preview observation", "$.evidence", "Preview Evidence must bind producer, output, and receipt exactly.");
		}
		const {observationDigest: _observationDigest, ...withId} = result;
		const expectedId = semanticId("cw:preview-observation", protocolLabel(PREVIEW_OBSERVATION_PROTOCOL), {
			previewSubjectDigest: result.previewSubjectDigest,
			producerId: result.producerId,
			outputDigest: result.outputDigest,
		});
		if (!expectedId.ok || expectedId.value !== result.observationId) rejectContract("invalid_field", "Preview observation", "$.observationId", "Preview observation identity mismatch.");
		assertSemanticDigest("Preview observation", "$.observationDigest", PREVIEW_OBSERVATION_PROTOCOL, withId, result.observationDigest);
		return result;
	});
}

export function previewObservationEligibleForGate(subject: PreviewSubject, observation: PreviewObservation): boolean {
	const decodedSubject = decodePreviewSubject(subject);
	const decodedObservation = decodePreviewObservation(observation);
	return decodedSubject.ok && decodedObservation.ok &&
		decodedSubject.value.capability === "preview.verify" &&
		decodedObservation.value.capability === "preview.verify" &&
		decodedObservation.value.previewSubjectDigest === decodedSubject.value.subjectDigest &&
		decodedObservation.value.producerId !== decodedSubject.value.producerId &&
		decodedObservation.value.status === "passed" &&
		decodedObservation.value.evidence.authority === "verified" &&
		decodedObservation.value.evidence.coverage === "complete" &&
		decodedObservation.value.evidence.freshness === "current" &&
		sameOidList(decodedObservation.value.evidence.subjectOids, subjectOids(decodedSubject.value));
}

function digestField(contract: string, record: CanonicalRecord, field: string, path: string): Sha256Digest {
	const decoded = decodeSha256Digest(record[field]);
	if (!decoded.ok) rejectContract("invalid_field", contract, `${path}.${field}`, decoded.error.message);
	return decoded.value;
}

function namespacedField(contract: string, record: CanonicalRecord, field: string, path: string): string {
	const value = textField(contract, record, field, path, {maximumBytes: 256});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", contract, `${path}.${field}`, "Identity must be canonical namespaced text.");
	return value;
}

function nullableNamespacedField(record: CanonicalRecord, field: string, path: string): string | null {
	const value = requiredField("Preview subject", record, field, path);
	if (value === null) return null;
	if (typeof value !== "string" || !isNamespacedIdentifier(value)) rejectContract("invalid_field", "Preview subject", `${path}.${field}`, "Identity must be namespaced or null.");
	return value;
}

function changeIdField(record: CanonicalRecord, field: string, path: string): string {
	return textField("Preview subject", record, field, path, {maximumBytes: 200, pattern: /^CHG-[A-Za-z0-9][A-Za-z0-9._-]*$/u});
}

function assertSemanticDigest(
	contract: string,
	path: string,
	protocol: Readonly<{id: string; version: string}>,
	body: unknown,
	actual: Sha256Digest,
): void {
	const expected = semanticDigest(protocolLabel(protocol), body);
	if (!expected.ok) rejectContract("invalid_field", contract, path, expected.error.message);
	assertDigestMatch(contract, path, actual, expected.value);
}

function subjectOids(subject: PreviewSubject): readonly GitOid[] {
	return [subject.projectCommit, subject.projectTree, subject.changeTip, subject.artifactCommit, subject.artifactTree]
		.flatMap((entry) => entry === null ? [] : [entry])
		.sort(compareOid);
}

function compareOid(left: GitOid, right: GitOid): number {
	if (left.hex < right.hex) return -1;
	if (left.hex > right.hex) return 1;
	return 0;
}

function sameOidList(left: readonly GitOid[], right: readonly GitOid[]): boolean {
	return left.length === right.length && left.every((entry, index) => right[index] !== undefined && sameGitOid(entry, right[index] as GitOid));
}

function isPortableScope(value: string): boolean {
	if (value.length === 0 || value.length > 512 || value.normalize("NFC") !== value || value.startsWith("/") || value.includes("\\") || value.includes("\0")) return false;
	const segments = value.split("/");
	return segments[0] !== ".changekernel" && segments[0] !== ".codewiki" && segments[0] !== ".git" && segments[0] !== "check-packs" &&
		segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function assertOrdered(values: readonly string[], path: string): void {
	for (let index = 1; index < values.length; index += 1) {
		if ((values[index - 1] ?? "") >= (values[index] ?? "")) rejectContract("non_canonical_order", "Preview subject", path, "Values must be strictly sorted and unique.");
	}
}

function protocolLabel(protocol: Readonly<{id: string; version: string}>): string {
	return `${protocol.id}@${protocol.version}`;
}
