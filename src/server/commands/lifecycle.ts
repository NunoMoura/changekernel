import type {
	ChangeCommandInput,
	PlanWorkInput,
	PlanningCommandInput,
	ProductCommandInput,
	ProductCommandOperation,
	ProposalInput,
	ProposeChangesInput,
	ProtectedEffectInput,
	ReasonedChangeCommandInput,
	ReviseChangeInput,
	SupersedeChangeInput,
	WikiPatchInput,
	WorkCandidateInput,
	WorkCommandInput,
} from "../../api/contracts/command.ts";
import {isCanonicalRequestTimestamp, productError, type ProductError} from "../../api/transport/envelope.ts";
import {canonicalJson, decodeCanonicalValue, type CanonicalValue} from "../../kernel/data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {createChange, type Change, type ChangeRelation, type ChangeTarget} from "../../kernel/changes/contracts.ts";
import {
	CHANGE_EVENT_KINDS,
	createChangeEvent,
	type ChangeEvent,
	type ChangeEventKind,
	type ChangeEventPayload,
	type GateRecordedPayload,
	type SemanticEventOwners,
} from "../../kernel/changes/events.ts";
import type {ReducedChange, ReducedGateFact, ReducedWorkState} from "../../kernel/changes/reducer.ts";
import {
	createChangeTraceHeader,
	createEmptyChangeTrace,
	type ChangeTrace,
} from "../../kernel/changes/trace.ts";
import {validateChangeCommitSnapshot, validateCompletionCommitSnapshot, type ProjectSnapshot, type TreeChange} from "../../kernel/changes/snapshot.ts";
import {createGateSubject} from "../../kernel/gates/contracts.ts";
import {sameGitOid, type GitOid, type GitRef} from "../../kernel/identity/git.ts";
import {canonicalValueDigest, semanticDigest} from "../../kernel/identity/semantic-digest.ts";
import type {Sha256Digest} from "../../kernel/identity/sha256.ts";
import {createWork, validateWorkPlan, workAllowsPath, workIdentity, workPlanDigest, type Work} from "../../kernel/work/contracts.ts";
import {decodeWikiFile, type WikiFileInput} from "../../kernel/wiki/file.ts";
import {buildSemanticEventOwnership, decodeComponentOwnership, type ComponentOwnership} from "../../kernel/wiki/ownership.ts";
import {validateWikiTransaction, type ValidatedWikiTransaction} from "../../kernel/wiki/transaction.ts";
import {validateWikiTree, type WikiMaterialization} from "../../kernel/wiki/tree.ts";
import type {ProjectStoreCasReceipt, ProjectStoreTreeEntry, ProjectStoreTreeMutation} from "../../ports/project-store.ts";
import type {AuthorizedProjectActor} from "../authorization/policy.ts";
import type {GateBundle, ProjectServerFactsPort} from "../recovery/facts.ts";
import {evaluateGate, type GateExecutionEnvironment, type GateMaterial} from "./gates.ts";
import {
	appendTraceCommit,
	canonicalCommandDigest,
	commandAlreadyRecorded,
	compareAndSwap,
	diffTreeEntries,
	eventCommandId,
	filteredTree,
	loadCanonical,
	loadLifecycleChange,
	managedChangeRef,
	mutationsFromDelta,
	readTreeEntries,
	tracePath,
	verifyCommandBinding,
	writeBlob,
	type LifecycleRepositoryEnvironment,
	type LoadedLifecycleChange,
	type TreeDeltaEntry,
} from "./repository.ts";

export interface ProtectedEffectConfiguration {
	readonly capability: string;
	readonly ref: GitRef;
	readonly actorIds: readonly string[];
}

export interface LocalLifecycleEnvironment extends GateExecutionEnvironment {
	readonly facts: ProjectServerFactsPort;
	readonly now: () => string;
	readonly protectedEffects: readonly ProtectedEffectConfiguration[];
}

export interface LifecycleCommandResult {
	readonly data: CanonicalValue;
	readonly binding: CanonicalValue;
}

interface PreparedWikiPatch {
	readonly mutations: readonly ProjectStoreTreeMutation[];
	readonly transaction: ValidatedWikiTransaction;
	readonly owners: SemanticEventOwners;
}

interface EventContext {
	readonly trace: ChangeTrace;
	readonly owners: SemanticEventOwners;
	readonly actor: AuthorizedProjectActor;
	readonly expectedProjectHead: GitOid;
	readonly expectedChangeTip: GitOid | null;
	readonly timestamp: string;
	readonly commandDigest: Sha256Digest;
}

const TRACE_PREFIX = ".codewiki/changes/";

export async function executeLifecycleCommand(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	operation: ProductCommandOperation,
	input: ProductCommandInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	try {
		switch (operation) {
			case "changes.propose": return proposeChanges(environment, actor, input as ProposeChangesInput);
			case "changes.revise": return reviseChange(environment, actor, input as ReviseChangeInput);
			case "decision.evaluate": return evaluateDecision(environment, actor, input as ChangeCommandInput);
			case "decision.commit": return commitDecision(environment, actor, input as ChangeCommandInput);
			case "decision.reject": return recordDecision(environment, actor, operation, input as ReasonedChangeCommandInput, "change.rejected");
			case "decision.defer": return recordDecision(environment, actor, operation, input as ReasonedChangeCommandInput, "change.deferred");
			case "decision.withdraw": return recordDecision(environment, actor, operation, input as ReasonedChangeCommandInput, "change.withdrawn");
			case "decision.resume": return resumeDecision(environment, actor, input as ReasonedChangeCommandInput);
			case "planning.evaluate": return evaluatePlanning(environment, actor, input as PlanningCommandInput);
			case "planning.admit": return admitPlanning(environment, actor, input as PlanningCommandInput);
			case "work.admit": return admitWork(environment, actor, input as WorkCandidateInput);
			case "work.evaluate": return evaluateWork(environment, actor, input as WorkCommandInput);
			case "work.integrate": return integrateWork(environment, actor, input as WorkCommandInput);
			case "review.reconcile": return reconcileReview(environment, actor, input as ChangeCommandInput);
			case "review.evaluate": return evaluateReview(environment, actor, input as ChangeCommandInput);
			case "changes.complete": return completeChange(environment, actor, input as ChangeCommandInput);
			case "changes.supersede": return supersedeChange(environment, actor, input as SupersedeChangeInput);
			case "effects.request": return requestProtectedEffect(environment, actor, input as ProtectedEffectInput);
			default: return failure(invalidRequest("That lifecycle command is unsupported."));
		}
	} catch {
		return failure(productError(
			"operation_unknown",
			"The lifecycle action ended without a trustworthy outcome.",
			"Refresh exact Project and Change state before deciding whether to retry.",
			true,
		));
	}
}

async function proposeChanges(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: ProposeChangesInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	if (actor.changeIds !== null) return failure(authorizationDenied());
	const commandDigest = canonicalCommandDigest("changes.propose", input);
	if (!commandDigest.ok) return commandDigest;
	const ids = new Map(input.proposals.map((proposal) => [proposal.proposalKey, changeIdentity(environment.configuration.repositoryId, actor.actorId, input.commandId, proposal.proposalKey)]));
	const replay = await replayProposalBatch(environment, actor, input, commandDigest.value, ids);
	if (replay !== null) return replay;
	const project = await loadCanonical(environment);
	if (!project.ok) return project;
	if (!sameGitOid(project.value.snapshot.commit, input.expectedProjectHead)) return failure(staleSource());
	const timestamp = lifecycleTimestamp(environment);
	if (!timestamp.ok) return timestamp;
	const prepared: Readonly<{change: Change; commit: GitOid}>[] = [];
	for (const proposal of input.proposals) {
		const changeId = ids.get(proposal.proposalKey) as string;
		const change = materializeChange(environment.configuration.repositoryId, changeId, 1, proposal, ids);
		if (!change.ok) return change;
		const wiki = await prepareWikiPatch(environment, actor, project.value.wiki, proposal.wiki);
		if (!wiki.ok) return wiki;
		const scope = validateProposalScope(change.value, wiki.value.transaction, project.value.wiki, actor);
		if (!scope.ok) return scope;
		if (!sameOwners(project.value.eventOwners, wiki.value.owners)) return failure(invalidProject("A proposal cannot reassign semantic event ownership before commitment."));
		const header = createChangeTraceHeader({
			repositoryId: environment.configuration.repositoryId,
			changeId,
			objectFormat: environment.configuration.objectFormat,
			createdBy: actor.actorId,
			createdAt: timestamp.value,
		});
		if (!header.ok) return failure(invalidProject("Change Trace identity could not be created."));
		const trace = createEmptyChangeTrace(header.value);
		if (!trace.ok) return failure(invalidProject("Empty Change Trace could not be created."));
		const event = makeEvent({
			trace: trace.value,
			owners: project.value.eventOwners,
			actor,
			expectedProjectHead: project.value.snapshot.commit,
			expectedChangeTip: null,
			timestamp: timestamp.value,
			commandDigest: commandDigest.value,
		}, eventCommandId(input.commandId, proposal.proposalKey), "change.proposed", {change: change.value});
		if (!event.ok) return event;
		const committed = await appendTraceCommit(environment, {
			base: project.value.snapshot,
			parents: [project.value.snapshot.commit],
			trace: trace.value,
			events: [event.value],
			owners: project.value.eventOwners,
			mutations: wiki.value.mutations,
			actor,
			timestamp: timestamp.value,
			message: `codewiki: propose ${changeId}\n`,
		});
		if (!committed.ok) return committed;
		prepared.push(Object.freeze({change: change.value, commit: committed.value.commit}));
	}
	const cas = await compareAndSwap(environment, prepared.map((entry) => Object.freeze({
		ref: managedChangeRef(entry.change.changeId),
		expectedOld: null,
		newOid: entry.commit,
	})), actor.authorizationId, "codewiki: propose Changes");
	if (!cas.ok) return cas;
	return successResult(
		{changes: prepared.map((entry) => ({changeId: entry.change.changeId, status: "proposed"})), nextAction: "Review each proposed Change independently and run its Decision Checks.", userActionRequired: false},
		{projectHead: project.value.snapshot.commit, changeCommits: prepared.map((entry) => ({changeId: entry.change.changeId, commit: entry.commit})), cas: cas.value.receiptDigest},
	);
}

