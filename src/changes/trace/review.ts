import type {ReviewLifecycleTransition} from "../../loops/review/contracts.ts";
import type {CanonicalChangeOperation} from "./contracts.ts";
import type {ChangeWorkState, LoopAttemptProjection} from "./state.ts";
import {canonicalJsonDigest} from "../../utils/canonical-json.ts";

export function reviewTransitionFromRoute(
	operation: CanonicalChangeOperation,
): ReviewLifecycleTransition | null {
	if (operation.body.kind !== "runtime.route_recorded") return null;
	// SAFETY: operation kind was narrowed before specializing its generic payload.
	const routeOperation = operation as CanonicalChangeOperation<"runtime.route_recorded">;
	const artifact = routeOperation.body.payload.runtimeRoute;
	if (artifact.schemaVersion !== "2.0.0") return null;
	const content = objectRecord(artifact.artifact);
	if (!content || content.schemaVersion !== "2.0.0") return null;
	// SAFETY: canonical Review route artifacts are validated again against aggregate identity.
	return content as unknown as ReviewLifecycleTransition;
}

export function assertReviewTransitionMatchesAggregate(
	state: ChangeWorkState,
	attempt: LoopAttemptProjection,
	operation: CanonicalChangeOperation,
): ReviewLifecycleTransition {
	const transition = reviewTransitionFromRoute(operation);
	if (!transition) throw new Error("Review route requires a typed Review transition.");
	if (
		attempt.privateAttemptDigest !== transition.reviewAttemptDigest ||
		state.implementationAggregate?.aggregateDigest !== transition.aggregateDigest
	) {
		throw new Error("Review route does not bind the current frozen aggregate.");
	}
	const expectedRoute = routeForTarget(transition.target);
	// SAFETY: caller supplies the same runtime.route_recorded operation parsed above.
	const routeOperation = operation as CanonicalChangeOperation<"runtime.route_recorded">;
	if (routeOperation.body.payload.route !== expectedRoute) {
		throw new Error("Review route serialization does not match typed ownership.");
	}
	return transition;
}

export function reviewReworkAllowsWorkUnit(
	state: ChangeWorkState,
	workUnitId: string,
): boolean {
	for (let index = state.operations.length - 1; index >= 0; index -= 1) {
		const transition = reviewTransitionFromRoute(state.operations[index] as CanonicalChangeOperation);
		if (!transition) continue;
		return (
			transition.target === "implementation" &&
			transition.affectedWorkUnitIds.includes(workUnitId) &&
			!state.implementationAggregate
		);
	}
	return false;
}

export function currentPassedReviewTransition(
	state: ChangeWorkState,
): ReviewLifecycleTransition | null {
	for (let index = state.operations.length - 1; index >= 0; index -= 1) {
		const transition = reviewTransitionFromRoute(state.operations[index] as CanonicalChangeOperation);
		if (!transition) continue;
		if (
			transition.target === "guarded_delivery" &&
			state.implementationAggregate?.aggregateDigest === transition.aggregateDigest
		) {
			return transition;
		}
		return null;
	}
	return null;
}

export function assertReviewTransitionIdentity(value: ReviewLifecycleTransition): void {
	const {transitionDigest, ...body} = value;
	const targets = new Set([
		"guarded_delivery",
		"implementation",
		"planning_amendment",
		"decision",
		"preserve_state",
	]);
	const affected = [
		...new Set(value.failureOwnership.flatMap((entry) => entry.affectedWorkUnitIds)),
	].sort(compareText);
	const ownershipMatchesTarget = reviewOwnershipMatchesTarget(value);
	if (
		value.schemaVersion !== "2.0.0" ||
		!digest(value.reviewAttemptDigest) ||
		!digest(value.aggregateDigest) ||
		!digest(value.gateReportDigest) ||
		!digest(value.transitionDigest) ||
		!targets.has(value.target) ||
		!ownershipMatchesTarget ||
		value.reasonCode.length === 0 ||
		!validReviewOwnership(value) ||
		value.affectedWorkUnitIds.some((id, index) => id !== affected[index]) ||
		value.affectedWorkUnitIds.length !== affected.length ||
		transitionDigest !== canonicalJsonDigest(body)
	) {
		throw new Error("Review transition identity is invalid.");
	}
}

function routeForTarget(
	target: ReviewLifecycleTransition["target"],
): "complete" | "implementation" | "planning" | "decision" | "waiting" {
	switch (target) {
		case "guarded_delivery":
			return "complete";
		case "implementation":
			return "implementation";
		case "planning_amendment":
			return "planning";
		case "decision":
			return "decision";
		case "preserve_state":
			return "waiting";
	}
}

function reviewOwnershipMatchesTarget(value: ReviewLifecycleTransition): boolean {
	switch (value.target) {
		case "guarded_delivery":
		case "preserve_state":
			return value.failureOwnership.length === 0;
		case "implementation":
			return (
				value.failureOwnership.length > 0 &&
				value.failureOwnership.every((entry) => entry.owner === "implementation")
			);
		case "planning_amendment":
			return (
				value.failureOwnership.some((entry) => entry.owner === "planning") &&
				!value.failureOwnership.some((entry) => entry.owner === "decision")
			);
		case "decision":
			return value.failureOwnership.some((entry) => entry.owner === "decision");
	}
}

function validReviewOwnership(value: ReviewLifecycleTransition): boolean {
	const owners = new Set(["implementation", "planning", "decision"]);
	return (
		value.failureOwnership.every(
			(entry) =>
				digest(entry.resultDigest) &&
				owners.has(entry.owner) &&
				(entry.owner === "implementation" || entry.affectedWorkUnitIds.length === 0),
		) &&
		new Set(value.failureOwnership.map((entry) => entry.resultDigest)).size ===
			value.failureOwnership.length
	);
}

function digest(value: string): boolean {
	return /^sha256:[0-9a-f]{64}$/u.test(value);
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function objectRecord(value: unknown): Readonly<Record<string, unknown>> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Readonly<Record<string, unknown>>)
		: null;
}
