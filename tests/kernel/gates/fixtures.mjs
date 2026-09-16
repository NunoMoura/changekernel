import assert from "node:assert/strict";

import {DECISION_CHECK_OUTPUT_PROTOCOL, createSemanticGate, createGateFinding, reduceSemanticGate} from "../../../src/kernel/gates/semantic.ts";

export const ok = result => {assert.equal(result.ok, true, JSON.stringify(result)); return result.value;};
export const digest = (n = "a") => `sha256:${n.repeat(64)}`;
export const oid = (n = "1", algorithm = "sha1") => ({algorithm, hex: n.repeat(algorithm === "sha1" ? 40 : 64)});
export const without = (value, ...keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
export function gate(patch = {}, algorithm = "sha1") {
	return ok(createSemanticGate({stage: "decision", subject: {
		kind: "change", repositoryId: "cw:repository:test", changeId: "CHG-test", workId: null,
		projectCommit: oid("1", algorithm), projectTree: oid("2", algorithm), changeTip: oid("3", algorithm),
		artifactCommit: null, artifactTree: null, facts: {}, subjectDigest: digest(),
	}, contextDigest: digest("b"), contextComplete: true, kernelBuildDigest: digest("c"), configurationDigest: digest("d"),
	checks: [{checkId: "cw:check:alignment", purpose: "Check the proposed intent against adopted obligations.", executionDigest: digest("e")}], ...patch}));
}
export function finding(g, patch = {}) {
	return ok(createGateFinding({gateDigest: g.gateDigest, checkId: g.checks[0].checkId, executionDigest: g.checks[0].executionDigest,
		producerId: "cw:executor:test", status: "supported", reason: "The recorded evidence supports the scoped obligation.",
		evidenceDigests: [digest("f")], assumptions: [], ...patch}));
}
export const reduce = (g, findings, currentGate = g) => ok(reduceSemanticGate({gate: g, currentGate, findings}));
export function frozen(value) {
	if (value && typeof value === "object") {assert.ok(Object.isFrozen(value)); for (const child of Object.values(value)) frozen(child);}
}
export function checkOutput(patch = {}) {
	return {protocol: DECISION_CHECK_OUTPUT_PROTOCOL, status: "supported", reason: "The quoted source supports this proposed interpretation.", assumptions: [],
		citations: [{side: "before", pathUtf8Hex: "612e6d64", sourceDigest: digest(), startByte: 0, endByte: 4}], ...patch};
}
