import {
	assertSha256Digest,
	canonicalJson,
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../utils/canonical-json.ts";

export const DOMAIN_PLUGIN_ADMISSION_PROTOCOL = Object.freeze({
	id: "codewiki.domain-plugin-admission",
	version: "2.0.0",
} as const);

export const DOMAIN_PLUGIN_IDENTITY_PROTOCOL = Object.freeze({
	id: "codewiki.domain-plugin-identity",
	version: "1.0.0",
} as const);

export type DomainPluginContributionName =
	| "knowledge-vocabulary"
	| "knowledge-relationships"
	| "context-compilation"
	| "source-realization"
	| "check-inputs"
	| "git-integration"
	| "delivery-bindings"
	| "system-diagrams"
	| "fact-classification";

export interface DomainPluginEntrypoints {
	readonly projectServer: string;
	readonly dshPlugins: readonly string[];
	readonly clientPlugins: readonly string[];
}

export interface DomainPluginContractRanges {
	readonly codewiki: string;
	readonly dsh: string;
}

export interface DomainPluginDataLimits {
	readonly maxKnowledgeBytes: number;
	readonly maxCandidateBytes: number;
	readonly maxContextBytes: number;
}

export interface DomainPluginManifest {
	readonly protocol: typeof DOMAIN_PLUGIN_ADMISSION_PROTOCOL;
	readonly pluginId: string;
	readonly pluginVersion: string;
	readonly kind: "project-server-contribution";
	readonly packageName: string;
	readonly packageIntegrity: Sha256Digest;
	readonly implementationDigest: Sha256Digest;
	readonly entrypoints: DomainPluginEntrypoints;
	readonly dependencyClosureDigest: Sha256Digest;
	readonly contractRanges: DomainPluginContractRanges;
	readonly dataLimits: DomainPluginDataLimits;
	readonly qualificationEvidenceDigest: Sha256Digest;
	readonly contributions: readonly DomainPluginContributionName[];
	readonly compilerId: string;
}

export interface DomainPluginAdmission {
	readonly manifest: DomainPluginManifest;
	readonly admissionDigest: Sha256Digest;
}

export interface DomainPluginIdentity {
	readonly protocol: typeof DOMAIN_PLUGIN_IDENTITY_PROTOCOL;
	readonly pluginId: string;
	readonly pluginVersion: string;
	readonly admissionDigest: Sha256Digest;
	readonly implementationDigest: Sha256Digest;
	readonly identityDigest: Sha256Digest;
}

export interface CreateDomainPluginAdmissionInput {
	readonly pluginId: string;
	readonly pluginVersion: string;
	readonly packageName: string;
	readonly packageIntegrity: Sha256Digest;
	readonly implementationDigest: Sha256Digest;
	readonly entrypoints: DomainPluginEntrypoints;
	readonly dependencyClosureDigest: Sha256Digest;
	readonly contractRanges: DomainPluginContractRanges;
	readonly dataLimits: DomainPluginDataLimits;
	readonly qualificationEvidenceDigest: Sha256Digest;
	readonly contributions: readonly DomainPluginContributionName[];
	readonly compilerId: string;
}

const PLUGIN_ID_PATTERN = /^codewiki\.domain\.[a-z][a-z0-9-]*$/;
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const CONTRACT_RANGE_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
const ENTRYPOINT_PATTERN = /^[A-Za-z][A-Za-z0-9._/-]*$/;

const CONTRIBUTION_NAMES: ReadonlySet<string> = new Set([
	"knowledge-vocabulary",
	"knowledge-relationships",
	"context-compilation",
	"source-realization",
	"check-inputs",
	"git-integration",
	"delivery-bindings",
	"system-diagrams",
	"fact-classification",
]);

export function createDomainPluginAdmission(
	input: CreateDomainPluginAdmissionInput,
): DomainPluginAdmission {
	const packageName = text(input.packageName, "packageName");
	if (!PACKAGE_NAME_PATTERN.test(packageName)) {
		throw new Error(`Domain Plugin package name ${packageName} is invalid.`);
	}
	// SAFETY: every manifest field is normalized above/below and canonicalization deep-freezes exact JSON bytes.
	const manifest = toCanonicalJsonValue({
		protocol: DOMAIN_PLUGIN_ADMISSION_PROTOCOL,
		pluginId: text(input.pluginId, "pluginId"),
		pluginVersion: version(input.pluginVersion),
		kind: "project-server-contribution",
		packageName,
		packageIntegrity: assertSha256Digest(
			input.packageIntegrity,
			"Domain Plugin package integrity",
		),
		implementationDigest: assertSha256Digest(
			input.implementationDigest,
			"Domain Plugin implementation digest",
		),
		entrypoints: normalizedEntrypoints(input.entrypoints),
		dependencyClosureDigest: assertSha256Digest(
			input.dependencyClosureDigest,
			"Domain Plugin dependency closure digest",
		),
		contractRanges: normalizedContractRanges(input.contractRanges),
		dataLimits: normalizedDataLimits(input.dataLimits),
		qualificationEvidenceDigest: assertSha256Digest(
			input.qualificationEvidenceDigest,
			"Domain Plugin qualification Evidence digest",
		),
		contributions: contributions(input.contributions),
		compilerId: text(input.compilerId, "compilerId"),
	}) as unknown as DomainPluginManifest;
	if (!PLUGIN_ID_PATTERN.test(manifest.pluginId)) {
		throw new Error(`Domain Plugin ID ${manifest.pluginId} is invalid.`);
	}
	// SAFETY: manifest has exact validated shape and digest binds its canonical bytes.
	return toCanonicalJsonValue({
		manifest,
		admissionDigest: canonicalJsonDigest(manifest),
	}) as unknown as DomainPluginAdmission;
}

export function assertDomainPluginAdmission(
	value: DomainPluginAdmission,
): void {
	if (!value || typeof value !== "object") {
		throw new Error("Domain Plugin admission shape is invalid.");
	}
	const manifest = value.manifest;
	if (!manifest || typeof manifest !== "object") {
		throw new Error("Domain Plugin admission manifest is invalid.");
	}
	const recreated = createDomainPluginAdmission({
		pluginId: manifest.pluginId,
		pluginVersion: manifest.pluginVersion,
		packageName: manifest.packageName,
		packageIntegrity: manifest.packageIntegrity,
		implementationDigest: manifest.implementationDigest,
		entrypoints: manifest.entrypoints,
		dependencyClosureDigest: manifest.dependencyClosureDigest,
		contractRanges: manifest.contractRanges,
		dataLimits: manifest.dataLimits,
		qualificationEvidenceDigest: manifest.qualificationEvidenceDigest,
		contributions: manifest.contributions,
		compilerId: manifest.compilerId,
	});
	if (canonicalJson(value) !== canonicalJson(recreated)) {
		throw new Error("Domain Plugin admission digest or manifest is invalid.");
	}
}

export function domainPluginIdentity(
	admission: DomainPluginAdmission,
): DomainPluginIdentity {
	assertDomainPluginAdmission(admission);
	const body = {
		protocol: DOMAIN_PLUGIN_IDENTITY_PROTOCOL,
		pluginId: admission.manifest.pluginId,
		pluginVersion: admission.manifest.pluginVersion,
		admissionDigest: admission.admissionDigest,
		implementationDigest: admission.manifest.implementationDigest,
	};
	// SAFETY: body contains every validated identity field and identityDigest binds canonical bytes.
	return toCanonicalJsonValue({
		...body,
		identityDigest: canonicalJsonDigest(body),
	}) as unknown as DomainPluginIdentity;
}

export function assertDomainPluginIdentity(
	value: DomainPluginIdentity,
): void {
	if (!value || typeof value !== "object") {
		throw new Error("Domain Plugin identity shape is invalid.");
	}
	const body = {
		protocol: DOMAIN_PLUGIN_IDENTITY_PROTOCOL,
		pluginId: value.pluginId,
		pluginVersion: value.pluginVersion,
		admissionDigest: value.admissionDigest,
		implementationDigest: value.implementationDigest,
	};
	if (
		canonicalJson(value.protocol) !== canonicalJson(DOMAIN_PLUGIN_IDENTITY_PROTOCOL) ||
		!PLUGIN_ID_PATTERN.test(value.pluginId) ||
		!VERSION_PATTERN.test(value.pluginVersion)
	) {
		throw new Error("Domain Plugin identity fields are invalid.");
	}
	assertSha256Digest(value.admissionDigest, "Domain Plugin admission digest");
	assertSha256Digest(value.implementationDigest, "Domain Plugin implementation digest");
	assertSha256Digest(value.identityDigest, "Domain Plugin identity digest");
	if (
		Reflect.ownKeys(value).length !== 6 ||
		value.identityDigest !== canonicalJsonDigest(body)
	) {
		throw new Error("Domain Plugin identity digest or shape is invalid.");
	}
}

export interface DomainRegistry {
	readonly admissions: readonly DomainPluginAdmission[];
	requireDomainPlugin(pluginId: string): DomainPluginAdmission;
}

export const DEFAULT_DOMAIN_PLUGIN_ID = "codewiki.domain.software-development";

export function createDomainRegistry(
	admissions: readonly DomainPluginAdmission[],
): DomainRegistry {
	if (!Array.isArray(admissions)) {
		throw new Error("Domain Plugin admissions must be an array.");
	}
	const byId = new Map<string, DomainPluginAdmission>();
	for (const candidate of admissions) {
		assertDomainPluginAdmission(candidate);
		// SAFETY: assertDomainPluginAdmission established exact shape and digest before canonical deep copy.
		const admission = toCanonicalJsonValue(candidate) as unknown as DomainPluginAdmission;
		const pluginId = admission.manifest.pluginId;
		if (byId.has(pluginId)) {
			throw new Error(`Domain Plugin ${pluginId} is admitted more than once.`);
		}
		byId.set(pluginId, admission);
	}
	const frozenAdmissions = Object.freeze([...byId.values()].sort((left, right) =>
		left.manifest.pluginId.localeCompare(right.manifest.pluginId),
	));
	return Object.freeze({
		admissions: frozenAdmissions,
		requireDomainPlugin(pluginId: string): DomainPluginAdmission {
			const admission = byId.get(text(pluginId, "pluginId"));
			if (!admission) {
				throw new Error(`Domain Plugin ${pluginId} is not admitted.`);
			}
			return admission;
		},
	});
}

export interface WikiConfigDomainSelection {
	readonly pluginId: string | null;
	readonly pluginVersion?: string | null;
	readonly admissionDigest?: Sha256Digest | null;
}

/** Resolves one exact project Domain selection against the release registry. */
export function resolveDomainPluginSelection(
	domain: WikiConfigDomainSelection | undefined,
	registry: DomainRegistry,
): DomainPluginAdmission {
	const pluginId = domain?.pluginId ?? DEFAULT_DOMAIN_PLUGIN_ID;
	const admission = registry.requireDomainPlugin(pluginId);
	if (
		domain?.pluginVersion != null &&
		domain.pluginVersion !== admission.manifest.pluginVersion
	) {
		throw new Error(`Domain Plugin ${pluginId} version is not admitted.`);
	}
	if (
		domain?.admissionDigest != null &&
		domain.admissionDigest !== admission.admissionDigest
	) {
		throw new Error(`Domain Plugin ${pluginId} admission digest is not admitted.`);
	}
	return admission;
}

function text(value: unknown, field: string): string {
	if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
		throw new Error(`Domain Plugin ${field} must be a nonempty string.`);
	}
	return value;
}

