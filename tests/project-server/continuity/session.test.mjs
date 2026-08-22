import assert from "node:assert/strict";
import {mkdtemp, readFile, readdir, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {describe, it} from "node:test";

import {
	acquireSessionLease,
	commitSessionRunReceipt,
	createSessionContinuity,
	expireSessionLease,
	requestSessionLeaseCancellation,
	rolloverSessionContinuity,
} from "../../../src/project-server/sessions/continuity.ts";
import {
	appendStoredSessionContinuity,
	createStoredSessionContinuity,
	readStoredSessionContinuity,
} from "../../../src/project-server/sessions/continuity-store.ts";
import {
	createRunHandle,
	createRunRawLogReference,
	createRunReceipt,
	createRunRequest,
} from "../../../src/runtime/contracts.ts";
import {
	canonicalJsonDigest,
	sha256Digest,
} from "../../../src/utils/canonical-json.ts";

const build = Object.freeze({
	buildDigest: digest("runtime-build-one"),
	runProtocolVersion: "3.0.0",
});

describe("persistent Session continuity", () => {
	it("admits one exact-head writer and advances only from its bound receipt", () => {
		const initial = continuity();
		const admission = acquire(initial, "run-1", null);
		assert.equal(admission.session.mode, "create");
		assert.equal(admission.session.expectedHead, "absent");
		assert.throws(
			() => acquireSessionLease({
				record: admission.record,
				expectedRecordDigest: admission.record.recordDigest,
				expectedSessionHead: "absent",
				leaseId: "lease-2",
				runId: "run-2",
				acquiredAt: "2026-08-22T10:01:00.000Z",
				expiresAt: "2026-08-22T10:11:00.000Z",
				resumeLog: null,
			}),
			/active writer lease/,
		);

		const receipt = completedReceipt(admission.session, "run-1", "session-head-one");
		const committed = commitSessionRunReceipt({
			record: admission.record,
			expectedRecordDigest: admission.record.recordDigest,
			leaseId: "lease-run-1",
			receipt,
		});
		assert.equal(committed.sessionHead, receipt.rawLog.digest);
		assert.equal(committed.lastReceiptDigest, receipt.receiptDigest);
		assert.equal(committed.activeLease, null);

		const resumed = acquire(committed, "run-2", receipt.rawLog);
		assert.equal(resumed.session.mode, "resume");
		assert.equal(resumed.session.expectedHead, receipt.rawLog.digest);
		assert.throws(
			() => acquireSessionLease({
				record: committed,
				expectedRecordDigest: committed.recordDigest,
				expectedSessionHead: digest("stale-head"),
				leaseId: "lease-stale",
				runId: "run-stale",
				acquiredAt: "2026-08-22T10:01:00.000Z",
				expiresAt: "2026-08-22T10:11:00.000Z",
				resumeLog: receipt.rawLog,
			}),
			/expected head is stale/,
		);
	});

	it("records cancellation, requires expiry, and rejects early takeover", () => {
		const admission = acquire(continuity(), "run-1", null);
		const cancelling = requestSessionLeaseCancellation({
			record: admission.record,
			expectedRecordDigest: admission.record.recordDigest,
			leaseId: "lease-run-1",
			requestedAt: "2026-08-22T10:05:00.000Z",
		});
		assert.equal(
			cancelling.activeLease.cancellationRequestedAt,
			"2026-08-22T10:05:00.000Z",
		);
		assert.throws(
			() => expireSessionLease({
				record: cancelling,
				expectedRecordDigest: cancelling.recordDigest,
				leaseId: "lease-run-1",
				observedAt: "2026-08-22T10:09:59.000Z",
			}),
			/has not expired/,
		);
		const expired = expireSessionLease({
			record: cancelling,
			expectedRecordDigest: cancelling.recordDigest,
			leaseId: "lease-run-1",
			observedAt: "2026-08-22T10:10:00.000Z",
		});
		assert.equal(expired.activeLease, null);
		assert.equal(expired.sessionHead, "absent");
	});

	it("forces build changes through fresh-Session rollover with rehydration provenance", () => {
		const initial = continuity();
		assert.throws(
			() => rolloverSessionContinuity({
				record: initial,
				expectedRecordDigest: initial.recordDigest,
				newSessionId: "session-2",
				newRuntimeBuild: build,
				reason: "runtime-build-change",
				rehydrationDigest: digest("rehydration"),
				rolledAt: "2026-08-22T10:01:00.000Z",
			}),
			/requires a changed Build digest/,
		);
		const rolled = rolloverSessionContinuity({
			record: initial,
			expectedRecordDigest: initial.recordDigest,
			newSessionId: "session-2",
			newRuntimeBuild: {
				buildDigest: digest("runtime-build-two"),
				runProtocolVersion: "3.0.0",
			},
			reason: "runtime-build-change",
			rehydrationDigest: digest("rehydration"),
			rolledAt: "2026-08-22T10:01:00.000Z",
		});
		assert.equal(rolled.sessionHead, "absent");
		assert.equal(rolled.rollover.previousSessionId, "session-1");
		assert.equal(rolled.rollover.rehydrationDigest, digest("rehydration"));
	});

	it("rolls semantic continuity into fresh Sessions with canonical rehydration", () => {
		for (const reason of [
			"corruption",
			"role-change",
			"compaction-lock",
			"summary-drift",
			"quality-decline",
		]) {
			const initial = continuity();
			const rehydrationDigest = digest(`rehydration-${reason}`);
			const rolled = rolloverSessionContinuity({
				record: initial,
				expectedRecordDigest: initial.recordDigest,
				newSessionId: `session-${reason}`,
				newRuntimeBuild: build,
				reason,
				rehydrationDigest,
				rolledAt: "2026-08-22T10:01:00.000Z",
			});
			assert.equal(rolled.sessionHead, "absent");
			assert.equal(rolled.rollover.reason, reason);
			assert.equal(rolled.rollover.rehydrationDigest, rehydrationDigest);
		}
	});

	it("rejects truncated or tampered continuity journals during restart", async () => {
		const stateRoot = await mkdtemp(join(tmpdir(), "codewiki-session-corrupt-"));
		await createStoredSessionContinuity({
			stateRoot,
			continuityKey: "implementation:wu-1",
			sessionId: "session-1",
			runtimeBuild: build,
			createdAt: "2026-08-22T10:00:00.000Z",
		});
		const directory = join(stateRoot, "session-continuity");
		const [name] = await readdir(directory);
		const path = join(directory, name);
		const bytes = await readFile(path, "utf8");
		await writeFile(path, bytes.slice(0, -1));
		await assert.rejects(
			readStoredSessionContinuity({stateRoot, continuityKey: "implementation:wu-1"}),
			/incomplete trailing record/,
		);
		await writeFile(path, bytes.replace("session-1", "session-x"));
		await assert.rejects(
			readStoredSessionContinuity({stateRoot, continuityKey: "implementation:wu-1"}),
			/record identity is invalid/,
		);
	});

	it("recovers append-only continuity after restart and rejects stale CAS", async () => {
		const stateRoot = await mkdtemp(join(tmpdir(), "codewiki-session-continuity-"));
		const initial = await createStoredSessionContinuity({
			stateRoot,
			continuityKey: "implementation:wu-1",
			sessionId: "session-1",
			runtimeBuild: build,
			createdAt: "2026-08-22T10:00:00.000Z",
		});
		const admitted = acquire(initial, "run-1", null);
		await appendStoredSessionContinuity({
			stateRoot,
			continuityKey: initial.continuityKey,
			expectedRecordDigest: initial.recordDigest,
			record: admitted.record,
		});
		const recovered = await readStoredSessionContinuity({
			stateRoot,
			continuityKey: initial.continuityKey,
		});
		assert.deepEqual(recovered, admitted.record);
		await assert.rejects(
			appendStoredSessionContinuity({
				stateRoot,
				continuityKey: initial.continuityKey,
				expectedRecordDigest: initial.recordDigest,
				record: admitted.record,
			}),
			/expected head is stale/,
		);
	});
});

function continuity() {
	return createSessionContinuity({
		continuityKey: "implementation:wu-1",
		sessionId: "session-1",
		runtimeBuild: build,
		createdAt: "2026-08-22T10:00:00.000Z",
	});
}

function acquire(record, runId, resumeLog) {
	const acquiredAt = new Date(Math.max(
		Date.parse(record.updatedAt),
		Date.parse("2026-08-22T10:00:00.000Z"),
	)).toISOString();
	const expiresAt = new Date(Date.parse(acquiredAt) + 10 * 60_000).toISOString();
	return acquireSessionLease({
		record,
		expectedRecordDigest: record.recordDigest,
		expectedSessionHead: record.sessionHead,
		leaseId: `lease-${runId}`,
		runId,
		acquiredAt,
		expiresAt,
		resumeLog,
	});
}

function completedReceipt(session, runId, rawContent) {
	const request = createRunRequest({
		runId,
		operationId: "operation-1",
		custody: "backend-owned",
		role: "implementation-worker",
		stage: "implementation",
		subject: {id: "work-unit:wu-1", digest: digest("subject")},
		runtimeBuild: build,
		session,
		inputs: {
			projectContextSnapshotDigest: digest("context"),
			materialDigest: digest("material"),
			feedbackDigest: digest("feedback"),
			systemPromptDigest: digest("system"),
			promptDigest: digest("prompt"),
			producerSkillSetDigest: digest("skills"),
			toolMode: "admitted",
			toolSetDigest: digest("tools"),
			modelRoute: {
				provider: "provider",
				model: "model",
				optionsDigest: digest("options"),
				routeDigest: canonicalJsonDigest({
					provider: "provider",
					model: "model",
					optionsDigest: digest("options"),
				}),
			},
		},
		workspace: {
			kind: "runtime-workbench",
			repositorySnapshotDigest: digest("repository"),
			assignmentId: "assignment-1",
			workbenchRef: "workbench-1",
		},
		budget: {
			timeoutMs: 60_000,
			maxModelRequests: 2,
			maxToolCalls: 10,
			maxInputTokens: 1000,
			maxOutputTokens: 1000,
		},
		createdAt: "2026-08-22T10:00:00.000Z",
		deadlineAt: "2026-08-22T10:09:00.000Z",
	});
	const handle = createRunHandle(request, "2026-08-22T10:00:01.000Z");
	const rawLog = createRunRawLogReference({
		encoding: "jsonl",
		formatVersion: 1,
		sessionId: session.sessionId,
		storageId: `storage-${runId}`,
		byteLength: Buffer.byteLength(rawContent),
		digest: sha256Digest(rawContent),
		runtimeBuildDigest: build.buildDigest,
	});
	return createRunReceipt({
		handle,
		outcome: "completed",
		finalEventSequence: 2,
		startedAt: "2026-08-22T10:00:02.000Z",
		finishedAt: "2026-08-22T10:00:03.000Z",
		executionLedgerDigest: digest("ledger"),
		rawLog,
		outputDigest: digest("output"),
		usageDigest: digest("usage"),
		cancellationDigest: null,
		quiescenceDigest: digest("quiescence"),
		custodyGaps: [],
		operationalGaps: [],
	});
}

function digest(value) {
	return sha256Digest(value);
}
