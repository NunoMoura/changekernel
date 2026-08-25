import {
	createSchedulingPolicy,
	createWorkerOffer,
} from "../../src/changes/trace/scheduling.ts";
import {
	createProjectSchedulingPlan,
	createSchedulingOperationSequence,
} from "../../src/project-server/scheduling/scheduler.ts";
import {createImplementationRunRequest} from "../../src/project-server/workers/implementation-run.ts";
import {
	createWorkUnitModelAssignment,
	runModelRouteForAssignment,
} from "../../src/project-server/workers/model-assignment.ts";
import {resolveWikiConfig} from "../../src/project/config.ts";
import {
	RUN_PROTOCOL,
	createRunHandle,
	createRunRawLogReference,
	createRunReceipt,
	createRunSessionLeaseBinding,
} from "../../src/runtime/contracts.ts";
import {createImplementationStagePolicy} from "../../src/loops/implementation/policy.ts";
import {createWorkUnitCandidate} from "../../src/loops/implementation/work-unit-candidate.ts";
import {createImplementationOperationSequence} from "../../src/project-server/effects/implementation-operations.ts";
import {createImplementationStageGate} from "../../src/project-server/lifecycle/implementation-gate.ts";
import {sha256Digest} from "../../src/utils/canonical-json.ts";
import {baseSnapshotFor, reduceBatch} from "./change-trace-replay-v1.mjs";
import {authorityBinding, gitObject} from "./change-trace-v1.mjs";
import {acceptedPlanningContext} from "./native-planning.mjs";
import {checkExecutor, checkSnapshot, packagedCheck} from "./checks.mjs";

export async function canonicalImplementationFixture(options = {}) {
	const context = await acceptedPlanningContext(options);
	const maximumAssignments = options.maximumAssignments ?? 2;
	const policy = createSchedulingPolicy({
		maximumAssignments,
		leaseDurationMs: 60_000,
		allowedPrivacyClasses: ["internal"],
		allowedBudgetClasses: ["standard"],
		acceptedConsentIds: ["source-mutation"],
		allowedCustodyCapabilities: ["isolated_worktree"],
		isolationPreference: ["worktree"],
		workbenchRoot: "/tmp/codewiki-workbenches",
	});
	const offer = createWorkerOffer({
		workerId: "worker-alpha",
		capabilityIds: ["typescript"],
		toolIds: ["pi-lens"],
		skillIds: [],
		custodyCapabilities: ["isolated_worktree"],
		consentIds: ["source-mutation"],
		privacyClasses: ["internal"],
		budgetClasses: ["standard"],
		isolationKinds: ["worktree"],
		maximumConcurrentAssignments: maximumAssignments,
		validFrom: "2026-08-10T10:00:00.000Z",
		validUntil: "2026-08-10T12:00:00.000Z",
	});
	const plan = createProjectSchedulingPlan({
		state: context.state,
		workerOffers: [offer],
		policy,
		sourceBase: gitObject("2"),
		observedAt: "2026-08-10T10:04:00.000Z",
	});
	const sequence = createSchedulingOperationSequence({
		state: context.state,
		plan,
		policy,
		baseSnapshot: baseSnapshotFor(context.state),
		claimAuthority: authorityBinding(),
		assignmentAuthority: authorityBinding(),
		recordedAt: plan.observedAt,
	});
	const state = reduceBatch(context.state, sequence.operations, gitObject("e"));
	const admission = options.workUnitId
		? plan.admissions.find((entry) => entry.workUnit.id === options.workUnitId)
		: plan.admissions[0];
	if (!admission) throw new Error("Requested canonical Implementation Work Unit is not schedulable.");
	const workUnit = context.candidate.content.delta.workUnits.find(
		(entry) => entry.id === admission.workUnit.id,
	);
	if (!workUnit) throw new Error("Scheduled canonical Implementation Work Unit is missing.");
	return {
		...context,
		baseState: context.state,
		state,
		plan,
		policy,
		workUnit,
		assignment: admission.assignment,
		workbench: admission.workbench,
	};
}

export async function acceptedImplementationCandidateContext(options = {}) {
	const fixture = await canonicalImplementationFixture(options);
	const request = implementationRunRequest(fixture);
	const receipt = implementationRunReceipt(request);
	const candidate = createWorkUnitCandidate({
		state: fixture.state,
		workUnitId: fixture.workUnit.id,
		assignment: fixture.assignment,
		workbench: fixture.workbench,
		runs: [{request, receipt}],
		changedPaths: [fixture.workUnit.pathScopes[0]],
	});
	const policy = createImplementationStagePolicy(
		checkSnapshot(
			[packagedCheck({stage: "implementation", id: "unit-quality"})],
			{stage: "implementation"},
		),
	);
	const gate = await createImplementationStageGate({
		policy,
		executors: [checkExecutor()],
	}).run({candidate});
	const sequence = createImplementationOperationSequence({
		state: fixture.state,
		candidate,
		policy,
		evidenceRecords: [],
		report: gate.report,
		baseSnapshot: baseSnapshotFor(fixture.state),
		authorityBinding: authorityBinding(),
		recordedAt: "2026-08-10T10:04:10.000Z",
	});
	const state = reduceBatch(fixture.state, sequence.operations, gitObject("f"));
	return {...fixture, implementationBaseState: fixture.state, state, candidate, policy, gate, request, receipt, sequence};
}

