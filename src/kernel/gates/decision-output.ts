// Historical proposed-interpretation format. Never an adopted unified Check result.
import {arrayField, decodeContract, exactRecord, integerField, literalField, protocolField, protocolIdentity, rejectContract, requiredField, textField, type CanonicalRecord, type ContractIssue} from "../data-contracts/validation.ts";
import {parseCanonicalJson} from "../data-contracts/canonical-json.ts";
import type {Outcome} from "../data-contracts/outcome.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";
const CONTRACT = "Semantic Gate";
const LIMITS = Object.freeze({maximumDepth: 32, maximumNodes: 16_384, maximumEntriesPerContainer: 256, maximumTextBytes: 256 * 1024});

/** Model proposals are not Gate findings, evidence references or coverage claims. */
export const DECISION_CHECK_OUTPUT_PROTOCOL = protocolIdentity("codewiki.decision-check-output", "1.0.0");
export const DECISION_CHECK_OUTPUT_SCHEMA = Object.freeze({
	protocol: DECISION_CHECK_OUTPUT_PROTOCOL,
	serialization: "canonical-json",
	fields: Object.freeze(["protocol", "status", "reason", "assumptions", "citations"]),
	statuses: Object.freeze(["supported", "contradicted", "unresolved"] as const),
	maximumProseBytes: 4096, maximumAssumptions: 32, maximumCitations: 64,
	maximumPathHexBytes: 8192, maximumSelectedBytes: 256 * 1024,
	citationFields: Object.freeze(["side", "pathUtf8Hex", "sourceDigest", "startByte", "endByte"]),
	citationSides: Object.freeze(["before", "after"] as const),
	coordinateUnit: "utf8-bytes", maximumCoordinate: Number.MAX_SAFE_INTEGER,
	supportRequiresCitation: true, contradictionRequiresCitation: true,
	assumptionsSortedUnique: true, duplicateCitationsAllowed: false,
	limits: LIMITS,
});
export interface DecisionSourceCitation {
	readonly side: "before" | "after";
	readonly pathUtf8Hex: string;
	readonly sourceDigest: Sha256Digest;
	readonly startByte: number;
	readonly endByte: number;
}
export interface DecisionCheckOutput {
	readonly protocol: typeof DECISION_CHECK_OUTPUT_PROTOCOL;
	readonly status: "supported" | "contradicted" | "unresolved";
	readonly reason: string;
	readonly assumptions: readonly string[];
	readonly citations: readonly DecisionSourceCitation[];
}

/** Coordinates only. The backend must resolve every citation against real sources. */
export function decodeDecisionSourceCitations(input: unknown): Outcome<readonly DecisionSourceCitation[], ContractIssue> {
	return decodeContract(CONTRACT, input, value => {
		const entries = arrayField(CONTRACT, {citations: value}, "citations", "$", DECISION_CHECK_OUTPUT_SCHEMA.maximumCitations);
		const seen = new Set<string>();
		let remainingBytes = DECISION_CHECK_OUTPUT_SCHEMA.maximumSelectedBytes;
		return Object.freeze(entries.map((entry, index) => {
			const path = `$.citations[${index}]`;
			const record = exactRecord(CONTRACT, entry, path, DECISION_CHECK_OUTPUT_SCHEMA.citationFields);
			const side = literalField(CONTRACT, record, "side", DECISION_CHECK_OUTPUT_SCHEMA.citationSides, path);
			const pathUtf8Hex = textField(CONTRACT, record, "pathUtf8Hex", path, {maximumBytes: DECISION_CHECK_OUTPUT_SCHEMA.maximumPathHexBytes, pattern: /^(?:[0-9a-f]{2})+$/u});
			const sourceDigest = digestField(record, "sourceDigest", path);
			const startByte = integerField(CONTRACT, record, "startByte", path, 0, DECISION_CHECK_OUTPUT_SCHEMA.maximumCoordinate);
			const endByte = integerField(CONTRACT, record, "endByte", path, 1, DECISION_CHECK_OUTPUT_SCHEMA.maximumCoordinate);
			if (endByte <= startByte || endByte - startByte > remainingBytes) rejectContract("invalid_field", CONTRACT, path, "Citations require nonempty ranges totaling at most 256 KiB.");
			remainingBytes -= endByte - startByte;
			const key = `${side}:${pathUtf8Hex}:${startByte}:${endByte}`;
			if (seen.has(key)) rejectContract("invalid_field", CONTRACT, path, "Duplicate citations are not independent support.");
			seen.add(key);
			return Object.freeze({side, pathUtf8Hex, sourceDigest, startByte, endByte});
		}));
	}, LIMITS);
}

