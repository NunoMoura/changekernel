import {decodeProjectSnapshot, type ProjectSnapshot} from "../changes/snapshot.ts";
import {failure, success, type Outcome} from "../data-contracts/outcome.ts";
import {decodeGitOid, sameGitOid, type GitOid} from "../identity/git.ts";
import {semanticDigest} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, sha256Digest, type Sha256Digest} from "../identity/sha256.ts";
import {
	admitProfiledWikiFiles,
	bindWikiTypes,
	wikiPath,
	WIKI_PROFILE_ID,
	WIKI_PROFILE_LIMITS,
	type ProfiledWikiFile,
	type WikiIssue,
	type WikiTypeBinding,
	type WikiTypeContext,
} from "./profile.ts";

export const PROFILED_WIKI_TRANSACTION_PROTOCOL = Object.freeze({
	id: "codewiki.profiled-wiki-transaction",
	version: "1.0.0",
} as const);

export const PROFILED_WIKI_MAPPING_KINDS = Object.freeze([
	"add",
	"revise",
	"rename",
	"split",
	"merge",
	"retire",
] as const);

export const PROFILED_WIKI_TRANSACTION_LIMITS = Object.freeze({
	mappings: WIKI_PROFILE_LIMITS.files * 2,
	endpointsPerMappingSide: WIKI_PROFILE_LIMITS.files,
	endpointsPerSide: WIKI_PROFILE_LIMITS.files,
});

export type ProfiledWikiMappingKind = typeof PROFILED_WIKI_MAPPING_KINDS[number];

export interface ProfiledWikiEndpoint {
	readonly path: string;
	readonly blob: GitOid;
}

export interface ProfiledWikiMapping {
	readonly kind: ProfiledWikiMappingKind;
	readonly before: readonly ProfiledWikiEndpoint[];
	readonly after: readonly ProfiledWikiEndpoint[];
}

export interface ProfiledWikiTransactionSourceInput {
	readonly snapshot: unknown;
	readonly files?: readonly ProfiledWikiFile[];
	readonly managedFiles?: readonly ProfiledWikiFile[];
	/** Recomputed and never trusted; accepted for direct loadProfiledWikiSource handoff. */
	readonly typeContext?: unknown;
	/** Passive material is not interpreted by this pure boundary. */
	readonly corpus?: unknown;
}

export interface ProfiledWikiTransactionInput {
	readonly profile: unknown;
	readonly kernelBuildDigest: unknown;
	readonly responsibleChangePath: unknown;
	readonly before: ProfiledWikiTransactionSourceInput;
	readonly after: ProfiledWikiTransactionSourceInput;
	readonly mappings: readonly ProfiledWikiMapping[];
}

export interface ProfiledWikiTransactionSource {
	readonly snapshot: ProjectSnapshot;
	readonly files: readonly ProfiledWikiFile[];
	readonly typeContext: WikiTypeContext;
}

export interface ProfiledWikiTypeImpact {
	readonly kind: "potential_type_impact";
	readonly item: ProfiledWikiEndpoint;
	readonly type: string;
	readonly definitionBefore: ProfiledWikiEndpoint | null;
	readonly definitionAfter: ProfiledWikiEndpoint | null;
}

export interface ProfiledWikiTransaction {
	readonly protocol: typeof PROFILED_WIKI_TRANSACTION_PROTOCOL;
	readonly profile: typeof WIKI_PROFILE_ID;
	readonly kernelBuildDigest: Sha256Digest;
	readonly responsibleChangePath: string;
	readonly before: ProfiledWikiTransactionSource;
	readonly after: ProfiledWikiTransactionSource;
	readonly mappings: readonly ProfiledWikiMapping[];
	readonly potentialTypeImpacts: readonly ProfiledWikiTypeImpact[];
	readonly transactionDigest: Sha256Digest;
}

