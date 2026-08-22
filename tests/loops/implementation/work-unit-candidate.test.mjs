import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
	assertWorkUnitCandidate,
	createWorkUnitCandidate,
	implementationContinuityKey,
} from "../../../src/loops/implementation/work-unit-candidate.ts";
import {createRunRequest} from "../../../src/runtime/contracts.ts";
import {sha256Digest} from "../../../src/utils/canonical-json.ts";
import {
	canonicalImplementationFixture,
	implementationRunReceipt,
	implementationRunRequest,
} from "../../helpers/canonical-implementation.mjs";

async function candidateFixture() {
	const fixture = await canonicalImplementationFixture();
	const request = implementationRunRequest(fixture);
	const receipt = implementationRunReceipt(request);
	const candidate = createWorkUnitCandidate({
		state: fixture.state,
		workUnitId: fixture.workUnit.id,
		assignment: fixture.assignment,
		workbench: fixture.workbench,
		runs: [{request, receipt}],
		changedPaths: ["src/planning"],
	});
	return {fixture, request, receipt, candidate};
}

describe("canonical Work Unit Candidate", () => {
	it("binds one exact Work Unit, owning Change acceptance slice, Assignment, and result tree", async () => {
		const {fixture, receipt, candidate} = await candidateFixture();
		assert.equal(candidate.loop, "implementation");
		assert.equal(candidate.content.workUnitId, fixture.workUnit.id);
		assert.equal(candidate.content.owningChangeId, fixture.changeId);
		assert.equal(candidate.content.assignmentDigest, fixture.assignment.assignmentDigest);
		assert.equal(candidate.content.workbenchDigest, fixture.workbench.workbenchDigest);
		assert.equal(candidate.content.resultTreeDigest, receipt.outputDigest);
		assert.deepEqual(
			candidate.content.acceptanceSlice.knowledgeEffectIds,
			fixture.workUnit.knowledgeEffectIds,
		);
		assert.deepEqual(
			candidate.content.acceptanceSlice.acceptanceRequirementIds,
			fixture.workUnit.acceptanceRequirementIds,
		);
		assertWorkUnitCandidate(candidate, fixture.state);
		assert.throws(
			() => assertWorkUnitCandidate(candidate, fixture.baseState),
			/WorkState base is stale/,
		);
	});

	it("uses one persistent implementation:<work-unit-id> Session across bounded attempts", async () => {
		const fixture = await canonicalImplementationFixture();
		const firstRequest = implementationRunRequest(fixture);
		const firstReceipt = implementationRunReceipt(firstRequest, {
			outcome: "failed",
			outputDigest: null,
		});
		const secondRequest = implementationRunRequest(
			fixture,
			[firstReceipt],
			"run-implementation-2",
		);
		const secondReceipt = implementationRunReceipt(secondRequest);
		assert.equal(firstRequest.session.mode, "create");
		assert.equal(secondRequest.session.mode, "resume");
		assert.equal(
			firstRequest.session.sessionId,
			implementationContinuityKey(fixture.workUnit.id),
		);
		assert.equal(secondRequest.session.sessionId, firstRequest.session.sessionId);
		const candidate = createWorkUnitCandidate({
			state: fixture.state,
			workUnitId: fixture.workUnit.id,
			assignment: fixture.assignment,
			workbench: fixture.workbench,
			runs: [
				{request: firstRequest, receipt: firstReceipt},
				{request: secondRequest, receipt: secondReceipt},
			],
			changedPaths: ["src/planning"],
		});
		assert.equal(candidate.content.runAttempts.length, 2);
		assert.equal(candidate.content.producingRunId, secondRequest.runId);
		const {
			schemaVersion: _schemaVersion,
			requestDigest: _requestDigest,
			...secondRequestInput
		} = secondRequest;
		const mismatchedResumeRequest = createRunRequest({
			...secondRequestInput,
			session: {
				...secondRequest.session,
				resumeLog: {
					...secondRequest.session.resumeLog,
					digest: sha256Digest("different-session-log"),
				},
			},
		});
		const mismatchedResumeReceipt = implementationRunReceipt(mismatchedResumeRequest);
		assert.throws(
			() =>
				createWorkUnitCandidate({
					state: fixture.state,
					workUnitId: fixture.workUnit.id,
					assignment: fixture.assignment,
					workbench: fixture.workbench,
					runs: [
						{request: firstRequest, receipt: firstReceipt},
						{request: mismatchedResumeRequest, receipt: mismatchedResumeReceipt},
					],
					changedPaths: ["src/planning"],
				}),
			/does not resume exact prior Session log/,
		);
	});

	it("rejects zero, duplicate, non-final, or mismatched producing Runs", async () => {
		const fixture = await canonicalImplementationFixture();
		const firstRequest = implementationRunRequest(fixture);
		const completed = implementationRunReceipt(firstRequest);
		assert.throws(
			() =>
				createWorkUnitCandidate({
					state: fixture.state,
					workUnitId: fixture.workUnit.id,
					assignment: fixture.assignment,
					workbench: fixture.workbench,
					runs: [],
					changedPaths: [],
				}),
			/requires 1-8 bounded Runs/,
		);
		const failed = implementationRunReceipt(firstRequest, {
			outcome: "failed",
			outputDigest: null,
		});
		assert.throws(
			() =>
				createWorkUnitCandidate({
					state: fixture.state,
					workUnitId: fixture.workUnit.id,
					assignment: fixture.assignment,
					workbench: fixture.workbench,
					runs: [{request: firstRequest, receipt: failed}],
					changedPaths: [],
				}),
			/requires exactly one final producing Run/,
		);
		assert.throws(
			() =>
				createWorkUnitCandidate({
					state: fixture.state,
					workUnitId: fixture.workUnit.id,
					assignment: fixture.assignment,
					workbench: fixture.workbench,
					runs: [
						{request: firstRequest, receipt: completed},
						{request: firstRequest, receipt: completed},
					],
					changedPaths: [],
				}),
			/Run Receipt binding is invalid|exactly one final producing Run/,
		);
		assert.throws(
			() =>
				createWorkUnitCandidate({
					state: fixture.state,
					workUnitId: fixture.workUnit.id,
					assignment: fixture.assignment,
					workbench: fixture.workbench,
					runs: [{request: firstRequest, receipt: completed}],
					changedPaths: ["src/outside-scope.ts"],
				}),
			/exceeds Work Unit scope/,
		);
	});
});
