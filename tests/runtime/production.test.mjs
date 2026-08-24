import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync, realpathSync} from "node:fs";
import {resolve} from "node:path";
import {describe, it} from "node:test";

import {DEFAULT_DOMAIN_PLUGIN_IDENTITY} from "../../src/domains/defaults.ts";
import {executablePluginAdmissionClosureDigest} from "../../src/plugins/executable.ts";
import {
	RUN_PROTOCOL,
	createQualifiedRuntimeBuild,
	createRuntimeBuildManifest,
} from "../../src/runtime/contracts.ts";
import {DSH_MANAGED_EXECUTABLE_ADMISSIONS} from "../../src/runtime/dsh/managed-loader.ts";
import {readDshRuntimeProvenance} from "../../src/runtime/dsh/provenance.ts";
import {
	BACKEND_V1_SUPPORT_MATRIX,
	PRODUCTION_QUALIFICATION_GATE_NAMES,
	assertBackendV1SupportMatrix,
	assertRuntimeProductionQualification,
	createRuntimeProductionQualification,
} from "../../src/runtime/production.ts";
import {BUBBLEWRAP_SANDBOX_SCHEMA_VERSION} from "../../src/runtime/sandbox/bubblewrap.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	sha256Digest,
} from "../../src/utils/canonical-json.ts";

const packageLockPath = resolve(import.meta.dirname, "../../package-lock.json");
const provenance = readDshRuntimeProvenance(packageLockPath);
const sandbox = sandboxProfile();
const routes = Object.freeze([
	route("openai", "openai", "openai"),
	route("anthropic", "anthropic", "anthropic"),
	route("deepseek", "deepseek", "deepseek"),
	route("gateway", "qualification-gateway", "openai-compatible"),
]);
const gates = Object.freeze(Object.fromEntries(
	PRODUCTION_QUALIFICATION_GATE_NAMES.map((name) => [name, sha256Digest(`gate:${name}`)]),
));

describe("Backend v1 production qualification", () => {
	it("publishes one digest-bound platform, provider, and authentication matrix", () => {
		assert.equal(assertBackendV1SupportMatrix(), BACKEND_V1_SUPPORT_MATRIX);
		assert.deepEqual(BACKEND_V1_SUPPORT_MATRIX.productionPlatform, {
			operatingSystem: "linux",
			architecture: "x64",
			deploymentClass: "isolated-single-user",
			minimumNodeVersion: "22.19.0",
			exactRuntimeNodeIdentityRequired: true,
			containment: "bubblewrap+prlimit",
		});
		assert.deepEqual(
			BACKEND_V1_SUPPORT_MATRIX.providers.map(({id, family, authentication, status}) => ({
				id,
				family,
				authentication,
				status,
			})),
			[
				{id: "openai", family: "openai", authentication: "api-key", status: "supported"},
				{id: "anthropic", family: "anthropic", authentication: "api-key", status: "supported"},
				{id: "deepseek", family: "deepseek", authentication: "api-key", status: "supported"},
				{id: "custom-openai-compatible", family: "openai-compatible", authentication: "api-key", status: "supported"},
			],
		);
		assert.equal(
			BACKEND_V1_SUPPORT_MATRIX.unsupportedAuthentication.some(
				({authentication}) => authentication === "oauth",
			),
			true,
		);
		assert.match(BACKEND_V1_SUPPORT_MATRIX.matrixDigest, /^sha256:[a-f0-9]{64}$/);
	});

	it("binds exact host, sandbox, DSH, Plugin, provider, and gate identities", () => {
		const build = runtimeBuild();
		const qualification = createRuntimeProductionQualification({
			build,
			provenance,
			sandbox,
			routes,
			gates,
			qualifiedAt: "2026-08-24T14:00:00.000Z",
		});
		assert.equal(qualification.runtimeBuildDigest, build.buildDigest);
		assert.equal(qualification.runtimeBuildSchemaVersion, "4.0.0");
		assert.equal(qualification.host.node.digest, build.manifest.nodeExecutableDigest);
		assert.equal(qualification.sandbox.profileDigest, canonicalJsonDigest(sandbox));
		assert.equal(
			qualification.dsh.managedExecutablePluginClosureDigest,
			build.manifest.executablePluginClosureDigest,
		);
		assert.equal(qualification.providers.length, 4);
		assert.deepEqual(
			qualification.providers.map(({routeId}) => routeId),
			["anthropic-route", "deepseek-route", "gateway-route", "openai-route"],
		);
		assert.equal(qualification.dsh.packageSourceRelationship, "unattested");
		const {qualificationDigest, ...qualificationBody} = qualification;
		assert.equal(qualificationDigest, canonicalJsonDigest(qualificationBody));
		assertRuntimeProductionQualification(qualification);
		assert.throws(
			() => assertRuntimeProductionQualification({
				...qualification,
				host: {...qualification.host, architecture: "arm64"},
			}),
			/digest or protocol is invalid/,
		);
		assert.doesNotMatch(canonicalJson(qualification), /fixture-secret|Bearer\s/i);
	});

	it("fails closed on platform, Node, sandbox, DSH, Plugin, provider, and gate drift", () => {
		const common = {
			build: runtimeBuild(),
			provenance,
			sandbox,
			routes,
			gates,
			qualifiedAt: "2026-08-24T14:00:00.000Z",
		};
		assert.throws(
			() => createRuntimeProductionQualification({...common, operatingSystem: "darwin"}),
			/platform is unsupported/,
		);
		assert.throws(
			() => createRuntimeProductionQualification({
				...common,
				build: runtimeBuild({nodeExecutableDigest: sha256Digest("wrong-node")}),
			}),
			/Node identity does not match/,
		);
		assert.throws(
			() => createRuntimeProductionQualification({
				...common,
				build: runtimeBuild({outerSandboxProfileDigest: sha256Digest("wrong-sandbox")}),
			}),
			/outer sandbox does not match/,
		);
		assert.throws(
			() => createRuntimeProductionQualification({
				...common,
				provenance: {...provenance, dshPackageClosureDigest: sha256Digest("wrong-dsh")},
			}),
			/DSH provenance does not match/,
		);
		assert.throws(
			() => createRuntimeProductionQualification({
				...common,
				build: runtimeBuild({executablePluginClosureDigest: sha256Digest("wrong-plugin")}),
			}),
			/managed Plugin closure does not match/,
		);
		assert.throws(
			() => createRuntimeProductionQualification({
				...common,
				routes: [route("unsupported", "unknown", "openai")],
			}),
			/provider or family is unsupported/,
		);
		assert.throws(
			() => createRuntimeProductionQualification({
				...common,
				routes: [{...routes[0], apiKey: "must-not-enter-qualification"}],
			}),
			/provider route shape is invalid/,
		);
		assert.throws(
			() => createRuntimeProductionQualification({...common, gates: {...gates, secrets: undefined}}),
			/secrets evidence digest is invalid/,
		);
	});
});