export type ProfiledWikiTransactionIssueCode =
	| "invalid_input"
	| "invalid_profile"
	| "invalid_kernel_build"
	| "invalid_snapshot"
	| "incomplete_snapshot"
	| "incompatible_snapshot"
	| "invalid_files"
	| "invalid_mapping"
	| "invalid_endpoint"
	| "missing_endpoint"
	| "duplicate_endpoint"
	| "identity_mismatch"
	| "mapping_cardinality"
	| "incomplete_coverage"
	| "no_op_mapping"
	| "lineage_mismatch"
	| "revision_mismatch"
	| "identity_failure"
	| WikiIssue["code"];

export interface ProfiledWikiTransactionIssue {
	readonly code: ProfiledWikiTransactionIssueCode;
	readonly path: string;
	readonly message: string;
	readonly cause?: WikiIssue | Readonly<{message: string}>;
}

interface UnknownRecord {
	readonly [key: string]: unknown;
}

interface AdmittedSource {
	readonly snapshot: ProjectSnapshot;
	readonly files: readonly ProfiledWikiFile[];
	readonly typeContext: WikiTypeContext;
}

interface SourceIndexes {
	readonly byPath: ReadonlyMap<string, ProfiledWikiFile>;
	readonly byEndpoint: ReadonlyMap<string, ProfiledWikiFile>;
}

interface MappingValidation {
	readonly mappings: readonly ProfiledWikiMapping[];
	readonly before: SourceIndexes;
	readonly after: SourceIndexes;
}

const UTF8 = new TextEncoder();
const UNPAIRED_SURROGATE = /[\uD800-\uDFFF]/u;
const PROTOCOL_LABEL = `${PROFILED_WIKI_TRANSACTION_PROTOCOL.id}@${PROFILED_WIKI_TRANSACTION_PROTOCOL.version}`;

/**
 * Pure admission for already profile-selected exact source subjects. This
 * function does not read Git, establish membership, authorize a Change, or
 * persist lifecycle state.
 */
export function validateProfiledWikiTransaction(
	input: unknown,
): Outcome<ProfiledWikiTransaction, ProfiledWikiTransactionIssue> {
	const request = ownRecord(input, ["after", "before", "kernelBuildDigest", "mappings", "profile", "responsibleChangePath"]);
	if (!request) return failure(transactionIssue("invalid_input", "$", "Expected an own-data profile transaction request."));
	if (request.profile !== WIKI_PROFILE_ID) {
		return failure(transactionIssue("invalid_profile", "$.profile", "An explicit supported Wiki profile is required."));
	}
	const kernelBuildDigest = decodeSha256Digest(request.kernelBuildDigest);
	if (!kernelBuildDigest.ok) {
		return failure(transactionIssue("invalid_kernel_build", "$.kernelBuildDigest", "Expected one validated Kernel Build digest.", kernelBuildDigest.error));
	}
	const responsibleChangePath = changePath(request.responsibleChangePath);
	if (responsibleChangePath === null) {
		return failure(transactionIssue("invalid_input", "$.responsibleChangePath", "Responsible Change path must be canonical Project-relative data."));
	}

	const before = admitSource(request.before, "$.before");
	if (!before.ok) return before;
	const after = admitSource(request.after, "$.after");
	if (!after.ok) return after;
	if (before.value.snapshot.repositoryId !== after.value.snapshot.repositoryId ||
		before.value.snapshot.objectFormat !== after.value.snapshot.objectFormat) {
		return failure(transactionIssue("incompatible_snapshot", "$.after.snapshot", "Before and after snapshots must share repository identity and object format."));
	}
	const snapshotIssue = compatibleSourceClaims(before.value, after.value);
	if (snapshotIssue) return failure(snapshotIssue);
	const blobTextIssue = sameClaimedBlobText(before.value.files, after.value.files);
	if (blobTextIssue) return failure(blobTextIssue);

	const mappings = decodeMappings(request.mappings);
	if (!mappings.ok) return mappings;
	const checked = validateMappings(mappings.value, before.value, after.value, responsibleChangePath);
	if (!checked.ok) return checked;
	const potentialTypeImpacts = typeImpacts(before.value, after.value, checked.value.before, checked.value.after);

	const digestBody = Object.freeze({
		protocol: PROFILED_WIKI_TRANSACTION_PROTOCOL,
		profile: WIKI_PROFILE_ID,
		kernelBuildDigest: kernelBuildDigest.value,
		responsibleChangePath: textDigest(responsibleChangePath),
		before: digestSource(before.value),
		after: digestSource(after.value),
		mappings: Object.freeze(checked.value.mappings.map(digestMapping)),
		potentialTypeImpacts: Object.freeze(potentialTypeImpacts.map(digestTypeImpact)),
	});
	const digest = semanticDigest(PROTOCOL_LABEL, digestBody);
	if (!digest.ok) return failure(transactionIssue("identity_failure", "$", digest.error.message, digest.error));

	const result = Object.freeze({
		protocol: PROFILED_WIKI_TRANSACTION_PROTOCOL,
		profile: WIKI_PROFILE_ID,
		kernelBuildDigest: kernelBuildDigest.value,
		responsibleChangePath,
		before: before.value,
		after: after.value,
		mappings: checked.value.mappings,
		potentialTypeImpacts,
		transactionDigest: digest.value,
	});
	return success(result);
}

