import {cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile} from "node:fs/promises";
import {dirname, join, relative, resolve, sep} from "node:path";
import {tmpdir} from "node:os";
import {randomUUID} from "node:crypto";

import {loadCheckPackSnapshot} from "./loader.ts";
import type {CheckStage} from "../contracts.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	sha256Digest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export type CheckPackTransportKind = "npm" | "git" | "local";

export interface CheckPackTransportSource {
	readonly kind: CheckPackTransportKind;
	readonly locator: string;
	readonly resolvedRevision: string;
	readonly packageRoot: string;
}

export interface CheckPackTransportResource {
	readonly stage: CheckStage;
	readonly packId: string;
	readonly sourcePath: string;
	readonly treeDigest: Sha256Digest;
}

export interface CheckPackTransportPlan {
	readonly packageName: string;
	readonly packageVersion: string;
	readonly source: Omit<CheckPackTransportSource, "packageRoot">;
	readonly resources: readonly CheckPackTransportResource[];
	readonly planDigest: Sha256Digest;
}

const STAGES: readonly CheckStage[] = ["decision", "planning", "implementation", "review"];
const MAX_FILES = 512;
const MAX_BYTES = 4 * 1024 * 1024;

/** Resolve passive package resources without executing package lifecycle code. */
export async function prepareCheckPackTransport(
	source: CheckPackTransportSource,
): Promise<CheckPackTransportPlan> {
	const packageRoot = resolve(source.packageRoot);
	const manifest = parseManifest(await readFile(join(packageRoot, "package.json"), "utf8"));
	if (typeof manifest.name !== "string" || typeof manifest.version !== "string") {
		throw new Error("Check Pack transport package manifest is invalid.");
	}
	const declared = await declaredResources(manifest, packageRoot);
	const resources = [];
	for (const resource of declared) {
		await assertSafeTree(resource.sourcePath, packageRoot);
		await validatePackResource(resource);
		resources.push(Object.freeze({...resource, treeDigest: await digestTree(resource.sourcePath)}));
	}
	if (resources.length === 0) throw new Error("Check Pack transport package contains no Check Packs.");
	const body = {
		packageName: manifest.name,
		packageVersion: manifest.version,
		source: {
			kind: sourceKind(source.kind),
			locator: text(source.locator, "Check Pack source locator"),
			resolvedRevision: text(source.resolvedRevision, "Check Pack resolved revision"),
		},
		resources: Object.freeze(resources.sort((left, right) =>
			`${left.stage}/${left.packId}`.localeCompare(`${right.stage}/${right.packId}`),
		)),
	};
	return Object.freeze({...body, planDigest: canonicalJsonDigest(body)});
}

/** Install one verified plan with collision checks and per-Pack atomic rename. */
export async function installCheckPackTransport(input: {
	readonly repoRoot: string;
	readonly plan: CheckPackTransportPlan;
}): Promise<readonly string[]> {
	assertTransportPlan(input.plan);
	const destinations = input.plan.resources.map((resource) => ({
		resource,
		path: join(resolve(input.repoRoot), ".codewiki", "check-packs", resource.stage, resource.packId),
	}));
	for (const destination of destinations) {
		if (await exists(destination.path)) throw new Error(`Check Pack transport collision: ${destination.resource.stage}/${destination.resource.packId}.`);
		if (await digestTree(destination.resource.sourcePath) !== destination.resource.treeDigest) {
			throw new Error("Check Pack transport source changed after preparation.");
		}
	}
	const installed: string[] = [];
	try {
		for (const destination of destinations) {
			await mkdir(dirname(destination.path), {recursive: true});
			const temporary = `${destination.path}.transport-${randomUUID()}`;
			await cp(destination.resource.sourcePath, temporary, {recursive: true, errorOnExist: true});
			await rename(temporary, destination.path);
			installed.push(relative(resolve(input.repoRoot), destination.path).split(sep).join("/"));
		}
		await updateTransportLock(resolve(input.repoRoot), input.plan, installed);
		return Object.freeze(installed);
	} catch (error) {
		await Promise.all(installed.map((path) => rm(join(resolve(input.repoRoot), path), {recursive: true, force: true})));
		throw error;
	}
}