function runtimeBuild(overrides = {}) {
	const nodeExecutablePath = realpathSync(process.execPath);
	return createQualifiedRuntimeBuild({
		manifest: createRuntimeBuildManifest({
			schemaVersion: "4.0.0",
			domainPlugin: DEFAULT_DOMAIN_PLUGIN_IDENTITY,
			runProtocolVersion: RUN_PROTOCOL.version,
			nodeVersion: process.versions.node,
			nodeExecutablePath,
			nodeExecutableDigest: sha256Digest(readFileSync(nodeExecutablePath)),
			outerSandboxProfileDigest: canonicalJsonDigest(sandbox),
			dshSourceCommit: provenance.reviewedSource.commit,
			dshPackageClosureDigest: provenance.dshPackageClosureDigest,
			cordisClosureDigest: provenance.cordisClosureDigest,
			executablePluginClosureDigest: executablePluginAdmissionClosureDigest(
				DSH_MANAGED_EXECUTABLE_ADMISSIONS,
			),
			runtimeArtifactDigest: sha256Digest("runtime-artifact"),
			...overrides,
		}),
		qualificationSuiteDigest: sha256Digest("runtime-suite"),
		qualificationEvidenceDigest: sha256Digest("runtime-evidence"),
		qualifiedAt: "2026-08-24T13:59:00.000Z",
	});
}

function sandboxProfile() {
	const bubblewrap = realpathSync("/usr/bin/bwrap");
	const prlimit = realpathSync("/usr/bin/prlimit");
	return Object.freeze({
		schemaVersion: BUBBLEWRAP_SANDBOX_SCHEMA_VERSION,
		bubblewrap: Object.freeze({
			path: bubblewrap,
			version: execFileSync(bubblewrap, ["--version"], {encoding: "utf8", env: {}}).trim(),
			digest: sha256Digest(readFileSync(bubblewrap)),
		}),
		prlimit: Object.freeze({
			path: prlimit,
			version: execFileSync(prlimit, ["--version"], {encoding: "utf8", env: {}}).split("\n", 1)[0].trim(),
			digest: sha256Digest(readFileSync(prlimit)),
		}),
		systemReadOnlyPaths: Object.freeze(["/usr", "/lib", "/lib64"]),
		limits: Object.freeze({
			addressSpaceBytes: 8 * 1024 * 1024 * 1024,
			cpuSeconds: 30,
			openFiles: 128,
			processes: 512,
			fileBytes: 1024 * 1024,
		}),
	});
}

function route(id, provider, family) {
	return Object.freeze({
		routeId: `${id}-route`,
		provider,
		family,
		accountId: `${id}-account`,
		credentialRef: `${id.toUpperCase()}_API_KEY`,
		model: `${id}-model`,
	});
}
