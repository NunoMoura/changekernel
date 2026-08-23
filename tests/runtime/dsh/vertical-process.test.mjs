import assert from "node:assert/strict";
import {mkdtemp, readFile, readdir, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {after, describe, it} from "node:test";

import {buildDshRuntimeCandidate} from "../../../scripts/build-dsh-runtime.mjs";

import {createTestProjectContextSnapshot} from "../../helpers/project-context.mjs";
import {authorizeProjectContextSnapshot} from "../../../src/project-server/project-context/snapshot.ts";
import {createProjectContextStore} from "../../../src/project-server/project-context/store.ts";
import {
	RUN_PROTOCOL,
	createQualifiedRuntimeBuild,
	createRunModelRouteBinding,
	createRunRequest,
	createRunSessionLeaseBinding,
	createRuntimeBuildManifest,
} from "../../../src/runtime/contracts.ts";
import {createStageRunContinuationBinding} from "../../../src/runtime/continuation.ts";
import {
	activateStoredRuntimeBuild,
	bindActiveStoredRuntimeBuild,
	createStoredNodeRuntimeBuildResolver,
	qualifyStoredRuntimeBuild,
} from "../../../src/runtime/builds/store.ts";
import {
	DSH_PROJECT_CONTEXT_TOOL_SET_DIGEST,
} from "../../../src/runtime/dsh/project-context-tools.ts";
import {readDshRuntimeProvenance} from "../../../src/runtime/dsh/provenance.ts";
import {createPrivateProviderBrokerBinding} from "../../../src/runtime/providers/contracts.ts";
import {startPrivateProviderBrokerServer} from "../../../src/runtime/providers/broker-server.ts";
import {
	readRetainedRunRawLog,
	readStoredExecutionLedger,
} from "../../../src/runtime/evidence/store.ts";
import {readStoredRunReceipt} from "../../../src/runtime/receipts/store.ts";
import {
	createNodeRunProcessManager,
} from "../../../src/runtime/processes/node-process-manager.ts";
import {createRuntime} from "../../../src/runtime/runtime.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	sha256Digest,
} from "../../../src/utils/canonical-json.ts";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, "../../..");
const replayFixturePath = resolve(
	testDirectory,
	"fixtures/replay-session.jsonl",
);
const replayFixtureDigest = sha256Digest(await readFile(replayFixturePath));
const replayTurnTwoFixturePath = resolve(
	testDirectory,
	"fixtures/replay-session-turn-2.jsonl",
);
const replayTurnTwoFixtureDigest = sha256Digest(await readFile(replayTurnTwoFixturePath));
const projectContextReplayFixturePath = resolve(
	testDirectory,
	"fixtures/replay-project-context.jsonl",
);
const projectContextReplayFixtureDigest = sha256Digest(
	await readFile(projectContextReplayFixturePath),
);
const packageLockPath = resolve(repositoryRoot, "package-lock.json");
const temporaryDirectories = [];
const candidateRoot = await mkdtemp(join(tmpdir(), "codewiki-dsh-candidate-"));
temporaryDirectories.push(candidateRoot);
const candidate = await buildDshRuntimeCandidate({
	outfile: join(candidateRoot, "dsh-run-process.mjs"),
});
const candidateBytes = await readFile(candidate.artifactPath);
const provenance = readDshRuntimeProvenance(packageLockPath);
const qualifiedBuild = createQualifiedRuntimeBuild({
	manifest: createRuntimeBuildManifest({
		schemaVersion: "1.0.0",
		runProtocolVersion: RUN_PROTOCOL.version,
		nodeVersion: process.version.slice(1),
		dshSourceCommit: provenance.reviewedSource.commit,
		dshPackageClosureDigest: provenance.dshPackageClosureDigest,
		cordisClosureDigest: provenance.cordisClosureDigest,
		runtimePluginClosureDigest: digest("runtime-plugins"),
		modelAdapterClosureDigest: digest("replay-model-adapter"),
		delegateAdapterClosureDigest: digest("no-delegates"),
		runtimeArtifactDigest: sha256Digest(candidateBytes),
	}),
	qualificationSuiteDigest: digest("dsh-qualification-suite"),
	qualificationEvidenceDigest: digest("dsh-qualification-evidence"),
	qualifiedAt: "2026-08-17T20:00:00.000Z",
});

after(async () => {
	await Promise.all(
		temporaryDirectories.map((path) => rm(path, {recursive: true, force: true})),
	);
});

