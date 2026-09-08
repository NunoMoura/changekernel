import {isNamespacedIdentifier, type ContractIssue} from "../data-contracts/validation.ts";
import {canonicalJson, type CanonicalPrimitive} from "../data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../data-contracts/outcome.ts";
import {semanticDigest, type SemanticIdentityIssue} from "../identity/semantic-digest.ts";
import type {Sha256Digest} from "../identity/sha256.ts";
import {CHANGE_REALIZATIONS, CHANGE_TYPES, type ChangeRealization, type ChangeType} from "../changes/contracts.ts";
import {
	checkRegistrationKey,
	CHECK_STAGES,
	createGate,
	decodeCheckRegistration,
	decodeGateSubject,
	type CheckRegistration,
	type CheckStage,
	type Gate,
	type GateInputReference,
	type GateOmission,
	type GateResolverIdentity,
	type GateSubject,
} from "./contracts.ts";

export const ACTIVE_CHECK_RESOLVER = Object.freeze({
	id: "codewiki:active-check-resolver",
	version: "1.0.0",
});

export interface ActiveCheckSelectionInput {
	readonly stage: CheckStage;
	readonly changeType: ChangeType;
	readonly realization: ChangeRealization;
	readonly subject: GateSubject;
	readonly workType: string | null;
	readonly registrations: readonly CheckRegistration[];
	readonly enabledProjectPacks: readonly string[];
}

export interface ActiveCheckSelection {
	readonly resolver: GateResolverIdentity;
	readonly availablePolicyDigest: Sha256Digest;
	readonly activeChecks: readonly CheckRegistration[];
	readonly omissions: readonly GateOmission[];
	readonly selectionComplete: true;
}

export interface ActiveCheckSelectionIssue {
	readonly code:
		| "ambiguous_registration"
		| "invalid_registration"
		| "invalid_selection"
		| "policy_digest_failed"
		| "product_shadowed";
	readonly path: string;
	readonly message: string;
}

export function resolveActiveChecks(
	input: ActiveCheckSelectionInput,
): Outcome<ActiveCheckSelection, ActiveCheckSelectionIssue> {
	const subject = decodeGateSubject(input.subject);
	if (!subject.ok || !CHECK_STAGES.includes(input.stage) || !CHANGE_TYPES.includes(input.changeType) || !CHANGE_REALIZATIONS.includes(input.realization)) {
		return failure(issue("invalid_selection", "$.subject", subject.ok ? "Selection literals are invalid." : subject.error.message));
	}
	const validWorkType = subject.value.kind === "work"
		? typeof input.workType === "string" && isNamespacedIdentifier(input.workType)
		: input.workType === null;
	if (!validWorkType) return failure(issue("invalid_selection", "$.workType", "Work type must be canonical and present exactly for Work subjects."));
	if (!Array.isArray(input.enabledProjectPacks) || input.enabledProjectPacks.length > 256 || !input.enabledProjectPacks.every((entry) => typeof entry === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(entry)) ||
		!isStrictlySortedUnique(input.enabledProjectPacks) || !Array.isArray(input.registrations) || input.registrations.length > 4_096) {
		return failure(issue("invalid_selection", "$", "Enabled Project packs or registration count is invalid."));
	}
	const registrations: CheckRegistration[] = [];
	const byKey = new Map<string, CheckRegistration>();
	for (let index = 0; index < input.registrations.length; index += 1) {
		const decoded = decodeCheckRegistration(input.registrations[index]);
		if (!decoded.ok) return failure(issue("invalid_registration", `$.registrations[${index}]`, decoded.error.message));
		const key = checkRegistrationKey(decoded.value);
		const previous = byKey.get(key);
		if (previous) {
			return failure(issue(
				previous.source !== decoded.value.source ? "product_shadowed" : "ambiguous_registration",
				`$.registrations[${index}]`,
				`Qualified Check identity ${key} is duplicated.`,
			));
		}
		byKey.set(key, decoded.value);
		registrations.push(decoded.value);
	}
	registrations.sort((left, right) => compareText(checkRegistrationKey(left), checkRegistrationKey(right)));
	const availablePolicyDigest = semanticDigest("codewiki.active-check-policy@1.0.0", {
		registrations: registrations.map((entry) => entry.registrationDigest),
		enabledProjectPacks: input.enabledProjectPacks,
	});
	if (!availablePolicyDigest.ok) return failure(issue("policy_digest_failed", "$.registrations", availablePolicyDigest.error.message));
	const activeChecks: CheckRegistration[] = [];
	const omissions: GateOmission[] = [];
	for (const registration of registrations) {
		if (registration.stage !== input.stage) continue;
		if (registration.source === "project" && !registration.universalSafety && !input.enabledProjectPacks.includes(registration.packId)) {
			omissions.push(Object.freeze({registrationDigest: registration.registrationDigest, reason: "optional_pack_disabled"}));
			continue;
		}
		if (!registration.universalSafety) {
			const missingFact = Object.keys(registration.applicability.facts).find((key) => !Object.hasOwn(input.subject.facts, key));
			if (missingFact !== undefined) return failure(issue("invalid_selection", `$.subject.facts.${missingFact}`, "Check applicability requires an absent subject fact."));
			if (!applies(registration, input)) {
				omissions.push(Object.freeze({registrationDigest: registration.registrationDigest, reason: "inapplicable"}));
				continue;
			}
		}
		activeChecks.push(registration);
	}
	activeChecks.sort((left, right) => compareText(checkRegistrationKey(left), checkRegistrationKey(right)));
	omissions.sort((left, right) => compareText(left.registrationDigest, right.registrationDigest));
	return success(Object.freeze({
		resolver: ACTIVE_CHECK_RESOLVER,
		availablePolicyDigest: availablePolicyDigest.value,
		activeChecks: Object.freeze(activeChecks),
		omissions: Object.freeze(omissions),
		selectionComplete: true,
	}));
}

