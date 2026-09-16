import {
	arrayField,
	decodeContract,
	exactRecord,
	literalField,
	protocolField,
	protocolIdentity,
	rejectContract,
	requiredField,
	textField,
	type CanonicalRecord,
	type ContractIssue,
} from "../data-contracts/validation.ts";
import type {CanonicalValue} from "../data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../data-contracts/outcome.ts";
import {decodeGitOid, type GitOid} from "../identity/git.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";
import {decodeProjectSnapshot, type ProjectSnapshot} from "../changes/snapshot.ts";
import {
	PROFILED_WIKI_MAPPING_KINDS,
	PROFILED_WIKI_TRANSACTION_LIMITS,
	type ProfiledWikiMappingKind,
	type ProfiledWikiTransaction,
} from "./profile-transaction.ts";
import {WIKI_PROFILE_ID, WIKI_PROFILE_LIMITS, wikiPath} from "./profile.ts";

export const PROFILED_WIKI_REFERENCE_PROTOCOL = protocolIdentity("codewiki.profiled-wiki-reference", "1.0.0");

/** Wire-safe endpoint identity. Path bytes are hex so no normalization occurs. */
export interface ProfiledWikiReferenceEndpoint {
	readonly pathUtf8Hex: string;
	readonly blob: GitOid;
}

export interface ProfiledWikiReferenceMapping {
	readonly kind: ProfiledWikiMappingKind;
	readonly before: readonly ProfiledWikiReferenceEndpoint[];
	readonly after: readonly ProfiledWikiReferenceEndpoint[];
}

export interface ProfiledWikiReferenceBody {
	readonly protocol: typeof PROFILED_WIKI_REFERENCE_PROTOCOL;
	readonly profile: typeof WIKI_PROFILE_ID;
	readonly kernelBuildDigest: Sha256Digest;
	readonly before: ProjectSnapshot;
	readonly after: ProjectSnapshot;
	readonly changePathUtf8Hex: string;
	readonly mappings: readonly ProfiledWikiReferenceMapping[];
}

export interface ProfiledWikiReference extends ProfiledWikiReferenceBody {
	readonly transactionDigest: Sha256Digest;
}

export type ProfiledWikiReferenceIssue = ContractIssue | Readonly<{
	readonly code: "invalid_reference";
	readonly path: string;
	readonly message: string;
}>;

const CONTRACT = `${PROFILED_WIKI_REFERENCE_PROTOCOL.id}@${PROFILED_WIKI_REFERENCE_PROTOCOL.version}`;
const UTF8 = new TextEncoder();
const UTF8_DECODER = new TextDecoder("utf-8", {fatal: true});
const HEX = /^[0-9a-f]*$/u;
const CHANGE_PATH = /^\.changekernel\/changes\/[^/]+(?:\/[^/]+)*$/u;

/** Build immutable wire references from an already admitted transaction. */
export function createProfiledWikiReference(
	transaction: ProfiledWikiTransaction,
): Outcome<ProfiledWikiReference, ProfiledWikiReferenceIssue> {
	const changePathUtf8Hex = encodePathUtf8Hex(transaction.responsibleChangePath, true);
	if (!changePathUtf8Hex.ok) return changePathUtf8Hex;
	const body: ProfiledWikiReferenceBody = Object.freeze({
		protocol: PROFILED_WIKI_REFERENCE_PROTOCOL,
		profile: WIKI_PROFILE_ID,
		kernelBuildDigest: transaction.kernelBuildDigest,
		before: transaction.before.snapshot,
		after: transaction.after.snapshot,
		changePathUtf8Hex: changePathUtf8Hex.value,
		mappings: Object.freeze(transaction.mappings.map(referenceMapping)),
	});
	return materializeReference(body, transaction.transactionDigest);
}

export function decodeProfiledWikiReference(
	input: unknown,
): Outcome<ProfiledWikiReference, ProfiledWikiReferenceIssue> {
	return decodeContract(CONTRACT, input, (value) => decodeReferenceValue(value));
}

