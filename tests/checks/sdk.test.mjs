import assert from "node:assert/strict";
import test from "node:test";

import {createCheckSdk} from "../../src/checks/sdk.ts";
import {
	assembleCheckInvocation,
	subjectInputSelection,
} from "../../src/checks/protocol.ts";
import {
	checkSnapshot,
	checkSubject,
	digest,
	packagedCheck,
} from "../helpers/checks.mjs";

function invocation() {
	const check = packagedCheck();
	const snapshot = checkSnapshot([check]);
	const subject = checkSubject({stage: check.stage});
	const selector = check.definition.inputs[0];
	return assembleCheckInvocation({
		subject,
		snapshot,
		gatePackageDigest: digest("gate-package"),
		check,
		inputs: [subjectInputSelection(subject, selector)],
	});
}

test("Check Author SDK exposes only declared frozen Invocation inputs", () => {
	const value = invocation();
	const sdk = createCheckSdk(value);
	const selector = value.inputs[0].selector;
	const selected = sdk.selection({source: selector.source, ref: selector.refs[0]});
	assert.equal(selected.selectionDigest, value.inputs[0].selectionDigest);
	assert.throws(
		() => sdk.items({source: "repository", ref: "ambient:working-tree"}),
		/not declared/,
	);
	assert.equal(Object.isFrozen(sdk), true);
});

test("Check Author SDK fails closed on stale, unavailable, or truncated input and emits fixed Output", () => {
	const value = invocation();
	const selector = value.inputs[0].selector;
	for (const mutation of [
		{status: "unavailable"},
		{truncated: true},
		{stale: true},
	]) {
		const changed = {
			...value,
			inputs: [{...value.inputs[0], ...mutation}],
		};
		// Invocation identity validation rejects tampering before SDK query.
		assert.throws(() => createCheckSdk(changed), /digest|Unavailable|input/i);
	}
	const sdk = createCheckSdk(value);
	const output = sdk.output({
		measurement: {kind: "binary", value: true},
		summary: "Exact subject satisfies contract.",
		details: [],
	});
	assert.equal(output.protocolId, "codewiki.check-output");
	assert.equal(output.invocationDigest, value.invocationDigest);
	assert.deepEqual(sdk.items({source: selector.source, ref: selector.refs[0]}), value.inputs[0].items);
});
