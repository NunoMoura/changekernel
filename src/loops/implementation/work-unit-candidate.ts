import {
	canonicalJson,
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {
	createLoopCandidate,
	type LoopCandidate,
} from "../../checks/identity.ts";
import type {ProjectWorkState} from "../../changes/trace/state.ts";
import type {
	ScheduledAssignment,
	WorkbenchBinding,
} from "../../changes/trace/scheduling.ts";
import {
	assertRunReceipt,
	assertRunRequest,
	type RunReceipt,
	type RunRequest,
} from "../../runtime/contracts.ts";
import type {KnowledgeTargetRef} from "../../changes/trace/contracts.ts";

export const WORK_UNIT_CANDIDATE_SCHEMA_VERSION = "1.0.0" as const;
export const MAXIMUM_IMPLEMENTATION_ATTEMPTS = 8 as const;

export type WorkUnitAcceptanceSlice = CanonicalJsonValue & {
	readonly knowledgeEffectIds: readonly string[];
	readonly unchangedKnowledgeTargets: readonly KnowledgeTargetRef[];
	readonly acceptanceRequirementIds: readonly string[];
};

export type WorkUnitRunAttemptBinding = CanonicalJsonValue & {
	readonly runId: string;
	readonly requestDigest: Sha256Digest;
	readonly receiptDigest: Sha256Digest;
	readonly outcome: RunReceipt["outcome"];
	readonly outputDigest: Sha256Digest | null;
};

export type WorkUnitCandidateContent = CanonicalJsonValue & {
	readonly workUnitId: string;
	readonly workUnitDigest: Sha256Digest;
	readonly owningChangeId: string;
	readonly changeRevisionId: Sha256Digest;
	readonly workGraphDeltaId: Sha256Digest;
	readonly assignmentAttemptId: string;
	readonly assignmentDigest: Sha256Digest;
	readonly workbenchId: string;
	readonly workbenchDigest: Sha256Digest;
	readonly continuityKey: `implementation:${string}`;
	readonly sourceBase: string;
	readonly acceptanceSlice: WorkUnitAcceptanceSlice;
	readonly runAttempts: readonly WorkUnitRunAttemptBinding[];
	readonly producingRunId: string;
	readonly producingRunReceiptDigest: Sha256Digest;
	readonly resultTreeDigest: Sha256Digest;
	readonly changedPaths: readonly string[];
	readonly evidenceRecordIds: readonly string[];
};

export type WorkUnitCandidate = LoopCandidate<
	"implementation",
	WorkUnitCandidateContent
>;

export interface WorkUnitCandidateRun {
	readonly request: RunRequest;
	readonly receipt: RunReceipt;
}

export interface CreateWorkUnitCandidateInput {
	readonly state: ProjectWorkState;
	readonly workUnitId: string;
	readonly assignment: ScheduledAssignment;
	readonly workbench: WorkbenchBinding;
	readonly runs: readonly WorkUnitCandidateRun[];
	readonly changedPaths: readonly string[];
	readonly evidenceRecordIds?: readonly string[];
}

export function implementationContinuityKey(
	workUnitId: string,
): `implementation:${string}` {
	const normalized = requiredText(workUnitId, "Work Unit ID");
	return `implementation:${normalized}`;
}

export function implementationWorkUnitSubjectId(workUnitId: string): string {
	return `work-unit:${requiredText(workUnitId, "Work Unit ID")}`;
}

export function createWorkUnitCandidate(
	input: CreateWorkUnitCandidateInput,
): WorkUnitCandidate {
	const graphUnit = input.state.workGraph.workUnits.find(
		(entry) => entry.workUnit.id === input.workUnitId,
	);
	if (!graphUnit || graphUnit.status === "retired" || graphUnit.status === "blocked") {
		throw new Error(`Work Unit Candidate ${input.workUnitId} has no active Work Graph unit.`);
	}
	const change = input.state.changes.find(
		(entry) => entry.changeId === graphUnit.workUnit.owningChangeId,
	);
	if (!change?.currentRevision) {
		throw new Error("Work Unit Candidate requires current owning Change revision.");
	}
	const assignment = change.assignments.find(
		(entry) => entry.assignmentAttemptId === input.assignment.assignmentAttemptId,
	);
	if (
		!assignment ||
		assignment.assignmentDigest !== input.assignment.assignmentDigest ||
		assignment.workUnitId !== input.workUnitId ||
		(assignment.status !== "active" && assignment.status !== "completed")
	) {
		throw new Error("Work Unit Candidate requires exact active or completed Assignment.");
	}
	assertAssignmentWorkbench(input.assignment, input.workbench, graphUnit.deltaId);
	const workUnitValue = toCanonicalJsonValue(graphUnit.workUnit);
	const workUnitDigest = canonicalJsonDigest(workUnitValue);
	const attempts = bindRunAttempts({
		runs: input.runs,
		assignment: input.assignment,
		workbench: input.workbench,
		workUnitDigest,
	});
	const producing = attempts.find((attempt) => attempt.outputDigest !== null);
	if (!producing?.outputDigest) {
		throw new Error("Work Unit Candidate requires exactly one producing Run.");
	}
	const knowledgeStateDigest = input.state.knowledgeHead?.stateDigest;
	if (!knowledgeStateDigest) {
		throw new Error("Work Unit Candidate requires accepted Knowledge State.");
	}
	const changedPaths = normalizedPaths(input.changedPaths);
	assertPathsWithinScopes(changedPaths, graphUnit.workUnit.pathScopes);
	const content = toCanonicalJsonValue({
		workUnitId: input.workUnitId,
		workUnitDigest,
		owningChangeId: graphUnit.workUnit.owningChangeId,
		changeRevisionId: change.currentRevision.revisionId,
		workGraphDeltaId: graphUnit.deltaId,
		assignmentAttemptId: input.assignment.assignmentAttemptId,
		assignmentDigest: input.assignment.assignmentDigest,
		workbenchId: input.workbench.workbenchId,
		workbenchDigest: input.workbench.workbenchDigest,
		continuityKey: implementationContinuityKey(input.workUnitId),
		sourceBase: input.assignment.sourceBase,
		acceptanceSlice: acceptanceSlice(graphUnit.workUnit),
		runAttempts: attempts,
		producingRunId: producing.runId,
		producingRunReceiptDigest: producing.receiptDigest,
		resultTreeDigest: producing.outputDigest,
		changedPaths,
		evidenceRecordIds: normalizedIdentifiers(
			input.evidenceRecordIds ?? [],
			"Evidence Record ID",
		),
	}) as WorkUnitCandidateContent;
	const candidate = createLoopCandidate<"implementation", WorkUnitCandidateContent>({
		loop: "implementation",
		schemaVersion: WORK_UNIT_CANDIDATE_SCHEMA_VERSION,
		content,
		observedBase: {
			workStateDigest: input.state.workStateDigest,
			knowledgeSnapshotDigest: knowledgeStateDigest,
			canonicalRefs: [
				change.currentRevision.revisionId,
				graphUnit.deltaId,
				input.assignment.assignmentDigest,
				input.workbench.workbenchDigest,
				...attempts.map((attempt) => attempt.receiptDigest),
			],
		},
	});
	assertWorkUnitCandidate(candidate, input.state);
	return candidate;
}

export function assertWorkUnitCandidate(
	candidate: WorkUnitCandidate,
	state?: ProjectWorkState,
): void {
	if (
		candidate.loop !== "implementation" ||
		candidate.schemaVersion !== WORK_UNIT_CANDIDATE_SCHEMA_VERSION
	) {
		throw new Error("Work Unit Candidate protocol is unsupported.");
	}
	const expected = createLoopCandidate({
		loop: candidate.loop,
		schemaVersion: candidate.schemaVersion,
		content: candidate.content,
		observedBase: candidate.observedBase,
	});
	if (canonicalJson(candidate) !== canonicalJson(expected)) {
		throw new Error("Work Unit Candidate identity is invalid.");
	}
	assertCandidateContent(candidate.content);
	if (state) assertCandidateStateBinding(candidate, state, true);
}

export function assertCurrentWorkUnitCandidate(
	candidate: WorkUnitCandidate,
	state: ProjectWorkState,
): void {
	assertWorkUnitCandidate(candidate);
	assertCandidateStateBinding(candidate, state, false);
}

function assertCandidateStateBinding(
	candidate: WorkUnitCandidate,
	state: ProjectWorkState,
	requireExactWorkState: boolean,
): void {
	if (requireExactWorkState && candidate.observedBase.workStateDigest !== state.workStateDigest) {
		throw new Error("Work Unit Candidate WorkState base is stale.");
	}
	if (candidate.observedBase.knowledgeSnapshotDigest !== state.knowledgeHead?.stateDigest) {
		throw new Error("Work Unit Candidate Knowledge base is stale.");
	}
	const graphUnit = state.workGraph.workUnits.find(
		(entry) => entry.workUnit.id === candidate.content.workUnitId,
	);
	if (
		!graphUnit ||
		graphUnit.deltaId !== candidate.content.workGraphDeltaId ||
		graphUnit.workUnit.owningChangeId !== candidate.content.owningChangeId ||
		canonicalJsonDigest(toCanonicalJsonValue(graphUnit.workUnit)) !==
			candidate.content.workUnitDigest ||
		canonicalJson(acceptanceSlice(graphUnit.workUnit)) !==
			canonicalJson(candidate.content.acceptanceSlice)
	) {
		throw new Error("Work Unit Candidate no longer matches canonical Work Graph unit.");
	}
	assertPathsWithinScopes(candidate.content.changedPaths, graphUnit.workUnit.pathScopes);
	const change = state.changes.find(
		(entry) => entry.changeId === candidate.content.owningChangeId,
	);
	if (change?.currentRevision?.revisionId !== candidate.content.changeRevisionId) {
		throw new Error("Work Unit Candidate owning Change revision is stale.");
	}
	const assignment = change.assignments.find(
		(entry) => entry.assignmentAttemptId === candidate.content.assignmentAttemptId,
	);
	if (
		!assignment ||
		assignment.assignmentDigest !== candidate.content.assignmentDigest ||
		assignment.workbenchDigest !== candidate.content.workbenchDigest
	) {
		throw new Error("Work Unit Candidate Assignment binding is stale.");
	}
}

function acceptanceSlice(workUnit: {
	readonly knowledgeEffectIds: readonly string[];
	readonly unchangedKnowledgeTargets: readonly KnowledgeTargetRef[];
	readonly acceptanceRequirementIds: readonly string[];
}): WorkUnitAcceptanceSlice {
	return toCanonicalJsonValue({
		knowledgeEffectIds: [...workUnit.knowledgeEffectIds],
		unchangedKnowledgeTargets: [...workUnit.unchangedKnowledgeTargets],
		acceptanceRequirementIds: [...workUnit.acceptanceRequirementIds],
	}) as WorkUnitAcceptanceSlice;
}

function bindRunAttempts(input: {
	readonly runs: readonly WorkUnitCandidateRun[];
	readonly assignment: ScheduledAssignment;
	readonly workbench: WorkbenchBinding;
	readonly workUnitDigest: Sha256Digest;
}): readonly WorkUnitRunAttemptBinding[] {
	if (input.runs.length === 0 || input.runs.length > MAXIMUM_IMPLEMENTATION_ATTEMPTS) {
		throw new Error(
			`Work Unit Candidate requires 1-${MAXIMUM_IMPLEMENTATION_ATTEMPTS} bounded Runs.`,
		);
	}
	const sessionId = implementationContinuityKey(input.assignment.workUnitId);
	const runIds = new Set<string>();
	const attempts = input.runs.map((run, index) =>
		bindRunAttempt({
			...input,
			run,
			index,
			priorReceipt: input.runs[index - 1]?.receipt,
			sessionId,
			runIds,
		}),
	);
	const finalAttempt = attempts.at(-1);
	const provisionalBinding: Pick<
		WorkUnitCandidateContent,
		"runAttempts" | "producingRunId" | "producingRunReceiptDigest" | "resultTreeDigest"
	> = {
		runAttempts: attempts,
		producingRunId: finalAttempt?.runId ?? "",
		producingRunReceiptDigest: finalAttempt?.receiptDigest ?? canonicalJsonDigest(null),
		resultTreeDigest: finalAttempt?.outputDigest ?? canonicalJsonDigest(null),
	};
	assertCandidateAttemptBindings(provisionalBinding);
	return Object.freeze(attempts);
}

function bindRunAttempt(input: {
	readonly run: WorkUnitCandidateRun;
	readonly index: number;
	readonly priorReceipt?: RunReceipt;
	readonly assignment: ScheduledAssignment;
	readonly workbench: WorkbenchBinding;
	readonly workUnitDigest: Sha256Digest;
	readonly sessionId: string;
	readonly runIds: Set<string>;
}): WorkUnitRunAttemptBinding {
	const {request, receipt} = input.run;
	assertRunRequest(request);
	assertRunReceipt(receipt);
	assertRunRequestBinding(input, request);
	if (
		receipt.runId !== request.runId ||
		receipt.requestDigest !== request.requestDigest ||
		receipt.sessionId !== input.sessionId ||
		receipt.custodyGaps.length > 0 ||
		input.runIds.has(request.runId)
	) {
		throw new Error("Work Unit Candidate Run Receipt binding is invalid.");
	}
	if ((input.index === 0) !== (request.session.mode === "create")) {
		throw new Error("Work Unit Candidate must create one Session then resume it.");
	}
	if (
		request.session.mode === "resume" &&
		canonicalJson(request.session.resumeLog) !== canonicalJson(input.priorReceipt?.rawLog)
	) {
		throw new Error("Work Unit Candidate Run does not resume exact prior Session log.");
	}
	input.runIds.add(request.runId);
	return toCanonicalJsonValue({
		runId: request.runId,
		requestDigest: request.requestDigest,
		receiptDigest: receipt.receiptDigest,
		outcome: receipt.outcome,
		outputDigest: receipt.outputDigest,
	}) as WorkUnitRunAttemptBinding;
}

function assertRunRequestBinding(
	input: {
		readonly assignment: ScheduledAssignment;
		readonly workbench: WorkbenchBinding;
		readonly workUnitDigest: Sha256Digest;
		readonly sessionId: string;
	},
	request: RunRequest,
): void {
	if (
		request.stage !== "implementation" ||
		request.role !== "implementation-worker" ||
		request.subject.id !== implementationWorkUnitSubjectId(input.assignment.workUnitId) ||
		request.subject.digest !== input.workUnitDigest ||
		request.session.sessionId !== input.sessionId ||
		request.workspace.kind !== "runtime-workbench" ||
		request.workspace.assignmentId !== input.assignment.assignmentAttemptId ||
		request.workspace.workbenchRef !== input.workbench.workbenchId
	) {
		throw new Error("Work Unit Candidate Run does not bind exact Work Unit Session and Workbench.");
	}
}

function assertCandidateContent(content: WorkUnitCandidateContent): void {
	if (content.continuityKey !== implementationContinuityKey(content.workUnitId)) {
		throw new Error("Work Unit Candidate continuity identity is invalid.");
	}
	if (
		canonicalJson(content.changedPaths) !== canonicalJson(normalizedPaths(content.changedPaths)) ||
		canonicalJson(content.evidenceRecordIds) !==
			canonicalJson(normalizedIdentifiers(content.evidenceRecordIds, "Evidence Record ID"))
	) {
		throw new Error("Work Unit Candidate path or Evidence identities are not canonical.");
	}
	const runIds = content.runAttempts.map((attempt) => attempt.runId);
	const receiptIds = content.runAttempts.map((attempt) => attempt.receiptDigest);
	if (
		new Set(runIds).size !== runIds.length ||
		new Set(receiptIds).size !== receiptIds.length
	) {
		throw new Error("Work Unit Candidate Run identities must be unique.");
	}
	assertCandidateAttemptBindings(content);
}

function assertCandidateAttemptBindings(
	content: Pick<
		WorkUnitCandidateContent,
		"runAttempts" | "producingRunId" | "producingRunReceiptDigest" | "resultTreeDigest"
	>,
): void {
	if (
		content.runAttempts.length === 0 ||
		content.runAttempts.length > MAXIMUM_IMPLEMENTATION_ATTEMPTS
	) {
		throw new Error("Work Unit Candidate Run count is invalid.");
	}
	const producing = content.runAttempts.filter(
		(attempt) => attempt.outcome === "completed" && attempt.outputDigest !== null,
	);
	if (producing.length !== 1 || producing[0] !== content.runAttempts.at(-1)) {
		throw new Error("Work Unit Candidate requires exactly one final producing Run.");
	}
	if (
		producing[0].runId !== content.producingRunId ||
		producing[0].receiptDigest !== content.producingRunReceiptDigest ||
		producing[0].outputDigest !== content.resultTreeDigest
	) {
		throw new Error("Work Unit Candidate producing Run binding is invalid.");
	}
}

function assertAssignmentWorkbench(
	assignment: ScheduledAssignment,
	workbench: WorkbenchBinding,
	workGraphDeltaId: Sha256Digest,
): void {
	if (
		assignment.workGraphDeltaId !== workGraphDeltaId ||
		assignment.workUnitId !== workbench.workUnitId ||
		assignment.assignmentAttemptId !== workbench.assignmentAttemptId ||
		assignment.workerId !== workbench.workerId ||
		assignment.workbenchId !== workbench.workbenchId ||
		assignment.workbenchDigest !== workbench.workbenchDigest ||
		assignment.sourceBase !== workbench.sourceBase
	) {
		throw new Error("Work Unit Candidate Assignment and Workbench binding is invalid.");
	}
}

function assertPathsWithinScopes(
	paths: readonly string[],
	scopes: readonly string[],
): void {
	for (const path of paths) {
		if (!scopes.some((scope) => pathMatchesScope(path, scope))) {
			throw new Error(`Work Unit Candidate changed path ${path} exceeds Work Unit scope.`);
		}
	}
}

function pathMatchesScope(path: string, scope: string): boolean {
	const escaped = scope
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replaceAll("**", "\u0000")
		.replaceAll("*", "[^/]*")
		.replaceAll("\u0000", ".*");
	return new RegExp(`^${escaped}$`, "u").test(path);
}

function normalizedPaths(values: readonly string[]): readonly string[] {
	if (values.length > 512) throw new Error("Work Unit Candidate changed path limit exceeded.");
	return normalizedIdentifiers(values, "changed path").map((value) => {
		if (value.startsWith("/") || value.split("/").includes("..")) {
			throw new Error(`Work Unit Candidate changed path ${value} is unsafe.`);
		}
		return value;
	});
}

function normalizedIdentifiers(
	values: readonly string[],
	label: string,
): readonly string[] {
	const normalized = values.map((value) => requiredText(value, label)).sort(compareText);
	if (new Set(normalized).size !== normalized.length) {
		throw new Error(`Work Unit Candidate ${label} values must be unique.`);
	}
	return Object.freeze(normalized);
}

function requiredText(value: string, label: string): string {
	const normalized = value.trim();
	if (!normalized) throw new Error(`${label} must be non-empty text.`);
	return normalized;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