export function implementationRuntimeBuild() {
	return {
		buildDigest: sha256Digest("implementation-runtime-build"),
		runProtocolVersion: RUN_PROTOCOL.version,
	};
}

export function implementationRunInputs(modelRoute) {
	return {
		projectContextSnapshotDigest: sha256Digest("implementation-stage-context"),
		materialDigest: sha256Digest("implementation-static-inputs"),
		feedbackDigest: null,
		systemPromptDigest: sha256Digest("implementation-system-prompt"),
		promptDigest: sha256Digest("implementation-prompt"),
		producerSkillSetDigest: sha256Digest("implementation-skills"),
		toolMode: "admitted",
		toolSetDigest: sha256Digest("implementation-tools"),
		modelRoute,
	};
}

export function implementationBudget() {
	return {
		timeoutMs: 60_000,
		maxModelRequests: 8,
		maxToolCalls: 32,
		maxInputTokens: 64_000,
		maxOutputTokens: 8_000,
	};
}

export function implementationRunRequest(fixture, priorReceipts = [], runId = "run-implementation-1") {
	const continuityKey = `implementation:${fixture.workUnit.id}`;
	const modelAssignment = createWorkUnitModelAssignment({
		config: implementationModelConfig(),
		assignment: fixture.assignment,
		workUnit: fixture.workUnit,
		risk: "medium",
	});
	const previous = priorReceipts.at(-1);
	const lease = createRunSessionLeaseBinding({
		leaseId: `lease:${runId}`,
		generation: priorReceipts.length + 1,
		runId,
		acquiredAt: "2026-08-10T10:04:00.000Z",
		expiresAt: "2026-08-10T10:06:00.000Z",
	});
	const session = previous
		? {
				mode: "resume",
				continuityKey,
				sessionId: previous.sessionId,
				expectedHead: previous.resultingSessionHead,
				lease,
				resumeLog: previous.rawLog,
			}
		: {
				mode: "create",
				continuityKey,
				sessionId: continuityKey,
				expectedHead: "absent",
				lease,
				resumeLog: null,
			};
	return createImplementationRunRequest({
		assignment: fixture.assignment,
		workbench: fixture.workbench,
		workUnit: fixture.workUnit,
		modelAssignment,
		runtimeBuild: implementationRuntimeBuild(),
		inputs: implementationRunInputs(runModelRouteForAssignment(modelAssignment)),
		budget: implementationBudget(),
		session,
		priorReceipts,
		runId,
		createdAt: "2026-08-10T10:04:01.000Z",
		deadlineAt: "2026-08-10T10:05:01.000Z",
	});
}

function implementationModelConfig() {
	return resolveWikiConfig({
		runtime: {
			modelRouting: {
				qualityFloor: "standard",
				maxEscalations: 0,
				estimatedInputTokens: 64_000,
				estimatedOutputTokens: 8_000,
				routes: [{
					id: "test-implementation",
					provider: "test-provider",
					accountId: "test-account",
					credentialRef: "TEST_PROVIDER_API_KEY",
					model: "test-model",
					thinking: "off",
					quality: "standard",
					latency: "fast",
					contextWindowTokens: 128_000,
					timeoutMs: 60_000,
					pricing: {
						inputUsdPerMillion: 0,
						outputUsdPerMillion: 0,
						cacheReadUsdPerMillion: 0,
						cacheWriteUsdPerMillion: 0,
					},
					allowedTools: ["pi-lens"],
				}],
				roleRoutes: {
					harness: null,
					decision: "inherit",
					planning: "inherit",
					review: "inherit",
					workers: ["test-implementation"],
				},
				escalationTransitions: [],
			},
		},
	});
}

export function implementationRunReceipt(request, overrides = {}) {
	const runtimeBuildDigest = request.runtimeBuild.buildDigest;
	const handle = createRunHandle(request, "2026-08-10T10:04:01.500Z");
	const outputDigest =
		overrides.outputDigest === undefined
			? sha256Digest(`output:${request.runId}`)
			: overrides.outputDigest;
	return createRunReceipt({
		handle,
		outcome: overrides.outcome ?? "completed",
		finalEventSequence: 4,
		startedAt: "2026-08-10T10:04:02.000Z",
		finishedAt: "2026-08-10T10:04:04.000Z",
		executionLedgerDigest: sha256Digest(`ledger:${request.runId}`),
		rawLog: createRunRawLogReference({
			encoding: "jsonl",
			formatVersion: 0,
			sessionId: request.session.sessionId,
			storageId: `log:${request.runId}`,
			byteLength: 2048,
			digest: sha256Digest(`raw-log:${request.runId}`),
			runtimeBuildDigest,
		}),
		outputDigest,
		usageDigest: sha256Digest(`usage:${request.runId}`),
		cancellationDigest: null,
		quiescenceDigest: sha256Digest(`quiescence:${request.runId}`),
		custodyGaps: overrides.custodyGaps ?? [],
		operationalGaps: [],
	});
}
