import {
	createDomainPluginAdmission,
	DEFAULT_DOMAIN_PLUGIN_ID,
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