function admitSource(input: unknown, path: string): Outcome<AdmittedSource, ProfiledWikiTransactionIssue> {
	const source = ownRecord(input, ["snapshot"], ["corpus", "files", "managedFiles", "typeContext"]);
	if (!source) return failure(transactionIssue("invalid_input", path, "Source must contain own-data snapshot and managed files."));
	const snapshot = decodeProjectSnapshot(source.snapshot);
	if (!snapshot.ok) return failure(transactionIssue("invalid_snapshot", `${path}.snapshot`, snapshot.error.message, snapshot.error));
	if (!snapshot.value.complete) {
		return failure(transactionIssue("incomplete_snapshot", `${path}.snapshot.complete`, "Profile transaction admission requires complete Project snapshots."));
	}
	const hasFiles = Object.hasOwn(source, "files");
	const hasManagedFiles = Object.hasOwn(source, "managedFiles");
	if (hasFiles === hasManagedFiles) {
		return failure(transactionIssue("invalid_input", path, "Source must provide exactly one managed file collection."));
	}
	const rawFiles = hasFiles ? source.files : source.managedFiles;
	const files = ownArray(rawFiles, WIKI_PROFILE_LIMITS.files);
	if (!files) return failure(transactionIssue("invalid_files", `${path}.files`, "Managed files must be a bounded dense own-data array."));
	const admitted = admitProfiledWikiFiles(snapshot.value.commit, files as readonly ProfiledWikiFile[]);
	if (!admitted.ok) return failure(transactionIssue(admitted.error.code, `${path}.files`, admitted.error.message, admitted.error));
	const typeContext = bindWikiTypes(snapshot.value.commit, admitted.value.files);
	if (!typeContext.ok) return failure(transactionIssue(typeContext.error.code, `${path}.typeContext`, typeContext.error.message, typeContext.error));
	if (typeContext.value.profile !== WIKI_PROFILE_ID || !sameGitOid(typeContext.value.snapshot, snapshot.value.commit)) {
		return failure(transactionIssue("invalid_files", `${path}.typeContext`, "Recomputed profile type context is not bound to the exact snapshot."));
	}
	return success(Object.freeze({
		snapshot: snapshot.value,
		files: admitted.value.files,
		typeContext: typeContext.value,
	}));
}

