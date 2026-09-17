import {canonicalJson, isCanonicalObject} from "../data-contracts/canonical-json.ts";
import type {Outcome} from "../data-contracts/outcome.ts";
import {booleanField, decodeContract, literalField, requiredField} from "../data-contracts/validation.ts";
import {CHANGEKERNEL_VERSION} from "../identity/version.ts";
import {decodeCheckResult, prepareCheckSelection, reduceCheckResults} from "./checks.ts";
import {DECISION_INPUTS, DECISION_LIMITS, DECISION_MODEL_STRUCTURE, decisionValidatorDefinitions, decisionValidatorPromptPrefix} from "./decision-validators.ts";
import {CONTRACT, LIMITS, RESULT_FIELDS, admit, bounds, codec, compare, digest, digests, effectKinds, equal, fail, hash, inputSlots, list, record, resultFields, projectStateReference, subject, text} from "./evaluation-data.ts";

export const DECISION_INPUT_PROTOCOL = "changekernel.decision-validation-input@1.0.0";
export const DECISION_RESULT_PROTOCOL = "changekernel.decision-validation-result@1.0.0";
const ADMISSION_LIMITS = {...LIMITS, maximumDepth: 40, maximumNodes: 524288, maximumTextBytes: 8 * 1024 * 1024};

const result = codec(DECISION_RESULT_PROTOCOL, [...RESULT_FIELDS, "owner", "stage", "kernelVersion", "kernelBuildDigest", "definitionDigest"], r => ({
	...resultFields(r), owner: literalField(CONTRACT, r, "owner", ["backend"] as const), stage: literalField(CONTRACT, r, "stage", ["decision"] as const),
	kernelVersion: text(r, "kernelVersion", 64), kernelBuildDigest: digest(r, "kernelBuildDigest"), definitionDigest: digest(r, "definitionDigest"),
}));
export const createDecisionValidationResult = result.create;
export const decodeDecisionValidationResult = result.decode;
export type DecisionValidationResult = ReturnType<typeof result.create> extends Outcome<infer T, unknown> ? T : never;

/**
 * Private pure admission, not source authentication or permission. The trusted host
 * must supply current facts and retained domain Check results, verify source custody and
 * authorize the exact binding. Caller labels and self-consistent hashes do not do so.
 * This first bounded slice requires domain assessment before common assessment.
 */
