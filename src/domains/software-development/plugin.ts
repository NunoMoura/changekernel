import {
	createDomainPluginAdmission,
	createDomainRegistry,
	DEFAULT_DOMAIN_PLUGIN_ID,
	domainPluginIdentity,
	type DomainPluginAdmission,
} from "../contracts.ts";

export const SOFTWARE_DEVELOPMENT_PACKAGE_CLOSURE = Object.freeze([
	"package.json",
	"package-lock.json",
] as const);

export const SOFTWARE_DEVELOPMENT_DEPENDENCY_CLOSURE = Object.freeze([
	"package-lock.json",
] as const);

export const SOFTWARE_DEVELOPMENT_IMPLEMENTATION_CLOSURE = Object.freeze([
	"src/domains/project-server.ts",
	"src/domains/software-development/codewiki-kb-profile.ts",
	"src/domains/software-development/fact-classification.ts",
	"src/domains/software-development/okf-source-map.ts",
	"src/domains/software-development/source-map.ts",
	"src/domains/software-development/source-ownership.ts",
	"src/domains/software-development/system-diagrams.ts",
] as const);

export const SOFTWARE_DEVELOPMENT_QUALIFICATION_CLOSURE = Object.freeze([
	"tests/domains/binding.test.mjs",
	"tests/domains/contracts.test.mjs",
	"tests/domains/migration.test.mjs",
	"tests/domains/okf-source-map.test.mjs",
	"tests/domains/project-server.test.mjs",
] as const);

/**
 * Built-in Software Development Domain Plugin.
 *
 * Package, implementation, dependency, and qualification digests are release
 * evidence generated from the reviewed Backend source closure. They are never
 * derived from repository-selected executable paths at project open time.
 */
export const SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN: DomainPluginAdmission =
	createDomainPluginAdmission({
		pluginId: DEFAULT_DOMAIN_PLUGIN_ID,
		pluginVersion: "1.0.0",
		packageName: "@nunomoura/codewiki",
		packageIntegrity:
			"sha256:f004dc5077e7efcbff1dbadaa22c91cba38c67d46a2d526a4835eec5dae75a99",
		implementationDigest:
			"sha256:792182f2937a1fab796a620fe06144a5fbafc9e59a14c2a91b99594c3f106d34",
		entrypoints: {
			projectServer: "project-server",
			dshPlugins: [],
			clientPlugins: [],
		},
		dependencyClosureDigest:
			"sha256:a8a136bbb239fa3a98fc44d09fe425ddf259eca62dd6f355af88cb984967f02f",
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
			"sha256:a07d3eebff06be4381f8a91c90a85c10b1d43c125a2cb2d9ca34b760bd94c2ee",
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
