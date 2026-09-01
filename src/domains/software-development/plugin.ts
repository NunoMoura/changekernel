import {
	createDomainPluginAdmission,
	createDomainRegistry,
	DEFAULT_DOMAIN_PLUGIN_ID,
	domainPluginIdentity,
	type DomainPluginAdmission,
} from "../contracts.ts";

export const SOFTWARE_DEVELOPMENT_HISTORICAL_PACKAGE_INTEGRITY =
	"sha256:eef6485ec6281748c3ebd7f0996b93ae8037398ccc5416c28d08ba8cb1902c9b";
export const SOFTWARE_DEVELOPMENT_HISTORICAL_IDENTITY_DIGEST =
	"sha256:cc738b2d48488a8d659a3b7cfebcf3890b613c42993220320eb22bd087292fc9";

/**
 * Built-in Software Development Domain Plugin.
 *
 * Package, implementation, dependency, and qualification digests retain the
 * exact Backend-v1 admission. They are historical identity, not claims about
 * current target source bytes, and must never be regenerated from the evolving
 * target package or project paths.
 */
export const SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN: DomainPluginAdmission =
	createDomainPluginAdmission({
		pluginId: DEFAULT_DOMAIN_PLUGIN_ID,
		pluginVersion: "1.0.0",
		packageName: "@nunomoura/codewiki",
		packageIntegrity: SOFTWARE_DEVELOPMENT_HISTORICAL_PACKAGE_INTEGRITY,
		implementationDigest:
			"sha256:c766534a756bad1cff6f2279d664803362168efae9a0cce0918aee6782393ed9",
		entrypoints: {
			projectServer: "project-server",
			dshPlugins: [],
			clientPlugins: [],
		},
		dependencyClosureDigest:
			"sha256:cb11c10ca402eafaecf610f45bee67fa027652c9054af8177f12483324ec6a3d",
		contractRanges: {
			codewiki: "1.0.0",
			dsh: "0.1.1-rc.2",
		},
		dataLimits: {
			maxKnowledgeBytes: 8 * 1024 * 1024,
			maxCandidateBytes: 16 * 1024 * 1024,
			maxContextBytes: 16 * 1024 * 1024,
		},
		qualificationEvidenceDigest:
			"sha256:a02e9765f91380f3b581ecdde0975777c22c42dd081f16d5bcee49341f24e4c5",
		contributions: [
			"check-inputs",
			"context-compilation",
			"delivery-bindings",
			"fact-classification",
			"git-integration",
			"knowledge-relationships",
			"knowledge-vocabulary",
			"source-realization",
			"system-diagrams",
		],
		compilerId: "codewiki.project-server.knowledge",
	});

export const SOFTWARE_DEVELOPMENT_DOMAIN_IDENTITY = domainPluginIdentity(
	SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
);

export const BUILTIN_DOMAIN_PLUGIN_ADMISSIONS: readonly DomainPluginAdmission[] =
	Object.freeze([SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN]);

export const DEFAULT_DOMAIN_REGISTRY = createDomainRegistry(
	BUILTIN_DOMAIN_PLUGIN_ADMISSIONS,
);
