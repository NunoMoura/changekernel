import {canonicalJson, isCanonicalObject, type CanonicalValue} from "../data-contracts/canonical-json.ts";
import type {Outcome} from "../data-contracts/outcome.ts";
import {
	arrayField, booleanField, decodeContract, exactRecord, integerField, isNamespacedIdentifier,
	literalField, rejectContract, requiredField, textField, type CanonicalRecord, type ContractIssue,
} from "../data-contracts/validation.ts";
import {decodeGitOidValue} from "../identity/git.ts";
import {semanticDigest} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";

const CONTRACT = "Unified Check";
const LIMITS = Object.freeze({maximumDepth: 32, maximumNodes: 32768, maximumEntriesPerContainer: 256, maximumTextBytes: 512 * 1024});
export const CHECK_PROTOCOL = "changekernel.check@1.0.0";
export const CHECK_PACK_PROTOCOL = "changekernel.check-pack@1.0.0";
export const CHECK_ADOPTION_PROTOCOL = "changekernel.check-adoption@1.0.0";
export const CHECK_INPUT_PROTOCOL = "changekernel.check-input@1.0.0";
export const CHECK_RESULT_PROTOCOL = "changekernel.check-result@1.0.0";
const STAGES = ["decision", "planning", "implementation", "review"] as const;

function fail(message: string): never {return rejectContract("invalid_field", CONTRACT, "$", message);}
function admit<T>(result: Outcome<T, ContractIssue>): T {
	if (!result.ok) rejectContract(result.error.code, CONTRACT, result.error.path, result.error.message);
	return result.value;
}
function hash(domain: string, value: unknown): Sha256Digest {
	const result = semanticDigest(domain, value);
	if (!result.ok) fail(result.error.message);
	return result.value;
}
function digest(r: CanonicalRecord, key: string): Sha256Digest {
	const result = decodeSha256Digest(requiredField(CONTRACT, r, key));
	if (!result.ok) fail(`Invalid ${key} digest.`);
	return result.value;
}
function text(r: CanonicalRecord, key: string, maximumBytes = 4096): string {
	const value = textField(CONTRACT, r, key, "$", {maximumBytes});
	if (!value.trim() || /[\uD800-\uDFFF]/u.test(value)) fail(`Invalid ${key} text.`);
	return value;
}
function id(r: CanonicalRecord, key: string): string {
	const value = text(r, key, 256);
	if (!isNamespacedIdentifier(value)) fail(`Expected namespaced ${key}.`);
	return value;
}
function version(r: CanonicalRecord): string {
	return textField(CONTRACT, r, "version", "$", {maximumBytes: 64, pattern: /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[A-Za-z0-9.-]+)?$/u});
}
function compare(a: string, b: string): number {
	if (a === b) return 0;
	return a < b ? -1 : 1;
}
function ordered(values: readonly string[]): void {
	if (values.some((value, i) => i > 0 && (values[i - 1] ?? "") >= value)) fail("Entries must be sorted and unique.");
}
function list<T>(r: CanonicalRecord, key: string, parse: (value: CanonicalValue) => T, maximum = 64): readonly T[] {
	return Object.freeze(arrayField(CONTRACT, r, key, "$", maximum).map(parse));
}
function texts(r: CanonicalRecord, key: string): readonly string[] {
	return list(r, key, value => text({value}, "value"));
}
function digests(r: CanonicalRecord, key: string): readonly Sha256Digest[] {
	const values = list(r, key, value => digest({value}, "value")); ordered(values); return values;
}
function record(value: CanonicalValue, keys: readonly string[]): CanonicalRecord {return exactRecord(CONTRACT, value, "$", keys);}

/** The protocol domain is new; no old Gate or Finding bytes are reinterpreted. */
function codec<T>(protocol: string, fields: readonly string[], parse: (r: CanonicalRecord) => T) {
	const decode = (input: unknown) => decodeContract(CONTRACT, input, value => {
		const r = record(value, ["protocol", "digest", ...fields]);
		if (r.protocol !== protocol) rejectContract("invalid_protocol", CONTRACT, "$.protocol", `Expected ${protocol}.`);
		const body = Object.freeze({protocol, ...parse(r)});
		const identity = digest(r, "digest");
		if (identity !== hash(protocol, body)) fail("Record digest differs from its exact content.");
		return Object.freeze({...body, digest: identity});
	}, LIMITS);
	const create = (input: unknown) => decodeContract(CONTRACT, input, value => {
		const r = record(value, fields);
		const body = {protocol, ...parse(r)};
		return admit(decode({...body, digest: hash(protocol, body)}));
	}, LIMITS);
	return {create, decode};
}