describe("DSH Runtime vertical process", () => {
	it("executes Run Request through authenticated Run Process and returns Runtime-authored receipt", async () => {
		const fixture = await runtimeFixture("complete");
		assert.equal(fixture.binding.buildDigest, qualifiedBuild.buildDigest);
		assert.ok(
			candidate.inputPaths.some((path) => path.includes("dsh-agent-loop")),
		);
		assert.doesNotMatch(
			candidateBytes.toString("utf8"),
			/\bfrom\s+["']@deepseek-ai\//,
		);
		const runtime = createRuntime({
			processManager: fixture.processManager,
			stateRoot: fixture.stateRoot,
			now: () => new Date(Date.parse(fixture.request.createdAt) + 100).toISOString(),
		});
		try {
			const handle = await runtime.start(fixture.request);
			const receipt = await runtime.waitForReceipt(handle);
			const quiescence = await runtime.waitForQuiescence(handle);
			const events = runtime.readEvents(handle);

			assert.equal(receipt.outcome, "completed");
			assert.equal(receipt.runtimeBuild.buildDigest, fixture.buildDigest);
			assert.equal(receipt.requestDigest, fixture.request.requestDigest);
			assert.equal(receipt.sessionId, fixture.request.session.sessionId);
			assert.equal(receipt.finalEventSequence, events.at(-1).sequence);
			assert.equal(quiescence.finalEventSequence, events.at(-1).sequence);
			assert.deepEqual(
				events.map(({kind}) => kind).filter((kind, index, all) =>
					index === 0 || kind !== all[index - 1]),
				["accepted", "process-started", "session-event", "quiescent"],
			);
			assert.ok(receipt.executionLedgerDigest);
			assert.equal(
				receipt.outputDigest,
				canonicalJsonDigest({text: "DSH vertical slice complete."}),
			);
			assert.ok(receipt.usageDigest);
			assert.ok(receipt.quiescenceDigest);
			assert.deepEqual(receipt.operationalGaps, []);
			assert.deepEqual(receipt.custodyGaps, []);
			const rawLogPath = await onlyJsonlFile(fixture.sessionRoot);
			assert.equal(receipt.rawLog.digest, sha256Digest(await readFile(rawLogPath)));
			assert.match(await readFile(rawLogPath, "utf8"), /DSH vertical slice complete\./);
			assert.equal(
				(await readStoredExecutionLedger({
					stateRoot: fixture.stateRoot,
					runId: receipt.runId,
					requestDigest: receipt.requestDigest,
				})).ledgerDigest,
				receipt.executionLedgerDigest,
			);
			assert.equal(
				(await readStoredRunReceipt({
					stateRoot: fixture.stateRoot,
					runId: receipt.runId,
					requestDigest: receipt.requestDigest,
				})).receiptDigest,
				receipt.receiptDigest,
			);
			assert.deepEqual(
				await readRetainedRunRawLog({
					stateRoot: fixture.stateRoot,
					reference: receipt.rawLog,
				}),
				await readFile(rawLogPath),
			);
		} finally {
			await runtime.shutdown();
		}
	});

	it("executes a credential-free live broker through the isolated Run Process", async () => {
		const modelRoute = processModelRoute("mock-provider", "mock-model", "mock-live");
		const runId = "run-dsh-process-private-broker";
		const broker = await startPrivateProviderBrokerServer({
			binding: createPrivateProviderBrokerBinding({
				brokerId: "vertical-private-broker",
				implementationId: "codewiki-mock-provider",
				implementationVersion: "1.0.0",
				implementationDigest: digest("vertical-broker-implementation"),
				configurationDigest: digest("vertical-broker-configuration"),
				mode: "direct",
				maxRetries: 0,
			}),
			capabilityId: "capability-vertical-private-broker",
			capabilityToken: "v".repeat(64),
			expiresAt: new Date(Date.now() + 60_000).toISOString(),
			runId,
			routeDigest: modelRoute.routeDigest,
			transport: {
				open: async () => ({
					selectedProvider: "mock-provider",
					selectedModel: "mock-model",
					providerRequestId: "provider-request-vertical",
					chunks: liveProcessChunks(),
				}),
			},
		});
		const fixture = await runtimeFixture("private-broker", {
			modelRoute,
			modelAdapter: {kind: "private-broker", access: broker.access},
		});
		const runtime = createRuntime({
			processManager: fixture.processManager,
			stateRoot: fixture.stateRoot,
			now: () => new Date(Date.parse(fixture.request.createdAt) + 100).toISOString(),
		});
		try {
			const handle = await runtime.start(fixture.request);
			const receipt = await runtime.waitForReceipt(handle);
			const ledger = await readStoredExecutionLedger({
				stateRoot: fixture.stateRoot,
				runId: receipt.runId,
				requestDigest: receipt.requestDigest,
			});
			assert.equal(receipt.outcome, "completed");
			assert.equal(
				receipt.outputDigest,
				canonicalJsonDigest({text: "DSH private broker process complete."}),
			);
			assert.equal(broker.receipts()[0].providerRequestId, "provider-request-vertical");
			assert.equal(
				ledger.entries.some((entry) =>
					entry.kind === "provider-call" &&
					entry.payload.receiptDigest === broker.receipts()[0].receiptDigest
				),
				true,
			);
		} finally {
			await runtime.shutdown();
			await broker.close();
		}
	});

	it("recovers durable receipt authority without launching the same Run twice", async () => {
		const fixture = await runtimeFixture("receipt-recovery");
		const runtime = createRuntime({
			processManager: fixture.processManager,
			stateRoot: fixture.stateRoot,
			now: () => new Date(Date.parse(fixture.request.createdAt) + 100).toISOString(),
		});
		const handle = await runtime.start(fixture.request);
		const receipt = await runtime.waitForReceipt(handle);
		await runtime.shutdown();

		const recovered = createRuntime({
			processManager: fixture.processManager,
			stateRoot: fixture.stateRoot,
			now: () => new Date(Date.parse(fixture.request.createdAt) + 100).toISOString(),
		});
		try {
			await assert.rejects(
				recovered.start(fixture.request),
				/already has a committed Receipt/,
			);
			assert.equal(
				(await readStoredRunReceipt({
					stateRoot: fixture.stateRoot,
					runId: receipt.runId,
					requestDigest: receipt.requestDigest,
				})).receiptDigest,
				receipt.receiptDigest,
			);
		} finally {
			await recovered.shutdown();
		}
	});

	it("resumes exact Session head after Runtime and Run Process restart", async () => {
		const fixture = await runtimeFixture("restart");
		const firstRuntime = createRuntime({
			processManager: fixture.processManager,
			stateRoot: fixture.stateRoot,
			now: () => new Date(Date.parse(fixture.request.createdAt) + 100).toISOString(),
		});
		const firstHandle = await firstRuntime.start(fixture.request);
		const firstReceipt = await firstRuntime.waitForReceipt(firstHandle);
		await firstRuntime.shutdown();

		const secondManifest = Object.freeze({
			...fixture.manifest,
			modelAdapter: {
				kind: "replay",
				fixturePath: replayTurnTwoFixturePath,
				fixtureDigest: replayTurnTwoFixtureDigest,
			},
		});
		await writeFile(fixture.manifestPath, canonicalJson(secondManifest));
		const secondRequest = runRequest({
			runId: "run-dsh-process-restart-2",
			sessionId: fixture.request.session.sessionId,
			buildDigest: fixture.buildDigest,
			materialDigest: canonicalJsonDigest(secondManifest),
			projectContextSnapshot: null,
			resumeLog: firstReceipt.rawLog,
		});
		const secondRuntime = createRuntime({
			processManager: fixture.processManager,
			stateRoot: fixture.stateRoot,
			now: () => new Date(Date.parse(secondRequest.createdAt) + 100).toISOString(),
		});
		try {
			const secondHandle = await secondRuntime.start(secondRequest);
			const secondReceipt = await secondRuntime.waitForReceipt(secondHandle);
			assert.equal(secondRequest.session.mode, "resume");
			assert.equal(secondRequest.session.expectedHead, firstReceipt.resultingSessionHead);
			assert.equal(secondReceipt.expectedSessionHead, firstReceipt.resultingSessionHead);
			assert.notEqual(secondReceipt.resultingSessionHead, firstReceipt.resultingSessionHead);
			assert.equal(secondReceipt.outcome, "completed");
			assert.equal(
				secondReceipt.outputDigest,
				canonicalJsonDigest({text: "DSH resumed process complete."}),
			);
		} finally {
			await secondRuntime.shutdown();
		}
	});

	it("transports immutable Project Context into admitted tools across authenticated process boundary", async () => {
		const fixture = await runtimeFixture("context", {admitted: true});
		const runtime = createRuntime({
			processManager: fixture.processManager,
			stateRoot: fixture.stateRoot,
			now: () => new Date(Date.parse(fixture.request.createdAt) + 100).toISOString(),
		});
		try {
			const handle = await runtime.start(fixture.request);
			const receipt = await runtime.waitForReceipt(handle);
			assert.equal(receipt.outcome, "completed");
			assert.equal(
				receipt.outputDigest,
				canonicalJsonDigest({text: "Project Context query complete."}),
			);
			assert.ok(receipt.executionLedgerDigest);
			assert.deepEqual(receipt.operationalGaps, []);
			const rawLogPath = await onlyJsonlFile(fixture.sessionRoot);
			const rawLog = await readFile(rawLogPath, "utf8");
			assert.match(rawLog, /query_project_knowledge/);
			assert.match(rawLog, /Bounded execution mechanics/);
			assert.match(rawLog, /Project Context query complete\./);
		} finally {
			await runtime.shutdown();
		}
	});

	it("creates no receipt when bound static input bytes are changed", async () => {
		const fixture = await runtimeFixture("tampered");
		await writeFile(
			fixture.manifestPath,
			canonicalJson({...fixture.manifest, prompt: "tampered"}),
		);
		const runtime = createRuntime({
			processManager: fixture.processManager,
			stateRoot: fixture.stateRoot,
			now: () => new Date(Date.parse(fixture.request.createdAt) + 100).toISOString(),
		});
		try {
			const handle = await runtime.start(fixture.request);
			await assert.rejects(
				runtime.waitForReceipt(handle),
				/Run Process event (?:channel closed before another frame|pipe ended)/,
			);
		} finally {
			await runtime.shutdown();
		}
	});
});

async function runtimeFixture(suffix, options = {}) {
	const root = await mkdtemp(join(tmpdir(), `codewiki-dsh-process-${suffix}-`));
	temporaryDirectories.push(root);
	const stateRoot = join(root, "runtime-state");
	const sessionRoot = join(root, "sessions");
	await qualifyStoredRuntimeBuild({
		stateRoot,
		expectedGeneration: 0,
		build: qualifiedBuild,
		artifactPath: candidate.artifactPath,
		generatedAt: "2026-08-17T20:01:00.000Z",
	});
	await activateStoredRuntimeBuild({
		stateRoot,
		expectedGeneration: 1,
		buildDigest: qualifiedBuild.buildDigest,
		generatedAt: "2026-08-17T20:02:00.000Z",
	});
	const binding = await bindActiveStoredRuntimeBuild({stateRoot});
	const runId = `run-dsh-process-${suffix}`;
	const projectContextSnapshot = options.admitted ? processContextSnapshot(runId) : null;
	const contextStore = await createProjectContextStore(join(root, "project-context"));
	const projectContextMount = projectContextSnapshot
		? await contextStore.mountBinding(projectContextSnapshot)
		: null;
	const authorizationTime = Date.now();
	const projectContextAuthorization = projectContextSnapshot
		? authorizeProjectContextSnapshot({
			snapshot: projectContextSnapshot,
			runId,
			actorDigest: digest("actor"),
			authorizedAt: new Date(authorizationTime - 1_000).toISOString(),
			expiresAt: new Date(authorizationTime + 60_000).toISOString(),
		})
		: null;
	const selectedReplayFixturePath = options.admitted
		? projectContextReplayFixturePath
		: replayFixturePath;
	const selectedReplayFixtureDigest = options.admitted
		? projectContextReplayFixtureDigest
		: replayFixtureDigest;
	const manifest = Object.freeze({
		schemaVersion: "3.0.0",
		runtimeBuildDigest: binding.buildDigest,
		runProtocolVersion: binding.runProtocolVersion,
		systemPrompt: "CodeWiki deterministic qualification",
		prompt: "Return qualification text.",
		workspacePath: root,
		sessionRoot,
		projectContextMount,
		projectContextAuthorization,
		modelAdapter: options.modelAdapter || {
			kind: "replay",
			fixturePath: selectedReplayFixturePath,
			fixtureDigest: selectedReplayFixtureDigest,
		},
	});
	const manifestPath = join(root, "input-manifest.json");
	await writeFile(manifestPath, canonicalJson(manifest));
	const request = runRequest({
		runId,
		sessionId: `session-dsh-process-${suffix}`,
		buildDigest: binding.buildDigest,
		materialDigest: canonicalJsonDigest(manifest),
		projectContextSnapshot,
		modelRoute: options.modelRoute,
	});
	const storedResolver = createStoredNodeRuntimeBuildResolver({stateRoot});
	const processManager = createNodeRunProcessManager({
		resolveArtifact: async (challenge) => {
			const artifact = await storedResolver(challenge);
			return Object.freeze({
				...artifact,
				args: Object.freeze([...artifact.args, manifestPath]),
			});
		},
	});
	return {
		root,
		stateRoot,
		sessionRoot,
		buildDigest: binding.buildDigest,
		binding,
		manifest,
		manifestPath,
		request,
		processManager,
	};
}

function runRequest({
	runId,
	sessionId,
	buildDigest,
	materialDigest,
	projectContextSnapshot,
	resumeLog = null,
	modelRoute = processModelRoute(),
}) {
	const createdAt = new Date(Date.now() - 1_000).toISOString();
	const deadlineAt = new Date(Date.now() + 30_000).toISOString();
	return createRunRequest({
		runId,
		operationId: `operation-${runId}`,
		custody: "backend-owned",
		role: "decision-producer",
		stage: "decision",
		subject: {id: `subject-${runId}`, digest: digest("subject")},
		runtimeBuild: {buildDigest, runProtocolVersion: RUN_PROTOCOL.version},
		session: {
			mode: resumeLog ? "resume" : "create",
			continuityKey: `decision:${sessionId}`,
			sessionId,
			expectedHead: resumeLog?.digest ?? "absent",
			lease: createRunSessionLeaseBinding({
				leaseId: `lease-${runId}`,
				generation: resumeLog ? 2 : 1,
				runId,
				acquiredAt: createdAt,
				expiresAt: new Date(Date.parse(deadlineAt) + 1_000).toISOString(),
			}),
			resumeLog,
		},
		inputs: {
			projectContextSnapshotDigest: projectContextSnapshot?.snapshotDigest ?? digest("project-context"),
			materialDigest,
			feedbackDigest: null,
			systemPromptDigest: canonicalJsonDigest("CodeWiki deterministic qualification"),
			promptDigest: canonicalJsonDigest("Return qualification text."),
			producerSkillSetDigest: null,
			toolMode: projectContextSnapshot ? "admitted" : "none",
			toolSetDigest: projectContextSnapshot
				? DSH_PROJECT_CONTEXT_TOOL_SET_DIGEST
				: digest("no-tools"),
			modelRoute,
		},
		continuation: createStageRunContinuationBinding({
			stage: "decision",
			objectiveDigest: canonicalJsonDigest("Return qualification text."),
			maxRounds: 3,
			semanticStateDigest: materialDigest,
			authorityPromotionDigest: canonicalJsonDigest({runId, resumeHead: resumeLog?.digest ?? null}),
			unresolvedObligationsDigest: digest("decision-obligations"),
			feedbackDigest: null,
			contextWindowTokens: 4_096,
			pressureThresholdTokens: 3_500,
			expectedNextRunInputTokens: 1_024,
			toolResultReserveTokens: 256,
			candidateOutputReserveTokens: 64,
			retainRecentTokens: 1,
			maxSummaryCharacters: 2_000,
		}),
		workspace: {
			kind: "immutable",
			repositorySnapshotDigest: digest("repository"),
		},
		budget: {
			timeoutMs: 30_000,
			maxModelRequests: projectContextSnapshot ? 2 : 1,
			maxToolCalls: projectContextSnapshot ? 2 : 0,
			maxInputTokens: 1_024,
			maxOutputTokens: 64,
		},
		createdAt,
		deadlineAt,
	});
}

async function* liveProcessChunks() {
	yield {type: "block-start", index: 0, blockType: "text"};
	yield {type: "text-delta", index: 0, text: "DSH private broker process complete."};
	yield {
		type: "block-end",
		index: 0,
		block: {type: "text", text: "DSH private broker process complete."},
	};
	yield {type: "usage", usage: {inputTokens: 12, outputTokens: 7}};
	yield {type: "finish", reason: {kind: "stop"}};
}

function processModelRoute(
	provider = "codewiki-replay",
	model = "deterministic",
	routeId = "codewiki-replay",
) {
	return createRunModelRouteBinding({
		routeId,
		provider,
		model,
		reasoningEffort: null,
		contextWindowTokens: 128_000,
		timeoutMs: 30_000,
		policyDigest: digest("model-policy"),
		policyAttempt: 0,
		modelAssignmentDigest: digest("model-assignment"),
		optionsDigest: digest("model-options"),
	});
}

function processContextSnapshot(runId) {
	return createTestProjectContextSnapshot({
		subjectId: `subject-${runId}`,
		subjectDigest: digest("subject"),
	});
}

async function onlyJsonlFile(root) {
	const entries = await readdir(root, {recursive: true, withFileTypes: true});
	const files = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
		.map((entry) => join(entry.parentPath, entry.name));
	assert.equal(files.length, 1);
	return files[0];
}

function digest(value) {
	return sha256Digest(value);
}
