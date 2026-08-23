import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync, realpathSync} from "node:fs";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {after, describe, it} from "node:test";

import {createTestProjectContextSnapshot} from "../../helpers/project-context.mjs";
import {runDshAgent} from "../../../src/runtime/dsh/adapter.ts";
import {
	DSH_PROJECT_CONTEXT_TOOL_SET_DIGEST,
} from "../../../src/runtime/dsh/project-context-tools.ts";
import {createDshReplayModelInstaller} from "../../../src/runtime/dsh/replay.ts";
import {BUBBLEWRAP_SANDBOX_SCHEMA_VERSION} from "../../../src/runtime/sandbox/bubblewrap.ts";
import {
	RUN_PROTOCOL,
	createRunModelRouteBinding,
	createRunRequest,
	createRunSessionLeaseBinding,
} from "../../../src/runtime/contracts.ts";
import {
	COMPACTION_SUMMARY_PROTOCOL,
	createStageRunContinuationBinding,
} from "../../../src/runtime/continuation.ts";
import {
	canonicalJsonDigest,
	sha256Digest,
} from "../../../src/utils/canonical-json.ts";

const fixturePath = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures/replay-session.jsonl",
);
const fixtureDigest = sha256Digest(await readFile(fixturePath));
const turnTwoFixturePath = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures/replay-session-turn-2.jsonl",
);
const turnTwoFixtureDigest = sha256Digest(await readFile(turnTwoFixturePath));
const projectContextFixturePath = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures/replay-project-context.jsonl",
);
const projectContextFixtureDigest = sha256Digest(await readFile(projectContextFixturePath));
const codeModeFixturePath = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures/replay-code-mode.jsonl",
);
const codeModeFixtureDigest = sha256Digest(await readFile(codeModeFixturePath));
const temporaryDirectories = [];

after(async () => {
	await Promise.all(
		temporaryDirectories.map((path) => rm(path, {recursive: true, force: true})),
	);
});

