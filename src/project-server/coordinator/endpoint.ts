import { randomBytes, timingSafeEqual } from "node:crypto";
import {
	chmod,
	open,
	readFile,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import {
	assertCodeWikiStatePath,
	ensureCodeWikiStateDirectory,
	projectServerStatePaths,
} from "../operations/paths.ts";

export const PROJECT_COORDINATOR_ENDPOINT_SCHEMA_VERSION = 1;
const MALFORMED_LOCK_STALE_MS = 10_000;

export interface ProjectCoordinatorEndpoint {
	schemaVersion: typeof PROJECT_COORDINATOR_ENDPOINT_SCHEMA_VERSION;
	repoRoot: string;
	origin: string;
	token: string;
	pid: number;
	generationId: string;
	startedAt: string;
}

export interface ProjectCoordinatorOwnership {
	schemaVersion: typeof PROJECT_COORDINATOR_ENDPOINT_SCHEMA_VERSION;
	repoRoot: string;
	pid: number;
	generationId: string;
	ownerNonce: string;
	startedAt: string;
}

export interface AcquireProjectCoordinatorOwnershipInput {
	repoRoot: string;
	generationId: string;
	startedAt: string;
	pid?: number;
	stateRoot?: string;
}

function projectServerProcessControlDirectory(
	repoRoot: string,
	stateRoot?: string,
): string {
	return projectServerStatePaths({repoRoot, stateRoot}).processControlRoot;
}

export function projectCoordinatorEndpointPath(repoRoot: string, stateRoot?: string): string {
	return join(projectServerProcessControlDirectory(repoRoot, stateRoot), "endpoint.json");
}

export function projectCoordinatorOwnershipPath(repoRoot: string, stateRoot?: string): string {
	return join(projectServerProcessControlDirectory(repoRoot, stateRoot), "owner.lock");
}

export async function acquireProjectCoordinatorOwnership(
	input: AcquireProjectCoordinatorOwnershipInput,
): Promise<ProjectCoordinatorOwnership> {
	await ensurePrivateProjectServerDirectory(input.repoRoot, input.stateRoot);
	const ownership: ProjectCoordinatorOwnership = {
		schemaVersion: PROJECT_COORDINATOR_ENDPOINT_SCHEMA_VERSION,
		repoRoot: input.repoRoot,
		pid: input.pid ?? process.pid,
		generationId: requiredText(input.generationId, "generationId"),
		ownerNonce: randomBytes(24).toString("base64url"),
		startedAt: requiredText(input.startedAt, "startedAt"),
	};
	const path = projectCoordinatorOwnershipPath(input.repoRoot, input.stateRoot);
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			const handle = await open(path, "wx", 0o600);
			try {
				await handle.writeFile(`${JSON.stringify(ownership)}\n`, "utf8");
				await handle.sync();
			} finally {
				await handle.close();
			}
			if (process.platform !== "win32") await chmod(path, 0o600);
			return ownership;
		} catch (error) {
			if (!isAlreadyExists(error)) throw error;
			const existing = await readProjectCoordinatorOwnership(input.repoRoot, input.stateRoot);
			if (existing && processIsAlive(existing.pid)) {
				throw new Error(
					`Project Server generation ${existing.generationId} is already running as pid ${existing.pid}.`,
				);
			}
			if (!existing && !(await malformedLockIsStale(path))) {
				throw new Error(
					"Project Server ownership lock is malformed and not stale.",
				);
			}
			if (!(await quarantineStaleLock(path))) continue;
		}
	}
	throw new Error("Could not acquire Project Server ownership.");
}

export async function readProjectCoordinatorEndpoint(
	repoRoot: string,
	stateRoot?: string,
): Promise<ProjectCoordinatorEndpoint | undefined> {
	const paths = projectServerStatePaths({repoRoot, stateRoot});
	const path = projectCoordinatorEndpointPath(repoRoot, stateRoot);
	await assertCodeWikiStatePath(paths, path);
	const value = await readJsonFile(path);
	if (value === undefined) return undefined;
	return parseEndpoint(value, repoRoot);
}

