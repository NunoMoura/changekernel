import type {ProductCommandInput, ProductCommandOperation, ProposeProfileChangeInput} from "../../api/contracts/command.ts";
import {isCanonicalRequestTimestamp, productError, type ProductError} from "../../api/transport/envelope.ts";
import {decodeCanonicalValue, isCanonicalObject, type CanonicalValue} from "../../kernel/data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {createProfileChange} from "../../kernel/changes/contracts.ts";
import {createProfileChangeEvent} from "../../kernel/changes/events.ts";
import {createEmptyProfileChangeTrace, createProfileChangeTraceHeader} from "../../kernel/changes/trace.ts";
import {decodeProjectSnapshot} from "../../kernel/changes/snapshot.ts";
import {sameGitOid, type GitOid} from "../../kernel/identity/git.ts";
import type {Sha256Digest} from "../../kernel/identity/sha256.ts";
import {decodeProfiledPathUtf8Hex, profileReferencePathUtf8Hex, createProfiledWikiReference} from "../../kernel/wiki/profile-reference.ts";
import {validateProfiledWikiTransaction, type ProfiledWikiMapping, type ProfiledWikiTransaction} from "../../kernel/wiki/profile-transaction.ts";
import {WIKI_PROFILE_ID} from "../../kernel/wiki/profile.ts";
import {CHANGEKERNEL_VERSION} from "../../kernel/identity/version.ts";
import type {AuthorizedProjectActor} from "../authorization/policy.ts";
import {appendTraceCommit, canonicalCommandDigest, compareAndSwap, diffTreeEntries, managedChangeRef, readTreeEntries, tracePath, type LifecycleRepositoryEnvironment} from "./repository.ts";
import {loadProfiledWikiSource} from "../queries/profile-source.ts";
import {loadProfileChangeRecord, profileSourceLimits} from "../queries/profile-change.ts";

export interface LocalLifecycleEnvironment extends LifecycleRepositoryEnvironment {
	readonly now: () => string;
}

export interface LifecycleCommandResult {
	readonly data: CanonicalValue;
	readonly binding: CanonicalValue;
}

/** Only the implemented managed-document proposal path can prepare effects. */
export async function executeLifecycleCommand(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	operation: ProductCommandOperation,
	input: ProductCommandInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	if (operation !== "changes.propose-profile") {
		return failure(productError("unavailable", "This lifecycle operation is not implemented by the current Kernel.", "Use managed-document proposal or read an existing proposal.", false));
	}
	try {
		return await proposeProfileChange(environment, actor, input as ProposeProfileChangeInput);
	} catch {
		return failure(productError("operation_unknown", "The lifecycle action ended without a trustworthy outcome.", "Refresh exact Project and Change state before deciding whether to retry.", true));
	}
}