export function createGateFromSelection(input: Readonly<{
	selectionInput: ActiveCheckSelectionInput;
	inputs: readonly GateInputReference[];
	kernelBuildDigest: Sha256Digest;
}>): Outcome<Gate, ActiveCheckSelectionIssue | ContractIssue | SemanticIdentityIssue> {
	const selection = resolveActiveChecks(input.selectionInput);
	if (!selection.ok) return selection;
	return createGate({
		stage: input.selectionInput.stage,
		subject: input.selectionInput.subject,
		selectionInputs: {
			changeType: input.selectionInput.changeType,
			realization: input.selectionInput.realization,
			workType: input.selectionInput.workType,
			enabledProjectPacks: input.selectionInput.enabledProjectPacks,
		},
		availablePolicyDigest: selection.value.availablePolicyDigest,
		resolver: selection.value.resolver,
		activeChecks: selection.value.activeChecks,
		inputs: input.inputs,
		omissions: selection.value.omissions,
		selectionComplete: selection.value.selectionComplete,
		kernelBuildDigest: input.kernelBuildDigest,
	});
}

function applies(registration: CheckRegistration, input: ActiveCheckSelectionInput): boolean {
	const applicability = registration.applicability;
	if (applicability.changeTypes.length > 0 && !applicability.changeTypes.includes(input.changeType)) return false;
	if (applicability.realizations.length > 0 && !applicability.realizations.includes(input.realization)) return false;
	if (applicability.subjectKinds.length > 0 && !applicability.subjectKinds.includes(input.subject.kind)) return false;
	if (applicability.workTypes.length > 0 && (input.workType === null || !applicability.workTypes.includes(input.workType))) return false;
	for (const [key, expected] of Object.entries(applicability.facts)) {
		const actual = input.subject.facts[key];
		if (!samePrimitive(actual, expected)) return false;
	}
	return true;
}

function samePrimitive(actual: unknown, expected: CanonicalPrimitive): boolean {
	if (typeof actual !== typeof expected) return false;
	if (typeof actual === "number" && typeof expected === "number") return Object.is(actual, expected);
	if (actual === expected) return true;
	const actualEncoded = canonicalJson(actual);
	const expectedEncoded = canonicalJson(expected);
	return actualEncoded.ok && expectedEncoded.ok && actualEncoded.value === expectedEncoded.value;
}

function isStrictlySortedUnique(values: readonly string[]): boolean {
	if (values.length > 1_024) return false;
	for (let index = 0; index < values.length; index += 1) {
		const value = values[index] ?? "";
		if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)) return false;
		if (index > 0 && (values[index - 1] ?? "") >= value) return false;
	}
	return true;
}

function issue(code: ActiveCheckSelectionIssue["code"], path: string, message: string): ActiveCheckSelectionIssue {
	return Object.freeze({code, path, message});
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
