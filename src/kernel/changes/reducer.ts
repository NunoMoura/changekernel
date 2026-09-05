import {failure, success, type Outcome} from "../canonical/outcome.ts";
import {sameGitOid, type GitOid} from "../identity/git.ts";
import {semanticDigest} from "../identity/semantic-digest.ts";
import type {Sha256Digest} from "../identity/sha256.ts";
import {workScopesConflict, type Work} from "../work/contracts.ts";
import type {Change} from "./contracts.ts";
import type {
	ChangeEvent,
	CommittedPayload,
	CompletedPayload,
	DecisionPayload,
	EffectRecordedPayload,
	GateRecordedPayload,
	PlannedPayload,
	ProposedPayload,
	ReviewReconciledPayload,
	SupersededPayload,
	WorkAssignedPayload,
	WorkAttemptPayload,
	WorkClaimedPayload,
	WorkIntegratedPayload,
} from "./events.ts";
import type {ChangeTrace} from "./trace.ts";

export type ChangeLifecycleState = "committed" | "completed" | "deferred" | "proposed" | "rejected" | "superseded" | "withdrawn";

export interface ReducedGateFact extends GateRecordedPayload {
	readonly expectedProjectHead: GitOid;
	readonly expectedChangeTip: GitOid;
	readonly implementationResultCommit: GitOid | null;
	readonly implementationResultTree: GitOid | null;
	readonly eventDigest: Sha256Digest;
}

export interface ReducedWorkState {
	readonly work: Work;
	readonly claims: readonly WorkClaimedPayload[];
	readonly assignments: readonly WorkAssignedPayload[];
	readonly attempts: readonly WorkAttemptPayload[];
	readonly integration: WorkIntegratedPayload | null;
	readonly status: "assigned" | "claimed" | "integrated" | "planned" | "result_recorded";
}

export interface ReducedReview {
	readonly reconciliation: ReviewReconciledPayload;
	readonly gate: ReducedGateFact | null;
}

export interface ReducedChange {
	readonly traceId: string;
	readonly change: Change;
	readonly state: ChangeLifecycleState;
	readonly committedWikiTree: GitOid | null;
	readonly work: readonly ReducedWorkState[];
	readonly gates: readonly ReducedGateFact[];
	readonly review: ReducedReview | null;
	readonly completionTree: GitOid | null;
	readonly supersedingChangeId: string | null;
	readonly effects: readonly EffectRecordedPayload[];
	readonly latestEventDigest: Sha256Digest;
	readonly traceDigest: Sha256Digest;
	readonly stateDigest: Sha256Digest;
}

export interface ChangeReductionIssue {
	readonly code: "duplicate_identity" | "invalid_transition" | "reduction_failed";
	readonly eventIndex: number;
	readonly message: string;
}

interface MutableWorkState {
	work: Work;
	claims: WorkClaimedPayload[];
	assignments: WorkAssignedPayload[];
	attempts: WorkAttemptPayload[];
	integration: WorkIntegratedPayload | null;
}

interface ReductionState {
	change: Change | null;
	state: ChangeLifecycleState | null;
	committedWikiTree: GitOid | null;
	work: Map<string, MutableWorkState>;
	gates: ReducedGateFact[];
	review: ReducedReview | null;
	completionTree: GitOid | null;
	supersedingChangeId: string | null;
	effects: EffectRecordedPayload[];
}

export function reduceChangeTrace(trace: ChangeTrace): Outcome<ReducedChange, ChangeReductionIssue> {
	if (trace.events.length === 0) return failure(issue(0, "Change Trace has no proposal event."));
	const state: ReductionState = {
		change: null,
		state: null,
		committedWikiTree: null,
		work: new Map(),
		gates: [],
		review: null,
		completionTree: null,
		supersedingChangeId: null,
		effects: [],
	};
	const commandIds = new Set<string>();
	for (let index = 0; index < trace.events.length; index += 1) {
		const event = trace.events[index];
		if (!event) return failure(issue(index, "Trace event is absent."));
		if (index === 0 ? event.expectedChangeTip !== null : event.expectedChangeTip === null) {
			return failure(issue(index, "Only first proposal event may have a null expected Change tip."));
		}
		if (commandIds.has(event.commandId)) return failure(issue(index, "Change Event command identity is duplicated.", "duplicate_identity"));
		commandIds.add(event.commandId);
		const reduced = applyEvent(state, event, index);
		if (!reduced.ok) return reduced;
	}
	if (!state.change || !state.state) return failure(issue(trace.events.length, "Change Trace did not establish Change state."));
	return materialize(trace, state.change, state.state, state);
}