async function proposeProfileChange(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: ProposeProfileChangeInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	if (environment.configuration.kernelVersion !== CHANGEKERNEL_VERSION || input.profile !== WIKI_PROFILE_ID) {
		return failure(productError("unavailable", "The proposal does not use the current Kernel document contract.", "Use the current Kernel contract.", false));
	}
	if (!actor.capabilities.includes("changes.propose-profile") || actor.changeIds !== null || actor.wikiItemIds !== null) return failure(authorizationDenied("Profile-native proposal requires the operation grant and unrestricted Change and Wiki scope."));
	const commandDigest = canonicalCommandDigest("changes.propose-profile", input);
	if (!commandDigest.ok) return failure(internalFailure());
	const existing = await environment.store.readSnapshot({
		repositoryId: environment.configuration.repositoryId,
		objectFormat: environment.configuration.objectFormat,
		selector: {kind: "ref", ref: managedChangeRef(input.changeId)},
	});
	if (existing.ok) {
		const replay = await replayProfileProposal(environment, actor, input, commandDigest.value, existing.value.commit);
		return replay;
	}
	if (existing.error.code !== "not_found") return failure(invalidProject("Profile Change identity could not be reconciled."));
	if (input.kernelBuildDigest !== environment.configuration.kernelBuildDigest) return failure(invalidRequest("Profile-native proposal must use the configured Kernel Build."));
	const canonical = await canonicalHead(environment);
	if (!canonical.ok) return canonical;
	if (!sameGitOid(input.expectedProjectHead, canonical.value)) return failure(staleSource());
	const timestamp = lifecycleTimestamp(environment);
	if (!timestamp.ok) return timestamp;
	const before = await loadProfiledWikiSource(environment.store, environment.configuration, {kind: "commit", commit: input.expectedProjectHead}, profileSourceLimits(environment.configuration));
	if (!before.ok) return failure(invalidRequest(`Exact Current Project state source admission failed (${before.error.operation}: ${before.error.code}).`));
	const after = await loadProfiledWikiSource(environment.store, environment.configuration, {kind: "commit", commit: input.afterCommit}, profileSourceLimits(environment.configuration));
	if (!after.ok) return failure(invalidRequest(`Exact Proposed Change source admission failed (${after.error.operation}: ${after.error.code}).`));
	const beforeEntries = await readTreeEntries(environment, before.value.snapshot);
	if (!beforeEntries.ok) return beforeEntries;
	const afterEntries = await readTreeEntries(environment, after.value.snapshot);
	if (!afterEntries.ok) return afterEntries;
	const traceLocation = tracePath(input.changeId);
	if ([...beforeEntries.value, ...afterEntries.value].some((entry) => entry.path === traceLocation)) return failure(conflict("The responsible Trace path already exists."));
	const managedPaths = new Set([...before.value.managedFiles, ...after.value.managedFiles].map((file) => file.path));
	const changeDiff = diffTreeEntries(beforeEntries.value, afterEntries.value);
	if (changeDiff.some((entry) => !managedPaths.has(entry.path))) return failure(invalidRequest("Proposed Change may modify only managed Wiki Markdown before proposal."));
	if (before.value.snapshot.repositoryId !== after.value.snapshot.repositoryId || after.value.snapshot.objectFormat !== before.value.snapshot.objectFormat) {
		return failure(invalidRequest("Project state and proposed content references do not share repository identity and object format."));
	}
	const mappings = profileTransactionMappings(input.mappings);
	if (!mappings.ok) return mappings;
	const transaction = validateProfiledWikiTransaction({
		profile: WIKI_PROFILE_ID,
		kernelBuildDigest: environment.configuration.kernelBuildDigest,
		responsibleChangePath: tracePath(input.changeId),
		before: {snapshot: before.value.snapshot, managedFiles: before.value.managedFiles},
		after: {snapshot: after.value.snapshot, managedFiles: after.value.managedFiles},
		mappings: mappings.value,
	});
	if (!transaction.ok) return failure(invalidRequest(transaction.error.message));
	const reference = createProfiledWikiReference(transaction.value);
	if (!reference.ok) return failure(internalFailure());
	const targets = profileChangeTargets(transaction.value);
	const change = createProfileChange({
		changeId: input.changeId,
		repositoryId: before.value.snapshot.repositoryId,
		revision: 1,
		changeType: input.proposal.changeType,
		realization: input.proposal.realization,
		intent: input.proposal.intent,
		rationale: input.proposal.rationale,
		acceptance: input.proposal.acceptance,
		targets,
		reference: reference.value,
		relationships: input.proposal.relationships,
		contributorRefs: input.proposal.contributorRefs,
		producerRunRefs: input.proposal.producerRunRefs,
	});
	if (!change.ok) return failure(invalidRequest(change.error.message));
	const header = createProfileChangeTraceHeader({
		repositoryId: before.value.snapshot.repositoryId,
		changeId: input.changeId,
		objectFormat: before.value.snapshot.objectFormat,
		createdBy: actor.actorId,
		createdAt: timestamp.value,
	});
	if (!header.ok) return failure(internalFailure());
	const empty = createEmptyProfileChangeTrace(header.value);
	if (!empty.ok) return failure(internalFailure());
	const event = createProfileChangeEvent({
		kind: "change.proposed",
		ownerBinding: Object.freeze({kind: "kernel", profile: WIKI_PROFILE_ID, kernelBuildDigest: environment.configuration.kernelBuildDigest, transactionDigest: transaction.value.transactionDigest}),
		actorId: actor.actorId,
		authorityId: actor.authorizationId,
		commandId: input.commandId,
		commandDigest: commandDigest.value,
		occurredAt: timestamp.value,
		expectedProjectHead: before.value.snapshot.commit,
		expectedChangeTip: null,
		predecessorEventDigest: null,
		payload: Object.freeze({change: change.value}),
	});
	if (!event.ok) return failure(internalFailure());
	const committed = await appendTraceCommit(environment, {
		base: after.value.snapshot,
		parents: sameGitOid(after.value.snapshot.commit, before.value.snapshot.commit) ? [after.value.snapshot.commit] : [after.value.snapshot.commit, before.value.snapshot.commit],
		trace: empty.value,
		events: [event.value],
		mutations: [],
		actor,
		timestamp: timestamp.value,
		message: `changekernel: propose profile Change ${input.changeId}\n`,
	});
	if (!committed.ok) return committed;
	const cas = await compareAndSwap(environment, [
		{ref: managedChangeRef(input.changeId), expectedOld: null, newOid: committed.value.commit},
		{ref: environment.configuration.canonicalRef, expectedOld: before.value.snapshot.commit, newOid: before.value.snapshot.commit},
	], actor.authorizationId, "changekernel: propose Change with unchanged Project head");
	if (!cas.ok) return cas;
	return successResult({changeId: input.changeId, status: "proposed", nextAction: "Inspect the persisted proposal; assessment and commitment are not yet available.", userActionRequired: true}, {
		changeCommit: committed.value.commit,
		traceDigest: committed.value.trace.traceDigest,
		transactionDigest: transaction.value.transactionDigest,
		cas: cas.value.receiptDigest,
	});
}

