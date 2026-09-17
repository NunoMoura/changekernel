import {canonicalJson, isCanonicalObject, type CanonicalValue} from "../data-contracts/canonical-json.ts";
import type {Outcome} from "../data-contracts/outcome.ts";
import {booleanField, decodeContract, integerField, literalField, requiredField, textField, type CanonicalRecord} from "../data-contracts/validation.ts";
import {CONTRACT, LIMITS, RESULT_FIELDS, admit, bounds, codec, compare, digest, digests, effectKinds, equal, fail, hash, id, inputSlots, list, ordered, record, resultFields, snapshot, source, subject, text} from "./evaluation-data.ts";

export const CHECK_PROTOCOL = "changekernel.check@1.0.0";
export const CHECK_PACK_PROTOCOL = "changekernel.check-pack@1.0.0";
export const CHECK_ADOPTION_PROTOCOL = "changekernel.check-adoption@1.0.0";
export const CHECK_INPUT_PROTOCOL = "changekernel.check-input@1.0.0";
export const CHECK_RESULT_PROTOCOL = "changekernel.check-result@1.0.0";
const STAGES = ["decision", "planning", "implementation", "review"] as const;

function version(r: CanonicalRecord): string {
	return textField(CONTRACT, r, "version", "$", {maximumBytes: 64, pattern: /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[A-Za-z0-9.-]+)?$/u});
}
function pin(value: CanonicalValue) {
	const r = record(value, ["checkId", "version", "definitionDigest"]);
	return Object.freeze({checkId: id(r, "checkId"), version: version(r), definitionDigest: digest(r, "definitionDigest")});
}
const definition = codec(CHECK_PROTOCOL, ["checkId", "version", "question", "passingCondition", "inputs", "resultProtocol", "activation", "implementation", "limits"], r => {
	const inputs = list(r, "inputs", value => {
		const slot = record(value, ["name", "type", "required", "selection", "maximumBytes"]);
		return Object.freeze({name: id(slot, "name"), type: literalField(CONTRACT, slot, "type", ["object", "array", "string", "number", "boolean"] as const),
			required: booleanField(CONTRACT, slot, "required"), selection: text(slot, "selection"), maximumBytes: integerField(CONTRACT, slot, "maximumBytes", "$", 1, 262144)});
	});
	ordered(inputs.map(input => input.name));
	const activation = record(requiredField(CONTRACT, r, "activation"), ["stages", "effectKinds"]);
	const stages = list(activation, "stages", value => literalField(CONTRACT, {value}, "value", STAGES));
	const effectKinds = list(activation, "effectKinds", value => id({value}, "value"));
	ordered(stages); ordered(effectKinds);
	if (!stages.length) fail("A Check must declare at least one activation stage.");
	const implementation = record(requiredField(CONTRACT, r, "implementation"), ["runtime", "artifactDigest", "dependenciesDigest"]);
	return {checkId: id(r, "checkId"), version: version(r), question: text(r, "question"), passingCondition: text(r, "passingCondition"), inputs, resultProtocol: literalField(CONTRACT, r, "resultProtocol", [CHECK_RESULT_PROTOCOL] as const),
		activation: Object.freeze({stages, effectKinds}), implementation: Object.freeze({runtime: literalField(CONTRACT, implementation, "runtime", ["javascript"] as const),
			artifactDigest: digest(implementation, "artifactDigest"), dependenciesDigest: digest(implementation, "dependenciesDigest")}), limits: bounds(requiredField(CONTRACT, r, "limits"))};
});
export const createCheckDefinition = definition.create;
export const decodeCheckDefinition = definition.decode;
export type CheckDefinition = ReturnType<typeof definition.create> extends Outcome<infer T, unknown> ? T : never;

const pack = codec(CHECK_PACK_PROTOCOL, ["packId", "version", "checks"], r => {
	const checks = list(r, "checks", pin); ordered(checks.map(check => check.checkId));
	if (!checks.length) fail("A Pack must distribute at least one Check.");
	return {packId: id(r, "packId"), version: version(r), checks};
});
export const createCheckPack = pack.create;
export const decodeCheckPack = pack.decode;
export type CheckPack = ReturnType<typeof pack.create> extends Outcome<infer T, unknown> ? T : never;

