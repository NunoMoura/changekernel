import {rm} from "node:fs/promises";

import {
	readProjectCoordinatorEndpoint,
	type ProjectCoordinatorEndpoint,
} from "../coordinator/endpoint.ts";
import {spawnProjectCoordinatorDaemon} from "../coordinator/daemon-process.ts";
import {ensureProjectCoordinatorService} from "../coordinator/process.ts";
import {
	requestProjectCoordinatorHealth,
	stopProjectCoordinatorService,
} from "../coordinator/service.ts";
import {
	assertRuntimeBuildRegistrySnapshot,
	type RuntimeBuildRegistrySnapshot,
} from "../../runtime/contracts.ts";
import type {Sha256Digest} from "../../utils/canonical-json.ts";
import {
	backendOperationalBinding,
	type BackendOperationalBinding,
} from "../queries/operational-status.ts";
import type {BackendBuildBinding} from "./build.ts";
import {projectServerStatePaths} from "./paths.ts";
import {
	activateBackendBuild,
	bootstrapBackendState,
	canonicalProjectSnapshotDigest,
	createBackendStateBackup,
	readBackendStateManifest,
	restoreBackendStateBackup,
	type BackendBuildTransitionReceipt,
	type BackendStateBackupManifest,
	type BackendStateManifest,
	type BackendStateRestoreReceipt,
} from "./state.ts";

export interface StandaloneProjectServerStatus {
	readonly lifecycle: "running" | "stopped" | "unresponsive" | "unbootstrapped";
	readonly repositoryIdentity: Sha256Digest;
	readonly stateGeneration: number | null;
	readonly stateDigest: Sha256Digest | null;
	readonly backendBuildDigest: Sha256Digest | null;
	readonly runtimeBuildRegistryObserved: boolean;
	readonly backend: BackendOperationalBinding | null;
	readonly process: Readonly<{
		generationId: string;
		pid: number;
		origin: string;
		startedAt: string;
	}> | null;
}

export interface StandaloneProjectServerOptions {
	readonly stateRoot?: string;
	readonly timeoutMs?: number;
}

export interface BackendUpgradeResult {
	readonly transition: BackendBuildTransitionReceipt;
	readonly state: BackendStateManifest;
}

export interface BackendRollbackResult {
	readonly restore: BackendStateRestoreReceipt;
	readonly state: BackendStateManifest;
}

export interface BackendUninstallResult {
	readonly backup: BackendStateBackupManifest;
	readonly privateStateRemoved: boolean;
	readonly canonicalSnapshotDigest: Sha256Digest;
}

export const bootstrapStandaloneProjectServer = bootstrapBackendState;

export async function readStandaloneProjectServerStatus(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly runtimeBuildRegistry?: RuntimeBuildRegistrySnapshot | null;
}): Promise<StandaloneProjectServerStatus> {
	const paths = projectServerStatePaths(input);
	const [state, endpoint] = await Promise.all([
		readBackendStateManifest(input),
		readProjectCoordinatorEndpoint(paths.projectRoot, paths.stateRoot),
	]);
	if (input.runtimeBuildRegistry) {
		assertRuntimeBuildRegistrySnapshot(input.runtimeBuildRegistry);
	}
	const runtimeBuildRegistryObserved = input.runtimeBuildRegistry !== undefined;
	const activeRuntimeBuildDigest = input.runtimeBuildRegistry?.activeBuildDigest ?? null;
	if (!endpoint) {
		return status({
			repositoryIdentity: paths.repositoryIdentity,
			state,
			lifecycle: "stopped",
			endpoint: null,
			runtimeBuildRegistryObserved,
			activeRuntimeBuildDigest,
		});
	}
	try {
		const health = await requestProjectCoordinatorHealth(endpoint, {timeoutMs: 500});
		if (health.generationId !== endpoint.generationId || health.pid !== endpoint.pid) {
			return status({
				repositoryIdentity: paths.repositoryIdentity,
				state,
				lifecycle: "unresponsive",
				endpoint,
				runtimeBuildRegistryObserved,
				activeRuntimeBuildDigest,
			});
		}
		return status({
			repositoryIdentity: paths.repositoryIdentity,
			state,
			lifecycle: "running",
			endpoint,
			runtimeBuildRegistryObserved,
			activeRuntimeBuildDigest,
		});
	} catch {
		return status({
			repositoryIdentity: paths.repositoryIdentity,
			state,
			lifecycle: "unresponsive",
			endpoint,
			runtimeBuildRegistryObserved,
			activeRuntimeBuildDigest,
		});
	}
}

export async function startStandaloneProjectServer(
	repoRoot: string,
	options: StandaloneProjectServerOptions = {},
): Promise<StandaloneProjectServerStatus> {
	await ensureProjectCoordinatorService(repoRoot, {
		stateRoot: options.stateRoot,
		timeoutMs: options.timeoutMs,
		spawnDaemon: spawnProjectCoordinatorDaemon,
	});
	return requireLifecycleState(
		await readStandaloneProjectServerStatus({
			repoRoot,
			stateRoot: options.stateRoot,
		}),
		"running",
	);
}

