import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {resolveWikiConfig} from "../../src/project/config.ts";
import {createImplementationRunRequest} from "../../src/project-server/workers/implementation-run.ts";
import {
	WORK_UNIT_MODEL_ASSIGNMENT_PROTOCOL,
	createWorkUnitModelAssignment,
	runModelRouteForAssignment,
} from "../../src/project-server/workers/model-assignment.ts";
import {createRunSessionLeaseBinding} from "../../src/runtime/contracts.ts";
import {
	canonicalImplementationFixture,
	implementationBudget,
	implementationRunInputs,
	implementationRunReceipt,
	implementationRuntimeBuild,
} from "../helpers/canonical-implementation.mjs";

function route(id, quality, contextWindowTokens) {
	return {
		id,
		provider: "test-provider",
		accountId: "test-account",
		credentialRef: "TEST_PROVIDER_API_KEY",
		model: `test-${id}`,
		thinking: quality === "standard" ? "off" : "high",
		quality,
		latency: quality === "standard" ? "fast" : "balanced",
		contextWindowTokens,
		timeoutMs: 60_000,
		pricing: {
			inputUsdPerMillion: quality === "standard" ? 1 : 4,
			outputUsdPerMillion: quality === "standard" ? 2 : 8,
			cacheReadUsdPerMillion: 0,
			cacheWriteUsdPerMillion: 0,
		},
		allowedTools: ["pi-lens"],
	};
}

function config(escalationTransitions = [{fromRouteId: "economy", toRouteId: "expert"}]) {
	return resolveWikiConfig({
		runtime: {
			modelRouting: {
				qualityFloor: "standard",
				maxEscalations: 1,
				estimatedInputTokens: 64_000,
				estimatedOutputTokens: 8_000,
				routes: [
					{...route("harness-main", "high", 256_000), model: "test-harness-main"},
					route("economy", "standard", 128_000),
					route("expert", "high", 256_000),
				],
				roleRoutes: {
					harness: "harness-main",
					decision: "inherit",
					planning: "inherit",
					review: "inherit",
					workers: ["economy", "expert"],
				},
				escalationTransitions,
			},
		},
	});
}

function session(runId, workUnitId) {
	return {
		mode: "create",
		continuityKey: `implementation:${workUnitId}`,
		sessionId: `session-${runId}`,
		expectedHead: "absent",
		lease: createRunSessionLeaseBinding({
			leaseId: `lease-${runId}`,
			generation: 1,
			runId,
			acquiredAt: "2026-08-10T10:04:00.000Z",
			expiresAt: "2026-08-10T10:06:00.000Z",
		}),
		resumeLog: null,
	};
}