/** Decode canonical lowercase path hex and retain exact original spelling. */
export function decodeProfiledPathUtf8Hex(
	value: unknown,
	change = false,
): Outcome<string, ProfiledWikiReferenceIssue> {
	if (typeof value !== "string" || !isCanonicalHex(value, change ? "change" : "wiki")) {
		return failure(referenceIssue("invalid_reference", "$", "Path token must be canonical lowercase UTF-8 hex."));
	}
	let bytes: Uint8Array;
	try {
		bytes = hexBytes(value);
	} catch {
		return failure(referenceIssue("invalid_reference", "$", "Path token is not valid hexadecimal."));
	}
	let path: string;
	try {
		path = UTF8_DECODER.decode(bytes);
	} catch {
		return failure(referenceIssue("invalid_reference", "$", "Path token is not valid UTF-8."));
	}
	const encoded = UTF8.encode(path);
	if (!sameBytes(encoded, bytes) || !validPath(path, change)) {
		return failure(referenceIssue("invalid_reference", "$", "Path token does not identify one valid exact managed path."));
	}
	return success(path);
}

export function profileReferencePathUtf8Hex(path: string, change = false): string {
	const encoded = encodePathUtf8Hex(path, change);
	if (!encoded.ok) throw new Error(encoded.error.message);
	return encoded.value;
}

function decodeReferenceValue(value: CanonicalValue): ProfiledWikiReference {
	const record = exactRecord(CONTRACT, value, "$", [
		"after",
		"before",
		"changePathUtf8Hex",
		"kernelBuildDigest",
		"mappings",
		"profile",
		"protocol",
		"transactionDigest",
	]);
	protocolField(CONTRACT, record, "$", PROFILED_WIKI_REFERENCE_PROTOCOL);
	const profile = literalField(CONTRACT, record, "profile", [WIKI_PROFILE_ID] as const);
	const kernelBuildDigest = digestField(record, "kernelBuildDigest", "$");
	const before = snapshotField(record, "before", "$");
	const after = snapshotField(record, "after", "$");
	if (!before.complete || !after.complete || before.repositoryId !== after.repositoryId || before.objectFormat !== after.objectFormat) {
		rejectContract("invalid_field", CONTRACT, "$.after", "Reference requires complete snapshots of one repository and object format.");
	}
	if (before.commit.hex === after.commit.hex && before.snapshotDigest !== after.snapshotDigest) {
		rejectContract("invalid_field", CONTRACT, "$.after", "One commit cannot claim different snapshot identities.");
	}
	const changePathUtf8Hex = pathHexField(record, "changePathUtf8Hex", "$.changePathUtf8Hex", true);
	const mappings = decodeMappings(requiredField(CONTRACT, record, "mappings"));
	for (const mapping of mappings) {
		if ([...mapping.before, ...mapping.after].some((endpoint) => endpoint.blob.algorithm !== before.objectFormat)) {
			rejectContract("invalid_field", CONTRACT, "$.mappings", "Endpoint object format differs from its snapshots.");
		}
	}
	const transactionDigest = digestField(record, "transactionDigest", "$");
	const body: ProfiledWikiReferenceBody = Object.freeze({
		protocol: PROFILED_WIKI_REFERENCE_PROTOCOL,
		profile,
		kernelBuildDigest,
		before,
		after,
		changePathUtf8Hex,
		mappings,
	});
	// The transaction digest includes re-admitted type contexts and impact subjects.
	// This transport cannot recompute it without the exact sources. The service must
	// reload those sources and compare the complete rebuilt reference on recovery.
	return Object.freeze({...body, transactionDigest});
}

function materializeReference(
	body: ProfiledWikiReferenceBody,
	transactionDigest: Sha256Digest,
): Outcome<ProfiledWikiReference, ProfiledWikiReferenceIssue> {
	return decodeProfiledWikiReference({...body, transactionDigest});
}

function snapshotField(record: CanonicalRecord, field: string, path: string): ProjectSnapshot {
	const snapshot = decodeProjectSnapshot(requiredField(CONTRACT, record, field, path));
	if (!snapshot.ok) rejectContract("invalid_field", CONTRACT, `${path}.${field}`, snapshot.error.message);
	return snapshot.value;
}

