import type {SynchronizationObservation} from "../../changes/trace/synchronization.ts";
import type {Sha256Digest} from "../../utils/canonical-json.ts";
import {canonicalJsonDigest} from "../../utils/canonical-json.ts";
import {
	assertBackendBuildBinding,
	type BackendBuildBinding,
	type BackendCompatibilityComponentBinding,
	type BackendDomainPluginBinding,
	type LegacyBackendDomainPluginBinding,
} from "../operations/build.ts";
import {BACKEND_STATE_PROTOCOL} from "../operations/state.ts";
import type {ExecutionRecoveryDecision} from "../workers/execution-recovery.ts";

export interface BackendOperationalBinding {
	readonly stateSchema: typeof BACKEND_STATE_PROTOCOL;
	readonly stateGeneration: number;
	readonly backendBuildProtocol: BackendBuildBinding["protocol"];
	readonly backendBuildDigest: Sha256Digest;
	readonly supportMatrixDigest: Sha256Digest | null;
	readonly package: Readonly<{
		name: BackendBuildBinding["packageName"];
		version: string;
		lockDigest: Sha256Digest;
	}>;
	readonly dshProfiles: BackendBuildBinding["dshProfiles"];
	readonly domainPluginClosureDigest?: Sha256Digest;
	readonly domainPlugins?: readonly (
		BackendDomainPluginBinding | LegacyBackendDomainPluginBinding
	)[];
	readonly compatibilityClosureDigest?: Sha256Digest;
	readonly compatibilityComponents?: readonly BackendCompatibilityComponentBinding[];
	readonly fileSchemas: BackendBuildBinding["fileSchemas"];
	readonly protocols: BackendBuildBinding["protocols"];
	readonly activeRuntimeBuildDigest: Sha256Digest | null;
}

export interface ProjectOperationalStatus {
	readonly backend: BackendOperationalBinding;
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
	readonly backend: {
		readonly stateGeneration: number;
		readonly activeBuild: BackendBuildBinding;
		readonly activeRuntimeBuildDigest: Sha256Digest | null;
	};
	readonly synchronization: SynchronizationObservation;
	readonly recovery: readonly ExecutionRecoveryDecision[];
}): ProjectOperationalStatus {
	const backend = backendOperationalBinding(input.backend);
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
	const body = {backend, synchronization, recovery};
	return Object.freeze({...body, statusDigest: canonicalJsonDigest(body)});
}

export function backendOperationalBinding(input: {
	readonly stateGeneration: number;
	readonly activeBuild: BackendBuildBinding;
	readonly activeRuntimeBuildDigest: Sha256Digest | null;
}): BackendOperationalBinding {
	assertBackendBuildBinding(input.activeBuild);
	if (!Number.isSafeInteger(input.stateGeneration) || input.stateGeneration < 1) {
		throw new Error("Backend operational state generation is invalid.");
	}
	if (
		input.activeRuntimeBuildDigest !== null &&
		!/^sha256:[a-f0-9]{64}$/u.test(input.activeRuntimeBuildDigest)
	) {
		throw new Error("Active Runtime Build digest is invalid.");
	}
	return Object.freeze({
		stateSchema: BACKEND_STATE_PROTOCOL,
		stateGeneration: input.stateGeneration,
		backendBuildProtocol: input.activeBuild.protocol,
		backendBuildDigest: input.activeBuild.backendBuildDigest,
		supportMatrixDigest:
			"supportMatrixDigest" in input.activeBuild
				? input.activeBuild.supportMatrixDigest
				: null,
		package: Object.freeze({
			name: input.activeBuild.packageName,
			version: input.activeBuild.packageVersion,
			lockDigest: input.activeBuild.packageLockDigest,
		}),
		dshProfiles: input.activeBuild.dshProfiles,
		...("domainPlugins" in input.activeBuild
			? {
				domainPluginClosureDigest: input.activeBuild.domainPluginClosureDigest,
				domainPlugins: input.activeBuild.domainPlugins,
			}
			: {
				compatibilityClosureDigest: input.activeBuild.compatibilityClosureDigest,
				compatibilityComponents: input.activeBuild.compatibilityComponents,
			}),
		fileSchemas: input.activeBuild.fileSchemas,
		protocols: input.activeBuild.protocols,
		activeRuntimeBuildDigest: input.activeRuntimeBuildDigest,
	});
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
			reasons: Object.freeze(
				[...value.staleReasons].sort((left, right) => left.localeCompare(right)),
			),
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
		default: throw new Error("Execution recovery owner is invalid.");
	}
}
