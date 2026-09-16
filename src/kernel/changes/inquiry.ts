import {
	arrayField, assertDigestMatch, decodeContract, exactRecord, integerField, isNamespacedIdentifier,
	literalField, nullableValue, protocolField, protocolIdentity, rejectContract, requiredField,
	sortedUniqueTextArray, textField, textValue, type CanonicalRecord, type ContractIssue,
} from "../data-contracts/validation.ts";
import {canonicalJson, type CanonicalLimits, type CanonicalValue} from "../data-contracts/canonical-json.ts";
import type {Outcome} from "../data-contracts/outcome.ts";
import {decodeGitOidValue, type GitOid} from "../identity/git.ts";
import {semanticDigest} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, sha256Digest, type Sha256Digest} from "../identity/sha256.ts";
import {WIKI_PROFILE_ID} from "../wiki/profile.ts";
import {decodeProfiledPathUtf8Hex, decodeProfiledWikiReference, type ProfiledWikiReference} from "../wiki/profile-reference.ts";
import {CHANGE_REALIZATIONS, CHANGE_RELATIONS, CHANGE_TYPES, type ChangeRealization, type ChangeRelation, type ChangeType} from "./contracts.ts";
import {decodeProjectSnapshotValue, type ProjectSnapshot} from "./snapshot.ts";

export const INQUIRY_CHANGE_PROTOCOL = protocolIdentity("codewiki.change", "3.0.0");
export const INQUIRY_SOURCE_DOMAIN = "codewiki.change-source@1.0.0";
export const INQUIRY_LIMITS = Object.freeze({
	sources: 16, submittedBytes: 64 * 1024, proseBytes: 16 * 1024,
	statementEntries: 32, statementBytes: 2 * 1024, relationships: 32,
	changeBytes: 256 * 1024, pathBytes: 4096,
});
export const INQUIRY_CANONICAL_LIMITS: CanonicalLimits = Object.freeze({
	maximumDepth: 32, maximumEntriesPerContainer: 1024,
	maximumNodes: 16_384, maximumTextBytes: INQUIRY_LIMITS.changeBytes,
});

/** Claimed locators and authors are unverified; capture authority belongs to the event. */
export interface SubmittedInquirySourceBody {
	readonly kind: "submitted";
	readonly contentUtf8Hex: string;
	readonly contentDigest: Sha256Digest;
	readonly claimedLocator: string | null;
	readonly claimedAttribution: string | null;
}
/** These are retained identity claims. Native source loading/reopening must verify them. */
export interface RepositoryInquirySourceBody {
	readonly kind: "repository";
	readonly snapshot: ProjectSnapshot;
	readonly pathUtf8Hex: string;
	readonly mode: "100644" | "100755";
	readonly blob: GitOid;
	readonly contentDigest: Sha256Digest;
}
export type InquirySourceBody = SubmittedInquirySourceBody | RepositoryInquirySourceBody;
export type InquirySource = InquirySourceBody & Readonly<{sourceDigest: Sha256Digest}>;

export interface InquiryIntentBasis {
	readonly kind: "supplied" | "interpreted";
	readonly sourceDigests: readonly Sha256Digest[];
	readonly producerRunRef: string | null;
}
export type InquiryWikiConsequences =
	| Readonly<{kind: "unresolved"}>
	| Readonly<{kind: "none"; reason: string}>
	| Readonly<{kind: "profile"; reference: ProfiledWikiReference}>;

export interface InquiryChangeBody {
	readonly protocol: typeof INQUIRY_CHANGE_PROTOCOL;
	readonly changeId: string;
	readonly repositoryId: string;
	readonly revision: number;
	readonly baseline: ProjectSnapshot;
	readonly profile: typeof WIKI_PROFILE_ID;
	readonly intent: string;
	readonly intentBasis: InquiryIntentBasis;
	readonly rationale: string | null;
	readonly scope: string | null;
	readonly changeType: ChangeType | null;
	readonly realization: ChangeRealization | null;
	readonly acceptance: readonly string[];
	readonly questions: readonly string[];
	readonly assumptions: readonly string[];
	readonly sources: readonly InquirySource[];
	readonly relationships: readonly ChangeRelation[];
	readonly wikiConsequences: InquiryWikiConsequences;
}
export interface InquiryChange extends InquiryChangeBody {readonly changeDigest: Sha256Digest;}

