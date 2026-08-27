import type {Sha256Digest} from "../utils/canonical-json.ts";
import {sha256Base32Nfc} from "../utils/base32.ts";
import {
	assertRequiredExactKeys as assertExactKeys,
	plainRecord as record,
} from "../utils/json.ts";
import {
	assertNfcString,
	canonicalSemanticJson,
	parseCanonicalSemanticJson,
	semanticDigest,
} from "../utils/semantic-digest.ts";
import {assertStableId} from "../project/git-store-profile.ts";

export const COMPLETION_REQUIREMENT_PROTOCOL =
	"codewiki.change-completion-requirement@1.0.0" as const;

export const COMPLETION_REQUIREMENT_KINDS = [
	"artifact",
	"evidence",
	"check",
	"integration",
	"delivery",
	"manual_confirmation",
] as const;

export type CompletionRequirementKind =
	(typeof COMPLETION_REQUIREMENT_KINDS)[number];

export interface ChangeCompletionRequirement {
	readonly requirementId: string;
	readonly ordinal: number;
	readonly kind: CompletionRequirementKind;
	readonly requiredOutcome: string;
	readonly targetRefs: readonly string[];
	readonly requiredEvidenceSchemas: readonly string[];
	readonly requiredCheckRefs: readonly string[];
	readonly pluginCapability: string | null;
	readonly dependencyIds: readonly string[];
	readonly accountableActorId: string;
	readonly deliveryRequired: boolean;
	readonly requirementDigest: Sha256Digest;
}

export interface CreateCompletionRequirementInput {
	readonly projectId: string;
	readonly changeId: string;
	readonly ordinal: number;
	readonly kind: CompletionRequirementKind;
	readonly requiredOutcome: string;
	readonly targetRefs: readonly string[];
	readonly requiredEvidenceSchemas?: readonly string[];
	readonly requiredCheckRefs?: readonly string[];
	readonly pluginCapability?: string | null;
	readonly dependencyIds?: readonly string[];
	readonly accountableActorId: string;
	readonly deliveryRequired?: boolean;
}

export function completionRequirementId(
	projectId: string,
	changeId: string,
	ordinal: number,
): string {
	assertStableId(projectId, "projectId");
	assertStableId(changeId, "changeId");
	assertOrdinal(ordinal);
	const encoded = sha256Base32Nfc(`${changeId}\0${ordinal}`, "requirement identity input");
	return `cw:${projectId}:requirement:${encoded}`;
}

export function createCompletionRequirement(
	input: CreateCompletionRequirementInput,
): ChangeCompletionRequirement {
	const body = {
		requirementId: completionRequirementId(
			input.projectId,
			input.changeId,
			input.ordinal,
		),
		ordinal: input.ordinal,
		kind: input.kind,
		requiredOutcome: input.requiredOutcome,
		targetRefs: [...input.targetRefs],
		requiredEvidenceSchemas: [...(input.requiredEvidenceSchemas ?? [])],
		requiredCheckRefs: [...(input.requiredCheckRefs ?? [])],
		pluginCapability: input.pluginCapability ?? null,
		dependencyIds: [...(input.dependencyIds ?? [])],
		accountableActorId: input.accountableActorId,
		deliveryRequired: input.deliveryRequired ?? false,
	};
	const value = parseCanonicalSemanticJson(canonicalSemanticJson({
		...body,
		requirementDigest: semanticDigest(COMPLETION_REQUIREMENT_PROTOCOL, body),
	}));
	assertCompletionRequirement(value, {
		projectId: input.projectId,
		changeId: input.changeId,
	});
	return value;
}

