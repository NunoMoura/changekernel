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
import {failure, success, type Outcome} from "../data-contracts/outcome.ts";
import {decodeGitOidValue, sameGitOid, type GitObjectFormat, type GitOid} from "../identity/git.ts";
import {semanticDigest, type SemanticIdentityIssue} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";
import type {ChangeEvent} from "./events.ts";

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

export type TreeChangeKind = "added" | "deleted" | "mode_changed" | "modified";

export interface TreeChange {
	readonly path: string;
	readonly kind: TreeChangeKind;
	readonly before: GitOid | null;
	readonly after: GitOid | null;
}

export interface TraceDelta {
	readonly path: string;
	readonly beforeBlob: GitOid;
	readonly afterBlob: GitOid;
	readonly prefixPreserved: boolean;
}

export interface ValidatedCommitSnapshot {
	readonly kind: "change" | "completion";
	readonly commit: GitOid;
	readonly tree: GitOid;
	readonly firstParent: GitOid;
	readonly secondParent: GitOid;
	readonly eventDigest: Sha256Digest;
	readonly changedPaths: readonly string[];
	readonly validationDigest: Sha256Digest;
}

export interface SnapshotValidationIssue {
	readonly code:
		| "incomplete_objects"
		| "invalid_delta"
		| "invalid_parent_order"
		| "invalid_snapshot"
		| "stale_head";
	readonly path: string;
	readonly message: string;
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

export function validateChangeCommitSnapshot(input: Readonly<{
	projectBefore: ProjectSnapshot;
	changeBefore: ProjectSnapshot;
	result: ProjectSnapshot;
	event: ChangeEvent;
	changes: readonly TreeChange[];
	traceDelta: TraceDelta;
	authorizedPaths: readonly string[];
	wikiIdentityClosure: boolean;
	wikiRelationshipClosure: boolean;
	fullTreeMaterialized: boolean;
}>): Outcome<ValidatedCommitSnapshot, SnapshotValidationIssue> {
	if (input.event.kind !== "change.committed") return failure(snapshotIssue("invalid_delta", "$.event.kind", "Change Commit requires change.committed event."));
	if (!input.wikiIdentityClosure || !input.wikiRelationshipClosure || !input.fullTreeMaterialized) {
		return failure(snapshotIssue("invalid_delta", "$", "Change Commit requires complete native Wiki identity/relationship closure and full tree."));
	}
	return validateTwoParentCommit("change", input);
}

export function validateCompletionCommitSnapshot(input: Readonly<{
	projectBefore: ProjectSnapshot;
	changeBefore: ProjectSnapshot;
	result: ProjectSnapshot;
	event: ChangeEvent;
	changes: readonly TreeChange[];
	traceDelta: TraceDelta;
	authorizedPaths: readonly string[];
	reviewedChangeTip: GitOid;
	artifactTreeBefore: GitOid;
	artifactTreeAfter: GitOid;
}>): Outcome<ValidatedCommitSnapshot, SnapshotValidationIssue> {
	if (input.event.kind !== "change.completed") return failure(snapshotIssue("invalid_delta", "$.event.kind", "Completion Commit requires change.completed event."));
	if (!sameGitOid(input.reviewedChangeTip, input.changeBefore.commit)) return failure(snapshotIssue("stale_head", "$.reviewedChangeTip", "Completion Change tip differs from reviewed tip."));
	const validated = validateTwoParentCommit("completion", input);
	if (!validated.ok) return validated;
	if (!sameGitOid(input.artifactTreeBefore, input.artifactTreeAfter)) {
		return failure(snapshotIssue("invalid_delta", "$.artifactTreeAfter", "Completion changed reviewed project-artifact tree."));
	}
	return validated;
}

export function decodeTreeChanges(input: unknown): Outcome<readonly TreeChange[], ContractIssue> {
	return decodeContract("Tree changes", input, (value) => {
		if (!Array.isArray(value) || value.length > 4_096) rejectContract("limit_exceeded", "Tree changes", "$", "Tree change count exceeds 4,096.");
		const output = value.map((entry, index) => decodeTreeChange(entry, `$[${index}]`));
		for (let index = 1; index < output.length; index += 1) {
			if ((output[index - 1]?.path ?? "") >= (output[index]?.path ?? "")) rejectContract("non_canonical_order", "Tree changes", "$", "Tree changes must be path-sorted and unique.");
		}
		return Object.freeze(output);
	});
}

function validateTwoParentCommit(
	kind: "change" | "completion",
	input: Readonly<{
		projectBefore: ProjectSnapshot;
		changeBefore: ProjectSnapshot;
		result: ProjectSnapshot;
		event: ChangeEvent;
		changes: readonly TreeChange[];
		traceDelta: TraceDelta;
		authorizedPaths: readonly string[];
	}>,
): Outcome<ValidatedCommitSnapshot, SnapshotValidationIssue> {
	const projectResult = decodeProjectSnapshot(input.projectBefore);
	const changeResult = decodeProjectSnapshot(input.changeBefore);
	const resultingSnapshot = decodeProjectSnapshot(input.result);
	if (!projectResult.ok || !changeResult.ok || !resultingSnapshot.ok) {
		return failure(snapshotIssue("invalid_snapshot", "$", "Commit validation received malformed snapshot."));
	}
	const projectBefore = projectResult.value;
	const changeBefore = changeResult.value;
	const result = resultingSnapshot.value;
	if (![projectBefore, changeBefore, result].every((entry) => entry.complete)) {
		return failure(snapshotIssue("incomplete_objects", "$", "Commit validation requires complete object closures."));
	}
	if (
		projectBefore.repositoryId !== changeBefore.repositoryId ||
		projectBefore.repositoryId !== result.repositoryId ||
		projectBefore.objectFormat !== changeBefore.objectFormat ||
		projectBefore.objectFormat !== result.objectFormat
	) return failure(snapshotIssue("invalid_snapshot", "$", "Snapshots belong to different repository identities or object formats."));
	if (result.parents.length !== 2 || !sameGitOid(result.parents[0] as GitOid, projectBefore.commit) || !sameGitOid(result.parents[1] as GitOid, changeBefore.commit)) {
		return failure(snapshotIssue("invalid_parent_order", "$.result.parents", "Commit must have current project head first and current Change tip second."));
	}
	if (!sameGitOid(input.event.expectedProjectHead, projectBefore.commit) || input.event.expectedChangeTip === null || !sameGitOid(input.event.expectedChangeTip, changeBefore.commit)) {
		return failure(snapshotIssue("stale_head", "$.event", "Event expected heads do not match validated parent snapshots."));
	}
	const changes = decodeTreeChanges(input.changes);
	if (!changes.ok) return failure(snapshotIssue("invalid_delta", "$.changes", changes.error.message));
	if (!isStrictlySortedUnique(input.authorizedPaths) || input.authorizedPaths.length > 4_096 || !input.authorizedPaths.every(isPortableRepositoryPath)) {
		return failure(snapshotIssue("invalid_delta", "$.authorizedPaths", "Authorized paths must be sorted, unique, and bounded."));
	}
	if (changes.value.some((entry) => !input.authorizedPaths.includes(entry.path))) {
		return failure(snapshotIssue("invalid_delta", "$.changes", "Commit changes a path outside exact authorization."));
	}
	const traceChange = changes.value.find((entry) => entry.path === input.traceDelta.path);
	if (!traceChange || traceChange.before === null || traceChange.after === null || !input.traceDelta.prefixPreserved) {
		return failure(snapshotIssue("invalid_delta", "$.traceDelta", "Commit must preserve and append one existing Trace prefix."));
	}
	if (!sameGitOid(traceChange.before, input.traceDelta.beforeBlob) || !sameGitOid(traceChange.after, input.traceDelta.afterBlob)) {
		return failure(snapshotIssue("invalid_delta", "$.traceDelta", "Trace delta blob identities do not match full tree delta."));
	}
	const body = Object.freeze({
		kind,
		commit: result.commit,
		tree: result.tree,
		firstParent: projectBefore.commit,
		secondParent: changeBefore.commit,
		eventDigest: input.event.eventDigest,
		changedPaths: Object.freeze(changes.value.map((entry) => entry.path)),
	});
	const digest = semanticDigest("codewiki.validated-commit-snapshot@1.0.0", body);
	if (!digest.ok) return failure(snapshotIssue("invalid_snapshot", "$", digest.error.message));
	return success(Object.freeze({...body, validationDigest: digest.value}));
}

function decodeTreeChange(value: CanonicalValue, path: string): TreeChange {
	const record = exactRecord("Tree changes", value, path, ["after", "before", "kind", "path"]);
	const kind = literalField("Tree changes", record, "kind", ["added", "deleted", "mode_changed", "modified"] as const, path);
	const before = nullableOid(record, "before", path);
	const after = nullableOid(record, "after", path);
	if ((kind === "added") !== (before === null) || (kind === "deleted") !== (after === null) || (before === null && after === null)) {
		rejectContract("invalid_field", "Tree changes", path, "Tree change kind and object identities disagree.");
	}
	if (before !== null && after !== null && before.algorithm !== after.algorithm) rejectContract("invalid_field", "Tree changes", path, "Tree change OIDs use different formats.");
	return Object.freeze({
		path: portablePath(record, "path", path),
		kind,
		before,
		after,
	});
}

function nullableOid(record: CanonicalRecord, field: string, path: string): GitOid | null {
	const value = requiredField("Tree changes", record, field, path);
	return value === null ? null : decodeGitOidValue(value, `${path}.${field}`);
}

function portablePath(record: CanonicalRecord, field: string, path: string): string {
	const value = textField("Tree changes", record, field, path, {maximumBytes: 4_096});
	if (!isPortableRepositoryPath(value)) {
		rejectContract("invalid_field", "Tree changes", `${path}.${field}`, "Path must be portable and repository-relative.");
	}
	return value;
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

function isPortableRepositoryPath(value: unknown): value is string {
	return typeof value === "string" && value.length > 0 && new TextEncoder().encode(value).byteLength <= 4_096 && value.normalize("NFC") === value &&
		!value.startsWith("/") && !value.includes("\\") && !value.includes("\0") &&
		value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function isStrictlySortedUnique(values: readonly string[]): boolean {
	for (let index = 0; index < values.length; index += 1) {
		const value = values[index];
		if (typeof value !== "string" || value.length === 0 || value.length > 4_096) return false;
		if (index > 0 && (values[index - 1] ?? "") >= value) return false;
	}
	return true;
}

function snapshotIssue(code: SnapshotValidationIssue["code"], path: string, message: string): SnapshotValidationIssue {
	return Object.freeze({code, path, message});
}

function protocolLabel(): string {
	return `${PROJECT_SNAPSHOT_PROTOCOL.id}@${PROJECT_SNAPSHOT_PROTOCOL.version}`;
}