function decodeMappings(value: CanonicalValue): readonly ProfiledWikiReferenceMapping[] {
	const input = arrayField(CONTRACT, {mappings: value}, "mappings", "$", PROFILED_WIKI_TRANSACTION_LIMITS.mappings);
	const output: ProfiledWikiReferenceMapping[] = [];
	let beforeCount = 0;
	let afterCount = 0;
	for (let index = 0; index < input.length; index += 1) {
		const path = `$.mappings[${index}]`;
		const record = exactRecord(CONTRACT, input[index] as CanonicalValue, path, ["after", "before", "kind"]);
		const kind = literalField(CONTRACT, record, "kind", PROFILED_WIKI_MAPPING_KINDS, path);
		const before = decodeEndpoints(requiredField(CONTRACT, record, "before", path), `${path}.before`, PROFILED_WIKI_TRANSACTION_LIMITS.endpointsPerSide - beforeCount, false);
		const after = decodeEndpoints(requiredField(CONTRACT, record, "after", path), `${path}.after`, PROFILED_WIKI_TRANSACTION_LIMITS.endpointsPerSide - afterCount, false);
		beforeCount += before.length;
		afterCount += after.length;
		if (!validCardinality(kind, before.length, after.length)) {
			rejectContract("invalid_field", CONTRACT, path, "Mapping kind has invalid endpoint cardinality.");
		}
		if (kind === "revise" || kind === "rename") {
			const first = before[0];
			const last = after[0];
			if (!first || !last || (kind === "revise" ? first.pathUtf8Hex !== last.pathUtf8Hex || first.blob.hex === last.blob.hex : first.pathUtf8Hex === last.pathUtf8Hex)) {
				rejectContract("invalid_field", CONTRACT, path, "Mapping path shape or revision delta is invalid.");
			}
		}
		output.push(Object.freeze({kind, before, after}));
	}
	for (let index = 1; index < output.length; index += 1) {
		if (mappingKey(output[index - 1] as ProfiledWikiReferenceMapping) >= mappingKey(output[index] as ProfiledWikiReferenceMapping)) {
			rejectContract("non_canonical_order", CONTRACT, "$.mappings", "Mappings must be strictly sorted and unique.");
		}
	}
	const beforeSeen = new Set<string>();
	const afterSeen = new Set<string>();
	for (const mapping of output) {
		for (const endpoint of mapping.before) {
			const key = endpoint.pathUtf8Hex;
			if (beforeSeen.has(key)) rejectContract("invalid_field", CONTRACT, "$.mappings", "Before endpoints must be unique across mappings.");
			beforeSeen.add(key);
		}
		for (const endpoint of mapping.after) {
			const key = endpoint.pathUtf8Hex;
			if (afterSeen.has(key)) rejectContract("invalid_field", CONTRACT, "$.mappings", "After endpoints must be unique across mappings.");
			afterSeen.add(key);
		}
	}
	return Object.freeze(output);
}

function decodeEndpoints(
	value: CanonicalValue,
	path: string,
	remaining: number,
	change: boolean,
): readonly ProfiledWikiReferenceEndpoint[] {
	if (remaining < 0) rejectContract("limit_exceeded", CONTRACT, path, "Reference endpoint aggregate exceeds 512 per side.");
	const input = arrayValueBounded(value, path, Math.min(512, remaining));
	const output: ProfiledWikiReferenceEndpoint[] = input.map((entry, index) => {
		const endpointPath = `${path}[${index}]`;
		const record = exactRecord(CONTRACT, entry, endpointPath, ["blob", "pathUtf8Hex"]);
		const pathUtf8Hex = pathHexField(record, "pathUtf8Hex", `${endpointPath}.pathUtf8Hex`, change);
		const blob = oidField(record, "blob", endpointPath);
		return Object.freeze({pathUtf8Hex, blob});
	});
	for (let index = 1; index < output.length; index += 1) {
		if (endpointKey(output[index - 1] as ProfiledWikiReferenceEndpoint) >= endpointKey(output[index] as ProfiledWikiReferenceEndpoint)) {
			rejectContract("non_canonical_order", CONTRACT, path, "Endpoints must be strictly sorted and unique.");
		}
	}
	return Object.freeze(output);
}

function arrayValueBounded(value: CanonicalValue, path: string, maximum: number): readonly CanonicalValue[] {
	if (!Array.isArray(value)) rejectContract("invalid_field", CONTRACT, path, "Value must be an array.");
	if (value.length > maximum) rejectContract("limit_exceeded", CONTRACT, path, "Reference endpoint aggregate exceeds its bound.");
	return value;
}

function pathHexField(record: CanonicalRecord, field: string, path: string, change: boolean): string {
	const value = textField(CONTRACT, record, field, path, {maximumBytes: WIKI_PROFILE_LIMITS.pathBytes * 2});
	if (!isCanonicalHex(value, change ? "change" : "wiki")) {
		rejectContract("invalid_field", CONTRACT, path, "Path token must be canonical lowercase UTF-8 hex.");
	}
	const decoded = decodeProfiledPathUtf8Hex(value, change);
	if (!decoded.ok) rejectContract("invalid_field", CONTRACT, path, decoded.error.message);
	return value;
}