async function reviseChange(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: ReviseChangeInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	const loaded = await authorizedChange(environment, actor, input.changeId);
	if (!loaded.ok) return loaded;
	const digest = canonicalCommandDigest("changes.revise", input);
	if (!digest.ok) return digest;
	const replay = replaySingle(loaded.value, input.commandId, digest.value, ["change.revised"]);
	if (replay) return replay;
	const binding = verifyCommandBinding(loaded.value, input.expectedProjectHead, input.expectedChangeTip);
	if (!binding.ok) return binding;
	if (loaded.value.change.reduced.state !== "proposed") return failure(conflict("Only a currently proposed Change can be revised."));
	if (input.proposal.relationships.some((entry) => entry.target.kind === "proposal")) return failure(invalidRequest("A revision cannot reference a request-local proposal key."));
	const ids = new Map<string, string>();
	const change = materializeChange(environment.configuration.repositoryId, input.changeId, loaded.value.change.reduced.change.revision + 1, input.proposal, ids);
	if (!change.ok) return change;
	const wiki = await prepareWikiPatch(environment, actor, loaded.value.project.wiki, input.proposal.wiki);
	if (!wiki.ok) return wiki;
	const scope = validateProposalScope(change.value, wiki.value.transaction, loaded.value.project.wiki, actor);
	if (!scope.ok) return scope;
	if (!sameOwners(loaded.value.project.eventOwners, wiki.value.owners)) return failure(invalidProject("A revision cannot reassign semantic event ownership before commitment."));
	const timestamp = lifecycleTimestamp(environment);
	if (!timestamp.ok) return timestamp;
	const event = makeEvent(eventContext(loaded.value, actor, timestamp.value, digest.value), input.commandId, "change.revised", {change: change.value});
	if (!event.ok) return event;
	const committed = await appendTraceCommit(environment, {
		base: loaded.value.project.snapshot,
		parents: [loaded.value.source.snapshot.commit],
		trace: loaded.value.change.trace,
		events: [event.value],
		owners: loaded.value.project.eventOwners,
		mutations: wiki.value.mutations,
		actor,
		timestamp: timestamp.value,
		message: `codewiki: revise ${input.changeId}\n`,
	});
	if (!committed.ok) return committed;
	const cas = await moveChangeRef(environment, actor, input.changeId, loaded.value.source.snapshot.commit, committed.value.commit, "codewiki: revise Change");
	if (!cas.ok) return cas;
	return changeResult(input.changeId, "proposed", "Run fresh Decision Checks for the revised Change.", committed.value.commit, cas.value);
}

async function evaluateDecision(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: ChangeCommandInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	return evaluateStage(environment, actor, input, "decision", "change", null, (loaded) => loaded.change.reduced.change.changeDigest);
}

async function recordDecision(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	operation: ProductCommandOperation,
	input: ReasonedChangeCommandInput,
	kind: "change.deferred" | "change.rejected" | "change.withdrawn",
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	const loaded = await authorizedChange(environment, actor, input.changeId);
	if (!loaded.ok) return loaded;
	const digest = canonicalCommandDigest(operation, input);
	if (!digest.ok) return digest;
	const replay = replaySingle(loaded.value, input.commandId, digest.value, [kind]);
	if (replay) return replay;
	const binding = verifyCommandBinding(loaded.value, input.expectedProjectHead, input.expectedChangeTip);
	if (!binding.ok) return binding;
	const gate = latestPassedGate(loaded.value.change.reduced, "decision", null);
	if (!gate) return failure(gateRequired("Decision"));
	const verified = await verifyGateBundle(environment.facts, environment.configuration.repositoryId, gate);
	if (!verified.ok) return verified;
	const timestamp = lifecycleTimestamp(environment);
	if (!timestamp.ok) return timestamp;
	const event = makeEvent(eventContext(loaded.value, actor, timestamp.value, digest.value), input.commandId, kind, {reason: input.reason, gateDigest: gate.gateDigest});
	if (!event.ok) return event;
	const moved = await appendAndMoveChange(environment, actor, loaded.value, [event.value], timestamp.value, `codewiki: ${kind} ${input.changeId}\n`);
	if (!moved.ok) return moved;
	let state: "deferred" | "rejected" | "withdrawn" = "withdrawn";
	if (kind === "change.deferred") state = "deferred";
	else if (kind === "change.rejected") state = "rejected";
	return changeResult(input.changeId, state, state === "deferred" ? "Resume or leave the Change deferred." : "No further action is required for this proposal.", moved.value.commit, moved.value.cas);
}

async function resumeDecision(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: ReasonedChangeCommandInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	const loaded = await authorizedChange(environment, actor, input.changeId);
	if (!loaded.ok) return loaded;
	const digest = canonicalCommandDigest("decision.resume", input);
	if (!digest.ok) return digest;
	const replay = replaySingle(loaded.value, input.commandId, digest.value, ["change.resumed"]);
	if (replay) return replay;
	const binding = verifyCommandBinding(loaded.value, input.expectedProjectHead, input.expectedChangeTip);
	if (!binding.ok) return binding;
	if (loaded.value.change.reduced.state !== "deferred") return failure(conflict("Only a deferred Change can be resumed."));
	const timestamp = lifecycleTimestamp(environment);
	if (!timestamp.ok) return timestamp;
	const event = makeEvent(eventContext(loaded.value, actor, timestamp.value, digest.value), input.commandId, "change.resumed", {reason: input.reason});
	if (!event.ok) return event;
	const moved = await appendAndMoveChange(environment, actor, loaded.value, [event.value], timestamp.value, `codewiki: resume ${input.changeId}\n`);
	if (!moved.ok) return moved;
	return changeResult(input.changeId, "proposed", "Revise if needed, then run fresh Decision Checks.", moved.value.commit, moved.value.cas);
}

async function commitDecision(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: ChangeCommandInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	const loaded = await authorizedChange(environment, actor, input.changeId);
	if (!loaded.ok) return loaded;
	const digest = canonicalCommandDigest("decision.commit", input);
	if (!digest.ok) return digest;
	const replay = replaySingle(loaded.value, eventCommandId(input.commandId, "commit"), digest.value, ["change.committed"]);
	if (replay) return replay;
	const binding = verifyCommandBinding(loaded.value, input.expectedProjectHead, input.expectedChangeTip);
	if (!binding.ok) return binding;
	if (loaded.value.change.reduced.state !== "proposed") return failure(conflict("Only a proposed Change can be committed."));
	const gate = latestPassedGate(loaded.value.change.reduced, "decision", null);
	if (!gate || !sameGitOid(gate.expectedProjectHead, loaded.value.project.snapshot.commit)) return failure(gateRequired("current Decision"));
	const verified = await verifyGateBundle(environment.facts, environment.configuration.repositoryId, gate);
	if (!verified.ok) return verified;
	const changeEntries = await readTreeEntries(environment, loaded.value.source.snapshot);
	if (!changeEntries.ok) return changeEntries;
	const projectEntries = await readTreeEntries(environment, loaded.value.project.snapshot);
	if (!projectEntries.ok) return projectEntries;
	const delta = diffTreeEntries(projectEntries.value, changeEntries.value);
	if (delta.some((entry) => entry.path !== tracePath(input.changeId) && !entry.path.startsWith(".codewiki/wiki/"))) {
		return failure(invalidProject("A Proposed Change contains project artifacts outside its admitted Wiki and Trace scope."));
	}
	const wikiTree = await filteredTree(environment, changeEntries.value, (path) => path.startsWith(".codewiki/wiki/"), actor.authorizationId);
	if (!wikiTree.ok) return wikiTree;
	const timestamp = lifecycleTimestamp(environment);
	if (!timestamp.ok) return timestamp;
	const first = makeEvent(eventContext(loaded.value, actor, timestamp.value, digest.value), eventCommandId(input.commandId, "commit"), "change.committed", {
		decisionGateDigest: gate.gateDigest,
		wikiTree: wikiTree.value,
	});
	if (!first.ok) return first;
	const events: ChangeEvent[] = [first.value];
	if (loaded.value.change.reduced.change.realization === "wiki-only") {
		const nextContext = {...eventContext(loaded.value, actor, timestamp.value, digest.value), trace: traceWithEvent(loaded.value.change.trace, first.value)};
		const completed = makeEvent(nextContext, eventCommandId(input.commandId, "complete"), "change.completed", {completionTree: wikiTree.value, reviewGateDigest: null});
		if (!completed.ok) return completed;
		events.push(completed.value);
	}
	const committed = await appendTraceCommit(environment, {
		base: loaded.value.source.snapshot,
		parents: [loaded.value.project.snapshot.commit, loaded.value.source.snapshot.commit],
		trace: loaded.value.change.trace,
		events,
		owners: loaded.value.project.eventOwners,
		actor,
		timestamp: timestamp.value,
		message: `codewiki: commit ${input.changeId}\n`,
	});
	if (!committed.ok) return committed;
	const validated = await validateChangeCommit(environment, loaded.value, committed.value, first.value, delta);
	if (!validated.ok) return validated;
	const cas = await compareAndSwap(environment, [
		{ref: environment.configuration.canonicalRef, expectedOld: loaded.value.project.snapshot.commit, newOid: committed.value.commit},
		{ref: managedChangeRef(input.changeId), expectedOld: loaded.value.source.snapshot.commit, newOid: committed.value.commit},
	], actor.authorizationId, "codewiki: commit Change");
	if (!cas.ok) return cas;
	const completed = loaded.value.change.reduced.change.realization === "wiki-only";
	return changeResult(input.changeId, completed ? "completed" : "committed", completed ? "This Wiki-only Change is complete." : "Prepare a bounded Work plan for project realization.", committed.value.commit, cas.value);
}