describe("Work Unit model Assignment", () => {
	it("binds one user-authorized initial route into the exact Implementation Run", async () => {
		const fixture = await canonicalImplementationFixture();
		const modelAssignment = createWorkUnitModelAssignment({
			config: config(),
			assignment: fixture.assignment,
			workUnit: fixture.workUnit,
			risk: "medium",
		});
		const modelRoute = runModelRouteForAssignment(modelAssignment);
		assert.equal(WORK_UNIT_MODEL_ASSIGNMENT_PROTOCOL.version, "2.0.0");
		assert.equal(modelAssignment.policy.route.routeId, "economy");
		assert.notEqual(modelAssignment.policy.route.routeId, "harness-main");
		assert.equal(modelRoute.modelAssignmentDigest, modelAssignment.assignmentDigest);
		assert.equal(modelRoute.accountId, "test-account");
		assert.equal(modelRoute.credentialRef, "TEST_PROVIDER_API_KEY");
		assert.equal(modelRoute.policyDigest, modelAssignment.policy.digest);
		assert.equal(modelRoute.policyAttempt, 0);

		const runId = "run-model-assignment";
		const request = createImplementationRunRequest({
			assignment: fixture.assignment,
			workbench: fixture.workbench,
			workUnit: fixture.workUnit,
			modelAssignment,
			runtimeBuild: implementationRuntimeBuild(),
			inputs: implementationRunInputs(modelRoute),
			budget: implementationBudget(),
			session: session(runId, fixture.workUnit.id),
			priorReceipts: [],
			runId,
			createdAt: "2026-08-10T10:04:01.000Z",
			deadlineAt: "2026-08-10T10:05:01.000Z",
		});
		assert.deepEqual(request.inputs.modelRoute, modelRoute);
		assert.throws(
			() => createImplementationRunRequest({
				assignment: fixture.assignment,
				workbench: fixture.workbench,
				workUnit: fixture.workUnit,
				modelAssignment,
				runtimeBuild: implementationRuntimeBuild(),
				inputs: implementationRunInputs({...modelRoute, model: "unauthorized"}),
				budget: implementationBudget(),
				session: session("run-route-drift", fixture.workUnit.id),
				priorReceipts: [],
				runId: "run-route-drift",
				createdAt: "2026-08-10T10:04:01.000Z",
				deadlineAt: "2026-08-10T10:05:01.000Z",
			}),
			/differs from its model Assignment/,
		);
	});

	it("permits only typed, explicitly authorized between-Run escalation", async () => {
		const fixture = await canonicalImplementationFixture();
		const previousAttempts = [{
			routeId: "economy",
			outcome: "failed",
			failureKind: "checks-failed",
			inputTokens: 1_000,
			outputTokens: 500,
			costUsd: 0.01,
			latencyMs: 2_000,
		}];
		const escalated = createWorkUnitModelAssignment({
			config: config(),
			assignment: fixture.assignment,
			workUnit: fixture.workUnit,
			risk: "medium",
			previousAttempts,
		});
		assert.equal(escalated.policy.route.routeId, "expert");
		assert.equal(escalated.policy.escalation.failureKind, "checks-failed");
		assert.equal(escalated.policy.escalation.recoveryAction, "escalate-capability");
		const escalatedRoute = runModelRouteForAssignment(escalated);
		assert.equal(escalatedRoute.policyAttempt, 1);

		const initial = createWorkUnitModelAssignment({
			config: config(),
			assignment: fixture.assignment,
			workUnit: fixture.workUnit,
			risk: "medium",
		});
		const initialRunId = "run-model-initial";
		const initialRequest = createImplementationRunRequest({
			assignment: fixture.assignment,
			workbench: fixture.workbench,
			workUnit: fixture.workUnit,
			modelAssignment: initial,
			runtimeBuild: implementationRuntimeBuild(),
			inputs: implementationRunInputs(runModelRouteForAssignment(initial)),
			budget: implementationBudget(),
			session: session(initialRunId, fixture.workUnit.id),
			priorReceipts: [],
			runId: initialRunId,
			createdAt: "2026-08-10T10:04:01.000Z",
			deadlineAt: "2026-08-10T10:05:01.000Z",
		});
		const failedReceipt = implementationRunReceipt(initialRequest, {
			outcome: "failed",
			outputDigest: null,
		});
		const resumedSession = {
			mode: "resume",
			continuityKey: initialRequest.session.continuityKey,
			sessionId: initialRequest.session.sessionId,
			expectedHead: failedReceipt.resultingSessionHead,
			lease: createRunSessionLeaseBinding({
				leaseId: "lease-run-model-escalated",
				generation: 2,
				runId: "run-model-escalated",
				acquiredAt: "2026-08-10T10:04:05.000Z",
				expiresAt: "2026-08-10T10:06:00.000Z",
			}),
			resumeLog: failedReceipt.rawLog,
		};
		assert.throws(
			() => createImplementationRunRequest({
				assignment: fixture.assignment,
				workbench: fixture.workbench,
				workUnit: fixture.workUnit,
				modelAssignment: escalated,
				runtimeBuild: implementationRuntimeBuild(),
				inputs: implementationRunInputs(escalatedRoute),
				budget: implementationBudget(),
				session: resumedSession,
				priorReceipts: [failedReceipt],
				runId: "run-model-escalated",
				createdAt: "2026-08-10T10:04:06.000Z",
				deadlineAt: "2026-08-10T10:05:06.000Z",
			}),
			/model route change requires a fresh Session/,
		);
		const freshRun = createImplementationRunRequest({
			assignment: fixture.assignment,
			workbench: fixture.workbench,
			workUnit: fixture.workUnit,
			modelAssignment: escalated,
			runtimeBuild: implementationRuntimeBuild(),
			inputs: implementationRunInputs(escalatedRoute),
			budget: implementationBudget(),
			session: session("run-model-escalated", fixture.workUnit.id),
			priorReceipts: [failedReceipt],
			runId: "run-model-escalated",
			createdAt: "2026-08-10T10:04:06.000Z",
			deadlineAt: "2026-08-10T10:05:06.000Z",
		});
		assert.equal(freshRun.session.mode, "create");
		assert.equal(freshRun.inputs.modelRoute.routeId, "expert");

		assert.throws(
			() => createWorkUnitModelAssignment({
				config: config([]),
				assignment: fixture.assignment,
				workUnit: fixture.workUnit,
				risk: "medium",
				previousAttempts,
			}),
			/user-authorized|Worker execution policy blocked/,
		);
		assert.throws(
			() => createWorkUnitModelAssignment({
				config: config(),
				assignment: fixture.assignment,
				workUnit: fixture.workUnit,
				risk: "medium",
				previousAttempts: [{...previousAttempts[0], failureKind: "provider-timeout"}],
			}),
			/Transport recovery stays behind the private provider boundary/,
		);
	});
});
