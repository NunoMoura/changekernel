import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
	createImplementationStagePolicy,
} from "../../../src/loops/implementation/policy.ts";
import {
	createWorkUnitCandidate,
} from "../../../src/loops/implementation/work-unit-candidate.ts";
import {deriveWorkUnitCandidateLifecycle} from "../../../src/loops/implementation/status.ts";
import {createImplementationStageGate} from "../../../src/project-server/lifecycle/implementation-gate.ts";
import {sha256Digest} from "../../../src/utils/canonical-json.ts";
import {
	checkExecutor,
	checkOutput,
	checkSnapshot,
	packagedCheck,
} from "../../helpers/checks.mjs";
import {
	canonicalImplementationFixture,
	implementationRunReceipt,
	implementationRunRequest,
} from "../../helpers/canonical-implementation.mjs";

async function workUnitCandidate() {
	const fixture = await canonicalImplementationFixture();
	const request = implementationRunRequest(fixture);
	const receipt = implementationRunReceipt(request);
	return createWorkUnitCandidate({
		state: fixture.state,
		workUnitId: fixture.workUnit.id,
		assignment: fixture.assignment,
		workbench: fixture.workbench,
		runs: [{request, receipt}],
		changedPaths: ["src/planning"],
	});
}

function implementationCheck(id, kind) {
	return packagedCheck({
		stage: "implementation",
		id,
		implementation:
			kind === "code"
				? {kind: "code", profile: "sandbox"}
				: {
						kind: "model",
						route: "quality",
						profile: "isolated",
						maximumTokens: 512,
					},
	});
}

describe("shared Implementation policy and Work Unit Gate", () => {
	it("uses one stage-wide Check Pack policy for Work Unit-specific Gate packages", async () => {
		const candidate = await workUnitCandidate();
		const snapshot = checkSnapshot(
			[implementationCheck("code-quality", "code")],
			{stage: "implementation"},
		);
		const policy = createImplementationStagePolicy(snapshot);
		const gate = createImplementationStageGate({
			policy,
			executors: [checkExecutor()],
		});
		const first = await gate.run({candidate});
		const second = await gate.run({candidate});
		assert.equal(first.report.status, "passed");
		assert.equal(first.lifecycle.status, "gate_passed");
		assert.equal(first.policy.policyDigest, policy.policyDigest);
		assert.equal(second.policy.policyDigest, policy.policyDigest);
		assert.equal(first.evaluationPackage.workUnitId, candidate.content.workUnitId);
		assert.equal(
			first.evaluationPackage.checkPackDigest,
			snapshot.checkPackDigest,
		);
		assert.equal(first.evaluationPackage.candidateDigest, candidate.digest);
		assert.throws(
			() =>
				createImplementationStagePolicy(
					checkSnapshot([packagedCheck({stage: "planning"})], {stage: "planning"}),
				),
			/does not match implementation|requires implementation/,
		);
	});

	it("runs Code Checks before bounded parallel Model Checks", async () => {
		const candidate = await workUnitCandidate();
		const snapshot = checkSnapshot(
			[
				implementationCheck("code-quality", "code"),
				implementationCheck("model-quality-a", "model"),
				implementationCheck("model-quality-b", "model"),
			],
			{stage: "implementation"},
		);
		const events = [];
		let activeModels = 0;
		let maximumModels = 0;
		const codeExecutor = checkExecutor({
			identity: {kind: "code", executorId: "code-executor"},
			supports: (check) => check.definition.implementation.kind === "code",
			execute(context) {
				events.push("code:done");
				return checkOutput(context.invocation);
			},
		});
		const modelExecutor = checkExecutor({
			identity: {
				kind: "model",
				executorId: "model-executor",
				route: "quality",
				profile: "isolated",
			},
			supports: (check) => check.definition.implementation.kind === "model",
			async execute(context) {
				events.push("model:start");
				activeModels += 1;
				maximumModels = Math.max(maximumModels, activeModels);
				await new Promise((resolve) => setTimeout(resolve, 10));
				activeModels -= 1;
				return checkOutput(context.invocation);
			},
		});
		const run = await createImplementationStageGate({
			policy: createImplementationStagePolicy(snapshot),
			executors: [codeExecutor, modelExecutor],
			limits: {maximumCodeConcurrency: 2, maximumModelConcurrency: 2},
		}).run({candidate});
		assert.equal(run.report.status, "passed", JSON.stringify(run.report));
		assert.equal(events[0], "code:done");
		assert.equal(maximumModels, 2);
	});

	it("tracks Gate, integration, stale, and conflict states separately", async () => {
		const candidate = await workUnitCandidate();
		const passing = await createImplementationStageGate({
			policy: createImplementationStagePolicy(
				checkSnapshot([implementationCheck("quality", "code")], {
					stage: "implementation",
				}),
			),
			executors: [checkExecutor()],
		}).run({candidate});
		const pendingIntegration = integration(candidate, "active");
		assert.equal(
			deriveWorkUnitCandidateLifecycle({
				candidate,
				gateReport: passing.report,
				integration: pendingIntegration,
			}).status,
			"integration_pending",
		);
		assert.equal(
			deriveWorkUnitCandidateLifecycle({
				candidate,
				gateReport: passing.report,
				integration: integration(candidate, "integrated"),
			}).status,
			"integrated",
		);
		assert.equal(
			deriveWorkUnitCandidateLifecycle({
				candidate,
				gateReport: passing.report,
				integration: integration(candidate, "conflict"),
			}).status,
			"conflicted",
		);
		assert.equal(
			deriveWorkUnitCandidateLifecycle({
				candidate,
				gateReport: passing.report,
				stale: true,
			}).status,
			"stale",
		);
		const failing = await createImplementationStageGate({
			policy: passing.policy,
			executors: [
				checkExecutor({
					execute: (context) =>
						checkOutput(context.invocation, {
							measurement: {kind: "binary", value: false},
						}),
				}),
			],
		}).run({candidate});
		assert.equal(failing.lifecycle.status, "gate_failed");
	});
});

function integration(candidate, status) {
	return {
		operationId: sha256Digest(`integration:${status}`),
		assignmentOperationIds: [],
		baseCommit: "a".repeat(40),
		targetRef: "refs/codewiki/integration/change",
		sourceCandidateIds: [candidate.id],
		status,
		resultOperationIds: [],
		resultCommit: status === "integrated" ? "b".repeat(40) : null,
		resultTreeDigest: status === "integrated" ? sha256Digest("tree") : null,
	};
}