async function evaluatePlanning(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: PlanningCommandInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	const plan = materializePlan(input.changeId, input.work);
	if (!plan.ok) return plan;
	const loaded = await authorizedChange(environment, actor, input.changeId);
	if (!loaded.ok) return loaded;
	const coverage = validatePlanCoverage(loaded.value.change.reduced.change, plan.value.work);
	if (!coverage.ok) return coverage;
	const material = decodeCanonicalValue(plan.value.work);
	if (!material.ok) return failure(internalFailure());
	return evaluateStage(environment, actor, input, "planning", "plan", null, () => plan.value.digest, [
		{source: "subject", ref: `work-plan:${input.changeId}`, content: material.value},
	]);
}

async function admitPlanning(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: PlanningCommandInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	const loaded = await authorizedChange(environment, actor, input.changeId);
	if (!loaded.ok) return loaded;
	const digest = canonicalCommandDigest("planning.admit", input);
	if (!digest.ok) return digest;
	const replay = replaySingle(loaded.value, input.commandId, digest.value, ["change.planned"]);
	if (replay) return replay;
	const binding = verifyCommandBinding(loaded.value, input.expectedProjectHead, input.expectedChangeTip);
	if (!binding.ok) return binding;
	const plan = materializePlan(input.changeId, input.work);
	if (!plan.ok) return plan;
	const coverage = validatePlanCoverage(loaded.value.change.reduced.change, plan.value.work);
	if (!coverage.ok) return coverage;
	const gate = latestPassedGate(loaded.value.change.reduced, "planning", null);
	if (!gate || gate.subjectDigest !== plan.value.digest || !sameGitOid(gate.expectedProjectHead, loaded.value.project.snapshot.commit)) return failure(gateRequired("exact Planning"));
	const verified = await verifyGateBundle(environment.facts, environment.configuration.repositoryId, gate);
	if (!verified.ok) return verified;
	const timestamp = lifecycleTimestamp(environment);
	if (!timestamp.ok) return timestamp;
	const event = makeEvent(eventContext(loaded.value, actor, timestamp.value, digest.value), input.commandId, "change.planned", {
		planningGateDigest: gate.gateDigest,
		planDigest: plan.value.digest,
		work: plan.value.work,
	});
	if (!event.ok) return event;
	const moved = await appendAndMoveChange(environment, actor, loaded.value, [event.value], timestamp.value, `codewiki: admit plan ${input.changeId}\n`);
	if (!moved.ok) return moved;
	return changeResult(input.changeId, "committed", "Admit ready Work results under their exact Work Unit scope.", moved.value.commit, moved.value.cas);
}

async function admitWork(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: WorkCandidateInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	const loaded = await authorizedChange(environment, actor, input.changeId);
	if (!loaded.ok) return loaded;
	const digest = canonicalCommandDigest("work.admit", input);
	if (!digest.ok) return digest;
	const replay = replaySingle(loaded.value, eventCommandId(input.commandId, "attempt"), digest.value, ["work.attempt.recorded"]);
	if (replay) return replay;
	const binding = verifyCommandBinding(loaded.value, input.expectedProjectHead, input.expectedChangeTip);
	if (!binding.ok) return binding;
	const work = currentWork(loaded.value.change.reduced, input.workId);
	if (!work.ok) return work;
	if (work.value.integration !== null || work.value.attempts.length >= work.value.assignments.length + 1) return failure(conflict("That Work Unit already has a current result."));
	if (!work.value.work.dependencies.every((dependency) => loaded.value.change.reduced.work.find((entry) => entry.work.workId === dependency)?.integration !== null)) {
		return failure(conflict("Work dependencies are not integrated."));
	}
	const candidate = await environment.store.readSnapshot({
		repositoryId: environment.configuration.repositoryId,
		objectFormat: environment.configuration.objectFormat,
		selector: {kind: "oid", oid: input.resultCommit},
	});
	if (!candidate.ok || candidate.value.parents.length !== 1) return failure(invalidProject("Work result must be one complete single-parent Project snapshot."));
	const base = await environment.store.readSnapshot({
		repositoryId: environment.configuration.repositoryId,
		objectFormat: environment.configuration.objectFormat,
		selector: {kind: "oid", oid: candidate.value.parents[0] as GitOid},
	});
	if (!base.ok) return failure(invalidProject("Work result base is unavailable."));
	const baseEntries = await readTreeEntries(environment, base.value);
	if (!baseEntries.ok) return baseEntries;
	const candidateEntries = await readTreeEntries(environment, candidate.value);
	if (!candidateEntries.ok) return candidateEntries;
	const delta = diffTreeEntries(baseEntries.value, candidateEntries.value);
	if (delta.length === 0 || delta.some((entry) => entry.path.startsWith(".codewiki/") || !workAllowsPath(work.value.work, entry.path))) {
		return failure(authorizationDenied("Work result changes bytes outside its exact writable Project scope."));
	}
	const prefix = await verifyTraceBase(environment, loaded.value, base.value.commit);
	if (!prefix.ok) return prefix;
	const timestamp = lifecycleTimestamp(environment);
	if (!timestamp.ok) return timestamp;
	const claimId = derivedId("cw:claim", {changeId: input.changeId, workId: input.workId, commandId: input.commandId});
	const assignmentId = derivedId("cw:assignment", {claimId, base: base.value.commit});
	const runId = derivedId("cw:external-work-run", {assignmentId, result: candidate.value.commit});
	const claimReceipt = semanticValueDigest("codewiki.work-claim-receipt@1.0.0", {claimId, actorId: actor.actorId});
	const runRequest = semanticValueDigest("codewiki.work-run-request@1.0.0", {assignmentId, base: base.value.commit, workDigest: work.value.work.workDigest});
	const runReceipt = semanticValueDigest("codewiki.external-work-receipt@1.0.0", {runId, resultCommit: candidate.value.commit, resultTree: candidate.value.tree, changedPaths: delta.map((entry) => entry.path)});
	if (!claimReceipt.ok || !runRequest.ok || !runReceipt.ok) return failure(internalFailure());
	const events = makeEventSequence(eventContext(loaded.value, actor, timestamp.value, digest.value), [
		{commandId: eventCommandId(input.commandId, "claim"), kind: "work.claimed", payload: {workId: input.workId, claimId, receiptDigest: claimReceipt.value}},
		{commandId: eventCommandId(input.commandId, "assignment"), kind: "work.assigned", payload: {workId: input.workId, claimId, assignmentId, baseCommit: base.value.commit, baseTree: base.value.tree, runRequestDigest: runRequest.value}},
		{commandId: eventCommandId(input.commandId, "attempt"), kind: "work.attempt.recorded", payload: {workId: input.workId, assignmentId, runId, runReceiptDigest: runReceipt.value, resultCommit: candidate.value.commit, resultTree: candidate.value.tree}},
	]);
	if (!events.ok) return events;
	const moved = await appendAndMoveChange(environment, actor, loaded.value, events.value, timestamp.value, `codewiki: admit Work result ${input.workId}\n`);
	if (!moved.ok) return moved;
	return successResult(
		{changeId: input.changeId, workId: input.workId, status: "result-admitted", nextAction: "Run exact Implementation Checks for this Work result.", userActionRequired: false},
		{changeCommit: moved.value.commit, resultCommit: candidate.value.commit, resultTree: candidate.value.tree, changedPaths: delta.map((entry) => entry.path), cas: moved.value.cas.receiptDigest},
	);
}

async function evaluateWork(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: WorkCommandInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	const loaded = await authorizedChange(environment, actor, input.changeId);
	if (!loaded.ok) return loaded;
	const work = currentWork(loaded.value.change.reduced, input.workId);
	if (!work.ok) return work;
	const attempt = work.value.attempts.at(-1);
	if (!attempt || work.value.integration !== null) return failure(conflict("Implementation Checks require one current unintegrated Work result."));
	const material = decodeCanonicalValue({resultCommit: attempt.resultCommit, resultTree: attempt.resultTree});
	if (!material.ok) return failure(internalFailure());
	return evaluateStage(environment, actor, input, "implementation", "work", input.workId, () => work.value.work.workDigest, [
		{source: "subject", ref: `work-result:${input.workId}`, content: material.value},
	]);
}

