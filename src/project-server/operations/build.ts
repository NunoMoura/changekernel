import {DEFAULT_DOMAIN_PLUGIN_IDENTITY} from "../../domains/defaults.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export const BACKEND_BUILD_PROTOCOL = Object.freeze({
	id: "codewiki.backend-build",
	version: "1.0.0",
} as const);

export const CODEWIKI_PACKAGE_LOCK_DIGEST =
	"sha256:6d372d90ad3fe187f4c76e1d6070fa04706523b6011dc58a738291ecfb1a98f1" as const;
export const DSH_MANAGED_PROFILE_CLOSURE_DIGEST =
	"sha256:8ce389864db2da25dc8068b480d2ccdc422d4c0cc6b4c6eeb8eb403f55986d02" as const;
export const DSH_BROKER_HOST_PROFILE_CLOSURE_DIGEST =
	"sha256:a60d1c4f0d7e1d7607517faebb802397c1beee2a6d571c0bb33f6a9de5f7110b" as const;

export interface BackendVersionBinding {
	readonly id: string;
	readonly version: string;
}

export interface BackendDshProfileBinding extends BackendVersionBinding {
	readonly closureDigest: Sha256Digest;
}

export interface BackendDomainPluginBinding {
	readonly pluginId: string;
	readonly pluginVersion: string;
	readonly admissionDigest: Sha256Digest;
	readonly identityDigest: Sha256Digest;
}

export interface BackendBuildBinding {
	readonly protocol: typeof BACKEND_BUILD_PROTOCOL;
	readonly packageName: "@nunomoura/codewiki";
	readonly packageVersion: string;
	readonly packageLockDigest: Sha256Digest;
	readonly dshProfiles: readonly BackendDshProfileBinding[];
	readonly domainPlugins: readonly BackendDomainPluginBinding[];
	readonly domainPluginClosureDigest: Sha256Digest;
	readonly fileSchemas: readonly BackendVersionBinding[];
	readonly protocols: readonly BackendVersionBinding[];
	readonly backendBuildDigest: Sha256Digest;
}

const DEFAULT_FILE_SCHEMAS = Object.freeze([
	{id: "codewiki.backend-state", version: "1.0.0"},
	{id: "codewiki.backend-state-backup", version: "1.0.0"},
	{id: "codewiki.backend-state-migration", version: "1.0.0"},
	{id: "codewiki.backend-state-restore", version: "1.0.0"},
	{id: "codewiki.backend-state-recovery", version: "1.0.0"},
	{id: "codewiki.backend-build-transition", version: "1.0.0"},
	{id: "codewiki.project-server-registry", version: "2.0.0"},
	{id: "codewiki.runtime-build-manifest", version: "3.0.0"},
	{id: "codewiki.runtime-build-registry", version: "1.0.0"},
] as const);

const DEFAULT_PROTOCOLS = Object.freeze([
	{id: "codewiki.domain-plugin-admission", version: "2.0.0"},
	{id: "codewiki.dsh-agent-session-custody", version: "1.0.0"},
	{id: "codewiki.execution-ledger", version: "5.0.0"},
	{id: "codewiki.frontend-api", version: "1.0.0"},
	{id: "codewiki.frontend-capabilities", version: "1.0.0"},
	{id: "codewiki.frontend-events", version: "1.0.0"},
	{id: "codewiki.gate-evaluation-package", version: "2.0.0"},
	{id: "codewiki.private-provider-broker", version: "3.0.0"},
	{id: "codewiki.run-process", version: "6.0.0"},
	{id: "codewiki.run-receipt", version: "4.0.0"},
	{id: "codewiki.session-continuity", version: "1.0.0"},
] as const);

export const DEFAULT_BACKEND_BUILD = createBackendBuildBinding({
	packageVersion: "0.3.0",
	packageLockDigest: CODEWIKI_PACKAGE_LOCK_DIGEST,
	dshProfiles: [
		{
			id: "codewiki.dsh.managed-run",
			version: "1.0.0",
			closureDigest: DSH_MANAGED_PROFILE_CLOSURE_DIGEST,
		},
		{
			id: "codewiki.dsh.broker-host",
			version: "1.0.0",
			closureDigest: DSH_BROKER_HOST_PROFILE_CLOSURE_DIGEST,
		},
	],
	domainPlugins: [DEFAULT_DOMAIN_PLUGIN_IDENTITY],
	fileSchemas: DEFAULT_FILE_SCHEMAS,
	protocols: DEFAULT_PROTOCOLS,
});

