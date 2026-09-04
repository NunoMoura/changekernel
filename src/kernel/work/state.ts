import {failure, success, type Outcome} from "../canonical/outcome.ts";
import type {ChangeLifecycleState, ReducedChange, ReducedWorkState} from "../changes/reducer.ts";
import {decodeProjectSnapshot, type ProjectSnapshot} from "../changes/snapshot.ts";
import {decodeEvidenceReference, type EvidenceReference} from "../evidence/reference.ts";
import {decodeGate, decodeResult, type Gate, type Result} from "../gates/contracts.ts";
import {decodeGateOutcome, requiredCheckInputsPresent, resultMeasurementStatus, type GateOutcome} from "../gates/reducer.ts";
import {sameGitOid} from "../identity/git.ts";
import {semanticDigest} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";
import {workPlanDigest, workScopesConflict} from "./contracts.ts";

export type ProjectedWorkStatus = "assigned" | "blocked" | "claimed" | "integrated" | "planned" | "ready" | "result_recorded";
export type ProjectedChangeState = ChangeLifecycleState | "blocked";
export type ProjectedChangePhase = "completed" | "decision" | "implementation" | "planning" | "review" | "superseded";

export interface WorkStateWork {
	readonly workId: string;
	readonly status: ProjectedWorkStatus;
	readonly dependencies: readonly string[];
	readonly blockers: readonly string[];
	readonly claimIds: readonly string[];
	readonly assignmentIds: readonly string[];
	readonly runIds: readonly string[];
	readonly runReceiptDigests: readonly Sha256Digest[];
	readonly implementationGateDigests: readonly Sha256Digest[];
	readonly workDigest: Sha256Digest;
	readonly projectionDigest: Sha256Digest;
}

export interface WorkStateChange {
	readonly changeId: string;
	readonly lifecycleState: ChangeLifecycleState;
	readonly projectedState: ProjectedChangeState;
	readonly phase: ProjectedChangePhase;
	readonly blockers: readonly string[];
	readonly work: readonly WorkStateWork[];
	readonly gateDigests: readonly Sha256Digest[];
	readonly outcomeDigests: readonly Sha256Digest[];
	readonly runDigests: readonly Sha256Digest[];
	readonly resultDigests: readonly Sha256Digest[];
	readonly evidenceDigests: readonly Sha256Digest[];
	readonly activeCheckRegistrationDigests: readonly Sha256Digest[];
	readonly reviewSubjectDigest: Sha256Digest | null;
	readonly effectReceiptDigests: readonly Sha256Digest[];
	readonly latestEventDigest: Sha256Digest;
	readonly stateDigest: Sha256Digest;
	readonly projectionDigest: Sha256Digest;
}

export interface ProjectWorkState {
	readonly projectSnapshotDigest: Sha256Digest;
	readonly kernelBuildDigest: Sha256Digest;
	readonly changes: readonly WorkStateChange[];
	readonly activeChangeIds: readonly string[];
	readonly blockedChangeIds: readonly string[];
	readonly readyWorkIds: readonly string[];
	readonly projectionDigest: Sha256Digest;
}

export interface WorkStateIssue {
	readonly code: "duplicate_fact" | "invalid_fact" | "invalid_project" | "projection_failed";
	readonly path: string;
	readonly message: string;
}

