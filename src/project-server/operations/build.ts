import {DEFAULT_DOMAIN_PLUGIN_IDENTITY} from "../../domains/defaults.ts";
import type {DomainPluginIdentity} from "../../domains/contracts.ts";
import {
	BACKEND_SUPPORT_MATRIX_PROTOCOL,
	BACKEND_V1_RELEASE_MANIFEST_PROTOCOL,
	BACKEND_V1_SUPPORT_MATRIX,
	RUNTIME_PRODUCTION_QUALIFICATION_PROTOCOL,
} from "../../protocol/backend-production.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {
	BACKEND_FAULT_RECOVERY_PROTOCOL,
	BACKEND_OBSERVABILITY_PROTOCOL,
} from "./contracts.ts";

export const LEGACY_BACKEND_BUILD_PROTOCOL = Object.freeze({
	id: "codewiki.backend-build",
	version: "1.0.0",
} as const);

export const BACKEND_BUILD_PROTOCOL = Object.freeze({
	id: "codewiki.backend-build",
	version: "2.0.0",
} as const);

export const SEMANTIC_KERNEL_BACKEND_BUILD_PROTOCOL = Object.freeze({
	id: "codewiki.backend-build",
	version: "3.0.0",
} as const);

export const CODEWIKI_PACKAGE_LOCK_DIGEST =
	"sha256:0624cb57b9fbd64ad80511bcb7d80f077881a05a37409e1d664e19b0c9920b8f" as const;
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
	readonly protocol: DomainPluginIdentity["protocol"];
	readonly pluginId: string;
	readonly pluginVersion: string;
	readonly admissionDigest: Sha256Digest;
	readonly implementationDigest: Sha256Digest;
	readonly identityDigest: Sha256Digest;
}

export interface LegacyBackendDomainPluginBinding {
	readonly pluginId: string;
	readonly pluginVersion: string;
	readonly admissionDigest: Sha256Digest;
	readonly identityDigest: Sha256Digest;
}

export interface LegacyBackendBuildBinding {
	readonly protocol: typeof LEGACY_BACKEND_BUILD_PROTOCOL;
	readonly packageName: "@nunomoura/codewiki";
	readonly packageVersion: string;
	readonly packageLockDigest: Sha256Digest;
	readonly dshProfiles: readonly BackendDshProfileBinding[];
	readonly domainPlugins: readonly LegacyBackendDomainPluginBinding[];
	readonly domainPluginClosureDigest: Sha256Digest;
	readonly fileSchemas: readonly BackendVersionBinding[];
	readonly protocols: readonly BackendVersionBinding[];
	readonly backendBuildDigest: Sha256Digest;
}

export interface CurrentBackendBuildBinding {
	readonly protocol: typeof BACKEND_BUILD_PROTOCOL;
	readonly packageName: "@nunomoura/codewiki";
	readonly packageVersion: string;
	readonly packageLockDigest: Sha256Digest;
	readonly supportMatrixDigest: Sha256Digest;
	readonly dshProfiles: readonly BackendDshProfileBinding[];
	readonly domainPlugins: readonly BackendDomainPluginBinding[];
	readonly domainPluginClosureDigest: Sha256Digest;
	readonly fileSchemas: readonly BackendVersionBinding[];
	readonly protocols: readonly BackendVersionBinding[];
	readonly backendBuildDigest: Sha256Digest;
}

export interface BackendCompatibilityComponentBinding extends BackendVersionBinding {
	readonly implementationDigest: Sha256Digest;
	readonly capabilityDigest: Sha256Digest;
}

