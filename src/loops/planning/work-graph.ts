import type {ChangeRevisionId, OperationId} from "../../changes/trace/contracts.ts";
import {
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {
	comparePlanningEdges,
	comparePlanningText as compareText,
	planningPathsOverlap,
	type PlanningAggregateReviewRequirement,
	type PlanningAmendment,
	type PlanningDependencyEdge,
	type PlanningObligationCoverage,
	type PlanningUiPreviewTarget,
	type PlanningUnchangedKnowledgeCoverage,
	type PlanningWorkUnitCandidate,
} from "./candidate-content.ts";

export const WORK_GRAPH_PROTOCOL = Object.freeze({
	id: "codewiki.work-graph",
	version: "2.0.0",
} as const);

interface WorkGraphChangeStatus {
	readonly workUnitClaims: readonly {
		readonly workUnitId: string;
		readonly status: string;
	}[];
	readonly assignments: readonly {
		readonly workUnitId: string;
		readonly status: string;
	}[];
}

export type WorkGraphUnitStatus =
	| "accepted"
	| "claimed"
	| "assigned"
	| "completed"
	| "blocked"
	| "retired";

export type PlanningGraphDelta = CanonicalJsonValue & {
	readonly schemaVersion: "1.0.0";
	readonly deltaId: Sha256Digest;
	readonly owningChangeId: string;
	readonly changeRevisionId: ChangeRevisionId;
	readonly amendment: PlanningAmendment;
	readonly workUnits: readonly PlanningWorkUnitCandidate[];
	readonly dependencyEdges: readonly PlanningDependencyEdge[];
	readonly knowledgeEffectCoverage: readonly PlanningObligationCoverage[];
	readonly unchangedKnowledgeCoverage: readonly PlanningUnchangedKnowledgeCoverage[];
	readonly acceptanceCoverage: readonly PlanningObligationCoverage[];
	readonly aggregateReviewRequirements: readonly PlanningAggregateReviewRequirement[];
	readonly uiPreviewTargets: readonly PlanningUiPreviewTarget[];
	readonly integrationRequirements: readonly string[];
	readonly rationale: string;
};

export interface AcceptedPlanningDelta {
	readonly delta: PlanningGraphDelta;
	readonly candidateId: string;
	readonly candidateDigest: Sha256Digest;
	readonly acceptanceOperationId: OperationId;
}

export interface WorkGraphUnit {
	readonly workUnit: PlanningWorkUnitCandidate;
	readonly deltaId: Sha256Digest;
	readonly status: WorkGraphUnitStatus;
}

export interface CanonicalWorkGraphBody {
	readonly protocol: typeof WORK_GRAPH_PROTOCOL;
	readonly deltas: readonly AcceptedPlanningDelta[];
	readonly currentDeltaByChange: readonly {
		readonly changeId: string;
		readonly deltaId: Sha256Digest;
	}[];
	readonly workUnits: readonly WorkGraphUnit[];
	readonly dependencyEdges: readonly PlanningDependencyEdge[];
}

export interface CanonicalWorkGraph extends CanonicalWorkGraphBody {
	readonly graphDigest: Sha256Digest;
}

export function createInitialWorkGraph(): CanonicalWorkGraph {
	return materializeWorkGraph({
		protocol: WORK_GRAPH_PROTOCOL,
		deltas: [],
		currentDeltaByChange: [],
		workUnits: [],
		dependencyEdges: [],
	});
}

export function applyAcceptedPlanningDelta(input: {
	readonly graph: CanonicalWorkGraph;
	readonly delta: PlanningGraphDelta;
	readonly candidateId: string;
	readonly candidateDigest: Sha256Digest;
	readonly acceptanceOperationId: OperationId;
	readonly changes: readonly WorkGraphChangeStatus[];
}): CanonicalWorkGraph {
	const current = input.graph.currentDeltaByChange.find(
		(entry) => entry.changeId === input.delta.owningChangeId,
	);
	assertAmendmentBinding(input.delta, current?.deltaId ?? null);
	if (input.graph.deltas.some((entry) => entry.delta.deltaId === input.delta.deltaId)) {
		throw new Error(`Planning delta ${input.delta.deltaId} is already accepted.`);
	}
	const knownIds = new Set(input.graph.workUnits.map((entry) => entry.workUnit.id));
	const addedIds = new Set<string>();
	for (const unit of input.delta.workUnits) {
		if (knownIds.has(unit.id) || addedIds.has(unit.id)) {
			throw new Error(`Planning Work Unit identity ${unit.id} cannot be reused.`);
		}
		addedIds.add(unit.id);
	}
	const retiredIds = new Set(input.delta.amendment?.retireWorkUnitIds ?? []);
	assertRetirements(input.graph, input.delta, retiredIds);
	const retainedUnits = input.graph.workUnits.map((entry) =>
		retiredIds.has(entry.workUnit.id) ? {...entry, status: "retired" as const} : entry,
	);
	const workUnits: WorkGraphUnit[] = [
		...retainedUnits,
		...input.delta.workUnits.map((workUnit) => ({
			workUnit,
			deltaId: input.delta.deltaId,
			status: "accepted" as const,
		})),
	];
	const activeIds = new Set<string>();
	for (const entry of workUnits) {
		if (entry.status !== "retired") activeIds.add(entry.workUnit.id);
	}
	const dependencyEdges = [
		...input.graph.dependencyEdges.filter(
			(edge) => activeIds.has(edge.fromWorkUnitId) && activeIds.has(edge.toWorkUnitId),
		),
		...input.delta.dependencyEdges,
	];
	assertDependencyGraph(dependencyEdges, activeIds);
	assertOverlapOrdering(workUnits, dependencyEdges);
	const currentDeltaByChange = [
		...input.graph.currentDeltaByChange.filter(
			(entry) => entry.changeId !== input.delta.owningChangeId,
		),
		{changeId: input.delta.owningChangeId, deltaId: input.delta.deltaId},
	].sort((left, right) => compareText(left.changeId, right.changeId));
	const graph = materializeWorkGraph({
		protocol: WORK_GRAPH_PROTOCOL,
		deltas: [
			...input.graph.deltas,
			{
				delta: input.delta,
				candidateId: input.candidateId,
				candidateDigest: input.candidateDigest,
				acceptanceOperationId: input.acceptanceOperationId,
			},
		],
		currentDeltaByChange,
		workUnits,
		dependencyEdges,
	});
	return refreshWorkGraphStatuses(graph, input.changes);
}

export function refreshWorkGraphStatuses(
	graph: CanonicalWorkGraph,
	changes: readonly WorkGraphChangeStatus[],
): CanonicalWorkGraph {
	const workUnits = graph.workUnits.map((entry): WorkGraphUnit => {
		if (entry.status === "retired") return entry;
		const assignments = changes.flatMap((change) => change.assignments).filter(
			(assignment) => assignment.workUnitId === entry.workUnit.id,
		);
		const claims = changes.flatMap((change) => change.workUnitClaims).filter(
			(claim) => claim.workUnitId === entry.workUnit.id,
		);
		const status = workUnitStatus(assignments.map((value) => value.status), claims.map((value) => value.status));
		return {...entry, status};
	});
	return materializeWorkGraph({...graph, workUnits});
}

export function materializeWorkGraph(body: CanonicalWorkGraphBody): CanonicalWorkGraph {
	const {graphDigest: _priorDigest, ...graphBody} = body as CanonicalWorkGraphBody & {
		readonly graphDigest?: Sha256Digest;
	};
	// SAFETY: graph bodies contain only declared JSON-domain fields; canonicalization preserves structure.
	const normalized = toCanonicalJsonValue({
		...graphBody,
		deltas: [...graphBody.deltas].sort((left, right) =>
			compareText(left.delta.deltaId, right.delta.deltaId),
		),
		currentDeltaByChange: [...graphBody.currentDeltaByChange].sort((left, right) =>
			compareText(left.changeId, right.changeId),
		),
		workUnits: [...graphBody.workUnits].sort((left, right) =>
			compareText(left.workUnit.id, right.workUnit.id),
		),
		dependencyEdges: [...graphBody.dependencyEdges].sort(comparePlanningEdges),
	}) as unknown as CanonicalWorkGraphBody;
	// SAFETY: normalized graph body plus its digest satisfies CanonicalWorkGraph.
	return toCanonicalJsonValue({
		...normalized,
		graphDigest: canonicalJsonDigest(normalized),
	}) as unknown as CanonicalWorkGraph;
}

function assertAmendmentBinding(delta: PlanningGraphDelta, currentDeltaId: Sha256Digest | null): void {
	if (!currentDeltaId && delta.amendment) {
		throw new Error("Initial Planning delta cannot declare amendment lineage.");
	}
	if (currentDeltaId && delta.amendment?.supersedesDeltaId !== currentDeltaId) {
		throw new Error("Planning amendment must supersede exact current Change delta.");
	}
}

function assertRetirements(
	graph: CanonicalWorkGraph,
	delta: PlanningGraphDelta,
	retiredIds: ReadonlySet<string>,
): void {
	for (const id of retiredIds) {
		const unit = graph.workUnits.find((entry) => entry.workUnit.id === id);
		if (!unit || unit.workUnit.owningChangeId !== delta.owningChangeId) {
			throw new Error(`Planning amendment retirement ${id} is outside its owning Change.`);
		}
		if (unit.status !== "accepted") {
			throw new Error(`Active Work Unit ${id} cannot be amended.`);
		}
	}
}

function assertDependencyGraph(
	edges: readonly PlanningDependencyEdge[],
	activeIds: ReadonlySet<string>,
): void {
	const seen = new Set<string>();
	const dependencies = new Map<string, string[]>();
	for (const edge of edges) {
		const key = `${edge.fromWorkUnitId}:${edge.toWorkUnitId}`;
		if (
			edge.fromWorkUnitId === edge.toWorkUnitId ||
			!activeIds.has(edge.fromWorkUnitId) ||
			!activeIds.has(edge.toWorkUnitId) ||
			seen.has(key)
		) {
			throw new Error("Planning dependency graph contains an invalid or duplicate edge.");
		}
		seen.add(key);
		dependencies.set(edge.fromWorkUnitId, [
			...(dependencies.get(edge.fromWorkUnitId) ?? []),
			edge.toWorkUnitId,
		]);
	}
	if (
		planningDependencyGraphHasCycle(
			edges.map((edge) => [edge.fromWorkUnitId, edge.toWorkUnitId] as const),
		)
	) {
		throw new Error("Planning dependency graph must be acyclic.");
	}
}

function assertOverlapOrdering(
	units: readonly WorkGraphUnit[],
	edges: readonly PlanningDependencyEdge[],
): void {
	const active = units.filter((entry) => entry.status !== "retired");
	const ordered = new Set(
		edges.flatMap((edge) => [
			`${edge.fromWorkUnitId}:${edge.toWorkUnitId}`,
			`${edge.toWorkUnitId}:${edge.fromWorkUnitId}`,
		]),
	);
	for (let leftIndex = 0; leftIndex < active.length; leftIndex += 1) {
		for (let rightIndex = leftIndex + 1; rightIndex < active.length; rightIndex += 1) {
			const left = active[leftIndex];
			const right = active[rightIndex];
			if (
				!left ||
				!right ||
				!planningPathsOverlap(left.workUnit.pathScopes, right.workUnit.pathScopes)
			) continue;
			if (!ordered.has(`${left.workUnit.id}:${right.workUnit.id}`)) {
				throw new Error(
					`Overlapping Work Units ${left.workUnit.id} and ${right.workUnit.id} require explicit ordering.`,
				);
			}
		}
	}
}

export function planningDependencyGraphHasCycle(
	edges: readonly (readonly [string, string])[],
): boolean {
	const dependencies = new Map<string, string[]>();
	for (const [from, to] of edges) {
		dependencies.set(from, [...(dependencies.get(from) ?? []), to]);
	}
	const visiting = new Set<string>();
	const visited = new Set<string>();
	const visit = (id: string): boolean => {
		if (visiting.has(id)) return true;
		if (visited.has(id)) return false;
		visiting.add(id);
		if ((dependencies.get(id) ?? []).some(visit)) return true;
		visiting.delete(id);
		visited.add(id);
		return false;
	};
	return [...dependencies.keys()].some(visit);
}

function workUnitStatus(
	assignments: readonly string[],
	claims: readonly string[],
): WorkGraphUnitStatus {
	if (assignments.includes("completed")) return "completed";
	if (assignments.some((status) => status === "blocked" || status === "failed")) return "blocked";
	if (assignments.some((status) => status === "active" || status === "cancel_requested")) return "assigned";
	if (claims.includes("active")) return "claimed";
	return "accepted";
}


