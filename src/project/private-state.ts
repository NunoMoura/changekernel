import {realpathSync} from "node:fs";
import {chmod, lstat, mkdir} from "node:fs/promises";
import {homedir} from "node:os";
import {isAbsolute, join, relative, resolve} from "node:path";
import {canonicalJsonDigest, type Sha256Digest} from "../utils/canonical-json.ts";

export const CODEWIKI_STATE_ROOT_ENV = "CODEWIKI_STATE_ROOT";
export const PROJECT_STATE_REF_PREFIX = "codewiki-state://project/";

/** Exact private locations for one repository-identity-bound Project Server. */
export interface ProjectServerStatePaths {
	readonly stateRoot: string;
	readonly registryRoot: string;
	readonly runtimeBuildsRoot: string;
	readonly repositoryIdentity: Sha256Digest;
	readonly projectKey: string;
	readonly projectRoot: string;
	readonly projectStateRoot: string;
	readonly projectServerRoot: string;
	readonly stateManifestPath: string;
	readonly processControlRoot: string;
	readonly continuityRoot: string;
	readonly synchronizationRoot: string;
	readonly snapshotsRoot: string;
	readonly workbenchesRoot: string;
	readonly workerAssignmentsRoot: string;
	readonly integrationRoot: string;
	readonly effectsRoot: string;
	readonly publicationManifestsRoot: string;
	readonly releaseManifestsRoot: string;
	readonly pushManifestsRoot: string;
	readonly locksRoot: string;
	readonly migrationsRoot: string;
	readonly buildTransitionsRoot: string;
	readonly restoreReceiptsRoot: string;
	readonly recoveryReceiptsRoot: string;
	readonly restoreTransactionsRoot: string;
	readonly logsRoot: string;
	readonly runtimeRoot: string;
	readonly dshSessionsRoot: string;
	readonly executionEvidenceRoot: string;
	readonly workerReportsRoot: string;
	readonly previewEvidenceRoot: string;
	readonly publicationArtifactsRoot: string;
	readonly tmpRoot: string;
	readonly backupsRoot: string;
	readonly quarantineRoot: string;
}

export function defaultCodeWikiStateRoot(): string {
	const configured = process.env[CODEWIKI_STATE_ROOT_ENV];
	if (configured) return absoluteStateRoot(configured);
	if (process.platform === "win32") {
		return join(
			process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
			"CodeWiki",
			"State",
		);
	}
	return join(
		process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"),
		"codewiki",
	);
}

export function projectRepositoryIdentity(repoRoot: string): Sha256Digest {
	const projectRoot = absoluteProjectRoot(repoRoot);
	return canonicalJsonDigest({kind: "codewiki.local-project", repoRoot: projectRoot});
}

export function projectServerStatePaths(input: {
	readonly repoRoot: string;
	readonly stateRoot?: string;
}): ProjectServerStatePaths {
	const projectRoot = absoluteProjectRoot(input.repoRoot);
	const stateRoot = absoluteStateRoot(input.stateRoot || defaultCodeWikiStateRoot());
	assertSeparateRoots(projectRoot, stateRoot);
	const repositoryIdentity = projectRepositoryIdentity(projectRoot);
	const projectKey = repositoryIdentity.slice("sha256:".length);
	const projectStateRoot = join(stateRoot, "projects", projectKey);
	const projectServerRoot = join(projectStateRoot, "project-server");
	const runtimeRoot = join(projectStateRoot, "runtime");
	return Object.freeze({
		stateRoot,
		registryRoot: join(stateRoot, "registry"),
		runtimeBuildsRoot: join(stateRoot, "runtime-builds"),
		repositoryIdentity,
		projectKey,
		projectRoot,
		projectStateRoot,
		projectServerRoot,
		stateManifestPath: join(projectStateRoot, "state.json"),
		processControlRoot: join(projectServerRoot, "process-control"),
		continuityRoot: join(projectServerRoot, "continuity"),
		synchronizationRoot: join(projectServerRoot, "synchronization"),
		snapshotsRoot: join(projectServerRoot, "snapshots"),
		workbenchesRoot: join(projectServerRoot, "workbenches"),
		workerAssignmentsRoot: join(projectServerRoot, "worker-assignments"),
		integrationRoot: join(projectServerRoot, "integration"),
		effectsRoot: join(projectServerRoot, "effects"),
		publicationManifestsRoot: join(projectServerRoot, "effects", "publications"),
		releaseManifestsRoot: join(projectServerRoot, "effects", "releases"),
		pushManifestsRoot: join(projectServerRoot, "effects", "pushes"),
		locksRoot: join(projectServerRoot, "locks"),
		migrationsRoot: join(projectServerRoot, "migrations"),
		buildTransitionsRoot: join(projectServerRoot, "build-transitions"),
		restoreReceiptsRoot: join(projectServerRoot, "restore-receipts"),
		recoveryReceiptsRoot: join(projectServerRoot, "recovery-receipts"),
		restoreTransactionsRoot: join(projectServerRoot, "restore-transactions"),
		logsRoot: join(projectServerRoot, "logs"),
		runtimeRoot,
		dshSessionsRoot: join(runtimeRoot, "dsh-agent-sessions"),
		executionEvidenceRoot: join(runtimeRoot, "execution-evidence"),
		workerReportsRoot: join(runtimeRoot, "worker-reports"),
		previewEvidenceRoot: join(runtimeRoot, "preview-evidence"),
		publicationArtifactsRoot: join(runtimeRoot, "publications", "artifacts"),
		tmpRoot: join(projectServerRoot, "tmp"),
		backupsRoot: join(stateRoot, "backups", projectKey),
		quarantineRoot: join(stateRoot, "quarantine", projectKey),
	});
}

