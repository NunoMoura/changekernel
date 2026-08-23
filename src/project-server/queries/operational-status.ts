import type {SynchronizationObservation} from "../../changes/trace/synchronization.ts";
import type {Sha256Digest} from "../../utils/canonical-json.ts";
import {canonicalJsonDigest} from "../../utils/canonical-json.ts";
import type {ExecutionRecoveryDecision} from "../workers/execution-recovery.ts";

export interface ProjectOperationalStatus {
	readonly synchronization: Readonly<{
		state: "current" | "stale" | "offline";
		canMutate: boolean;
		snapshotDigest: Sha256Digest | null;
		remoteStateHead: string | null;
		reasons: readonly string[];
		message: string;
	}>;
	readonly recovery: readonly Readonly<{
		failureKind: ExecutionRecoveryDecision["failureKind"];
		action: ExecutionRecoveryDecision["action"];
		owner: ExecutionRecoveryDecision["owner"];
		freshSession: boolean;
		message: string;
	}>[];
	readonly statusDigest: Sha256Digest;
}

/** Deterministic dashboard/Client projection; carries no recovery effect port. */
export function projectOperationalStatus(input: {
	readonly synchronization: SynchronizationObservation;
	readonly recovery: readonly ExecutionRecoveryDecision[];
}): ProjectOperationalStatus {
	const synchronization = synchronizationStatus(input.synchronization);
	const recovery = Object.freeze(input.recovery.map((decision) => Object.freeze({
		failureKind: decision.failureKind,
		action: decision.action,
		owner: decision.owner,
		freshSession: decision.freshSession,
		message: recoveryMessage(decision),
	})).sort((left, right) =>
		`${left.owner}/${left.failureKind}`.localeCompare(`${right.owner}/${right.failureKind}`),
	));
	const body = {synchronization, recovery};
	return Object.freeze({...body, statusDigest: canonicalJsonDigest(body)});
}

function synchronizationStatus(value: SynchronizationObservation): ProjectOperationalStatus["synchronization"] {
	if (value.status === "offline") {
		return Object.freeze({
			state: "offline" as const,
			canMutate: false,
			snapshotDigest: value.teamSnapshot?.snapshotDigest ?? null,
			remoteStateHead: value.teamSnapshot?.remoteStateHead ?? null,
			reasons: Object.freeze(["remote_unavailable"]),
			message: "Remote authority is unavailable. Reads may use last verified state; canonical mutations are blocked.",
		});
	}
	if (value.status === "stale" || value.staleReasons.length > 0 || !value.canMutate) {
		return Object.freeze({
			state: "stale" as const,
			canMutate: false,
			snapshotDigest: value.teamSnapshot?.snapshotDigest ?? null,
			remoteStateHead: value.teamSnapshot?.remoteStateHead ?? null,
			reasons: Object.freeze([...value.staleReasons].sort()),
			message: "Project authority changed. Refresh exact remote state before retrying this operation.",
		});
	}
	return Object.freeze({
		state: "current" as const,
		canMutate: true,
		snapshotDigest: value.teamSnapshot?.snapshotDigest ?? null,
		remoteStateHead: value.teamSnapshot?.remoteStateHead ?? null,
		reasons: Object.freeze([]),
		message: "Remote authority snapshot is current.",
	});
}

function recoveryMessage(value: ExecutionRecoveryDecision): string {
	const session = value.freshSession ? " Start a fresh Session." : " Preserve current Session continuity.";
	switch (value.owner) {
		case "broker": return `${value.reason} Broker owns bounded transport retry.${session}`;
		case "project-server": return `${value.reason} Project Server must apply the typed transition.${session}`;
		case "user": return `${value.reason} Explicit user authorization or configuration is required.${session}`;
	}
}
