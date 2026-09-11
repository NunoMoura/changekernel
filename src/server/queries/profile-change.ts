import type {ChangesReadInput} from "../../api/contracts/read.ts";
import {productError, type ProductError} from "../../api/transport/envelope.ts";
import {canonicalJson, decodeCanonicalValue, type CanonicalValue} from "../../kernel/data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {decodeProfileChangeTrace, type ProfileChangeTrace} from "../../kernel/changes/trace.ts";
import {decodeProjectSnapshot, type ProjectSnapshot} from "../../kernel/changes/snapshot.ts";
import {reduceChangeTrace} from "../../kernel/changes/reducer.ts";
import {decodeProfiledPathUtf8Hex, createProfiledWikiReference, type ProfiledWikiReference} from "../../kernel/wiki/profile-reference.ts";
import {validateProfiledWikiTransaction, type ProfiledWikiMapping, type ProfiledWikiTransaction} from "../../kernel/wiki/profile-transaction.ts";
import {WIKI_PROFILE_ID} from "../../kernel/wiki/profile.ts";
import type {MarkdownCorpusLimits} from "../../kernel/wiki/corpus.ts";
import {sameGitOid, type GitOid} from "../../kernel/identity/git.ts";
import type {Sha256Digest} from "../../kernel/identity/sha256.ts";
import type {ProjectStorePort, ProjectStoreTreeEntry} from "../../ports/project-store.ts";
import {profileScopeGuard, type AuthorizedProjectActor} from "../authorization/policy.ts";
import type {ProjectReadConfiguration} from "./source.ts";
import {resolveProjectSourceDetailed} from "./source.ts";
import {loadProfiledWikiSource, type LoadedProfiledWikiSource} from "./profile-source.ts";

interface LoadedProfileChange {
	readonly path: string;
	readonly blob: GitOid;
	readonly trace: ProfileChangeTrace;
}

/** Read one exact profile-native proposal. No legacy decoder fallback. */
export async function readProfileChange(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	input: Extract<ChangesReadInput, {view: "get"}>,
): Promise<Outcome<CanonicalValue, ProductError>> {
	const scope = profileScopeGuard(actor, "changes.read", {view: input.view, changeId: input.changeId});
	if (scope !== null) return failure(scope);
	return loadProfileChangeRecord(store, configuration, input);
}

/** Internal exact loader; callers authorize their own read or command-replay operation. */
export async function loadProfileChangeRecord(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	input: Extract<ChangesReadInput, {view: "get"}>,
): Promise<Outcome<CanonicalValue, ProductError>> {
	if (configuration.wikiProfile !== WIKI_PROFILE_ID || configuration.retiredWikiItemIds.length !== 0) return failure(unavailable("Profile-native Change reads require explicit profile configuration without legacy retirement reservations."));
	if (input.source.kind === "change" && input.source.changeId !== input.changeId) return failure(notFound());
	const source = await resolveProjectSourceDetailed(store, configuration, input.source);
	if (!source.ok) return failure(invalidProject(source.error.message));
	const containing = decodeProjectSnapshot(source.value);
	if (!containing.ok || !containing.value.complete || containing.value.repositoryId !== configuration.repositoryId || containing.value.objectFormat !== configuration.objectFormat || (input.source.kind === "commit" && !sameGitOid(input.source.commit, containing.value.commit))) return failure(invalidProject("An exact complete containing snapshot of the configured Project is required."));
	const trace = await readTrace(store, configuration, containing.value.commit, input.changeId);
	if (!trace.ok) return trace;
	const event = trace.value.trace.events[0];
	if (!event || event.payload.change.changeId !== input.changeId) return failure(notFound());
	const reduced = reduceChangeTrace(trace.value.trace);
	if (!reduced.ok || reduced.value.state !== "proposed") return failure(invalidProject("Profile Change reducer rejected retained lifecycle facts."));
	if (event.ownerBinding.profile !== configuration.wikiProfile) {
		return failure(invalidProject("Profile Change owner binding does not match the selected profile."));
	}
	const before = await loadProfiledWikiSource(store, configuration, {kind: "commit", commit: event.payload.change.reference.before.commit}, WIKI_PROFILE_ID, profileSourceLimits(configuration));
	if (!before.ok) return failure(invalidProject(`Exact before-source admission failed (${before.error.operation}: ${before.error.code}).`));
	const after = await loadProfiledWikiSource(store, configuration, {kind: "commit", commit: event.payload.change.reference.after.commit}, WIKI_PROFILE_ID, profileSourceLimits(configuration));
	if (!after.ok) return failure(invalidProject(`Exact candidate-source admission failed (${after.error.operation}: ${after.error.code}).`));
	const transaction = rebuildTransaction(event.payload.change.reference, before.value, after.value, event.ownerBinding.kernelBuildDigest, input.changeId);
	if (!transaction.ok) return failure(invalidProject(transaction.error));
	if (transaction.value.transactionDigest !== event.ownerBinding.transactionDigest || transaction.value.transactionDigest !== event.payload.change.reference.transactionDigest) {
		return failure(invalidProject("Profile Change transaction digest does not match its retained reference."));
	}
	const reference = createProfiledWikiReference(transaction.value);
	if (!reference.ok) return failure(invalidProject("Profile Change reference reconstruction failed."));
	const expectedReference = canonicalJson(reference.value);
	const retainedReference = canonicalJson(event.payload.change.reference);
	if (!expectedReference.ok || !retainedReference.ok || expectedReference.value !== retainedReference.value) {
		return failure(invalidProject("Profile Change reference reconstruction differs from retained bytes."));
	}
	const placement = await verifyProposalPlacement(store, configuration, containing.value, trace.value.path, before.value, after.value);
	if (!placement.ok) return placement;
	const output = decodeCanonicalValue(Object.freeze({
		change: event.payload.change,
		status: reduced.value.state,
		stateDigest: reduced.value.stateDigest,
		trace: trace.value.trace,
		reference: event.payload.change.reference,
		transactionDigest: transaction.value.transactionDigest,
		before: Object.freeze({commit: before.value.snapshot.commit, tree: before.value.snapshot.tree}),
		after: Object.freeze({commit: after.value.snapshot.commit, tree: after.value.snapshot.tree}),
	}));
	return output.ok ? success(output.value) : failure(invalidProject("Profile Change read result is not canonical-safe."));
}

