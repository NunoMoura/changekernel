import assert from "node:assert/strict";
import test from "node:test";
import {
	assertDshClientSlotQualification,
	DSH_CLIENT_SLOT_QUALIFICATION,
} from "../../../src/clients/dsh/client-slot-qualification.ts";

test("DSH client-slot qualification binds exact external closure and fail-closed adoption decision", () => {
	const value = assertDshClientSlotQualification(DSH_CLIENT_SLOT_QUALIFICATION);
	assert.equal(value.protocol.version, "1.0.0");
	assert.equal(value.upstream.release, "0.1.1-rc.2");
	assert.equal(value.packages.length, 13);
	assert.equal(
		value.packages.some(({name}) => name === "@deepseek-ai/dsh-authorization"),
		true,
	);
	assert.equal(value.evidence.vulnerabilities, 0);
	assert.equal(value.decisions.slotRegistry, "qualified");
	assert.equal(value.decisions.stockConnection, "rejected-no-authentication-layer");
	assert.equal(value.decisions.stockProviderSettings, "rejected-wrong-authority-plane");
	assert.equal(value.frontendSubstrate.productImplementationAuthorized, false);
	assert.equal(Object.isFrozen(value.packages), true);
	assert.match(value.qualificationDigest, /^sha256:[a-f0-9]{64}$/);
	assert.throws(
		() =>
			assertDshClientSlotQualification({
				...value,
				decisions: {...value.decisions, stockConnection: "qualified"},
			}),
		/invalid or drifted/,
	);
});
