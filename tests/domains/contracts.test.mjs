import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import { describe, it } from "node:test";
import {
	assertDomainPluginAdmission,
	createDomainPluginAdmission,
	createDomainRegistry,
	DEFAULT_DOMAIN_PLUGIN_ID,
	DOMAIN_PLUGIN_ADMISSION_PROTOCOL,
	domainPluginIdentity,
	resolveDomainPluginSelection,
} from "../../src/domains/contracts.ts";
import {
	BUILTIN_DOMAIN_PLUGIN_ADMISSIONS,
	SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
	SOFTWARE_DEVELOPMENT_DEPENDENCY_CLOSURE,
	SOFTWARE_DEVELOPMENT_IMPLEMENTATION_CLOSURE,
	SOFTWARE_DEVELOPMENT_PACKAGE_CLOSURE,
	SOFTWARE_DEVELOPMENT_QUALIFICATION_CLOSURE,
} from "../../src/domains/software-development/plugin.ts";

function inputFrom(admission) {
	const manifest = admission.manifest;
	return {
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
	};
}

const baseInput = inputFrom(SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN);

async function closureDigest(paths) {
	const hash = createHash("sha256");
	for (const path of paths) {
		hash.update(path);
		hash.update("\0");
		hash.update(await readFile(path));
		hash.update("\0");
	}
	return `sha256:${hash.digest("hex")}`;
}

describe("Domain Plugin admission", () => {
	it("admits exact qualified Software Development package and implementation evidence", () => {
		const admission = createDomainPluginAdmission(baseInput);
		assert.equal(admission.manifest.protocol.id, DOMAIN_PLUGIN_ADMISSION_PROTOCOL.id);
		assert.equal(admission.manifest.protocol.version, DOMAIN_PLUGIN_ADMISSION_PROTOCOL.version);
		assert.equal(admission.manifest.kind, "project-server-contribution");
		assert.equal(admission.manifest.pluginId, DEFAULT_DOMAIN_PLUGIN_ID);
		assert.match(admission.manifest.packageIntegrity, /^sha256:[0-9a-f]{64}$/);
		assert.match(admission.manifest.implementationDigest, /^sha256:[0-9a-f]{64}$/);
		assert.match(admission.admissionDigest, /^sha256:[0-9a-f]{64}$/);
		assert.deepEqual(admission, SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN);
		assert.deepEqual(createDomainPluginAdmission(baseInput), admission);
		assert.equal(Object.isFrozen(admission), true);
		assert.equal(Object.isFrozen(admission.manifest), true);
		assert.equal(Object.isFrozen(admission.manifest.contributions), true);
		assert.equal(Object.isFrozen(admission.manifest.entrypoints), true);
	});

	it("binds exact package, implementation, and qualification source closures", async () => {
		assert.equal(
			await closureDigest(SOFTWARE_DEVELOPMENT_PACKAGE_CLOSURE),
			SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN.manifest.packageIntegrity,
		);
		assert.equal(
			await closureDigest(SOFTWARE_DEVELOPMENT_DEPENDENCY_CLOSURE),
			SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN.manifest.dependencyClosureDigest,
		);
		assert.equal(
			await closureDigest(SOFTWARE_DEVELOPMENT_IMPLEMENTATION_CLOSURE),
			SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN.manifest.implementationDigest,
		);
		assert.equal(
			await closureDigest(SOFTWARE_DEVELOPMENT_QUALIFICATION_CLOSURE),
			SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN.manifest.qualificationEvidenceDigest,
		);
	});

	it("sorts contributions and rejects duplicates and unknown names", () => {
		const sorted = createDomainPluginAdmission({
			...baseInput,
			contributions: ["system-diagrams", "check-inputs"],
		});
		assert.deepEqual(sorted.manifest.contributions, ["check-inputs", "system-diagrams"]);
		assert.throws(
			() => createDomainPluginAdmission({...baseInput, contributions: ["check-inputs", "check-inputs"]}),
			/must not contain duplicates/,
		);
		assert.throws(
			() => createDomainPluginAdmission({...baseInput, contributions: ["workflow-engine"]}),
			/is unknown/,
		);
	});

	it("rejects malformed plugin, package, version, compiler, and qualification fields", () => {
		for (const pluginId of ["software-development", "codewiki.domain.", "codewiki.domain.Software"]) {
			assert.throws(() => createDomainPluginAdmission({...baseInput, pluginId}), /is invalid/);
		}
		for (const pluginVersion of ["1", "1.0", "v1.0.0", "1.0.0-rc.1"]) {
			assert.throws(() => createDomainPluginAdmission({...baseInput, pluginVersion}), /is invalid/);
		}
		assert.throws(
			() => createDomainPluginAdmission({...baseInput, compilerId: "  "}),
			/compilerId must be a nonempty string/,
		);
		assert.throws(
			() => createDomainPluginAdmission({...baseInput, packageIntegrity: "sha256:bad"}),
			/package integrity/,
		);
	});

	it("revalidates canonical admission bytes and rejects forged manifests", () => {
		const forged = structuredClone(SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN);
		forged.manifest.compilerId = "codewiki.project-server.forged";
		assert.throws(() => assertDomainPluginAdmission(forged), /digest or manifest is invalid/);
		assert.throws(() => createDomainRegistry([forged]), /digest or manifest is invalid/);
	});

	it("registers exact admissions uniquely and resolves only an exact selection", () => {
		const registry = createDomainRegistry(BUILTIN_DOMAIN_PLUGIN_ADMISSIONS);
		const resolved = registry.requireDomainPlugin(DEFAULT_DOMAIN_PLUGIN_ID);
		assert.deepEqual(resolved, SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN);
		assert.throws(
			() => registry.requireDomainPlugin("codewiki.domain.infrastructure-as-code"),
			/is not admitted/,
		);
		assert.throws(
			() => createDomainRegistry([SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN, SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN]),
			/admitted more than once/,
		);
		const identity = domainPluginIdentity(resolved);
		assert.deepEqual(
			resolveDomainPluginSelection(
				{
					pluginId: identity.pluginId,
					pluginVersion: identity.pluginVersion,
					admissionDigest: identity.admissionDigest,
				},
				registry,
			),
			resolved,
		);
		assert.throws(
			() => resolveDomainPluginSelection({...identity, pluginVersion: "2.0.0"}, registry),
			/version is not admitted/,
		);
		assert.throws(
			() => resolveDomainPluginSelection({...identity, admissionDigest: "sha256:" + "0".repeat(64)}, registry),
			/admission digest is not admitted/,
		);
	});

	it("keeps builtin registry to exactly one shipped plugin", () => {
		assert.equal(BUILTIN_DOMAIN_PLUGIN_ADMISSIONS.length, 1);
	});
});
