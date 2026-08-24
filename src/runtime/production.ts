import {readFileSync, realpathSync, statSync} from "node:fs";

import {
	executablePluginAdmissionClosureDigest,
	type ExecutablePluginAdmission,
} from "../plugins/executable.ts";
import {
	canonicalJsonDigest,
	sha256Digest,
} from "../utils/canonical-json.ts";
import {
	RUNTIME_BUILD_SCHEMA_VERSION,
	assertQualifiedRuntimeBuild,
	type QualifiedRuntimeBuild,
} from "./contracts.ts";
import {
	DSH_BROKER_HOST_EXECUTABLE_ADMISSIONS,
} from "./dsh/broker-plugins.ts";
import {
	DSH_MANAGED_EXECUTABLE_ADMISSIONS,
} from "./dsh/managed-loader.ts";
import type {DshBrokerHostRoute} from "./dsh/provider-host.ts";
import type {DshRuntimeProvenance} from "./dsh/provenance.ts";
import {
	verifyBubblewrapSandboxProfile,
	type BubblewrapSandboxProfile,
	type SandboxExecutableIdentity,
} from "./sandbox/bubblewrap.ts";
import {
	BACKEND_V1_SUPPORT_MATRIX,
	RUNTIME_PRODUCTION_QUALIFICATION_PROTOCOL,
	assertBackendV1SupportMatrix,
	type RuntimeProductionQualification,
	type RuntimeProductionQualificationGateEvidence,
	type SupportedDshProviderFamily,
} from "../protocol/backend-production.ts";

export {
	BACKEND_SUPPORT_MATRIX_PROTOCOL,
	BACKEND_V1_SUPPORT_MATRIX,
	RUNTIME_PRODUCTION_QUALIFICATION_PROTOCOL,
	assertBackendV1SupportMatrix,
	assertRuntimeProductionQualification,
	type BackendProviderSupport,
	type BackendSupportMatrix,
	type ProductionExecutableIdentity,
	type RuntimeOperationsInspectionPort,
	type RuntimeProductionQualification,
	type RuntimeProductionQualificationGateEvidence,
	type SupportedDshProviderFamily,
} from "../protocol/backend-production.ts";

export const PRODUCTION_QUALIFICATION_GATE_NAMES = Object.freeze([
	"faultRecovery",
	"threatModel",
	"dependencies",
	"secrets",
	"vulnerabilities",
	"package",
	"performance",
	"adversarial",
] as const);

export type ProductionQualificationGateName =
	(typeof PRODUCTION_QUALIFICATION_GATE_NAMES)[number];

export function createRuntimeProductionQualification(input: {
	readonly build: QualifiedRuntimeBuild;
	readonly provenance: DshRuntimeProvenance;
	readonly sandbox: BubblewrapSandboxProfile;
	readonly routes: readonly DshBrokerHostRoute[];
	readonly gates: RuntimeProductionQualificationGateEvidence;
	readonly qualifiedAt: string;
	readonly operatingSystem?: NodeJS.Platform;
	readonly architecture?: string;
}): RuntimeProductionQualification {
	assertBackendV1SupportMatrix();
	assertQualifiedRuntimeBuild(input.build);
	if (input.build.manifest.schemaVersion !== RUNTIME_BUILD_SCHEMA_VERSION) {
		throw new Error("Legacy Runtime Build is not production-qualified.");
	}
	const manifest = input.build.manifest;
	const operatingSystem = input.operatingSystem ?? process.platform;
	const architecture = input.architecture ?? process.arch;
	if (operatingSystem !== "linux" || architecture !== "x64") {
		throw new Error("Backend production platform is unsupported.");
	}
	if (!nodeVersionSupported(manifest.nodeVersion)) {
		throw new Error("Backend production Node version is unsupported.");
	}
	const node = currentNodeIdentity();
	if (
		node.path !== manifest.nodeExecutablePath ||
		node.version !== manifest.nodeVersion ||
		node.digest !== manifest.nodeExecutableDigest
	) {
		throw new Error("Runtime Production Qualification Node identity does not match the Runtime Build.");
	}
	const sandboxProfileDigest = verifyBubblewrapSandboxProfile(input.sandbox);
	if (manifest.outerSandboxProfileDigest !== sandboxProfileDigest) {
		throw new Error("Runtime Production Qualification outer sandbox does not match the Runtime Build.");
	}
	assertDshProvenance(input.build, input.provenance);
	const managedExecutablePluginClosureDigest =
		executablePluginAdmissionClosureDigest(DSH_MANAGED_EXECUTABLE_ADMISSIONS);
	if (
		manifest.executablePluginClosureDigest !==
		managedExecutablePluginClosureDigest
	) {
		throw new Error("Runtime Production Qualification managed Plugin closure does not match the Runtime Build.");
	}
	const brokerExecutablePluginClosureDigest = executablePluginAdmissionClosureDigest(
		DSH_BROKER_HOST_EXECUTABLE_ADMISSIONS,
	);
	const providers = qualifiedProviderRoutes(input.routes);
	const gates = qualificationGates(input.gates);
	const qualifiedAt = timestamp(input.qualifiedAt, "Runtime Production Qualification qualifiedAt");
	const body = {
		protocol: RUNTIME_PRODUCTION_QUALIFICATION_PROTOCOL,
		supportMatrixDigest: BACKEND_V1_SUPPORT_MATRIX.matrixDigest,
		runtimeBuildDigest: input.build.buildDigest,
		runtimeBuildSchemaVersion: manifest.schemaVersion,
		domainPlugin: manifest.domainPlugin,
		host: Object.freeze({operatingSystem: "linux" as const, architecture: "x64" as const, node}),
		sandbox: Object.freeze({
			profileDigest: sandboxProfileDigest,
			bubblewrap: input.sandbox.bubblewrap,
			prlimit: input.sandbox.prlimit,
		}),
		dsh: Object.freeze({
			sourceCommit: input.provenance.reviewedSource.commit,
			packageSourceRelationship: input.provenance.packageSourceRelationship,
			packageClosureDigest: input.provenance.dshPackageClosureDigest,
			cordisClosureDigest: input.provenance.cordisClosureDigest,
			managedExecutablePluginClosureDigest,
			brokerExecutablePluginClosureDigest,
			packages: Object.freeze(input.provenance.dshPackages.map((entry) => Object.freeze({...entry}))),
		}),
		providers,
		gates,
		qualifiedAt,
	};
	return Object.freeze({...body, qualificationDigest: canonicalJsonDigest(body)});
}