export function assertTransportPlan(value: CheckPackTransportPlan): void {
	const {planDigest, ...body} = value;
	if (canonicalJsonDigest(body) !== planDigest) throw new Error("Check Pack transport plan digest is invalid.");
	for (const resource of value.resources) {
		if (!STAGES.includes(resource.stage) || !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(resource.packId)) {
			throw new Error("Check Pack transport resource identity is invalid.");
		}
	}
}

async function declaredResources(manifest: Record<string, unknown>, packageRoot: string): Promise<Omit<CheckPackTransportResource, "treeDigest">[]> {
	const codewiki = isRecord(manifest.codewiki) ? manifest.codewiki : undefined;
	if (codewiki?.checkPacks !== undefined) {
		if (!Array.isArray(codewiki.checkPacks)) throw new Error("package.json codewiki.checkPacks must be an array.");
		return codewiki.checkPacks.map((entry) => {
			if (!isRecord(entry) || !hasExactKeys(entry, ["stage", "packId", "path"])) {
				throw new Error("Check Pack transport declaration is invalid.");
			}
			const stage = checkStage(entry.stage);
			const packId = identifier(entry.packId, "Check Pack ID");
			const sourcePath = containedPath(packageRoot, entry.path);
			return {stage, packId, sourcePath};
		});
	}
	const conventional = join(packageRoot, "check-packs");
	const resources: Omit<CheckPackTransportResource, "treeDigest">[] = [];
	for (const stage of STAGES) {
		const stageRoot = join(conventional, stage);
		if (!(await exists(stageRoot))) continue;
		for (const entry of await readdir(stageRoot, {withFileTypes: true})) {
			if (!entry.isDirectory() || entry.isSymbolicLink()) {
				throw new Error("Conventional Check Pack transport entries must be directories.");
			}
			resources.push({
				stage,
				packId: identifier(entry.name, "Check Pack ID"),
				sourcePath: join(stageRoot, entry.name),
			});
		}
	}
	return resources;
}

async function validatePackResource(resource: Omit<CheckPackTransportResource, "treeDigest">): Promise<void> {
	const temporaryRoot = await mkdtemp(join(tmpdir(), "codewiki-pack-transport-validation-"));
	const target = join(temporaryRoot, ".codewiki", "check-packs", resource.stage, resource.packId);
	try {
		await mkdir(dirname(target), {recursive: true});
		await cp(resource.sourcePath, target, {recursive: true, errorOnExist: true});
		const snapshot = await loadCheckPackSnapshot({repoRoot: temporaryRoot, stage: resource.stage});
		if (!snapshot.packs.some((pack) => pack.id === resource.packId)) {
			throw new Error("Check Pack transport resource did not resolve exact Pack ID.");
		}
	} finally {
		await rm(temporaryRoot, {recursive: true, force: true});
	}
}

async function updateTransportLock(
	repoRoot: string,
	plan: CheckPackTransportPlan,
	installedPaths: readonly string[],
): Promise<void> {
	const lockPath = join(repoRoot, ".codewiki", "check-packs.lock.json");
	let packages: Record<string, unknown> = {};
	if (await exists(lockPath)) {
		const lock = parseManifest(await readFile(lockPath, "utf8"));
		if (lock.protocolId !== "codewiki.check-pack-lock" || lock.protocolVersion !== "1.0.0" || !isRecord(lock.packages)) {
			throw new Error("Check Pack transport lock is invalid.");
		}
		packages = {...lock.packages};
	}
	packages[plan.packageName] = {
		packageVersion: plan.packageVersion,
		source: plan.source,
		planDigest: plan.planDigest,
		installedPaths,
		resources: plan.resources.map((resource) => ({
			stage: resource.stage,
			packId: resource.packId,
			treeDigest: resource.treeDigest,
		})),
		localDivergence: false,
	};
	const lock = {protocolId: "codewiki.check-pack-lock", protocolVersion: "1.0.0", packages};
	const temporary = `${lockPath}.tmp-${randomUUID()}`;
	await mkdir(dirname(lockPath), {recursive: true});
	await writeFile(temporary, `${canonicalJson(lock)}\n`, {flag: "wx", mode: 0o600});
	await rename(temporary, lockPath);
}