describe("CodeWiki DSH Adapter", () => {
	it("runs one isolated DSH Agent Session with replay and persists its exact JSONL", async () => {
		const root = await temporaryRoot();
		const request = runRequest("run-dsh-1", "session-dsh-1");
		const result = await runDshAgent({
			request,
			artifacts: artifacts(root),
			installModelAdapter: createDshReplayModelInstaller({
				fixturePath,
				fixtureDigest,
			}),
			now: sequenceClock(
				"2026-08-17T20:00:01.000Z",
				"2026-08-17T20:00:02.000Z",
			),
		});

		assert.equal(result.outcome, "completed");
		assert.equal(result.output, "DSH vertical slice complete.");
		assert.equal(
			result.outputDigest,
			canonicalJsonDigest({text: "DSH vertical slice complete."}),
		);
		assert.ok(result.usageDigest);
		assert.match(result.executionLedgerDigest, /^sha256:[0-9a-f]{64}$/);
		assert.equal(result.rawLog.sessionId, "session-dsh-1");
		assert.equal(result.rawLog.runtimeBuildDigest, request.runtimeBuild.buildDigest);
		assert.equal(result.rawLog.digest, sha256Digest(await readFile(result.rawLogPath)));
		assert.ok(result.sessionEvents.some((event) => event.type === "request/header"));
		assert.ok(result.sessionEvents.some((event) => event.type === "assistant/message"));
		assert.equal(
			result.sessionEvents.some((event) => event.type === "tool/call"),
			false,
		);
		const rawLog = await readFile(result.rawLogPath, "utf8");
		assert.match(rawLog, /"id":"session-dsh-1"/);
		assert.match(rawLog, /DSH vertical slice complete\./);
	});

	it("resumes one exact persisted Session head in a fresh adapter context", async () => {
		const root = await temporaryRoot();
		const first = await runDshAgent({
			request: runRequest("run-dsh-resume-1", "session-dsh-resume"),
			artifacts: artifacts(root),
			installModelAdapter: createDshReplayModelInstaller({fixturePath, fixtureDigest}),
		});
		const secondRequest = runRequest(
			"run-dsh-resume-2",
			"session-dsh-resume",
			null,
			first.rawLog,
		);
		const second = await runDshAgent({
			request: secondRequest,
			artifacts: artifacts(root),
			installModelAdapter: createDshReplayModelInstaller({
				fixturePath: turnTwoFixturePath,
				fixtureDigest: turnTwoFixtureDigest,
			}),
		});
		assert.equal(secondRequest.session.expectedHead, first.rawLog.digest);
		assert.equal(second.output, "DSH resumed process complete.");
		assert.notEqual(second.rawLog.digest, first.rawLog.digest);
		const retained = (await readFile(second.rawLogPath, "utf8"))
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));
		assert.deepEqual(
			retained
				.filter((event) => event.type === "goal/change")
				.map((event) => event.data.operation),
			["create", "pause", "resume", "pause"],
		);
		assert.deepEqual(
			retained
				.filter((event) => event.type === "user/message" && event.data.source.kind === "goal")
				.map((event) => event.data.source.round),
			[1, 2],
		);
		assert.equal(
			retained.some((event) =>
				event.type === "goal/change" && event.data.operation === "complete"),
			false,
		);
	});

	it("rehydrates Gate feedback through controlled restart for every producer stage", async () => {
		const stages = [
			["decision", "decision-producer"],
			["planning", "planning-producer"],
			["implementation", "implementation-worker"],
			["review", "review-producer"],
		];
		for (const [stage, role] of stages) {
			const root = await temporaryRoot();
			const sessionId = `session-dsh-${stage}`;
			const initialPrompt = `Produce the ${stage} Candidate.`;
			const first = await runDshAgent({
				request: runRequest(`run-${stage}-1`, sessionId, null, null, {
					prompt: initialPrompt,
					stage,
					role,
				}),
				artifacts: artifacts(root, initialPrompt),
				installModelAdapter: createDshReplayModelInstaller({fixturePath, fixtureDigest}),
			});
			const feedbackDigest = digest(`${stage}-gate-feedback`);
			const feedbackPrompt = `Revise the ${stage} Candidate from canonical Gate feedback.`;
			const request = runRequest(`run-${stage}-2`, sessionId, null, first.rawLog, {
				prompt: feedbackPrompt,
				stage,
				role,
				feedbackDigest,
			});
			const second = await runDshAgent({
				request,
				artifacts: artifacts(root, feedbackPrompt),
				installModelAdapter: createDshReplayModelInstaller({
					fixturePath: turnTwoFixturePath,
					fixtureDigest: turnTwoFixtureDigest,
				}),
			});
			assert.equal(request.continuation.stage, stage);
			assert.equal(request.continuation.rehydration.feedbackDigest, feedbackDigest);
			assert.equal(second.outcome, "completed");
			const raw = await readFile(second.rawLogPath, "utf8");
			assert.match(raw, /\"operation\":\"pause\"/);
			assert.doesNotMatch(raw, /\"operation\":\"complete\"/);
		}
	});

	it("compacts pressured continuation without deleting exact retained history", async () => {
		const root = await temporaryRoot();
		const longPrompt = "Preserve this unresolved observation until canonical admission. ".repeat(500);
		const first = await runDshAgent({
			request: runRequest(
				"run-dsh-compact-1",
				"session-dsh-compact",
				null,
				null,
				{prompt: longPrompt},
			),
			artifacts: artifacts(root, longPrompt),
			installModelAdapter: createDshReplayModelInstaller({fixturePath, fixtureDigest}),
		});
		const nextPrompt = "Continue from canonical state and return qualification text.";
		const second = await runDshAgent({
			request: runRequest(
				"run-dsh-compact-2",
				"session-dsh-compact",
				null,
				first.rawLog,
				{prompt: nextPrompt},
			),
			artifacts: artifacts(root, nextPrompt),
			installModelAdapter: createDshReplayModelInstaller({
				fixturePath: turnTwoFixturePath,
				fixtureDigest: turnTwoFixtureDigest,
			}),
		});
		const observation = second.executionLedger.entries.find(
			(entry) => entry.kind === "compaction",
		)?.payload;
		assert.equal(observation?.protocol.name, COMPACTION_SUMMARY_PROTOCOL.name);
		assert.equal(observation?.outcome, "compacted");
		assert.deepEqual(observation.pruned, []);
		assert.equal(observation.prunedCharacters, 0);
		assert.ok(observation.shadowedSeqs.length > 0);
		assert.match(await readFile(second.rawLogPath, "utf8"), /Preserve this unresolved observation/);
		assert.ok(second.sessionEvents.some((event) => event.type === "compaction/summary"));
	});

	it("creates no shared DSH Agent Session state across concurrent Runs", async () => {
		const [leftRoot, rightRoot] = await Promise.all([
			temporaryRoot(),
			temporaryRoot(),
		]);
		const installer = () =>
			createDshReplayModelInstaller({fixturePath, fixtureDigest});
		const [left, right] = await Promise.all([
			runDshAgent({
				request: runRequest("run-dsh-left", "session-dsh-left"),
				artifacts: artifacts(leftRoot),
				installModelAdapter: installer(),
			}),
			runDshAgent({
				request: runRequest("run-dsh-right", "session-dsh-right"),
				artifacts: artifacts(rightRoot),
				installModelAdapter: installer(),
			}),
		]);

		assert.notEqual(left.rawLogPath, right.rawLogPath);
		assert.notEqual(left.rawLog.sessionId, right.rawLog.sessionId);
		assert.notEqual(left.executionLedgerDigest, right.executionLedgerDigest);
		assert.equal(left.output, right.output);
	});

	it("executes admitted Project Context tools and binds exact queries into its ledger", async () => {
		const root = await temporaryRoot();
		const projectContextSnapshot = contextSnapshot();
		const request = runRequest(
			"run-dsh-context",
			"session-dsh-context",
			projectContextSnapshot,
		);
		const result = await runDshAgent({
			request,
			artifacts: artifacts(root),
			projectContextSnapshot,
			installModelAdapter: createDshReplayModelInstaller({
				fixturePath: projectContextFixturePath,
				fixtureDigest: projectContextFixtureDigest,
			}),
		});

		assert.equal(result.outcome, "completed");
		assert.equal(result.output, "Project Context query complete.");
		assert.ok(result.sessionEvents.some((event) => event.type === "tool/call"));
		assert.ok(result.sessionEvents.some((event) => event.type === "tool/result"));
		assert.equal(result.executionLedgerDigest, result.executionLedger.ledgerDigest);
		assert.deepEqual(
			result.executionLedger.entries.map(({kind}) => kind),
			[
				"static-input",
				"tool-call",
				"project-context-query",
				"tool-result",
				"model-request",
				"model-request",
				"model-output",
				"model-output",
				"usage",
				"output",
			],
		);
		const queryEntry = result.executionLedger.entries.find(
			({kind}) => kind === "project-context-query",
		);
		assert.deepEqual(queryEntry.payload.items.map(({id}) => id), ["runtime"]);
		assert.equal(queryEntry.payload.coverage, "complete");
	});

	it("executes typed Project Context bindings through secure Code Mode", async () => {
		const root = await temporaryRoot();
		const projectContextSnapshot = contextSnapshot();
		const codeMode = liveCodeMode();
		const result = await runDshAgent({
			request: runRequest(
				"run-dsh-context",
				"session-dsh-code-mode",
				projectContextSnapshot,
			),
			artifacts: artifacts(root),
			projectContextSnapshot,
			codeMode,
			installModelAdapter: createDshReplayModelInstaller({
				fixturePath: codeModeFixturePath,
				fixtureDigest: codeModeFixtureDigest,
			}),
		});

		assert.equal(result.outcome, "completed");
		assert.equal(result.output, "Secure Code Mode query complete.");
		const rawLog = await readFile(result.rawLogPath, "utf8");
		const eventTypes = result.sessionEvents.map(({type}) => type);
		assert.ok(eventTypes.includes("tool/code-dispatch-start"), rawLog);
		assert.ok(eventTypes.includes("tool/code-dispatch"), rawLog);
		assert.ok(result.executionLedger.entries.some(({kind}) => kind === "project-context-query"));
		const staticInput = result.executionLedger.entries.find(({kind}) => kind === "static-input");
		assert.equal(staticInput.payload.codeMode.configDigest, canonicalJsonDigest(codeMode));
		assert.equal(
			staticInput.payload.codeMode.sandboxProfileDigest,
			canonicalJsonDigest(codeMode.runtime.sandbox),
		);
		assert.match(rawLog, /\"name\":\"run_code\"/);
		assert.match(rawLog, /first.*runtime/);
	});

	it("rejects model-visible bytes that do not match the Run Request", async () => {
		const root = await temporaryRoot();
		await assert.rejects(
			runDshAgent({
				request: runRequest("run-dsh-tampered", "session-dsh-tampered"),
				artifacts: {...artifacts(root), prompt: "tampered"},
				installModelAdapter: createDshReplayModelInstaller({
					fixturePath,
					fixtureDigest,
				}),
			}),
			/DSH prompt does not match its Run Request digest/,
		);
	});
});

async function temporaryRoot() {
	const path = await mkdtemp(join(tmpdir(), "codewiki-dsh-adapter-"));
	temporaryDirectories.push(path);
	return path;
}

function artifacts(root, prompt = "Return qualification text.") {
	return {
		systemPrompt: "CodeWiki deterministic qualification",
		prompt,
		workspacePath: root,
		sessionRoot: join(root, "sessions"),
	};
}

function runRequest(
	runId,
	sessionId,
	projectContextSnapshot = null,
	resumeLog = null,
	settings = {},
) {
	const prompt = settings.prompt ?? "Return qualification text.";
	const stage = settings.stage ?? "decision";
	const role = settings.role ?? (
		stage === "implementation" ? "implementation-worker" : `${stage}-producer`
	);
	const feedbackDigest = settings.feedbackDigest ?? null;
	const modelRoute = createRunModelRouteBinding({
		routeId: "codewiki-replay",
		provider: "codewiki-replay",
		model: "deterministic",
		reasoningEffort: null,
		contextWindowTokens: 128_000,
		timeoutMs: 30_000,
		policyDigest: digest("model-policy"),
		policyAttempt: 0,
		modelAssignmentDigest: digest("model-assignment"),
		optionsDigest: digest("model-options"),
	});
	return createRunRequest({
		runId,
		operationId: `operation-${runId}`,
		custody: "backend-owned",
		role,
		stage,
		subject: {id: `subject-${runId}`, digest: digest("subject")},
		runtimeBuild: {
			buildDigest: digest("runtime-build"),
			runProtocolVersion: RUN_PROTOCOL.version,
		},
		session: {
			mode: resumeLog ? "resume" : "create",
			continuityKey: `${stage}:${sessionId}`,
			sessionId,
			expectedHead: resumeLog?.digest ?? "absent",
			lease: createRunSessionLeaseBinding({
				leaseId: `lease-${runId}`,
				generation: resumeLog ? 2 : 1,
				runId,
				acquiredAt: "2026-08-17T20:00:00.000Z",
				expiresAt: "2026-08-17T20:02:00.000Z",
			}),
			resumeLog,
		},
		inputs: {
			projectContextSnapshotDigest: projectContextSnapshot?.snapshotDigest ?? digest("project-context"),
			materialDigest: digest("static-inputs"),
			feedbackDigest,
			systemPromptDigest: canonicalJsonDigest("CodeWiki deterministic qualification"),
			promptDigest: canonicalJsonDigest(prompt),
			producerSkillSetDigest: null,
			toolMode: projectContextSnapshot ? "admitted" : "none",
			toolSetDigest: projectContextSnapshot
				? DSH_PROJECT_CONTEXT_TOOL_SET_DIGEST
				: digest("no-tools"),
			modelRoute,
		},
		continuation: createStageRunContinuationBinding({
			stage,
			objectiveDigest: canonicalJsonDigest(prompt),
			maxRounds: 3,
			semanticStateDigest: digest("static-inputs"),
			authorityPromotionDigest: canonicalJsonDigest({runId, resumeHead: resumeLog?.digest ?? null}),
			unresolvedObligationsDigest: digest(`${stage}-obligations`),
			feedbackDigest,
			contextWindowTokens: 4_096,
			pressureThresholdTokens: 3_500,
			expectedNextRunInputTokens: 1_024,
			toolResultReserveTokens: 256,
			candidateOutputReserveTokens: 64,
			retainRecentTokens: 1,
			maxSummaryCharacters: 2_000,
		}),
		workspace: role === "implementation-worker"
			? {
					kind: "runtime-workbench",
					repositorySnapshotDigest: digest("repository"),
					assignmentId: `assignment-${sessionId}`,
					workbenchRef: `workbench-${sessionId}`,
				}
			: {
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
		createdAt: "2026-08-17T20:00:00.000Z",
		deadlineAt: "2026-08-17T20:01:00.000Z",
	});
}

function liveCodeMode() {
	const bubblewrap = realpathSync("/usr/bin/bwrap");
	const prlimit = realpathSync("/usr/bin/prlimit");
	const node = realpathSync(process.execPath);
	return {
		maxParallelSubCalls: 2,
		runtime: {
			sandbox: {
				schemaVersion: BUBBLEWRAP_SANDBOX_SCHEMA_VERSION,
				bubblewrap: {
					path: bubblewrap,
					version: execFileSync(bubblewrap, ["--version"], {encoding: "utf8", env: {}}).trim(),
					digest: sha256Digest(readFileSync(bubblewrap)),
				},
				prlimit: {
					path: prlimit,
					version: execFileSync(prlimit, ["--version"], {encoding: "utf8", env: {}}).split("\n", 1)[0].trim(),
					digest: sha256Digest(readFileSync(prlimit)),
				},
				systemReadOnlyPaths: ["/usr", "/lib", "/lib64"],
				limits: {
					addressSpaceBytes: 8 * 1024 * 1024 * 1024,
					cpuSeconds: 3,
					openFiles: 128,
					processes: 512,
					fileBytes: 1024 * 1024,
				},
			},
			node: {path: node, version: process.version, digest: sha256Digest(readFileSync(node))},
			maxProgramBytes: 64 * 1024,
			maxFrameBytes: 1024 * 1024,
			maxOutputBytes: 64 * 1024,
			maxBindingCalls: 16,
			maxBindingBytes: 64 * 1024,
			maxWallMs: 2_000,
			maxOldGenerationSizeMb: 128,
		},
	};
}

function contextSnapshot() {
	return createTestProjectContextSnapshot({
		subjectId: "subject-run-dsh-context",
		subjectDigest: digest("subject"),
	});
}

function digest(value) {
	return sha256Digest(value);
}

function sequenceClock(...values) {
	let index = 0;
	return () => values[Math.min(index++, values.length - 1)];
}