export function deriveWorkState(input: Readonly<{
	project: ProjectSnapshot;
	changes: readonly ReducedChange[];
	gates: readonly Gate[];
	gateOutcomes: readonly GateOutcome[];
	results: readonly Result[];
	evidence: readonly EvidenceReference[];
	kernelBuildDigest: Sha256Digest;
}>): Outcome<ProjectWorkState, WorkStateIssue> {
	const project = decodeProjectSnapshot(input.project);
	if (!project.ok || !project.value.complete) return failure(issue("invalid_project", "$.project", project.ok ? "Project object closure is incomplete." : project.error.message));
	const kernelBuildDigest = decodeSha256Digest(input.kernelBuildDigest);
	if (!kernelBuildDigest.ok) return failure(issue("invalid_fact", "$.kernelBuildDigest", kernelBuildDigest.error.message));
	const facts = validateFacts({...input, kernelBuildDigest: kernelBuildDigest.value});
	if (!facts.ok) return facts;
	if (input.changes.length > 4_096) return failure(issue("invalid_fact", "$.changes", "Change projection input exceeds bound."));
	const changes = [...input.changes].sort((left, right) => compareText(left.change.changeId, right.change.changeId));
	for (let index = 1; index < changes.length; index += 1) {
		if (changes[index - 1]?.change.changeId === changes[index]?.change.changeId) return failure(issue("duplicate_fact", "$.changes", "Change identity is duplicated."));
	}
	const globalBlockers = deriveGlobalBlockers(changes);
	const projected: WorkStateChange[] = [];
	for (const change of changes) {
		const validation = validateReducedChange(change);
		if (validation) return failure(validation);
		if (change.change.repositoryId !== project.value.repositoryId) {
			return failure(issue("invalid_fact", `$.changes.${change.change.changeId}`, "Change belongs to another Project repository."));
		}
		const projection = projectChange(change, globalBlockers.get(change.change.changeId) ?? [], facts.value);
		if (!projection.ok) return projection;
		projected.push(projection.value);
	}
	const activeChangeIds = projected.flatMap((entry) => isActive(entry.lifecycleState) ? [entry.changeId] : []);
	const blockedChangeIds = projected.flatMap((entry) => entry.projectedState === "blocked" ? [entry.changeId] : []);
	const readyWorkIds = projected.flatMap((entry) => entry.work.flatMap((work) => work.status === "ready" ? [work.workId] : [])).sort(compareText);
	const body = Object.freeze({
		projectSnapshotDigest: project.value.snapshotDigest,
		kernelBuildDigest: kernelBuildDigest.value,
		changes: Object.freeze(projected),
		activeChangeIds: Object.freeze(activeChangeIds),
		blockedChangeIds: Object.freeze(blockedChangeIds),
		readyWorkIds: Object.freeze(readyWorkIds),
	});
	const digest = semanticDigest("codewiki.work-state@1.0.0", body);
	if (!digest.ok) return failure(issue("projection_failed", "$", digest.error.message));
	return success(Object.freeze({...body, projectionDigest: digest.value}));
}

interface FactIndex {
	readonly kernelBuildDigest: Sha256Digest;
	readonly gates: ReadonlyMap<Sha256Digest, Gate>;
	readonly outcomes: ReadonlyMap<Sha256Digest, GateOutcome>;
	readonly results: ReadonlyMap<Sha256Digest, Result>;
	readonly evidenceReferences: ReadonlySet<Sha256Digest>;
	readonly receipts: ReadonlySet<Sha256Digest>;
}

function validateFacts(input: Readonly<{
	gates: readonly Gate[];
	gateOutcomes: readonly GateOutcome[];
	results: readonly Result[];
	evidence: readonly EvidenceReference[];
	kernelBuildDigest: Sha256Digest;
}>): Outcome<FactIndex, WorkStateIssue> {
	const {gates, gateOutcomes: outcomes, results, evidence, kernelBuildDigest} = input;
	if (gates.length > 4_096 || outcomes.length > 4_096 || results.length > 16_384 || evidence.length > 16_384) {
		return failure(issue("invalid_fact", "$", "Fact collection exceeds projection bounds."));
	}
	const gateMap = new Map<Sha256Digest, Gate>();
	const gateIds = new Set<string>();
	for (let index = 0; index < gates.length; index += 1) {
		const gate = decodeGate(gates[index]);
		if (!gate.ok) return failure(issue("invalid_fact", `$.gates[${index}]`, gate.error.message));
		if (gateMap.has(gate.value.gateDigest) || gateIds.has(gate.value.gateId)) return failure(issue("duplicate_fact", `$.gates[${index}]`, "Gate identity is duplicated."));
		gateMap.set(gate.value.gateDigest, gate.value);
		gateIds.add(gate.value.gateId);
	}
	const outcomeMap = new Map<Sha256Digest, GateOutcome>();
	for (let index = 0; index < outcomes.length; index += 1) {
		const outcome = decodeGateOutcome(outcomes[index]);
		if (!outcome.ok) return failure(issue("invalid_fact", `$.gateOutcomes[${index}]`, outcome.error.message));
		if (outcomeMap.has(outcome.value.outcomeDigest)) return failure(issue("duplicate_fact", `$.gateOutcomes[${index}]`, "Gate outcome is duplicated."));
		outcomeMap.set(outcome.value.outcomeDigest, outcome.value);
	}
	const resultMap = new Map<Sha256Digest, Result>();
	const resultIds = new Set<string>();
	for (let index = 0; index < results.length; index += 1) {
		const decoded = decodeResult(results[index]);
		if (!decoded.ok) return failure(issue("invalid_fact", `$.results[${index}]`, decoded.error.message));
		if (resultMap.has(decoded.value.resultDigest) || resultIds.has(decoded.value.resultId)) return failure(issue("duplicate_fact", `$.results[${index}]`, "Result identity is duplicated."));
		resultMap.set(decoded.value.resultDigest, decoded.value);
		resultIds.add(decoded.value.resultId);
	}
	const receipts = new Set<Sha256Digest>();
	const evidenceDigests = new Set<Sha256Digest>();
	const evidenceIds = new Set<string>();
	for (let index = 0; index < evidence.length; index += 1) {
		const decoded = decodeEvidenceReference(evidence[index]);
		if (!decoded.ok) return failure(issue("invalid_fact", `$.evidence[${index}]`, decoded.error.message));
		if (evidenceDigests.has(decoded.value.referenceDigest) || evidenceIds.has(decoded.value.evidenceId)) return failure(issue("duplicate_fact", `$.evidence[${index}]`, "Evidence identity is duplicated."));
		evidenceDigests.add(decoded.value.referenceDigest);
		evidenceIds.add(decoded.value.evidenceId);
		receipts.add(decoded.value.receiptDigest);
	}
	return success(Object.freeze({kernelBuildDigest, gates: gateMap, outcomes: outcomeMap, results: resultMap, evidenceReferences: evidenceDigests, receipts}));
}