const adoption = codec(CHECK_ADOPTION_PROTOCOL, ["wiki", "adoptedBy", "reason", "checks"], r => {
	const wiki = source(requiredField(CONTRACT, r, "wiki")), adoptedBy = source(requiredField(CONTRACT, r, "adoptedBy"));
	if (!wiki.path.startsWith(".changekernel/wiki/") || !adoptedBy.path.startsWith(".changekernel/changes/") || wiki.snapshot.repositoryId !== adoptedBy.snapshot.repositoryId) fail("Adoption requires Wiki policy and its responsible Change in the same Project.");
	const checks = list(r, "checks", value => {
		const entry = record(value, ["check", "packDigest", "parameters", "limits", "model", "permissionDigest"]);
		const modelValue = requiredField(CONTRACT, entry, "model");
		const model = modelValue === null ? null : (() => {
			const m = record(modelValue, ["routeDigest", "settingsDigest"]);
			return Object.freeze({routeDigest: digest(m, "routeDigest"), settingsDigest: digest(m, "settingsDigest")});
		})();
		const limits = bounds(requiredField(CONTRACT, entry, "limits"));
		if ((limits.modelCalls > 0) !== (model !== null)) fail("Model execution requires an exact route and settings; computation does not.");
		return Object.freeze({check: pin(requiredField(CONTRACT, entry, "check")), packDigest: digest(entry, "packDigest"),
			parameters: requiredField(CONTRACT, entry, "parameters"), limits, model, permissionDigest: digest(entry, "permissionDigest")});
	});
	ordered(checks.map(entry => entry.check.checkId));
	return {wiki, adoptedBy, reason: text(r, "reason"), checks};
});
export const createCheckAdoption = adoption.create;
export const decodeCheckAdoption = adoption.decode;
export type CheckAdoption = ReturnType<typeof adoption.create> extends Outcome<infer T, unknown> ? T : never;

const inputContract = codec(CHECK_INPUT_PROTOCOL, ["checkId", "definitionDigest", "adoptionDigest", "subject", "stage", "effects", "effectsComplete", "kernelBuildDigest", "permissionDigest", "executionDigest", "slots"], r => {
	const slots = inputSlots(r);
	return {checkId: id(r, "checkId"), definitionDigest: digest(r, "definitionDigest"), adoptionDigest: digest(r, "adoptionDigest"),
		subject: subject(requiredField(CONTRACT, r, "subject")), stage: literalField(CONTRACT, r, "stage", STAGES), effects: effectKinds(r),
		effectsComplete: booleanField(CONTRACT, r, "effectsComplete"), kernelBuildDigest: digest(r, "kernelBuildDigest"), permissionDigest: digest(r, "permissionDigest"),
		executionDigest: digest(r, "executionDigest"), slots};
});
export const createCheckInput = inputContract.create;
export const decodeCheckInput = inputContract.decode;
export type CheckInput = ReturnType<typeof inputContract.create> extends Outcome<infer T, unknown> ? T : never;

/** A derived execution identity, not permission or proof of containment. */
export function checkExecutionDigest(input: unknown) {
	return decodeContract(CONTRACT, input, value => {
		const r = record(value, ["definition", "adoption", "checkId", "kernelBuildDigest"]);
		const d = admit(decodeCheckDefinition(r.definition)), a = admit(decodeCheckAdoption(r.adoption));
		const selected = a.checks.find(entry => entry.check.checkId === id(r, "checkId"));
		if (!selected || selected.check.definitionDigest !== d.digest || selected.check.version !== d.version || selected.check.checkId !== d.checkId) fail("Check is not adopted at this exact definition.");
		for (const key of Object.keys(d.limits) as (keyof typeof d.limits)[]) if (selected.limits[key] > d.limits[key]) fail("Adoption exceeds declared execution limits.");
		return hash("changekernel.check-execution@1.0.0", {definition: d.digest, adoption: a.digest, selected, kernelBuildDigest: digest(r, "kernelBuildDigest")});
	}, LIMITS);
}

