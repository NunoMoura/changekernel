import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
	executionFailureFromProviderReceipt,
	resolveExecutionRecovery,
} from "../../src/project-server/workers/execution-recovery.ts";

describe("typed execution recovery", () => {
	it("keeps transport retry in the broker and authority expansion with the user", () => {
		for (const failureKind of [
			"provider-timeout",
			"provider-rate-limited",
			"provider-unavailable",
		]) {
			const recovery = resolveExecutionRecovery(failureKind);
			assert.equal(recovery.action, "broker-transport-retry");
			assert.equal(recovery.owner, "broker");
			assert.equal(recovery.routeRequirement, "none");
			assert.equal(recovery.freshSession, false);
		}
		for (const failureKind of [
			"provider-authentication",
			"provider-quota-exhausted",
			"budget-exhausted",
		]) {
			const recovery = resolveExecutionRecovery(failureKind);
			assert.equal(recovery.action, "request-user-authorization");
			assert.equal(recovery.owner, "user");
		}
	});

	it("maps broker receipts into Project Server recovery failures", () => {
		for (const [failureKind, expected] of [
			["timeout", "provider-timeout"],
			["rate-limited", "provider-rate-limited"],
			["unavailable", "provider-unavailable"],
			["authentication", "provider-authentication"],
			["quota-exhausted", "provider-quota-exhausted"],
			["context-overflow", "context-overflow"],
			["malformed-response", "provider-malformed-response"],
			["cancelled", "cancelled"],
		]) {
			assert.equal(
				executionFailureFromProviderReceipt({outcome: "failed", failureKind}),
				expected,
			);
		}
		assert.equal(
			executionFailureFromProviderReceipt({outcome: "completed", failureKind: null}),
			null,
		);
	});

	it("distinguishes rehydration, compatible routing, and capability escalation", () => {
		assert.equal(resolveExecutionRecovery("stale-base").action, "rehydrate");
		assert.equal(
			resolveExecutionRecovery("context-overflow").routeRequirement,
			"larger-context",
		);
		assert.equal(
			resolveExecutionRecovery("malformed-model-output").routeRequirement,
			"compatible",
		);
		for (const failureKind of [
			"checks-failed",
			"repeated-no-progress",
			"security-or-architecture-failure",
		]) {
			const recovery = resolveExecutionRecovery(failureKind);
			assert.equal(recovery.action, "escalate-capability");
			assert.equal(recovery.routeRequirement, "stronger");
			assert.equal(recovery.freshSession, true);
		}
	});
});
