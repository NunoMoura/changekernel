import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createKnowledgeCheckpoint,
	createKnowledgeCompilerIdentity,
	DEFAULT_KNOWLEDGE_COMPILER,
} from "../../src/knowledge/state.ts";
import {
	assertCheckpointBoundToDomain,
	createDomainPluginAdmission,
	createDomainRegistry,
	DEFAULT_DOMAIN_PLUGIN_ID,
	resolveDomainPluginSelection,
} from "../../src/domains/contracts.ts";
import {
	BUILTIN_DOMAIN_PLUGIN_ADMISSIONS,
	DEFAULT_DOMAIN_REGISTRY,
	SOFTWARE_DEVELOPMENT_COMPILER_IDENTITY,
	SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
} from "../../src/domains/software-development/plugin.ts";

function checkpoint() {
	return createKnowledgeCheckpoint({files: []});
}

describe("Domain Plugin identity binding", () => {
	it("binds the built-in plugin to the historical kernel compiler identity", () => {
		assert.deepEqual(
			SOFTWARE_DEVELOPMENT_COMPILER_IDENTITY,
			DEFAULT_KNOWLEDGE_COMPILER,
		);
		assert.equal(
			SOFTWARE_DEVELOPMENT_COMPILER_IDENTITY.compilerId,
			SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN.manifest.compilerId,
		);
		assert.equal(
			SOFTWARE_DEVELOPMENT_COMPILER_IDENTITY.compilerVersion,
			SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN.manifest.pluginVersion,
		);
	});

	it("accepts checkpoints compiled by the admitted Domain Plugin", () => {
		assertCheckpointBoundToDomain(checkpoint(), SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN);
	});

	it("fails closed on checkpoints compiled by another domain", () => {
		const foreign = createDomainPluginAdmission({
			pluginId: "codewiki.domain.infrastructure-as-code",
			pluginVersion: "1.0.0",
			contributions: ["knowledge-vocabulary"],
			compilerId: "codewiki.domain.infrastructure-as-code.knowledge",
		});
		assert.throws(
			() => assertCheckpointBoundToDomain(checkpoint(), foreign),
			/compilerId codewiki\.project-server\.knowledge does not match admitted Domain Plugin codewiki\.domain\.infrastructure-as-code/,
		);
		const drifted = createKnowledgeCheckpoint({
			files: [],
			compiler: createKnowledgeCompilerIdentity({
				compilerId: DEFAULT_KNOWLEDGE_COMPILER.compilerId,
				compilerVersion: "9.9.9",
				markdownRenderer: DEFAULT_KNOWLEDGE_COMPILER.markdownRenderer,
				yamlRenderer: DEFAULT_KNOWLEDGE_COMPILER.yamlRenderer,
			}),
		});
		assert.throws(
			() => assertCheckpointBoundToDomain(drifted, SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN),
			/compilerVersion 9\.9\.9 does not match/,
		);
	});

	it("resolves null project selection to the built-in plugin and rejects unadmitted IDs", () => {
		assert.equal(
			resolveDomainPluginSelection(undefined, DEFAULT_DOMAIN_REGISTRY),
			SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
		);
		assert.equal(
			resolveDomainPluginSelection({pluginId: null}, DEFAULT_DOMAIN_REGISTRY),
			SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
		);
		assert.equal(
			resolveDomainPluginSelection(
				{pluginId: DEFAULT_DOMAIN_PLUGIN_ID},
				DEFAULT_DOMAIN_REGISTRY,
			),
			SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
		);
		assert.throws(
			() =>
				resolveDomainPluginSelection(
					{pluginId: "codewiki.domain.unknown"},
					DEFAULT_DOMAIN_REGISTRY,
				),
				/Domain Plugin codewiki\.domain\.unknown is not admitted/,
		);
		const emptyRegistry = createDomainRegistry([]);
		assert.throws(
			() => resolveDomainPluginSelection(undefined, emptyRegistry),
			/is not admitted/,
		);
		assert.equal(BUILTIN_DOMAIN_PLUGIN_ADMISSIONS.length, 1);
	});
});