function digestField(record: CanonicalRecord, field: string, path: string): Sha256Digest {
	const decoded = decodeSha256Digest(record[field]);
	if (!decoded.ok) rejectContract("invalid_field", CONTRACT, `${path}.${field}`, decoded.error.message);
	return decoded.value;
}

function oidField(record: CanonicalRecord, field: string, path: string): GitOid {
	const decoded = decodeGitOid(record[field]);
	if (!decoded.ok) rejectContract("invalid_field", CONTRACT, `${path}.${field}`, decoded.error.message);
	return decoded.value;
}

function encodePathUtf8Hex(value: unknown, change: boolean): Outcome<string, ProfiledWikiReferenceIssue> {
	if (typeof value !== "string" || !validPath(value, change)) {
		return failure(referenceIssue("invalid_reference", "$", "Path must be one valid exact managed path."));
	}
	const bytes = UTF8.encode(value);
	let hex = "";
	for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
	return success(hex);
}

function isCanonicalHex(value: string, kind: "change" | "wiki"): boolean {
	const max = WIKI_PROFILE_LIMITS.pathBytes * 2;
	if (value.length === 0 || value.length > max || value.length % 2 !== 0 || !HEX.test(value)) return false;
	return kind === "change" ? CHANGE_PATH.test(decodedHexPath(value)) : true;
}

function decodedHexPath(value: string): string {
	try {
		return UTF8_DECODER.decode(hexBytes(value));
	} catch {
		return "";
	}
}

function validPath(value: string, change: boolean): boolean {
	if (value.length === 0 || value.length > WIKI_PROFILE_LIMITS.pathBytes || UTF8.encode(value).byteLength > WIKI_PROFILE_LIMITS.pathBytes || value.includes("\0") || /[\\\u0000-\u001f\u007f\uFEFF]/u.test(value) || /[\uD800-\uDFFF]/u.test(value)) return false;
	const segments = value.split("/");
	if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) return false;
	if (change) return value.startsWith(".changekernel/changes/") && segments.length >= 3;
	return wikiPath(value);
}

function validCardinality(kind: ProfiledWikiMappingKind, before: number, after: number): boolean {
	switch (kind) {
		case "add": return before === 0 && after === 1;
		case "revise":
		case "rename": return before === 1 && after === 1;
		case "split": return before === 1 && after > 1;
		case "merge": return before > 1 && after === 1;
		case "retire": return before === 1 && after === 0;
	}
}

function referenceMapping(mapping: ProfiledWikiTransaction["mappings"][number]): ProfiledWikiReferenceMapping {
	return Object.freeze({
		kind: mapping.kind,
		before: Object.freeze(mapping.before.map((endpoint) => Object.freeze({pathUtf8Hex: profileReferencePathUtf8Hex(endpoint.path), blob: endpoint.blob})).sort(compareEndpoints)),
		after: Object.freeze(mapping.after.map((endpoint) => Object.freeze({pathUtf8Hex: profileReferencePathUtf8Hex(endpoint.path), blob: endpoint.blob})).sort(compareEndpoints)),
	});
}

function endpointKey(endpoint: ProfiledWikiReferenceEndpoint): string {
	return `${endpoint.pathUtf8Hex}\u0000${endpoint.blob.algorithm}:${endpoint.blob.hex}`;
}

function mappingKey(mapping: ProfiledWikiReferenceMapping): string {
	return `${mapping.kind}\u0000${mapping.before.map(endpointKey).join("\u0001")}\u0000${mapping.after.map(endpointKey).join("\u0001")}`;
}

function compareEndpoints(left: ProfiledWikiReferenceEndpoint, right: ProfiledWikiReferenceEndpoint): number {
	const l = endpointKey(left);
	const r = endpointKey(right);
	return l < r ? -1 : l > r ? 1 : 0;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
	return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

function hexBytes(value: string): Uint8Array {
	const bytes = new Uint8Array(value.length / 2);
	for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
	return bytes;
}

function referenceIssue(
	code: "invalid_reference",
	path: string,
	message: string,
): Extract<ProfiledWikiReferenceIssue, {code: "invalid_reference"}> {
	return Object.freeze({code, path, message});
}