function applyEvent(state: ReductionState, event: ChangeEvent, index: number): Outcome<null, ChangeReductionIssue> {
	switch (event.kind) {
		case "change.proposed":
			return propose(state, event.payload as ProposedPayload, index);
		case "change.revised":
			return revise(state, event.payload as ProposedPayload, index);
		case "gate.recorded":
			return recordGate(state, event, event.payload as GateRecordedPayload, index);
		case "change.deferred":
			return decide(state, "deferred", event.payload as DecisionPayload, index);
		case "change.rejected":
			return decide(state, "rejected", event.payload as DecisionPayload, index);
		case "change.withdrawn":
			return decide(state, "withdrawn", event.payload as DecisionPayload, index);
		case "change.resumed":
			return resume(state, index);
		case "change.committed":
			return commit(state, event.payload as CommittedPayload, index);
		case "change.planned":
			return plan(state, event.payload as PlannedPayload, index);
		case "work.claimed":
			return claimWork(state, event.payload as WorkClaimedPayload, index);
		case "work.assigned":
			return assignWork(state, event.payload as WorkAssignedPayload, index);
		case "work.attempt.recorded":
			return recordAttempt(state, event.payload as WorkAttemptPayload, index);
		case "work.integrated":
			return integrateWork(state, event.payload as WorkIntegratedPayload, index);
		case "review.reconciled":
			return reconcile(state, event.payload as ReviewReconciledPayload, index);
		case "change.completed":
			return complete(state, event.payload as CompletedPayload, index);
		case "change.superseded":
			return supersede(state, event.payload as SupersededPayload, index);
		case "effect.recorded":
			return recordEffect(state, event.payload as EffectRecordedPayload, index);
		default:
			return failure(issue(index, "Change Event kind has no reducer.", "invalid_transition"));
	}
}

function propose(state: ReductionState, payload: ProposedPayload, index: number): Outcome<null, ChangeReductionIssue> {
	if (state.state !== null) return failure(issue(index, "change.proposed must be first."));
	state.change = payload.change;
	state.state = "proposed";
	return success(null);
}

function revise(state: ReductionState, payload: ProposedPayload, index: number): Outcome<null, ChangeReductionIssue> {
	if (state.state !== "proposed" || !state.change) return failure(issue(index, "Only proposed Change may be revised."));
	if (
		payload.change.changeId !== state.change.changeId ||
		payload.change.repositoryId !== state.change.repositoryId ||
		payload.change.revision !== state.change.revision + 1
	) return failure(issue(index, "Change revision must preserve identity and increment exactly once."));
	state.change = payload.change;
	invalidateDecisionFacts(state);
	return success(null);
}

function recordGate(
	state: ReductionState,
	event: ChangeEvent,
	payload: GateRecordedPayload,
	index: number,
): Outcome<null, ChangeReductionIssue> {
	if (state.state === null || isTerminalProposalState(state.state) || state.state === "superseded") {
		return failure(issue(index, "Gate cannot be recorded in current Change state."));
	}
	if (state.gates.some((gate) => gate.gateDigest === payload.gateDigest || gate.outcomeDigest === payload.outcomeDigest ||
		gate.runDigests.some((digest) => payload.runDigests.includes(digest)) || gate.resultDigests.some((digest) => payload.resultDigests.includes(digest)))) {
		return failure(issue(index, "Gate, outcome, Run, or Result identity is duplicated."));
	}
	if (payload.stage === "decision" && state.state !== "proposed") return failure(issue(index, "Decision Gate requires proposed Change."));
	if (payload.stage !== "decision" && state.state !== "committed") return failure(issue(index, `${payload.stage} Gate requires committed Change.`));
	if (payload.stage !== "implementation" && payload.workId !== null) return failure(issue(index, "Only Implementation Gate may target Work."));
	if (payload.stage === "decision" && payload.subjectDigest !== state.change?.changeDigest) return failure(issue(index, "Decision Gate must target current Change identity."));
	if (payload.stage === "planning" && state.change?.realization !== "project") return failure(issue(index, "Wiki-only Change has no Planning Gate."));
	let implementationResultCommit: GitOid | null = null;
	let implementationResultTree: GitOid | null = null;
	if (payload.stage === "implementation") {
		const work = state.work.get(payload.workId ?? "");
		const attempt = work?.attempts.at(-1);
		if (!work || !attempt || work.integration !== null) return failure(issue(index, "Implementation Gate requires current unintegrated Work result."));
		if (payload.subjectDigest !== work.work.workDigest) return failure(issue(index, "Implementation Gate must target current Work identity."));
		implementationResultCommit = attempt.resultCommit;
		implementationResultTree = attempt.resultTree;
	}
	if (payload.stage === "review" && state.review === null) return failure(issue(index, "Review Gate requires current reconciliation."));
	if (payload.stage === "review" && payload.subjectDigest !== state.review?.reconciliation.reviewSubjectDigest) return failure(issue(index, "Review Gate subject differs from current reconciliation."));
	if (event.expectedChangeTip === null) return failure(issue(index, "Gate requires exact current Change tip."));
	state.gates.push(Object.freeze({
		...payload,
		expectedProjectHead: event.expectedProjectHead,
		expectedChangeTip: event.expectedChangeTip,
		implementationResultCommit,
		implementationResultTree,
		eventDigest: event.eventDigest,
	}));
	if (payload.stage === "review" && state.review) state.review = Object.freeze({...state.review, gate: state.gates.at(-1) ?? null});
	return success(null);
}