function validateReducedChange(change: ReducedChange): WorkStateIssue | null {
	const {stateDigest, ...body} = change;
	const digest = semanticDigest("codewiki.reduced-change@1.0.0", body);
	if (!digest.ok || digest.value !== stateDigest) return issue("invalid_fact", `$.changes.${change.change.changeId}`, "Reduced Change digest is invalid.");
	return null;
}

function projectChange(
	change: ReducedChange,
	globalBlockers: readonly string[],
	facts: FactIndex,
): Outcome<WorkStateChange, WorkStateIssue> {
	const blockers = [...globalBlockers, ...changeFactBlockers(change, facts)].sort(compareText);
	const work: WorkStateWork[] = [];
	for (const entry of change.work) {
		const projection = projectWork(change, entry, facts, blockers);
		if (!projection.ok) return projection;
		work.push(projection.value);
	}
	const localWorkBlockers = work.flatMap((entry) => entry.blockers.map((blocker) => `work:${entry.workId}:${blocker}`));
	blockers.push(...localWorkBlockers);
	blockers.sort(compareText);
	const uniqueBlockers = Object.freeze([...new Set(blockers)]);
	const projectedState: ProjectedChangeState = isActive(change.state) && uniqueBlockers.length > 0 ? "blocked" : change.state;
	const body = Object.freeze({
		changeId: change.change.changeId,
		lifecycleState: change.state,
		projectedState,
		phase: derivePhase(change),
		blockers: uniqueBlockers,
		work: Object.freeze(work),
		gateDigests: Object.freeze(change.gates.map((entry) => entry.gateDigest)),
		outcomeDigests: Object.freeze(change.gates.map((entry) => entry.outcomeDigest)),
		runDigests: Object.freeze(change.gates.flatMap((entry) => entry.runDigests)),
		resultDigests: Object.freeze(change.gates.flatMap((entry) => entry.resultDigests)),
		evidenceDigests: Object.freeze(change.gates.flatMap((entry) => entry.evidenceDigests)),
		activeCheckRegistrationDigests: Object.freeze(change.gates.flatMap((entry) => facts.gates.get(entry.gateDigest)?.activeChecks.map((check) => check.registrationDigest) ?? [])),
		reviewSubjectDigest: change.review?.reconciliation.reviewSubjectDigest ?? null,
		effectReceiptDigests: Object.freeze(change.effects.map((entry) => entry.receiptDigest)),
		latestEventDigest: change.latestEventDigest,
		stateDigest: change.stateDigest,
	});
	const digest = semanticDigest("codewiki.work-state-change@1.0.0", body);
	return digest.ok
		? success(Object.freeze({...body, projectionDigest: digest.value}))
		: failure(issue("projection_failed", `$.changes.${change.change.changeId}`, digest.error.message));
}

