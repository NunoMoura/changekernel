import assert from "node:assert/strict";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import test from "node:test";

import {DEFAULT_DOMAIN_PLUGIN_IDENTITY} from "../../../src/domains/defaults.ts";
import {
	createBackendBuildBinding,
	DEFAULT_BACKEND_BUILD,
} from "../../../src/project-server/operations/build.ts";
import {
	BACKEND_OBSERVABILITY_PROTOCOL,
	collectBackendAuditRecords,
	inspectBackendOperations,
} from "../../../src/project-server/operations/observability.ts";
import {projectServerStatePaths} from "../../../src/project-server/operations/paths.ts";
import {
	activateBackendBuild,
	bootstrapBackendState,
} from "../../../src/project-server/operations/state.ts";
import {
	appendDevLogEntry,
} from "../../../src/project-server/persistence/dev-log.ts";
import {
	appendStoredExecutionLedger,
	openStoredExecutionLedger,
	retainRunRawLog,
} from "../../../src/runtime/evidence/store.ts";
import {
	RUN_PROTOCOL,
	activateRuntimeBuild,
	createQualifiedRuntimeBuild,
	createRuntimeBuildManifest,
	createRuntimeBuildRegistrySnapshot,
	qualifyRuntimeBuild,
} from "../../../src/runtime/contracts.ts";
import {createExecutionLedgerHeader} from "../../../src/runtime/evidence/execution-ledger.ts";
import {createStoredRuntimeOperationsInspectionPort} from "../../../src/runtime/operations.ts";
import {commitStoredRunReceipt} from "../../../src/runtime/receipts/store.ts";
import {
	canonicalJsonDigest,
	sha256Digest,
} from "../../../src/utils/canonical-json.ts";
import {
	completedReceipt,
	rawLogReference,
	runRequest,
} from "../../runtime/helpers/run-evidence.mjs";

async function fixture(suffix) {
	const base = await mkdtemp(join(tmpdir(), `codewiki-b8-observability-${suffix}-`));
	const repoRoot = join(base, "project");
	const stateRoot = join(base, "state");
	await mkdir(join(repoRoot, ".codewiki", "kb"), {recursive: true});
	await mkdir(join(repoRoot, ".codewiki", "traces"), {recursive: true});
	await mkdir(join(repoRoot, ".codewiki", "check-packs"), {recursive: true});
	await writeFile(join(repoRoot, ".codewiki", "config.json"), '{"project":"fixture"}\n');
	await writeFile(join(repoRoot, ".codewiki", "kb", "topic.md"), "# Topic\n");
	return {
		base,
		repoRoot,
		stateRoot,
		paths: projectServerStatePaths({repoRoot, stateRoot}),
		async cleanup() {
			await rm(base, {recursive: true, force: true});
		},
	};
}

