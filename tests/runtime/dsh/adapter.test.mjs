import assert from "node:assert/strict";
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
import {
	RUN_PROTOCOL,
	createRunRequest,
	createRunSessionLeaseBinding,
} from "../../../src/runtime/contracts.ts";
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

function artifacts(root) {
	return {
		systemPrompt: "CodeWiki deterministic qualification",
		prompt: "Return qualification text.",
		workspacePath: root,
		sessionRoot: join(root, "sessions"),
	};
}

function runRequest(runId, sessionId, projectContextSnapshot = null, resumeLog = null) {
	const optionsDigest = digest("model-options");
	const modelRoute = {
		provider: "codewiki-replay",
		model: "deterministic",
		optionsDigest,
		routeDigest: canonicalJsonDigest({
			provider: "codewiki-replay",
			model: "deterministic",
			optionsDigest,
		}),
	};
	return createRunRequest({
		runId,
		operationId: `operation-${runId}`,
		custody: "backend-owned",
		role: "decision-producer",
		stage: "decision",
		subject: {id: `subject-${runId}`, digest: digest("subject")},
		runtimeBuild: {
			buildDigest: digest("runtime-build"),
			runProtocolVersion: RUN_PROTOCOL.version,
		},
		session: {
			mode: resumeLog ? "resume" : "create",
			continuityKey: `decision:${sessionId}`,
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
		createdAt: "2026-08-17T20:00:00.000Z",
		deadlineAt: "2026-08-17T20:01:00.000Z",
	});
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