function decodeMappings(input: unknown): Outcome<readonly ProfiledWikiMapping[], ProfiledWikiTransactionIssue> {
	const rawMappings = ownArray(input, PROFILED_WIKI_TRANSACTION_LIMITS.mappings);
	if (!rawMappings) return failure(transactionIssue("invalid_mapping", "$.mappings", "Mappings must be a bounded dense own-data array."));
	const output: ProfiledWikiMapping[] = [];
	let remainingBefore = PROFILED_WIKI_TRANSACTION_LIMITS.endpointsPerSide;
	let remainingAfter = PROFILED_WIKI_TRANSACTION_LIMITS.endpointsPerSide;
	for (let index = 0; index < rawMappings.length; index += 1) {
		const path = `$.mappings[${index}]`;
		const rawMapping = ownRecord(rawMappings[index], ["after", "before", "kind"]);
		if (!rawMapping) return failure(transactionIssue("invalid_mapping", path, "Mapping must contain exact own-data fields."));
		if (typeof rawMapping.kind !== "string" || !PROFILED_WIKI_MAPPING_KINDS.includes(rawMapping.kind as ProfiledWikiMappingKind)) {
			return failure(transactionIssue("invalid_mapping", `${path}.kind`, "Mapping kind is unsupported."));
		}
		const before = decodeEndpoints(rawMapping.before, `${path}.before`, remainingBefore);
		if (!before.ok) return before;
		const after = decodeEndpoints(rawMapping.after, `${path}.after`, remainingAfter);
		if (!after.ok) return after;
		remainingBefore -= before.value.length;
		remainingAfter -= after.value.length;
		output.push(Object.freeze({
			kind: rawMapping.kind as ProfiledWikiMappingKind,
			before: before.value,
			after: after.value,
		}));
	}
	return success(Object.freeze(output));
}

function decodeEndpoints(input: unknown, path: string, remaining: number): Outcome<readonly ProfiledWikiEndpoint[], ProfiledWikiTransactionIssue> {
	const rawEndpoints = ownArray(input, Math.min(remaining, PROFILED_WIKI_TRANSACTION_LIMITS.endpointsPerMappingSide));
	if (!rawEndpoints) return failure(transactionIssue("invalid_mapping", path, "Mapping endpoints must be bounded dense own-data arrays."));
	const output: ProfiledWikiEndpoint[] = [];
	for (let index = 0; index < rawEndpoints.length; index += 1) {
		const endpointPath = `${path}[${index}]`;
		const rawEndpoint = ownRecord(rawEndpoints[index], ["blob", "path"]);
		if (!rawEndpoint || !wikiPath(rawEndpoint.path)) {
			return failure(transactionIssue("invalid_endpoint", endpointPath, "Endpoint must contain one valid managed Wiki path."));
		}
		const blob = decodeGitOid(rawEndpoint.blob);
		if (!blob.ok) return failure(transactionIssue("invalid_endpoint", `${endpointPath}.blob`, "Endpoint blob is not an exact Git identity.", blob.error));
		output.push(Object.freeze({path: rawEndpoint.path, blob: blob.value}));
	}
	return success(Object.freeze(output));
}