/**
 * Pure admission only. The host must authenticate current (not candidate) adoption,
 * actual effects, permissions and source bytes. Neither installed Packs nor these
 * self-consistent hashes supply that authority. All adopted entries are required.
 */
export function prepareCheckSelection(input: unknown) {
	return decodeContract(CONTRACT, input, value => {
		const r = record(value, ["current", "adoption", "packs", "definitions", "inputs"]);
		const current = record(requiredField(CONTRACT, r, "current"), ["snapshot", "adoptionDigest", "kernelBuildDigest", "subject", "stage", "effects", "effectsComplete", "permissionDigests"]);
		const currentSnapshot = snapshot(requiredField(CONTRACT, current, "snapshot"));
		const permissions = digests(current, "permissionDigests");
		const currentSubject = subject(requiredField(CONTRACT, current, "subject"));
		const currentStage = literalField(CONTRACT, current, "stage", STAGES);
		const currentEffects = effectKinds(current), effectsComplete = booleanField(CONTRACT, current, "effectsComplete");
		const kernelBuildDigest = digest(current, "kernelBuildDigest");
		if (!equal(currentSubject.baseline, currentSnapshot)) fail("Current subject baseline differs from governing snapshot.");
		const a = admit(decodeCheckAdoption(r.adoption));
		if (a.digest !== digest(current, "adoptionDigest") || !equal(a.wiki.snapshot, currentSnapshot)) fail("Only the exact current adopted Wiki may select Checks.");
		const packs = list(r, "packs", value => admit(decodeCheckPack(value)));
		const definitions = list(r, "definitions", value => admit(decodeCheckDefinition(value)));
		const inputs = list(r, "inputs", value => admit(decodeCheckInput(value)));
		ordered(packs.map(p => p.digest)); ordered(definitions.map(d => d.checkId)); ordered(inputs.map(i => i.checkId));
		if (definitions.length !== a.checks.length || inputs.length !== a.checks.length) fail("Every adopted Check needs exactly one definition and input record.");
		const usedPacks = [...new Set(a.checks.map(entry => entry.packDigest))].sort(compare);
		if (!equal(usedPacks, packs.map(p => p.digest))) fail("Only exactly adopted Packs belong in the selection.");
		const entries = a.checks.map((entry, index) => {
			const d = definitions[index], i = inputs[index];
			if (!d || !i) fail("An adopted Check is missing its definition or inputs.");
			const p = packs.find(p => p.digest === entry.packDigest);
			if (!p || !p.checks.some(check => equal(check, entry.check)) || d.checkId !== entry.check.checkId || d.digest !== entry.check.definitionDigest || d.version !== entry.check.version) fail("Pack and definition must match the exact adopted pin.");
			const executionDigest = admit(checkExecutionDigest({definition: d, adoption: a, checkId: d.checkId, kernelBuildDigest}));
			if (i.checkId !== d.checkId || i.definitionDigest !== d.digest || i.adoptionDigest !== a.digest || i.executionDigest !== executionDigest || i.permissionDigest !== entry.permissionDigest || i.kernelBuildDigest !== kernelBuildDigest || !equal(i.subject, currentSubject) || !permissions.includes(i.permissionDigest) || !equal(i.subject.baseline, currentSnapshot)) fail("Input differs from current exact evaluation bindings.");
			if (i.stage !== currentStage || !equal(i.effects, currentEffects) || i.effectsComplete !== effectsComplete) fail("Input activation facts differ from current host-observed facts.");
			if (i.slots.length !== d.inputs.length) fail("Every declared input needs data or an explicit omission.");
			const missing: string[] = [];
			for (const [slotIndex, declared] of d.inputs.entries()) {
				const slot = i.slots[slotIndex];
				if (!slot) fail("A declared input slot is missing.");
				if (slot.name !== declared.name) fail("Input slot selection differs from the definition.");
				if (slot.status !== "available") {if (declared.required) missing.push(slot.name); continue;}
				let type: string = typeof slot.value;
				if (Array.isArray(slot.value)) type = "array";
				else if (isCanonicalObject(slot.value)) type = "object";
				else if (slot.value === null) type = "null";
				const encoded = canonicalJson(slot.value);
				if (type !== declared.type || !encoded.ok || new TextEncoder().encode(encoded.value).length > declared.maximumBytes) fail("Input data violates its declared structure or byte bound.");
				if (declared.required && slot.omissions.length > 0) missing.push(slot.name);
			}
			const encoded = canonicalJson(i);
			if (!encoded.ok || new TextEncoder().encode(encoded.value).length > entry.limits.inputBytes) fail("Input exceeds the adopted execution budget.");
			const stageApplies = d.activation.stages.includes(i.stage);
			const match = d.activation.effectKinds.length === 0 || d.activation.effectKinds.some(kind => i.effects.includes(kind));
			let applicability: "inactive" | "active" | "unknown" = "unknown";
			if (!stageApplies || (!match && i.effectsComplete)) applicability = "inactive";
			else if (match) applicability = "active";
			let readiness: "not-applicable" | "unready" | "ready" = "unready";
			if (applicability === "inactive") readiness = "not-applicable";
			else if (applicability === "active" && missing.length === 0) readiness = "ready";
			return Object.freeze({checkId: d.checkId, inputDigest: i.digest, executionDigest, applicability, readiness,
				missing: Object.freeze(missing), evidenceDigests: Object.freeze([...new Set(i.slots.flatMap(slot => slot.evidenceDigests))].sort(compare)), outputBytes: entry.limits.outputBytes});
		});
		const body = {protocol: "changekernel.check-selection@1.0.0", adoptionDigest: a.digest, current, entries: Object.freeze(entries)};
		return Object.freeze({...body, digest: hash(body.protocol, body)});
	}, {...LIMITS, maximumNodes: 262144, maximumTextBytes: 4 * 1024 * 1024});
}

