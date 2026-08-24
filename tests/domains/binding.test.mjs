import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createKnowledgeCheckpoint,
	createKnowledgeCompilerIdentity,
	DEFAULT_KNOWLEDGE_COMPILER,
} from "../../src/knowledge/state.ts";
import {configFileToPartialWikiConfig} from "../../src/project/config-file.ts";
import {resolveWikiConfig} from "../../src/project/config.ts";
import {
	assertCheckpointBoundToDomain,
	domainCompilerIdentity,
	SOFTWARE_DEVELOPMENT_COMPILER_IDENTITY,
} from "../../src/domains/binding.ts";
import {
	createDomainPluginAdmission,
	createDomainRegistry,
	DEFAULT_DOMAIN_PLUGIN_ID,
	domainPluginIdentity,
	resolveDomainPluginSelection,
} from "../../src/domains/contracts.ts";
import {
	BUILTIN_DOMAIN_PLUGIN_ADMISSIONS,
	DEFAULT_DOMAIN_REGISTRY,
	SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
} from "../../src/domains/software-development/plugin.ts";

function checkpoint() {
	return createKnowledgeCheckpoint({files: []});
}

function foreignAdmission(overrides = {}) {
	const source = SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN.manifest;
	return createDomainPluginAdmission({
		pluginId: "codewiki.domain.infrastructure-as-code",
		pluginVersion: source.pluginVersion,
		packageName: "@example/infrastructure-domain",
		packageIntegrity: source.packageIntegrity,
		implementationDigest: source.implementationDigest,
		entrypoints: source.entrypoints,
		dependencyClosureDigest: source.dependencyClosureDigest,
		contractRanges: source.contractRanges,
		dataLimits: source.dataLimits,
		qualificationEvidenceDigest: source.qualificationEvidenceDigest,
		contributions: ["knowledge-vocabulary"],
		compilerId: source.compilerId,
		...overrides,
	});
}

describe("Domain Plugin identity binding", () => {
	it("binds built-in compiler to exact admission identity", () => {
		assert.deepEqual(SOFTWARE_DEVELOPMENT_COMPILER_IDENTITY, DEFAULT_KNOWLEDGE_COMPILER);
		assert.deepEqual(
			SOFTWARE_DEVELOPMENT_COMPILER_IDENTITY.domainPlugin,
			domainPluginIdentity(SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN),
		);
	});

	it("accepts only checkpoints compiled by exact admitted Domain Plugin", () => {
		assertCheckpointBoundToDomain(checkpoint(), SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN);
		const foreign = foreignAdmission();
		assert.equal(
			foreign.manifest.compilerId,
			SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN.manifest.compilerId,
		);
		assert.notEqual(
			domainCompilerIdentity(foreign).digest,
			SOFTWARE_DEVELOPMENT_COMPILER_IDENTITY.digest,
		);
		assert.throws(
			() => assertCheckpointBoundToDomain(checkpoint(), foreign),
			/does not match admitted Domain Plugin/,
		);
	});

	it("fails closed on compiler drift even under same admission", () => {
		const drifted = createKnowledgeCheckpoint({
			files: [],
			compiler: createKnowledgeCompilerIdentity({
				compilerId: DEFAULT_KNOWLEDGE_COMPILER.compilerId,
				compilerVersion: "9.9.9",
				domainPlugin: DEFAULT_KNOWLEDGE_COMPILER.domainPlugin,
				markdownRenderer: DEFAULT_KNOWLEDGE_COMPILER.markdownRenderer,
				yamlRenderer: DEFAULT_KNOWLEDGE_COMPILER.yamlRenderer,
			}),
		});
		assert.throws(
			() => assertCheckpointBoundToDomain(drifted, SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN),
			/compiler .* does not match admitted Domain Plugin/,
		);
	});

	it("preserves exact persisted selection and fails closed during real config resolution", () => {
		const identity = domainPluginIdentity(SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN);
		const partial = configFileToPartialWikiConfig({
			domain: {
				pluginId: identity.pluginId,
				pluginVersion: identity.pluginVersion,
				admissionDigest: identity.admissionDigest,
			},
		});
		assert.deepEqual(resolveWikiConfig(partial).domain, {
			pluginId: identity.pluginId,
			pluginVersion: identity.pluginVersion,
			admissionDigest: identity.admissionDigest,
		});
		assert.throws(
			() => resolveWikiConfig({domain: {pluginId: "codewiki.domain.not-admitted"}}),
			/Domain Plugin codewiki\.domain\.not-admitted is not admitted/,
		);
		assert.throws(
			() => resolveWikiConfig({domain: {
				pluginId: identity.pluginId,
				admissionDigest: "sha256:" + "0".repeat(64),
			}}),
			/admission digest is not admitted/,
		);
	});

	it("resolves release default and exact persisted selection, rejecting unknown IDs", () => {
		assert.deepEqual(
			resolveDomainPluginSelection(undefined, DEFAULT_DOMAIN_REGISTRY),
			SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
		);
		assert.deepEqual(
			resolveDomainPluginSelection({pluginId: null}, DEFAULT_DOMAIN_REGISTRY),
			SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
		);
		const identity = domainPluginIdentity(SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN);
		assert.deepEqual(
			resolveDomainPluginSelection(
				{
					pluginId: DEFAULT_DOMAIN_PLUGIN_ID,
					pluginVersion: identity.pluginVersion,
					admissionDigest: identity.admissionDigest,
				},
				DEFAULT_DOMAIN_REGISTRY,
			),
			SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
		);
		assert.throws(
			() => resolveDomainPluginSelection({pluginId: "codewiki.domain.unknown"}, DEFAULT_DOMAIN_REGISTRY),
			/is not admitted/,
		);
		assert.throws(
			() => resolveDomainPluginSelection(undefined, createDomainRegistry([])),
			/is not admitted/,
		);
		assert.equal(BUILTIN_DOMAIN_PLUGIN_ADMISSIONS.length, 1);
	});
});