function validateMappings(
	mappings: readonly ProfiledWikiMapping[],
	before: AdmittedSource,
	after: AdmittedSource,
	responsibleChangePath: string,
): Outcome<MappingValidation, ProfiledWikiTransactionIssue> {
	const beforeIndexes = sourceIndexes(before.files);
	const afterIndexes = sourceIndexes(after.files);
	const usedBefore = new Set<string>();
	const usedAfter = new Set<string>();
	const canonical: ProfiledWikiMapping[] = [];
	for (let index = 0; index < mappings.length; index += 1) {
		const mapping = mappings[index];
		if (!mapping) return failure(transactionIssue("invalid_mapping", `$.mappings[${index}]`, "Mapping entry is absent."));
		const cardinality = cardinalityIssue(mapping);
		if (cardinality) return failure(cardinality);
		for (let endpointIndex = 0; endpointIndex < mapping.before.length; endpointIndex += 1) {
			const endpoint = mapping.before[endpointIndex];
			if (!endpoint) return failure(transactionIssue("invalid_endpoint", `$.mappings[${index}].before[${endpointIndex}]`, "Endpoint is absent."));
			const checked = checkEndpoint(endpoint, beforeIndexes, `$.mappings[${index}].before[${endpointIndex}]`);
			if (!checked.ok) return checked;
			if (usedBefore.has(checked.value.key)) {
				return failure(transactionIssue("duplicate_endpoint", checked.value.path, "One before endpoint is reused by multiple mappings."));
			}
			usedBefore.add(checked.value.key);
		}
		for (let endpointIndex = 0; endpointIndex < mapping.after.length; endpointIndex += 1) {
			const endpoint = mapping.after[endpointIndex];
			if (!endpoint) return failure(transactionIssue("invalid_endpoint", `$.mappings[${index}].after[${endpointIndex}]`, "Endpoint is absent."));
			const checked = checkEndpoint(endpoint, afterIndexes, `$.mappings[${index}].after[${endpointIndex}]`);
			if (!checked.ok) return checked;
			if (usedAfter.has(checked.value.key)) {
				return failure(transactionIssue("duplicate_endpoint", checked.value.path, "One after endpoint is reused by multiple mappings."));
			}
			usedAfter.add(checked.value.key);
		}
		if (mapping.before.some((endpoint) => endpoint !== undefined && usedAfter.has(endpointKey(endpoint))) ||
			mapping.after.some((endpoint) => endpoint !== undefined && usedBefore.has(endpointKey(endpoint)))) {
			return failure(transactionIssue("no_op_mapping", `$.mappings[${index}]`, "Mappings cannot include unchanged endpoints."));
		}
		const lineage = validateMappingLineage(mapping, beforeIndexes, afterIndexes, responsibleChangePath, index);
		if (lineage) return failure(lineage);
		canonical.push(Object.freeze({
			kind: mapping.kind,
			before: Object.freeze([...mapping.before].sort(compareEndpoints)),
			after: Object.freeze([...mapping.after].sort(compareEndpoints)),
		}));
	}

	const beforeChanged = changedEndpoints(beforeIndexes.byEndpoint, afterIndexes.byEndpoint);
	const afterChanged = changedEndpoints(afterIndexes.byEndpoint, beforeIndexes.byEndpoint);
	if (!sameSet(usedBefore, beforeChanged) || !sameSet(usedAfter, afterChanged)) {
		return failure(transactionIssue("incomplete_coverage", "$.mappings", "Every changed, added or retired managed endpoint must be covered exactly once."));
	}
	canonical.sort(compareMappings);
	return success(Object.freeze({
		mappings: Object.freeze(canonical),
		before: beforeIndexes,
		after: afterIndexes,
	}));
}

function cardinalityIssue(mapping: ProfiledWikiMapping): ProfiledWikiTransactionIssue | null {
	const before = mapping.before.length;
	const after = mapping.after.length;
	const valid = mapping.kind === "add" ? before === 0 && after === 1 :
		mapping.kind === "revise" ? before === 1 && after === 1 && mapping.before[0]?.path === mapping.after[0]?.path :
		mapping.kind === "rename" ? before === 1 && after === 1 && mapping.before[0]?.path !== mapping.after[0]?.path :
		mapping.kind === "split" ? before === 1 && after > 1 :
		mapping.kind === "merge" ? before > 1 && after === 1 :
		mapping.kind === "retire" ? before === 1 && after === 0 : false;
	return valid ? null : transactionIssue("mapping_cardinality", "$.mappings", `Mapping kind ${mapping.kind} has invalid endpoint cardinality or path shape.`);
}

function validateMappingLineage(
	mapping: ProfiledWikiMapping,
	before: SourceIndexes,
	after: SourceIndexes,
	responsibleChangePath: string,
	index: number,
): ProfiledWikiTransactionIssue | null {
	for (const endpoint of mapping.after) {
		const file = after.byEndpoint.get(endpointKey(endpoint));
		if (!file || file.metadata.revision.path !== responsibleChangePath) {
			return transactionIssue("revision_mismatch", `$.mappings[${index}].after`, "Every explicitly resulting file must resolve its revision to the responsible Change.");
		}
	}
	if (mapping.kind !== "revise" && mapping.kind !== "rename") return null;
	const previous = mapping.before[0];
	const current = mapping.after[0];
	if (!previous || !current) return transactionIssue("mapping_cardinality", `$.mappings[${index}]`, "Ordinary mapping endpoints are incomplete.");
	const beforeFile = before.byEndpoint.get(endpointKey(previous));
	const afterFile = after.byEndpoint.get(endpointKey(current));
	if (!beforeFile || !afterFile) return transactionIssue("missing_endpoint", `$.mappings[${index}]`, "Ordinary mapping endpoint is not present in its source.");
	if (!sameOriginSet(beforeFile, afterFile)) {
		return transactionIssue("lineage_mismatch", `$.mappings[${index}]`, "Revision and rename must preserve normalized origin target sets.");
	}
	return null;
}