test("operational report exports bounded health, audit, metrics, logs, and receipt metadata", async () => {
	const context = await fixture("report");
	try {
		const initial = await bootstrapBackendState({
			repoRoot: context.repoRoot,
			stateRoot: context.stateRoot,
			createdAt: "2026-09-10T10:00:00.000Z",
		});
		const targetBuild = createBackendBuildBinding({
			packageVersion: "0.4.0",
			packageLockDigest: `sha256:${"b".repeat(64)}`,
			supportMatrixDigest: DEFAULT_BACKEND_BUILD.supportMatrixDigest,
			dshProfiles: DEFAULT_BACKEND_BUILD.dshProfiles,
			domainPlugins: DEFAULT_BACKEND_BUILD.domainPlugins,
			fileSchemas: DEFAULT_BACKEND_BUILD.fileSchemas,
			protocols: DEFAULT_BACKEND_BUILD.protocols,
		});
		const transition = await activateBackendBuild({
			repoRoot: context.repoRoot,
			stateRoot: context.stateRoot,
			expectedStateDigest: initial.stateDigest,
			targetBuild,
			transitionedAt: "2026-09-10T10:01:00.000Z",
		});
		await appendDevLogEntry(context.repoRoot, {
			id: "log-observability-1",
			timestamp: "2026-09-10T10:02:00.000Z",
			traceId: "trace-observability",
			category: "runtime",
			action: "inspect",
			status: "success",
			summary: "Verified bounded operational projection.",
			refs: [`backend-transition:${transition.transitionDigest}`],
			redactions: ["raw-log"],
		}, context.stateRoot);
		const {request, receipt} = await retainedReceipt(context.paths.executionEvidenceRoot);
		const report = await inspectBackendOperations({
			repoRoot: context.repoRoot,
			stateRoot: context.stateRoot,
			observedAt: "2026-09-10T10:03:00.000Z",
			runtime: runtimeOperations(context),
			traceIds: ["trace-observability"],
			receipts: [{runId: request.runId, requestDigest: request.requestDigest}],
			liveRuntime: {
				observedAt: "2026-09-10T10:02:30.000Z",
				activeRunCount: 0,
				providerBroker: "idle",
				evidenceDigest: canonicalJsonDigest("runtime-idle"),
			},
		});

		assert.equal(report.protocol.id, BACKEND_OBSERVABILITY_PROTOCOL.id);
		assert.equal(report.overall, "healthy");
		assert.equal(report.lifecycle, "stopped");
		assert.equal(report.metrics.auditRecords, 1);
		assert.equal(report.metrics.logEntries, 1);
		assert.equal(report.metrics.verifiedReceipts, 1);
		assert.equal(report.audit.records[0].digest, transition.transitionDigest);
		assert.equal(report.audit.records[0].kind, "build-transition");
		assert.match(report.audit.records[0].ref, /^codewiki-state:\/\/project\//);
		assert.equal(report.logs[0].entries[0].summary, "Verified bounded operational projection.");
		assert.equal(report.receipts[0].receiptDigest, receipt.receiptDigest);
		assert.equal(report.receipts[0].executionLedgerDigest, receipt.executionLedgerDigest);
		assert.equal("rawLog" in report.receipts[0], false);
		assert.deepEqual(report.privacy, {
			chainOfThought: "excluded",
			secrets: "excluded",
			rawSessionBytes: "excluded",
			rawLogs: "excluded",
		});
		assert.equal(
			report.reportDigest,
			canonicalJsonDigest(Object.fromEntries(
				Object.entries(report).filter(([key]) => key !== "reportDigest"),
			)),
		);
		assert.doesNotMatch(JSON.stringify(report), /assistant\/message|fixture-secret|<think>/i);
	} finally {
		await context.cleanup();
	}
});

test("operational health reports an active Runtime Build without matching qualification as unhealthy", async () => {
	const context = await fixture("runtime-unqualified");
	try {
		await bootstrapBackendState({
			repoRoot: context.repoRoot,
			stateRoot: context.stateRoot,
			createdAt: "2026-09-10T10:30:00.000Z",
		});
		const registry = activeRuntimeRegistry();
		const report = await inspectBackendOperations({
			repoRoot: context.repoRoot,
			stateRoot: context.stateRoot,
			observedAt: "2026-09-10T10:31:00.000Z",
			runtime: Object.freeze({
				readBuildRegistry: async () => registry,
				readProductionQualification: async () => null,
				readReceipt: async () => null,
			}),
		});
		assert.equal(report.overall, "unhealthy");
		assert.equal(
			report.components.find(({component}) => component === "runtime-build").identityDigest,
			registry.activeBuildDigest,
		);
		assert.equal(
			report.diagnostics.some(
				({code}) => code === "runtime.production_qualification_missing",
			),
			true,
		);
	} finally {
		await context.cleanup();
	}
});

test("operational diagnostics fail closed on missing receipts and corrupt audit bytes", async () => {
	const context = await fixture("fail-closed");
	try {
		await bootstrapBackendState({
			repoRoot: context.repoRoot,
			stateRoot: context.stateRoot,
			createdAt: "2026-09-10T11:00:00.000Z",
		});
		const missingDigest = `sha256:${"7".repeat(64)}`;
		const report = await inspectBackendOperations({
			repoRoot: context.repoRoot,
			stateRoot: context.stateRoot,
			observedAt: "2026-09-10T11:01:00.000Z",
			runtime: runtimeOperations(context),
			receipts: [{runId: "run-missing", requestDigest: missingDigest}],
		});
		assert.equal(report.overall, "degraded");
		assert.equal(report.receipts[0].status, "missing");
		assert.equal(report.diagnostics[0].code, "runtime.receipt_missing");

		await mkdir(context.paths.buildTransitionsRoot, {recursive: true});
		await writeFile(
			join(context.paths.buildTransitionsRoot, `${"a".repeat(64)}.json`),
			'{"protocol":{"id":"wrong","version":"1.0.0"}}\n',
		);
		await assert.rejects(
			collectBackendAuditRecords(context.paths),
			/Backend audit digest is invalid|protocol is invalid/,
		);
		await assert.rejects(
			appendDevLogEntry(context.repoRoot, {
				id: "log-reasoning",
				timestamp: "2026-09-10T11:02:00.000Z",
				traceId: "trace-reasoning",
				category: "error",
				action: "inspect",
				status: "failure",
				summary: "Internal reasoning trace: hidden",
			}, context.stateRoot),
			/contains sensitive text/,
		);
	} finally {
		await context.cleanup();
	}
});

function activeRuntimeRegistry() {
	const build = createQualifiedRuntimeBuild({
		manifest: createRuntimeBuildManifest({
			schemaVersion: "4.0.0",
			domainPlugin: DEFAULT_DOMAIN_PLUGIN_IDENTITY,
			runProtocolVersion: RUN_PROTOCOL.version,
			nodeVersion: process.versions.node,
			nodeExecutablePath: "/qualified/node",
			nodeExecutableDigest: sha256Digest("qualified-node"),
			outerSandboxProfileDigest: sha256Digest("qualified-sandbox"),
			dshSourceCommit: "a".repeat(40),
			dshPackageClosureDigest: sha256Digest("dsh"),
			cordisClosureDigest: sha256Digest("cordis"),
			executablePluginClosureDigest: sha256Digest("plugins"),
			runtimeArtifactDigest: sha256Digest("artifact"),
		}),
		qualificationSuiteDigest: sha256Digest("suite"),
		qualificationEvidenceDigest: sha256Digest("evidence"),
		qualifiedAt: "2026-09-10T10:29:00.000Z",
	});
	let registry = createRuntimeBuildRegistrySnapshot({
		generatedAt: "2026-09-10T10:29:00.000Z",
	});
	registry = qualifyRuntimeBuild({
		registry,
		expectedGeneration: 0,
		build,
		generatedAt: "2026-09-10T10:29:30.000Z",
	});
	return activateRuntimeBuild({
		registry,
		expectedGeneration: 1,
		buildDigest: build.buildDigest,
		generatedAt: "2026-09-10T10:30:00.000Z",
	});
}

function runtimeOperations(context) {
	return createStoredRuntimeOperationsInspectionPort({
		stateRoot: context.stateRoot,
		evidenceStateRoot: context.paths.executionEvidenceRoot,
	});
}

async function retainedReceipt(stateRoot) {
	const request = runRequest("run-observability", "session-observability");
	const initial = await openStoredExecutionLedger({
		stateRoot,
		header: createExecutionLedgerHeader({
			request,
			createdAt: "2026-08-18T10:00:01.000Z",
		}),
	});
	const ledger = await appendStoredExecutionLedger({
		stateRoot,
		runId: request.runId,
		requestDigest: request.requestDigest,
		expectedLedgerDigest: initial.ledgerDigest,
		entry: {
			kind: "output",
			occurredAt: "2026-08-18T10:00:03.000Z",
			modelVisible: false,
			payload: {text: "completed"},
		},
	});
	const content = Buffer.from('{"type":"assistant/message"}\n', "utf8");
	const rawLog = rawLogReference(request, content);
	await retainRunRawLog({stateRoot, reference: rawLog, content});
	const receipt = completedReceipt(request, ledger.ledgerDigest, rawLog);
	await commitStoredRunReceipt({stateRoot, expectedReceiptDigest: null, receipt});
	return {request, receipt};
}