/** Stable reference safe to place in receipts without leaking host paths. */
export function projectStateRef(
	paths: ProjectServerStatePaths,
	absolutePath: string,
): string {
	const child = relative(paths.projectStateRoot, resolve(absolutePath));
	if (!safeChildPath(child)) {
		throw new Error("Project state reference must stay inside private project state.");
	}
	return `${PROJECT_STATE_REF_PREFIX}${child.split("\\").join("/")}`;
}

/** Resolve one validated project-state reference inside this repository identity. */
export function resolveProjectStateRef(
	paths: ProjectServerStatePaths,
	ref: string,
): string {
	if (typeof ref !== "string" || !ref.startsWith(PROJECT_STATE_REF_PREFIX)) {
		throw new Error("Project state reference is invalid.");
	}
	const child = ref.slice(PROJECT_STATE_REF_PREFIX.length);
	if (!safePortablePath(child)) {
		throw new Error("Project state reference is invalid.");
	}
	const target = resolve(paths.projectStateRoot, ...child.split("/"));
	if (!safeChildPath(relative(paths.projectStateRoot, target))) {
		throw new Error("Project state reference escaped private project state.");
	}
	return target;
}

export async function ensureCodeWikiStateDirectory(
	paths: ProjectServerStatePaths,
	target: string,
): Promise<void> {
	const root = resolve(paths.stateRoot);
	const resolvedTarget = resolve(target);
	if (!isWithin(root, resolvedTarget)) {
		throw new Error("Private state directory escaped the CodeWiki State Root.");
	}
	await mkdir(root, {recursive: true, mode: 0o700});
	await assertPrivateDirectory(root);
	const child = relative(root, resolvedTarget);
	if (child === "") return;
	let current = root;
	for (const part of child.split(/[\\/]/u)) {
		current = join(current, part);
		const metadata = await statNoFollow(current);
		if (!metadata) {
			try {
				await mkdir(current, {recursive: false, mode: 0o700});
			} catch (error) {
				if (!isAlreadyExists(error)) throw error;
			}
		}
		await assertPrivateDirectory(current);
	}
}

export async function assertCodeWikiStatePath(
	paths: ProjectServerStatePaths,
	target: string,
): Promise<void> {
	const root = resolve(paths.stateRoot);
	const resolvedTarget = resolve(target);
	if (!isWithin(root, resolvedTarget)) {
		throw new Error("Private state path escaped the CodeWiki State Root.");
	}
	let current = root;
	for (const part of relative(root, resolvedTarget).split(/[\\/]/u).filter(Boolean)) {
		current = join(current, part);
		const metadata = await statNoFollow(current);
		if (!metadata) return;
		if (metadata.isSymbolicLink()) {
			throw new Error("CodeWiki private state path cannot be symbolic.");
		}
	}
}

async function assertPrivateDirectory(path: string): Promise<void> {
	const metadata = await statNoFollow(path);
	if (!metadata?.isDirectory() || metadata.isSymbolicLink()) {
		throw new Error("CodeWiki private state path must be a non-symbolic directory.");
	}
	if (process.platform !== "win32") await chmod(path, 0o700);
}

async function statNoFollow(path: string): Promise<Awaited<ReturnType<typeof lstat>> | undefined> {
	try {
		return await lstat(path);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return undefined;
		}
		throw error;
	}
}

function isAlreadyExists(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "EEXIST";
}

function absoluteProjectRoot(value: string): string {
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error("Project root is required.");
	}
	try {
		return realpathSync.native(value);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return resolve(value);
		}
		throw error;
	}
}

function absoluteStateRoot(value: string): string {
	if (typeof value !== "string" || value.trim() === "" || !isAbsolute(value)) {
		throw new Error("CodeWiki state root must be absolute.");
	}
	return resolve(value);
}

function assertSeparateRoots(projectRoot: string, stateRoot: string): void {
	if (isWithin(projectRoot, stateRoot) || isWithin(stateRoot, projectRoot)) {
		throw new Error(
			"CodeWiki state root must stay outside the governed project checkout.",
		);
	}
}

function isWithin(parent: string, candidate: string): boolean {
	const path = relative(parent, candidate);
	return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function safeChildPath(value: string): boolean {
	return value !== "" && !value.startsWith("..") && !isAbsolute(value) && !value.includes("\0");
}

function safePortablePath(value: string): boolean {
	return (
		value !== "" &&
		!value.startsWith("/") &&
		!value.endsWith("/") &&
		!value.includes("\\") &&
		!value.includes("\0") &&
		value.split("/").every((part) => part !== "" && part !== "." && part !== "..")
	);
}
