import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { CODEWIKI_EXTENSION_AVAILABLE } from "../src/index.ts";
import * as packageApi from "../src/index.ts";
import * as projectServerApi from "../src/project-server/index.ts";
import * as runtimeApi from "../src/runtime/index.ts";
import packageJson from "../package.json" with { type: "json" };
import tsconfig from "../tsconfig.json" with { type: "json" };
import buildTsconfig from "../tsconfig.build.json" with { type: "json" };

const readme = readFileSync("README.md", "utf8");
const sourceIndex = readFileSync("src/index.ts", "utf8");
const projectServerIndex = readFileSync("src/project-server/index.ts", "utf8");

describe("fresh scaffold", () => {
	it("exposes the Pi extension for package installs", () => {
		assert.equal(CODEWIKI_EXTENSION_AVAILABLE, true);
	});

	it("keeps the package root contract-focused and the Project Server facade acyclic", () => {
		assert.equal(existsSync("src/api"), false);
		assert.doesNotMatch(sourceIndex, /from "\.\/api\//);
		assert.doesNotMatch(sourceIndex, /from "\.\/pi\//);
		assert.doesNotMatch(projectServerIndex, /from "\.\.\/clients\//);
		assert.doesNotMatch(projectServerIndex, /from "\.\.\/execution\/pi\//);
		assert.equal(
			Object.keys(packageApi).some(
				(name) => name.startsWith("Pi") || name.startsWith("createPi"),
			),
			false,
		);
		assert.equal(typeof packageApi.createChecks, "function");
		assert.equal(typeof packageApi.createGateRunner, "function");
		assert.equal(typeof packageApi.CheckDefinitionSchema, "object");
		assert.equal("createVerificationRuntime" in packageApi, false);
		assert.equal("createRepairExecutionInvocation" in packageApi, false);
		assert.equal("runWikiChange" in packageApi, false);
		assert.equal("buildWikiState" in packageApi, false);
	});

	it("declares runtime requirements for generated package output", () => {
		assert.equal(packageJson.engines.node, ">=22.19.0");
		assert.equal(packageJson.bin, undefined);
		assert.deepEqual(packageJson.pi, {
			extensions: ["dist/pi-extension.js"],
		});
		assert.equal(packageJson.keywords.includes("pi-package"), true);
		assert.deepEqual(packageJson.files, [
			"dist",
			"check-packs",
			"README.md",
			"CHANGELOG.md",
			"LICENSE",
			"package.json",
		]);
		assert.deepEqual(packageJson.exports, {
			".": {
				types: "./dist/index.d.ts",
				import: "./dist/index.js",
			},
			"./project-server": {
				types: "./dist/project-server/index.d.ts",
				import: "./dist/project-server/index.js",
			},
			"./runtime": {
				types: "./dist/runtime/index.d.ts",
				import: "./dist/runtime/index.js",
			},
			"./checks": {
				types: "./dist/checks/index.d.ts",
				import: "./dist/checks/index.js",
			},
			"./package.json": "./package.json",
		});
		assert.equal(packageJson.types, "./dist/index.d.ts");
		assert.match(packageJson.scripts.build, /rmSync\('dist'/);
		assert.match(packageJson.scripts.build, /tsc -p tsconfig\.build\.json/);
		assert.equal(tsconfig.compilerOptions.erasableSyntaxOnly, true);
		assert.equal(buildTsconfig.compilerOptions.outDir, "dist");
		assert.equal(
			buildTsconfig.compilerOptions.rewriteRelativeImportExtensions,
			true,
		);
	});

	it("does not promote the transitional CLI as product usage", () => {
		assert.doesNotMatch(readme, /codewiki <command>/);
		assert.doesNotMatch(readme, /codewiki state/);
		assert.doesNotMatch(readme, /codewiki bootstrap/);
		assert.doesNotMatch(
			readme,
			/node --experimental-strip-types src\/(?:clients\/cli|cli)\/index\.ts/,
		);
	});

	it("publishes one curated Project Server command and query surface", () => {
		assert.deepEqual(Object.keys(projectServerApi).sort(), [
			"BACKEND_BACKUP_PROTOCOL",
			"BACKEND_BUILD_PROTOCOL",
			"BACKEND_BUILD_TRANSITION_PROTOCOL",
			"BACKEND_FAULT_RECOVERY_MATRIX",
			"BACKEND_FAULT_RECOVERY_PROTOCOL",
			"BACKEND_OBSERVABILITY_PROTOCOL",
			"BACKEND_PRODUCTION_FAULTS",
			"BACKEND_STATE_MIGRATION_PROTOCOL",
			"BACKEND_STATE_PROTOCOL",
			"BACKEND_STATE_RECOVERY_PROTOCOL",
			"BACKEND_STATE_RESTORE_PROTOCOL",
			"BACKEND_V1_RELEASE_EVIDENCE_NAMES",
			"BACKEND_V1_RELEASE_MANIFEST_PROTOCOL",
			"CHANGE_INTAKE_RUNTIME_PROTOCOL",
			"CODEWIKI_MCP_NAMESPACE",
			"CODEWIKI_MCP_OPERATIONS",
			"CODEWIKI_PACKAGE_LOCK_DIGEST",
			"DEFAULT_BACKEND_BUILD",
			"DSH_AGENT_SESSION_CUSTODY_PROTOCOL",
			"EXTERNAL_CANDIDATE_CAPTURE_PROTOCOL",
			"HARNESS_OBSERVER_PROJECTION_PROTOCOL",
			"KB_TO_WIKI_LEGACY_SOURCE_SNAPSHOT_PROTOCOL",
			"LEGACY_BACKEND_BUILD_PROTOCOL",
			"SCHEDULING_PLAN_PROTOCOL",
			"SESSION_CONTINUITY_PROTOCOL",
			"WORK_UNIT_MODEL_ASSIGNMENT_PROTOCOL",
			"acquireSessionLease",
			"activateBackendBuild",
			"admitExternalCandidateCapture",
			"appendProjectSessionContinuity",
			"assertBackendBuildBinding",
			"assertBackendFaultRecoveryMatrix",
			"assertBackendV1ReleaseManifest",
			"assertCurrentAggregateReviewAttempt",
			"assertExternalCandidateCapture",
			"assertHarnessInteractionBinding",
			"assertHarnessObserverProjection",
			"assertKbToWikiMigrationReadiness",
			"assertSessionContinuityRecord",
			"authorizeDshAgentSessionCustody",
			"backendBuildDomainClosureCompatible",
			"backendBuildFileSchemasCompatible",
			"backendBuildIncompatibleFileSchema",
			"backendBuildSupportsStateSchema",
			"backendFaultRecoveryPolicy",
			"backendOperationalBinding",
			"backendV1ContractFreezeDigest",
			"bootstrapBackendState",
			"bootstrapStandaloneProjectServer",
			"buildKbToWikiLegacySourceSnapshot",
			"buildProjectWikiState",
			"buildWikiState",
			"canonicalProjectSnapshotDigest",
			"collectBackendAuditRecords",
			"commitGuardedDelivery",
			"commitImplementationAggregate",
			"commitPrivateIntegrationAdmission",
			"commitProjectSchedulingPlan",
			"commitSessionRunReceipt",
			"connectProjectServerApi",
			"createAggregateReviewAttempt",
			"createBackendBuildBinding",
			"createBackendStateBackup",
			"createBackendV1ReleaseManifest",
			"createChangeIntakeProjectServer",
			"createCodeWikiLoopExecutionPorts",
			"createCodewikiMcpBinding",
			"createDeliveryAuthority",
			"createExternalCandidateCapture",
			"createGuardedDeliveryOperation",
			"createHarnessCandidateSubmission",
			"createHarnessInteractionBinding",
			"createHarnessObserverProjection",
			"createImplementationAggregateFreeze",
			"createImplementationOperationSequence",
			"createImplementationRunRequest",
			"createImplementationStageGate",
			"createPrivateIntegrationAdmission",
			"createProjectSchedulingPlan",
			"createProjectServerApi",
			"createProjectSessionContinuity",
			"createSchedulingOperationSequence",
			"createSessionContinuity",
			"createWorkUnitModelAssignment",
			"deriveReadyWorkUnits",
			"executionFailureFromProviderReceipt",
			"expireSessionLease",
			"inspectBackendOperations",
			"legacyProjectStateSnapshotDigest",
			"migrateBackendState",
			"normalizeCodewikiMcpRequest",
			"privateChangeIntegrationRef",
			"projectOperationalStatus",
			"pruneBackendStateBackups",
			"readBackendStateBackup",
			"readBackendStateManifest",
			"readProjectSessionContinuity",
			"readStandaloneProjectServerStatus",
			"recoverBackendStateManifest",
			"requestSessionLeaseCancellation",
			"resolveExecutionRecovery",
			"restartStandaloneProjectServer",
			"restoreBackendStateBackup",
			"rollbackStandaloneBackend",
			"rolloverSessionContinuity",
			"runHarnessProducerTurn",
			"runModelRouteForAssignment",
			"runProjectServer",
			"runProjectServerSemanticExecutor",
			"runWikiArchive",
			"runWikiChange",
			"runWikiConfig",
			"runWikiDecide",
			"runWikiOkf",
			"runWikiPlan",
			"startStandaloneProjectServer",
			"stopProjectServer",
			"stopStandaloneProjectServer",
			"uninstallStandaloneBackendState",
			"upgradeStandaloneBackend",
			"wikiChangeOperationMutates",
		]);
	});

	it("publishes Runtime execution contracts without Project Server authority", () => {
		assert.equal(typeof runtimeApi.createRuntime, "function");
		assert.equal(typeof runtimeApi.createRunRequest, "function");
		assert.equal(typeof runtimeApi.createRunReceipt, "function");
		assert.equal(typeof runtimeApi.createRuntimeBuildManifest, "function");
		assert.equal(typeof runtimeApi.createRuntimeProductionQualification, "function");
		assert.equal(runtimeApi.RUNTIME_BUILD_SCHEMA_VERSION, "4.0.0");
		assert.equal(typeof runtimeApi.createDshPrivateProviderBrokerInstaller, "function");
		assert.equal(typeof runtimeApi.startPrivateProviderBrokerServer, "function");
		assert.equal("runWikiChange" in runtimeApi, false);
		assert.equal("createProjectServerApi" in runtimeApi, false);
	});

});