export function createBackendBuildBinding(input: {
	readonly packageVersion: string;
	readonly packageLockDigest: Sha256Digest;
	readonly dshProfiles: readonly BackendDshProfileBinding[];
	readonly domainPlugins: readonly BackendDomainPluginBinding[];
	readonly fileSchemas: readonly BackendVersionBinding[];
	readonly protocols: readonly BackendVersionBinding[];
}): BackendBuildBinding {
	const dshProfiles = normalizedProfiles(input.dshProfiles);
	const domainPlugins = normalizedDomainPlugins(input.domainPlugins);
	const body = {
		protocol: BACKEND_BUILD_PROTOCOL,
		packageName: "@nunomoura/codewiki" as const,
		packageVersion: version(input.packageVersion, "Backend package version"),
		packageLockDigest: digest(input.packageLockDigest, "Backend package-lock digest"),
		dshProfiles,
		domainPlugins,
		domainPluginClosureDigest: canonicalJsonDigest(domainPlugins),
		fileSchemas: normalizedVersions(input.fileSchemas, "Backend file schema"),
		protocols: normalizedVersions(input.protocols, "Backend protocol"),
	};
	return Object.freeze({...body, backendBuildDigest: canonicalJsonDigest(body)});
}

export function assertBackendBuildBinding(value: unknown): asserts value is BackendBuildBinding {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Backend Build binding is invalid.");
	}
	const record = value as Partial<BackendBuildBinding>;
	const normalized = createBackendBuildBinding({
		packageVersion: record.packageVersion as string,
		packageLockDigest: record.packageLockDigest as Sha256Digest,
		dshProfiles: record.dshProfiles as readonly BackendDshProfileBinding[],
		domainPlugins: record.domainPlugins as readonly BackendDomainPluginBinding[],
		fileSchemas: record.fileSchemas as readonly BackendVersionBinding[],
		protocols: record.protocols as readonly BackendVersionBinding[],
	});
	if (canonicalJson(record) !== canonicalJson(normalized)) {
		throw new Error("Backend Build binding digest or shape is invalid.");
	}
}

export function backendBuildSupportsStateSchema(
	build: BackendBuildBinding,
	schemaVersion: string,
): boolean {
	assertBackendBuildBinding(build);
	return build.fileSchemas.some(
		(entry) => entry.id === "codewiki.backend-state" && entry.version === schemaVersion,
	);
}

function normalizedProfiles(
	values: readonly BackendDshProfileBinding[],
): readonly BackendDshProfileBinding[] {
	if (!Array.isArray(values) || values.length === 0 || values.length > 16) {
		throw new Error("Backend Build DSH profiles are invalid.");
	}
	const normalized = values.map((entry) => Object.freeze({
		id: identifier(entry?.id, "DSH profile id"),
		version: version(entry?.version, "DSH profile version"),
		closureDigest: digest(entry?.closureDigest, "DSH profile closure digest"),
	})).sort(compareBinding);
	assertUnique(normalized.map((entry) => entry.id), "DSH profile id");
	return Object.freeze(normalized);
}

function normalizedDomainPlugins(
	values: readonly BackendDomainPluginBinding[],
): readonly BackendDomainPluginBinding[] {
	if (!Array.isArray(values) || values.length === 0 || values.length > 16) {
		throw new Error("Backend Build Domain Plugin closure is invalid.");
	}
	const normalized = values.map((entry) => Object.freeze({
		pluginId: identifier(entry?.pluginId, "Domain Plugin id"),
		pluginVersion: version(entry?.pluginVersion, "Domain Plugin version"),
		admissionDigest: digest(entry?.admissionDigest, "Domain Plugin admission digest"),
		identityDigest: digest(entry?.identityDigest, "Domain Plugin identity digest"),
	})).sort((left, right) => left.pluginId.localeCompare(right.pluginId));
	assertUnique(normalized.map((entry) => entry.pluginId), "Domain Plugin id");
	return Object.freeze(normalized);
}

function normalizedVersions(
	values: readonly BackendVersionBinding[],
	label: string,
): readonly BackendVersionBinding[] {
	if (!Array.isArray(values) || values.length === 0 || values.length > 128) {
		throw new Error(`${label} bindings are invalid.`);
	}
	const normalized = values.map((entry) => Object.freeze({
		id: identifier(entry?.id, `${label} id`),
		version: version(entry?.version, `${label} version`),
	})).sort(compareBinding);
	assertUnique(normalized.map((entry) => entry.id), `${label} id`);
	return Object.freeze(normalized);
}

function identifier(value: unknown, field: string): string {
	if (typeof value !== "string" || !/^[a-z0-9@][a-z0-9@./_-]{0,127}$/u.test(value)) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}

function version(value: unknown, field: string): string {
	if (typeof value !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(value)) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}

function digest(value: unknown, field: string): Sha256Digest {
	if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value)) {
		throw new Error(`${field} is invalid.`);
	}
	return value as Sha256Digest;
}

function assertUnique(values: readonly string[], field: string): void {
	if (new Set(values).size !== values.length) throw new Error(`${field} must be unique.`);
}

function compareBinding(left: BackendVersionBinding, right: BackendVersionBinding): number {
	return left.id.localeCompare(right.id);
}