function changeFactBlockers(change: ReducedChange, facts: FactIndex): string[] {
	const blockers: string[] = [];
	for (const gate of change.gates) {
		const gateFact = facts.gates.get(gate.gateDigest);
		const current = isCurrentGate(change, gate);
		if (!gateFact || gateFact.stage !== gate.stage || gateFact.subject.subjectDigest !== gate.subjectDigest || gateFact.subject.workId !== gate.workId ||
			gateFact.subject.repositoryId !== change.change.repositoryId || gateFact.subject.changeId !== change.change.changeId ||
			(current && gateFact.kernelBuildDigest !== facts.kernelBuildDigest) || !sameGitOid(gateFact.subject.projectCommit, gate.expectedProjectHead) ||
			!sameGitOid(gateFact.subject.changeTip, gate.expectedChangeTip)) {
			blockers.push(`gate_definition_missing_or_conflicting:${gate.gateDigest}`);
		} else if (!lifecycleSubjectMatches(change, gate, gateFact)) {
			blockers.push(`gate_subject_missing_or_conflicting:${gate.gateDigest}`);
		} else if (current && gate.stage === "review" && !reviewSubjectMatches(change, gateFact)) {
			blockers.push(`gate_subject_missing_or_conflicting:${gate.gateDigest}`);
		}
		if (current && gate.stage !== "implementation" && gate.status !== "passed") blockers.push(`${gate.stage}_gate_${gate.status}:${gate.gateDigest}`);
		const outcome = facts.outcomes.get(gate.outcomeDigest);
		if (!outcome || outcome.gateDigest !== gate.gateDigest || outcome.status !== gate.status || outcome.subjectDigest !== gate.subjectDigest) {
			blockers.push(`gate_fact_missing_or_conflicting:${gate.gateDigest}`);
		}
		const outcomeResults = outcome ? [...outcome.requiredResults, ...outcome.advisoryResults, ...outcome.observedResults].sort(compareText) : [];
		if (!sameText(gate.resultDigests, outcomeResults)) blockers.push(`gate_result_set_conflicting:${gate.gateDigest}`);
		if (gateFact && outcome) blockers.push(...gateResultFactBlockers(gate, gateFact, outcome, facts));
		for (const evidenceDigest of gate.evidenceDigests) {
			if (!facts.evidenceReferences.has(evidenceDigest)) blockers.push(`evidence_missing:${evidenceDigest}`);
		}
	}
	for (const work of change.work) {
		for (const claim of work.claims) if (!facts.receipts.has(claim.receiptDigest)) blockers.push(`claim_receipt_missing:${claim.receiptDigest}`);
		for (const attempt of work.attempts) if (!facts.receipts.has(attempt.runReceiptDigest)) blockers.push(`run_receipt_missing:${attempt.runReceiptDigest}`);
	}
	for (const effect of change.effects) if (!facts.receipts.has(effect.receiptDigest)) blockers.push(`effect_receipt_missing:${effect.receiptDigest}`);
	return blockers;
}

function gateResultFactBlockers(
	gate: ReducedChange["gates"][number],
	gateFact: Gate,
	outcome: GateOutcome,
	facts: FactIndex,
): string[] {
	const blockers: string[] = [];
	const registrationsWithResults = new Set<Sha256Digest>();
	for (const registration of gateFact.activeChecks) {
		if (registration.enforcement === "required" && !requiredCheckInputsPresent(registration, gateFact.inputs)) {
			blockers.push(`gate_required_input_missing:${registration.registrationDigest}`);
		}
	}
	const factualFailed = gate.resultDigests.filter((digest) => facts.results.get(digest)?.status === "failed").sort(compareText);
	if (!sameText(outcome.failedResults, factualFailed)) blockers.push(`gate_failed_result_set_conflicting:${gate.gateDigest}`);
	for (const resultDigest of gate.resultDigests) {
		const result = facts.results.get(resultDigest);
		const registration = result === undefined
			? undefined
			: gateFact.activeChecks.find((check) => check.registrationDigest === result.registrationDigest && check.definitionDigest === result.definitionDigest);
		if (!result || !registration || result.gateDigest !== gate.gateDigest || result.subjectDigest !== gate.subjectDigest) {
			blockers.push(`result_missing_or_conflicting:${resultDigest}`);
			continue;
		}
		if (registrationsWithResults.has(registration.registrationDigest)) {
			blockers.push(`gate_result_registration_conflicting:${registration.registrationDigest}`);
		}
		registrationsWithResults.add(registration.registrationDigest);
		if (!outcomeContains(outcome, registration.enforcement, resultDigest)) {
			blockers.push(`gate_result_category_conflicting:${resultDigest}`);
		}
		if (resultMeasurementStatus(registration, result) !== result.status) {
			blockers.push(`result_measurement_conflicting:${resultDigest}`);
		}
		for (const evidence of result.evidence) {
			if (!facts.evidenceReferences.has(evidence.referenceDigest)) blockers.push(`result_evidence_missing:${evidence.referenceDigest}`);
			if (!gate.evidenceDigests.includes(evidence.referenceDigest)) blockers.push(`gate_evidence_set_conflicting:${evidence.referenceDigest}`);
		}
	}
	if (outcome.status !== "stopped") {
		for (const registration of gateFact.activeChecks) {
			if (registration.enforcement === "required" && !registrationsWithResults.has(registration.registrationDigest)) {
				blockers.push(`required_result_missing:${registration.registrationDigest}`);
			}
		}
	}
	return blockers;
}

