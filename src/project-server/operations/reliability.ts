import {
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {BACKEND_FAULT_RECOVERY_PROTOCOL} from "./contracts.ts";

export {BACKEND_FAULT_RECOVERY_PROTOCOL} from "./contracts.ts";

export const BACKEND_PRODUCTION_FAULTS = Object.freeze([
	"crash",
	"cancellation",
	"timeout",
	"quota",
	"credential-rotation",
	"stale-session",
	"broker-loss",
	"filesystem-corruption",
	"process-orphan",
	"partial-effect",
] as const);

export type BackendProductionFault = (typeof BACKEND_PRODUCTION_FAULTS)[number];
export type BackendFaultOwner = "project-server" | "runtime" | "broker-host";
export type BackendFaultRecoveryAction =
	| "recover-durable-evidence"
	| "cancel-wait-quiescence"
	| "broker-transport-retry"
	| "request-user-authorization"
	| "rotate-owner-credential"
	| "rollover-session"
	| "fail-closed-retry-new-run"
	| "quarantine-restore"
	| "terminate-wait-reconcile"
	| "recover-effect-without-repeat";

export interface BackendFaultRecoveryPolicy {
	readonly fault: BackendProductionFault;
	readonly owner: BackendFaultOwner;
	readonly action: BackendFaultRecoveryAction;
	readonly repeatProtectedEffect: false;
	readonly evidence: readonly string[];
}

export interface BackendFaultRecoveryMatrix {
	readonly protocol: typeof BACKEND_FAULT_RECOVERY_PROTOCOL;
	readonly policies: readonly BackendFaultRecoveryPolicy[];
	readonly matrixDigest: Sha256Digest;
}

const POLICIES = Object.freeze([
	policy("crash", "runtime", "recover-durable-evidence", [
		"tests/runtime/dsh/vertical-process.test.mjs",
		"tests/runtime/receipts/store.test.mjs",
	]),
	policy("cancellation", "runtime", "cancel-wait-quiescence", [
		"tests/runtime/runtime.test.mjs",
		"tests/runtime/dsh/private-provider-broker.test.mjs",
	]),
	policy("timeout", "broker-host", "broker-transport-retry", [
		"tests/project-server/execution-recovery.test.mjs",
		"tests/runtime/runtime.test.mjs",
	]),
	policy("quota", "project-server", "request-user-authorization", [
		"tests/project-server/execution-recovery.test.mjs",
		"tests/runtime/dsh/private-provider-broker.test.mjs",
	]),
	policy("credential-rotation", "broker-host", "rotate-owner-credential", [
		"tests/runtime/dsh/provider-host.test.mjs",
	]),
	policy("stale-session", "project-server", "rollover-session", [
		"tests/project-server/continuity/session.test.mjs",
	]),
	policy("broker-loss", "project-server", "fail-closed-retry-new-run", [
		"tests/runtime/dsh/private-provider-broker.test.mjs",
		"tests/project-server/execution-recovery.test.mjs",
	]),
	policy("filesystem-corruption", "project-server", "quarantine-restore", [
		"tests/project-server/operations/state.test.mjs",
		"tests/runtime/evidence/store.test.mjs",
	]),
	policy("process-orphan", "runtime", "terminate-wait-reconcile", [
		"tests/runtime/sandbox/run-process.test.mjs",
		"tests/runtime/runtime.test.mjs",
	]),
	policy("partial-effect", "project-server", "recover-effect-without-repeat", [
		"tests/project-server/integration/worker.test.mjs",
		"tests/project-server/project-branch-merge.test.mjs",
		"tests/project-server/project-branch-push.test.mjs",
		"tests/project-server/product-publication.test.mjs",
		"tests/project-server/product-release.test.mjs",
	]),
]);

const MATRIX_BODY = Object.freeze({
	protocol: BACKEND_FAULT_RECOVERY_PROTOCOL,
	policies: POLICIES,
});

export const BACKEND_FAULT_RECOVERY_MATRIX: BackendFaultRecoveryMatrix = Object.freeze({
	...MATRIX_BODY,
	matrixDigest: canonicalJsonDigest(MATRIX_BODY),
});

export function assertBackendFaultRecoveryMatrix(
	value: BackendFaultRecoveryMatrix = BACKEND_FAULT_RECOVERY_MATRIX,
): BackendFaultRecoveryMatrix {
	if (
		canonicalJsonDigest({protocol: value.protocol, policies: value.policies}) !==
			value.matrixDigest ||
		value.matrixDigest !== BACKEND_FAULT_RECOVERY_MATRIX.matrixDigest ||
		value.policies.length !== BACKEND_PRODUCTION_FAULTS.length ||
		value.policies.some((entry, index) => entry.fault !== BACKEND_PRODUCTION_FAULTS[index])
	) {
		throw new Error("Backend fault recovery matrix is invalid or drifted.");
	}
	return value;
}

export function backendFaultRecoveryPolicy(
	fault: BackendProductionFault,
): BackendFaultRecoveryPolicy {
	const policyValue = assertBackendFaultRecoveryMatrix().policies.find(
		(entry) => entry.fault === fault,
	);
	if (!policyValue) throw new Error("Backend production fault is invalid.");
	return policyValue;
}

function policy(
	fault: BackendProductionFault,
	owner: BackendFaultOwner,
	action: BackendFaultRecoveryAction,
	evidence: readonly string[],
): BackendFaultRecoveryPolicy {
	return Object.freeze({
		fault,
		owner,
		action,
		repeatProtectedEffect: false,
		evidence: Object.freeze([...evidence]),
	});
}
