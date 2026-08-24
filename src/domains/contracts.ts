import {
	canonicalJsonDigest,
	type Sha256Digest,
} from "../utils/canonical-json.ts";

export const DOMAIN_PLUGIN_ADMISSION_PROTOCOL = Object.freeze({
	id: "codewiki.domain-plugin-admission",
	version: "1.0.0",
});

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

export interface DomainPluginManifest {
	readonly protocol: typeof DOMAIN_PLUGIN_ADMISSION_PROTOCOL;
	readonly pluginId: string;
	readonly pluginVersion: string;
	readonly kind: "project-server-contribution";
	readonly contributions: readonly DomainPluginContributionName[];
	readonly compilerId: string;
}

export interface DomainPluginAdmission {
	readonly manifest: DomainPluginManifest;
	readonly admissionDigest: Sha256Digest;
}

const PLUGIN_ID_PATTERN = /^codewiki\.domain\.[a-z][a-z0-9-]*$/;
const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;

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

export function createDomainPluginAdmission(input: {
	readonly pluginId: string;
	readonly pluginVersion: string;
	readonly contributions: readonly DomainPluginContributionName[];
	readonly compilerId: string;
}): DomainPluginAdmission {
	const manifest: DomainPluginManifest = {
		protocol: DOMAIN_PLUGIN_ADMISSION_PROTOCOL,
		pluginId: text(input.pluginId, "pluginId"),
		pluginVersion: version(input.pluginVersion),
		kind: "project-server-contribution",
		contributions: contributions(input.contributions),
		compilerId: text(input.compilerId, "compilerId"),
	};
	if (!PLUGIN_ID_PATTERN.test(manifest.pluginId)) {
		throw new Error(`Domain Plugin ID ${manifest.pluginId} is invalid.`);
	}
	if (!manifest.compilerId.trim()) {
		throw new Error("Domain Plugin compiler ID is required.");
	}
	return Object.freeze({
		manifest,
		admissionDigest: canonicalJsonDigest(manifest),
	});
}

export interface DomainRegistry {
	readonly admissions: readonly DomainPluginAdmission[];
	requireDomainPlugin(pluginId: string): DomainPluginAdmission;
}

export const DEFAULT_DOMAIN_PLUGIN_ID = "codewiki.domain.software-development";

export function createDomainRegistry(
	admissions: readonly DomainPluginAdmission[],
): DomainRegistry {
	const byId = new Map<string, DomainPluginAdmission>();
	for (const admission of admissions) {
		const pluginId = admission.manifest.pluginId;
		if (!PLUGIN_ID_PATTERN.test(pluginId)) {
			throw new Error(`Domain Plugin ID ${pluginId} is invalid.`);
		}
		if (byId.has(pluginId)) {
			throw new Error(`Domain Plugin ${pluginId} is admitted more than once.`);
		}
		byId.set(pluginId, admission);
	}
	return Object.freeze({
		admissions: [...admissions],
		requireDomainPlugin(pluginId: string): DomainPluginAdmission {
			const admission = byId.get(text(pluginId, "pluginId"));
			if (!admission) {
				throw new Error(`Domain Plugin ${pluginId} is not admitted.`);
			}
			return admission;
		},
	});
}

function text(value: unknown, field: string): string {
	if (typeof value !== "string" || !value.trim()) {
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
	for (const value of values) {
		if (!CONTRIBUTION_NAMES.has(value)) {
			throw new Error(`Domain Plugin contribution ${value} is unknown.`);
		}
	}
	const sorted = [...new Set(values)].sort();
	if (sorted.length !== values.length) {
		throw new Error("Domain Plugin contributions must not contain duplicates.");
	}
	return sorted;
}
