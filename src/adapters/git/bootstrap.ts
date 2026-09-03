import {
	lstat,
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import {dirname, join, relative, resolve, sep} from "node:path";
import {fileURLToPath} from "node:url";
import {canonicalJson} from "../../kernel/canonical/json.ts";
import {failure, success, type Outcome} from "../../kernel/canonical/outcome.ts";
import {canonicalValueDigest} from "../../kernel/identity/semantic-digest.ts";
import {sha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {CODEWIKI_PRODUCT} from "../../product.ts";
import {
	serializeBootstrapProjectConfig,
	type ProjectConfigFailure,
} from "./project-config.ts";

export type BootstrapFailureCode =
	| "already_exists"
	| "invalid_project"
	| "invalid_root"
	| "io_error"
	| "resource_mismatch"
	| "staging_exists";

export interface BootstrapFailure {
	readonly code: BootstrapFailureCode;
	readonly path: string;
	readonly message: string;
	readonly configFailure?: ProjectConfigFailure;
}

export interface BootstrapRequest {
	readonly projectRoot: string;
	readonly project: string;
}

export interface BootstrapReceipt {
	readonly protocol: Readonly<{
		id: "codewiki.project-bootstrap-receipt";
		version: "1.0.0";
	}>;
	readonly project: string;
	readonly createdPaths: readonly string[];
	readonly configDigest: Sha256Digest;
	readonly checkPackLockDigest: Sha256Digest;
	readonly checkPackResources: readonly Readonly<{
		stage: string;
		packId: string;
		treeDigest: Sha256Digest;
	}>[];
}

export type BootstrapResult = Outcome<BootstrapReceipt, BootstrapFailure>;

interface ResourceFile {
	readonly relativePath: string;
	readonly bytes: Uint8Array;
	readonly digest: Sha256Digest;
}

interface LoadedResource {
	readonly stage: string;
	readonly packId: string;
	readonly targetPath: string;
	readonly treeDigest: Sha256Digest;
	readonly files: readonly ResourceFile[];
}

const MAXIMUM_RESOURCE_FILES = 512;
const MAXIMUM_RESOURCE_FILE_BYTES = 4 * 1_024 * 1_024;
const MAXIMUM_RESOURCE_TOTAL_BYTES = 16 * 1_024 * 1_024;

export async function bootstrapCodewikiProject(
	request: BootstrapRequest,
): Promise<BootstrapResult> {
	const root = resolve(request.projectRoot);
	const config = serializeBootstrapProjectConfig(request.project);
	if (!config.ok) {
		return failure(bootstrapFailure(
			"invalid_project",
			".codewiki/config.json",
			config.error.message,
			config.error,
		));
	}
	const rootCheck = await inspectRoot(root);
	if (!rootCheck.ok) return rootCheck;

	const finalRoot = join(root, ".codewiki");
	const stagingRoot = join(root, ".codewiki.bootstrap");
	const finalExists = await pathKind(finalRoot);
	if (!finalExists.ok) return finalExists;
	if (finalExists.value !== "missing") {
		return failure(bootstrapFailure("already_exists", ".codewiki", "Managed .codewiki state already exists."));
	}
	const stagingExists = await pathKind(stagingRoot);
	if (!stagingExists.ok) return stagingExists;
	if (stagingExists.value !== "missing") {
		return failure(bootstrapFailure("staging_exists", ".codewiki.bootstrap", "Bootstrap staging path already exists."));
	}

	const resources = await loadProductResources();
	if (!resources.ok) return resources;
	const plan = checkPackPlan(resources.value);
	if (!plan.ok) return plan;
	const lock = checkPackLock(plan.value);
	if (!lock.ok) return lock;

	let stagingCreated = false;
	try {
		await mkdir(stagingRoot, {mode: 0o700});
		stagingCreated = true;
		await mkdir(join(stagingRoot, "wiki", "items"), {recursive: true, mode: 0o700});
		await mkdir(join(stagingRoot, "changes"), {recursive: true, mode: 0o700});
		await writeFile(join(stagingRoot, "config.json"), config.value, {flag: "wx", mode: 0o600});
		await writeFile(join(stagingRoot, "check-packs.lock.json"), `${lock.value.json}\n`, {
			flag: "wx",
			mode: 0o600,
		});
		for (const resource of resources.value) {
			const targetRoot = join(stagingRoot, ...resource.targetPath.split("/").slice(1));
			for (const file of resource.files) {
				const target = join(targetRoot, ...file.relativePath.split("/"));
				await mkdir(dirname(target), {recursive: true, mode: 0o700});
				await writeFile(target, file.bytes, {flag: "wx", mode: 0o600});
			}
		}
		await rename(stagingRoot, finalRoot);
		stagingCreated = false;
	} catch (error) {
		const cleanupMessage = stagingCreated ? await cleanStaging(stagingRoot) : null;
		const detail = error instanceof Error ? error.message : "Unknown filesystem failure.";
		return failure(bootstrapFailure(
			"io_error",
			".codewiki",
			cleanupMessage === null ? detail : `${detail} Cleanup failed: ${cleanupMessage}`,
		));
	}

	const createdPaths = [
		".codewiki/config.json",
		".codewiki/check-packs.lock.json",
		...resources.value.flatMap((resource) =>
			resource.files.map((file) => `${resource.targetPath}/${file.relativePath}`),
		),
	].sort(compareText);
	return success(Object.freeze({
		protocol: Object.freeze({id: "codewiki.project-bootstrap-receipt", version: "1.0.0"}),
		project: request.project,
		createdPaths: Object.freeze(createdPaths),
		configDigest: sha256Digest(config.value),
		checkPackLockDigest: sha256Digest(`${lock.value.json}\n`),
		checkPackResources: Object.freeze(resources.value.map((resource) => Object.freeze({
			stage: resource.stage,
			packId: resource.packId,
			treeDigest: resource.treeDigest,
		}))),
	}));
}

async function inspectRoot(root: string): Promise<Outcome<true, BootstrapFailure>> {
	try {
		const stat = await lstat(root);
		if (!stat.isDirectory() || stat.isSymbolicLink()) {
			return failure(bootstrapFailure("invalid_root", root, "Project root must be an existing non-symbolic directory."));
		}
		const gitState = await lstat(join(root, ".git"));
		if (gitState.isSymbolicLink() || (!gitState.isDirectory() && !gitState.isFile())) {
			return failure(bootstrapFailure("invalid_root", join(root, ".git"), "Project root must contain non-symbolic Git state."));
		}
		return success(true);
	} catch (error) {
		return failure(bootstrapFailure(
			"invalid_root",
			root,
			error instanceof Error ? error.message : "Project root could not be inspected.",
		));
	}
}

async function loadProductResources(): Promise<Outcome<readonly LoadedResource[], BootstrapFailure>> {
	const packageRoot = fileURLToPath(new URL("../../../", import.meta.url));
	const resources: LoadedResource[] = [];
	for (const declaration of CODEWIKI_PRODUCT.checks.resources) {
		const sourceRoot = join(packageRoot, ...declaration.path.split("/"));
		const loaded = await loadResourceFiles(packageRoot, sourceRoot);
		if (!loaded.ok) return loaded;
		const entries = loaded.value.map((file) => ({path: file.relativePath, digest: file.digest}));
		const digest = canonicalValueDigest(entries);
		if (!digest.ok || digest.value !== declaration.treeDigest) {
			return failure(bootstrapFailure(
				"resource_mismatch",
				declaration.path,
				"Passive Check Pack tree does not match Product policy.",
			));
		}
		resources.push(Object.freeze({
			stage: declaration.stage,
			packId: declaration.packId,
			targetPath: `.codewiki/check-packs/${declaration.stage}/${declaration.packId}`,
			treeDigest: declaration.treeDigest,
			files: loaded.value,
		}));
	}
	return success(Object.freeze(resources));
}

async function loadResourceFiles(
	packageRoot: string,
	resourceRoot: string,
): Promise<Outcome<readonly ResourceFile[], BootstrapFailure>> {
	const files: ResourceFile[] = [];
	let totalBytes = 0;
	const visit = async (current: string): Promise<BootstrapFailure | null> => {
		let stat;
		try {
			stat = await lstat(current);
		} catch (error) {
			return bootstrapFailure(
				"io_error",
				repositoryPath(packageRoot, current),
				error instanceof Error ? error.message : "Check Pack resource could not be inspected.",
			);
		}
		if (stat.isSymbolicLink()) {
			return bootstrapFailure("resource_mismatch", repositoryPath(packageRoot, current), "Check Pack resources cannot contain symbolic links.");
		}
		if (stat.isDirectory()) {
			let names: string[];
			try {
				names = await readdir(current);
			} catch (error) {
				return bootstrapFailure(
					"io_error",
					repositoryPath(packageRoot, current),
					error instanceof Error ? error.message : "Check Pack directory could not be read.",
				);
			}
			names.sort(compareText);
			for (const name of names) {
				const nestedFailure = await visit(join(current, name));
				if (nestedFailure) return nestedFailure;
			}
			return null;
		}
		if (!stat.isFile()) {
			return bootstrapFailure("resource_mismatch", repositoryPath(packageRoot, current), "Check Pack resources must be regular files.");
		}
		if (files.length >= MAXIMUM_RESOURCE_FILES || stat.size > MAXIMUM_RESOURCE_FILE_BYTES) {
			return bootstrapFailure("resource_mismatch", repositoryPath(packageRoot, current), "Check Pack resource exceeds its file bound.");
		}
		totalBytes += stat.size;
		if (totalBytes > MAXIMUM_RESOURCE_TOTAL_BYTES) {
			return bootstrapFailure("resource_mismatch", repositoryPath(packageRoot, current), "Check Pack resources exceed their total byte bound.");
		}
		let bytes: Uint8Array;
		try {
			bytes = await readFile(current);
		} catch (error) {
			return bootstrapFailure(
				"io_error",
				repositoryPath(packageRoot, current),
				error instanceof Error ? error.message : "Check Pack resource could not be read.",
			);
		}
		files.push(Object.freeze({
			relativePath: repositoryPath(resourceRoot, current),
			bytes,
			digest: sha256Digest(bytes),
		}));
		return null;
	};
	const visitFailure = await visit(resourceRoot);
	return visitFailure ? failure(visitFailure) : success(Object.freeze(files));
}

function checkPackPlan(
	resources: readonly LoadedResource[],
): Outcome<Readonly<{body: object; digest: Sha256Digest}>, BootstrapFailure> {
	const body = {
		packageName: CODEWIKI_PRODUCT.package.name,
		packageVersion: CODEWIKI_PRODUCT.package.version,
		source: {
			kind: "npm",
			locator: CODEWIKI_PRODUCT.package.name,
			resolvedRevision: CODEWIKI_PRODUCT.package.version,
		},
		resources: resources.map((resource) => ({
			stage: resource.stage,
			packId: resource.packId,
			treeDigest: resource.treeDigest,
		})),
	};
	const digest = canonicalValueDigest(body);
	return digest.ok
		? success(Object.freeze({body, digest: digest.value}))
		: failure(bootstrapFailure("resource_mismatch", "check-packs", digest.error.message));
}

function checkPackLock(
	plan: Readonly<{body: object; digest: Sha256Digest}>,
): Outcome<Readonly<{json: string}>, BootstrapFailure> {
	const body = plan.body as Readonly<{
		packageName: string;
		packageVersion: string;
		source: object;
		resources: readonly Readonly<{stage: string; packId: string; treeDigest: Sha256Digest}>[];
	}>;
	const installedPaths = body.resources.map((resource) =>
		`.codewiki/check-packs/${resource.stage}/${resource.packId}`,
	);
	const lock = {
		protocolId: "codewiki.check-pack-lock",
		protocolVersion: "1.0.0",
		packages: {
			[body.packageName]: {
				packageVersion: body.packageVersion,
				source: body.source,
				planDigest: plan.digest,
				installedPaths,
				resources: body.resources,
				localDivergence: false,
			},
		},
	};
	const json = canonicalJson(lock);
	return json.ok
		? success(Object.freeze({json: json.value}))
		: failure(bootstrapFailure("resource_mismatch", "check-packs.lock.json", json.error.message));
}

async function pathKind(
	path: string,
): Promise<Outcome<"missing" | "present", BootstrapFailure>> {
	try {
		await lstat(path);
		return success("present");
	} catch (error) {
		if (isNotFound(error)) return success("missing");
		return failure(bootstrapFailure(
			"io_error",
			path,
			error instanceof Error ? error.message : "Path could not be inspected.",
		));
	}
}

async function cleanStaging(path: string): Promise<string | null> {
	try {
		await rm(path, {recursive: true, force: true});
		return null;
	} catch (error) {
		return error instanceof Error ? error.message : "Unknown cleanup failure.";
	}
}

function repositoryPath(root: string, path: string): string {
	return relative(root, path).split(sep).join("/");
}

function isNotFound(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function bootstrapFailure(
	code: BootstrapFailureCode,
	path: string,
	message: string,
	configFailure?: ProjectConfigFailure,
): BootstrapFailure {
	return configFailure === undefined
		? Object.freeze({code, path, message})
		: Object.freeze({code, path, message, configFailure});
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