export async function writeProjectCoordinatorEndpoint(
	endpoint: ProjectCoordinatorEndpoint,
	stateRoot?: string,
): Promise<void> {
	const normalized = parseEndpoint(endpoint, endpoint.repoRoot);
	await ensurePrivateProjectServerDirectory(normalized.repoRoot, stateRoot);
	const path = projectCoordinatorEndpointPath(normalized.repoRoot, stateRoot);
	const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
	await writeFile(temporary, `${JSON.stringify(normalized)}\n`, {
		encoding: "utf8",
		mode: 0o600,
	});
	if (process.platform !== "win32") await chmod(temporary, 0o600);
	await rename(temporary, path);
}

export async function readProjectCoordinatorOwnership(
	repoRoot: string,
	stateRoot?: string,
): Promise<ProjectCoordinatorOwnership | undefined> {
	const paths = projectServerStatePaths({repoRoot, stateRoot});
	const path = projectCoordinatorOwnershipPath(repoRoot, stateRoot);
	await assertCodeWikiStatePath(paths, path);
	try {
		const value = await readJsonFile(path);
		if (value === undefined) return undefined;
		return parseOwnership(value, repoRoot);
	} catch {
		return undefined;
	}
}

export async function projectCoordinatorOwnershipIsCurrent(
	ownership: ProjectCoordinatorOwnership,
	stateRoot?: string,
): Promise<boolean> {
	const current = await readProjectCoordinatorOwnership(ownership.repoRoot, stateRoot);
	return Boolean(
		current &&
			current.pid === ownership.pid &&
			safeEqual(current.generationId, ownership.generationId) &&
			safeEqual(current.ownerNonce, ownership.ownerNonce),
	);
}

export async function releaseProjectCoordinatorOwnership(
	ownership: ProjectCoordinatorOwnership,
	stateRoot?: string,
): Promise<void> {
	if (!(await projectCoordinatorOwnershipIsCurrent(ownership, stateRoot))) return;
	await removeProjectCoordinatorEndpoint(
		ownership.repoRoot,
		ownership.generationId,
		stateRoot,
	);
	await rm(projectCoordinatorOwnershipPath(ownership.repoRoot, stateRoot), { force: true });
}

export async function removeProjectCoordinatorEndpoint(
	repoRoot: string,
	expectedGenerationId?: string,
	stateRoot?: string,
): Promise<void> {
	const paths = projectServerStatePaths({repoRoot, stateRoot});
	const path = projectCoordinatorEndpointPath(repoRoot, stateRoot);
	await assertCodeWikiStatePath(paths, path);
	if (expectedGenerationId) {
		const endpoint = await readProjectCoordinatorEndpoint(repoRoot, stateRoot).catch(
			() => undefined,
		);
		if (
			endpoint &&
			!safeEqual(endpoint.generationId, expectedGenerationId)
		) {
			return;
		}
	}
	await rm(path, {force: true});
}

export function projectCoordinatorBearerToken(): string {
	return randomBytes(32).toString("base64url");
}

export function safeEqual(left: string, right: string): boolean {
	const leftBytes = Buffer.from(left);
	const rightBytes = Buffer.from(right);
	return (
		leftBytes.length === rightBytes.length &&
		timingSafeEqual(leftBytes, rightBytes)
	);
}

async function ensurePrivateProjectServerDirectory(repoRoot: string, stateRoot?: string): Promise<void> {
	const paths = projectServerStatePaths({repoRoot, stateRoot});
	await ensureCodeWikiStateDirectory(paths, paths.processControlRoot);
}

async function quarantineStaleLock(path: string): Promise<boolean> {
	const quarantine = `${path}.stale.${process.pid}.${randomBytes(8).toString("hex")}`;
	try {
		await rename(path, quarantine);
		await rm(quarantine, { force: true });
		return true;
	} catch (error) {
		if (isNotFound(error)) return false;
		throw error;
	}
}