async function integrateWork(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: WorkCommandInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	const loaded = await authorizedChange(environment, actor, input.changeId);
	if (!loaded.ok) return loaded;
	const digest = canonicalCommandDigest("work.integrate", input);
	if (!digest.ok) return digest;
	const replay = replaySingle(loaded.value, input.commandId, digest.value, ["work.integrated"]);
	if (replay) return replay;
	const binding = verifyCommandBinding(loaded.value, input.expectedProjectHead, input.expectedChangeTip);
	if (!binding.ok) return binding;
	const work = currentWork(loaded.value.change.reduced, input.workId);
	if (!work.ok) return work;
	const attempt = work.value.attempts.at(-1);
	const assignment = work.value.assignments.at(-1);
	if (!attempt || !assignment || work.value.integration !== null) return failure(conflict("Work integration requires one current unintegrated result."));
	const gate = latestPassedGate(loaded.value.change.reduced, "implementation", input.workId);
	if (!gate || gate.subjectDigest !== work.value.work.workDigest || !sameOptionalOid(gate.implementationResultCommit, attempt.resultCommit) || !sameOptionalOid(gate.implementationResultTree, attempt.resultTree)) {
		return failure(gateRequired("exact Implementation"));
	}
	const verified = await verifyGateBundle(environment.facts, environment.configuration.repositoryId, gate);
	if (!verified.ok) return verified;
	const base = await readSnapshotOid(environment, assignment.baseCommit);
	if (!base.ok) return base;
	const candidate = await readSnapshotOid(environment, attempt.resultCommit);
	if (!candidate.ok || !sameGitOid(candidate.value.tree, attempt.resultTree)) return failure(invalidProject("Work result snapshot differs from admitted exact bytes."));
	const baseEntries = await readTreeEntries(environment, base.value);
	if (!baseEntries.ok) return baseEntries;
	const candidateEntries = await readTreeEntries(environment, candidate.value);
	if (!candidateEntries.ok) return candidateEntries;
	const currentEntries = await readTreeEntries(environment, loaded.value.source.snapshot);
	if (!currentEntries.ok) return currentEntries;
	const candidateDelta = diffTreeEntries(baseEntries.value, candidateEntries.value).filter((entry) => !entry.path.startsWith(".codewiki/"));
	if (candidateDelta.length === 0 || candidateDelta.some((entry) => !workAllowsPath(work.value.work, entry.path))) return failure(invalidProject("Work result scope changed after admission."));
	const concurrent = new Map<string, TreeDeltaEntry>();
	for (const entry of diffTreeEntries(baseEntries.value, currentEntries.value)) {
		if (!entry.path.startsWith(".codewiki/")) concurrent.set(entry.path, entry);
	}
	for (const entry of candidateDelta) {
		const other = concurrent.get(entry.path);
		if (other && !sameTreeSide(other.after, entry.after)) return failure(reconciliationRequired("Concurrent Work changed an overlapping project artifact."));
	}
	const timestamp = lifecycleTimestamp(environment);
	if (!timestamp.ok) return timestamp;
	const event = makeEvent(eventContext(loaded.value, actor, timestamp.value, digest.value), input.commandId, "work.integrated", {
		workId: input.workId,
		resultCommit: attempt.resultCommit,
		resultTree: attempt.resultTree,
		implementationGateDigest: gate.gateDigest,
	});
	if (!event.ok) return event;
	const committed = await appendTraceCommit(environment, {
		base: loaded.value.source.snapshot,
		parents: [loaded.value.source.snapshot.commit, attempt.resultCommit],
		trace: loaded.value.change.trace,
		events: [event.value],
		owners: loaded.value.project.eventOwners,
		mutations: mutationsFromDelta(candidateDelta),
		actor,
		timestamp: timestamp.value,
		message: `codewiki: integrate ${input.workId}\n`,
	});
	if (!committed.ok) return committed;
	const cas = await moveChangeRef(environment, actor, input.changeId, loaded.value.source.snapshot.commit, committed.value.commit, "codewiki: integrate Work");
	if (!cas.ok) return cas;
	return successResult(
		{changeId: input.changeId, workId: input.workId, status: "integrated", nextAction: "Integrate remaining Work or reconcile the complete Change for Review.", userActionRequired: false},
		{changeCommit: committed.value.commit, resultCommit: attempt.resultCommit, changedPaths: candidateDelta.map((entry) => entry.path), cas: cas.value.receiptDigest},
	);
}

async function reconcileReview(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: ChangeCommandInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	const loaded = await authorizedChange(environment, actor, input.changeId);
	if (!loaded.ok) return loaded;
	const digest = canonicalCommandDigest("review.reconcile", input);
	if (!digest.ok) return digest;
	const replay = replaySingle(loaded.value, input.commandId, digest.value, ["review.reconciled"]);
	if (replay) return replay;
	const binding = verifyCommandBinding(loaded.value, input.expectedProjectHead, input.expectedChangeTip);
	if (!binding.ok) return binding;
	if (loaded.value.change.reduced.state !== "committed" || loaded.value.change.reduced.change.realization !== "project" || loaded.value.change.reduced.work.length === 0 || loaded.value.change.reduced.work.some((entry) => entry.integration === null)) {
		return failure(conflict("Review reconciliation requires every current Work Unit to be integrated."));
	}
	const committedEvent = lastEvent(loaded.value.change.trace, "change.committed");
	if (!committedEvent) return failure(invalidProject("Committed Change history is incomplete."));
	const baseline = await readSnapshotOid(environment, committedEvent.expectedProjectHead);
	if (!baseline.ok) return baseline;
	const baselineEntries = await readTreeEntries(environment, baseline.value);
	if (!baselineEntries.ok) return baselineEntries;
	const changeEntries = await readTreeEntries(environment, loaded.value.source.snapshot);
	if (!changeEntries.ok) return changeEntries;
	const projectEntries = await readTreeEntries(environment, loaded.value.project.snapshot);
	if (!projectEntries.ok) return projectEntries;
	const artifactDelta = diffTreeEntries(baselineEntries.value, changeEntries.value).filter(isProjectArtifactDelta);
	const canonicalDelta = new Map<string, TreeDeltaEntry>();
	for (const entry of diffTreeEntries(baselineEntries.value, projectEntries.value)) {
		if (isProjectArtifactDelta(entry)) canonicalDelta.set(entry.path, entry);
	}
	for (const entry of artifactDelta) {
		const current = canonicalDelta.get(entry.path);
		if (current && !sameTreeSide(current.after, entry.after)) {
			return failure(reconciliationRequired("Canonical history changed an affected project artifact; affected Results require fresh Work and Checks."));
		}
	}
	const reconciledEntries = applyDeltaEntries(projectEntries.value, artifactDelta);
	const prospective = await filteredTree(environment, reconciledEntries, (path) => !path.startsWith(TRACE_PREFIX), actor.authorizationId);
	if (!prospective.ok) return prospective;
	const integratedWorkIds = loaded.value.change.reduced.work.map((entry) => entry.work.workId).sort(compareText);
	const reviewSubject = semanticValueDigest("codewiki.review-subject@1.0.0", {
		changeDigest: loaded.value.change.reduced.change.changeDigest,
		projectCommit: loaded.value.project.snapshot.commit,
		prospectiveTree: prospective.value,
		integratedWorkIds,
	});
	if (!reviewSubject.ok) return failure(internalFailure());
	const timestamp = lifecycleTimestamp(environment);
	if (!timestamp.ok) return timestamp;
	const event = makeEvent(eventContext(loaded.value, actor, timestamp.value, digest.value), input.commandId, "review.reconciled", {
		prospectiveTree: prospective.value,
		integratedWorkIds,
		reviewSubjectDigest: reviewSubject.value,
	});
	if (!event.ok) return event;
	const committed = await appendTraceCommit(environment, {
		base: loaded.value.project.snapshot,
		parents: sameGitOid(loaded.value.source.snapshot.commit, loaded.value.project.snapshot.commit)
			? [loaded.value.source.snapshot.commit]
			: [loaded.value.source.snapshot.commit, loaded.value.project.snapshot.commit],
		trace: loaded.value.change.trace,
		events: [event.value],
		owners: loaded.value.project.eventOwners,
		mutations: mutationsFromDelta(artifactDelta),
		actor,
		timestamp: timestamp.value,
		message: `codewiki: reconcile ${input.changeId} for Review\n`,
	});
	if (!committed.ok) return committed;
	const cas = await moveChangeRef(environment, actor, input.changeId, loaded.value.source.snapshot.commit, committed.value.commit, "codewiki: reconcile Review");
	if (!cas.ok) return cas;
	return successResult(
		{changeId: input.changeId, status: "reconciled", nextAction: "Run Review Checks against the exact prospective Completion artifacts.", userActionRequired: false},
		{changeCommit: committed.value.commit, prospectiveTree: prospective.value, projectHead: loaded.value.project.snapshot.commit, changedPaths: artifactDelta.map((entry) => entry.path), cas: cas.value.receiptDigest},
	);
}

async function evaluateReview(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: ChangeCommandInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	return evaluateStage(environment, actor, input, "review", "review", null, (loaded) => {
		if (!loaded.change.reduced.review) return null;
		return loaded.change.reduced.review.reconciliation.reviewSubjectDigest;
	});
}

