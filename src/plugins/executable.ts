import {realpathSync, statSync} from "node:fs";
import {isAbsolute, relative} from "node:path";

import {
	canonicalJsonDigest,
	type Sha256Digest,
} from "../utils/canonical-json.ts";

export const EXECUTABLE_PLUGIN_ADMISSION_PROTOCOL = Object.freeze({
	id: "codewiki.executable-plugin-admission-closure",
	version: "1.0.0",
} as const);

export const EXECUTABLE_PLUGIN_KINDS = Object.freeze([
	"dsh-plugin",
	"infrastructure-provider",
	"runtime-bridge",
	"client-plugin",
] as const);

export const EXECUTABLE_PLUGIN_TRUST_PLANES = Object.freeze([
	"project-server",
	"broker-host",
	"run-process",
	"client",
] as const);

export type ExecutablePluginKind = (typeof EXECUTABLE_PLUGIN_KINDS)[number];
export type ExecutablePluginTrustPlane =
	(typeof EXECUTABLE_PLUGIN_TRUST_PLANES)[number];

/** CodeWiki policy applied to one identity in release-managed composition. */
export interface ExecutablePluginAdmission {
	readonly pluginId: string;
	readonly kind: ExecutablePluginKind;
	readonly trustPlane: ExecutablePluginTrustPlane;
	readonly capabilities: readonly string[];
}

/** Path-independent policy closure bound by a Runtime Build. */
export interface ExecutablePluginAdmissionClosure {
	readonly protocol: typeof EXECUTABLE_PLUGIN_ADMISSION_PROTOCOL;
	readonly admissions: readonly ExecutablePluginAdmission[];
	readonly closureDigest: Sha256Digest;
}

/**
 * Admit an exact executable composition without duplicating DSH Loader, profile,
 * package, dependency, entrypoint, integrity, or live-inventory state.
 */
export function createExecutablePluginAdmissionClosure(input: {
	readonly projectRoot: string;
	readonly sourceRoots: readonly string[];
	readonly admissions: readonly ExecutablePluginAdmission[];
}): Readonly<ExecutablePluginAdmissionClosure> {
	if (!hasExactKeys(input, ["projectRoot", "sourceRoots", "admissions"])) {
		throw new Error("Executable Plugin admission input shape is invalid.");
	}
	const projectRoot = canonicalDirectory(input.projectRoot, "Project root");
	if (
		!Array.isArray(input.sourceRoots) ||
		input.sourceRoots.length < 1 ||
		input.sourceRoots.length > 32
	) {
		throw new Error("Executable Plugin source roots are invalid.");
	}
	const sourceRoots = input.sourceRoots.map((root) =>
		canonicalDirectory(root, "Executable Plugin source root"),
	);
	assertUnique(sourceRoots, "Executable Plugin source root");
	for (const sourceRoot of sourceRoots) {
		if (isWithin(projectRoot, sourceRoot)) {
			throw new Error("Repository-local executable Plugin loading is prohibited.");
		}
	}
	const body = normalizedAdmissionBody(input.admissions);
	return Object.freeze({...body, closureDigest: canonicalJsonDigest(body)});
}

/** Path-independent digest for revalidating one already-admitted release composition. */
export function executablePluginAdmissionClosureDigest(
	admissions: readonly ExecutablePluginAdmission[],
): Sha256Digest {
	return canonicalJsonDigest(normalizedAdmissionBody(admissions));
}

function normalizedAdmissionBody(
	values: readonly ExecutablePluginAdmission[],
): Readonly<{
	readonly protocol: typeof EXECUTABLE_PLUGIN_ADMISSION_PROTOCOL;
	readonly admissions: readonly Readonly<ExecutablePluginAdmission>[];
}> {
	if (!Array.isArray(values) || values.length < 1 || values.length > 256) {
		throw new Error("Executable Plugin admissions are invalid.");
	}
	const admissions = values
		.map(normalizeAdmission)
		.sort((left, right) => compareText(left.pluginId, right.pluginId));
	assertUnique(
		admissions.map((entry) => entry.pluginId),
		"Executable Plugin admission id",
	);
	return Object.freeze({
		protocol: EXECUTABLE_PLUGIN_ADMISSION_PROTOCOL,
		admissions: Object.freeze(admissions),
	});
}