const result = codec(CHECK_RESULT_PROTOCOL, RESULT_FIELDS, resultFields);
export const createCheckResult = result.create;
export const decodeCheckResult = result.decode;
export type CheckResult = ReturnType<typeof result.create> extends Outcome<infer T, unknown> ? T : never;

/** Rebuild selection, then reduce exact retained results. No execution or approval. */
export function reduceCheckResults(input: unknown) {
	return decodeContract(CONTRACT, input, value => {
		const r = record(value, ["selection", "results"]);
		const selection = admit(prepareCheckSelection(r.selection));
		const results = list(r, "results", value => admit(decodeCheckResult(value)));
		const seen = new Set<string>();
		for (const result of results) {
			const entry = selection.entries.find(entry => entry.checkId === result.checkId);
			const encoded = canonicalJson(result);
			if (!entry || seen.has(result.checkId) || entry.readiness !== "ready" || entry.inputDigest !== result.inputDigest || entry.executionDigest !== result.executionDigest || result.evidenceDigests.some(d => !entry.evidenceDigests.includes(d)) || !encoded.ok || new TextEncoder().encode(encoded.value).length > entry.outputBytes) fail("Result does not uniquely match a ready exact input, execution, Evidence set and output budget.");
			seen.add(result.checkId);
		}
		const blockers: string[] = [], failed: string[] = [];
		let evaluated = 0;
		for (const entry of selection.entries) {
			if (entry.applicability === "inactive") continue;
			if (entry.readiness !== "ready") {blockers.push(`unready:${entry.checkId}`); continue;}
			const result = results.find(result => result.checkId === entry.checkId);
			if (!result || result.status !== "completed") {blockers.push(`${result ? "operational-error" : "missing-result"}:${entry.checkId}`); continue;}
			evaluated++;
			if (!result.passed) failed.push(entry.checkId);
		}
		if (evaluated === 0) blockers.push("no-validation");
		return Object.freeze({selectionDigest: selection.digest, passed: blockers.length === 0 && failed.length === 0,
			blockers: Object.freeze(blockers.sort(compare)), failed: Object.freeze(failed), resultDigests: Object.freeze(results.map(result => result.digest).sort(compare))});
	}, {...LIMITS, maximumDepth: 36, maximumNodes: 524288, maximumTextBytes: 8 * 1024 * 1024});
}