async function replayProfileProposal(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: ProposeProfileChangeInput,
	commandDigest: Sha256Digest,
	existingCommit: GitOid,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	const retained = await loadProfileChangeRecord(environment.store, environment.configuration, {
		source: {kind: "commit", commit: existingCommit},
		view: "get",
		changeId: input.changeId,
	});
	if (!retained.ok) return retained;
	if (!isCanonicalObject(retained.value)) return failure(invalidProject("Recorded profile proposal cannot be replayed safely."));
	const traceValue = retained.value.trace;
	if (traceValue === undefined || !isCanonicalObject(traceValue) || !Array.isArray(traceValue.events)) return failure(invalidProject("Recorded profile proposal cannot be replayed safely."));
	const event = traceValue.events[0];
	if (event === undefined || !isCanonicalObject(event) || event.commandId !== input.commandId || event.commandDigest !== commandDigest || event.actorId !== actor.actorId || event.authorityId !== actor.authorizationId) {
		return failure(productError("idempotency_conflict", "That command identity already names different profile proposal input.", "Submit unchanged input or use a new command identity.", true));
	}
	return successResult(
		{changeId: input.changeId, status: "proposed", nextAction: "Inspect the persisted proposal; assessment and commitment are not yet available.", userActionRequired: true},
		{replayed: true, changeCommit: existingCommit, traceDigest: traceValue.traceDigest, eventDigest: event.eventDigest},
	);
}

async function canonicalHead(environment: LocalLifecycleEnvironment): Promise<Outcome<GitOid, ProductError>> {
	const snapshot = await environment.store.readSnapshot({
		repositoryId: environment.configuration.repositoryId,
		objectFormat: environment.configuration.objectFormat,
		selector: {kind: "ref", ref: environment.configuration.canonicalRef},
	});
	if (!snapshot.ok) return failure(productError("invalid_project_state", `Canonical source observation failed (${snapshot.error.code}).`, "Inspect the Project Store before retrying.", false));
	const admitted = decodeProjectSnapshot(snapshot.value);
	if (!admitted.ok || !admitted.value.complete || admitted.value.repositoryId !== environment.configuration.repositoryId || admitted.value.objectFormat !== environment.configuration.objectFormat) return failure(productError("invalid_project_state", "Canonical source is not a complete state reference for this Project.", "Inspect the Project Store before retrying.", false));
	return success(admitted.value.commit);
}