function decide(
	state: ReductionState,
	next: "deferred" | "rejected" | "withdrawn",
	payload: DecisionPayload,
	index: number,
): Outcome<null, ChangeReductionIssue> {
	if (state.state !== "proposed" || !state.change) return failure(issue(index, `Only proposed Change may become ${next}.`));
	if (!hasPassedGate(state, {stage: "decision", gateDigest: payload.gateDigest, workId: null, subjectDigest: state.change.changeDigest})) return failure(issue(index, `${next} requires current passed Decision Gate.`));
	state.state = next;
	return success(null);
}

function resume(state: ReductionState, index: number): Outcome<null, ChangeReductionIssue> {
	if (state.state !== "deferred") return failure(issue(index, "Only deferred Change may resume."));
	state.state = "proposed";
	invalidateDecisionFacts(state);
	return success(null);
}

function commit(state: ReductionState, payload: CommittedPayload, index: number): Outcome<null, ChangeReductionIssue> {
	if (state.state !== "proposed" || !state.change) return failure(issue(index, "Only proposed Change may commit."));
	if (!hasPassedGate(state, {stage: "decision", gateDigest: payload.decisionGateDigest, workId: null, subjectDigest: state.change.changeDigest})) return failure(issue(index, "Change commitment requires current passed Decision Gate."));
	state.state = "committed";
	state.committedWikiTree = payload.wikiTree;
	return success(null);
}

function plan(state: ReductionState, payload: PlannedPayload, index: number): Outcome<null, ChangeReductionIssue> {
	if (state.state !== "committed" || state.change?.realization !== "project") {
		return failure(issue(index, "Only committed project Change may record Work planning."));
	}
	if (!hasPassedGate(state, {stage: "planning", gateDigest: payload.planningGateDigest, workId: null, subjectDigest: payload.planDigest})) return failure(issue(index, "Work plan requires current passed Planning Gate over exact plan."));
	let additions = 0;
	for (const work of payload.work) {
		if (work.changeId !== state.change.changeId) return failure(issue(index, "Planned Work belongs to another Change."));
		const existing = state.work.get(work.workId);
		if (existing && existing.work.workDigest !== work.workDigest) return failure(issue(index, "Planning amendment changes existing Work identity."));
		if (!existing) additions += 1;
	}
	if ([...state.work.keys()].some((workId) => !payload.work.some((work) => work.workId === workId))) {
		return failure(issue(index, "Planning amendment removes existing Work identity."));
	}
	if (state.work.size > 0 && additions === 0) return failure(issue(index, "Planning amendment must add Work without rewriting existing Work."));
	for (const work of payload.work) if (!state.work.has(work.workId)) state.work.set(work.workId, {work, claims: [], assignments: [], attempts: [], integration: null});
	state.review = null;
	return success(null);
}

function claimWork(state: ReductionState, payload: WorkClaimedPayload, index: number): Outcome<null, ChangeReductionIssue> {
	const work = mutableWork(state, payload.workId, index);
	if (!work.ok) return work;
	if (work.value.integration) return failure(issue(index, "Integrated Work cannot be claimed again."));
	if ([...state.work.values()].some((entry) => entry.claims.some((claim) => claim.claimId === payload.claimId))) return failure(issue(index, "Work Claim identity is duplicated."));
	if (!dependenciesIntegrated(state, work.value.work)) return failure(issue(index, "Work dependencies are not integrated."));
	if (work.value.claims.length > work.value.attempts.length) return failure(issue(index, "Work already has an active Claim."));
	if ([...state.work.values()].some((other) => other !== work.value && other.integration === null && other.claims.length > other.attempts.length && workScopesConflict(work.value.work, other.work))) {
		return failure(issue(index, "Work Claim conflicts with another active writable scope."));
	}
	work.value.claims.push(payload);
	return success(null);
}