export async function stopStandaloneProjectServer(
	repoRoot: string,
	options: StandaloneProjectServerOptions = {},
): Promise<StandaloneProjectServerStatus> {
	const before = await readStandaloneProjectServerStatus({
		repoRoot,
		stateRoot: options.stateRoot,
	});
	if (before.lifecycle === "unresponsive") {
		throw new Error("Unresponsive Project Server process state requires explicit recovery.");
	}
	if (before.lifecycle === "running") {
		await stopProjectCoordinatorService(repoRoot, options);
	}
	return requireLifecycleState(
		await readStandaloneProjectServerStatus({
			repoRoot,
			stateRoot: options.stateRoot,
		}),
		"stopped",
	);
}

export async function restartStandaloneProjectServer(
	repoRoot: string,
	options: StandaloneProjectServerOptions = {},
): Promise<StandaloneProjectServerStatus> {
	await stopStandaloneProjectServer(repoRoot, options);
	return startStandaloneProjectServer(repoRoot, options);
}

export async function upgradeStandaloneBackend(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly timeoutMs?: number;
	readonly expectedStateDigest: Sha256Digest;
	readonly targetBuild: BackendBuildBinding;
	readonly transitionedAt?: string;
	readonly retainBackups?: number;
}): Promise<BackendUpgradeResult> {
	await stopStandaloneProjectServer(input.repoRoot, input);
	const transition = await activateBackendBuild(input);
	const state = await requiredState(input);
	if (state.lastBuildTransitionDigest !== transition.transitionDigest) {
		throw new Error("Backend upgrade did not durably advance expected state.");
	}
	return Object.freeze({transition, state});
}

export async function rollbackStandaloneBackend(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly timeoutMs?: number;
	readonly backupId: Sha256Digest;
	readonly expectedStateDigest: Sha256Digest;
	readonly expectedCanonicalSnapshotDigest: Sha256Digest;
	readonly restoredAt?: string;
}): Promise<BackendRollbackResult> {
	await stopStandaloneProjectServer(input.repoRoot, input);
	const restore = await restoreBackendStateBackup({
		...input,
		scopes: ["canonical-project", "project-server-private", "runtime-private"],
		activateBackupBuild: true,
	});
	const state = await requiredState(input);
	if (state.lastRestoreDigest !== restore.restoreDigest) {
		throw new Error("Backend rollback did not durably advance expected state.");
	}
	return Object.freeze({restore, state});
}

export async function uninstallStandaloneBackendState(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
	readonly timeoutMs?: number;
	readonly expectedStateDigest: Sha256Digest;
	readonly expectedCanonicalSnapshotDigest: Sha256Digest;
	readonly removePrivateState?: boolean;
	readonly uninstalledAt?: string;
}): Promise<BackendUninstallResult> {
	await stopStandaloneProjectServer(input.repoRoot, input);
	const state = await requiredState(input);
	if (state.stateDigest !== input.expectedStateDigest) {
		throw new Error("Backend uninstall expected state is stale.");
	}
	const canonicalDigest = await canonicalProjectSnapshotDigest(input);
	if (canonicalDigest !== input.expectedCanonicalSnapshotDigest) {
		throw new Error("Backend uninstall expected canonical snapshot is stale.");
	}
	const backup = await createBackendStateBackup({
		...input,
		generatedAt: input.uninstalledAt,
	});
	if (input.removePrivateState) {
		await rm(projectServerStatePaths(input).projectStateRoot, {
			recursive: true,
			force: false,
		});
	}
	return Object.freeze({
		backup,
		privateStateRemoved: input.removePrivateState === true,
		canonicalSnapshotDigest: canonicalDigest,
	});
}

function status(input: {
	readonly repositoryIdentity: Sha256Digest;
	readonly state: BackendStateManifest | undefined;
	readonly lifecycle: "running" | "stopped" | "unresponsive";
	readonly endpoint: ProjectCoordinatorEndpoint | null;
	readonly runtimeBuildRegistryObserved: boolean;
	readonly activeRuntimeBuildDigest: Sha256Digest | null;
}): StandaloneProjectServerStatus {
	return Object.freeze({
		lifecycle: input.state ? input.lifecycle : "unbootstrapped",
		repositoryIdentity: input.repositoryIdentity,
		stateGeneration: input.state?.generation ?? null,
		stateDigest: input.state?.stateDigest ?? null,
		backendBuildDigest: input.state?.activeBuild.backendBuildDigest ?? null,
		runtimeBuildRegistryObserved: input.runtimeBuildRegistryObserved,
		backend: input.state
			? backendOperationalBinding({
					stateGeneration: input.state.generation,
					activeBuild: input.state.activeBuild,
					activeRuntimeBuildDigest: input.activeRuntimeBuildDigest,
				})
			: null,
		process: input.endpoint
			? Object.freeze({
					generationId: input.endpoint.generationId,
					pid: input.endpoint.pid,
					origin: input.endpoint.origin,
					startedAt: input.endpoint.startedAt,
				})
			: null,
	});
}

function requireLifecycleState(
	value: StandaloneProjectServerStatus,
	expected: "running" | "stopped",
): StandaloneProjectServerStatus {
	if (value.lifecycle !== expected) {
		throw new Error(`Project Server lifecycle is ${value.lifecycle}; expected ${expected}.`);
	}
	return value;
}

async function requiredState(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
}): Promise<BackendStateManifest> {
	const state = await readBackendStateManifest(input);
	if (!state) throw new Error("Backend state is not bootstrapped.");
	return state;
}