async function completeChange(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: ChangeCommandInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	const loaded = await authorizedChange(environment, actor, input.changeId);
	if (!loaded.ok) return loaded;
	const digest = canonicalCommandDigest("changes.complete", input);
	if (!digest.ok) return digest;
	const replay = replaySingle(loaded.value, input.commandId, digest.value, ["change.completed"]);
	if (replay) return replay;
	const binding = verifyCommandBinding(loaded.value, input.expectedProjectHead, input.expectedChangeTip);
	if (!binding.ok) return binding;
	const reduced = loaded.value.change.reduced;
	if (reduced.state !== "committed" || reduced.change.realization !== "project" || !reduced.review) return failure(conflict("Project Change completion requires current reconciled Review."));
	const reconciliationEvent = lastEvent(loaded.value.change.trace, "review.reconciled");
	const gate = latestPassedGate(reduced, "review", null);
	if (!reconciliationEvent || !gate || !sameGitOid(reconciliationEvent.expectedProjectHead, loaded.value.project.snapshot.commit) || !sameGitOid(gate.expectedProjectHead, loaded.value.project.snapshot.commit) || gate.subjectDigest !== reduced.review.reconciliation.reviewSubjectDigest) {
		return failure(reconciliationRequired("Canonical state changed after reconciliation or Review; reconcile and review the new exact subject."));
	}
	const verified = await verifyGateBundle(environment.facts, environment.configuration.repositoryId, gate);
	if (!verified.ok) return verified;
	const beforeEntries = await readTreeEntries(environment, loaded.value.source.snapshot);
	if (!beforeEntries.ok) return beforeEntries;
	const artifactBefore = await filteredTree(environment, beforeEntries.value, (path) => !path.startsWith(TRACE_PREFIX), actor.authorizationId);
	if (!artifactBefore.ok) return artifactBefore;
	if (!sameGitOid(artifactBefore.value, reduced.review.reconciliation.prospectiveTree)) return failure(reconciliationRequired("Reviewed project artifacts changed before Completion."));
	const timestamp = lifecycleTimestamp(environment);
	if (!timestamp.ok) return timestamp;
	const event = makeEvent(eventContext(loaded.value, actor, timestamp.value, digest.value), input.commandId, "change.completed", {
		completionTree: artifactBefore.value,
		reviewGateDigest: gate.gateDigest,
	});
	if (!event.ok) return event;
	const committed = await appendTraceCommit(environment, {
		base: loaded.value.source.snapshot,
		parents: [loaded.value.project.snapshot.commit, loaded.value.source.snapshot.commit],
		trace: loaded.value.change.trace,
		events: [event.value],
		owners: loaded.value.project.eventOwners,
		actor,
		timestamp: timestamp.value,
		message: `codewiki: complete ${input.changeId}\n`,
	});
	if (!committed.ok) return committed;
	const resultSnapshot = await readSnapshotOid(environment, committed.value.commit);
	if (!resultSnapshot.ok) return resultSnapshot;
	const afterEntries = await readTreeEntries(environment, resultSnapshot.value);
	if (!afterEntries.ok) return afterEntries;
	const artifactAfter = await filteredTree(environment, afterEntries.value, (path) => !path.startsWith(TRACE_PREFIX), actor.authorizationId);
	if (!artifactAfter.ok) return artifactAfter;
	const delta = diffTreeEntries(beforeEntries.value, afterEntries.value);
	const validated = validateCompletionCommitSnapshot({
		projectBefore: loaded.value.project.snapshot,
		changeBefore: loaded.value.source.snapshot,
		result: resultSnapshot.value,
		event: event.value,
		changes: treeChanges(delta),
		traceDelta: {path: tracePath(input.changeId), beforeBlob: loaded.value.change.blob, afterBlob: committed.value.traceBlob, prefixPreserved: true},
		authorizedPaths: Object.freeze(delta.map((entry) => entry.path).sort(compareText)),
		reviewedChangeTip: loaded.value.source.snapshot.commit,
		artifactTreeBefore: artifactBefore.value,
		artifactTreeAfter: artifactAfter.value,
	});
	if (!validated.ok) return failure(invalidProject("Completion Commit did not preserve the reviewed project-artifact tree."));
	const cas = await compareAndSwap(environment, [
		{ref: environment.configuration.canonicalRef, expectedOld: loaded.value.project.snapshot.commit, newOid: committed.value.commit},
		{ref: managedChangeRef(input.changeId), expectedOld: loaded.value.source.snapshot.commit, newOid: committed.value.commit},
	], actor.authorizationId, "codewiki: complete Change");
	if (!cas.ok) return cas;
	return changeResult(input.changeId, "completed", "Local Change realization is complete; request any separately authorized protected effect explicitly.", committed.value.commit, cas.value);
}

async function supersedeChange(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: SupersedeChangeInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	if (input.changeId === input.supersedingChangeId) return failure(invalidRequest("A Change cannot supersede itself."));
	const loaded = await authorizedChange(environment, actor, input.changeId);
	if (!loaded.ok) return loaded;
	const digest = canonicalCommandDigest("changes.supersede", input);
	if (!digest.ok) return digest;
	const replay = replaySingle(loaded.value, input.commandId, digest.value, ["change.superseded"]);
	if (replay) return replay;
	const binding = verifyCommandBinding(loaded.value, input.expectedProjectHead, input.expectedChangeTip);
	if (!binding.ok) return binding;
	const replacement = await authorizedChange(environment, actor, input.supersedingChangeId);
	if (!replacement.ok) return replacement;
	if (!sameGitOid(replacement.value.project.snapshot.commit, loaded.value.project.snapshot.commit) || !["committed", "completed"].includes(replacement.value.change.reduced.state) ||
		!replacement.value.change.reduced.change.relationships.some((entry) => entry.kind === "supersedes" && entry.changeId === input.changeId)) {
		return failure(conflict("The named superseding Change is not current accepted supersession authority."));
	}
	const timestamp = lifecycleTimestamp(environment);
	if (!timestamp.ok) return timestamp;
	const event = makeEvent(eventContext(loaded.value, actor, timestamp.value, digest.value), input.commandId, "change.superseded", {
		supersedingChangeId: input.supersedingChangeId,
		supersedingCommit: replacement.value.source.snapshot.commit,
	});
	if (!event.ok) return event;
	const committed = await appendTraceCommit(environment, {
		base: loaded.value.project.snapshot,
		parents: [loaded.value.project.snapshot.commit, loaded.value.source.snapshot.commit],
		trace: loaded.value.change.trace,
		events: [event.value],
		owners: loaded.value.project.eventOwners,
		actor,
		timestamp: timestamp.value,
		message: `codewiki: supersede ${input.changeId}\n`,
	});
	if (!committed.ok) return committed;
	const cas = await compareAndSwap(environment, [
		{ref: environment.configuration.canonicalRef, expectedOld: loaded.value.project.snapshot.commit, newOid: committed.value.commit},
		{ref: managedChangeRef(input.changeId), expectedOld: loaded.value.source.snapshot.commit, newOid: committed.value.commit},
	], actor.authorizationId, "codewiki: record supersession");
	if (!cas.ok) return cas;
	return changeResult(input.changeId, "superseded", "Continue through the accepted superseding Change.", committed.value.commit, cas.value);
}

async function requestProtectedEffect(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: ProtectedEffectInput,
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	const loaded = await authorizedChange(environment, actor, input.changeId);
	if (!loaded.ok) return loaded;
	const digest = canonicalCommandDigest("effects.request", input);
	if (!digest.ok) return digest;
	const replay = replaySingle(loaded.value, input.commandId, digest.value, ["effect.recorded"]);
	if (replay) return replay;
	const binding = verifyCommandBinding(loaded.value, input.expectedProjectHead, input.expectedChangeTip);
	if (!binding.ok) return binding;
	if (loaded.value.change.reduced.state !== "completed") return failure(conflict("Protected effects require a completed local Change."));
	const effect = environment.protectedEffects.find((entry) => entry.capability === input.capability);
	if (!effect || !effect.actorIds.includes(actor.actorId)) return failure(authorizationDenied("This Actor cannot request that protected effect."));
	const effectReceipt = semanticValueDigest("codewiki.protected-effect-receipt@1.0.0", {
		capability: input.capability,
		authorizationId: actor.authorizationId,
		requestDigest: digest.value,
		subjectCommit: loaded.value.project.snapshot.commit,
		expectedEffectHead: input.expectedEffectHead,
	});
	if (!effectReceipt.ok) return failure(internalFailure());
	const timestamp = lifecycleTimestamp(environment);
	if (!timestamp.ok) return timestamp;
	const event = makeEvent(eventContext(loaded.value, actor, timestamp.value, digest.value), input.commandId, "effect.recorded", {
		capability: input.capability,
		authorizationId: actor.authorizationId,
		kernelBuildDigest: environment.configuration.kernelBuildDigest,
		requestDigest: digest.value,
		receiptDigest: effectReceipt.value,
		status: "passed",
		subjectOids: [loaded.value.project.snapshot.commit],
	});
	if (!event.ok) return event;
	const committed = await appendTraceCommit(environment, {
		base: loaded.value.project.snapshot,
		parents: sameGitOid(loaded.value.project.snapshot.commit, loaded.value.source.snapshot.commit)
			? [loaded.value.project.snapshot.commit]
			: [loaded.value.project.snapshot.commit, loaded.value.source.snapshot.commit],
		trace: loaded.value.change.trace,
		events: [event.value],
		owners: loaded.value.project.eventOwners,
		actor,
		timestamp: timestamp.value,
		message: `codewiki: record protected effect ${input.changeId}\n`,
	});
	if (!committed.ok) return committed;
	const lifecycleCas = await compareAndSwap(environment, [
		{ref: effect.ref, expectedOld: input.expectedEffectHead, newOid: loaded.value.project.snapshot.commit},
		{ref: environment.configuration.canonicalRef, expectedOld: loaded.value.project.snapshot.commit, newOid: committed.value.commit},
		{ref: managedChangeRef(input.changeId), expectedOld: loaded.value.source.snapshot.commit, newOid: committed.value.commit},
	], actor.authorizationId, "codewiki: record protected effect");
	if (!lifecycleCas.ok) return lifecycleCas;
	return successResult(
		{changeId: input.changeId, capability: input.capability, status: "passed", nextAction: "Refresh Alignment to inspect the recorded effect outcome.", userActionRequired: false},
		{subjectCommit: loaded.value.project.snapshot.commit, effectReceipt: effectReceipt.value, lifecycleCommit: committed.value.commit, lifecycleCas: lifecycleCas.value.receiptDigest},
	);
}