async function readTrace(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	commit: GitOid,
	changeId: string,
): Promise<Outcome<LoadedProfileChange, ProductError>> {
	const tree = await store.readTree({
		repositoryId: configuration.repositoryId,
		objectFormat: configuration.objectFormat,
		commit,
		pathPrefix: ".codewiki/changes",
		maximumEntries: configuration.limits.maximumChangeTraces,
	});
	if (!tree.ok || !sameGitOid(tree.value.commit, commit) || tree.value.entries.length > configuration.limits.maximumChangeTraces) return failure(invalidProject("Profile Change Trace tree is unavailable or bound to another commit."));
	const path = `.codewiki/changes/TRACE-${changeId}.jsonl`;
	const entry = tree.value.entries.find((candidate) => candidate.path === path);
	if (!entry || entry.kind !== "blob" || entry.mode !== "100644" || entry.oid.algorithm !== configuration.objectFormat || tree.value.entries.filter((candidate) => candidate.path === path).length !== 1) return failure(notFound());
	const blob = await store.readBlob({
		repositoryId: configuration.repositoryId,
		objectFormat: configuration.objectFormat,
		commit,
		path,
		maximumBytes: configuration.limits.maximumTraceBytes,
	});
	if (!blob.ok || !sameGitOid(blob.value.oid, entry.oid)) return failure(invalidProject("Profile Change Trace bytes are unavailable or inconsistent."));
	let text: string;
	try {
		const byteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")?.get?.call(blob.value.bytes);
		if (typeof byteLength !== "number" || byteLength > configuration.limits.maximumTraceBytes) return failure(invalidProject("Returned Trace exceeds its byte budget."));
		text = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(blob.value.bytes);
	} catch {
		return failure(invalidProject("Profile Change Trace is not valid UTF-8."));
	}
	const decoded = decodeProfileChangeTrace(text);
	if (!decoded.ok) return failure(invalidProject("Profile Change Trace failed exact replay."));
	if (decoded.value.header.repositoryId !== configuration.repositoryId || decoded.value.header.objectFormat !== configuration.objectFormat || decoded.value.header.changeId !== changeId) return failure(invalidProject("Trace header belongs to another Project, Change or object format."));
	return success(Object.freeze({path, blob: blob.value.oid, trace: decoded.value}));
}

async function exactEntries(store: ProjectStorePort, configuration: ProjectReadConfiguration, snapshot: ProjectSnapshot): Promise<Outcome<ReadonlyMap<string, ProjectStoreTreeEntry>, ProductError>> {
	const tree = await store.readTree({repositoryId: configuration.repositoryId, objectFormat: configuration.objectFormat, commit: snapshot.commit, pathPrefix: "", maximumEntries: 65_536});
	if (!tree.ok || !sameGitOid(tree.value.commit, snapshot.commit) || tree.value.entries.length > 65_536) return failure(invalidProject("Proposal tree is unavailable or inconsistently bound."));
	const entries = new Map<string, ProjectStoreTreeEntry>();
	for (const entry of tree.value.entries) {
		if (entries.has(entry.path)) return failure(invalidProject("Proposal tree contains duplicate path identities."));
		entries.set(entry.path, entry);
	}
	return success(entries);
}

