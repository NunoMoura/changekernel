import type {DomainPluginIdentity} from "../domains/contracts.ts";
import type {
	RunReceipt,
	RuntimeBuildRegistrySnapshot,
} from "../runtime/contracts.ts";
import {
	canonicalJsonDigest,
	type Sha256Digest,
} from "../utils/canonical-json.ts";

export const BACKEND_SUPPORT_MATRIX_PROTOCOL = Object.freeze({
	id: "codewiki.backend-support-matrix",
	version: "1.0.0",
} as const);

export const RUNTIME_PRODUCTION_QUALIFICATION_PROTOCOL = Object.freeze({
	id: "codewiki.runtime-production-qualification",
	version: "1.0.0",
} as const);

export type SupportedDshProviderFamily =
	| "openai"
	| "anthropic"
	| "deepseek"
	| "openai-compatible";

export interface BackendProviderSupport {
	readonly id: "openai" | "anthropic" | "deepseek" | "custom-openai-compatible";
	readonly provider: string | "operator-defined";
	readonly family: SupportedDshProviderFamily;
	readonly authentication: "api-key";
	readonly status: "supported";
	readonly qualification: "deterministic-wire" | "opt-in-live";
}

export interface ProductionExecutableIdentity {
	readonly path: string;
	readonly version: string;
	readonly digest: Sha256Digest;
}

export interface RuntimeProductionQualificationGateEvidence {
	readonly faultRecovery: Sha256Digest;
	readonly threatModel: Sha256Digest;
	readonly dependencies: Sha256Digest;
	readonly secrets: Sha256Digest;
	readonly vulnerabilities: Sha256Digest;
	readonly package: Sha256Digest;
	readonly performance: Sha256Digest;
	readonly adversarial: Sha256Digest;
}

export interface RuntimeProductionQualification {
	readonly protocol: typeof RUNTIME_PRODUCTION_QUALIFICATION_PROTOCOL;
	readonly supportMatrixDigest: Sha256Digest;
	readonly runtimeBuildDigest: Sha256Digest;
	readonly runtimeBuildSchemaVersion: "4.0.0";
	readonly domainPlugin: DomainPluginIdentity;
	readonly host: Readonly<{
		readonly operatingSystem: "linux";
		readonly architecture: "x64";
		readonly node: ProductionExecutableIdentity;
	}>;
	readonly sandbox: Readonly<{
		readonly profileDigest: Sha256Digest;
		readonly bubblewrap: ProductionExecutableIdentity;
		readonly prlimit: ProductionExecutableIdentity;
	}>;
	readonly dsh: Readonly<{
		readonly sourceCommit: string;
		readonly packageSourceRelationship: "unattested";
		readonly packageClosureDigest: Sha256Digest;
		readonly cordisClosureDigest: Sha256Digest;
		readonly managedExecutablePluginClosureDigest: Sha256Digest;
		readonly brokerExecutablePluginClosureDigest: Sha256Digest;
		readonly packages: readonly Readonly<{
			readonly name: string;
			readonly version: string;
			readonly integrity: string;
		}>[];
	}>;
	readonly providers: readonly Readonly<{
		readonly routeId: string;
		readonly provider: string;
		readonly family: SupportedDshProviderFamily;
		readonly accountId: string;
		readonly credentialRef: string;
		readonly model: string;
		readonly authentication: "api-key";
	}>[];
	readonly gates: RuntimeProductionQualificationGateEvidence;
	readonly qualifiedAt: string;
	readonly qualificationDigest: Sha256Digest;
}

/** Read-only Runtime custody seam used by Project Server operational projections. */
export interface RuntimeOperationsInspectionPort {
	readBuildRegistry(): Promise<RuntimeBuildRegistrySnapshot | undefined>;
	readProductionQualification(): Promise<RuntimeProductionQualification | null>;
	readReceipt(input: {
		readonly runId: string;
		readonly requestDigest: Sha256Digest;
	}): Promise<Readonly<RunReceipt> | null>;
}

export interface BackendSupportMatrix {
	readonly protocol: typeof BACKEND_SUPPORT_MATRIX_PROTOCOL;
	readonly productionPlatform: Readonly<{
		readonly operatingSystem: "linux";
		readonly architecture: "x64";
		readonly deploymentClass: "isolated-single-user";
		readonly minimumNodeVersion: "22.19.0";
		readonly exactRuntimeNodeIdentityRequired: true;
		readonly containment: "bubblewrap+prlimit";
	}>;
	readonly providers: readonly BackendProviderSupport[];
	readonly unsupportedAuthentication: readonly Readonly<{
		readonly authentication: "oauth" | "ambient-credential" | "secret-header";
		readonly reason: string;
	}>[];
	readonly unsupportedDeploymentClasses: readonly "multi-user-local-file-credentials"[];
	readonly matrixDigest: Sha256Digest;
}