async function assertSafeTree(root: string, packageRoot: string): Promise<void> {
	const queue = [root];
	let files = 0;
	let bytes = 0;
	while (queue.length) {
		const current = queue.pop();
		if (!current) continue;
		const stat = await lstat(current);
		if (stat.isSymbolicLink()) throw new Error("Check Pack transport forbids symbolic links.");
		if (stat.isDirectory()) {
			for (const entry of await readdir(current)) queue.push(join(current, entry));
		} else if (stat.isFile()) {
			files += 1;
			bytes += stat.size;
		} else throw new Error("Check Pack transport contains unsupported filesystem entry.");
		if (files > MAX_FILES || bytes > MAX_BYTES) throw new Error("Check Pack transport exceeds package bounds.");
		if (!contained(packageRoot, current)) throw new Error("Check Pack transport escaped package root.");
	}
}

async function digestTree(root: string): Promise<Sha256Digest> {
	const entries: {path: string; digest: Sha256Digest}[] = [];
	const queue = [root];
	while (queue.length) {
		const current = queue.pop();
		if (!current) continue;
		const stat = await lstat(current);
		if (stat.isDirectory()) {
			const entries = await readdir(current);
			for (const entry of entries.sort((left, right) => right.localeCompare(left))) {
				queue.push(join(current, entry));
			}
		} else entries.push({path: relative(root, current).split(sep).join("/"), digest: sha256Digest(await readFile(current))});
	}
	return canonicalJsonDigest(entries);
}

function containedPath(root: string, value: unknown): string {
	if (typeof value !== "string" || value.startsWith("/") || value.includes("\\")) throw new Error("Check Pack transport path is invalid.");
	const target = resolve(root, value);
	if (!contained(root, target)) throw new Error("Check Pack transport path escaped package root.");
	return target;
}

function contained(root: string, target: string): boolean {
	const rel = relative(resolve(root), resolve(target));
	return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep));
}

function checkStage(value: unknown): CheckStage {
	if (typeof value !== "string" || !STAGES.includes(value as CheckStage)) throw new Error("Check Pack transport stage is invalid.");
	return value as CheckStage;
}

function sourceKind(value: unknown): CheckPackTransportKind {
	if (value !== "npm" && value !== "git" && value !== "local") throw new Error("Check Pack transport source kind is invalid.");
	return value;
}

function identifier(value: unknown, field: string): string {
	if (typeof value !== "string" || !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value)) throw new Error(`${field} is invalid.`);
	return value;
}

function text(value: unknown, field: string): string {
	if (typeof value !== "string" || value.length === 0 || value.length > 1024 || value.trim() !== value) throw new Error(`${field} is invalid.`);
	return value;
}

async function exists(path: string): Promise<boolean> {
	try { await lstat(path); return true; } catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw error;
	}
}

function parseManifest(bytes: string): Record<string, unknown> {
	try {
		const value = JSON.parse(bytes) as unknown;
		if (!isRecord(value)) throw new Error("manifest_not_object");
		return value;
	} catch {
		throw new Error("Check Pack transport package manifest is not valid JSON object.");
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
	return Object.keys(value).sort(compareText).join("\0") === [...keys].sort(compareText).join("\0");
}

function compareText(left: string, right: string): number {
	return left.localeCompare(right);
}
