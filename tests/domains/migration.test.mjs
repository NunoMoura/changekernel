import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
	createDomainPluginAdmission,
	domainPluginIdentity,
} from "../../src/domains/contracts.ts";
import {
	assertCheckpointBoundToDomain,
} from "../../src/domains/binding.ts";
import {
	assertDomainPluginUpgradeQuiescent,
	createDomainPluginMigration,
	migrateLegacyKnowledgeCheckpointToDomain,
} from "../../src/domains/migration.ts";
import {SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN} from "../../src/domains/software-development/plugin.ts";
import {createKnowledgeCheckpoint} from "../../src/knowledge/state.ts";
import {canonicalJsonDigest} from "../../src/utils/canonical-json.ts";

function upgradedAdmission() {
	const source = SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN.manifest;
	return createDomainPluginAdmission({
		pluginId: source.pluginId,
		pluginVersion: "1.1.0",
		packageName: source.packageName,
		packageIntegrity: "sha256:" + "1".repeat(64),
		implementationDigest: "sha256:" + "2".repeat(64),
		entrypoints: source.entrypoints,
		dependencyClosureDigest: source.dependencyClosureDigest,
		contractRanges: source.contractRanges,
		dataLimits: source.dataLimits,
		qualificationEvidenceDigest: "sha256:" + "3".repeat(64),
		contributions: source.contributions,
		compilerId: source.compilerId,
	});
}

describe("Domain Plugin migration", () => {
	it("deterministically recomputes under exact old/new identities without changing accepted semantics", () => {
		const sourceCheckpoint = createKnowledgeCheckpoint({
			files: [{
				path: "concept.md",
				mediaType: "text/markdown",
				bytes: "---\ncodewiki_id: cw:component:concept\ntype: System Component\ntitle: Concept\nstatus: stable\n---\n# Concept\n",
			}],
		});
		const targetAdmission = upgradedAdmission();
		const first = createDomainPluginMigration({
			sourceAdmission: SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
			targetAdmission,
			sourceCheckpoint,
		});
		const second = createDomainPluginMigration({
			sourceAdmission: SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
			targetAdmission,
			sourceCheckpoint,
		});
		assert.deepEqual(second, first);
		assert.equal(first.semanticStatePreserved, true);
		assert.equal(first.targetCheckpoint.state.stateDigest, sourceCheckpoint.state.stateDigest);
		assert.notEqual(first.targetCheckpoint.checkpointDigest, sourceCheckpoint.checkpointDigest);
		assertCheckpointBoundToDomain(first.targetCheckpoint, targetAdmission);
	});

	it("explicitly migrates historical unbound checkpoint protocol bytes", () => {
		const current = createKnowledgeCheckpoint({files: []});
		const compilerBody = {
			protocol: {id: "codewiki.knowledge-compiler", version: "1.0.0"},
			compilerId: current.projection.compiler.compilerId,
			compilerVersion: current.projection.compiler.compilerVersion,
			markdownRenderer: current.projection.compiler.markdownRenderer,
			yamlRenderer: current.projection.compiler.yamlRenderer,
		};
		const compiler = {...compilerBody, digest: canonicalJsonDigest(compilerBody)};
		const projectionBody = {
			protocol: {id: "codewiki.knowledge-projection", version: "1.0.0"},
			compiler,
			files: current.projection.files,
		};
		const projection = {
			...projectionBody,
			projectionDigest: canonicalJsonDigest(projectionBody),
		};
		const checkpointBody = {
			protocol: {id: "codewiki.knowledge-checkpoint", version: "1.0.0"},
			state: current.state,
			projection,
		};
		const legacyCheckpoint = {
			...checkpointBody,
			checkpointDigest: canonicalJsonDigest(checkpointBody),
		};
		const migration = migrateLegacyKnowledgeCheckpointToDomain({
			legacyCheckpoint,
			admission: SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
		});
		assert.equal(migration.targetCheckpoint.protocol.version, "2.0.0");
		assert.equal(migration.targetCheckpoint.state.stateDigest, current.state.stateDigest);
		assertCheckpointBoundToDomain(
			migration.targetCheckpoint,
			SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
		);
		assert.throws(
			() => migrateLegacyKnowledgeCheckpointToDomain({
				legacyCheckpoint: {
					...legacyCheckpoint,
					checkpointDigest: "sha256:" + "0".repeat(64),
				},
				admission: SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
			}),
			/Legacy Knowledge checkpoint digest is invalid/,
		);
	});

	it("rejects cross-domain changes, no-op migrations, and active hot swaps", () => {
		const sourceCheckpoint = createKnowledgeCheckpoint({files: []});
		assert.throws(
			() => createDomainPluginMigration({
				sourceAdmission: SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
				targetAdmission: SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
				sourceCheckpoint,
			}),
			/requires different source and target/,
		);
		const sourceIdentity = domainPluginIdentity(SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN);
		const active = [{kind: "candidate", id: "candidate:decision:active", domainPlugin: sourceIdentity}];
		assert.throws(
			() => assertDomainPluginUpgradeQuiescent(sourceIdentity, active),
			/cannot hot-swap active candidate/,
		);
		assert.throws(
			() => createDomainPluginMigration({
				sourceAdmission: SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
				targetAdmission: upgradedAdmission(),
				sourceCheckpoint,
				activeArtifacts: active,
			}),
			/cannot hot-swap active candidate/,
		);
	});
});