export function prepareDecisionValidation(input: unknown) {
	return decodeContract("Decision validation", input, value => {
		const r = record(value, ["current", "configuration", "slots", "domain"]);
		const c = record(requiredField(CONTRACT, r, "current"), ["snapshot", "subject", "stage", "effects", "effectsComplete", "kernelBuildDigest", "permissionDigests"]);
		const current = Object.freeze({snapshot: projectStateReference(requiredField(CONTRACT, c, "snapshot")), subject: subject(requiredField(CONTRACT, c, "subject")),
			stage: literalField(CONTRACT, c, "stage", ["decision"] as const), effects: effectKinds(c), effectsComplete: booleanField(CONTRACT, c, "effectsComplete"),
			kernelBuildDigest: digest(c, "kernelBuildDigest"), permissionDigests: digests(c, "permissionDigests")});
		if (!equal(current.snapshot, current.subject.baseline)) fail("Proposed Change comparison state differs from Current Project state.");
		const config = record(requiredField(CONTRACT, r, "configuration"), ["dependenciesDigest", "permissionDigest", "limits", "model"]);
		const route = record(requiredField(CONTRACT, config, "model"), ["routeDigest", "settingsDigest"]);
		const configuration = Object.freeze({dependenciesDigest: digest(config, "dependenciesDigest"), permissionDigest: digest(config, "permissionDigest"),
			limits: bounds(requiredField(CONTRACT, config, "limits")), model: Object.freeze({routeDigest: digest(route, "routeDigest"), settingsDigest: digest(route, "settingsDigest")})});
		for (const key of Object.keys(DECISION_LIMITS) as (keyof typeof DECISION_LIMITS)[]) if (configuration.limits[key] > DECISION_LIMITS[key]) fail("Decision execution exceeds release-owned limits.");
		if (configuration.limits.modelCalls !== 1 || !current.permissionDigests.includes(configuration.permissionDigest)) fail("Decision requires one bounded model capability and current permission binding.");

		const domainCheckAssessment = record(requiredField(CONTRACT, r, "domain"), ["selection", "results"]);
		const domainCheckSelection = admit(prepareCheckSelection(domainCheckAssessment.selection));
		const domainCheckReduction = admit(reduceCheckResults(domainCheckAssessment));
		for (const key of ["snapshot", "subject", "stage", "effects", "effectsComplete", "kernelBuildDigest"] as const) {
			if (!equal(current[key], domainCheckSelection.current[key])) fail("Domain Check assessments differ from the exact current Decision subject or stage.");
		}
		const domainCheckResults = Object.freeze([...list(domainCheckAssessment, "results", value => admit(decodeCheckResult(value)))].sort((a, b) => compare(a.checkId, b.checkId)));
		const domainCheckMaterial = Object.freeze({selectionDigest: domainCheckSelection.digest, reduction: domainCheckReduction,
			// Keep adopted Check questions, conditions, parameters, exact inputs and limits,
			// not only favorable result summaries. These are data, never instructions.
			selection: requiredField(CONTRACT, domainCheckAssessment, "selection"), results: domainCheckResults});
		const slots = inputSlots(r), missing: string[] = [];
		if (slots.length !== DECISION_INPUTS.length) fail("Every release-owned Decision input needs data or an explicit omission.");
		for (const [index, declaration] of DECISION_INPUTS.entries()) {
			const slot = slots[index];
			if (!slot || slot.name !== declaration.name) fail("Decision source roles differ from the release-owned contract.");
			if (slot.status !== "available" || slot.omissions.length) {missing.push(slot.name); continue;}
			if (declaration.type === "array" ? !Array.isArray(slot.value) : !isCanonicalObject(slot.value)) fail("Decision data differs from its required structure.");
		}
		const evidenceDigests = Object.freeze([...new Set(slots.flatMap(slot => slot.evidenceDigests))].sort(compare));
		if (!evidenceDigests.length) missing.push("evidence");
		if (!current.effectsComplete) missing.push("actual-effects");
		if (domainCheckResults.some(result => result.evidenceDigests.some(digest => !evidenceDigests.includes(digest)))) missing.push("domain-evidence");
		if (!domainCheckReduction.passed) missing.push("required-domain-assessment");
		const readiness = missing.length ? "unready" as const : "ready" as const;
		const definitions = decisionValidatorDefinitions(configuration.dependenciesDigest);
		const inputs = Object.freeze(definitions.map(definition => {
			const executionDigest = hash("changekernel.decision-validation-execution@1.0.0", {owner: "backend", stage: "decision", kernelVersion: CHANGEKERNEL_VERSION,
				kernelBuildDigest: current.kernelBuildDigest, definitionDigest: definition.digest, configuration});
			const body = Object.freeze({protocol: DECISION_INPUT_PROTOCOL, owner: "backend", stage: "decision", kernelVersion: CHANGEKERNEL_VERSION,
				checkId: definition.checkId, definitionDigest: definition.digest, kernelBuildDigest: current.kernelBuildDigest, permissionDigest: configuration.permissionDigest,
				executionDigest, subject: current.subject, effects: current.effects, effectsComplete: current.effectsComplete,
				configurationDigest: hash("changekernel.decision-validation-configuration@1.0.0", configuration), slots, domain: domainCheckMaterial});
			const input = Object.freeze({...body, digest: hash(body.protocol, body)}), encoded = canonicalJson({input, parameters: {}});
			if (!encoded.ok || new TextEncoder().encode(encoded.value).length > configuration.limits.inputBytes) fail("Decision material exceeds its complete execution input budget; no truncation is permitted.");
			const prompt = decisionValidatorPromptPrefix(definition.checkId) + JSON.stringify(input);
			const request = canonicalJson({prompt, shape: DECISION_MODEL_STRUCTURE});
			if (!request.ok || new TextEncoder().encode(prompt).length > configuration.limits.inputBytes ||
				new TextEncoder().encode(request.value).length + 1024 > configuration.limits.modelInputTokens) fail("The complete Decision prompt and model reserve exceed the authorized input budget.");
			return input;
		}));
		const entries = Object.freeze(inputs.map(input => Object.freeze({checkId: input.checkId, definitionDigest: input.definitionDigest, inputDigest: input.digest,
			executionDigest: input.executionDigest, readiness, missing: Object.freeze([...missing]), evidenceDigests, outputBytes: configuration.limits.outputBytes})));
		const identity = {protocol: "changekernel.decision-validation-selection@1.0.0", current, configuration, entries, domain: domainCheckReduction};
		return Object.freeze({...identity, digest: hash(identity.protocol, identity), definitions, inputs});
	}, ADMISSION_LIMITS);
}

/** No execution or approval. Only host-authenticated, durably retained results belong here. */
export function reduceDecisionValidation(input: unknown) {
	return decodeContract("Decision result admission", input, value => {
		const r = record(value, ["selection", "results"]), selection = admit(prepareDecisionValidation(r.selection));
		const results = list(r, "results", value => admit(decodeDecisionValidationResult(value))), seen = new Set<string>();
		for (const result of results) {
			const entry = selection.entries.find(entry => entry.checkId === result.checkId), encoded = canonicalJson(result);
			if (!entry || seen.has(result.checkId) || entry.readiness !== "ready" || entry.inputDigest !== result.inputDigest || entry.executionDigest !== result.executionDigest ||
				entry.definitionDigest !== result.definitionDigest || result.kernelVersion !== CHANGEKERNEL_VERSION || result.kernelBuildDigest !== selection.current.kernelBuildDigest ||
				result.producerId !== "changekernel:producer:linux-check-host" || result.evidenceDigests.some(digest => !entry.evidenceDigests.includes(digest)) ||
				!encoded.ok || new TextEncoder().encode(encoded.value).length > entry.outputBytes) fail("Backend result does not uniquely match a ready release-owned Decision evaluation.");
			seen.add(result.checkId);
		}
		const blockers: string[] = [], failed: string[] = [];
		for (const entry of selection.entries) {
			if (entry.readiness !== "ready") {blockers.push(`unready:${entry.checkId}`); continue;}
			const result = results.find(result => result.checkId === entry.checkId);
			if (!result || result.status !== "completed") blockers.push(`${result ? "operational-error" : "missing-result"}:${entry.checkId}`);
			else if (!result.passed) failed.push(entry.checkId);
		}
		const backend = Object.freeze({passed: !blockers.length && !failed.length, blockers: Object.freeze(blockers), failed: Object.freeze(failed),
			resultDigests: Object.freeze(results.map(result => result.digest).sort(compare))});
		return Object.freeze({selectionDigest: selection.digest, passed: backend.passed && selection.domain.passed, backend, domain: selection.domain});
	}, ADMISSION_LIMITS);
}