async function evaluateStage(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: ChangeCommandInput,
	stage: "decision" | "implementation" | "planning" | "review",
	kind: "change" | "plan" | "review" | "work",
	workId: string | null,
	subjectDigest: (loaded: LoadedLifecycleChange) => Sha256Digest | null,
	materials: readonly GateMaterial[] = [],
): Promise<Outcome<LifecycleCommandResult, ProductError>> {
	const operation = (stage === "implementation" ? "work.evaluate" : `${stage}.evaluate`) as ProductCommandOperation;
	const loaded = await authorizedChange(environment, actor, input.changeId);
	if (!loaded.ok) return loaded;
	const digest = canonicalCommandDigest(operation, input);
	if (!digest.ok) return digest;
	const replay = replaySingle(loaded.value, input.commandId, digest.value, ["gate.recorded"]);
	if (replay) return replay;
	const binding = verifyCommandBinding(loaded.value, input.expectedProjectHead, input.expectedChangeTip);
	if (!binding.ok) return binding;
	const state = validateStageState(loaded.value.change.reduced, stage, workId);
	if (!state.ok) return state;
	if (stage === "decision") {
		const revision = latestProposalRevision(loaded.value.change.trace);
		if (!revision || !sameGitOid(revision.expectedProjectHead, loaded.value.project.snapshot.commit)) {
			return failure(reconciliationRequired("Canonical state changed after this proposal; revise it against the current Project before Decision."));
		}
	}
	const semanticSubject = subjectDigest(loaded.value);
	if (semanticSubject === null) return failure(conflict(`The ${stage} subject is not ready.`));
	let artifactCommit: GitOid | null = null;
	let artifactTree: GitOid | null = null;
	let workType: string | null = null;
	if (stage === "implementation") {
		const work = loaded.value.change.reduced.work.find((entry) => entry.work.workId === workId) as ReducedWorkState;
		const attempt = work.attempts.at(-1) as NonNullable<ReducedWorkState["attempts"][number]>;
		artifactCommit = attempt.resultCommit;
		artifactTree = attempt.resultTree;
		workType = work.work.workType;
	} else if (stage === "review") {
		artifactCommit = loaded.value.source.snapshot.commit;
		artifactTree = loaded.value.change.reduced.review?.reconciliation.prospectiveTree ?? null;
	}
	const subject = createGateSubject({
		kind,
		repositoryId: environment.configuration.repositoryId,
		changeId: input.changeId,
		workId,
		projectCommit: loaded.value.project.snapshot.commit,
		projectTree: loaded.value.project.snapshot.tree,
		changeTip: loaded.value.source.snapshot.commit,
		artifactCommit,
		artifactTree,
		facts: Object.freeze({
			"codewiki.fact:stage": stage,
			"codewiki.fact:change-type": loaded.value.change.reduced.change.changeType,
			"codewiki.fact:realization": loaded.value.change.reduced.change.realization,
		}),
		subjectDigest: semanticSubject,
	});
	if (!subject.ok) return failure(invalidProject("The exact Gate subject is malformed."));
	const bundle = await evaluateGate(environment, {
		stage,
		subject: subject.value,
		change: loaded.value.change.reduced.change,
		workType,
		commandId: input.commandId,
		commandDigest: digest.value,
		actor,
		materials,
	});
	if (!bundle.ok) return bundle;
	const timestamp = lifecycleTimestamp(environment);
	if (!timestamp.ok) return timestamp;
	const payload = gateEventPayload(bundle.value, workId);
	const event = makeEvent(eventContext(loaded.value, actor, timestamp.value, digest.value), input.commandId, "gate.recorded", payload);
	if (!event.ok) return event;
	const moved = await appendAndMoveChange(environment, actor, loaded.value, [event.value], timestamp.value, `codewiki: record ${stage} Gate ${input.changeId}\n`);
	if (!moved.ok) return moved;
	const status = bundle.value.outcome.status;
	const data = workId === null
		? {changeId: input.changeId, stage, status, nextAction: gateNextAction(stage, status), userActionRequired: status === "failed"}
		: {changeId: input.changeId, workId, stage, status, nextAction: gateNextAction(stage, status), userActionRequired: status === "failed"};
	return successResult(
		data,
		{changeCommit: moved.value.commit, gateDigest: bundle.value.gate.gateDigest, outcomeDigest: bundle.value.outcome.outcomeDigest, runDigests: bundle.value.runs.map((entry) => entry.runDigest), resultDigests: bundle.value.results.map((entry) => entry.resultDigest), cas: moved.value.cas.receiptDigest},
	);
}

function validateStageState(
	change: ReducedChange,
	stage: "decision" | "implementation" | "planning" | "review",
	workId: string | null,
): Outcome<true, ProductError> {
	if (stage === "decision") return change.state === "proposed" ? success(true) : failure(conflict("Decision Checks require a proposed Change."));
	if (change.state !== "committed" || change.change.realization !== "project") return failure(conflict(`${stage} Checks require a committed project-realization Change.`));
	if (stage === "planning") return success(true);
	if (stage === "review") return change.review !== null ? success(true) : failure(conflict("Review Checks require current canonical reconciliation."));
	const work = change.work.find((entry) => entry.work.workId === workId);
	return work && work.attempts.length > 0 && work.integration === null
		? success(true)
		: failure(conflict("Implementation Checks require one current unintegrated Work result."));
}

async function prepareWikiPatch(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	before: WikiMaterialization,
	patch: WikiPatchInput,
): Promise<Outcome<PreparedWikiPatch, ProductError>> {
	const bytesByPath = new Map<string, Uint8Array>();
	for (const file of before.items) {
		const blob = await environment.store.readBlob({
			repositoryId: environment.configuration.repositoryId,
			objectFormat: environment.configuration.objectFormat,
			commit: before.source.snapshot.commit,
			path: file.path,
			maximumBytes: environment.configuration.limits.maximumWikiFileBytes,
		});
		if (!blob.ok || !sameGitOid(blob.value.oid, file.blob)) return failure(invalidProject("Current Wiki bytes are unavailable or inconsistent."));
		bytesByPath.set(file.path, blob.value.bytes);
	}
	for (const path of patch.deletes) bytesByPath.delete(path);
	const mutations: ProjectStoreTreeMutation[] = patch.deletes.map((path) =>
		Object.freeze({path, mode: null, kind: null, oid: null}));
	const upsertOids = new Map<string, GitOid>();
	for (const upsert of patch.upserts) {
		const bytes = new TextEncoder().encode(upsert.content);
		const blob = await writeBlob(environment, bytes, actor.authorizationId);
		if (!blob.ok) return blob;
		const decoded = decodeWikiFile({path: upsert.path, mode: "100644", blob: blob.value, bytes});
		if (!decoded.ok) return failure(invalidRequest("Proposed Wiki file is invalid."));
		bytesByPath.set(upsert.path, bytes);
		upsertOids.set(upsert.path, blob.value);
		mutations.push(Object.freeze({path: upsert.path, mode: "100644", kind: "blob", oid: blob.value}));
	}
	const currentByPath = new Map(before.items.map((entry) => [entry.path, entry]));
	const entries: WikiFileInput[] = [...bytesByPath.entries()].map(([path, bytes]) => Object.freeze({
		path,
		mode: "100644",
		blob: upsertOids.get(path) ?? currentByPath.get(path)?.blob as GitOid,
		bytes,
	})).sort((left, right) => compareText(left.path, right.path));
	const after = validateWikiTree({
		snapshot: before.source.snapshot,
		kernelBuildDigest: before.source.kernelBuildDigest,
		entries,
		retiredItemIds: before.retiredItemIds,
	});
	if (!after.ok) return failure(invalidRequest("Proposed Wiki bytes do not form a complete valid Wiki state."));
	const transaction = validateWikiTransaction({before, after: after.value});
	if (!transaction.ok) return failure(invalidRequest(`Proposed Wiki transaction is invalid or incomplete: ${transaction.error.message}`));
	const owners = eventOwnership(after.value);
	if (!owners.ok) return owners;
	mutations.sort((left, right) => compareText(left.path, right.path));
	return success(Object.freeze({mutations: Object.freeze(mutations), transaction: transaction.value, owners: owners.value}));
}

function validateProposalScope(
	change: Change,
	transaction: ValidatedWikiTransaction,
	before: WikiMaterialization,
	actor: AuthorizedProjectActor,
): Outcome<true, ProductError> {
	const targets = new Set(change.targets.map((entry) => entry.itemId));
	const liveIds = new Set([...before.items.map((entry) => entry.item.itemId), ...transaction.after.items.map((entry) => entry.item.itemId)]);
	if (change.targets.some((entry) => !liveIds.has(entry.itemId))) return failure(invalidRequest("Change target references an absent Wiki Item."));
	const changedIds = transaction.changes.map((entry) => entry.itemId);
	if (changedIds.some((itemId) => !targets.has(itemId))) return failure(invalidRequest("Every proposed Wiki mutation must be declared as a Change target."));
	if (change.realization === "wiki-only" && (changedIds.length === 0 || change.targets.some((entry) => !changedIds.includes(entry.itemId)))) {
		return failure(invalidRequest("Wiki-only Change targets must all be realized by its exact Wiki transaction."));
	}
	if (actor.wikiItemIds !== null && (change.targets.some((entry) => !actor.wikiItemIds?.includes(entry.itemId)) || changedIds.some((itemId) => !actor.wikiItemIds?.includes(itemId)))) {
		return failure(authorizationDenied("The proposal includes Wiki Items outside this Actor's visible scope."));
	}
	return success(true);
}

function materializeChange(
	repositoryId: string,
	changeId: string,
	revision: number,
	proposal: ProposalInput | Omit<ProposalInput, "proposalKey">,
	ids: ReadonlyMap<string, string>,
): Outcome<Change, ProductError> {
	const relationships: ChangeRelation[] = [];
	for (const relationship of proposal.relationships) {
		const targetChangeId = relationship.target.kind === "change" ? relationship.target.changeId : ids.get(relationship.target.proposalKey);
		if (!targetChangeId) return failure(invalidRequest("Proposal relationship references an absent request-local key."));
		relationships.push(Object.freeze({kind: relationship.type, changeId: targetChangeId}));
	}
	relationships.sort((left, right) => compareText(`${left.kind}\0${left.changeId}`, `${right.kind}\0${right.changeId}`));
	const targets: ChangeTarget[] = proposal.targets.map((entry) => Object.freeze({itemId: entry.itemId, facets: entry.facets}));
	const created = createChange({
		changeId,
		repositoryId,
		revision,
		changeType: proposal.changeType,
		realization: proposal.realization,
		intent: proposal.intent,
		rationale: proposal.rationale,
		acceptance: proposal.acceptance,
		targets,
		relationships,
		contributorRefs: proposal.contributorRefs,
		producerRunRefs: proposal.producerRunRefs,
	});
	return created.ok ? success(created.value) : failure(invalidRequest("Proposal does not satisfy the governed Change contract."));
}

