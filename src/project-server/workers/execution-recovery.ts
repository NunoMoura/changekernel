type ProviderFailureKind =
	| "timeout"
	| "rate-limited"
	| "unavailable"
	| "authentication"
	| "quota-exhausted"
	| "context-overflow"
	| "malformed-response"
	| "cancelled";

interface ProviderFailureReceipt {
	readonly outcome: "completed" | "failed" | "cancelled";
	readonly failureKind: ProviderFailureKind | null;
}

export type ExecutionFailureKind =
	| "provider-timeout"
	| "provider-rate-limited"
	| "provider-unavailable"
	| "provider-authentication"
	| "provider-quota-exhausted"
	| "provider-malformed-response"
	| "context-overflow"
	| "stale-base"
	| "integration-conflict"
	| "malformed-model-output"
	| "checks-failed"
	| "repeated-no-progress"
	| "security-or-architecture-failure"
	| "budget-exhausted"
	| "cancelled";

export type ExecutionRecoveryAction =
	| "broker-transport-retry"
	| "rehydrate"
	| "select-compatible-route"
	| "escalate-capability"
	| "request-user-authorization"
	| "stop";

export type ExecutionRouteRequirement =
	| "none"
	| "larger-context"
	| "compatible"
	| "stronger";

export interface ExecutionRecoveryDecision {
	readonly failureKind: ExecutionFailureKind;
	readonly action: ExecutionRecoveryAction;
	readonly owner: "broker" | "project-server" | "user";
	readonly routeRequirement: ExecutionRouteRequirement;
	readonly freshSession: boolean;
	readonly reason: string;
}

type ExecutionRecoveryTemplate = Omit<ExecutionRecoveryDecision, "failureKind">;

const BROKER_TRANSPORT_RECOVERY: ExecutionRecoveryTemplate = Object.freeze({
	action: "broker-transport-retry",
	owner: "broker",
	routeRequirement: "none",
	freshSession: false,
	reason: "Transport recovery stays behind the private provider boundary.",
});
const USER_PROVIDER_RECOVERY: ExecutionRecoveryTemplate = Object.freeze({
	action: "request-user-authorization",
	owner: "user",
	routeRequirement: "none",
	freshSession: true,
	reason: "A stronger model cannot repair provider authorization or quota.",
});
const REHYDRATION_RECOVERY: ExecutionRecoveryTemplate = Object.freeze({
	action: "rehydrate",
	owner: "project-server",
	routeRequirement: "none",
	freshSession: true,
	reason: "Canonical state must be refreshed before more model work is admitted.",
});
const CAPABILITY_RECOVERY: ExecutionRecoveryTemplate = Object.freeze({
	action: "escalate-capability",
	owner: "project-server",
	routeRequirement: "stronger",
	freshSession: true,
	reason: "Capability escalation requires an explicitly authorized stronger route.",
});

const EXECUTION_RECOVERY: Readonly<Record<ExecutionFailureKind, ExecutionRecoveryTemplate>> = Object.freeze({
	"provider-timeout": BROKER_TRANSPORT_RECOVERY,
	"provider-rate-limited": BROKER_TRANSPORT_RECOVERY,
	"provider-unavailable": BROKER_TRANSPORT_RECOVERY,
	"provider-authentication": USER_PROVIDER_RECOVERY,
	"provider-quota-exhausted": USER_PROVIDER_RECOVERY,
	"provider-malformed-response": Object.freeze({
		action: "select-compatible-route",
		owner: "project-server",
		routeRequirement: "compatible",
		freshSession: true,
		reason: "Malformed provider output requires an authorized compatible route.",
	}),
	"context-overflow": Object.freeze({
		action: "select-compatible-route",
		owner: "project-server",
		routeRequirement: "larger-context",
		freshSession: true,
		reason: "A new Run requires an authorized route with a larger context window.",
	}),
	"stale-base": REHYDRATION_RECOVERY,
	"integration-conflict": REHYDRATION_RECOVERY,
	"malformed-model-output": Object.freeze({
		action: "select-compatible-route",
		owner: "project-server",
		routeRequirement: "compatible",
		freshSession: true,
		reason: "A bounded retry may use an explicitly authorized compatible route.",
	}),
	"checks-failed": CAPABILITY_RECOVERY,
	"repeated-no-progress": CAPABILITY_RECOVERY,
	"security-or-architecture-failure": CAPABILITY_RECOVERY,
	"budget-exhausted": Object.freeze({
		action: "request-user-authorization",
		owner: "user",
		routeRequirement: "none",
		freshSession: true,
		reason: "Budget exhaustion cannot expand user authority automatically.",
	}),
	cancelled: Object.freeze({
		action: "stop",
		owner: "project-server",
		routeRequirement: "none",
		freshSession: true,
		reason: "Cancellation admits no implicit retry or route change.",
	}),
});

export function resolveExecutionRecovery(
	failureKind: ExecutionFailureKind,
): Readonly<ExecutionRecoveryDecision> {
	const recovery = EXECUTION_RECOVERY[failureKind];
	if (!recovery) throw new Error("Execution failure kind is invalid.");
	return Object.freeze({failureKind, ...recovery});
}

export function executionFailureFromProviderReceipt(
	receipt: ProviderFailureReceipt,
): ExecutionFailureKind | null {
	if (receipt.outcome === "completed") return null;
	switch (receipt.failureKind) {
		case "timeout": return "provider-timeout";
		case "rate-limited": return "provider-rate-limited";
		case "unavailable": return "provider-unavailable";
		case "authentication": return "provider-authentication";
		case "quota-exhausted": return "provider-quota-exhausted";
		case "context-overflow": return "context-overflow";
		case "malformed-response": return "provider-malformed-response";
		case "cancelled": return "cancelled";
		case null:
			throw new Error("Failed provider broker receipt has no typed failure kind.");
		default:
			throw new Error("Provider broker failure kind is invalid.");
	}
}
