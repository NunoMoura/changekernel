import {
	arrayField,
	assertDigestMatch,
	decodeContract,
	exactRecord,
	integerField,
	isNamespacedIdentifier,
	literalField,
	protocolField,
	protocolIdentity,
	rejectContract,
	requiredField,
	sortedUniqueTextArray,
	textField,
	type ContractIssue,
} from "../canonical/contract.ts";
import type {CanonicalValue} from "../canonical/json.ts";
import {failure, type Outcome} from "../canonical/outcome.ts";
import {semanticDigest, type SemanticIdentityIssue} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";

export const CHANGE_PROTOCOL = protocolIdentity("codewiki.change", "1.0.0");
export const CHANGE_TYPES = ["capability", "correction", "investigation", "maintenance", "policy"] as const;
export const CHANGE_REALIZATIONS = ["project", "wiki-only"] as const;
export const CHANGE_RELATIONS = ["conflicts_with", "depends_on", "related_to", "supersedes"] as const;

export type ChangeType = (typeof CHANGE_TYPES)[number];
export type ChangeRealization = (typeof CHANGE_REALIZATIONS)[number];
export type ChangeRelationKind = (typeof CHANGE_RELATIONS)[number];

export interface ChangeTarget {
	readonly itemId: string;
	readonly facets: readonly string[];
}

export interface ChangeRelation {
	readonly kind: ChangeRelationKind;
	readonly changeId: string;
}

export interface ChangeBody {
	readonly protocol: typeof CHANGE_PROTOCOL;
	readonly changeId: string;
	readonly repositoryId: string;
	readonly revision: number;
	readonly changeType: ChangeType;
	readonly realization: ChangeRealization;
	readonly intent: string;
	readonly rationale: string;
	readonly acceptance: readonly string[];
	readonly targets: readonly ChangeTarget[];
	readonly relationships: readonly ChangeRelation[];
	readonly contributorRefs: readonly string[];
	readonly producerRunRefs: readonly string[];
}

export interface Change extends ChangeBody {
	readonly changeDigest: Sha256Digest;
}

export function createChange(
	body: Omit<ChangeBody, "protocol">,
): Outcome<Change, ContractIssue | SemanticIdentityIssue> {
	const value = {...body, protocol: CHANGE_PROTOCOL};
	const digest = semanticDigest(protocolLabel(), value);
	if (!digest.ok) return failure(digest.error);
	return decodeChange({...value, changeDigest: digest.value});
}

export function decodeChange(input: unknown): Outcome<Change, ContractIssue> {
	return decodeContract("Change", input, (value) => decodeChangeValue(value));
}

export function decodeChangeValue(value: CanonicalValue, path = "$"): Change {
	const record = exactRecord("Change", value, path, [
		"acceptance",
		"changeDigest",
		"changeId",
		"changeType",
		"contributorRefs",
		"intent",
		"producerRunRefs",
		"protocol",
		"rationale",
		"realization",
		"relationships",
		"repositoryId",
		"revision",
		"targets",
	]);
	protocolField("Change", record, path, CHANGE_PROTOCOL);
	const changeId = changeIdField(record, "changeId", path);
	const acceptance = sortedUniqueTextArray("Change", requiredField("Change", record, "acceptance", path), `${path}.acceptance`, {
		maximumEntries: 256,
		maximumBytes: 4_096,
	});
	if (acceptance.length === 0) rejectContract("missing_field", "Change", `${path}.acceptance`, "Change requires judgeable acceptance statements.");
	const targets = decodeTargets(arrayField("Change", record, "targets", path, 1_024), path);
	if (targets.length === 0) rejectContract("missing_field", "Change", `${path}.targets`, "Change requires a stable target.");
	const relationships = decodeRelationships(arrayField("Change", record, "relationships", path, 1_024), changeId, path);
	const contributorRefs = referenceSet(record, "contributorRefs", path);
	const producerRunRefs = referenceSet(record, "producerRunRefs", path);
	const changeDigest = digestField(record, "changeDigest", path);
	const result = Object.freeze({
		protocol: CHANGE_PROTOCOL,
		changeId,
		repositoryId: namespacedField(record, "repositoryId", path),
		revision: integerField("Change", record, "revision", path, 1, 1_000_000),
		changeType: literalField("Change", record, "changeType", CHANGE_TYPES, path),
		realization: literalField("Change", record, "realization", CHANGE_REALIZATIONS, path),
		intent: textField("Change", record, "intent", path, {maximumBytes: 65_536}),
		rationale: textField("Change", record, "rationale", path, {maximumBytes: 65_536}),
		acceptance,
		targets,
		relationships,
		contributorRefs,
		producerRunRefs,
		changeDigest,
	});
	const {changeDigest: _changeDigest, ...body} = result;
	const expected = semanticDigest(protocolLabel(), body);
	if (!expected.ok) rejectContract("invalid_field", "Change", `${path}.changeDigest`, expected.error.message);
	assertDigestMatch("Change", `${path}.changeDigest`, changeDigest, expected.value);
	return result;
}

