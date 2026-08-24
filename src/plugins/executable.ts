import { realpathSync, statSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
import {
	assertSha256Digest,
	canonicalJsonDigest,
	type Sha256Digest,
} from "../utils/canonical-json.ts";

export const EXECUTABLE_PLUGIN_MANIFEST_PROTOCOL = Object.freeze({
	id: "codewiki.executable-plugin-manifest",
	version: "1.0.0",
} as const);

export const EXECUTABLE_PLUGIN_INVENTORY_PROTOCOL = Object.freeze({
	id: "codewiki.executable-plugin-inventory",
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
export type ExecutablePluginInstallationSource = "release" | "operator";

export interface ExecutablePluginDependency {
	readonly pluginId: string;
	readonly version: string;
	readonly integrity: Sha256Digest;
	readonly manifestDigest: Sha256Digest;
}

export interface ExecutablePluginEntrypoint {
	readonly name: string;
	readonly packageExport: string;
}

export interface ExecutablePluginManifest {
	readonly protocol: typeof EXECUTABLE_PLUGIN_MANIFEST_PROTOCOL;
	readonly pluginId: string;
	readonly kind: ExecutablePluginKind;
	readonly version: string;
	readonly integrity: Sha256Digest;
	readonly trustPlane: ExecutablePluginTrustPlane;
	readonly capabilities: readonly string[];
	readonly dependencies: readonly ExecutablePluginDependency[];
	readonly entrypoints: readonly ExecutablePluginEntrypoint[];
	readonly manifestDigest: Sha256Digest;
}

export interface InstalledExecutablePlugin {
	readonly source: ExecutablePluginInstallationSource;
	readonly packageName: string;
	readonly installationRoot: string;
	readonly manifest: ExecutablePluginManifest;
}

export interface ExecutablePluginInventory {
	readonly protocol: typeof EXECUTABLE_PLUGIN_INVENTORY_PROTOCOL;
	readonly generation: number;
	readonly generatedAt: string;
	readonly plugins: readonly InstalledExecutablePlugin[];
	readonly pluginClosureDigest: Sha256Digest;
	readonly inventoryDigest: Sha256Digest;
}

export function createExecutablePluginManifest(
	input: Omit<ExecutablePluginManifest, "protocol" | "manifestDigest">,
): Readonly<ExecutablePluginManifest> {
	if (!hasExactKeys(input, [
		"pluginId",
		"kind",
		"version",
		"integrity",
		"trustPlane",
		"capabilities",
		"dependencies",
		"entrypoints",
	])) {
		throw new Error("Executable Plugin manifest shape is invalid.");
	}
	const pluginId = packageName(input.pluginId, "Executable Plugin id");
	const kind = pluginKind(input.kind);
	const trustPlane = pluginTrustPlane(input.trustPlane);
	assertKindTrustPlane(kind, trustPlane);
	const body = Object.freeze({
		protocol: EXECUTABLE_PLUGIN_MANIFEST_PROTOCOL,
		pluginId,
		kind,
		version: exactVersion(input.version, "Executable Plugin version"),
		integrity: assertSha256Digest(
			input.integrity,
			"Executable Plugin integrity",
		),
		trustPlane,
		capabilities: normalizedCapabilities(input.capabilities),
		dependencies: normalizedDependencies(input.dependencies, pluginId),
		entrypoints: normalizedEntrypoints(input.entrypoints),
	});
	return Object.freeze({...body, manifestDigest: canonicalJsonDigest(body)});
}

export function createExecutablePluginInventory(input: {
	readonly generation: number;
	readonly generatedAt: string;
	readonly projectRoot: string;
	readonly plugins: readonly InstalledExecutablePlugin[];
}): Readonly<ExecutablePluginInventory> {
	if (!hasExactKeys(input, ["generation", "generatedAt", "projectRoot", "plugins"])) {
		throw new Error("Executable Plugin inventory input shape is invalid.");
	}
	if (!Number.isSafeInteger(input.generation) || input.generation < 1) {
		throw new Error("Executable Plugin inventory generation is invalid.");
	}
	const generatedAt = timestamp(input.generatedAt, "Executable Plugin inventory generatedAt");
	const projectRoot = canonicalDirectory(input.projectRoot, "Project root");
	if (!Array.isArray(input.plugins) || input.plugins.length < 1 || input.plugins.length > 256) {
		throw new Error("Executable Plugin inventory size is invalid.");
	}
	const plugins = input.plugins
		.map((entry) => installedPlugin(entry, projectRoot))
		.sort((left, right) => compareText(left.manifest.pluginId, right.manifest.pluginId));
	assertInventoryUniqueness(plugins);
	assertInventoryDependencies(plugins);
	const pluginClosureDigest = canonicalJsonDigest(
		plugins.map((entry) => entry.manifest),
	);
	const body = Object.freeze({
		protocol: EXECUTABLE_PLUGIN_INVENTORY_PROTOCOL,
		generation: input.generation,
		generatedAt,
		plugins: Object.freeze(plugins),
		pluginClosureDigest,
	});
	return Object.freeze({...body, inventoryDigest: canonicalJsonDigest(body)});
}

function installedPlugin(
	value: InstalledExecutablePlugin,
	projectRoot: string,
): Readonly<InstalledExecutablePlugin> {
	if (!hasExactKeys(value, ["source", "packageName", "installationRoot", "manifest"])) {
		throw new Error("Installed executable Plugin shape is invalid.");
	}
	if (value.source !== "release" && value.source !== "operator") {
		throw new Error("Executable Plugin installation source is invalid.");
	}
	const manifest = recreateManifest(value.manifest);
	const packageId = packageName(value.packageName, "Executable Plugin package name");
	if (packageId !== manifest.pluginId) {
		throw new Error("Executable Plugin package name does not match its manifest id.");
	}
	const installationRoot = canonicalDirectory(
		value.installationRoot,
		"Executable Plugin installation root",
	);
	if (isWithin(projectRoot, installationRoot)) {
		throw new Error("Repository-local executable Plugin loading is prohibited.");
	}
	return Object.freeze({
		source: value.source,
		packageName: packageId,
		installationRoot,
		manifest,
	});
}

function recreateManifest(value: ExecutablePluginManifest): ExecutablePluginManifest {
	if (!hasExactKeys(value, [
		"protocol",
		"pluginId",
		"kind",
		"version",
		"integrity",
		"trustPlane",
		"capabilities",
		"dependencies",
		"entrypoints",
		"manifestDigest",
	])) {
		throw new Error("Installed executable Plugin manifest shape is invalid.");
	}
	if (
		value.protocol?.id !== EXECUTABLE_PLUGIN_MANIFEST_PROTOCOL.id ||
		value.protocol.version !== EXECUTABLE_PLUGIN_MANIFEST_PROTOCOL.version
	) {
		throw new Error("Executable Plugin manifest protocol is unsupported.");
	}
	const {protocol: _protocol, manifestDigest, ...input} = value;
	const recreated = createExecutablePluginManifest(input);
	if (recreated.manifestDigest !== manifestDigest) {
		throw new Error("Executable Plugin manifest identity is invalid.");
	}
	return recreated;
}

function normalizedCapabilities(values: readonly string[]): readonly string[] {
	if (!Array.isArray(values) || values.length < 1 || values.length > 128) {
		throw new Error("Executable Plugin capabilities are invalid.");
	}
	const normalized = values
		.map((value) => capabilityName(value))
		.sort(compareText);
	assertUnique(normalized, "Executable Plugin capability");
	return Object.freeze(normalized);
}

function normalizedDependencies(
	values: readonly ExecutablePluginDependency[],
	pluginId: string,
): readonly ExecutablePluginDependency[] {
	if (!Array.isArray(values) || values.length > 64) {
		throw new Error("Executable Plugin dependencies are invalid.");
	}
	const normalized = values.map((value) => {
		if (!hasExactKeys(value, ["pluginId", "version", "integrity", "manifestDigest"])) {
			throw new Error("Executable Plugin dependency shape is invalid.");
		}
		const dependency = Object.freeze({
			pluginId: packageName(value.pluginId, "Executable Plugin dependency id"),
			version: exactVersion(value.version, "Executable Plugin dependency version"),
			integrity: assertSha256Digest(
				value.integrity,
				"Executable Plugin dependency integrity",
			),
			manifestDigest: assertSha256Digest(
				value.manifestDigest,
				"Executable Plugin dependency manifest digest",
			),
		});
		if (dependency.pluginId === pluginId) {
			throw new Error("Executable Plugin cannot depend on itself.");
		}
		return dependency;
	}).sort((left, right) => compareText(left.pluginId, right.pluginId));
	assertUnique(normalized.map((value) => value.pluginId), "Executable Plugin dependency");
	return Object.freeze(normalized);
}

function normalizedEntrypoints(
	values: readonly ExecutablePluginEntrypoint[],
): readonly ExecutablePluginEntrypoint[] {
	if (!Array.isArray(values) || values.length < 1 || values.length > 32) {
		throw new Error("Executable Plugin entrypoints are invalid.");
	}
	const normalized = values.map((value) => {
		if (!hasExactKeys(value, ["name", "packageExport"])) {
			throw new Error("Executable Plugin entrypoint shape is invalid.");
		}
		return Object.freeze({
			name: capabilityName(value.name),
			packageExport: packageExport(value.packageExport),
		});
	}).sort((left, right) => compareText(left.name, right.name));
	assertUnique(normalized.map((value) => value.name), "Executable Plugin entrypoint");
	return Object.freeze(normalized);
}

function assertInventoryUniqueness(
	plugins: readonly InstalledExecutablePlugin[],
): void {
	assertUnique(
		plugins.map((entry) => entry.manifest.pluginId),
		"Executable Plugin inventory id",
	);
	assertUnique(
		plugins.map((entry) => entry.installationRoot),
		"Executable Plugin installation root",
	);
}

function assertInventoryDependencies(
	plugins: readonly InstalledExecutablePlugin[],
): void {
	const byId = new Map(plugins.map((entry) => [entry.manifest.pluginId, entry]));
	for (const entry of plugins) {
		for (const dependency of entry.manifest.dependencies) {
			const installed = byId.get(dependency.pluginId);
			if (
				!installed ||
				installed.manifest.version !== dependency.version ||
				installed.manifest.integrity !== dependency.integrity ||
				installed.manifest.manifestDigest !== dependency.manifestDigest
			) {
				throw new Error(
					`Executable Plugin dependency ${dependency.pluginId} is not installed at its exact identity.`,
				);
			}
			if (installed.manifest.trustPlane !== entry.manifest.trustPlane) {
				throw new Error("Executable Plugin dependencies cannot cross trust planes.");
			}
		}
	}
}

function assertKindTrustPlane(
	kind: ExecutablePluginKind,
	trustPlane: ExecutablePluginTrustPlane,
): void {
	const allowed: Readonly<Record<ExecutablePluginKind, readonly ExecutablePluginTrustPlane[]>> = {
		"dsh-plugin": ["broker-host", "run-process"],
		"infrastructure-provider": ["project-server", "broker-host"],
		"runtime-bridge": ["run-process"],
		"client-plugin": ["client"],
	};
	if (!allowed[kind].includes(trustPlane)) {
		throw new Error(`Executable Plugin kind ${kind} cannot enter trust plane ${trustPlane}.`);
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

function packageName(value: unknown, field: string): string {
	if (
		typeof value !== "string" ||
		value.length > 214 ||
		!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value)
	) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}

function exactVersion(value: unknown, field: string): string {
	if (
		typeof value !== "string" ||
		value.length > 128 ||
		!/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value)
	) {
		throw new Error(`${field} must be one exact semantic version.`);
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
		throw new Error("Executable Plugin capability or entrypoint name is invalid.");
	}
	return value;
}

function packageExport(value: unknown): string {
	if (
		typeof value !== "string" ||
		value.length > 256 ||
		(value !== "." && !/^\.\/[a-zA-Z0-9._/-]+$/.test(value)) ||
		value.includes("..") ||
		value.includes("\\")
	) {
		throw new Error("Executable Plugin package export is invalid.");
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

function timestamp(value: unknown, field: string): string {
	if (
		typeof value !== "string" ||
		!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
		Number.isNaN(Date.parse(value))
	) {
		throw new Error(`${field} must be an RFC 3339 UTC timestamp.`);
	}
	return value;
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
	return actual.length === sortedExpected.length &&
		actual.every((key, index) => key === sortedExpected[index]);
}
