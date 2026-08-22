import {normalizeCheckInputSelections} from "./protocol.ts";
import {
	normalizeExecutionIdentity,
	type CheckExecutionIdentity,
	type CheckInputSelection,
	type CheckStage,
	type CheckSubject,
} from "./contracts.ts";
import {
	assertCheckPackSnapshot,
	packagedChecks,
	type CheckPackSnapshot,
} from "./packs/contracts.ts";
import {
	assertSha256Digest,
	canonicalJson,
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../utils/canonical-json.ts";

export const GATE_EVALUATION_PACKAGE_PROTOCOL = Object.freeze({
	id: "codewiki.gate-evaluation-package",
	version: "1.0.0",
	canonicalJson: "codewiki.canonical-json/1.0.0",
} as const);

export const MAX_GATE_EVALUATION_PACKAGE_BYTES = 16 * 1024 * 1024;

export interface GateEvaluationSourceHeads {
	readonly workStateDigest: Sha256Digest;
	readonly knowledgeStateDigest: Sha256Digest;
	readonly knowledgeProjectionDigest: Sha256Digest;
	readonly alignmentDigest: Sha256Digest;
	readonly repositoryTreeDigest: Sha256Digest;
	readonly repositoryBase: string;
	readonly evidenceDigest: Sha256Digest;
	readonly resultsDigest: Sha256Digest;
	readonly configurationDigest: Sha256Digest;
	readonly routesDigest: Sha256Digest;
}

export type GateEvaluationStageBindings =
	| {
		readonly stage: "decision";
		readonly changeRevisionDigest: Sha256Digest;
		readonly knowledgeTransitionDigest: Sha256Digest;
		readonly compilerDigest: Sha256Digest;
		readonly applicationPlanDigest: Sha256Digest;
		readonly projectedKnowledgeStateDigest: Sha256Digest;
		readonly projectedKnowledgeProjectionDigest: Sha256Digest;
		readonly semanticViewDigest: Sha256Digest;
		readonly acceptedActiveChangesDigest: Sha256Digest;
	}
	| {
		readonly stage: "planning";
		readonly changeRevisionDigest: Sha256Digest;
		readonly acceptedKnowledgeTargetsDigest: Sha256Digest;
		readonly acceptanceRequirementsDigest: Sha256Digest;
		readonly planningDeltaDigest: Sha256Digest;
	}
	| {
		readonly stage: "implementation";
		readonly changeRevisionDigest: Sha256Digest;
		readonly acceptedKnowledgeTargetsDigest: Sha256Digest;
		readonly acceptanceRequirementsDigest: Sha256Digest;
		readonly implementationPolicyDigest: Sha256Digest;
		readonly workUnitDigest: Sha256Digest;
		readonly assignmentDigest: Sha256Digest;
		readonly resultTreeDigest: Sha256Digest;
	}
	| {
		readonly stage: "review";
		readonly changeRevisionDigest: Sha256Digest;
		readonly acceptedKnowledgeTargetsDigest: Sha256Digest;
		readonly acceptanceRequirementsDigest: Sha256Digest;
		readonly workGraphDigest: Sha256Digest;
		readonly aggregateDigest: Sha256Digest;
		readonly lineageDigest: Sha256Digest;
		readonly integratedTreeDigest: Sha256Digest;
	};

export interface GateEvaluationCheckBinding {
	readonly packId: string;
	readonly checkId: string;
	readonly checkDigest: Sha256Digest;
	readonly execution: CheckExecutionIdentity;
	readonly inputs: readonly CheckInputSelection[];
	readonly inputDigest: Sha256Digest;
	readonly bindingDigest: Sha256Digest;
}

export interface GateEvaluationPackage {
	readonly protocol: typeof GATE_EVALUATION_PACKAGE_PROTOCOL;
	readonly stage: CheckStage;
	readonly subject: CheckSubject;
	readonly checkPackSnapshot: CheckPackSnapshot;
	readonly sources: GateEvaluationSourceHeads;
	readonly stageBindings: GateEvaluationStageBindings;
	readonly checks: readonly GateEvaluationCheckBinding[];
	readonly coverage: "complete";
	readonly packageDigest: Sha256Digest;
}

export interface CreateGateEvaluationPackageInput {
	readonly subject: CheckSubject;
	readonly checkPackSnapshot: CheckPackSnapshot;
	readonly sources: GateEvaluationSourceHeads;
	readonly stageBindings: GateEvaluationStageBindings;
	readonly checks: readonly Omit<GateEvaluationCheckBinding, "inputDigest" | "bindingDigest">[];
}

export function createGateEvaluationPackage(
	input: CreateGateEvaluationPackageInput,
): Readonly<GateEvaluationPackage> {
	assertCheckPackSnapshot(input.checkPackSnapshot, input.subject.stage);
	if (input.stageBindings.stage !== input.subject.stage) {
		throw new Error("Gate Evaluation Package stage binding is inconsistent.");
	}
	const packaged = packagedChecks(input.checkPackSnapshot);
	if (input.checks.length !== packaged.length) {
		throw new Error("Gate Evaluation Package omits one or more declared Checks.");
	}
	const checks = input.checks.map((binding) => {
		const check = packaged.find(
			(entry) => entry.packId === binding.packId && entry.checkId === binding.checkId,
		);
		if (!check || check.checkDigest !== binding.checkDigest) {
			throw new Error("Gate Evaluation Package Check binding is stale or unknown.");
		}
		for (const selection of binding.inputs) {
			if (selection.status !== "ready" || selection.stale || selection.truncated) {
				throw new Error("Gate Evaluation Package input coverage is incomplete or stale.");
			}
		}
		const selections = normalizeCheckInputSelections(check, binding.inputs);
		const inputDigest = canonicalJsonDigest(
			selections.map((selection) => selection.selectionDigest),
		);
		const body = {
			packId: binding.packId,
			checkId: binding.checkId,
			checkDigest: binding.checkDigest,
			execution: normalizeExecutionIdentity(binding.execution),
			inputs: selections,
			inputDigest,
		};
		return Object.freeze({...body, bindingDigest: canonicalJsonDigest(body)});
	}).sort(compareCheckBindings);
	if (new Set(checks.map((binding) => `${binding.packId}:${binding.checkId}`)).size !== checks.length) {
		throw new Error("Gate Evaluation Package Check identity is duplicated.");
	}
	const sources = normalizeSources(input.sources);
	const stageBindings = normalizeStageBindings(input.stageBindings);
	const body = {
		protocol: GATE_EVALUATION_PACKAGE_PROTOCOL,
		stage: input.subject.stage,
		subject: input.subject,
		checkPackSnapshot: input.checkPackSnapshot,
		sources,
		stageBindings,
		checks: Object.freeze(checks),
		coverage: "complete" as const,
	};
	const serialized = canonicalJson(body);
	const bytes = Buffer.byteLength(serialized, "utf8");
	if (bytes > MAX_GATE_EVALUATION_PACKAGE_BYTES) {
		throw new Error(
			`Gate Evaluation Package exceeds ${MAX_GATE_EVALUATION_PACKAGE_BYTES} bytes.`,
		);
	}
	if (serialized.includes("pch:")) {
		throw new Error("Gate Evaluation Package cannot contain Project Context handles.");
	}
	// SAFETY: body has the complete validated package shape and packageDigest binds its canonical bytes.
	return toCanonicalJsonValue({
		...body,
		packageDigest: canonicalJsonDigest(body),
	}) as unknown as GateEvaluationPackage;
}

export function assertGateEvaluationPackage(value: GateEvaluationPackage): void {
	if (
		canonicalJson(value.protocol) !== canonicalJson(GATE_EVALUATION_PACKAGE_PROTOCOL) ||
		value.coverage !== "complete" ||
		value.stage !== value.subject.stage ||
		value.stageBindings.stage !== value.stage
	) {
		throw new Error("Gate Evaluation Package protocol or stage is invalid.");
	}
	const recreated = createGateEvaluationPackage({
		subject: value.subject,
		checkPackSnapshot: value.checkPackSnapshot,
		sources: value.sources,
		stageBindings: value.stageBindings,
		checks: value.checks.map((binding) => ({
			packId: binding.packId,
			checkId: binding.checkId,
			checkDigest: binding.checkDigest,
			execution: binding.execution,
			inputs: binding.inputs,
		})),
	});
	if (canonicalJson(recreated) !== canonicalJson(value)) {
		throw new Error("Gate Evaluation Package digest or binding is invalid.");
	}
}

function normalizeSources(value: GateEvaluationSourceHeads): GateEvaluationSourceHeads {
	return Object.freeze({
		workStateDigest: assertSha256Digest(value.workStateDigest, "Gate package WorkState digest"),
		knowledgeStateDigest: assertSha256Digest(value.knowledgeStateDigest, "Gate package Knowledge State digest"),
		knowledgeProjectionDigest: assertSha256Digest(value.knowledgeProjectionDigest, "Gate package Knowledge projection digest"),
		alignmentDigest: assertSha256Digest(value.alignmentDigest, "Gate package Alignment digest"),
		repositoryTreeDigest: assertSha256Digest(value.repositoryTreeDigest, "Gate package repository tree digest"),
		repositoryBase: boundedText(value.repositoryBase, "repository base", 256),
		evidenceDigest: assertSha256Digest(value.evidenceDigest, "Gate package Evidence digest"),
		resultsDigest: assertSha256Digest(value.resultsDigest, "Gate package Results digest"),
		configurationDigest: assertSha256Digest(value.configurationDigest, "Gate package configuration digest"),
		routesDigest: assertSha256Digest(value.routesDigest, "Gate package routes digest"),
	});
}

function normalizeStageBindings(value: GateEvaluationStageBindings): GateEvaluationStageBindings {
	const normalized = Object.fromEntries(Object.entries(value).map(([key, entry]) => [
		key,
		key === "stage" ? entry : assertSha256Digest(entry, `Gate package ${key}`),
	]));
	// SAFETY: every non-stage member of the closed stage-binding union is validated as a digest above.
	return Object.freeze(normalized) as unknown as GateEvaluationStageBindings;
}

function boundedText(value: unknown, field: string, maximum: number): string {
	if (typeof value !== "string" || value.length === 0 || value.length > maximum || value.trim() !== value) {
		throw new Error(`Gate Evaluation Package ${field} is invalid.`);
	}
	return value;
}

function compareCheckBindings(left: GateEvaluationCheckBinding, right: GateEvaluationCheckBinding): number {
	return compareText(left.packId, right.packId) || compareText(left.checkId, right.checkId);
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}