function materializePlan(
	changeId: string,
	input: readonly PlanWorkInput[],
): Outcome<Readonly<{work: readonly Work[]; digest: Sha256Digest}>, ProductError> {
	const byOrdinal = new Map(input.map((entry) => [entry.ordinal, derivedWorkId(changeId, entry.ordinal)]));
	const work: Work[] = [];
	for (const entry of input) {
		if (entry.dependencyOrdinals.some((ordinal) => !byOrdinal.has(ordinal))) return failure(invalidRequest("Work dependency ordinal is absent from the exact plan."));
		const created = createWork({
			changeId,
			ordinal: entry.ordinal,
			workType: entry.workType,
			targets: entry.targets,
			writablePaths: entry.writablePaths,
			dependencies: entry.dependencyOrdinals.map((ordinal) => byOrdinal.get(ordinal) as string).sort(compareText),
			capabilities: entry.capabilities,
			acceptance: entry.acceptance,
		});
		if (!created.ok || created.value.workId !== byOrdinal.get(entry.ordinal)) return failure(invalidRequest("Work plan contains an invalid Work Unit."));
		work.push(created.value);
	}
	const validated = validateWorkPlan(changeId, work);
	if (!validated.ok) return failure(invalidRequest(validated.error.message));
	const digest = workPlanDigest(validated.value);
	return digest.ok ? success(Object.freeze({work: validated.value, digest: digest.value})) : failure(internalFailure());
}

function validatePlanCoverage(change: Change, work: readonly Work[]): Outcome<true, ProductError> {
	const changeTargets = change.targets.map(targetKey).sort(compareText);
	const workTargets = [...new Set(work.flatMap((entry) => entry.targets.map(targetKey)))].sort(compareText);
	return sameText(changeTargets, workTargets)
		? success(true)
		: failure(invalidRequest("Work plan must cover every exact Change target and no unrelated target."));
}

function makeEvent(
	context: EventContext,
	commandId: string,
	kind: ChangeEventKind,
	payload: ChangeEventPayload,
): Outcome<ChangeEvent, ProductError> {
	const ownerItemId = context.owners[kind];
	if (!ownerItemId) return failure(invalidProject("Semantic event ownership is incomplete."));
	const event = createChangeEvent({
		kind,
		ownerItemId,
		actorId: context.actor.actorId,
		authorityId: context.actor.authorizationId,
		commandId,
		commandDigest: context.commandDigest,
		occurredAt: context.timestamp,
		expectedProjectHead: context.expectedProjectHead,
		expectedChangeTip: context.expectedChangeTip,
		predecessorEventDigest: context.trace.events.at(-1)?.eventDigest ?? null,
		payload,
	}, context.owners);
	return event.ok ? success(event.value) : failure(invalidProject("Lifecycle event could not be created."));
}

function makeEventSequence(
	context: EventContext,
	specifications: readonly Readonly<{commandId: string; kind: ChangeEventKind; payload: ChangeEventPayload}>[],
): Outcome<readonly ChangeEvent[], ProductError> {
	const output: ChangeEvent[] = [];
	let trace = context.trace;
	for (const specification of specifications) {
		const event = makeEvent({...context, trace}, specification.commandId, specification.kind, specification.payload);
		if (!event.ok) return event;
		output.push(event.value);
		trace = traceWithEvent(trace, event.value);
	}
	return success(Object.freeze(output));
}

function eventContext(
	loaded: LoadedLifecycleChange,
	actor: AuthorizedProjectActor,
	timestamp: string,
	commandDigest: Sha256Digest,
): EventContext {
	return Object.freeze({
		trace: loaded.change.trace,
		owners: loaded.project.eventOwners,
		actor,
		expectedProjectHead: loaded.project.snapshot.commit,
		expectedChangeTip: loaded.source.snapshot.commit,
		timestamp,
		commandDigest,
	});
}

async function appendAndMoveChange(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	loaded: LoadedLifecycleChange,
	events: readonly ChangeEvent[],
	timestamp: string,
	message: string,
): Promise<Outcome<Readonly<{commit: GitOid; cas: ProjectStoreCasReceipt}>, ProductError>> {
	const committed = await appendTraceCommit(environment, {
		base: loaded.source.snapshot,
		parents: [loaded.source.snapshot.commit],
		trace: loaded.change.trace,
		events,
		owners: loaded.project.eventOwners,
		actor,
		timestamp,
		message,
	});
	if (!committed.ok) return committed;
	const cas = await moveChangeRef(environment, actor, loaded.change.trace.header.changeId, loaded.source.snapshot.commit, committed.value.commit, "codewiki: advance Change lifecycle");
	return cas.ok ? success(Object.freeze({commit: committed.value.commit, cas: cas.value})) : cas;
}

async function moveChangeRef(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	changeId: string,
	expectedOld: GitOid,
	newOid: GitOid,
	message: string,
): Promise<Outcome<ProjectStoreCasReceipt, ProductError>> {
	return compareAndSwap(environment, [{ref: managedChangeRef(changeId), expectedOld, newOid}], actor.authorizationId, message);
}

async function authorizedChange(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	changeId: string,
): Promise<Outcome<LoadedLifecycleChange, ProductError>> {
	if (actor.changeIds !== null && !actor.changeIds.includes(changeId)) return failure(authorizationDenied());
	return loadLifecycleChange(environment, changeId);
}

function replaySingle(
	loaded: LoadedLifecycleChange,
	commandId: string,
	commandDigest: Sha256Digest,
	kinds: readonly ChangeEventKind[],
): Outcome<LifecycleCommandResult, ProductError> | null {
	const event = commandAlreadyRecorded(loaded.change.trace, commandId);
	if (!event) return null;
	if (event.commandDigest !== commandDigest || !kinds.includes(event.kind)) {
		return failure(productError("idempotency_conflict", "That command identity already names different lifecycle input.", "Submit unchanged input or use a new command identity.", true));
	}
	return successResult(
		{changeId: loaded.change.trace.header.changeId, status: loaded.change.reduced.state, nextAction: "Refresh this Change to continue from its recorded state.", userActionRequired: false},
		{replayed: true, eventDigest: event.eventDigest, changeTip: loaded.source.snapshot.commit, projectHead: loaded.project.snapshot.commit},
	);
}

async function replayProposalBatch(
	environment: LocalLifecycleEnvironment,
	actor: AuthorizedProjectActor,
	input: ProposeChangesInput,
	commandDigest: Sha256Digest,
	ids: ReadonlyMap<string, string>,
): Promise<Outcome<LifecycleCommandResult, ProductError> | null> {
	const existing: LoadedLifecycleChange[] = [];
	let absent = 0;
	for (const proposal of input.proposals) {
		const changeId = ids.get(proposal.proposalKey) as string;
		const snapshot = await environment.store.readSnapshot({
			repositoryId: environment.configuration.repositoryId,
			objectFormat: environment.configuration.objectFormat,
			selector: {kind: "ref", ref: managedChangeRef(changeId)},
		});
		if (!snapshot.ok) {
			if (snapshot.error.code === "not_found") absent += 1;
			else return failure(invalidProject("Proposal identities could not be reconciled."));
			continue;
		}
		const loaded = await authorizedChange(environment, actor, changeId);
		if (!loaded.ok) return loaded;
		existing.push(loaded.value);
	}
	if (existing.length === 0) return null;
	if (absent !== 0 || existing.length !== input.proposals.length) return failure(invalidProject("Atomic proposal admission is incomplete."));
	for (const proposal of input.proposals) {
		const changeId = ids.get(proposal.proposalKey) as string;
		const loaded = existing.find((entry) => entry.change.trace.header.changeId === changeId) as LoadedLifecycleChange;
		const event = commandAlreadyRecorded(loaded.change.trace, eventCommandId(input.commandId, proposal.proposalKey));
		if (!event || event.kind !== "change.proposed" || event.commandDigest !== commandDigest) return failure(productError("idempotency_conflict", "Proposal command identity already names different input.", "Use the original input or a new command identity.", true));
	}
	return successResult(
		{changes: input.proposals.map((proposal) => ({changeId: ids.get(proposal.proposalKey), status: "proposed"})), nextAction: "Review each proposed Change independently and run its Decision Checks.", userActionRequired: false},
		{replayed: true, changeTips: existing.map((entry) => ({changeId: entry.change.trace.header.changeId, commit: entry.source.snapshot.commit}))},
	);
}

async function verifyGateBundle(
	facts: ProjectServerFactsPort,
	repositoryId: string,
	gate: ReducedGateFact,
): Promise<Outcome<GateBundle, ProductError>> {
	const bundle = await facts.readGateBundle({repositoryId, gateDigest: gate.gateDigest});
	if (!bundle.ok) return failure(productError("operation_unknown", "Required Gate facts are unavailable.", "Reconcile immutable Check facts before this authority-changing action.", true));
	if (bundle.value.gate.gateDigest !== gate.gateDigest || bundle.value.outcome.outcomeDigest !== gate.outcomeDigest || bundle.value.outcome.status !== gate.status) {
		return failure(invalidProject("Stored Gate facts contradict the governed Change Trace."));
	}
	return success(bundle.value);
}

function latestPassedGate(change: ReducedChange, stage: ReducedGateFact["stage"], workId: string | null): ReducedGateFact | null {
	for (let index = change.gates.length - 1; index >= 0; index -= 1) {
		const gate = change.gates[index];
		if (gate?.stage === stage && gate.workId === workId) return gate.status === "passed" ? gate : null;
	}
	return null;
}

function gateEventPayload(bundle: GateBundle, workId: string | null): GateRecordedPayload {
	return Object.freeze({
		gateDigest: bundle.gate.gateDigest,
		outcomeDigest: bundle.outcome.outcomeDigest,
		stage: bundle.gate.stage,
		status: bundle.outcome.status,
		subjectDigest: bundle.gate.subject.subjectDigest,
		workId,
		runDigests: Object.freeze(bundle.runs.map((entry) => entry.runDigest).sort(compareText)),
		resultDigests: Object.freeze(bundle.results.map((entry) => entry.resultDigest).sort(compareText)),
		evidenceDigests: Object.freeze([...new Set(bundle.results.flatMap((entry) => entry.evidence.map((evidence) => evidence.referenceDigest)))].sort(compareText)),
	});
}

