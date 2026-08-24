import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createDomainPluginAdmission,
	createDomainRegistry,
	DEFAULT_DOMAIN_PLUGIN_ID,
	DOMAIN_PLUGIN_ADMISSION_PROTOCOL,
} from "../../src/domains/contracts.ts";
import {
	BUILTIN_DOMAIN_PLUGIN_ADMISSIONS,
	SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
} from "../../src/domains/software-development/plugin.ts";

const baseInput = {
	pluginId: "codewiki.domain.software-development",
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
};

describe("Domain Plugin admission", () => {
	it("admits the built-in Software Development Domain Plugin deterministically", () => {
		const admission = createDomainPluginAdmission(baseInput);
		assert.deepEqual(admission.manifest.protocol, DOMAIN_PLUGIN_ADMISSION_PROTOCOL);
		assert.equal(admission.manifest.kind, "project-server-contribution");
		assert.equal(admission.manifest.pluginId, DEFAULT_DOMAIN_PLUGIN_ID);
		assert.match(admission.admissionDigest, /^sha256:[0-9a-f]{64}$/);
		assert.equal(
			admission.admissionDigest,
			SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN.admissionDigest,
		);
		const repeat = createDomainPluginAdmission(baseInput);
		assert.deepEqual(repeat, admission);
	});

	it("sorts contributions and rejects duplicates and unknown names", () => {
		const sorted = createDomainPluginAdmission({
			...baseInput,
			contributions: ["system-diagrams", "check-inputs"],
		});
		assert.deepEqual(sorted.manifest.contributions, [
			"check-inputs",
			"system-diagrams",
		]);
		assert.throws(
			() =>
				createDomainPluginAdmission({
					...baseInput,
					contributions: ["check-inputs", "check-inputs"],
				}),
			/must not contain duplicates/,
		);
		assert.throws(
			() =>
				createDomainPluginAdmission({
					...baseInput,
					contributions: ["workflow-engine"],
				}),
			/is unknown/,
		);
	});

	it("rejects malformed plugin identity, versions, and compiler IDs", () => {
		for (const pluginId of ["software-development", "codewiki.domain.", "codewiki.domain.Software"]) {
			assert.throws(
				() => createDomainPluginAdmission({ ...baseInput, pluginId }),
				/is invalid/,
			);
		}
		for (const pluginVersion of ["1", "1.0", "v1.0.0", "1.0.0-rc.1"]) {
			assert.throws(
				() => createDomainPluginAdmission({ ...baseInput, pluginVersion }),
				/is invalid/,
			);
		}
		assert.throws(
			() => createDomainPluginAdmission({ ...baseInput, compilerId: "  " }),
			/compilerId must be a nonempty string/,
		);
	});

	it("registers admitted plugins uniquely and fails closed on unknown selection", () => {
		const registry = createDomainRegistry(BUILTIN_DOMAIN_PLUGIN_ADMISSIONS);
		const resolved = registry.requireDomainPlugin(DEFAULT_DOMAIN_PLUGIN_ID);
		assert.equal(resolved, SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN);
		assert.throws(
			() => registry.requireDomainPlugin("codewiki.domain.infrastructure-as-code"),
			/is not admitted/,
		);
		assert.throws(
			() =>
				createDomainRegistry([
					SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
					SOFTWARE_DEVELOPMENT_DOMAIN_PLUGIN,
				]),
			/admitted more than once/,
		);
	});

	it("keeps the builtin registry to exactly one shipped plugin", () => {
		assert.equal(BUILTIN_DOMAIN_PLUGIN_ADMISSIONS.length, 1);
	});
});