function version(value: unknown): string {
	const resolved = text(value, "pluginVersion");
	if (!VERSION_PATTERN.test(resolved)) {
		throw new Error(`Domain Plugin version ${resolved} is invalid.`);
	}
	return resolved;
}

function contributions(
	values: readonly DomainPluginContributionName[],
): readonly DomainPluginContributionName[] {
	if (!Array.isArray(values)) {
		throw new Error("Domain Plugin contributions must be an array.");
	}
	for (const value of values) {
		if (!CONTRIBUTION_NAMES.has(value)) {
			throw new Error(`Domain Plugin contribution ${value} is unknown.`);
		}
	}
	const sorted = [...new Set(values)].sort();
	if (sorted.length !== values.length) {
		throw new Error("Domain Plugin contributions must not contain duplicates.");
	}
	return Object.freeze(sorted);
}

function normalizedEntrypoints(value: DomainPluginEntrypoints): DomainPluginEntrypoints {
	if (!value || typeof value !== "object") {
		throw new Error("Domain Plugin entrypoints are invalid.");
	}
	return Object.freeze({
		projectServer: entrypoint(value.projectServer, "projectServer"),
		dshPlugins: normalizedTextList(value.dshPlugins, "DSH Plugin entrypoint"),
		clientPlugins: normalizedTextList(value.clientPlugins, "Client Plugin entrypoint"),
	});
}