function sourceIndexes(files: readonly ProfiledWikiFile[]): SourceIndexes {
	const byPath = new Map<string, ProfiledWikiFile>();
	const byEndpoint = new Map<string, ProfiledWikiFile>();
	for (const file of files) {
		byPath.set(file.path, file);
		byEndpoint.set(endpointKey({path: file.path, blob: file.blob}), file);
	}
	return Object.freeze({byPath, byEndpoint});
}

/** Detect contradictions between supplied identities, without proving membership. */
function compatibleSourceClaims(before: AdmittedSource, after: AdmittedSource): ProfiledWikiTransactionIssue | null {
	if (sameGitOid(before.snapshot.commit, after.snapshot.commit) && before.snapshot.snapshotDigest !== after.snapshot.snapshotDigest) {
		return transactionIssue("identity_mismatch", "$.after.snapshot", "One claimed commit cannot have different snapshot facts.");
	}
	if (sameGitOid(before.snapshot.tree, after.snapshot.tree) &&
		(before.files.length !== after.files.length || before.files.some((file, index) => {
			const other = after.files[index];
			return !other || file.path !== other.path || !sameGitOid(file.blob, other.blob);
		}))) {
		return transactionIssue("identity_mismatch", "$.after.files", "One claimed tree cannot have different managed file inventories.");
	}
	return null;
}

function sameClaimedBlobText(
	before: readonly ProfiledWikiFile[],
	after: readonly ProfiledWikiFile[],
): ProfiledWikiTransactionIssue | null {
	const seen = new Map<string, Readonly<{text: string; byteLength: number; path: string}>>();
	for (const [side, files] of [["before", before], ["after", after]] as const) {
		for (const file of files) {
			const key = `${file.blob.algorithm}:${file.blob.hex}`;
			const previous = seen.get(key);
			if (previous && (previous.text !== file.text || previous.byteLength !== file.byteLength)) {
				return transactionIssue("identity_mismatch", `$.${side}.files`, `One claimed blob identity carries different text bytes (${previous.path} and ${file.path}).`);
			}
			if (!previous) seen.set(key, Object.freeze({text: file.text, byteLength: file.byteLength, path: file.path}));
		}
	}
	return null;
}

function checkEndpoint(
	endpoint: ProfiledWikiEndpoint,
	indexes: SourceIndexes,
	path: string,
): Outcome<Readonly<{key: string; path: string}>, ProfiledWikiTransactionIssue> {
	const file = indexes.byPath.get(endpoint.path);
	if (!file) return failure(transactionIssue("missing_endpoint", path, "Endpoint path is not present in its exact managed source."));
	if (!sameGitOid(file.blob, endpoint.blob)) {
		return failure(transactionIssue("identity_mismatch", path, "Endpoint blob does not match the exact managed source identity."));
	}
	return success(Object.freeze({key: endpointKey(endpoint), path}));
}

function changedEndpoints(
	left: ReadonlyMap<string, ProfiledWikiFile>,
	right: ReadonlyMap<string, ProfiledWikiFile>,
): Set<string> {
	const changed = new Set<string>();
	for (const key of left.keys()) if (!right.has(key)) changed.add(key);
	return changed;
}

function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
	if (left.size !== right.size) return false;
	for (const value of left) if (!right.has(value)) return false;
	return true;
}