export interface SemanticKernelBackendBuildBinding {
	readonly protocol: typeof SEMANTIC_KERNEL_BACKEND_BUILD_PROTOCOL;
	readonly packageName: "@nunomoura/codewiki";
	readonly packageVersion: string;
	readonly packageLockDigest: Sha256Digest;
	readonly supportMatrixDigest: Sha256Digest;
	readonly dshProfiles: readonly BackendDshProfileBinding[];
	readonly compatibilityComponents: readonly BackendCompatibilityComponentBinding[];
	readonly compatibilityClosureDigest: Sha256Digest;
	readonly fileSchemas: readonly BackendVersionBinding[];
	readonly protocols: readonly BackendVersionBinding[];
	readonly backendBuildDigest: Sha256Digest;
}

type DomainBackendBuildBinding =
	| LegacyBackendBuildBinding
	| CurrentBackendBuildBinding;

export type BackendBuildBinding =
	| DomainBackendBuildBinding
	| SemanticKernelBackendBuildBinding;

const DEFAULT_FILE_SCHEMAS = Object.freeze([
	{id: "codewiki.backend-state", version: "1.0.0"},
	{id: "codewiki.backend-state-backup", version: "1.0.0"},
	{id: "codewiki.backend-state-migration", version: "1.0.0"},
	{id: "codewiki.backend-state-restore", version: "1.0.0"},
	{id: "codewiki.backend-state-recovery", version: "1.0.0"},
	{id: "codewiki.backend-build-transition", version: "1.0.0"},
	{id: "codewiki.project-server-registry", version: "2.0.0"},
	{id: "codewiki.runtime-build-manifest", version: "4.0.0"},
	{id: "codewiki.runtime-build-registry", version: "1.0.0"},
] as const);

const DEFAULT_PROTOCOLS = Object.freeze([
	BACKEND_FAULT_RECOVERY_PROTOCOL,
	BACKEND_OBSERVABILITY_PROTOCOL,
	{id: "codewiki.domain-plugin-admission", version: "2.0.0"},
	{id: "codewiki.dsh-agent-session-custody", version: "1.0.0"},
	{id: "codewiki.execution-ledger", version: "5.0.0"},
	{id: "codewiki.frontend-api", version: "1.0.0"},
	{id: "codewiki.frontend-capabilities", version: "1.0.0"},
	{id: "codewiki.frontend-events", version: "1.0.0"},
	{id: "codewiki.gate-evaluation-package", version: "2.0.0"},
	{id: "codewiki.private-provider-broker", version: "3.0.0"},
	BACKEND_SUPPORT_MATRIX_PROTOCOL,
	BACKEND_V1_RELEASE_MANIFEST_PROTOCOL,
	RUNTIME_PRODUCTION_QUALIFICATION_PROTOCOL,
	{id: "codewiki.run-process", version: "6.0.0"},
	{id: "codewiki.run-receipt", version: "4.0.0"},
	{id: "codewiki.session-continuity", version: "1.0.0"},
] as const);

