import {
	BACKEND_V1_RELEASE_MANIFEST_PROTOCOL,
	BACKEND_V1_SUPPORT_MATRIX,
} from "../../protocol/backend-production.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {
	assertBackendBuildBinding,
	BACKEND_BUILD_PROTOCOL,
	type CurrentBackendBuildBinding,
} from "./build.ts";

export {BACKEND_V1_RELEASE_MANIFEST_PROTOCOL};

export const BACKEND_V1_RELEASE_EVIDENCE_NAMES = Object.freeze([
	"diagnostics",
	"fullTests",
	"production",
	"readiness",
	"packedExternal",
	"independentCi",
	"dogfood",
	"vulnerabilities",
	"cleanup",
] as const);

export type BackendV1ReleaseEvidenceName =
	(typeof BACKEND_V1_RELEASE_EVIDENCE_NAMES)[number];

export type BackendV1ReleaseEvidence = Readonly<
	Record<BackendV1ReleaseEvidenceName, Sha256Digest>
>;

export type BackendV1ReleaseCheckPackStage =
	| "decision"
	| "planning"
	| "implementation"
	| "review";

export interface BackendV1ReleaseCheckPackBinding {
	readonly stage: BackendV1ReleaseCheckPackStage;
	readonly checkPackDigest: Sha256Digest;
}

export interface BackendV1ReleaseControllerBinding {
	readonly packageVersion: string;
	readonly packageArtifactDigest: Sha256Digest;
	readonly backendBuildDigest: Sha256Digest;
	readonly sourceRevision: string;
}

export interface BackendV1ReleaseDogfoodBinding {
	readonly subjectCandidateDigest: Sha256Digest;
	readonly protectedSourceHead: string;
	readonly checkPacks: readonly BackendV1ReleaseCheckPackBinding[];
}

export interface BackendV1ReleaseManifest {
	readonly protocol: typeof BACKEND_V1_RELEASE_MANIFEST_PROTOCOL;
	readonly channel: "release-candidate";
	readonly package: Readonly<{
		readonly name: "@nunomoura/codewiki";
		readonly version: string;
		readonly artifactDigest: Sha256Digest;
		readonly sourceRevision: string;
		readonly sourceTreeDigest: Sha256Digest;
	}>;
	readonly backendBuild: CurrentBackendBuildBinding;
	readonly contractFreezeDigest: Sha256Digest;
	readonly runtimeProductionQualificationDigest: Sha256Digest;
	readonly controller: BackendV1ReleaseControllerBinding;
	readonly dogfood: BackendV1ReleaseDogfoodBinding;
	readonly evidence: BackendV1ReleaseEvidence;
	readonly qualifiedAt: string;
	readonly manifestDigest: Sha256Digest;
}

export function backendV1ContractFreezeDigest(
	build: CurrentBackendBuildBinding,
): Sha256Digest {
	assertCurrentBackendBuild(build);
	return canonicalJsonDigest({
		supportMatrixDigest: build.supportMatrixDigest,
		dshProfiles: build.dshProfiles,
		domainPlugins: build.domainPlugins,
		fileSchemas: build.fileSchemas,
		protocols: build.protocols,
	});
}

export function createBackendV1ReleaseManifest(input: {
	readonly packageVersion: string;
	readonly packageArtifactDigest: Sha256Digest;
	readonly sourceRevision: string;
	readonly sourceTreeDigest: Sha256Digest;
	readonly backendBuild: CurrentBackendBuildBinding;
	readonly runtimeProductionQualificationDigest: Sha256Digest;
	readonly controller: BackendV1ReleaseControllerBinding;
	readonly dogfood: BackendV1ReleaseDogfoodBinding;
	readonly evidence: BackendV1ReleaseEvidence;
	readonly qualifiedAt: string;
}): BackendV1ReleaseManifest {
	assertCurrentBackendBuild(input.backendBuild);
	const packageVersion = version(input.packageVersion, "Backend release package version");
	if (input.backendBuild.packageVersion !== packageVersion) {
		throw new Error("Backend release package version does not match Backend Build.");
	}
	if (input.backendBuild.supportMatrixDigest !== BACKEND_V1_SUPPORT_MATRIX.matrixDigest) {
		throw new Error("Backend release support matrix is not the frozen Backend v1 matrix.");
	}
	const body = {
		protocol: BACKEND_V1_RELEASE_MANIFEST_PROTOCOL,
		channel: "release-candidate" as const,
		package: Object.freeze({
			name: "@nunomoura/codewiki" as const,
			version: packageVersion,
			artifactDigest: digest(
				input.packageArtifactDigest,
				"Backend release package artifact digest",
			),
			sourceRevision: gitRevision(
				input.sourceRevision,
				"Backend release source revision",
			),
			sourceTreeDigest: digest(
				input.sourceTreeDigest,
				"Backend release source tree digest",
			),
		}),
		backendBuild: input.backendBuild,
		contractFreezeDigest: backendV1ContractFreezeDigest(input.backendBuild),
		runtimeProductionQualificationDigest: digest(
			input.runtimeProductionQualificationDigest,
			"Backend release Runtime Production Qualification digest",
		),
		controller: controllerBinding(input.controller),
		dogfood: dogfoodBinding(input.dogfood),
		evidence: releaseEvidence(input.evidence),
		qualifiedAt: timestamp(input.qualifiedAt, "Backend release qualifiedAt"),
	};
	return Object.freeze({...body, manifestDigest: canonicalJsonDigest(body)});
}