const CONTRACT = "Inquiry Change";
const SOURCE = "Inquiry source";
const CHANGE_DOMAIN = `${INQUIRY_CHANGE_PROTOCOL.id}@${INQUIRY_CHANGE_PROTOCOL.version}`;
const CHANGE_FIELDS = [
	"acceptance", "assumptions", "baseline", "changeId", "changeType", "intent", "intentBasis",
	"profile", "questions", "rationale", "realization", "relationships", "repositoryId", "revision",
	"scope", "sources", "wikiConsequences",
];
const SOURCE_FIELDS = {
	submitted: ["kind", "contentUtf8Hex", "contentDigest", "claimedLocator", "claimedAttribution"],
	repository: ["kind", "snapshot", "pathUtf8Hex", "mode", "blob", "contentDigest"],
};

export function createInquirySource(body: InquirySourceBody): Outcome<InquirySource, ContractIssue> {
	return decodeContract(SOURCE, body, (value) => {
		const record = sourceRecord(value, "$", false);
		const sourceDigest = digestOf(INQUIRY_SOURCE_DOMAIN, record, SOURCE, "$");
		return decodeInquirySourceValue({...record, sourceDigest});
	}, INQUIRY_CANONICAL_LIMITS);
}
export function decodeInquirySource(input: unknown): Outcome<InquirySource, ContractIssue> {
	return decodeContract(SOURCE, input, decodeInquirySourceValue, INQUIRY_CANONICAL_LIMITS);
}
export function createInquiryChange(body: Omit<InquiryChangeBody, "protocol">): Outcome<InquiryChange, ContractIssue> {
	return decodeContract(CONTRACT, body, (value) => {
		const record = exactRecord(CONTRACT, value, "$", CHANGE_FIELDS);
		const content = {...record, protocol: {...INQUIRY_CHANGE_PROTOCOL}};
		const changeDigest = digestOf(CHANGE_DOMAIN, content, CONTRACT, "$");
		return decodeInquiryChangeValue({...content, changeDigest});
	}, INQUIRY_CANONICAL_LIMITS);
}
export function decodeInquiryChange(input: unknown): Outcome<InquiryChange, ContractIssue> {
	return decodeContract(CONTRACT, input, decodeInquiryChangeValue, INQUIRY_CANONICAL_LIMITS);
}

export function decodeInquiryChangeValue(value: CanonicalValue, path = "$"): InquiryChange {
	const record = exactRecord(CONTRACT, value, path, [...CHANGE_FIELDS, "protocol", "changeDigest"]);
	assertRecordBudget(value, path);
	protocolField(CONTRACT, record, path, INQUIRY_CHANGE_PROTOCOL);
	const changeId = inquiryChangeId(record, path);
	const repositoryId = namespaced(record, "repositoryId", path);
	const baseline = completeSnapshot(requiredField(CONTRACT, record, "baseline", path), `${path}.baseline`);
	if (baseline.repositoryId !== repositoryId) rejectContract("invalid_field", CONTRACT, `${path}.baseline`, "Baseline belongs to another repository.");
	const sources = Object.freeze(arrayField(CONTRACT, record, "sources", path, INQUIRY_LIMITS.sources)
		.map((entry, index) => decodeInquirySourceValue(entry, `${path}.sources[${index}]`)));
	if (sources.length === 0) rejectContract("missing_field", CONTRACT, `${path}.sources`, "Inquiry requires an attributable source capture.");
	const sourceDigests = new Set(sources.map((source) => source.sourceDigest));
	if (sourceDigests.size !== sources.length) rejectContract("invalid_field", CONTRACT, `${path}.sources`, "Source records must be unique.");
	let submittedBytes = 0;
	for (const source of sources) {
		if (source.kind === "submitted") submittedBytes += source.contentUtf8Hex.length / 2;
		else if (source.snapshot.repositoryId !== repositoryId || source.snapshot.objectFormat !== baseline.objectFormat) {
			rejectContract("invalid_field", CONTRACT, `${path}.sources`, "Repository sources must share the inquiry repository and object format.");
		}
	}
	if (submittedBytes > INQUIRY_LIMITS.submittedBytes) rejectContract("limit_exceeded", CONTRACT, `${path}.sources`, "Aggregate submitted bytes exceed 64 KiB.");
	const intentBasis = decodeIntentBasis(requiredField(CONTRACT, record, "intentBasis", path), `${path}.intentBasis`);
	if (intentBasis.sourceDigests.some((digest) => !sourceDigests.has(digest))) rejectContract("invalid_field", CONTRACT, `${path}.intentBasis`, "Intent basis must name captured sources in this revision.");
	const wikiConsequences = decodeConsequences(requiredField(CONTRACT, record, "wikiConsequences", path), `${path}.wikiConsequences`, changeId, baseline);
	assertConsistentSources(baseline, sources, wikiConsequences, path);
	const relationships = Object.freeze(arrayField(CONTRACT, record, "relationships", path, INQUIRY_LIMITS.relationships).map((entry, index) => {
		const at = `${path}.relationships[${index}]`;
		const relation = exactRecord(CONTRACT, entry, at, ["kind", "changeId"]);
		const target = inquiryChangeId(relation, at);
		if (target === changeId) rejectContract("invalid_field", CONTRACT, at, "Change cannot relate to itself.");
		return Object.freeze({kind: literalField(CONTRACT, relation, "kind", CHANGE_RELATIONS, at), changeId: target});
	}));
	assertSorted(relationships.map((entry) => `${entry.kind}\0${entry.changeId}`), `${path}.relationships`);
	const changeDigest = digestField(record, "changeDigest", path);
	const result = Object.freeze({
		protocol: INQUIRY_CHANGE_PROTOCOL, changeId, repositoryId,
		revision: integerField(CONTRACT, record, "revision", path, 1, 1_000_000), baseline,
		profile: literalField(CONTRACT, record, "profile", [WIKI_PROFILE_ID] as const, path),
		intent: prose(record, "intent", path), intentBasis,
		rationale: nullableProse(record, "rationale", path), scope: nullableProse(record, "scope", path),
		changeType: nullableValue(requiredField(CONTRACT, record, "changeType", path), () => literalField(CONTRACT, record, "changeType", CHANGE_TYPES, path)),
		realization: nullableValue(requiredField(CONTRACT, record, "realization", path), () => literalField(CONTRACT, record, "realization", CHANGE_REALIZATIONS, path)),
		acceptance: statements(record, "acceptance", path), questions: statements(record, "questions", path), assumptions: statements(record, "assumptions", path),
		sources, relationships, wikiConsequences, changeDigest,
	});
	const {changeDigest: _digest, ...body} = result;
	assertDigestMatch(CONTRACT, `${path}.changeDigest`, changeDigest, digestOf(CHANGE_DOMAIN, body, CONTRACT, path));
	return result;
}