function outcomeContains(
	outcome: GateOutcome,
	enforcement: Gate["activeChecks"][number]["enforcement"],
	resultDigest: Sha256Digest,
): boolean {
	switch (enforcement) {
		case "required": return outcome.requiredResults.includes(resultDigest);
		case "advisory": return outcome.advisoryResults.includes(resultDigest);
		case "observe": return outcome.observedResults.includes(resultDigest);
		default: return false;
	}
}

function isCurrentGate(change: ReducedChange, gate: ReducedChange["gates"][number]): boolean {
	let latest: ReducedChange["gates"][number] | undefined;
	for (let index = change.gates.length - 1; index >= 0; index -= 1) {
		const candidate = change.gates[index];
		if (candidate?.stage === gate.stage && candidate.workId === gate.workId) {
			latest = candidate;
			break;
		}
	}
	if (latest?.gateDigest !== gate.gateDigest) return false;
	if (gate.stage === "decision") return change.state === "proposed";
	if (gate.stage === "planning") {
		if (change.state !== "committed" || change.work.length === 0) return change.state === "committed";
		const currentPlan = workPlanDigest(change.work.map((entry) => entry.work));
		return !currentPlan.ok || gate.subjectDigest !== currentPlan.value;
	}
	if (gate.stage === "review") return change.state === "committed" && change.review?.gate?.gateDigest === gate.gateDigest;
	const work = change.work.find((entry) => entry.work.workId === gate.workId);
	return work !== undefined && work.integration === null && work.attempts.length > 0;
}

function lifecycleSubjectMatches(change: ReducedChange, gate: ReducedChange["gates"][number], fact: Gate): boolean {
	switch (gate.stage) {
		case "decision":
			return fact.subject.kind === "change" && fact.subject.artifactCommit === null && fact.subject.artifactTree === null &&
				gate.subjectDigest === change.change.changeDigest;
		case "planning":
			return fact.subject.kind === "plan" && fact.subject.artifactCommit === null && fact.subject.artifactTree === null;
		case "implementation": {
			const work = change.work.find((entry) => entry.work.workId === gate.workId);
			return fact.subject.kind === "work" && work !== undefined && gate.subjectDigest === work.work.workDigest &&
				gate.implementationResultCommit !== null && gate.implementationResultTree !== null &&
				fact.subject.artifactCommit !== null && fact.subject.artifactTree !== null &&
				sameGitOid(gate.implementationResultCommit, fact.subject.artifactCommit) &&
				sameGitOid(gate.implementationResultTree, fact.subject.artifactTree);
		}
		case "review":
			return fact.subject.kind === "review" && fact.subject.artifactCommit !== null &&
				sameGitOid(fact.subject.artifactCommit, gate.expectedChangeTip);
		default:
			return false;
	}
}

function reviewSubjectMatches(change: ReducedChange, fact: Gate): boolean {
	const prospectiveTree = change.review?.reconciliation.prospectiveTree;
	return prospectiveTree !== undefined && fact.subject.artifactTree !== null && sameGitOid(prospectiveTree, fact.subject.artifactTree);
}

