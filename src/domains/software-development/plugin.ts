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
	"src/checks/packs/transport.ts",
	"check-packs/decision/software-development-default/active_change_compatibility/CHECK.md",
	"check-packs/decision/software-development-default/active_change_compatibility/check.json",
	"check-packs/implementation/software-development-default/work_unit_realization/CHECK.md",
	"check-packs/implementation/software-development-default/work_unit_realization/check.json",
	"check-packs/planning/software-development-default/obligation_coverage/CHECK.md",
	"check-packs/planning/software-development-default/obligation_coverage/check.json",
	"check-packs/review/software-development-default/aggregate_acceptance/CHECK.md",
	"check-packs/review/software-development-default/aggregate_acceptance/check.json",
	"check-packs/review/software-development-default/cross_unit_behavior/CHECK.md",
	"check-packs/review/software-development-default/cross_unit_behavior/check.json",
	"check-packs/review/software-development-default/full_build/CHECK.md",
	"check-packs/review/software-development-default/full_build/check.json",
	"check-packs/review/software-development-default/integration_behavior/CHECK.md",
	"check-packs/review/software-development-default/integration_behavior/check.json",
	"check-packs/review/software-development-default/provenance_integrity/CHECK.md",
	"check-packs/review/software-development-default/provenance_integrity/check.json",
	"check-packs/review/software-development-default/scope_discipline/CHECK.md",
	"check-packs/review/software-development-default/scope_discipline/check.json",
	"src/domains/project-server.ts",
	"src/domains/software-development/check-packs.ts",
	"src/domains/software-development/codewiki-kb-profile.ts",
	"src/domains/software-development/fact-classification.ts",
	"src/domains/software-development/okf-source-map.ts",
	"src/domains/software-development/source-map.ts",
	"src/domains/software-development/source-ownership.ts",
	"src/domains/software-development/system-diagrams.ts",
] as const);

export const SOFTWARE_DEVELOPMENT_QUALIFICATION_CLOSURE = Object.freeze([
	"tests/checks/pack-transport.test.mjs",
	"tests/domains/binding.test.mjs",
	"tests/domains/check-packs.test.mjs",
	"tests/domains/contracts.test.mjs",
	"tests/domains/migration.test.mjs",
	"tests/domains/okf-source-map.test.mjs",
	"tests/domains/project-server.test.mjs",
	"tests/project/bootstrap.test.mjs",
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
			"sha256:d3028162054b3db6877321eabc217dd9616c183488fdc8ad63507930529c14e1",
		implementationDigest:
			"sha256:234afde48452a9d3eaeb965ca2bfee646001c3b3e05960b962d7986a62ef9b7d",
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
			"sha256:29d085a3e414768da874d7ec86492d2e479d219702bf2ccc3c72e1761fb70ae6",
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