function assignWork(state: ReductionState, payload: WorkAssignedPayload, index: number): Outcome<null, ChangeReductionIssue> {
	const work = mutableWork(state, payload.workId, index);
	if (!work.ok) return work;
	const claim = work.value.claims.at(-1);
	if ([...state.work.values()].some((entry) => entry.assignments.some((assignment) => assignment.assignmentId === payload.assignmentId))) return failure(issue(index, "Work Assignment identity is duplicated."));
	if (!claim || claim.claimId !== payload.claimId || work.value.assignments.length >= work.value.claims.length) {
		return failure(issue(index, "Work Assignment requires latest unused Claim."));
	}
	work.value.assignments.push(payload);
	return success(null);
}

function recordAttempt(state: ReductionState, payload: WorkAttemptPayload, index: number): Outcome<null, ChangeReductionIssue> {
	const work = mutableWork(state, payload.workId, index);
	if (!work.ok) return work;
	const assignment = work.value.assignments.at(-1);
	if ([...state.work.values()].some((entry) => entry.attempts.some((attempt) => attempt.runId === payload.runId || attempt.runReceiptDigest === payload.runReceiptDigest))) {
		return failure(issue(index, "Work attempt Run or receipt identity is duplicated."));
	}
	if (!assignment || assignment.assignmentId !== payload.assignmentId || work.value.attempts.length >= work.value.assignments.length) {
		return failure(issue(index, "Work attempt requires latest unused Assignment."));
	}
	work.value.attempts.push(payload);
	return success(null);
}

function integrateWork(state: ReductionState, payload: WorkIntegratedPayload, index: number): Outcome<null, ChangeReductionIssue> {
	const work = mutableWork(state, payload.workId, index);
	if (!work.ok) return work;
	const attempt = work.value.attempts.at(-1);
	if (!attempt || work.value.integration) return failure(issue(index, "Work integration requires one current unintegrated result."));
	if (!sameGitOid(attempt.resultCommit, payload.resultCommit) || !sameGitOid(attempt.resultTree, payload.resultTree)) {
		return failure(issue(index, "Work integration does not match current result commit/tree."));
	}
	if (!hasPassedGate(state, {stage: "implementation", gateDigest: payload.implementationGateDigest, workId: payload.workId, resultCommit: payload.resultCommit, resultTree: payload.resultTree, subjectDigest: work.value.work.workDigest})) {
		return failure(issue(index, "Work integration requires current passed Implementation Gate."));
	}
	work.value.integration = payload;
	return success(null);
}

function reconcile(state: ReductionState, payload: ReviewReconciledPayload, index: number): Outcome<null, ChangeReductionIssue> {
	if (state.state !== "committed" || state.change?.realization !== "project" || state.work.size === 0) {
		return failure(issue(index, "Review reconciliation requires planned committed project Change."));
	}
	const integrated = [...state.work.values()].flatMap((entry) => entry.integration === null ? [] : [entry.work.workId]).sort(compareText);
	if (!sameText(integrated, payload.integratedWorkIds) || integrated.length !== state.work.size) {
		return failure(issue(index, "Review reconciliation must cover every integrated Work identity exactly."));
	}
	state.review = Object.freeze({reconciliation: payload, gate: null});
	return success(null);
}

function complete(state: ReductionState, payload: CompletedPayload, index: number): Outcome<null, ChangeReductionIssue> {
	if (state.state !== "committed" || !state.change) return failure(issue(index, "Only committed Change may complete."));
	if (state.change.realization === "wiki-only") {
		if (payload.reviewGateDigest !== null || state.committedWikiTree === null || !sameGitOid(payload.completionTree, state.committedWikiTree)) {
			return failure(issue(index, "Wiki-only completion must use committed Wiki tree without Review Gate."));
		}
	} else {
		if (!state.review || payload.reviewGateDigest === null || !hasPassedGate(state, {stage: "review", gateDigest: payload.reviewGateDigest, workId: null, subjectDigest: state.review.reconciliation.reviewSubjectDigest})) {
			return failure(issue(index, "Project completion requires reconciled passed Review Gate."));
		}
		if (!sameGitOid(payload.completionTree, state.review.reconciliation.prospectiveTree)) {
			return failure(issue(index, "Completion tree differs from reviewed prospective tree."));
		}
	}
	state.state = "completed";
	state.completionTree = payload.completionTree;
	return success(null);
}