function sameText(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function projectWork(
	change: ReducedChange,
	entry: ReducedWorkState,
	facts: FactIndex,
	changeBlockers: readonly string[],
): Outcome<WorkStateWork, WorkStateIssue> {
	const blockers: string[] = [];
	for (const dependency of entry.work.dependencies) {
		if (change.work.find((candidate) => candidate.work.workId === dependency)?.integration === null) blockers.push(`dependency_not_integrated:${dependency}`);
	}
	for (const claim of entry.claims) if (!facts.receipts.has(claim.receiptDigest)) blockers.push(`claim_receipt_missing:${claim.receiptDigest}`);
	for (const attempt of entry.attempts) if (!facts.receipts.has(attempt.runReceiptDigest)) blockers.push(`run_receipt_missing:${attempt.runReceiptDigest}`);
	const implementationGates = change.gates.filter((gate) => gate.stage === "implementation" && gate.workId === entry.work.workId);
	const terminalGate = implementationGates.at(-1);
	if (terminalGate?.status === "failed" || terminalGate?.status === "stopped") blockers.push(`implementation_gate_${terminalGate.status}:${terminalGate.gateDigest}`);
	let status: ProjectedWorkStatus = entry.status;
	if (status === "planned" && blockers.length === 0 && changeBlockers.length === 0) status = "ready";
	else if (blockers.length > 0 && status !== "integrated") status = "blocked";
	const body = Object.freeze({
		workId: entry.work.workId,
		status,
		dependencies: entry.work.dependencies,
		blockers: Object.freeze([...new Set(blockers.sort(compareText))]),
		claimIds: Object.freeze(entry.claims.map((claim) => claim.claimId)),
		assignmentIds: Object.freeze(entry.assignments.map((assignment) => assignment.assignmentId)),
		runIds: Object.freeze(entry.attempts.map((attempt) => attempt.runId)),
		runReceiptDigests: Object.freeze(entry.attempts.map((attempt) => attempt.runReceiptDigest)),
		implementationGateDigests: Object.freeze(implementationGates.map((gate) => gate.gateDigest)),
		workDigest: entry.work.workDigest,
	});
	const digest = semanticDigest("codewiki.work-state-work@1.0.0", body);
	return digest.ok
		? success(Object.freeze({...body, projectionDigest: digest.value}))
		: failure(issue("projection_failed", `$.work.${entry.work.workId}`, digest.error.message));
}

function deriveGlobalBlockers(changes: readonly ReducedChange[]): Map<string, string[]> {
	const output = new Map<string, string[]>();
	const active = changes.filter((entry) => isActive(entry.state));
	for (let leftIndex = 0; leftIndex < active.length; leftIndex += 1) {
		for (let rightIndex = leftIndex + 1; rightIndex < active.length; rightIndex += 1) {
			const left = active[leftIndex];
			const right = active[rightIndex];
			if (!left || !right) continue;
			if (changesConflict(left, right)) {
				addBlocker(output, left.change.changeId, `conflicts_with:${right.change.changeId}`);
				addBlocker(output, right.change.changeId, `conflicts_with:${left.change.changeId}`);
			}
			if (workConflicts(left, right)) {
				addBlocker(output, left.change.changeId, `writable_scope_conflict:${right.change.changeId}`);
				addBlocker(output, right.change.changeId, `writable_scope_conflict:${left.change.changeId}`);
			}
		}
	}
	return output;
}

function changesConflict(left: ReducedChange, right: ReducedChange): boolean {
	const explicit = left.change.relationships.some((entry) => entry.kind === "conflicts_with" && entry.changeId === right.change.changeId) ||
		right.change.relationships.some((entry) => entry.kind === "conflicts_with" && entry.changeId === left.change.changeId);
	if (explicit) return true;
	const rightTargets = new Set(right.change.targets.flatMap((target) => target.facets.map((facet) => `${target.itemId}\0${facet}`)));
	return left.change.targets.some((target) => target.facets.some((facet) => rightTargets.has(`${target.itemId}\0${facet}`)));
}

function workConflicts(left: ReducedChange, right: ReducedChange): boolean {
	const leftActive = left.work.flatMap((entry) => entry.integration === null ? [entry.work] : []);
	const rightActive = right.work.flatMap((entry) => entry.integration === null ? [entry.work] : []);
	return leftActive.some((leftWork) => rightActive.some((rightWork) => workScopesConflict(leftWork, rightWork)));
}

function derivePhase(change: ReducedChange): ProjectedChangePhase {
	if (change.state === "completed") return "completed";
	if (change.state === "superseded") return "superseded";
	if (change.state !== "committed") return "decision";
	if (change.change.realization === "wiki-only") return "review";
	if (change.work.length === 0) return "planning";
	if (change.work.some((entry) => entry.integration === null)) return "implementation";
	return "review";
}

function isActive(state: ChangeLifecycleState): boolean {
	return state === "committed" || state === "proposed" || state === "deferred";
}

function addBlocker(output: Map<string, string[]>, changeId: string, blocker: string): void {
	const entries = output.get(changeId) ?? [];
	entries.push(blocker);
	output.set(changeId, entries);
}

function issue(code: WorkStateIssue["code"], path: string, message: string): WorkStateIssue {
	return Object.freeze({code, path, message});
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