function sourceRecord(value: CanonicalValue, path: string, withDigest: boolean): CanonicalRecord {
	const outer = exactRecord(SOURCE, value, path, ["kind"], [...SOURCE_FIELDS.submitted, ...SOURCE_FIELDS.repository, "sourceDigest"]);
	const kind = literalField(SOURCE, outer, "kind", ["submitted", "repository"] as const, path);
	return exactRecord(SOURCE, value, path, [...SOURCE_FIELDS[kind], ...(withDigest ? ["sourceDigest"] : [])]);
}
function decodeInquirySourceValue(value: CanonicalValue, path = "$"): InquirySource {
	const record = sourceRecord(value, path, true);
	const contentDigest = digestField(record, "contentDigest", path);
	const sourceDigest = digestField(record, "sourceDigest", path);
	let body: InquirySourceBody;
	if (record.kind === "submitted") {
		const contentUtf8Hex = textField(SOURCE, record, "contentUtf8Hex", path, {minimumBytes: 0, maximumBytes: INQUIRY_LIMITS.submittedBytes * 2});
		const bytes = utf8Hex(contentUtf8Hex, INQUIRY_LIMITS.submittedBytes, `${path}.contentUtf8Hex`);
		assertDigestMatch(SOURCE, `${path}.contentDigest`, contentDigest, sha256Digest(bytes));
		body = {kind: "submitted", contentUtf8Hex, contentDigest,
			claimedLocator: nullableProse(record, "claimedLocator", path, INQUIRY_LIMITS.statementBytes),
			claimedAttribution: nullableProse(record, "claimedAttribution", path, INQUIRY_LIMITS.statementBytes)};
	} else {
		const snapshot = completeSnapshot(requiredField(SOURCE, record, "snapshot", path), `${path}.snapshot`);
		const blob = decodeGitOidValue(requiredField(SOURCE, record, "blob", path), `${path}.blob`);
		if (blob.algorithm !== snapshot.objectFormat) rejectContract("invalid_field", SOURCE, `${path}.blob`, "Source blob must use the snapshot object format.");
		const pathUtf8Hex = textField(SOURCE, record, "pathUtf8Hex", path, {maximumBytes: INQUIRY_LIMITS.pathBytes * 2});
		const bytes = utf8Hex(pathUtf8Hex, INQUIRY_LIMITS.pathBytes, `${path}.pathUtf8Hex`);
		const rawPath = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(bytes);
		if (rawPath.includes("\0") || rawPath.includes("\\") || /^[A-Za-z]:/u.test(rawPath) ||
			rawPath.split("/").some((segment) => segment === "" || segment === "." || segment === "..") || !/\.(?:md|markdown)$/iu.test(rawPath)) {
			rejectContract("invalid_field", SOURCE, `${path}.pathUtf8Hex`, "Source must name one exact repository-relative Markdown path.");
		}
		body = {kind: "repository", snapshot, pathUtf8Hex,
			mode: literalField(SOURCE, record, "mode", ["100644", "100755"] as const, path), blob, contentDigest};
	}
	assertDigestMatch(SOURCE, `${path}.sourceDigest`, sourceDigest, digestOf(INQUIRY_SOURCE_DOMAIN, body, SOURCE, path));
	return Object.freeze({...body, sourceDigest});
}
function decodeIntentBasis(value: CanonicalValue, path: string): InquiryIntentBasis {
	const record = exactRecord(CONTRACT, value, path, ["kind", "sourceDigests", "producerRunRef"]);
	const sources = sortedUniqueTextArray(CONTRACT, requiredField(CONTRACT, record, "sourceDigests", path), `${path}.sourceDigests`, {maximumEntries: INQUIRY_LIMITS.sources, maximumBytes: 71});
	if (sources.length === 0 || sources.some((value) => !decodeSha256Digest(value).ok)) rejectContract("invalid_field", CONTRACT, `${path}.sourceDigests`, "Intent requires a nonempty source-digest set.");
	return Object.freeze({
		kind: literalField(CONTRACT, record, "kind", ["supplied", "interpreted"] as const, path),
		sourceDigests: Object.freeze(sources.map((value) => {
			const decoded = decodeSha256Digest(value);
			if (!decoded.ok) rejectContract("invalid_field", CONTRACT, path, decoded.error.message);
			return decoded.value;
		})),
		producerRunRef: nullableValue(requiredField(CONTRACT, record, "producerRunRef", path), () => namespaced(record, "producerRunRef", path)),
	});
}
function decodeConsequences(value: CanonicalValue, path: string, changeId: string, baseline: ProjectSnapshot): InquiryWikiConsequences {
	const outer = exactRecord(CONTRACT, value, path, ["kind"], ["reason", "reference"]);
	const kind = literalField(CONTRACT, outer, "kind", ["unresolved", "none", "profile"] as const, path);
	const record = exactRecord(CONTRACT, value, path, kind === "unresolved" ? ["kind"] : kind === "none" ? ["kind", "reason"] : ["kind", "reference"]);
	if (kind === "unresolved") return Object.freeze({kind});
	if (kind === "none") return Object.freeze({kind, reason: prose(record, "reason", path)});
	const reference = decodeProfiledWikiReference(requiredField(CONTRACT, record, "reference", path));
	if (!reference.ok) rejectContract("invalid_field", CONTRACT, `${path}.reference`, reference.error.message);
	const responsible = decodeProfiledPathUtf8Hex(reference.value.changePathUtf8Hex, true);
	if (reference.value.before.snapshotDigest !== baseline.snapshotDigest || !responsible.ok || responsible.value !== `.changekernel/changes/TRACE-${changeId}.jsonl` || reference.value.mappings.length === 0) {
		rejectContract("invalid_field", CONTRACT, path, "Attachment requires this complete baseline, responsible Change and nonempty transaction endpoints.");
	}
	return Object.freeze({kind, reference: reference.value});
}
function assertConsistentSources(baseline: ProjectSnapshot, sources: readonly InquirySource[], consequences: InquiryWikiConsequences, path: string): void {
	const snapshots = new Map<string, Sha256Digest>();
	const blobs = new Map<string, Sha256Digest>();
	const paths = new Map<string, string>();
	const repositorySources = sources.filter((source): source is RepositoryInquirySourceBody & {sourceDigest: Sha256Digest} => source.kind === "repository");
	for (const snapshot of [baseline, ...repositorySources.map((source) => source.snapshot), ...(consequences.kind === "profile" ? [consequences.reference.after] : [])]) {
		const prior = snapshots.get(snapshot.commit.hex);
		if (prior !== undefined && prior !== snapshot.snapshotDigest) rejectContract("invalid_field", CONTRACT, path, "One commit cannot claim different complete snapshots.");
		snapshots.set(snapshot.commit.hex, snapshot.snapshotDigest);
	}
	for (const source of repositorySources) {
		const blobDigest = blobs.get(source.blob.hex);
		const key = `${source.snapshot.commit.hex}:${source.pathUtf8Hex}`;
		const identity = `${source.mode}:${source.blob.hex}`;
		if ((blobDigest !== undefined && blobDigest !== source.contentDigest) || (paths.has(key) && paths.get(key) !== identity)) {
			rejectContract("invalid_field", CONTRACT, path, "Repository source identities contain contradictory byte or path claims.");
		}
		blobs.set(source.blob.hex, source.contentDigest); paths.set(key, identity);
	}
}
function completeSnapshot(value: CanonicalValue, path: string): ProjectSnapshot {
	const snapshot = decodeProjectSnapshotValue(value, path);
	if (!snapshot.complete) rejectContract("invalid_field", CONTRACT, path, "Inquiry requires complete Git snapshot grounds.");
	return snapshot;
}
function statements(record: CanonicalRecord, field: string, path: string): readonly string[] {
	return Object.freeze(arrayField(CONTRACT, record, field, path, INQUIRY_LIMITS.statementEntries)
		.map((entry, index) => nonblank(entry, `${path}.${field}[${index}]`, INQUIRY_LIMITS.statementBytes)));
}
function prose(record: CanonicalRecord, field: string, path: string, maximum = INQUIRY_LIMITS.proseBytes): string {
	return nonblank(requiredField(CONTRACT, record, field, path), `${path}.${field}`, maximum);
}
function nullableProse(record: CanonicalRecord, field: string, path: string, maximum = INQUIRY_LIMITS.proseBytes): string | null {
	return nullableValue(requiredField(CONTRACT, record, field, path), (value) => nonblank(value, `${path}.${field}`, maximum));
}
function nonblank(value: CanonicalValue, path: string, maximum: number): string {
	const text = textValue(CONTRACT, value, path, {maximumBytes: maximum});
	if (text.trim().length === 0 || /[\uD800-\uDFFF]/u.test(text)) rejectContract("invalid_field", CONTRACT, path, "Interpreted prose must be nonblank Unicode text.");
	return text;
}
function inquiryChangeId(record: CanonicalRecord, path: string): string {
	return textField(CONTRACT, record, "changeId", path, {maximumBytes: 200, pattern: /^CHG-[A-Za-z0-9][A-Za-z0-9._-]*$/u});
}
function namespaced(record: CanonicalRecord, field: string, path: string): string {
	const value = textField(CONTRACT, record, field, path, {maximumBytes: 256});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", CONTRACT, `${path}.${field}`, "Identity must be canonical namespaced text.");
	return value;
}
function digestField(record: CanonicalRecord, field: string, path: string): Sha256Digest {
	const decoded = decodeSha256Digest(record[field]);
	if (!decoded.ok) rejectContract("invalid_field", CONTRACT, `${path}.${field}`, decoded.error.message);
	return decoded.value;
}
function digestOf(domain: string, body: unknown, contract: string, path: string): Sha256Digest {
	const digest = semanticDigest(domain, body);
	if (!digest.ok) rejectContract("invalid_field", contract, path, digest.error.message);
	return digest.value;
}
function assertSorted(values: readonly string[], path: string): void {
	for (let index = 1; index < values.length; index += 1) {
		if ((values[index - 1] ?? "") >= (values[index] ?? "")) rejectContract("non_canonical_order", CONTRACT, path, "Entries must be strictly sorted and unique.");
	}
}
function utf8Hex(value: string, maximum: number, path: string): Uint8Array {
	if (value.length > maximum * 2 || value.length % 2 !== 0 || !/^[0-9a-f]*$/u.test(value)) rejectContract("invalid_field", SOURCE, path, "Expected bounded lowercase UTF-8 hex.");
	const bytes = new Uint8Array(value.length / 2);
	for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
	try { new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(bytes); }
	catch { rejectContract("invalid_field", SOURCE, path, "Captured bytes must be valid UTF-8 without normalization."); }
	return bytes;
}
function assertRecordBudget(value: CanonicalValue, path: string): void {
	const encoded = canonicalJson(value, INQUIRY_CANONICAL_LIMITS);
	if (!encoded.ok || new TextEncoder().encode(encoded.value).byteLength > INQUIRY_LIMITS.changeBytes) rejectContract("limit_exceeded", CONTRACT, path, "Canonical inquiry Change exceeds 256 KiB or its container budgets.");
}