function supersede(state: ReductionState, payload: SupersededPayload, index: number): Outcome<null, ChangeReductionIssue> {
	if ((state.state !== "committed" && state.state !== "completed") || payload.supersedingChangeId === state.change?.changeId) {
		return failure(issue(index, "Only committed/completed Change may be superseded by another Change."));
	}
	state.state = "superseded";
	state.supersedingChangeId = payload.supersedingChangeId;
	return success(null);
}

function recordEffect(state: ReductionState, payload: EffectRecordedPayload, index: number): Outcome<null, ChangeReductionIssue> {
	if (state.state !== "completed") return failure(issue(index, "Protected effect may be recorded only after Change completion."));
	if (state.effects.some((entry) => entry.authorizationId === payload.authorizationId || entry.requestDigest === payload.requestDigest || entry.receiptDigest === payload.receiptDigest)) {
		return failure(issue(index, "Protected effect authorization, request, or receipt cannot be replayed."));
	}
	state.effects.push(payload);
	return success(null);
}

function hasPassedGate(state: ReductionState, query: Readonly<{
	stage: ReducedGateFact["stage"];
	gateDigest: Sha256Digest;
	workId: string | null;
	resultCommit?: GitOid;
	resultTree?: GitOid;
	subjectDigest?: Sha256Digest;
}>): boolean {
	for (let index = state.gates.length - 1; index >= 0; index -= 1) {
		const gate = state.gates[index];
		if (gate?.stage === query.stage && gate.workId === query.workId) {
			return gate.status === "passed" && gate.gateDigest === query.gateDigest &&
				(query.resultCommit === undefined || gate.implementationResultCommit !== null && sameGitOid(gate.implementationResultCommit, query.resultCommit)) &&
				(query.resultTree === undefined || gate.implementationResultTree !== null && sameGitOid(gate.implementationResultTree, query.resultTree)) &&
				(query.subjectDigest === undefined || gate.subjectDigest === query.subjectDigest);
		}
	}
	return false;
}

function mutableWork(state: ReductionState, workId: string, index: number): Outcome<MutableWorkState, ChangeReductionIssue> {
	if (state.state !== "committed") return failure(issue(index, "Work fact requires committed Change."));
	const work = state.work.get(workId);
	return work ? success(work) : failure(issue(index, "Work fact targets unknown Work identity."));
}

function dependenciesIntegrated(state: ReductionState, work: Work): boolean {
	return work.dependencies.every((dependency) => state.work.get(dependency)?.integration !== null);
}

function invalidateDecisionFacts(state: ReductionState): void {
	state.gates = state.gates.filter((entry) => entry.stage !== "decision");
}

function isTerminalProposalState(state: ChangeLifecycleState): boolean {
	return state === "rejected" || state === "withdrawn";
}

function materialize(
	trace: ChangeTrace,
	change: Change,
	stateValue: ChangeLifecycleState,
	state: ReductionState,
): Outcome<ReducedChange, ChangeReductionIssue> {
	const work = [...state.work.values()]
		.sort((left, right) => left.work.ordinal - right.work.ordinal)
		.map((entry): ReducedWorkState => Object.freeze({
			work: entry.work,
			claims: Object.freeze([...entry.claims]),
			assignments: Object.freeze([...entry.assignments]),
			attempts: Object.freeze([...entry.attempts]),
			integration: entry.integration,
			status: reducedWorkStatus(entry),
		}));
	const latestEventDigest = trace.events.at(-1)?.eventDigest;
	if (!latestEventDigest) return failure(issue(trace.events.length, "Reduced Trace has no terminal event."));
	const body = Object.freeze({
		traceId: trace.header.traceId,
		change,
		state: stateValue,
		committedWikiTree: state.committedWikiTree,
		work: Object.freeze(work),
		gates: Object.freeze([...state.gates]),
		review: state.review,
		completionTree: state.completionTree,
		supersedingChangeId: state.supersedingChangeId,
		effects: Object.freeze([...state.effects]),
		latestEventDigest,
		traceDigest: trace.traceDigest,
	});
	const digest = semanticDigest("codewiki.reduced-change@1.0.0", body);
	if (!digest.ok) return failure(issue(trace.events.length, digest.error.message, "reduction_failed"));
	return success(Object.freeze({...body, stateDigest: digest.value}));
}

function sameText(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function issue(
	eventIndex: number,
	message: string,
	code: ChangeReductionIssue["code"] = "invalid_transition",
): ChangeReductionIssue {
	return Object.freeze({code, eventIndex, message});
}

function reducedWorkStatus(entry: MutableWorkState): ReducedWorkState["status"] {
	if (entry.integration) return "integrated";
	if (entry.attempts.length > 0) return "result_recorded";
	if (entry.assignments.length > 0) return "assigned";
	if (entry.claims.length > 0) return "claimed";
	return "planned";
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