export function decodeDecisionCheckOutput(input: unknown): Outcome<DecisionCheckOutput, ContractIssue> {
	return decodeContract(CONTRACT, input, value => {
		const record = exactRecord(CONTRACT, value, "$", DECISION_CHECK_OUTPUT_SCHEMA.fields);
		protocolField(CONTRACT, record, "$", DECISION_CHECK_OUTPUT_PROTOCOL);
		const status = literalField(CONTRACT, record, "status", DECISION_CHECK_OUTPUT_SCHEMA.statuses);
		const citations = admitted(decodeDecisionSourceCitations(requiredField(CONTRACT, record, "citations")));
		if (status !== "unresolved" && citations.length === 0) rejectContract("invalid_field", CONTRACT, "$.citations", "Supported and contradicted proposals require source citations.");
		const assumptions = Object.freeze(arrayField(CONTRACT, record, "assumptions", "$", DECISION_CHECK_OUTPUT_SCHEMA.maximumAssumptions).map((entry, index) => prose({value: entry}, "value", `$.assumptions[${index}]`)));
		ordered(assumptions, "$.assumptions");
		return Object.freeze({protocol: DECISION_CHECK_OUTPUT_PROTOCOL, status, reason: prose(record, "reason"), assumptions, citations});
	}, LIMITS);
}

/** Strict canonical JSON rejects duplicate keys and ambiguous serialization. */
export function parseDecisionCheckOutput(input: unknown): Outcome<DecisionCheckOutput, ContractIssue> {
	return decodeContract(CONTRACT, input, value => {
		if (typeof value !== "string") rejectContract("invalid_field", CONTRACT, "$", "Check output must be canonical JSON text.");
		const parsed = parseCanonicalJson(value, {limits: LIMITS, requireCanonicalBytes: true});
		if (!parsed.ok) rejectContract("invalid_field", CONTRACT, "$", parsed.error.message);
		return admitted(decodeDecisionCheckOutput(parsed.value));
	}, LIMITS);
}

function admitted<T>(result: Outcome<T, ContractIssue>): T {
	if (!result.ok) rejectContract(result.error.code, CONTRACT, result.error.path, result.error.message);
	return result.value;
}
function digestField(record: CanonicalRecord, field: string, path = "$"): Sha256Digest {
	const result = decodeSha256Digest(requiredField(CONTRACT, record, field, path));
	if (!result.ok) rejectContract("invalid_field", CONTRACT, `${path}.${field}`, result.error.message);
	return result.value;
}
function prose(record: CanonicalRecord, field: string, path = "$"): string {
	const value = textField(CONTRACT, record, field, path, {maximumBytes: 4096});
	if (value.trim().length === 0 || /[\uD800-\uDFFF]/u.test(value)) rejectContract("invalid_field", CONTRACT, `${path}.${field}`, "Expected nonblank Unicode prose.");
	return value;
}
function ordered(values: readonly string[], path: string): void {
	for (let index = 1; index < values.length; index++) {
		if (values[index - 1]! >= values[index]!) rejectContract("non_canonical_order", CONTRACT, path, "Entries must be sorted and unique.");
	}
}