function sameOriginSet(left: ProfiledWikiFile, right: ProfiledWikiFile): boolean {
	const previous = left.metadata.origins.map((origin) => origin.path).sort(compareText);
	const current = right.metadata.origins.map((origin) => origin.path).sort(compareText);
	return previous.length === current.length && previous.every((value, index) => value === current[index]);
}

function typeImpacts(
	before: AdmittedSource,
	after: AdmittedSource,
	beforeIndexes: SourceIndexes,
	afterIndexes: SourceIndexes,
): readonly ProfiledWikiTypeImpact[] {
	if (!typeDefinitionCatalogueChanged(before.files, after.files)) return Object.freeze([]);
	const beforeBindings = bindingsByEndpoint(before.typeContext.bindings);
	const afterBindings = bindingsByEndpoint(after.typeContext.bindings);
	const output: ProfiledWikiTypeImpact[] = [];
	for (const [key, file] of beforeIndexes.byEndpoint) {
		if (!afterIndexes.byEndpoint.has(key)) continue;
		const beforeBinding = beforeBindings.get(key);
		const afterBinding = afterBindings.get(key);
		if (!beforeBinding && !afterBinding) continue;
		output.push(Object.freeze({
			kind: "potential_type_impact",
			item: Object.freeze({path: file.path, blob: file.blob}),
			type: afterBinding?.type ?? beforeBinding?.type ?? "TypeDefinition",
			definitionBefore: beforeBinding ? bindingEndpoint(beforeBinding.definition) : null,
			definitionAfter: afterBinding ? bindingEndpoint(afterBinding.definition) : null,
		}));
	}
	output.sort((left, right) => compareEndpoints(left.item, right.item));
	return Object.freeze(output);
}

function typeDefinitionCatalogueChanged(before: readonly ProfiledWikiFile[], after: readonly ProfiledWikiFile[]): boolean {
	const left = before.filter((file) => file.metadata.type === "TypeDefinition").map(definitionIdentity).sort(compareText);
	const right = after.filter((file) => file.metadata.type === "TypeDefinition").map(definitionIdentity).sort(compareText);
	return left.length !== right.length || left.some((value, index) => value !== right[index]);
}

function definitionIdentity(file: ProfiledWikiFile): string {
	return `${file.path}\u0000${endpointKey({path: file.path, blob: file.blob})}\u0000${file.metadata.title}\u0000${file.metadata.base ?? ""}`;
}

function bindingsByEndpoint(bindings: readonly WikiTypeBinding[]): Map<string, WikiTypeBinding> {
	const output = new Map<string, WikiTypeBinding>();
	for (const binding of bindings) output.set(endpointKey(binding.item), binding);
	return output;
}

function bindingEndpoint(value: Readonly<{path: string; blob: GitOid}>): ProfiledWikiEndpoint {
	return Object.freeze({path: value.path, blob: value.blob});
}

/** Binds exact source identities, not the supplied parser output's byte provenance. */
function digestSource(source: AdmittedSource) {
	return Object.freeze({snapshot: source.snapshot, typeContext: digestTypeContext(source.typeContext)});
}

function digestTypeContext(context: WikiTypeContext) {
	return Object.freeze({
		profile: context.profile,
		snapshot: context.snapshot,
		bindings: Object.freeze(context.bindings.map((binding) => Object.freeze({
			item: digestEndpoint(binding.item),
			definition: digestEndpoint(binding.definition),
			type: binding.type,
			base: binding.base,
		}))),
	});
}

function digestMapping(mapping: ProfiledWikiMapping) {
	return Object.freeze({
		kind: mapping.kind,
		before: Object.freeze(mapping.before.map(digestEndpoint)),
		after: Object.freeze(mapping.after.map(digestEndpoint)),
	});
}

function digestTypeImpact(impact: ProfiledWikiTypeImpact) {
	return Object.freeze({
		kind: impact.kind,
		item: digestEndpoint(impact.item),
		type: impact.type,
		definitionBefore: impact.definitionBefore === null ? null : digestEndpoint(impact.definitionBefore),
		definitionAfter: impact.definitionAfter === null ? null : digestEndpoint(impact.definitionAfter),
	});
}