function snapshot(value: CanonicalValue) {
	const r = record(value, ["repositoryId", "commit", "tree"]);
	const commit = decodeGitOidValue(requiredField(CONTRACT, r, "commit"));
	const tree = decodeGitOidValue(requiredField(CONTRACT, r, "tree"));
	if (commit.algorithm !== tree.algorithm) fail("Snapshot object formats differ.");
	return Object.freeze({repositoryId: id(r, "repositoryId"), commit, tree});
}
function source(value: CanonicalValue) {
	const r = record(value, ["snapshot", "path", "blob"]);
	const bound = snapshot(requiredField(CONTRACT, r, "snapshot"));
	const path = text(r, "path", 8192);
	if (path.startsWith("/") || path.includes("\\") || /[\u0000-\u001f]/u.test(path) || path.split("/").some(part => !part || part === "." || part === "..")) fail("Source path must be project-relative.");
	const blob = decodeGitOidValue(requiredField(CONTRACT, r, "blob"));
	if (blob.algorithm !== bound.commit.algorithm) fail("Source object formats differ.");
	return Object.freeze({snapshot: bound, path, blob});
}
function equal(left: unknown, right: unknown): boolean {return hash("changekernel.check-comparison@1.0.0", left) === hash("changekernel.check-comparison@1.0.0", right);}
function bounds(value: CanonicalValue) {
	const r = record(value, ["milliseconds", "memoryBytes", "inputBytes", "outputBytes", "modelCalls", "modelInputTokens", "modelOutputTokens"]);
	const number = (key: string, min: number, max: number) => integerField(CONTRACT, r, key, "$", min, max);
	const result = Object.freeze({milliseconds: number("milliseconds", 1, 3600000), memoryBytes: number("memoryBytes", 1, 2147483648),
		inputBytes: number("inputBytes", 1, 262144), outputBytes: number("outputBytes", 1, 65536), modelCalls: number("modelCalls", 0, 32),
		modelInputTokens: number("modelInputTokens", 0, 1048576), modelOutputTokens: number("modelOutputTokens", 0, 1048576)});
	if (result.modelCalls === 0 ? result.modelInputTokens !== 0 || result.modelOutputTokens !== 0 : result.modelInputTokens === 0 || result.modelOutputTokens === 0) fail("Model token budgets must agree with the call budget.");
	return result;
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

function subject(value: CanonicalValue) {
	const r = record(value, ["baseline", "candidate", "subjectDigest"]);
	const baseline = snapshot(requiredField(CONTRACT, r, "baseline")), candidate = snapshot(requiredField(CONTRACT, r, "candidate"));
	if (baseline.repositoryId !== candidate.repositoryId || baseline.commit.algorithm !== candidate.commit.algorithm) fail("Subject snapshots must share Project and object format.");
	return Object.freeze({baseline, candidate, subjectDigest: digest(r, "subjectDigest")});
}
function effectKinds(r: CanonicalRecord) {
	const effects = list(r, "effects", value => id({value}, "value")); ordered(effects); return effects;
}

const inputContract = codec(CHECK_INPUT_PROTOCOL, ["checkId", "definitionDigest", "adoptionDigest", "subject", "stage", "effects", "effectsComplete", "kernelBuildDigest", "permissionDigest", "executionDigest", "slots"], r => {
	const slots = list(r, "slots", value => {
		const slot = record(value, ["name", "status", "value", "sources", "evidenceDigests", "omissions"]);
		const status = literalField(CONTRACT, slot, "status", ["available", "missing", "stale", "denied"] as const);
		const data = requiredField(CONTRACT, slot, "value"), omissions = texts(slot, "omissions");
		if (status !== "available" && (data !== null || omissions.length === 0)) fail("Unavailable input needs explicit omissions, not fabricated data.");
		const sources = list(slot, "sources", source); ordered(sources.map(value => hash("changekernel.check-source@1.0.0", value)));
		return Object.freeze({name: id(slot, "name"), status, value: data, sources, evidenceDigests: digests(slot, "evidenceDigests"), omissions});
	});
	ordered(slots.map(slot => slot.name));
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

const result = codec(CHECK_RESULT_PROTOCOL, ["checkId", "inputDigest", "executionDigest", "producerId", "status", "passed", "failureKind", "feedback", "evidenceDigests", "limitations"], r => {
	const status = literalField(CONTRACT, r, "status", ["completed", "operational-error"] as const);
	const passed = r.passed === null ? null : booleanField(CONTRACT, r, "passed");
	const failureKind = r.failureKind === null ? null : literalField(CONTRACT, r, "failureKind", ["contradiction", "insufficient-support"] as const);
	if (status === "completed") {
		if (passed === null || (passed && failureKind !== null) || (!passed && failureKind === null)) fail("A completed Check needs a Boolean result and failure classification exactly when false.");
	} else if (passed !== null || failureKind !== null) fail("Operational errors cannot fabricate semantic results.");
	const feedbackRecord = record(requiredField(CONTRACT, r, "feedback"), ["summary", "where", "reason", "resolution", "preserve"]);
	const feedback = Object.freeze({summary: text(feedbackRecord, "summary"), where: text(feedbackRecord, "where"), reason: text(feedbackRecord, "reason"),
		resolution: feedbackRecord.resolution === null ? null : text(feedbackRecord, "resolution"), preserve: texts(feedbackRecord, "preserve")});
	const evidenceDigests = digests(r, "evidenceDigests");
	if (status === "completed" && evidenceDigests.length === 0) fail("Completed results require Evidence references; a digest is not proof of custody.");
	return {checkId: id(r, "checkId"), inputDigest: digest(r, "inputDigest"), executionDigest: digest(r, "executionDigest"), producerId: id(r, "producerId"), status, passed, failureKind,
		feedback, evidenceDigests, limitations: texts(r, "limitations")};
});
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
