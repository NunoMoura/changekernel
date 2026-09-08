import {
	arrayField,
	assertDigestMatch,
	decodeContract,
	exactRecord,
	isNamespacedIdentifier,
	literalField,
	protocolField,
	protocolIdentity,
	rejectContract,
	requiredField,
	textField,
	textValue,
	type ContractIssue,
	type ProtocolIdentity,
} from "../data-contracts/validation.ts";
import type {CanonicalValue} from "../data-contracts/canonical-json.ts";
import {failure, type Outcome} from "../data-contracts/outcome.ts";
import {decodeGitOidValue, type GitOid} from "../identity/git.ts";
import {semanticDigest, type SemanticIdentityIssue} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";

export const EVIDENCE_REFERENCE_PROTOCOL = protocolIdentity("codewiki.evidence-reference", "1.0.0");

export type EvidenceAuthority = "approved" | "asserted" | "observed" | "verified";
export type EvidenceCoverage = "complete" | "partial" | "unknown";
export type EvidenceFreshness = "current" | "stale" | "unknown";
export type EvidenceCapturePolicy = "cited_slices" | "full_revision" | "metadata_only";
export type EvidenceRetentionPolicy = "pinned" | "transient" | "ttl" | "while_referenced";

export interface EvidenceReferenceBody {
	readonly protocol: typeof EVIDENCE_REFERENCE_PROTOCOL;
	readonly evidenceId: string;
	readonly evidenceDigest: Sha256Digest;
	readonly schema: ProtocolIdentity;
	readonly mediaType: string;
	readonly subjectDigest: Sha256Digest;
	readonly subjectOids: readonly GitOid[];
	readonly materialDigests: readonly Sha256Digest[];
	readonly producerId: string;
	readonly method: string;
	readonly receiptDigest: Sha256Digest;
	readonly authority: EvidenceAuthority;
	readonly coverage: EvidenceCoverage;
	readonly freshness: EvidenceFreshness;
	readonly capturePolicy: EvidenceCapturePolicy;
	readonly retentionPolicy: EvidenceRetentionPolicy;
	readonly limitations: readonly string[];
}

export interface EvidenceReference extends EvidenceReferenceBody {
	readonly referenceDigest: Sha256Digest;
}

export function createEvidenceReference(
	body: Omit<EvidenceReferenceBody, "protocol">,
): Outcome<EvidenceReference, ContractIssue | SemanticIdentityIssue> {
	const value = {...body, protocol: EVIDENCE_REFERENCE_PROTOCOL};
	const digest = semanticDigest(protocolLabel(EVIDENCE_REFERENCE_PROTOCOL), value);
	if (!digest.ok) return failure(digest.error);
	return decodeEvidenceReference({...value, referenceDigest: digest.value});
}

export function decodeEvidenceReference(input: unknown): Outcome<EvidenceReference, ContractIssue> {
	return decodeContract("Evidence reference", input, (value) => decodeEvidenceReferenceValue(value));
}