async function verifyProposalPlacement(
	store: ProjectStorePort, configuration: ProjectReadConfiguration, containing: ProjectSnapshot, tracePath: string,
	before: LoadedProfiledWikiSource, after: LoadedProfiledWikiSource,
): Promise<Outcome<null, ProductError>> {
	if (![before.snapshot.commit, after.snapshot.commit].every((commit) => containing.parents.some((parent) => sameGitOid(parent, commit)))) return failure(invalidProject("Proposal commit does not retain both exact source parents."));
	const oldTree = await exactEntries(store, configuration, before.snapshot);
	if (!oldTree.ok) return oldTree;
	const candidate = await exactEntries(store, configuration, after.snapshot);
	if (!candidate.ok) return candidate;
	const current = await exactEntries(store, configuration, containing);
	if (!current.ok) return current;
	if (oldTree.value.has(tracePath) || candidate.value.has(tracePath)) return failure(invalidProject("Proposal overwrites an existing responsible Trace path."));
	const managed = new Set([...before.managedFiles, ...after.managedFiles].map((file) => file.path));
	const paths = new Set([...oldTree.value.keys(), ...candidate.value.keys(), ...current.value.keys()]);
	for (const path of paths) {
		if (!sameEntry(oldTree.value.get(path), candidate.value.get(path)) && !managed.has(path)) return failure(invalidProject("Retained candidate changes material outside managed Wiki Markdown."));
		if (path !== tracePath && !sameEntry(candidate.value.get(path), current.value.get(path))) return failure(invalidProject("Containing commit differs from candidate material outside its new Trace."));
	}
	return success(null);
}

function sameEntry(left: ProjectStoreTreeEntry | undefined, right: ProjectStoreTreeEntry | undefined): boolean {
	if (!left || !right) return left === right;
	return left.kind === right.kind && left.mode === right.mode && sameGitOid(left.oid, right.oid);
}

function rebuildTransaction(
	reference: ProfiledWikiReference,
	before: LoadedProfiledWikiSource,
	after: LoadedProfiledWikiSource,
	kernelBuildDigest: Sha256Digest,
	changeId: string,
): Outcome<ProfiledWikiTransaction, string> {
	const changePath = decodeProfiledPathUtf8Hex(reference.changePathUtf8Hex, true);
	if (!changePath.ok || changePath.value !== `.codewiki/changes/TRACE-${changeId}.jsonl`) return failure("Profile Change reference path does not match requested Change.");
	const mappings: ProfiledWikiMapping[] = [];
	for (const mapping of reference.mappings) {
		const decodeEndpoints = (entries: typeof mapping.before): Outcome<readonly Readonly<{path: string; blob: GitOid}>[], string> => {
			const output: Readonly<{path: string; blob: GitOid}>[] = [];
			for (const endpoint of entries) {
				const path = decodeProfiledPathUtf8Hex(endpoint.pathUtf8Hex);
				if (!path.ok) return failure("Profile Change reference contains an invalid path identity.");
				output.push(Object.freeze({path: path.value, blob: endpoint.blob}));
			}
			return success(Object.freeze(output));
		};
		const beforeEndpoints = decodeEndpoints(mapping.before);
		const afterEndpoints = decodeEndpoints(mapping.after);
		if (!beforeEndpoints.ok || !afterEndpoints.ok) return failure("Profile Change reference endpoint decoding failed.");
		mappings.push(Object.freeze({kind: mapping.kind, before: beforeEndpoints.value, after: afterEndpoints.value}));
	}
	const transaction = validateProfiledWikiTransaction({
		profile: WIKI_PROFILE_ID,
		kernelBuildDigest,
		responsibleChangePath: changePath.value,
		before: {snapshot: before.snapshot, managedFiles: before.managedFiles},
		after: {snapshot: after.snapshot, managedFiles: after.managedFiles},
		mappings,
	});
	return transaction.ok ? success(transaction.value) : failure(transaction.error.message);
}

export function profileSourceLimits(configuration: ProjectReadConfiguration): MarkdownCorpusLimits {
	return Object.freeze({
		maximumEntries: 65_536,
		// Corpus paths have an aggregate budget, unlike the profile's per-Item bound.
		maximumPathBytes: 4 * 1_024 * 1_024,
		maximumDocuments: configuration.limits.maximumWikiItems,
		maximumDocumentBytes: configuration.limits.maximumWikiFileBytes,
		maximumTotalBytes: configuration.limits.maximumWikiTotalBytes,
	});
}

function unavailable(message: string): ProductError {
	return productError("unavailable", message, "Select an explicitly profile-enabled Project.", false);
}
function notFound(): ProductError {
	return productError("not_found", "The requested profile Change is unavailable.", "Refresh exact Project state and choose a current Change.", false);
}
function invalidProject(message: string): ProductError {
	return productError("invalid_project_state", message, "Inspect exact profile Change state before retrying.", false);
}
