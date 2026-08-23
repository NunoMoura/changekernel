import {
	CHANGE_INTAKE_MATERIAL_PROTOCOL,
	type OutcomeFindingMaterial,
} from "./contracts.ts";
import {normalizeChangeIntakeMaterial} from "./normalize.ts";
import {
	assertSha256Digest,
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export type OutcomeDiagnosticTarget =
	| "pack-skill"
	| "check"
	| "stage-context"
	| "model-route"
	| "budget"
	| "project-configuration";

export interface OutcomeDiagnosticSuggestion {
	readonly target: OutcomeDiagnosticTarget;
	readonly targetRef: string;
	readonly unifiedDiff: string;
}

export interface OutcomeDiagnosticObservation {
	readonly changeRevisionId: Sha256Digest;
	readonly stage: "decision" | "planning" | "implementation" | "review";
	readonly subjectRef: string;
	readonly gateReportDigest: Sha256Digest;
	readonly outcome: "passed" | "failed" | "stopped";
	readonly failureCodes: readonly string[];
	readonly sourceRefs: readonly string[];
	readonly suggestion?: OutcomeDiagnosticSuggestion;
}

export interface OutcomeDiagnosticRun {
	readonly minimumOccurrences?: number;
	readonly observations: readonly OutcomeDiagnosticObservation[];
}

const MAX_OBSERVATIONS = 256;
const MAX_DIFF_BYTES = 8_192;

/**
 * Convert repeated retained Gate outcomes into ordinary untrusted Change Intake
 * Material. This function has no repair, Pack-write, routing, or lifecycle port.
 */
export function diagnoseOutcomes(
	input: OutcomeDiagnosticRun,
): readonly OutcomeFindingMaterial[] {
	if (!Array.isArray(input.observations) || input.observations.length > MAX_OBSERVATIONS) {
		throw new Error("Outcome Diagnostics observations exceed the bounded history limit.");
	}
	const minimum = input.minimumOccurrences ?? 2;
	if (!Number.isSafeInteger(minimum) || minimum < 2 || minimum > 32) {
		throw new Error("Outcome Diagnostics minimum occurrence count is invalid.");
	}
	const observations = input.observations.map(normalizeObservation);
	const groups = new Map<string, OutcomeDiagnosticObservation[]>();
	for (const observation of observations) {
		if (observation.outcome === "passed") continue;
		for (const failureCode of observation.failureCodes) {
			const suggestion = observation.suggestion;
			const key = JSON.stringify([
				observation.changeRevisionId,
				observation.stage,
				failureCode,
				suggestion?.target ?? null,
				suggestion?.targetRef ?? null,
				suggestion?.unifiedDiff ?? null,
			]);
			const grouped = groups.get(key) ?? [];
			grouped.push({...observation, failureCodes: [failureCode]});
			groups.set(key, grouped);
		}
	}
	const findings: OutcomeFindingMaterial[] = [];
	for (const group of groups.values()) {
		if (group.length < minimum) continue;
		findings.push(outcomeFinding(group));
	}
	return Object.freeze(findings.sort((left, right) =>
		left.binding.observationId.localeCompare(right.binding.observationId),
	));
}

function outcomeFinding(group: readonly OutcomeDiagnosticObservation[]): OutcomeFindingMaterial {
	const ordered = [...group].sort(compareObservation);
	const first = ordered[0];
	if (!first) throw new Error("Outcome Diagnostics group is empty.");
	const failureCode = first.failureCodes[0];
	if (!failureCode) throw new Error("Outcome Diagnostics failure code is missing.");
	const sourceEvidenceDigest = canonicalJsonDigest(ordered.map((item) => ({
		gateReportDigest: item.gateReportDigest,
		outcome: item.outcome,
		sourceRefs: item.sourceRefs,
		subjectRef: item.subjectRef,
	})));
	const suggestion = first.suggestion;
	const observedBehavior = `${failureCode} recurred in ${ordered.length} retained ${first.stage} Gate outcomes.`;
	const desiredBehavior = suggestion
		? `Proposed ${suggestion.target} change for ${suggestion.targetRef}:\n${suggestion.unifiedDiff}`
		: undefined;
	const material = normalizeChangeIntakeMaterial({
		protocolId: CHANGE_INTAKE_MATERIAL_PROTOCOL.id,
		protocolVersion: CHANGE_INTAKE_MATERIAL_PROTOCOL.version,
		materialType: "outcome_finding",
		binding: {
			observationId: `outcome:${canonicalJsonDigest({failureCode, sourceEvidenceDigest}).slice("sha256:".length)}`,
			changeRevisionId: first.changeRevisionId,
			subjectRef: first.subjectRef,
			sourceEvidenceDigest,
		},
		content: {
			summary: `Repeated ${first.stage} outcome: ${failureCode}`,
			observedBehavior,
			...(desiredBehavior ? {desiredBehavior} : {}),
			affectedRefs: suggestion ? [suggestion.targetRef] : [first.subjectRef],
			sourceRefs: uniqueSorted(ordered.flatMap((item) => [
				item.gateReportDigest,
				...item.sourceRefs,
			])).slice(0, CHANGE_INTAKE_MATERIAL_PROTOCOL.maxSourceRefs),
			claimedCategory: "outcome",
			claimedSeverity: "medium",
			claimedConfidence: ordered.length >= 3 ? "high" : "medium",
		},
	});
	if (material.materialType !== "outcome_finding") {
		throw new Error("Outcome Diagnostics produced wrong intake material type.");
	}
	return material;
}

function normalizeObservation(
	value: OutcomeDiagnosticObservation,
): OutcomeDiagnosticObservation {
	if (!value || typeof value !== "object") throw new Error("Outcome Diagnostics observation is invalid.");
	assertSha256Digest(value.changeRevisionId, "Outcome Diagnostics Change revision digest");
	assertSha256Digest(value.gateReportDigest, "Outcome Diagnostics Gate report digest");
	if (!["decision", "planning", "implementation", "review"].includes(value.stage)) {
		throw new Error("Outcome Diagnostics stage is invalid.");
	}
	if (!["passed", "failed", "stopped"].includes(value.outcome)) {
		throw new Error("Outcome Diagnostics outcome is invalid.");
	}
	const subjectRef = text(value.subjectRef, "Outcome Diagnostics subject ref", 512);
	const failureCodes = uniqueSorted(value.failureCodes.map((item) =>
		text(item, "Outcome Diagnostics failure code", 128),
	));
	if (value.outcome === "passed" && failureCodes.length > 0) {
		throw new Error("Passed Outcome Diagnostics observation cannot carry failure codes.");
	}
	if (value.outcome !== "passed" && failureCodes.length === 0) {
		throw new Error("Non-passing Outcome Diagnostics observation requires a failure code.");
	}
	const sourceRefs = uniqueSorted(value.sourceRefs.map((item) =>
		text(item, "Outcome Diagnostics source ref", 512),
	));
	const suggestion = value.suggestion ? normalizeSuggestion(value.suggestion) : undefined;
	return Object.freeze({
		changeRevisionId: value.changeRevisionId,
		stage: value.stage,
		subjectRef,
		gateReportDigest: value.gateReportDigest,
		outcome: value.outcome,
		failureCodes: Object.freeze(failureCodes),
		sourceRefs: Object.freeze(sourceRefs),
		...(suggestion ? {suggestion} : {}),
	});
}

function normalizeSuggestion(value: OutcomeDiagnosticSuggestion): OutcomeDiagnosticSuggestion {
	if (!["pack-skill", "check", "stage-context", "model-route", "budget", "project-configuration"].includes(value.target)) {
		throw new Error("Outcome Diagnostics suggestion target is invalid.");
	}
	const targetRef = text(value.targetRef, "Outcome Diagnostics suggestion target ref", 512);
	const unifiedDiff = text(value.unifiedDiff, "Outcome Diagnostics suggestion diff", MAX_DIFF_BYTES);
	if (!unifiedDiff.startsWith("--- ") || !unifiedDiff.includes("\n+++ ")) {
		throw new Error("Outcome Diagnostics suggestion must contain an exact unified diff.");
	}
	return Object.freeze({target: value.target, targetRef, unifiedDiff});
}

function compareObservation(left: OutcomeDiagnosticObservation, right: OutcomeDiagnosticObservation): number {
	return left.gateReportDigest.localeCompare(right.gateReportDigest) ||
		left.subjectRef.localeCompare(right.subjectRef);
}

function uniqueSorted(values: readonly string[]): string[] {
	return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function text(value: unknown, field: string, maximum: number): string {
	if (typeof value !== "string" || value.length === 0 || value.length > maximum || value.trim() !== value) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}