function digestEndpoint(endpoint: Readonly<{path: string; blob: GitOid}>) {
	return Object.freeze({path: textDigest(endpoint.path), blob: endpoint.blob});
}

function textDigest(value: string): Sha256Digest {
	return sha256Digest(UTF8.encode(value));
}

function changePath(value: unknown): string | null {
	if (typeof value !== "string" || value.length === 0 || value.length > WIKI_PROFILE_LIMITS.pathBytes ||
		UTF8.encode(value).byteLength > WIKI_PROFILE_LIMITS.pathBytes || UNPAIRED_SURROGATE.test(value) ||
		/[\\\u0000-\u001f\u007f\uFEFF]/u.test(value) || value.startsWith("/")) return null;
	const segments = value.split("/");
	return value.startsWith(".changekernel/changes/") && segments.length >= 3 &&
		segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..") ? value : null;
}

function endpointKey(endpoint: Readonly<{path: string; blob: GitOid}>): string {
	return `${endpoint.path}\u0000${endpoint.blob.algorithm}:${endpoint.blob.hex}`;
}

function compareEndpoints(left: Readonly<{path: string; blob: GitOid}>, right: Readonly<{path: string; blob: GitOid}>): number {
	return compareText(endpointKey(left), endpointKey(right));
}

function compareMappings(left: ProfiledWikiMapping, right: ProfiledWikiMapping): number {
	const leftKey = `${left.kind}\u0000${left.before.map(endpointKey).join("\u0001")}\u0000${left.after.map(endpointKey).join("\u0001")}`;
	const rightKey = `${right.kind}\u0000${right.before.map(endpointKey).join("\u0001")}\u0000${right.after.map(endpointKey).join("\u0001")}`;
	return compareText(leftKey, rightKey);
}

function ownRecord(input: unknown, required: readonly string[], optional: readonly string[] = []): UnknownRecord | null {
	try {
		if (typeof input !== "object" || input === null) return null;
		const prototype = Object.getPrototypeOf(input);
		if (prototype !== Object.prototype && prototype !== null) return null;
		const allowed = new Set([...required, ...optional]);
		const keys = Reflect.ownKeys(input);
		if (keys.some((key) => typeof key !== "string" || !allowed.has(key))) return null;
		const result = Object.create(null) as Record<string, unknown>;
		for (const key of required) {
			const descriptor = Object.getOwnPropertyDescriptor(input, key);
			if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return null;
			result[key] = descriptor.value;
		}
		for (const key of optional) {
			if (!Object.hasOwn(input, key)) continue;
			const descriptor = Object.getOwnPropertyDescriptor(input, key);
			if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return null;
			result[key] = descriptor.value;
		}
		return result;
	} catch {
		return null;
	}
}

function ownArray(input: unknown, maximum: number): readonly unknown[] | null {
	try {
		if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) return null;
		const lengthDescriptor = Object.getOwnPropertyDescriptor(input, "length");
		const length = lengthDescriptor && "value" in lengthDescriptor ? lengthDescriptor.value : -1;
		if (!Number.isSafeInteger(length) || length < 0 || length > maximum) return null;
		const keys = Reflect.ownKeys(input);
		if (keys.length !== length + 1 || keys.some((key) => typeof key !== "string" || (key !== "length" && !isArrayIndex(key, length)))) return null;
		const result: unknown[] = [];
		for (let index = 0; index < length; index += 1) {
			const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
			if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return null;
			result.push(descriptor.value);
		}
		return result;
	} catch {
		return null;
	}
}

function isArrayIndex(key: string, length: number): boolean {
	if (!/^(?:0|[1-9][0-9]*)$/u.test(key)) return false;
	const index = Number(key);
	return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

function transactionIssue(
	code: ProfiledWikiTransactionIssueCode,
	path: string,
	message: string,
	cause?: WikiIssue | Readonly<{message: string}>,
): ProfiledWikiTransactionIssue {
	return cause === undefined
		? Object.freeze({code, path, message})
		: Object.freeze({code, path, message, cause});
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