export function assertCompletionRequirement(
	value: unknown,
	context: {readonly projectId: string; readonly changeId: string},
): asserts value is ChangeCompletionRequirement {
	const requirement = record(value, "Completion Requirement");
	assertExactKeys(requirement, [
		"accountableActorId",
		"deliveryRequired",
		"dependencyIds",
		"kind",
		"ordinal",
		"pluginCapability",
		"requiredCheckRefs",
		"requiredEvidenceSchemas",
		"requiredOutcome",
		"requirementDigest",
		"requirementId",
		"targetRefs",
	]);
	assertOrdinal(requirement.ordinal);
	const expectedId = completionRequirementId(
		context.projectId,
		context.changeId,
		requirement.ordinal,
	);
	if (requirement.requirementId !== expectedId) {
		throw new Error("Completion Requirement ID does not match Change and ordinal.");
	}
	if (!COMPLETION_REQUIREMENT_KINDS.includes(requirement.kind as CompletionRequirementKind)) {
		throw new Error("Completion Requirement kind is unsupported.");
	}
	assertNfcString(requirement.requiredOutcome, "requiredOutcome", 1, 16_384);
	assertSortedStableIds(requirement.targetRefs, "targetRefs", 1, 128);
	assertSortedProtocolIdentities(
		requirement.requiredEvidenceSchemas,
		"requiredEvidenceSchemas",
		64,
	);
	assertSortedStableIds(requirement.requiredCheckRefs, "requiredCheckRefs", 0, 128);
	if (requirement.pluginCapability !== null) {
		assertNamespacedValue(requirement.pluginCapability, "pluginCapability");
	}
	assertSortedStableIds(requirement.dependencyIds, "dependencyIds", 0, 128);
	assertStableId(requirement.accountableActorId, "accountableActorId");
	if (typeof requirement.deliveryRequired !== "boolean") {
		throw new Error("deliveryRequired must be boolean.");
	}
	if (
		requirement.kind === "delivery" &&
		requirement.deliveryRequired !== true
	) {
		throw new Error("Delivery requirements must set deliveryRequired.");
	}
	if (
		typeof requirement.requirementDigest !== "string" ||
		!/^sha256:[0-9a-f]{64}$/u.test(requirement.requirementDigest)
	) {
		throw new Error("requirementDigest must be a lowercase SHA-256 digest.");
	}
	const {requirementDigest, ...body} = requirement;
	if (
		requirementDigest !== semanticDigest(COMPLETION_REQUIREMENT_PROTOCOL, body)
	) {
		throw new Error("Completion Requirement digest mismatch.");
	}
}

export function assertCompletionRequirementSet(
	value: unknown,
	context: {readonly projectId: string; readonly changeId: string},
): asserts value is readonly ChangeCompletionRequirement[] {
	if (!Array.isArray(value) || value.length > 1024) {
		throw new Error("completionRequirements must contain 0..1024 entries.");
	}
	const ids = new Set<string>();
	for (const [index, requirement] of value.entries()) {
		assertCompletionRequirement(requirement, context);
		if (requirement.ordinal !== index) {
			throw new Error("Completion Requirement ordinals must equal array order.");
		}
		if (ids.has(requirement.requirementId)) {
			throw new Error("Completion Requirement IDs must be unique.");
		}
		ids.add(requirement.requirementId);
	}
	for (const requirement of value) {
		for (const dependencyId of requirement.dependencyIds) {
			if (!ids.has(dependencyId)) {
				throw new Error("Completion Requirement dependency must resolve in proposal.");
			}
			if (dependencyId === requirement.requirementId) {
				throw new Error("Completion Requirement cannot depend on itself.");
			}
		}
	}
}

function assertOrdinal(value: unknown): asserts value is number {
	if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 0xffff_ffff) {
		throw new Error("ordinal must be UInt32.");
	}
}

function assertSortedStableIds(
	value: unknown,
	field: string,
	minimum: number,
	maximum: number,
): asserts value is readonly string[] {
	assertSortedStrings(value, field, minimum, maximum, (entry, label) =>
		assertStableId(entry, label),
	);
}

function assertSortedProtocolIdentities(
	value: unknown,
	field: string,
	maximum: number,
): asserts value is readonly string[] {
	assertSortedStrings(value, field, 0, maximum, assertProtocolIdentity);
}

function assertProtocolIdentity(value: unknown, field: string): asserts value is string {
	assertNfcString(value, field, 1, 256);
	if (!/^[a-z][a-z0-9.-]*@[0-9]+\.[0-9]+\.[0-9]+$/u.test(value)) {
		throw new Error(`${field} must be a namespaced protocol identity with semantic version.`);
	}
}

function assertSortedStrings(
	value: unknown,
	field: string,
	minimum: number,
	maximum: number,
	assertEntry: (entry: unknown, field: string) => asserts entry is string,
): asserts value is readonly string[] {
	if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
		throw new Error(`${field} must contain ${minimum}..${maximum} entries.`);
	}
	let previous: string | undefined;
	for (const [index, entry] of value.entries()) {
		assertEntry(entry, `${field}[${index}]`);
		if (previous !== undefined && previous >= entry) {
			throw new Error(`${field} must be sorted and duplicate-free.`);
		}
		previous = entry;
	}
}

function assertNamespacedValue(value: unknown, field: string): asserts value is string {
	assertNfcString(value, field, 1, 256);
	if (!/^[A-Za-z][A-Za-z0-9_-]*(?:[.:/][A-Za-z0-9][A-Za-z0-9._:/-]*)+$/u.test(value)) {
		throw new Error(`${field} must be namespaced.`);
	}
}