async function malformedLockIsStale(path: string): Promise<boolean> {
	try {
		const info = await stat(path);
		return Date.now() - info.mtimeMs > MALFORMED_LOCK_STALE_MS;
	} catch (error) {
		if (isNotFound(error)) return false;
		throw error;
	}
}

function processIsAlive(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return errorCode(error) === "EPERM";
	}
}

async function readJsonFile(path: string): Promise<unknown | undefined> {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch (error) {
		if (isNotFound(error)) return undefined;
		throw error;
	}
}

function parseEndpoint(
	value: unknown,
	repoRoot: string,
): ProjectCoordinatorEndpoint {
	const record = objectRecord(value, "Project Server endpoint");
	if (record.schemaVersion !== PROJECT_COORDINATOR_ENDPOINT_SCHEMA_VERSION) {
		throw new Error("Project Server endpoint schema is unsupported.");
	}
	if (record.repoRoot !== repoRoot) {
		throw new Error("Project Server endpoint belongs to another project.");
	}
	const origin = requiredText(record.origin, "origin");
	let url: URL;
	try {
		url = new URL(origin);
	} catch {
		throw new Error("Project Server endpoint origin is invalid.");
	}
	if (
		url.protocol !== "http:" ||
		url.hostname !== "127.0.0.1" ||
		!url.port ||
		!validPort(url.port) ||
		url.username ||
		url.password ||
		url.pathname !== "/" ||
		url.search ||
		url.hash
	) {
		throw new Error("Project Server endpoint must use loopback HTTP.");
	}
	return {
		schemaVersion: PROJECT_COORDINATOR_ENDPOINT_SCHEMA_VERSION,
		repoRoot,
		origin: url.origin,
		token: requiredText(record.token, "token"),
		pid: positiveInteger(record.pid, "pid"),
		generationId: requiredText(record.generationId, "generationId"),
		startedAt: requiredText(record.startedAt, "startedAt"),
	};
}

function parseOwnership(
	value: unknown,
	repoRoot: string,
): ProjectCoordinatorOwnership {
	const record = objectRecord(value, "Project Server ownership");
	if (record.schemaVersion !== PROJECT_COORDINATOR_ENDPOINT_SCHEMA_VERSION) {
		throw new Error("Project Server ownership schema is unsupported.");
	}
	if (record.repoRoot !== repoRoot) {
		throw new Error("Project Server ownership belongs to another project.");
	}
	return {
		schemaVersion: PROJECT_COORDINATOR_ENDPOINT_SCHEMA_VERSION,
		repoRoot,
		pid: positiveInteger(record.pid, "pid"),
		generationId: requiredText(record.generationId, "generationId"),
		ownerNonce: requiredText(record.ownerNonce, "ownerNonce"),
		startedAt: requiredText(record.startedAt, "startedAt"),
	};
}

function objectRecord(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} must be an object.`);
	}
	return value as Record<string, unknown>;
}

function requiredText(value: unknown, field: string): string {
	if (typeof value !== "string" || !value.trim() || value.length > 1_024) {
		throw new Error(`Project Server ${field} is invalid.`);
	}
	return value.trim();
}

function validPort(value: string): boolean {
	const port = Number(value);
	return Number.isInteger(port) && port >= 1 && port <= 65_535;
}

function positiveInteger(value: unknown, field: string): number {
	if (!Number.isInteger(value) || (value as number) <= 0) {
		throw new Error(`Project Server ${field} is invalid.`);
	}
	return value as number;
}

function errorCode(error: unknown): string | undefined {
	return error && typeof error === "object" && "code" in error
		? String((error as { code?: unknown }).code)
		: undefined;
}

function isAlreadyExists(error: unknown): boolean {
	return errorCode(error) === "EEXIST";
}

function isNotFound(error: unknown): boolean {
	return errorCode(error) === "ENOENT";
}