function currentNodeIdentity(): Readonly<SandboxExecutableIdentity> {
	const path = realpathSync(process.execPath);
	if (!statSync(path).isFile()) {
		throw new Error("Backend production Node executable is not a regular file.");
	}
	return Object.freeze({
		path,
		version: process.versions.node,
		digest: sha256Digest(readFileSync(path)),
	});
}

function assertDshProvenance(
	build: QualifiedRuntimeBuild,
	provenance: DshRuntimeProvenance,
): void {
	if (
		build.manifest.dshSourceCommit !== provenance.reviewedSource.commit ||
		build.manifest.dshPackageClosureDigest !== provenance.dshPackageClosureDigest ||
		build.manifest.cordisClosureDigest !== provenance.cordisClosureDigest ||
		provenance.packageSourceRelationship !== "unattested"
	) {
		throw new Error("Runtime Production Qualification DSH provenance does not match the Runtime Build.");
	}
}

function qualifiedProviderRoutes(
	routes: readonly DshBrokerHostRoute[],
): readonly RuntimeProductionQualification["providers"][number][] {
	if (!Array.isArray(routes) || routes.length < 1 || routes.length > 64) {
		throw new Error("Runtime Production Qualification requires one through 64 provider routes.");
	}
	const seenRoutes = new Set<string>();
	const expectedRouteKeys = [
		"routeId",
		"provider",
		"family",
		"accountId",
		"credentialRef",
		"model",
	].sort((left, right) => left.localeCompare(right));
	const normalized = routes.map((route) => {
		const routeKeys = Object.keys(route).sort((left, right) => left.localeCompare(right));
		if (
			routeKeys.length !== expectedRouteKeys.length ||
			routeKeys.some((key, index) => key !== expectedRouteKeys[index])
		) {
			throw new Error("Runtime Production Qualification provider route shape is invalid.");
		}
		for (const [field, value] of Object.entries(route)) {
			if (typeof value !== "string" || value.length < 1 || value.length > 256) {
				throw new Error(`Runtime Production Qualification provider ${field} is invalid.`);
			}
		}
		if (seenRoutes.has(route.routeId)) {
			throw new Error("Runtime Production Qualification provider route ids must be unique.");
		}
		seenRoutes.add(route.routeId);
		assertSupportedProvider(route.provider, route.family);
		return Object.freeze({...route, authentication: "api-key" as const});
	});
	return Object.freeze(normalized.sort((left, right) => left.routeId.localeCompare(right.routeId)));
}

function assertSupportedProvider(
	provider: string,
	family: SupportedDshProviderFamily,
): void {
	const exact = BACKEND_V1_SUPPORT_MATRIX.providers.find(
		(entry) => entry.provider === provider && entry.family === family,
	);
	const custom =
		family === "openai-compatible" &&
		provider !== "openai" &&
		provider !== "anthropic" &&
		provider !== "deepseek";
	if (!exact && !custom) {
		throw new Error("Runtime Production Qualification provider or family is unsupported.");
	}
}

function qualificationGates(
	value: RuntimeProductionQualificationGateEvidence,
): Readonly<RuntimeProductionQualificationGateEvidence> {
	const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
	const expectedKeys = [...PRODUCTION_QUALIFICATION_GATE_NAMES].sort(
		(left, right) => left.localeCompare(right),
	);
	if (
		keys.length !== expectedKeys.length ||
		keys.some((key, index) => key !== expectedKeys[index])
	) {
		throw new Error("Runtime Production Qualification gate evidence shape is invalid.");
	}
	for (const name of PRODUCTION_QUALIFICATION_GATE_NAMES) {
		if (!/^sha256:[a-f0-9]{64}$/u.test(value[name])) {
			throw new Error(`Runtime Production Qualification ${name} evidence digest is invalid.`);
		}
	}
	return Object.freeze({...value});
}

function nodeVersionSupported(value: string): boolean {
	const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(value);
	if (!match) return false;
	const major = Number(match[1]);
	const minor = Number(match[2]);
	return major > 22 || (major === 22 && minor >= 19);
}

function timestamp(value: string, field: string): string {
	if (
		typeof value !== "string" ||
		Number.isNaN(Date.parse(value)) ||
		new Date(value).toISOString() !== value
	) {
		throw new Error(`${field} must be an exact UTC ISO timestamp.`);
	}
	return value;
}

export function runtimeProductionPluginAdmissions(): Readonly<{
	readonly managed: readonly ExecutablePluginAdmission[];
	readonly brokerHost: readonly ExecutablePluginAdmission[];
}> {
	return Object.freeze({
		managed: DSH_MANAGED_EXECUTABLE_ADMISSIONS,
		brokerHost: DSH_BROKER_HOST_EXECUTABLE_ADMISSIONS,
	});
}
