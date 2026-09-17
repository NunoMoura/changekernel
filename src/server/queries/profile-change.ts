import type {ChangesReadInput} from "../../api/contracts/read.ts";
import {productError, type ProductError} from "../../api/transport/envelope.ts";
import {canonicalJson, decodeCanonicalValue, type CanonicalValue} from "../../kernel/data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {decodeProfileChangeTrace, type ProfileChangeTrace} from "../../kernel/changes/trace.ts";
import {decodeProjectSnapshot, type ProjectSnapshot} from "../../kernel/changes/snapshot.ts";
import {reduceChangeTrace, type ReducedProfileChange} from "../../kernel/changes/reducer.ts";
import {decodeContract, exactRecord, rejectContract, requiredField, textField} from "../../kernel/data-contracts/validation.ts";
import {decodeDecisionSourceCitations} from "../../kernel/gates/decision-output.ts";
import {decodeProfiledPathUtf8Hex, createProfiledWikiReference, type ProfiledWikiReference} from "../../kernel/wiki/profile-reference.ts";
import {validateProfiledWikiTransaction, type ProfiledWikiMapping, type ProfiledWikiTransaction} from "../../kernel/wiki/profile-transaction.ts";
import {WIKI_PROFILE_ID} from "../../kernel/wiki/profile.ts";
import {CHANGEKERNEL_VERSION} from "../../kernel/identity/version.ts";
import type {MarkdownCorpusLimits} from "../../kernel/wiki/corpus.ts";
import {decodeGitOidValue, sameGitOid, type GitOid} from "../../kernel/identity/git.ts";
import {sha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {semanticDigest} from "../../kernel/identity/semantic-digest.ts";
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

interface VerifiedProfileChange {
	readonly containing: ProjectSnapshot;
	readonly trace: ProfileChangeTrace;
	readonly reduced: ReducedProfileChange;
	readonly before: LoadedProfiledWikiSource;
	readonly after: LoadedProfiledWikiSource;
	readonly transaction: ProfiledWikiTransaction;
}

/** Internal exact loader; callers authorize their own read or command-replay operation. */
export async function loadProfileChangeRecord(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	input: Extract<ChangesReadInput, {view: "get"}>,
): Promise<Outcome<CanonicalValue, ProductError>> {
	const loaded = await loadVerifiedProfileChange(store, configuration, input);
	if (!loaded.ok) return loaded;
	const {reduced, trace, before, after, transaction} = loaded.value;
	const output = decodeCanonicalValue(Object.freeze({
		change: reduced.change,
		status: reduced.state,
		stateDigest: reduced.stateDigest,
		trace,
		reference: reduced.change.reference,
		transactionDigest: transaction.transactionDigest,
		before: Object.freeze({commit: before.snapshot.commit, tree: before.snapshot.tree}),
		after: Object.freeze({commit: after.snapshot.commit, tree: after.snapshot.tree}),
	}));
	return output.ok ? success(output.value) : failure(invalidProject("Profile Change read result is not canonical-safe."));
}

async function loadVerifiedProfileChange(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	input: Extract<ChangesReadInput, {view: "get"}>,
): Promise<Outcome<VerifiedProfileChange, ProductError>> {
	if (configuration.kernelVersion !== CHANGEKERNEL_VERSION) return failure(unavailable("Change reads require the current Kernel document contract."));
	if (input.source.kind === "change" && input.source.changeId !== input.changeId) return failure(notFound());
	const source = await resolveProjectSourceDetailed(store, configuration, input.source);
	if (!source.ok) return failure(invalidProject(source.error.message));
	const containing = decodeProjectSnapshot(source.value);
	if (!containing.ok || !containing.value.complete || containing.value.repositoryId !== configuration.repositoryId || containing.value.objectFormat !== configuration.objectFormat || (input.source.kind === "commit" && !sameGitOid(input.source.commit, containing.value.commit))) return failure(invalidProject("An exact complete containing commit reference for the configured Project is required."));
	const trace = await readTrace(store, configuration, containing.value.commit, input.changeId);
	if (!trace.ok) return trace;
	const event = trace.value.trace.events[0];
	if (!event || event.payload.change.changeId !== input.changeId) return failure(notFound());
	const reduced = reduceChangeTrace(trace.value.trace);
	if (!reduced.ok || reduced.value.state !== "proposed") return failure(invalidProject("Profile Change reducer rejected retained lifecycle facts."));
	if (event.ownerBinding.profile !== WIKI_PROFILE_ID) {
		return failure(invalidProject("Profile Change owner binding does not match the selected profile."));
	}
	const before = await loadProfiledWikiSource(store, configuration, {kind: "commit", commit: event.payload.change.reference.before.commit}, profileSourceLimits(configuration));
	if (!before.ok) return failure(invalidProject(`Exact before-source admission failed (${before.error.operation}: ${before.error.code}).`));
	const after = await loadProfiledWikiSource(store, configuration, {kind: "commit", commit: event.payload.change.reference.after.commit}, profileSourceLimits(configuration));
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
	return success(Object.freeze({
		containing: containing.value, trace: trace.value.trace, reduced: reduced.value,
		before: before.value, after: after.value, transaction: transaction.value,
	}));
}

export interface ProfileDecisionGrounds extends VerifiedProfileChange {
	readonly project: ProjectSnapshot;
	readonly manifest: CanonicalValue;
	readonly contextDigest: Sha256Digest;
	readonly configurationDigest: Sha256Digest;
}

/**
 * Rebuild the concrete profile proposal's Decision material after authorization.
 * This is internal preparation, not an enabled lifecycle command. Complete Git
 * inventories do not establish semantic coverage, evidence provenance or approval.
 * No contextComplete flag is inferred here. Consumers must retain exclusions and
 * establish applicable obligations and evidence before selecting or running checks.
 */
export async function loadProfileDecisionGrounds(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	input: unknown,
): Promise<Outcome<ProfileDecisionGrounds, ProductError>> {
	const scope = profileScopeGuard(actor, "decision.evaluate", {});
	if (scope !== null) return failure(scope);
	if (configuration.kernelVersion !== CHANGEKERNEL_VERSION) {
		return failure(unavailable("Decision grounds require the current Kernel document contract."));
	}
	const request = decodeContract("Profile Decision grounds", input, value => {
		const record = exactRecord("Profile Decision grounds", value, "$", ["changeId", "expectedProjectHead", "expectedChangeTip"]);
		return Object.freeze({
			changeId: textField("Profile Decision grounds", record, "changeId", "$", {maximumBytes: 200, pattern: /^CHG-[A-Za-z0-9][A-Za-z0-9._-]*$/u}),
			expectedProjectHead: decodeGitOidValue(requiredField("Profile Decision grounds", record, "expectedProjectHead")),
			expectedChangeTip: decodeGitOidValue(requiredField("Profile Decision grounds", record, "expectedChangeTip")),
		});
	});
	if (!request.ok) return failure(productError("invalid_request", "Decision grounds request is malformed.", "Supply exact Project and Change heads.", false));
	const {changeId, expectedProjectHead, expectedChangeTip} = request.value;
	if (actor.changeIds !== null && !actor.changeIds.includes(changeId)) {
		return failure(productError("authorization_denied", "This Actor cannot evaluate that profile Change.", "Ask for the applicable Change scope.", true));
	}
	if (expectedProjectHead.algorithm !== configuration.objectFormat || expectedChangeTip.algorithm !== configuration.objectFormat) {
		return failure(productError("invalid_request", "Decision heads use another Git object format.", "Refresh exact Project state.", false));
	}
	const configurationDigest = semanticDigest("codewiki.profile-decision-configuration@1.0.0", configuration);
	if (!configurationDigest.ok) return failure(invalidProject("Decision configuration cannot be bound canonically."));
	const resolved = await resolveProjectSourceDetailed(store, configuration, {kind: "canonical"});
	if (!resolved.ok) return failure(invalidProject("Current Project state is unavailable."));
	const project = decodeProjectSnapshot(resolved.value);
	if (!project.ok || !project.value.complete || project.value.repositoryId !== configuration.repositoryId || project.value.objectFormat !== configuration.objectFormat) {
		return failure(invalidProject("Decision requires a complete Current Project state reference."));
	}
	if (!sameGitOid(project.value.commit, expectedProjectHead)) return failure(staleDecisionGrounds());
	const loaded = await loadVerifiedProfileChange(store, configuration, {view: "get", changeId, source: {kind: "change", changeId}});
	if (!loaded.ok) return loaded;
	const {containing, trace, reduced, before, after, transaction} = loaded.value;
	if (!sameGitOid(containing.commit, expectedChangeTip) || !sameGitOid(before.snapshot.commit, project.value.commit)) {
		return failure(staleDecisionGrounds());
	}
	if (before.snapshot.snapshotDigest !== project.value.snapshotDigest) return failure(invalidProject("Proposed Change comparison state contradicts observed Current Project state."));
	if (reduced.change.reference.kernelBuildDigest !== configuration.kernelBuildDigest) {
		return failure(unavailable("Decision grounds require the current Kernel interpretation build; historical reads remain available."));
	}
	const manifest = decodeCanonicalValue({
		protocol: "codewiki.profile-decision-grounds@1.0.0",
		profile: WIKI_PROFILE_ID, kernelBuildDigest: configuration.kernelBuildDigest,
		configurationDigest: configurationDigest.value,
		project: project.value, containing, changeDigest: reduced.change.changeDigest,
		traceDigest: trace.traceDigest, stateDigest: reduced.stateDigest,
		transactionDigest: transaction.transactionDigest,
		before: decisionSourceManifest(before), after: decisionSourceManifest(after),
	});
	if (!manifest.ok) return failure(productError("limit_exceeded", "Decision source manifest exceeds canonical data bounds.", "Do not truncate required grounds; reduce the supported scope explicitly.", false));
	const contextDigest = semanticDigest("codewiki.profile-decision-grounds@1.0.0", manifest.value);
	if (!contextDigest.ok) return failure(invalidProject("Decision context cannot be bound canonically."));
	return success(Object.freeze({...loaded.value, project: project.value, manifest: manifest.value,
		contextDigest: contextDigest.value, configurationDigest: configurationDigest.value}));
}

export interface ProfileDecisionSourceSlice {
	readonly citation: Readonly<{
		protocol: "codewiki.profile-decision-source-citation@1.0.0";
		contextDigest: Sha256Digest;
		side: "before" | "after";
		pathUtf8Hex: string;
		snapshotDigest: Sha256Digest;
		blob: GitOid;
		sourceDigest: Sha256Digest;
		startByte: number;
		endByte: number;
		sliceDigest: Sha256Digest;
		citationDigest: Sha256Digest;
	}>;
	/** Exact decoded bytes, including BOM and non-normalized text. Not canonical prose. */
	readonly text: string;
}

/**
 * Internal authorized source lookup, not finding admission or durable evidence.
 * The backend rebuilds grounds itself; callers supply only source coordinates.
 * A verified quotation does not prove its truth, relevance or semantic coverage.
 */
export async function readProfileDecisionSourceSlices(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	input: unknown,
): Promise<Outcome<Readonly<{contextDigest: Sha256Digest; slices: readonly ProfileDecisionSourceSlice[]}>, ProductError>> {
	const scope = profileScopeGuard(actor, "decision.evaluate", {});
	if (scope !== null) return failure(scope);
	const contract = "Profile Decision source citations";
	const request = decodeContract(contract, input, value => {
		const record = exactRecord(contract, value, "$", ["changeId", "expectedProjectHead", "expectedChangeTip", "citations"]);
		const decoded = decodeDecisionSourceCitations(requiredField(contract, record, "citations"));
		if (!decoded.ok) rejectContract("invalid_field", contract, "$.citations", decoded.error.message);
		const citations = decoded.value;
		if (citations.length === 0) rejectContract("invalid_field", contract, "$.citations", "Source lookup requires at least one citation.");
		return Object.freeze({grounds: {changeId: record.changeId, expectedProjectHead: record.expectedProjectHead, expectedChangeTip: record.expectedChangeTip}, citations});
	}, {maximumDepth: 8, maximumNodes: 2048, maximumEntriesPerContainer: 64, maximumTextBytes: 256 * 1024});
	if (!request.ok) return failure(productError("invalid_request", "Source citation request is malformed or exceeds its bounds.", "Supply distinct bounded source coordinates, not findings or completeness claims.", false));
	const grounds = await loadProfileDecisionGrounds(store, configuration, actor, request.value.grounds);
	if (!grounds.ok) return grounds;
	const sources = {
		before: new Map(grounds.value.before.corpus.documents.map(document => [pathHex(document.path), document])),
		after: new Map(grounds.value.after.corpus.documents.map(document => [pathHex(document.path), document])),
	};
	const slices: ProfileDecisionSourceSlice[] = [];
	for (const requested of request.value.citations) {
		const source = grounds.value[requested.side];
		const document = sources[requested.side].get(requested.pathUtf8Hex);
		if (!document) return failure(productError("unavailable", "Citation does not name an admitted Markdown source on the requested side.", "Retain excluded or missing sources as an evidence gap.", false));
		const bytes = new TextEncoder().encode(document.text);
		if (sha256Digest(bytes) !== requested.sourceDigest) return failure(productError("source_stale", "Citation source digest differs from the backend-read document.", "Rebuild citations against exact current grounds.", false));
		if (requested.endByte > bytes.byteLength) return failure(productError("invalid_request", "Citation exceeds its source bytes.", "Supply an exact UTF-8 byte range.", false));
		const selected = bytes.subarray(requested.startByte, requested.endByte);
		let text: string;
		try {text = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(selected);} catch {
			return failure(productError("invalid_request", "Citation cuts through a UTF-8 character.", "Use complete UTF-8 character boundaries.", false));
		}
		const citationBody = Object.freeze({protocol: "codewiki.profile-decision-source-citation@1.0.0" as const,
			contextDigest: grounds.value.contextDigest, ...requested,
			snapshotDigest: source.snapshot.snapshotDigest, blob: document.oid, sliceDigest: sha256Digest(selected)});
		const citationDigest = semanticDigest(citationBody.protocol, citationBody);
		if (!citationDigest.ok) return failure(invalidProject("Source citation cannot be bound canonically."));
		slices.push(Object.freeze({citation: Object.freeze({...citationBody, citationDigest: citationDigest.value}), text}));
	}
	slices.sort((left, right) => left.citation.citationDigest < right.citation.citationDigest ? -1 : left.citation.citationDigest > right.citation.citationDigest ? 1 : 0);
	return success(Object.freeze({contextDigest: grounds.value.contextDigest, slices: Object.freeze(slices)}));
}

function decisionSourceManifest(source: LoadedProfiledWikiSource) {
	const byPath = (left: {pathUtf8Hex: string}, right: {pathUtf8Hex: string}): number =>
		left.pathUtf8Hex < right.pathUtf8Hex ? -1 : left.pathUtf8Hex > right.pathUtf8Hex ? 1 : 0;
	return {
		snapshot: source.snapshot,
		documents: source.corpus.documents.map(document => ({
			pathUtf8Hex: pathHex(document.path), mode: document.mode, blob: document.oid,
			byteLength: document.byteLength, contentDigest: sha256Digest(document.text),
		})).sort(byPath),
		exclusions: source.corpus.exclusions.map(entry => ({
			pathUtf8Hex: pathHex(entry.path), mode: entry.mode, blob: entry.oid, reason: entry.reason,
		})).sort(byPath),
	};
}
function pathHex(path: string): string {
	return Array.from(new TextEncoder().encode(path), byte => byte.toString(16).padStart(2, "0")).join("");
}
function staleDecisionGrounds(): ProductError {
	return productError("source_stale", "Decision grounds no longer match requested Current Project state and Proposed Change revision.", "Refresh and rebuild Decision grounds before execution.", false);
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
		pathPrefix: ".changekernel/changes",
		maximumEntries: configuration.limits.maximumChangeTraces,
	});
	if (!tree.ok || !sameGitOid(tree.value.commit, commit) || tree.value.entries.length > configuration.limits.maximumChangeTraces) return failure(invalidProject("Profile Change Trace tree is unavailable or bound to another commit."));
	const path = `.changekernel/changes/TRACE-${changeId}.jsonl`;
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
		if (!sameEntry(oldTree.value.get(path), candidate.value.get(path)) && !managed.has(path)) return failure(invalidProject("Retained Proposed Change modifies material outside managed Wiki Markdown."));
		if (path !== tracePath && !sameEntry(candidate.value.get(path), current.value.get(path))) return failure(invalidProject("Containing commit differs from proposed content outside its new Trace."));
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
	if (!changePath.ok || changePath.value !== `.changekernel/changes/TRACE-${changeId}.jsonl`) return failure("Profile Change reference path does not match requested Change.");
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
