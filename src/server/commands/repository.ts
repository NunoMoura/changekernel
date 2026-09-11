import {canonicalJson} from "../../kernel/data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {
	appendChangeEvent,
	appendProfileChangeEvent,
	encodeChangeTrace,
	encodeProfileChangeTrace,
	type ChangeTrace,
	type ProfileChangeTrace,
} from "../../kernel/changes/trace.ts";
import type {ProfileChangeEvent} from "../../kernel/changes/events.ts";
import type {ChangeEvent, SemanticEventOwners} from "../../kernel/changes/events.ts";
import type {ProjectSnapshot} from "../../kernel/changes/snapshot.ts";
import {gitOidText, sameGitOid, type GitOid, type GitRef} from "../../kernel/identity/git.ts";
import {sha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {
	projectStoreBlobWriteRequestDigest,
	projectStoreCasRequestDigest,
	projectStoreCommitRequestDigest,
	projectStoreTreeWriteRequestDigest,
	type GitCommitIdentity,
	type ProjectStoreCasReceipt,
	type ProjectStoreIssue,
	type ProjectStorePort,
	type ProjectStoreRefUpdate,
	type ProjectStoreTreeEntry,
	type ProjectStoreTreeMutation,
} from "../../ports/project-store.ts";
import {productError, type ProductError} from "../../api/transport/envelope.ts";
import type {AuthorizedProjectActor} from "../authorization/policy.ts";
import {loadProjectSource, loadWikiSource, type LoadedChange, type LoadedWikiSource, type ProjectReadConfiguration} from "../queries/source.ts";

export interface LifecycleCommitter {
	readonly name: string;
	readonly email: string;
}

export interface LifecycleRepositoryEnvironment {
	readonly store: ProjectStorePort;
	readonly configuration: ProjectReadConfiguration;
	readonly committer: LifecycleCommitter;
	readonly maximumTreeEntries: number;
}

export interface LoadedLifecycleChange {
	readonly project: LoadedWikiSource;
	readonly source: LoadedWikiSource;
	readonly change: LoadedChange;
}

export interface TraceCommitResult<T extends ChangeTrace | ProfileChangeTrace = ChangeTrace> {
	readonly commit: GitOid;
	readonly tree: GitOid;
	readonly trace: T;
	readonly traceBlob: GitOid;
}

export type ProfileTraceCommitResult = TraceCommitResult<ProfileChangeTrace>;

export interface TreeDeltaEntry {
	readonly path: string;
	readonly before: ProjectStoreTreeEntry | null;
	readonly after: ProjectStoreTreeEntry | null;
}

const ZERO_DIGEST = `sha256:${"0".repeat(64)}` as Sha256Digest;
const TRACE_PREFIX = ".codewiki/changes/";

export async function loadCanonical(
	environment: LifecycleRepositoryEnvironment,
): Promise<Outcome<LoadedWikiSource, ProductError>> {
	const loaded = await loadWikiSource(environment.store, environment.configuration, {kind: "canonical"});
	return loaded.ok ? success(loaded.value) : failure(sourceFailure(loaded.error.code));
}

export async function loadLifecycleChange(
	environment: LifecycleRepositoryEnvironment,
	changeId: string,
): Promise<Outcome<LoadedLifecycleChange, ProductError>> {
	const project = await loadCanonical(environment);
	if (!project.ok) return project;
	const source = await loadProjectSource(environment.store, environment.configuration, {kind: "change", changeId}, [changeId]);
	if (!source.ok) return failure(sourceFailure(source.error.code));
	const change = source.value.changes.find((entry) => entry.trace.header.changeId === changeId);
	if (!change) return failure(productError("not_found", "That Change is unavailable.", "Refresh Changes and choose an available Change.", false));
	return success(Object.freeze({project: project.value, source: source.value, change}));
}

export function tracePath(changeId: string): string {
	return `${TRACE_PREFIX}TRACE-${changeId}.jsonl`;
}

export function managedChangeRef(changeId: string): GitRef {
	return `refs/codewiki/changes/${changeId}` as GitRef;
}

export function verifyCommandBinding(
	loaded: LoadedLifecycleChange,
	expectedProjectHead: GitOid,
	expectedChangeTip: GitOid,
): Outcome<true, ProductError> {
	if (!sameGitOid(loaded.project.snapshot.commit, expectedProjectHead) || !sameGitOid(loaded.source.snapshot.commit, expectedChangeTip)) {
		return failure(productError(
			"source_stale",
			"Project or Change state advanced before this action.",
			"Refresh the Change, reconcile the exact new state, and retry explicitly.",
			true,
		));
	}
	return success(true);
}

export function commandAlreadyRecorded(trace: ChangeTrace, commandId: string): ChangeEvent | null {
	return trace.events.find((event) => event.commandId === commandId) ?? null;
}

type LegacyTraceCommitInput = Readonly<{
	base: ProjectSnapshot;
	parents: readonly GitOid[];
	trace: ChangeTrace;
	events: readonly ChangeEvent[];
	owners: SemanticEventOwners;
	mutations?: readonly ProjectStoreTreeMutation[];
	actor: AuthorizedProjectActor;
	timestamp: string;
	message: string;
}>;

type ProfileTraceCommitInput = Readonly<{
	base: ProjectSnapshot;
	parents: readonly GitOid[];
	trace: ProfileChangeTrace;
	events: readonly ProfileChangeEvent[];
	mutations?: readonly ProjectStoreTreeMutation[];
	actor: AuthorizedProjectActor;
	timestamp: string;
	message: string;
}>;

export function appendTraceCommit(
	environment: LifecycleRepositoryEnvironment,
	input: LegacyTraceCommitInput,
): Promise<Outcome<TraceCommitResult, ProductError>>;
export function appendTraceCommit(
	environment: LifecycleRepositoryEnvironment,
	input: ProfileTraceCommitInput,
): Promise<Outcome<ProfileTraceCommitResult, ProductError>>;
export async function appendTraceCommit(
	environment: LifecycleRepositoryEnvironment,
	input: LegacyTraceCommitInput | ProfileTraceCommitInput,
): Promise<Outcome<TraceCommitResult<ChangeTrace | ProfileChangeTrace>, ProductError>> {
	const prepared = "owners" in input
		? prepareTrace(input.trace, input.events, (trace, event) => appendChangeEvent(trace, event, input.owners), (trace) => encodeChangeTrace(trace, input.owners))
		: prepareTrace(input.trace, input.events, appendProfileChangeEvent, encodeProfileChangeTrace);
	if (!prepared.ok) return prepared;
	const {trace, text} = prepared.value;
	const traceLocation = tracePath(trace.header.changeId);
	const paths = [...(input.mutations ?? []).map((entry) => entry.path), traceLocation];
	if (new Set(paths).size !== paths.length) return failure(invalidState("Lifecycle transaction attempted duplicate Project paths."));
	const traceObject = await writeBlob(environment, new TextEncoder().encode(text), input.actor.authorizationId);
	if (!traceObject.ok) return traceObject;
	const traceMutation: ProjectStoreTreeMutation = Object.freeze({path: traceLocation, mode: "100644", kind: "blob", oid: traceObject.value});
	const mutations = [...(input.mutations ?? []), traceMutation].sort((left, right) => compareText(left.path, right.path));
	const tree = await writeTree(environment, input.base.tree, mutations, input.actor.authorizationId);
	if (!tree.ok) return tree;
	const commit = await createCommit(environment, {
		tree: tree.value,
		parents: input.parents,
		message: input.message,
		author: actorIdentity(input.actor, input.timestamp),
		committer: Object.freeze({...environment.committer, timestamp: input.timestamp}),
		authorizationId: input.actor.authorizationId,
	});
	if (!commit.ok) return commit;
	return success(Object.freeze({commit: commit.value, tree: tree.value, trace, traceBlob: traceObject.value}));
}

function prepareTrace<T, E>(
	initial: T,
	events: readonly E[],
	append: (trace: T, event: E) => Outcome<T, Readonly<{message: string}>>,
	encode: (trace: T) => Outcome<string, Readonly<{message: string}>>,
): Outcome<Readonly<{trace: T; text: string}>, ProductError> {
	let trace = initial;
	for (const event of events) {
		const appended = append(trace, event);
		if (!appended.ok) return failure(invalidState("Change Trace rejected the requested lifecycle transition."));
		trace = appended.value;
	}
	const encoded = encode(trace);
	return encoded.ok ? success(Object.freeze({trace, text: encoded.value})) : failure(invalidState("Change Trace could not be encoded safely."));
}

export async function writeBlob(
	environment: LifecycleRepositoryEnvironment,
	bytes: Uint8Array,
	authorizationId: string,
): Promise<Outcome<GitOid, ProductError>> {
	const request = {
		repositoryId: environment.configuration.repositoryId,
		objectFormat: environment.configuration.objectFormat,
		bytes,
		authorizationId,
		requestDigest: ZERO_DIGEST,
	};
	const digest = projectStoreBlobWriteRequestDigest(request);
	if (!digest.ok) return failure(internalFailure());
	const result = await environment.store.writeBlob({...request, requestDigest: digest.value});
	return result.ok ? success(result.value.oid) : failure(storeFailure(result.error));
}

export async function writeTree(
	environment: LifecycleRepositoryEnvironment,
	baseTree: GitOid | null,
	mutations: readonly ProjectStoreTreeMutation[],
	authorizationId: string,
): Promise<Outcome<GitOid, ProductError>> {
	const request = {
		repositoryId: environment.configuration.repositoryId,
		objectFormat: environment.configuration.objectFormat,
		baseTree,
		mutations,
		authorizationId,
		requestDigest: ZERO_DIGEST,
	};
	const digest = projectStoreTreeWriteRequestDigest(request);
	if (!digest.ok) return failure(internalFailure());
	const result = await environment.store.writeTree({...request, requestDigest: digest.value});
	return result.ok ? success(result.value.tree) : failure(storeFailure(result.error));
}

export async function createCommit(
	environment: LifecycleRepositoryEnvironment,
	input: Readonly<{
		tree: GitOid;
		parents: readonly GitOid[];
		message: string;
		author: GitCommitIdentity;
		committer: GitCommitIdentity;
		authorizationId: string;
	}>,
): Promise<Outcome<GitOid, ProductError>> {
	const request = {
		repositoryId: environment.configuration.repositoryId,
		objectFormat: environment.configuration.objectFormat,
		...input,
		requestDigest: ZERO_DIGEST,
	};
	const digest = projectStoreCommitRequestDigest(request);
	if (!digest.ok) return failure(internalFailure());
	const result = await environment.store.createCommit({...request, requestDigest: digest.value});
	return result.ok ? result : failure(storeFailure(result.error));
}

export async function compareAndSwap(
	environment: LifecycleRepositoryEnvironment,
	updates: readonly ProjectStoreRefUpdate[],
	authorizationId: string,
	message: string,
): Promise<Outcome<ProjectStoreCasReceipt, ProductError>> {
	const sorted = [...updates].sort((left, right) => compareText(left.ref, right.ref));
	const request = {
		repositoryId: environment.configuration.repositoryId,
		objectFormat: environment.configuration.objectFormat,
		updates: Object.freeze(sorted),
		reflogMessage: message,
		authorizationId,
		requestDigest: ZERO_DIGEST,
	};
	const digest = projectStoreCasRequestDigest(request);
	if (!digest.ok) return failure(internalFailure());
	const result = await environment.store.compareAndSwapRefs({...request, requestDigest: digest.value});
	return result.ok ? result : failure(storeFailure(result.error));
}

export async function readTreeEntries(
	environment: LifecycleRepositoryEnvironment,
	snapshot: ProjectSnapshot,
): Promise<Outcome<readonly ProjectStoreTreeEntry[], ProductError>> {
	const result = await environment.store.readTree({
		repositoryId: environment.configuration.repositoryId,
		objectFormat: environment.configuration.objectFormat,
		commit: snapshot.commit,
		pathPrefix: "",
		maximumEntries: environment.maximumTreeEntries,
	});
	return result.ok ? success(result.value.entries) : failure(storeFailure(result.error));
}

export function diffTreeEntries(
	before: readonly ProjectStoreTreeEntry[],
	after: readonly ProjectStoreTreeEntry[],
): readonly TreeDeltaEntry[] {
	const beforeByPath = new Map(before.map((entry) => [entry.path, entry]));
	const afterByPath = new Map(after.map((entry) => [entry.path, entry]));
	const paths = [...new Set([...beforeByPath.keys(), ...afterByPath.keys()])].sort(compareText);
	return Object.freeze(paths.flatMap((path) => {
		const left = beforeByPath.get(path) ?? null;
		const right = afterByPath.get(path) ?? null;
		return sameEntry(left, right) ? [] : [Object.freeze({path, before: left, after: right})];
	}));
}

export function mutationsFromDelta(delta: readonly TreeDeltaEntry[]): readonly ProjectStoreTreeMutation[] {
	return Object.freeze(delta.map((entry) => entry.after === null
		? Object.freeze({path: entry.path, mode: null, kind: null, oid: null})
		: Object.freeze({path: entry.path, mode: entry.after.mode, kind: entry.after.kind, oid: entry.after.oid})));
}

export async function filteredTree(
	environment: LifecycleRepositoryEnvironment,
	entries: readonly ProjectStoreTreeEntry[],
	include: (path: string) => boolean,
	authorizationId: string,
): Promise<Outcome<GitOid, ProductError>> {
	const mutations: ProjectStoreTreeMutation[] = [];
	for (const entry of entries) {
		if (!include(entry.path)) continue;
		mutations.push(Object.freeze({
			path: entry.path,
			mode: entry.mode,
			kind: entry.kind,
			oid: entry.oid,
		}));
	}
	if (mutations.length === 0) return failure(invalidState("Required Project artifact tree is empty."));
	return writeTree(environment, null, Object.freeze(mutations), authorizationId);
}

export function tracePrefixPreserved(before: string, after: string): boolean {
	return after.startsWith(before) && after.length > before.length;
}

export function canonicalCommandDigest(operation: string, input: unknown): Outcome<Sha256Digest, ProductError> {
	const encoded = canonicalJson(input);
	return encoded.ok
		? success(sha256Digest(`${operation}\0${encoded.value}`))
		: failure(productError("invalid_request", "The action input is not canonical.", "Refresh and submit canonical bounded values.", true));
}

export function eventCommandId(commandId: string, suffix: string): string {
	return suffix.length === 0 ? commandId : `${commandId}:${suffix}`;
}

function actorIdentity(actor: AuthorizedProjectActor, timestamp: string): GitCommitIdentity {
	return Object.freeze({
		name: actor.actorId,
		email: `${sha256Digest(actor.actorId).slice(7, 31)}@actors.codewiki.invalid`,
		timestamp,
	});
}

function sameEntry(left: ProjectStoreTreeEntry | null, right: ProjectStoreTreeEntry | null): boolean {
	return left === null ? right === null : right !== null && left.mode === right.mode && left.kind === right.kind && sameGitOid(left.oid, right.oid);
}

function sourceFailure(code: string): ProductError {
	if (code === "source_stale") return productError("source_stale", "Project state changed while it was being read.", "Refresh and retry the action.", true);
	if (code === "source_not_found") return productError("source_not_found", "The requested Project state is unavailable.", "Refresh Project status and retry.", false);
	return invalidState("Project lifecycle state could not be validated.");
}

function storeFailure(issue: ProjectStoreIssue): ProductError {
	if (issue.code === "stale_ref") return productError("source_stale", "Project state advanced before the action could finish.", "Refresh, reconcile, and retry explicitly.", true);
	if (issue.code === "limit_exceeded") return productError("limit_exceeded", "The Project transaction exceeds a configured bound.", "Reduce the action scope and retry.", true);
	if (issue.code === "timeout") return productError("operation_unknown", "The Project transaction outcome is not yet known.", "Refresh exact Project state before retrying this action.", true);
	return invalidState("The Project persistence boundary rejected the lifecycle transaction.");
}

function invalidState(message: string): ProductError {
	return productError("invalid_project_state", message, "Inspect Project status and repair the governed state before retrying.", true);
}

function internalFailure(): ProductError {
	return productError("internal_failure", "The lifecycle action could not be prepared safely.", "Retry after the Project service is healthy.", false);
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

export function technicalOid(oid: GitOid): string {
	return gitOidText(oid);
}