export function decodeEvidenceReferenceValue(value: CanonicalValue, path = "$"): EvidenceReference {
	const record = exactRecord("Evidence reference", value, path, [
		"authority",
		"capturePolicy",
		"coverage",
		"evidenceDigest",
		"evidenceId",
		"freshness",
		"limitations",
		"materialDigests",
		"mediaType",
		"method",
		"producerId",
		"protocol",
		"receiptDigest",
		"referenceDigest",
		"retentionPolicy",
		"schema",
		"subjectDigest",
		"subjectOids",
	]);
	protocolField("Evidence reference", record, path, EVIDENCE_REFERENCE_PROTOCOL);
	const schemaRecord = exactRecord("Evidence reference", requiredField("Evidence reference", record, "schema", path), `${path}.schema`, ["id", "version"]);
	const schema = Object.freeze({
		id: textField("Evidence reference", schemaRecord, "id", `${path}.schema`, {maximumBytes: 256, pattern: /^[a-z][a-z0-9.-]*$/u}),
		version: textField("Evidence reference", schemaRecord, "version", `${path}.schema`, {maximumBytes: 64, pattern: /^\d+\.\d+\.\d+$/u}),
	});
	const subjectOids = decodeOidArray(arrayField("Evidence reference", record, "subjectOids", path, 256), `${path}.subjectOids`);
	const materialDigests = decodeDigestArray(arrayField("Evidence reference", record, "materialDigests", path, 1_024), `${path}.materialDigests`);
	const limitations = arrayField("Evidence reference", record, "limitations", path, 256).map((entry, index) =>
		textValue("Evidence reference", entry, `${path}.limitations[${index}]`, {maximumBytes: 4_096}));
	assertStrictOrder(limitations, `${path}.limitations`);
	const result = Object.freeze({
		protocol: EVIDENCE_REFERENCE_PROTOCOL,
		evidenceId: identifierField(record, "evidenceId", path),
		evidenceDigest: digestField(record, "evidenceDigest", path),
		schema,
		mediaType: textField("Evidence reference", record, "mediaType", path, {
			maximumBytes: 255,
			pattern: /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/u,
		}),
		subjectDigest: digestField(record, "subjectDigest", path),
		subjectOids,
		materialDigests,
		producerId: identifierField(record, "producerId", path),
		method: identifierField(record, "method", path),
		receiptDigest: digestField(record, "receiptDigest", path),
		authority: literalField("Evidence reference", record, "authority", ["approved", "asserted", "observed", "verified"] as const, path),
		coverage: literalField("Evidence reference", record, "coverage", ["complete", "partial", "unknown"] as const, path),
		freshness: literalField("Evidence reference", record, "freshness", ["current", "stale", "unknown"] as const, path),
		capturePolicy: literalField("Evidence reference", record, "capturePolicy", ["cited_slices", "full_revision", "metadata_only"] as const, path),
		retentionPolicy: literalField("Evidence reference", record, "retentionPolicy", ["pinned", "transient", "ttl", "while_referenced"] as const, path),
		limitations: Object.freeze(limitations),
		referenceDigest: digestField(record, "referenceDigest", path),
	});
	const {referenceDigest: _referenceDigest, ...body} = result;
	const expected = semanticDigest(protocolLabel(EVIDENCE_REFERENCE_PROTOCOL), body);
	if (!expected.ok) rejectContract("invalid_field", "Evidence reference", `${path}.referenceDigest`, expected.error.message);
	assertDigestMatch("Evidence reference", `${path}.referenceDigest`, result.referenceDigest, expected.value);
	return result;
}

function decodeOidArray(input: readonly CanonicalValue[], path: string): readonly GitOid[] {
	const output = input.map((entry, index) => decodeGitOidValue(entry, `${path}[${index}]`));
	const identities = output.map((entry) => `${entry.algorithm}:${entry.hex}`);
	assertStrictOrder(identities, path);
	if (new Set(output.map((entry) => entry.algorithm)).size > 1) {
		rejectContract("invalid_field", "Evidence reference", path, "Subject OIDs must use one Git object format.");
	}
	return Object.freeze(output);
}

function decodeDigestArray(input: readonly CanonicalValue[], path: string): readonly Sha256Digest[] {
	const output = input.map((entry, index) => {
		const decoded = decodeSha256Digest(entry);
		if (!decoded.ok) rejectContract("invalid_field", "Evidence reference", `${path}[${index}]`, decoded.error.message);
		return decoded.value;
	});
	assertStrictOrder(output, path);
	return Object.freeze(output);
}

function digestField(record: Readonly<{[key: string]: CanonicalValue}>, field: string, path: string): Sha256Digest {
	const decoded = decodeSha256Digest(record[field]);
	if (!decoded.ok) rejectContract("invalid_field", "Evidence reference", `${path}.${field}`, decoded.error.message);
	return decoded.value;
}

function identifierField(record: Readonly<{[key: string]: CanonicalValue}>, field: string, path: string): string {
	const value = textField("Evidence reference", record, field, path, {maximumBytes: 256});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", "Evidence reference", `${path}.${field}`, "Identity must be canonical namespaced text.");
	return value;
}

function assertStrictOrder(values: readonly string[], path: string): void {
	for (let index = 1; index < values.length; index += 1) {
		if ((values[index - 1] ?? "") >= (values[index] ?? "")) {
			rejectContract("non_canonical_order", "Evidence reference", path, "Values must be strictly sorted and unique.");
		}
	}
}

function protocolLabel(protocol: ProtocolIdentity): string {
	return `${protocol.id}@${protocol.version}`;
}