function profileTransactionMappings(
	mappings: ProposeProfileChangeInput["mappings"],
): Outcome<readonly ProfiledWikiMapping[], ProductError> {
	const output: ProfiledWikiMapping[] = [];
	for (const mapping of mappings) {
		const decodeEndpoints = (entries: typeof mapping.before): Outcome<readonly Readonly<{path: string; blob: GitOid}>[], ProductError> => {
			const result: Readonly<{path: string; blob: GitOid}>[] = [];
			for (const endpoint of entries) {
				const path = decodeProfiledPathUtf8Hex(endpoint.pathUtf8Hex);
				if (!path.ok) return failure(invalidRequest(path.error.message));
				result.push(Object.freeze({path: path.value, blob: endpoint.blob}));
			}
			return success(Object.freeze(result));
		};
		const before = decodeEndpoints(mapping.before);
		if (!before.ok) return before;
		const after = decodeEndpoints(mapping.after);
		if (!after.ok) return after;
		output.push(Object.freeze({kind: mapping.kind, before: before.value, after: after.value}));
	}
	return success(Object.freeze(output));
}

function profileChangeTargets(transaction: ProfiledWikiTransaction): readonly Readonly<{kind: "profile"; transactionDigest: Sha256Digest; side: "before" | "after"; pathUtf8Hex: string; blob: GitOid}>[] {
	const output: Readonly<{kind: "profile"; transactionDigest: Sha256Digest; side: "before" | "after"; pathUtf8Hex: string; blob: GitOid}>[] = [];
	for (const mapping of transaction.mappings) {
		for (const endpoint of mapping.before) output.push(Object.freeze({kind: "profile", transactionDigest: transaction.transactionDigest, side: "before", pathUtf8Hex: profileReferencePathUtf8Hex(endpoint.path), blob: endpoint.blob}));
		for (const endpoint of mapping.after) output.push(Object.freeze({kind: "profile", transactionDigest: transaction.transactionDigest, side: "after", pathUtf8Hex: profileReferencePathUtf8Hex(endpoint.path), blob: endpoint.blob}));
	}
	output.sort((left, right) => compareText(`${left.side}\0${left.pathUtf8Hex}\0${left.blob.algorithm}:${left.blob.hex}`, `${right.side}\0${right.pathUtf8Hex}\0${right.blob.algorithm}:${right.blob.hex}`));
	return Object.freeze(output);
}

function lifecycleTimestamp(environment: LocalLifecycleEnvironment): Outcome<string, ProductError> {
	let value: string;
	try {
		value = environment.now();
	} catch {
		return failure(internalFailure());
	}
	return isCanonicalRequestTimestamp(value) ? success(value) : failure(internalFailure());
}

function successResult(data: unknown, binding: unknown): Outcome<LifecycleCommandResult, ProductError> {
	const dataValue = decodeCanonicalValue(data);
	const bindingValue = decodeCanonicalValue(binding);
	if (!dataValue.ok || !bindingValue.ok) return failure(internalFailure());
	return success(Object.freeze({data: dataValue.value, binding: bindingValue.value}));
}

function authorizationDenied(message = "This Actor is not allowed to change that governed state."): ProductError {
	return productError("authorization_denied", message, "Choose an allowed action or ask a maintainer for access.", true);
}

function invalidRequest(message: string): ProductError {
	return productError("invalid_request", message, "Correct the bounded action input and retry.", true);
}

function invalidProject(message: string): ProductError {
	return productError("invalid_project_state", message, "Inspect and repair exact governed Project state before retrying.", true);
}

function staleSource(): ProductError {
	return productError("source_stale", "Project state advanced before this action.", "Refresh, reconcile exact current state, and retry explicitly.", true);
}

function conflict(message: string): ProductError {
	return productError("conflict", message, "Refresh the Change and choose an action valid for its current state.", true);
}

function internalFailure(): ProductError {
	return productError("internal_failure", "The lifecycle action could not be prepared safely.", "Retry after the Project service is healthy.", false);
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
