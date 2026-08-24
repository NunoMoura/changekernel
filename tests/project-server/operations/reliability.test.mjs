import assert from "node:assert/strict";
import test from "node:test";

import {
	BACKEND_FAULT_RECOVERY_MATRIX,
	BACKEND_PRODUCTION_FAULTS,
	assertBackendFaultRecoveryMatrix,
	backendFaultRecoveryPolicy,
} from "../../../src/project-server/operations/reliability.ts";
import {resolveExecutionRecovery} from "../../../src/project-server/workers/execution-recovery.ts";

test("production fault matrix closes every B8 recovery class without repeating effects", () => {
	assert.equal(assertBackendFaultRecoveryMatrix(), BACKEND_FAULT_RECOVERY_MATRIX);
	assert.deepEqual(
		BACKEND_FAULT_RECOVERY_MATRIX.policies.map(({fault}) => fault),
		BACKEND_PRODUCTION_FAULTS,
	);
	for (const policy of BACKEND_FAULT_RECOVERY_MATRIX.policies) {
		assert.equal(policy.repeatProtectedEffect, false);
		assert.ok(policy.evidence.length > 0);
		assert.ok(policy.evidence.every((path) => path.startsWith("tests/")));
	}
	assert.equal(backendFaultRecoveryPolicy("crash").action, "recover-durable-evidence");
	assert.equal(backendFaultRecoveryPolicy("credential-rotation").owner, "broker-host");
	assert.equal(backendFaultRecoveryPolicy("stale-session").action, "rollover-session");
	assert.equal(backendFaultRecoveryPolicy("filesystem-corruption").action, "quarantine-restore");
	assert.equal(backendFaultRecoveryPolicy("process-orphan").action, "terminate-wait-reconcile");
	assert.equal(backendFaultRecoveryPolicy("partial-effect").action, "recover-effect-without-repeat");
});

test("fault matrix agrees with executable provider recovery policy", () => {
	assert.equal(resolveExecutionRecovery("provider-timeout").action, "broker-transport-retry");
	assert.equal(
		resolveExecutionRecovery("provider-quota-exhausted").action,
		"request-user-authorization",
	);
	assert.equal(backendFaultRecoveryPolicy("timeout").action, "broker-transport-retry");
	assert.equal(
		backendFaultRecoveryPolicy("quota").action,
		"request-user-authorization",
	);
	assert.equal(
		backendFaultRecoveryPolicy("broker-loss").action,
		"fail-closed-retry-new-run",
	);
});