function decodeTargets(input: readonly CanonicalValue[], parentPath: string): readonly ChangeTarget[] {
	const output = input.map((value, index) => {
		const path = `${parentPath}.targets[${index}]`;
		const record = exactRecord("Change", value, path, ["facets", "itemId"]);
		const facets = sortedUniqueTextArray("Change", requiredField("Change", record, "facets", path), `${path}.facets`, {
			maximumEntries: 128,
			maximumBytes: 256,
			pattern: /^[A-Za-z][A-Za-z0-9._:@/-]*$/u,
		});
		if (facets.length === 0) rejectContract("missing_field", "Change", `${path}.facets`, "Change target requires at least one facet.");
		return Object.freeze({itemId: namespacedField(record, "itemId", path), facets});
	});
	output.sort((left, right) => compareText(left.itemId, right.itemId));
	assertUnique(output.map((entry) => entry.itemId), `${parentPath}.targets`);
	return Object.freeze(output);
}

function decodeRelationships(input: readonly CanonicalValue[], ownChangeId: string, parentPath: string): readonly ChangeRelation[] {
	const output = input.map((value, index) => {
		const path = `${parentPath}.relationships[${index}]`;
		const record = exactRecord("Change", value, path, ["changeId", "kind"]);
		const changeId = changeIdField(record, "changeId", path);
		if (changeId === ownChangeId) rejectContract("invalid_field", "Change", `${path}.changeId`, "Change cannot relate to itself.");
		return Object.freeze({kind: literalField("Change", record, "kind", CHANGE_RELATIONS, path), changeId});
	});
	output.sort((left, right) => compareText(`${left.kind}\0${left.changeId}`, `${right.kind}\0${right.changeId}`));
	assertUnique(output.map((entry) => `${entry.kind}\0${entry.changeId}`), `${parentPath}.relationships`);
	return Object.freeze(output);
}

function referenceSet(record: Readonly<{[key: string]: CanonicalValue}>, field: string, path: string): readonly string[] {
	const output = sortedUniqueTextArray("Change", requiredField("Change", record, field, path), `${path}.${field}`, {
		maximumEntries: 1_024,
		maximumBytes: 256,
	});
	if (output.some((value) => !isNamespacedIdentifier(value))) rejectContract("invalid_field", "Change", `${path}.${field}`, "References must use namespaced identities.");
	return output;
}

function changeIdField(record: Readonly<{[key: string]: CanonicalValue}>, field: string, path: string): string {
	return textField("Change", record, field, path, {maximumBytes: 200, pattern: /^CHG-[A-Za-z0-9][A-Za-z0-9._-]*$/u});
}

function namespacedField(record: Readonly<{[key: string]: CanonicalValue}>, field: string, path: string): string {
	const value = textField("Change", record, field, path, {maximumBytes: 256});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", "Change", `${path}.${field}`, "Identity must be canonical namespaced text.");
	return value;
}

function digestField(record: Readonly<{[key: string]: CanonicalValue}>, field: string, path: string): Sha256Digest {
	const decoded = decodeSha256Digest(record[field]);
	if (!decoded.ok) rejectContract("invalid_field", "Change", `${path}.${field}`, decoded.error.message);
	return decoded.value;
}

function assertUnique(values: readonly string[], path: string): void {
	if (new Set(values).size !== values.length) rejectContract("invalid_field", "Change", path, "Entries must be unique.");
}

function protocolLabel(): string {
	return `${CHANGE_PROTOCOL.id}@${CHANGE_PROTOCOL.version}`;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