function entrypoint(value: unknown, field: string): string {
	const resolved = text(value, field);
	if (!ENTRYPOINT_PATTERN.test(resolved) || resolved.includes("..")) {
		throw new Error(`Domain Plugin ${field} entrypoint is invalid.`);
	}
	return resolved;
}

function normalizedTextList(values: readonly string[], field: string): readonly string[] {
	if (!Array.isArray(values) || values.length > 64) {
		throw new Error(`Domain Plugin ${field}s are invalid.`);
	}
	const normalized = values.map((value) => entrypoint(value, field));
	const unique = [...new Set(normalized)].sort();
	if (unique.length !== normalized.length) {
		throw new Error(`Domain Plugin ${field}s must be unique.`);
	}
	return Object.freeze(unique);
}

function normalizedContractRanges(
	value: DomainPluginContractRanges,
): DomainPluginContractRanges {
	if (!value || typeof value !== "object") {
		throw new Error("Domain Plugin contract ranges are invalid.");
	}
	const codewiki = text(value.codewiki, "CodeWiki contract range");
	const dsh = text(value.dsh, "DSH contract range");
	if (!CONTRACT_RANGE_PATTERN.test(codewiki) || !CONTRACT_RANGE_PATTERN.test(dsh)) {
		throw new Error("Domain Plugin contract range must be an exact qualified version.");
	}
	return Object.freeze({codewiki, dsh});
}

function normalizedDataLimits(value: DomainPluginDataLimits): DomainPluginDataLimits {
	if (!value || typeof value !== "object") {
		throw new Error("Domain Plugin data limits are invalid.");
	}
	const normalized = {
		maxKnowledgeBytes: positiveInteger(value.maxKnowledgeBytes, "maxKnowledgeBytes"),
		maxCandidateBytes: positiveInteger(value.maxCandidateBytes, "maxCandidateBytes"),
		maxContextBytes: positiveInteger(value.maxContextBytes, "maxContextBytes"),
	};
	return Object.freeze(normalized);
}

function positiveInteger(value: unknown, field: string): number {
	if (!Number.isSafeInteger(value) || (value as number) <= 0) {
		throw new Error(`Domain Plugin ${field} must be a positive safe integer.`);
	}
	return value as number;
}
