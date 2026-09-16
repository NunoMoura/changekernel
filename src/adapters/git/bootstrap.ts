import {
	lstat,
	mkdir,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import {join, resolve} from "node:path";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {sha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {
	serializeBootstrapProjectConfig,
	type ProjectConfigFailure,
} from "./project-config.ts";

export type BootstrapFailureCode =
	| "already_exists"
	| "invalid_project"
	| "invalid_root"
	| "io_error"
	| "legacy_state"
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
}

export type BootstrapResult = Outcome<BootstrapReceipt, BootstrapFailure>;

export async function bootstrapChangeKernelProject(
	request: BootstrapRequest,
): Promise<BootstrapResult> {
	const root = resolve(request.projectRoot);
	const config = serializeBootstrapProjectConfig(request.project);
	if (!config.ok) {
		return failure(bootstrapFailure(
			"invalid_project",
			".changekernel/config.json",
			config.error.message,
			config.error,
		));
	}
	const rootCheck = await inspectRoot(root);
	if (!rootCheck.ok) return rootCheck;

	for (const legacyPath of [".codewiki", ".codewiki.bootstrap"]) {
		const legacy = await pathKind(join(root, legacyPath));
		if (!legacy.ok) return legacy;
		if (legacy.value === "present") {
			return failure(bootstrapFailure("legacy_state", legacyPath, "Legacy project state requires an explicit migration before bootstrap."));
		}
	}

	const finalRoot = join(root, ".changekernel");
	const stagingRoot = join(root, ".changekernel.bootstrap");
	const finalExists = await pathKind(finalRoot);
	if (!finalExists.ok) return finalExists;
	if (finalExists.value !== "missing") {
		return failure(bootstrapFailure("already_exists", ".changekernel", "Managed .changekernel state already exists."));
	}
	const stagingExists = await pathKind(stagingRoot);
	if (!stagingExists.ok) return stagingExists;
	if (stagingExists.value !== "missing") {
		return failure(bootstrapFailure("staging_exists", ".changekernel.bootstrap", "Bootstrap staging path already exists."));
	}

	let stagingCreated = false;
	try {
		await mkdir(stagingRoot, {mode: 0o700});
		stagingCreated = true;
		await mkdir(join(stagingRoot, "wiki"), {recursive: true, mode: 0o700});
		await mkdir(join(stagingRoot, "changes"), {recursive: true, mode: 0o700});
		await writeFile(join(stagingRoot, "config.json"), config.value, {flag: "wx", mode: 0o600});
		await rename(stagingRoot, finalRoot);
		stagingCreated = false;
	} catch (error) {
		const cleanupMessage = stagingCreated ? await cleanStaging(stagingRoot) : null;
		const detail = error instanceof Error ? error.message : "Unknown filesystem failure.";
		return failure(bootstrapFailure(
			"io_error",
			".changekernel",
			cleanupMessage === null ? detail : `${detail} Cleanup failed: ${cleanupMessage}`,
		));
	}

	const createdPaths = [
		".changekernel/config.json",
	].sort(compareText);
	return success(Object.freeze({
		protocol: Object.freeze({id: "codewiki.project-bootstrap-receipt", version: "1.0.0"}),
		project: request.project,
		createdPaths: Object.freeze(createdPaths),
		configDigest: sha256Digest(config.value),
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