const MATRIX_WITHOUT_DIGEST = Object.freeze({
	protocol: BACKEND_SUPPORT_MATRIX_PROTOCOL,
	productionPlatform: Object.freeze({
		operatingSystem: "linux",
		architecture: "x64",
		deploymentClass: "isolated-single-user",
		minimumNodeVersion: "22.19.0",
		exactRuntimeNodeIdentityRequired: true,
		containment: "bubblewrap+prlimit",
	}),
	providers: Object.freeze([
		providerSupport("openai", "openai", "openai", "deterministic-wire"),
		providerSupport("anthropic", "anthropic", "anthropic", "deterministic-wire"),
		providerSupport("deepseek", "deepseek", "deepseek", "deterministic-wire"),
		providerSupport(
			"custom-openai-compatible",
			"operator-defined",
			"openai-compatible",
			"opt-in-live",
		),
	]),
	unsupportedAuthentication: Object.freeze([
		Object.freeze({
			authentication: "oauth",
			reason: "Refresh persistence, entitlement filtering, revocation, and recovery are unqualified.",
		}),
		Object.freeze({
			authentication: "ambient-credential",
			reason: "Managed Runs may use only exact Broker Host credential references.",
		}),
		Object.freeze({
			authentication: "secret-header",
			reason: "Provider configuration cannot carry secret-bearing headers.",
		}),
	]),
	unsupportedDeploymentClasses: Object.freeze([
		"multi-user-local-file-credentials" as const,
	]),
});

export const BACKEND_V1_SUPPORT_MATRIX: BackendSupportMatrix = Object.freeze({
	...MATRIX_WITHOUT_DIGEST,
	matrixDigest: canonicalJsonDigest(MATRIX_WITHOUT_DIGEST),
});

export function assertRuntimeProductionQualification(
	value: RuntimeProductionQualification,
): asserts value is RuntimeProductionQualification {
	if (!value || typeof value !== "object") {
		throw new Error("Runtime Production Qualification is invalid.");
	}
	const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
	const expected = [
		"protocol",
		"supportMatrixDigest",
		"runtimeBuildDigest",
		"runtimeBuildSchemaVersion",
		"domainPlugin",
		"host",
		"sandbox",
		"dsh",
		"providers",
		"gates",
		"qualifiedAt",
		"qualificationDigest",
	].sort((left, right) => left.localeCompare(right));
	if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
		throw new Error("Runtime Production Qualification shape is invalid.");
	}
	const {qualificationDigest, ...body} = value;
	if (
		value.protocol.id !== RUNTIME_PRODUCTION_QUALIFICATION_PROTOCOL.id ||
		value.protocol.version !== RUNTIME_PRODUCTION_QUALIFICATION_PROTOCOL.version ||
		value.supportMatrixDigest !== BACKEND_V1_SUPPORT_MATRIX.matrixDigest ||
		!/^sha256:[a-f0-9]{64}$/u.test(qualificationDigest) ||
		canonicalJsonDigest(body) !== qualificationDigest
	) {
		throw new Error("Runtime Production Qualification digest or protocol is invalid.");
	}
}

export function assertBackendV1SupportMatrix(
	value: BackendSupportMatrix = BACKEND_V1_SUPPORT_MATRIX,
): BackendSupportMatrix {
	if (
		canonicalJsonDigest({
			protocol: value.protocol,
			productionPlatform: value.productionPlatform,
			providers: value.providers,
			unsupportedAuthentication: value.unsupportedAuthentication,
			unsupportedDeploymentClasses: value.unsupportedDeploymentClasses,
		}) !== value.matrixDigest ||
		value.matrixDigest !== BACKEND_V1_SUPPORT_MATRIX.matrixDigest
	) {
		throw new Error("Backend v1 support matrix is invalid or drifted.");
	}
	return value;
}

function providerSupport(
	id: BackendProviderSupport["id"],
	provider: BackendProviderSupport["provider"],
	family: SupportedDshProviderFamily,
	qualification: BackendProviderSupport["qualification"],
): BackendProviderSupport {
	return Object.freeze({
		id,
		provider,
		family,
		authentication: "api-key",
		status: "supported",
		qualification,
	});
}