function normalizeAdmission(
	value: ExecutablePluginAdmission,
): Readonly<ExecutablePluginAdmission> {
	if (!hasExactKeys(value, ["pluginId", "kind", "trustPlane", "capabilities"])) {
		throw new Error("Executable Plugin admission shape is invalid.");
	}
	const pluginId = executablePluginId(value.pluginId);
	const kind = pluginKind(value.kind);
	const trustPlane = pluginTrustPlane(value.trustPlane);
	assertKindTrustPlane(kind, trustPlane);
	return Object.freeze({
		pluginId,
		kind,
		trustPlane,
		capabilities: normalizedCapabilities(value.capabilities),
	});
}

function normalizedCapabilities(values: readonly string[]): readonly string[] {
	if (!Array.isArray(values) || values.length < 1 || values.length > 128) {
		throw new Error("Executable Plugin capabilities are invalid.");
	}
	const normalized = values.map(capabilityName).sort(compareText);
	assertUnique(normalized, "Executable Plugin capability");
	return Object.freeze(normalized);
}

function assertKindTrustPlane(
	kind: ExecutablePluginKind,
	trustPlane: ExecutablePluginTrustPlane,
): void {
	const allowed: Readonly<
		Record<ExecutablePluginKind, readonly ExecutablePluginTrustPlane[]>
	> = {
		"dsh-plugin": ["broker-host", "run-process"],
		"infrastructure-provider": ["project-server", "broker-host"],
		"runtime-bridge": ["run-process"],
		"client-plugin": ["client"],
	};
	if (!allowed[kind].includes(trustPlane)) {
		throw new Error(
			`Executable Plugin kind ${kind} cannot enter trust plane ${trustPlane}.`,
		);
	}
}

function canonicalDirectory(value: string, field: string): string {
	if (typeof value !== "string" || !isAbsolute(value)) {
		throw new Error(`${field} must be an absolute path.`);
	}
	let canonical: string;
	try {
		canonical = realpathSync(value);
	} catch {
		throw new Error(`${field} must resolve to an existing directory.`);
	}
	if (!statSync(canonical).isDirectory()) {
		throw new Error(`${field} must resolve to an existing directory.`);
	}
	return canonical;
}

function isWithin(parent: string, candidate: string): boolean {
	const relation = relative(parent, candidate);
	return relation === "" || (!relation.startsWith("..") && !isAbsolute(relation));
}

function executablePluginId(value: unknown): string {
	if (
		typeof value !== "string" ||
		value.length > 256 ||
		!/[a-z]/.test(value) ||
		!/^[a-z0-9@][a-z0-9@/._:-]*$/.test(value)
	) {
		throw new Error("Executable Plugin admission id is invalid.");
	}
	return value;
}

function capabilityName(value: unknown): string {
	if (
		typeof value !== "string" ||
		value.length > 128 ||
		!/[a-z]/.test(value) ||
		!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value)
	) {
		throw new Error("Executable Plugin capability is invalid.");
	}
	return value;
}

function pluginKind(value: unknown): ExecutablePluginKind {
	if (!EXECUTABLE_PLUGIN_KINDS.includes(value as ExecutablePluginKind)) {
		throw new Error("Executable Plugin kind is invalid.");
	}
	return value as ExecutablePluginKind;
}

function pluginTrustPlane(value: unknown): ExecutablePluginTrustPlane {
	if (!EXECUTABLE_PLUGIN_TRUST_PLANES.includes(value as ExecutablePluginTrustPlane)) {
		throw new Error("Executable Plugin trust plane is invalid.");
	}
	return value as ExecutablePluginTrustPlane;
}

function assertUnique(values: readonly string[], field: string): void {
	if (new Set(values).size !== values.length) {
		throw new Error(`${field} must be unique.`);
	}
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function hasExactKeys<T extends object>(
	value: T,
	expected: readonly string[],
): boolean {
	const actual = Object.keys(value).sort(compareText);
	const sortedExpected = [...expected].sort(compareText);
	return (
		actual.length === sortedExpected.length &&
		actual.every((key, index) => key === sortedExpected[index])
	);
}