export function assertBackendV1ReleaseManifest(
	value: BackendV1ReleaseManifest,
): void {
	const normalized = createBackendV1ReleaseManifest({
		packageVersion: value.package.version,
		packageArtifactDigest: value.package.artifactDigest,
		sourceRevision: value.package.sourceRevision,
		sourceTreeDigest: value.package.sourceTreeDigest,
		backendBuild: value.backendBuild,
		runtimeProductionQualificationDigest: value.runtimeProductionQualificationDigest,
		controller: value.controller,
		dogfood: value.dogfood,
		evidence: value.evidence,
		qualifiedAt: value.qualifiedAt,
	});
	if (canonicalJson(value) !== canonicalJson(normalized)) {
		throw new Error("Backend v1 Release Manifest digest or shape is invalid.");
	}
}

function assertCurrentBackendBuild(
	value: CurrentBackendBuildBinding,
): asserts value is CurrentBackendBuildBinding {
	assertBackendBuildBinding(value);
	if (
		value.protocol.id !== BACKEND_BUILD_PROTOCOL.id ||
		value.protocol.version !== BACKEND_BUILD_PROTOCOL.version
	) {
		throw new Error("Backend release requires the current Backend Build protocol.");
	}
}

function controllerBinding(
	value: BackendV1ReleaseControllerBinding,
): BackendV1ReleaseControllerBinding {
	return Object.freeze({
		packageVersion: version(
			value?.packageVersion,
			"Backend release controller package version",
		),
		packageArtifactDigest: digest(
			value?.packageArtifactDigest,
			"Backend release controller package artifact digest",
		),
		backendBuildDigest: digest(
			value?.backendBuildDigest,
			"Backend release controller Build digest",
		),
		sourceRevision: gitRevision(
			value?.sourceRevision,
			"Backend release controller source revision",
		),
	});
}

function dogfoodBinding(
	value: BackendV1ReleaseDogfoodBinding,
): BackendV1ReleaseDogfoodBinding {
	const stages: readonly BackendV1ReleaseCheckPackStage[] = [
		"decision",
		"planning",
		"implementation",
		"review",
	];
	if (!Array.isArray(value?.checkPacks) || value.checkPacks.length !== stages.length) {
		throw new Error("Backend release dogfood Check Pack bindings are incomplete.");
	}
	const checkPacks = value.checkPacks.map((entry) => Object.freeze({
		stage: stage(entry?.stage),
		checkPackDigest: digest(
			entry?.checkPackDigest,
			"Backend release dogfood Check Pack digest",
		),
	})).sort((left, right) => left.stage.localeCompare(right.stage));
	const expectedStages = [...stages].sort((left, right) => left.localeCompare(right));
	if (checkPacks.some((entry, index) => entry.stage !== expectedStages[index])) {
		throw new Error("Backend release dogfood Check Pack stages are invalid.");
	}
	return Object.freeze({
		subjectCandidateDigest: digest(
			value.subjectCandidateDigest,
			"Backend release dogfood subject Candidate digest",
		),
		protectedSourceHead: gitRevision(
			value.protectedSourceHead,
			"Backend release dogfood protected source head",
		),
		checkPacks: Object.freeze(checkPacks),
	});
}

function releaseEvidence(value: BackendV1ReleaseEvidence): BackendV1ReleaseEvidence {
	const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
	const expected = [...BACKEND_V1_RELEASE_EVIDENCE_NAMES].sort(
		(left, right) => left.localeCompare(right),
	);
	if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
		throw new Error("Backend release qualification evidence is incomplete.");
	}
	return Object.freeze({
		diagnostics: digest(value.diagnostics, "Backend release diagnostics evidence digest"),
		fullTests: digest(value.fullTests, "Backend release fullTests evidence digest"),
		production: digest(value.production, "Backend release production evidence digest"),
		readiness: digest(value.readiness, "Backend release readiness evidence digest"),
		packedExternal: digest(
			value.packedExternal,
			"Backend release packedExternal evidence digest",
		),
		independentCi: digest(
			value.independentCi,
			"Backend release independentCi evidence digest",
		),
		dogfood: digest(value.dogfood, "Backend release dogfood evidence digest"),
		vulnerabilities: digest(
			value.vulnerabilities,
			"Backend release vulnerabilities evidence digest",
		),
		cleanup: digest(value.cleanup, "Backend release cleanup evidence digest"),
	});
}

function stage(value: string): BackendV1ReleaseCheckPackStage {
	if (!(["decision", "planning", "implementation", "review"] as const).includes(
		value as BackendV1ReleaseCheckPackStage,
	)) {
		throw new Error("Backend release dogfood Check Pack stage is invalid.");
	}
	return value as BackendV1ReleaseCheckPackStage;
}

function version(value: string, field: string): string {
	if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(value)) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}

function gitRevision(value: string, field: string): string {
	if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value)) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}

function digest(value: Sha256Digest, field: string): Sha256Digest {
	if (!/^sha256:[a-f0-9]{64}$/u.test(value)) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}

function timestamp(value: string, field: string): string {
	if (
		Number.isNaN(Date.parse(value)) ||
		new Date(value).toISOString() !== value
	) {
		throw new Error(`${field} must be an exact UTC ISO timestamp.`);
	}
	return value;
}
