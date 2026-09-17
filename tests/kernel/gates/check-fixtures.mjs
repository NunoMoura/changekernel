import assert from "node:assert/strict";
import {CHECK_RESULT_PROTOCOL, createCheckDefinition, createCheckPack, createCheckAdoption, createCheckInput, createCheckResult, checkExecutionDigest} from "../../../src/kernel/gates/checks.ts";
export const ok = result => {assert.equal(result.ok, true, JSON.stringify(result)); return result.value;};
export const digest = (n = "a") => `sha256:${n.repeat(64)}`;
export const oid = (n = "1", algorithm = "sha1") => ({algorithm, hex: n.repeat(algorithm === "sha1" ? 40 : 64)});
export const body = ({protocol, digest, ...fields}) => fields;
export const limits = {milliseconds: 1000, memoryBytes: 1048576, inputBytes: 65536, outputBytes: 16384, modelCalls: 0, modelInputTokens: 0, modelOutputTokens: 0};
// Historical synthetic Check wording is retained to verify stored-identity compatibility.
export function fixture({algorithm = "sha1", definition: definitionPatch = {}, adoption: adoptionPatch = {}, input: inputPatch = {}, selected: selectedPatch = {}} = {}) {
	const currentProjectStateReference = {repositoryId: "cw:repository:test", commit: oid("1", algorithm), tree: oid("2", algorithm)};
	const proposedChangeContentReference = {...currentProjectStateReference, commit: oid("3", algorithm), tree: oid("4", algorithm)};
	const definition = ok(createCheckDefinition({checkId: "cw:check:intent-fit", version: "1.0.0", question: "Do the proposed effects serve recorded intent?",
		passingCondition: "The supplied effects serve the recorded intent without unsupported assumptions.", resultProtocol: CHECK_RESULT_PROTOCOL,
		inputs: [{name: "cw:input:intent", type: "string", required: true, selection: "Recorded intent at the exact Change revision.", maximumBytes: 8192}],
		activation: {stages: ["decision"], effectKinds: ["cw:effect:wiki"]},
		implementation: {runtime: "javascript", artifactDigest: digest("b"), dependenciesDigest: digest("c")}, limits, ...definitionPatch}));
	const pin = {checkId: definition.checkId, version: definition.version, definitionDigest: definition.digest};
	const pack = ok(createCheckPack({packId: "cw:pack:reasoning", version: "1.0.0", checks: [pin]}));
	const adoption = ok(createCheckAdoption({wiki: {snapshot: currentProjectStateReference, path: ".changekernel/wiki/items/checks.md", blob: oid("5", algorithm)},
		adoptedBy: {snapshot: currentProjectStateReference, path: ".changekernel/changes/CHG-adopt/change.json", blob: oid("6", algorithm)}, reason: "Adopt the intent condition for Wiki proposals.",
		checks: [{check: pin, packDigest: pack.digest, parameters: {}, limits: definition.limits, model: null, permissionDigest: digest("d"), ...selectedPatch}], ...adoptionPatch}));
	const kernelBuildDigest = digest("e");
	const executionDigest = ok(checkExecutionDigest({definition, adoption, checkId: definition.checkId, kernelBuildDigest}));
	const subject = {baseline: currentProjectStateReference, candidate: proposedChangeContentReference, subjectDigest: digest("f")};
	const input = ok(createCheckInput({checkId: definition.checkId, definitionDigest: definition.digest, adoptionDigest: adoption.digest, subject,
		stage: "decision", effects: ["cw:effect:wiki"], effectsComplete: true, kernelBuildDigest, permissionDigest: adoption.checks[0].permissionDigest, executionDigest,
		slots: [{name: "cw:input:intent", status: "available", value: "Make adopted project expectations explicit.", sources: [adoption.adoptedBy], evidenceDigests: [digest("1")], omissions: []}], ...inputPatch}));
	return {definition, pack, adoption, input, selection: {current: {snapshot: currentProjectStateReference, adoptionDigest: adoption.digest, kernelBuildDigest, subject, stage: input.stage, effects: input.effects, effectsComplete: input.effectsComplete, permissionDigests: [digest("d")]},
		adoption, packs: [pack], definitions: [definition], inputs: [input]}};
}
export function result(f, patch = {}) {
	return ok(createCheckResult({checkId: f.input.checkId, inputDigest: f.input.digest, executionDigest: f.input.executionDigest, producerId: "cw:producer:fixture",
		status: "completed", passed: true, failureKind: null, feedback: {summary: "The effect serves the recorded intent.", where: "CHG-test intent", reason: "The supplied Evidence supports the condition.", resolution: null, preserve: ["Keep the recorded scope."]},
		evidenceDigests: [digest("1")], limitations: [], ...patch}));
}