export const DEFAULT_BACKEND_BUILD = createBackendBuildBinding({
	packageVersion: "0.3.0",
	packageLockDigest: CODEWIKI_PACKAGE_LOCK_DIGEST,
	supportMatrixDigest: BACKEND_V1_SUPPORT_MATRIX.matrixDigest,
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

export const DEFAULT_SEMANTIC_KERNEL_BACKEND_BUILD =
	createSemanticKernelBackendBuildBinding({
		packageVersion: "0.3.0",
		packageLockDigest: CODEWIKI_PACKAGE_LOCK_DIGEST,
		supportMatrixDigest: BACKEND_V1_SUPPORT_MATRIX.matrixDigest,
		dshProfiles: DEFAULT_BACKEND_BUILD.dshProfiles,
		compatibilityComponents: [
			{
				id: "codewiki.compatibility.backend-v1",
				version: "1.0.0",
				implementationDigest: DEFAULT_DOMAIN_PLUGIN_IDENTITY.implementationDigest,
				capabilityDigest: canonicalJsonDigest({
					packs: true,
					checks: true,
					sourceProvider: true,
					projectBehavior: true,
				}),
			},
		],
		fileSchemas: [
			...DEFAULT_FILE_SCHEMAS,
			{id: "codewiki.project-config", version: "2.0.0"},
			{id: "codewiki.wiki-item", version: "1.0.0"},
			{id: "codewiki.change-trace", version: "1.3.0"},
		],
		protocols: [
			...DEFAULT_PROTOCOLS.filter(({id}) => id !== "codewiki.domain-plugin-admission"),
			{id: "codewiki.kb-to-wiki-migration-receipt", version: "2.0.0"},
		],
	});

export function createBackendBuildBinding(input: {
	readonly packageVersion: string;
	readonly packageLockDigest: Sha256Digest;
	readonly supportMatrixDigest: Sha256Digest;
	readonly dshProfiles: readonly BackendDshProfileBinding[];
	readonly domainPlugins: readonly BackendDomainPluginBinding[];
	readonly fileSchemas: readonly BackendVersionBinding[];
	readonly protocols: readonly BackendVersionBinding[];
}): CurrentBackendBuildBinding {
	const dshProfiles = normalizedProfiles(input.dshProfiles);
	const domainPlugins = normalizedDomainPlugins(input.domainPlugins);
	const body = {
		protocol: BACKEND_BUILD_PROTOCOL,
		packageName: "@nunomoura/codewiki" as const,
		packageVersion: version(input.packageVersion, "Backend package version"),
		packageLockDigest: digest(input.packageLockDigest, "Backend package-lock digest"),
		supportMatrixDigest: digest(input.supportMatrixDigest, "Backend support matrix digest"),
		dshProfiles,
		domainPlugins,
		domainPluginClosureDigest: canonicalJsonDigest(domainPlugins),
		fileSchemas: normalizedVersions(input.fileSchemas, "Backend file schema"),
		protocols: normalizedVersions(input.protocols, "Backend protocol"),
	};
	return Object.freeze({...body, backendBuildDigest: canonicalJsonDigest(body)});
}

export function createSemanticKernelBackendBuildBinding(input: {
	readonly packageVersion: string;
	readonly packageLockDigest: Sha256Digest;
	readonly supportMatrixDigest: Sha256Digest;
	readonly dshProfiles: readonly BackendDshProfileBinding[];
	readonly compatibilityComponents: readonly BackendCompatibilityComponentBinding[];
	readonly fileSchemas: readonly BackendVersionBinding[];
	readonly protocols: readonly BackendVersionBinding[];
}): SemanticKernelBackendBuildBinding {
	const dshProfiles = normalizedProfiles(input.dshProfiles);
	const compatibilityComponents = normalizedCompatibilityComponents(
		input.compatibilityComponents,
	);
	const body = {
		protocol: SEMANTIC_KERNEL_BACKEND_BUILD_PROTOCOL,
		packageName: "@nunomoura/codewiki" as const,
		packageVersion: version(input.packageVersion, "Backend package version"),
		packageLockDigest: digest(input.packageLockDigest, "Backend package-lock digest"),
		supportMatrixDigest: digest(input.supportMatrixDigest, "Backend support matrix digest"),
		dshProfiles,
		compatibilityComponents,
		compatibilityClosureDigest: canonicalJsonDigest(compatibilityComponents),
		fileSchemas: normalizedVersions(input.fileSchemas, "Backend file schema"),
		protocols: normalizedVersions(input.protocols, "Backend protocol"),
	};
	return Object.freeze({...body, backendBuildDigest: canonicalJsonDigest(body)});
}

export function assertBackendBuildBinding(value: unknown): asserts value is BackendBuildBinding {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Backend Build binding is invalid.");
	}
	const record = value as Partial<
		CurrentBackendBuildBinding & LegacyBackendBuildBinding & SemanticKernelBackendBuildBinding
	>;
	if (canonicalJson(record.protocol) === canonicalJson(LEGACY_BACKEND_BUILD_PROTOCOL)) {
		assertLegacyBackendBuildBinding(record);
		return;
	}
	const normalized = canonicalJson(record.protocol) ===
		canonicalJson(SEMANTIC_KERNEL_BACKEND_BUILD_PROTOCOL)
		? createSemanticKernelBackendBuildBinding({
			packageVersion: record.packageVersion as string,
			packageLockDigest: record.packageLockDigest as Sha256Digest,
			supportMatrixDigest: record.supportMatrixDigest as Sha256Digest,
			dshProfiles: record.dshProfiles as readonly BackendDshProfileBinding[],
			compatibilityComponents:
				record.compatibilityComponents as readonly BackendCompatibilityComponentBinding[],
			fileSchemas: record.fileSchemas as readonly BackendVersionBinding[],
			protocols: record.protocols as readonly BackendVersionBinding[],
		})
		: createBackendBuildBinding({
			packageVersion: record.packageVersion as string,
			packageLockDigest: record.packageLockDigest as Sha256Digest,
			supportMatrixDigest: record.supportMatrixDigest as Sha256Digest,
			dshProfiles: record.dshProfiles as readonly BackendDshProfileBinding[],
			domainPlugins: record.domainPlugins as readonly BackendDomainPluginBinding[],
			fileSchemas: record.fileSchemas as readonly BackendVersionBinding[],
			protocols: record.protocols as readonly BackendVersionBinding[],
		});
	if (canonicalJson(record) !== canonicalJson(normalized)) {
		throw new Error("Backend Build binding digest or shape is invalid.");
	}
}

function assertLegacyBackendBuildBinding(
	record: Partial<CurrentBackendBuildBinding & LegacyBackendBuildBinding>,
): void {
	const dshProfiles = normalizedProfiles(
		record.dshProfiles as readonly BackendDshProfileBinding[],
	);
	const domainPlugins = normalizedLegacyDomainPlugins(
		record.domainPlugins as readonly LegacyBackendDomainPluginBinding[],
	);
	const body = {
		protocol: LEGACY_BACKEND_BUILD_PROTOCOL,
		packageName: "@nunomoura/codewiki" as const,
		packageVersion: version(record.packageVersion, "Backend package version"),
		packageLockDigest: digest(record.packageLockDigest, "Backend package-lock digest"),
		dshProfiles,
		domainPlugins,
		domainPluginClosureDigest: canonicalJsonDigest(domainPlugins),
		fileSchemas: normalizedVersions(
			record.fileSchemas as readonly BackendVersionBinding[],
			"Backend file schema",
		),
		protocols: normalizedVersions(
			record.protocols as readonly BackendVersionBinding[],
			"Backend protocol",
		),
	};
	const normalized = Object.freeze({
		...body,
		backendBuildDigest: canonicalJsonDigest(body),
	});
	if (canonicalJson(record) !== canonicalJson(normalized)) {
		throw new Error("Backend Build binding digest or shape is invalid.");
	}
}

export function backendBuildDomainClosureCompatible(
	current: BackendBuildBinding,
	target: BackendBuildBinding,
): boolean {
	assertBackendBuildBinding(current);
	assertBackendBuildBinding(target);
	if (!isDomainBackendBuild(current) || !isDomainBackendBuild(target)) return false;
	if (current.domainPluginClosureDigest === target.domainPluginClosureDigest) return true;
	if (
		current.protocol.version !== LEGACY_BACKEND_BUILD_PROTOCOL.version ||
		target.protocol.version !== BACKEND_BUILD_PROTOCOL.version ||
		current.domainPlugins.length !== target.domainPlugins.length
	) {
		return false;
	}
	return current.domainPlugins.every((legacy) => {
		const exact = target.domainPlugins.find((candidate) => candidate.pluginId === legacy.pluginId);
		return Boolean(
			exact &&
			exact.pluginVersion === legacy.pluginVersion &&
			exact.admissionDigest === legacy.admissionDigest &&
			exact.identityDigest === legacy.identityDigest,
		);
	});
}

export function backendBuildIncompatibleFileSchema(
	current: BackendBuildBinding,
	target: BackendBuildBinding,
): BackendVersionBinding | null {
	assertBackendBuildBinding(current);
	assertBackendBuildBinding(target);
	return current.fileSchemas.find((schema) => !fileSchemaSupported(schema, target)) ?? null;
}

export function backendBuildFileSchemasCompatible(
	current: BackendBuildBinding,
	target: BackendBuildBinding,
): boolean {
	return backendBuildIncompatibleFileSchema(current, target) === null;
}

function fileSchemaSupported(
	schema: BackendVersionBinding,
	target: BackendBuildBinding,
): boolean {
	if (target.fileSchemas.some(
		(candidate) => candidate.id === schema.id && candidate.version === schema.version,
	)) {
		return true;
	}
	return schema.id === "codewiki.runtime-build-manifest" &&
		schema.version === "3.0.0" &&
		target.fileSchemas.some(
			(candidate) => candidate.id === schema.id && candidate.version === "4.0.0",
		);
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

function normalizedCompatibilityComponents(
	values: readonly BackendCompatibilityComponentBinding[],
): readonly BackendCompatibilityComponentBinding[] {
	if (!Array.isArray(values) || values.length > 16) {
		throw new Error("Backend Build compatibility component closure is invalid.");
	}
	const normalized = values.map((entry) => Object.freeze({
		id: identifier(entry?.id, "Compatibility component id"),
		version: version(entry?.version, "Compatibility component version"),
		implementationDigest: digest(
			entry?.implementationDigest,
			"Compatibility component implementation digest",
		),
		capabilityDigest: digest(
			entry?.capabilityDigest,
			"Compatibility component capability digest",
		),
	})).sort(compareBinding);
	assertUnique(normalized.map((entry) => entry.id), "Compatibility component id");
	return Object.freeze(normalized);
}

function normalizedDomainPlugins(
	values: readonly BackendDomainPluginBinding[],
): readonly BackendDomainPluginBinding[] {
	if (!Array.isArray(values) || values.length === 0 || values.length > 16) {
		throw new Error("Backend Build Domain Plugin closure is invalid.");
	}
	const normalized = values.map((entry) => Object.freeze({
		protocol: domainPluginIdentityProtocol(entry?.protocol),
		pluginId: identifier(entry?.pluginId, "Domain Plugin id"),
		pluginVersion: version(entry?.pluginVersion, "Domain Plugin version"),
		admissionDigest: digest(entry?.admissionDigest, "Domain Plugin admission digest"),
		implementationDigest: digest(
			entry?.implementationDigest,
			"Domain Plugin implementation digest",
		),
		identityDigest: digest(entry?.identityDigest, "Domain Plugin identity digest"),
	})).sort((left, right) => left.pluginId.localeCompare(right.pluginId));
	assertUnique(normalized.map((entry) => entry.pluginId), "Domain Plugin id");
	return Object.freeze(normalized);
}

function normalizedLegacyDomainPlugins(
	values: readonly LegacyBackendDomainPluginBinding[],
): readonly LegacyBackendDomainPluginBinding[] {
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

function isDomainBackendBuild(
	value: BackendBuildBinding,
): value is DomainBackendBuildBinding {
	return value.protocol.version !== SEMANTIC_KERNEL_BACKEND_BUILD_PROTOCOL.version;
}

function domainPluginIdentityProtocol(
	value: BackendDomainPluginBinding["protocol"] | undefined,
): BackendDomainPluginBinding["protocol"] {
	if (canonicalJson(value) !== canonicalJson(DEFAULT_DOMAIN_PLUGIN_IDENTITY.protocol)) {
		throw new Error("Backend Build Domain Plugin identity protocol is invalid.");
	}
	return DEFAULT_DOMAIN_PLUGIN_IDENTITY.protocol;
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
