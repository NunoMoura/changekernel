import {
	createDomainPluginAdmission,
	createDomainRegistry,
	DEFAULT_DOMAIN_PLUGIN_ID,
	domainCompilerIdentity,
	type DomainPluginAdmission,
} from "../contracts.ts";

/**
 * Built-in Software Development Domain Plugin.
 *
 * Supplies the Product/System/Design knowledge vocabulary, source and test
 * realization, Git integration, software Checks inputs, system diagrams, fact
 * classification, and guarded delivery bindings. The governance kernel keeps
 * every Stage Loop, authority boundary, and effect application fixed; this
 * plugin only contributes bounded domain meaning.
 */
export const SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN: DomainPluginAdmission =
	createDomainPluginAdmission({
		pluginId: DEFAULT_DOMAIN_PLUGIN_ID,
		pluginVersion: "1.0.0",
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

export const BUILTIN_DOMAIN_PLUGIN_ADMISSIONS: readonly DomainPluginAdmission[] =
	Object.freeze([SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN]);

export const DEFAULT_DOMAIN_REGISTRY = createDomainRegistry(
	BUILTIN_DOMAIN_PLUGIN_ADMISSIONS,
);

/**
 * The exact Knowledge compiler identity bound to the built-in Software
 * Development Domain Plugin. Equal to the historical kernel default, proving
 * existing checkpoints are already bound to the built-in admission.
 */
export const SOFTWARE_DEVELOPMENT_COMPILER_IDENTITY = domainCompilerIdentity(
	SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
);
