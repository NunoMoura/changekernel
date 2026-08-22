import {createHash} from "node:crypto";
import type {LoopQualityStandardResult} from "../../changes/trace/types.ts";
import type {WorkState} from "../../work-state/types.ts";
import {planningDependencyGraphHasCycle} from "./work-graph.ts";
import {planningPathsOverlap} from "./candidate-content.ts";
import type {
	PlanningCandidateProposal,
	PlanningWorkUnitCandidate,
} from "./candidate-content.ts";

interface EvaluateGraphDeltaPlanningInput extends PlanningCandidateProposal {
	changeId: string;
	workState: WorkState;
}

interface GraphDeltaPlanningQualityResult {
	passed: boolean;
	qualityRef: string;
	standards: LoopQualityStandardResult[];
}

export const PLANNING_GRAPH_DELTA_QUALITY_STANDARDS = Object.freeze([
	{id: "single_change_ownership", description: "Every Work Unit belongs to planned Change.", mode: "deterministic" as const},
	{id: "work_unit_identity", description: "Work Unit identities are unique graph additions.", mode: "deterministic" as const},
	{id: "work_unit_obligations", description: "Work Unit obligations and resources are explicit.", mode: "deterministic" as const},
	{id: "dependency_graph", description: "Dependency edges are known and acyclic.", mode: "deterministic" as const},
	{id: "knowledge_coverage", description: "Accepted Knowledge obligations are mapped exactly.", mode: "deterministic" as const},
	{id: "acceptance_coverage", description: "Acceptance requirement IDs map to Work Units.", mode: "deterministic" as const},
	{id: "path_ordering", description: "Overlapping path scopes are ordered.", mode: "deterministic" as const},
	{id: "aggregate_review", description: "Aggregate Review requirements are explicit.", mode: "deterministic" as const},
	{id: "integration_requirements", description: "Change integration requirements are explicit.", mode: "deterministic" as const},
]);

export function evaluateGraphDeltaPlanning(
	input: EvaluateGraphDeltaPlanningInput,
): GraphDeltaPlanningQualityResult {
	const workUnitIds = new Set(input.workUnits.map((unit) => unit.id));
	const dependencies = input.dependencyEdges.map((edge) => [
		edge.fromWorkUnitId,
		edge.toWorkUnitId,
	] as const);
	const existingIds = new Set(input.workState.workUnitIds);
	const knownIds = new Set([...workUnitIds, ...existingIds]);
	const completeDependencies = [
		...(input.workState.workUnits || []).flatMap((unit) =>
			unit.dependsOn.map((dependencyId) => [unit.id, dependencyId] as const),
		),
		...dependencies,
	];
	const standards: LoopQualityStandardResult[] = [
		standard(
			"single_change_ownership",
			input.workUnits.every((unit) => unit.owningChangeId === input.changeId),
			"Every Work Unit must be owned by planned Change.",
		),
		standard(
			"work_unit_identity",
			workUnitIds.size === input.workUnits.length &&
				input.workUnits.every((unit) => !existingIds.has(unit.id)),
			"Work Unit IDs must be unique additions to global Work Graph.",
		),
		standard(
			"work_unit_obligations",
			input.workUnits.every(hasCompleteObligations),
			"Every Work Unit needs acceptance, verification, path, and resource obligations.",
		),
		standard(
			"dependency_graph",
			dependencies.every(
				([from, to]) => from !== to && workUnitIds.has(from) && knownIds.has(to),
			) && !planningDependencyGraphHasCycle(completeDependencies),
			"Dependency edges must originate in this delta, target known Work Units, and remain acyclic.",
		),
		standard(
			"knowledge_coverage",
			coverageReferencesKnown(input.knowledgeEffectCoverage, workUnitIds) &&
				input.unchangedKnowledgeCoverage.every(
					(entry) => entry.workUnitIds.every((id) => workUnitIds.has(id)),
				),
			"Knowledge coverage must map accepted obligations to known Work Units.",
		),
		standard(
			"acceptance_coverage",
			input.acceptanceCoverage.length > 0 &&
				coverageReferencesKnown(input.acceptanceCoverage, workUnitIds),
			"Every acceptance requirement ID must map to known Work Units.",
		),
		standard(
			"path_ordering",
			pathOrderingIsSafe(input.workUnits, dependencies),
			"Overlapping Work Unit path scopes require explicit dependency edge.",
		),
		standard(
			"aggregate_review",
			input.aggregateReviewRequirements.length > 0 &&
				input.aggregateReviewRequirements.every(
					(entry) => entry.workUnitIds.every((id) => workUnitIds.has(id)),
				),
			"Aggregate Review requirements must map to known Work Units.",
		),
		standard(
			"integration_requirements",
			input.integrationRequirements.length > 0,
			"Change integration requirements must be explicit.",
		),
	];
	const qualityRef = `sha256:${createHash("sha256")
		.update(JSON.stringify(standards))
		.digest("hex")}`;
	return {
		passed: standards.every((entry) => entry.status === "met"),
		qualityRef,
		standards,
	};
}

function hasCompleteObligations(unit: PlanningWorkUnitCandidate): boolean {
	return unit.acceptanceRequirementIds.length > 0 &&
		unit.verification.length > 0 &&
		unit.pathScopes.length > 0 &&
		unit.resourceRequirements.capabilityIds.length > 0 &&
		unit.resourceRequirements.toolIds.length > 0 &&
		unit.resourceRequirements.custodyRequirements.length > 0 &&
		Boolean(unit.resourceRequirements.privacyClass) &&
		Boolean(unit.resourceRequirements.budgetClass);
}

function coverageReferencesKnown(
	coverage: readonly {readonly workUnitIds: readonly string[]}[],
	workUnitIds: ReadonlySet<string>,
): boolean {
	return coverage.every(
		(entry) => entry.workUnitIds.length > 0 && entry.workUnitIds.every((id) => workUnitIds.has(id)),
	);
}

function standard(
	id: string,
	passed: boolean,
	message: string,
): LoopQualityStandardResult {
	return passed
		? {id, status: "met", mode: "deterministic", description: message, refs: []}
		: {
				id,
				status: "unmet",
				mode: "deterministic",
				description: message,
				message,
				refs: [],
			};
}

function pathOrderingIsSafe(
	workUnits: PlanningWorkUnitCandidate[],
	edges: readonly (readonly [string, string])[],
): boolean {
	const ordered = new Set(edges.flatMap(([from, to]) => [`${from}:${to}`, `${to}:${from}`]));
	for (let leftIndex = 0; leftIndex < workUnits.length; leftIndex += 1) {
		for (let rightIndex = leftIndex + 1; rightIndex < workUnits.length; rightIndex += 1) {
			const left = workUnits[leftIndex];
			const right = workUnits[rightIndex];
			if (!left || !right) continue;
			if (
				planningPathsOverlap(left.pathScopes, right.pathScopes) &&
				!ordered.has(`${left.id}:${right.id}`)
			) {
				return false;
			}
		}
	}
	return true;
}
