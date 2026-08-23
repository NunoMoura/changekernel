import {execFileSync} from "node:child_process";
import {readFileSync, realpathSync, statSync} from "node:fs";
import {dirname, isAbsolute, normalize, sep} from "node:path";

import {
	canonicalJsonDigest,
	sha256Digest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export const BUBBLEWRAP_SANDBOX_SCHEMA_VERSION = "1.0.0" as const;

export interface SandboxExecutableIdentity {
	readonly path: string;
	readonly version: string;
	readonly digest: Sha256Digest;
}

export interface BubblewrapResourceLimits {
	readonly addressSpaceBytes: number;
	readonly cpuSeconds: number;
	readonly openFiles: number;
	readonly processes: number;
	readonly fileBytes: number;
}

export interface BubblewrapSandboxProfile {
	readonly schemaVersion: typeof BUBBLEWRAP_SANDBOX_SCHEMA_VERSION;
	readonly bubblewrap: SandboxExecutableIdentity;
	readonly prlimit: SandboxExecutableIdentity;
	readonly systemReadOnlyPaths: readonly string[];
	readonly limits: BubblewrapResourceLimits;
}

export interface BubblewrapMount {
	readonly source: string;
	readonly destination: string;
	readonly access: "read-only" | "read-write";
}

export interface BubblewrapLaunchRequest {
	readonly executable: string;
	readonly args: readonly string[];
	readonly cwd: string;
	readonly mounts: readonly BubblewrapMount[];
	readonly disableNestedUserNamespaces: boolean;
}

export interface BubblewrapLaunchCommand {
	readonly executable: string;
	readonly args: readonly string[];
	readonly cwd: "/";
	readonly profileDigest: Sha256Digest;
}

export function normalizeBubblewrapSandboxProfile(
	value: unknown,
): Readonly<BubblewrapSandboxProfile> {
	if (!isRecord(value) || !hasExactKeys(value, [
		"schemaVersion",
		"bubblewrap",
		"prlimit",
		"systemReadOnlyPaths",
		"limits",
	])) {
		throw new Error("Bubblewrap sandbox profile shape is invalid.");
	}
	const bubblewrap = normalizeExecutableIdentity(value.bubblewrap, "bubblewrap");
	const prlimit = normalizeExecutableIdentity(value.prlimit, "prlimit");
	if (!Array.isArray(value.systemReadOnlyPaths)) {
		throw new Error("Bubblewrap sandbox systemReadOnlyPaths is invalid.");
	}
	const systemReadOnlyPaths = value.systemReadOnlyPaths.map((path) => {
		if (typeof path !== "string") {
			throw new Error("Bubblewrap sandbox systemReadOnlyPaths is invalid.");
		}
		return path;
	});
	if (!isRecord(value.limits) || !hasExactKeys(value.limits, [
		"addressSpaceBytes",
		"cpuSeconds",
		"openFiles",
		"processes",
		"fileBytes",
	])) {
		throw new Error("Bubblewrap sandbox limits shape is invalid.");
	}
	const limits = {
		addressSpaceBytes: value.limits.addressSpaceBytes as number,
		cpuSeconds: value.limits.cpuSeconds as number,
		openFiles: value.limits.openFiles as number,
		processes: value.limits.processes as number,
		fileBytes: value.limits.fileBytes as number,
	};
	const profile: BubblewrapSandboxProfile = {
		schemaVersion: value.schemaVersion as typeof BUBBLEWRAP_SANDBOX_SCHEMA_VERSION,
		bubblewrap,
		prlimit,
		systemReadOnlyPaths: Object.freeze(systemReadOnlyPaths),
		limits: Object.freeze(limits),
	};
	assertBubblewrapSandboxProfile(profile);
	return Object.freeze(profile);
}

export function assertBubblewrapSandboxProfile(
	profile: BubblewrapSandboxProfile,
): void {
	if (profile.schemaVersion !== BUBBLEWRAP_SANDBOX_SCHEMA_VERSION) {
		throw new Error("Bubblewrap sandbox profile schema version is unsupported.");
	}
	assertExecutableIdentity(profile.bubblewrap, "bubblewrap");
	assertExecutableIdentity(profile.prlimit, "prlimit");
	assertAbsolutePaths(profile.systemReadOnlyPaths, "systemReadOnlyPaths");
	if (profile.systemReadOnlyPaths.length < 1) {
		throw new Error("Bubblewrap sandbox requires explicit system read-only paths.");
	}
	assertLimits(profile.limits);
}

export function verifyBubblewrapSandboxProfile(
	profile: BubblewrapSandboxProfile,
): Sha256Digest {
	assertBubblewrapSandboxProfile(profile);
	verifyExecutable(profile.bubblewrap, "bubblewrap");
	verifyExecutable(profile.prlimit, "prlimit");
	const version = execFileSync(profile.bubblewrap.path, ["--version"], {
		encoding: "utf8",
		env: {},
		timeout: 5_000,
	}).trim();
	if (version !== profile.bubblewrap.version) {
		throw new Error("Bubblewrap sandbox executable version changed.");
	}
	const prlimitVersion = execFileSync(profile.prlimit.path, ["--version"], {
		encoding: "utf8",
		env: {},
		timeout: 5_000,
	}).split("\n", 1)[0]?.trim();
	if (prlimitVersion !== profile.prlimit.version) {
		throw new Error("Bubblewrap sandbox prlimit version changed.");
	}
	return canonicalJsonDigest(profile);
}

export function createBubblewrapLaunchCommand(
	profile: BubblewrapSandboxProfile,
	request: BubblewrapLaunchRequest,
): BubblewrapLaunchCommand {
	const profileDigest = verifyBubblewrapSandboxProfile(profile);
	assertLaunchRequest(request);
	const mounts = normalizedMounts(profile, request.mounts);
	const args = [
		`--as=${profile.limits.addressSpaceBytes}`,
		`--cpu=${profile.limits.cpuSeconds}`,
		`--nofile=${profile.limits.openFiles}`,
		`--nproc=${profile.limits.processes}`,
		`--fsize=${profile.limits.fileBytes}`,
		"--core=0",
		"--",
		profile.bubblewrap.path,
		"--unshare-user",
		"--unshare-pid",
		"--unshare-net",
		"--unshare-ipc",
		"--unshare-uts",
		"--unshare-cgroup-try",
		"--die-with-parent",
		"--new-session",
		"--clearenv",
		"--cap-drop",
		"ALL",
	];
	if (request.disableNestedUserNamespaces) args.push("--disable-userns");
	for (const directory of mountParentDirectories(mounts)) {
		args.push("--dir", directory);
	}
	for (const mount of mounts) {
		args.push(
			mount.access === "read-only" ? "--ro-bind" : "--bind",
			mount.source,
			mount.destination,
		);
	}
	args.push("--proc", "/proc", "--dev", "/dev", "--chdir", request.cwd);
	args.push("--", request.executable, ...request.args);
	return Object.freeze({
		executable: profile.prlimit.path,
		args: Object.freeze(args),
		cwd: "/" as const,
		profileDigest,
	});
}

function normalizeExecutableIdentity(
	value: unknown,
	field: string,
): Readonly<SandboxExecutableIdentity> {
	if (!isRecord(value) || !hasExactKeys(value, ["path", "version", "digest"])) {
		throw new Error(`Bubblewrap sandbox ${field} executable identity shape is invalid.`);
	}
	const identity = {
		path: value.path as string,
		version: value.version as string,
		digest: value.digest as Sha256Digest,
	};
	assertExecutableIdentity(identity, field);
	return Object.freeze(identity);
}

function assertExecutableIdentity(
	identity: SandboxExecutableIdentity,
	field: string,
): void {
	if (!identity || !isAbsolute(identity.path) || identity.path !== normalize(identity.path)) {
		throw new Error(`Bubblewrap sandbox ${field} path must be normalized and absolute.`);
	}
	if (!identity.version || identity.version.length > 256) {
		throw new Error(`Bubblewrap sandbox ${field} version is invalid.`);
	}
	if (!/^sha256:[0-9a-f]{64}$/.test(identity.digest)) {
		throw new Error(`Bubblewrap sandbox ${field} digest is invalid.`);
	}
}

function verifyExecutable(
	identity: SandboxExecutableIdentity,
	field: string,
): void {
	if (realpathSync(identity.path) !== identity.path || !statSync(identity.path).isFile()) {
		throw new Error(`Bubblewrap sandbox ${field} must be an exact regular file.`);
	}
	const digest = sha256Digest(readFileSync(identity.path));
	if (digest !== identity.digest) {
		throw new Error(`Bubblewrap sandbox ${field} executable digest changed.`);
	}
}

function assertLimits(limits: BubblewrapResourceLimits): void {
	for (const [field, value] of Object.entries(limits)) {
		if (!Number.isSafeInteger(value) || value < 1) {
			throw new Error(`Bubblewrap sandbox limit ${field} must be a positive safe integer.`);
		}
	}
}

function assertLaunchRequest(request: BubblewrapLaunchRequest): void {
	if (!isAbsolute(request.executable) || !isAbsolute(request.cwd)) {
		throw new Error("Bubblewrap sandbox executable and cwd must be absolute.");
	}
	if (request.args.length > 128 || request.mounts.length > 64) {
		throw new Error("Bubblewrap sandbox launch exceeds argument or mount bounds.");
	}
	for (const mount of request.mounts) {
		if (!isAbsolute(mount.source) || !isAbsolute(mount.destination)) {
			throw new Error("Bubblewrap sandbox mounts must use absolute paths.");
		}
		if (mount.source !== normalize(mount.source) || mount.destination !== normalize(mount.destination)) {
			throw new Error("Bubblewrap sandbox mounts must use normalized paths.");
		}
	}
}

function assertAbsolutePaths(values: readonly string[], field: string): void {
	if (!Array.isArray(values) || values.length > 32) {
		throw new Error(`Bubblewrap sandbox ${field} is invalid.`);
	}
	for (const value of values) {
		if (!isAbsolute(value) || value !== normalize(value)) {
			throw new Error(`Bubblewrap sandbox ${field} must contain normalized absolute paths.`);
		}
	}
}

function normalizedMounts(
	profile: BubblewrapSandboxProfile,
	requested: readonly BubblewrapMount[],
): BubblewrapMount[] {
	const mounts = [
		...profile.systemReadOnlyPaths.map((path) => ({
			source: path,
			destination: path,
			access: "read-only" as const,
		})),
		...requested,
	];
	const byDestination = new Map<string, BubblewrapMount>();
	for (const mount of mounts) {
		const existing = byDestination.get(mount.destination);
		if (existing && (existing.source !== mount.source || existing.access !== mount.access)) {
			throw new Error("Bubblewrap sandbox has conflicting mount destinations.");
		}
		byDestination.set(mount.destination, mount);
	}
	return [...byDestination.values()].sort((left, right) =>
		left.destination.localeCompare(right.destination),
	);
}

function mountParentDirectories(mounts: readonly BubblewrapMount[]): string[] {
	const mounted = new Set(mounts.map((mount) => mount.destination));
	const parents = new Set<string>();
	for (const mount of mounts) {
		let current = dirname(mount.destination);
		while (current !== sep && !mounted.has(current)) {
			parents.add(current);
			current = dirname(current);
		}
	}
	return [...parents].sort((left, right) => {
		const depth = left.split(sep).length - right.split(sep).length;
		return depth || left.localeCompare(right);
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
	value: Record<string, unknown>,
	expected: readonly string[],
): boolean {
	const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
	const wanted = [...expected].sort((left, right) => left.localeCompare(right));
	return keys.length === wanted.length && keys.every((key, index) => key === wanted[index]);
}
