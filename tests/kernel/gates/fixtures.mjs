import assert from "node:assert/strict";

import {DECISION_CHECK_OUTPUT_PROTOCOL} from "../../../src/kernel/gates/decision-output.ts";

export const ok = result => {assert.equal(result.ok, true, JSON.stringify(result)); return result.value;};
export const digest = (n = "a") => `sha256:${n.repeat(64)}`;
export function frozen(value) {
	if (value && typeof value === "object") {assert.ok(Object.isFrozen(value)); for (const child of Object.values(value)) frozen(child);}
}
export function checkOutput(patch = {}) {
	return {protocol: DECISION_CHECK_OUTPUT_PROTOCOL, status: "supported", reason: "The quoted source supports this proposed interpretation.", assumptions: [],
		citations: [{side: "before", pathUtf8Hex: "612e6d64", sourceDigest: digest(), startByte: 0, endByte: 4}], ...patch};
}
