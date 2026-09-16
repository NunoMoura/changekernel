import {
	arrayField,
	assertDigestMatch,
	booleanField,
	decodeContract,
	exactRecord,
	isNamespacedIdentifier,
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

import {failure, type Outcome} from "../data-contracts/outcome.ts";

import {decodeGitOidValue, type GitObjectFormat, type GitOid} from "../identity/git.ts";

import {semanticDigest, type SemanticIdentityIssue} from "../identity/semantic-digest.ts";

import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";

export const PROJECT_SNAPSHOT_PROTOCOL = protocolIdentity("codewiki.project-snapshot", "1.0.0");

export interface ProjectSnapshotBody {
	readonly protocol: typeof PROJECT_SNAPSHOT_PROTOCOL;
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly commit: GitOid;
	readonly tree: GitOid;
	readonly parents: readonly GitOid[];
	readonly complete: boolean;
}

export interface ProjectSnapshot extends ProjectSnapshotBody {
	readonly snapshotDigest: Sha256Digest;
}

export function createProjectSnapshot(
	body: Omit<ProjectSnapshotBody, "protocol">,
): Outcome<ProjectSnapshot, ContractIssue | SemanticIdentityIssue> {
	const value = {...body, protocol: PROJECT_SNAPSHOT_PROTOCOL};
	const digest = semanticDigest(protocolLabel(), value);
	if (!digest.ok) return failure(digest.error);
	return decodeProjectSnapshot({...value, snapshotDigest: digest.value});
}

export function decodeProjectSnapshot(input: unknown): Outcome<ProjectSnapshot, ContractIssue> {
	return decodeContract("Project snapshot", input, (value) => decodeProjectSnapshotValue(value));
}

export function decodeProjectSnapshotValue(value: CanonicalValue, path = "$"): ProjectSnapshot {
	const record = exactRecord("Project snapshot", value, path, [
		"commit",
		"complete",
		"objectFormat",
		"parents",
		"protocol",
		"repositoryId",
		"snapshotDigest",
		"tree",
	]);
	protocolField("Project snapshot", record, path, PROJECT_SNAPSHOT_PROTOCOL);
	const objectFormat = literalField("Project snapshot", record, "objectFormat", ["sha1", "sha256"] as const, path);
	const commit = decodeGitOidValue(requiredField("Project snapshot", record, "commit", path), `${path}.commit`);
	const tree = decodeGitOidValue(requiredField("Project snapshot", record, "tree", path), `${path}.tree`);
	const parents = arrayField("Project snapshot", record, "parents", path, 8).map((entry, index) =>
		decodeGitOidValue(entry, `${path}.parents[${index}]`));
	if (commit.algorithm !== objectFormat || tree.algorithm !== objectFormat || parents.some((entry) => entry.algorithm !== objectFormat)) {
		rejectContract("invalid_field", "Project snapshot", path, "Snapshot OIDs must match object format.");
	}
	const snapshotDigest = digestField(record, "snapshotDigest", path);
	const result = Object.freeze({
		protocol: PROJECT_SNAPSHOT_PROTOCOL,
		repositoryId: namespacedField(record, "repositoryId", path),
		objectFormat,
		commit,
		tree,
		parents: Object.freeze(parents),
		complete: booleanField("Project snapshot", record, "complete", path),
		snapshotDigest,
	});
	const {snapshotDigest: _snapshotDigest, ...body} = result;
	const expected = semanticDigest(protocolLabel(), body);
	if (!expected.ok) rejectContract("invalid_field", "Project snapshot", `${path}.snapshotDigest`, expected.error.message);
	assertDigestMatch("Project snapshot", `${path}.snapshotDigest`, snapshotDigest, expected.value);
	return result;
}

function namespacedField(record: CanonicalRecord, field: string, path: string): string {
	const value = textField("Project snapshot", record, field, path, {maximumBytes: 256});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", "Project snapshot", `${path}.${field}`, "Identity must be canonical namespaced text.");
	return value;
}

function digestField(record: CanonicalRecord, field: string, path: string): Sha256Digest {
	const decoded = decodeSha256Digest(record[field]);
	if (!decoded.ok) rejectContract("invalid_field", "Project snapshot", `${path}.${field}`, decoded.error.message);
	return decoded.value;
}

function protocolLabel(): string {
	return `${PROJECT_SNAPSHOT_PROTOCOL.id}@${PROJECT_SNAPSHOT_PROTOCOL.version}`;
}