function currentWork(change: ReducedChange, workId: string): Outcome<ReducedWorkState, ProductError> {
	const work = change.work.find((entry) => entry.work.workId === workId);
	return work ? success(work) : failure(productError("not_found", "That Work Unit is unavailable.", "Refresh Work and choose a current Work Unit.", false));
}

async function verifyTraceBase(
	environment: LocalLifecycleEnvironment,
	loaded: LoadedLifecycleChange,
	baseCommit: GitOid,
): Promise<Outcome<true, ProductError>> {
	const base = await environment.store.readBlob({
		repositoryId: environment.configuration.repositoryId,
		objectFormat: environment.configuration.objectFormat,
		commit: baseCommit,
		path: tracePath(loaded.change.trace.header.changeId),
		maximumBytes: environment.configuration.limits.maximumTraceBytes,
	});
	if (!base.ok) return failure(invalidProject("Work result base does not contain the governed Change Trace."));
	const current = canonicalTraceText(loaded.change.trace, loaded.project.eventOwners);
	if (!current.ok) return current;
	let baseText: string;
	try {
		baseText = new TextDecoder("utf-8", {fatal: true}).decode(base.value.bytes);
	} catch {
		return failure(invalidProject("Work result base Trace is malformed."));
	}
	return current.value.startsWith(baseText) ? success(true) : failure(invalidProject("Work result base is not a known immutable Change Trace prefix."));
}

function canonicalTraceText(trace: ChangeTrace, owners: SemanticEventOwners): Outcome<string, ProductError> {
	const values = [trace.header, ...trace.events];
	const lines: string[] = [];
	for (const value of values) {
		const encoded = canonicalJson(value);
		if (!encoded.ok) return failure(invalidProject("Change Trace contains non-canonical facts."));
		lines.push(encoded.value);
	}
	void owners;
	return success(`${lines.join("\n")}\n`);
}

async function validateChangeCommit(
	environment: LocalLifecycleEnvironment,
	loaded: LoadedLifecycleChange,
	result: Readonly<{commit: GitOid; tree: GitOid; traceBlob: GitOid}>,
	event: ChangeEvent,
	_proposalDelta: readonly TreeDeltaEntry[],
): Promise<Outcome<true, ProductError>> {
	const snapshot = await readSnapshotOid(environment, result.commit);
	if (!snapshot.ok) return snapshot;
	const changeEntries = await readTreeEntries(environment, loaded.source.snapshot);
	if (!changeEntries.ok) return changeEntries;
	const resultEntries = await readTreeEntries(environment, snapshot.value);
	if (!resultEntries.ok) return resultEntries;
	const delta = diffTreeEntries(changeEntries.value, resultEntries.value);
	if (delta.some((entry) => entry.path !== tracePath(loaded.change.trace.header.changeId) && !entry.path.startsWith(".codewiki/wiki/"))) return failure(invalidProject("Change Commit includes a path outside exact Wiki/Trace authorization."));
	const checked = validateChangeCommitSnapshot({
		projectBefore: loaded.project.snapshot,
		changeBefore: loaded.source.snapshot,
		result: snapshot.value,
		event,
		changes: treeChanges(delta),
		traceDelta: {path: tracePath(loaded.change.trace.header.changeId), beforeBlob: loaded.change.blob, afterBlob: result.traceBlob, prefixPreserved: true},
		authorizedPaths: Object.freeze(delta.map((entry) => entry.path).sort(compareText)),
		wikiIdentityClosure: true,
		wikiRelationshipClosure: true,
		fullTreeMaterialized: true,
	});
	return checked.ok ? success(true) : failure(invalidProject("Change Commit failed exact snapshot validation."));
}

async function readSnapshotOid(
	environment: LifecycleRepositoryEnvironment,
	oid: GitOid,
): Promise<Outcome<ProjectSnapshot, ProductError>> {
	const result = await environment.store.readSnapshot({
		repositoryId: environment.configuration.repositoryId,
		objectFormat: environment.configuration.objectFormat,
		selector: {kind: "oid", oid},
	});
	return result.ok ? success(result.value) : failure(invalidProject("Required Project snapshot is unavailable."));
}

function treeChanges(delta: readonly TreeDeltaEntry[]): readonly TreeChange[] {
	return Object.freeze(delta.map((entry) => Object.freeze({
		path: entry.path,
		kind: treeChangeKind(entry),
		before: entry.before?.oid ?? null,
		after: entry.after?.oid ?? null,
	})));
}

function treeChangeKind(entry: TreeDeltaEntry): TreeChange["kind"] {
	if (entry.before === null) return "added";
	if (entry.after === null) return "deleted";
	return entry.before.mode === entry.after.mode ? "modified" : "mode_changed";
}

function isProjectArtifactDelta(entry: TreeDeltaEntry): boolean {
	return !entry.path.startsWith(".codewiki/") && !entry.path.startsWith("check-packs/");
}

function applyDeltaEntries(
	base: readonly ProjectStoreTreeEntry[],
	delta: readonly TreeDeltaEntry[],
): readonly ProjectStoreTreeEntry[] {
	const output = new Map(base.map((entry) => [entry.path, entry]));
	for (const entry of delta) {
		if (entry.after === null) output.delete(entry.path);
		else output.set(entry.path, entry.after);
	}
	return Object.freeze([...output.values()].sort((left, right) => compareText(left.path, right.path)));
}

function eventOwnership(wiki: WikiMaterialization): Outcome<SemanticEventOwners, ProductError> {
	const ownership: ComponentOwnership[] = [];
	for (const file of wiki.items) {
		const decoded = decodeComponentOwnership(file.item.itemId, file.item.attributes);
		if (!decoded.ok) return failure(invalidProject("Wiki component ownership is invalid."));
		if (decoded.value !== null) ownership.push(decoded.value);
	}
	const built = buildSemanticEventOwnership(ownership, CHANGE_EVENT_KINDS);
	return built.ok ? success(built.value) : failure(invalidProject("Wiki semantic event ownership is incomplete."));
}

function traceWithEvent(trace: ChangeTrace, event: ChangeEvent): ChangeTrace {
	return Object.freeze({...trace, events: Object.freeze([...trace.events, event])});
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

function changeIdentity(repositoryId: string, actorId: string, commandId: string, proposalKey: string): string {
	const digest = canonicalValueDigest({repositoryId, actorId, commandId, proposalKey});
	if (!digest.ok) throw new Error("Invariant: Change identity input must be canonical.");
	return `CHG-${digest.value.slice(7, 47)}`;
}

function derivedWorkId(changeId: string, ordinal: number): string {
	const identity = workIdentity(changeId, ordinal);
	if (!identity.ok) throw new Error("Invariant: Work identity must be derivable.");
	return identity.value;
}

function derivedId(prefix: string, value: unknown): string {
	const digest = canonicalValueDigest(value);
	if (!digest.ok) throw new Error("Invariant: semantic identity input must be canonical.");
	return `${prefix}:${digest.value.slice(7, 47)}`;
}

function semanticValueDigest(protocol: string, value: unknown): Outcome<Sha256Digest, ProductError> {
	const canonical = decodeCanonicalValue(value);
	if (!canonical.ok) return failure(internalFailure());
	const digest = semanticDigest(protocol, canonical.value);
	return digest.ok ? success(digest.value) : failure(internalFailure());
}

function lastEvent(trace: ChangeTrace, kind: ChangeEventKind): ChangeEvent | undefined {
	for (let index = trace.events.length - 1; index >= 0; index -= 1) {
		const event = trace.events[index];
		if (event?.kind === kind) return event;
	}
	return undefined;
}

function latestProposalRevision(trace: ChangeTrace): ChangeEvent | undefined {
	for (let index = trace.events.length - 1; index >= 0; index -= 1) {
		const event = trace.events[index];
		if (event?.kind === "change.proposed" || event?.kind === "change.revised") return event;
	}
	return undefined;
}

function targetKey(target: Readonly<{itemId: string; facets: readonly string[]}>): string {
	return `${target.itemId}\0${target.facets.join("\0")}`;
}

function sameOwners(left: SemanticEventOwners, right: SemanticEventOwners): boolean {
	const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort(compareText);
	return keys.every((key) => left[key] === right[key]);
}

function sameTreeSide(left: ProjectStoreTreeEntry | null, right: ProjectStoreTreeEntry | null): boolean {
	return left === null ? right === null : right !== null && left.mode === right.mode && left.kind === right.kind && sameGitOid(left.oid, right.oid);
}

function sameOptionalOid(left: GitOid | null, right: GitOid): boolean {
	return left !== null && sameGitOid(left, right);
}

function sameText(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function gateNextAction(stage: string, status: GateBundle["outcome"]["status"]): string {
	if (status === "failed") return `Address ${stage} feedback and submit a fresh exact stage subject.`;
	if (status === "stopped") return `Reconcile stopped ${stage} Checks before another semantic attempt.`;
	if (stage === "decision") return "Choose commit, reject, defer, or withdraw for this exact proposed Change.";
	if (stage === "planning") return "Admit this exact passing Work plan.";
	if (stage === "implementation") return "Integrate this exact passing Work result.";
	return "Complete this exact reviewed Change while canonical state remains unchanged.";
}

function changeResult(
	changeId: string,
	status: string,
	nextAction: string,
	commit: GitOid,
	cas: ProjectStoreCasReceipt,
): Outcome<LifecycleCommandResult, ProductError> {
	return successResult({changeId, status, nextAction, userActionRequired: false}, {changeCommit: commit, cas: cas.receiptDigest});
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

function reconciliationRequired(message: string): ProductError {
	return productError("reconciliation_required", message, "Reconcile exact canonical and Change bytes, then run fresh affected Checks.", true);
}

function gateRequired(stage: string): ProductError {
	return productError("gate_failed", `A current passing ${stage} Gate is required.`, `Run fresh ${stage} Checks for the exact current subject.`, true);
}

function internalFailure(): ProductError {
	return productError("internal_failure", "The lifecycle action could not be prepared safely.", "Retry after the Project service is healthy.", false);
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
