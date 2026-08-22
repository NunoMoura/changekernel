import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createDistributedMutationRuntime,
	createGitCommandRunner,
	createInitialProjectWorkState,
} from "../../../src/changes/trace/index.ts";
import {authorityBinding, digest} from "../../helpers/change-trace-v1.mjs";
import {allowAllReplayPolicy} from "../../helpers/change-trace-replay-v1.mjs";
import {
	buildOpenChangeRecords,
	createGitProposal,
	createTwoCloneFixture,
	pushGitProposal,
} from "../../helpers/git-state-v1.mjs";

const repositoryIdentity = digest("a");

function projectSnapshotFor(state) {
	return {
		sourceHead: state.observedBase.sourceHead,
		knowledgeDigest: state.observedBase.knowledgeDigest,
		configDigest: state.observedBase.configDigest,
		policyDigest: state.observedBase.policyDigest,
	};
}

function mutationRuntime(
	fixture,
	clone,
	state,
	actorId,
	authenticated = false,
	runner,
) {
	return createDistributedMutationRuntime({
		repoRoot: clone,
		remote: "origin",
		repositoryIdentity,
		currentProject: () => projectSnapshotFor(state),
		authorityBinding: authorityBinding({
			actorId,
			authenticatedIdentityRef: `identity:${actorId}`,
			...(authenticated ? {authenticationEvidenceId: digest("e")} : {}),
		}),
		policy: allowAllReplayPolicy,
		runner,
		...(authenticated
			? {
					verifyTakeoverAuthority: (binding) =>
						binding.authenticationEvidenceId === digest("e"),
				}
			: {}),
		clock: () => "2026-07-30T17:00:00.000Z",
	});
}

function createFirstPushBarrierRunner() {
	const runGitCommand = createGitCommandRunner();
	let pushCount = 0;
	let release;
	const barrier = new Promise((resolve) => {
		release = resolve;
	});
	return async (request) => {
		if (request.args[0] === "push" && pushCount < 2) {
			pushCount += 1;
			if (pushCount === 2) release();
			await barrier;
		}
		return runGitCommand(request);
	};
}

async function seedChanges(fixture, changeIds) {
	const initial = createInitialProjectWorkState();
	const records = changeIds.flatMap((changeId) =>
		buildOpenChangeRecords(initial, changeId),
	);
	const proposal = await createGitProposal(fixture.cloneA, initial, records);
	assert.equal((await pushGitProposal(fixture.cloneA, proposal.proposal)).status, "accepted");
	return proposal.projected;
}

function activeChangeClaim(observation, changeId) {
	const change = observation.workState.changes.find(
		(candidate) => candidate.changeId === changeId,
	);
	return change.changeClaims.find((claim) => claim.status === "active");
}

describe("guarded distributed mutation", () => {
	it("reevaluates a stale independent Change Claim and accepts both", async () => {
		const fixture = await createTwoCloneFixture();
		try {
			const state = await seedChanges(fixture, ["CHG-mutate-a", "CHG-mutate-b"]);
			const runner = createFirstPushBarrierRunner();
			const runtimes = [
				mutationRuntime(fixture, fixture.cloneA, state, "runtime-a", false, runner),
				mutationRuntime(fixture, fixture.cloneB, state, "runtime-b", false, runner),
			];
			const receipts = await Promise.all([
				runtimes[0].acquireChangeClaim({
					changeId: "CHG-mutate-a",
					purpose: "implementation",
				}),
				runtimes[1].acquireChangeClaim({
					changeId: "CHG-mutate-b",
					purpose: "implementation",
				}),
			]);
			assert.deepEqual(
				receipts.map((receipt) => receipt.attemptCount).sort(),
				[1, 2],
			);
			const final = await runtimes[0].synchronize();
			assert.equal(activeChangeClaim(final, "CHG-mutate-a").actorId, "runtime-a");
			assert.equal(activeChangeClaim(final, "CHG-mutate-b").actorId, "runtime-b");
		} finally {
			await fixture.cleanup();
		}
	});

	it("serializes Change Claim acquire, release, idempotent retry, and authenticated takeover", async () => {
		const fixture = await createTwoCloneFixture();
		try {
			const changeId = "CHG-change-claim-runtime";
			const state = await seedChanges(fixture, [changeId]);
			const runtimes = [
				mutationRuntime(fixture, fixture.cloneA, state, "runtime-a"),
				mutationRuntime(fixture, fixture.cloneB, state, "runtime-b"),
			];
			const raced = await Promise.allSettled(
				runtimes.map((runtime) =>
					runtime.acquireChangeClaim({changeId, purpose: "implementation"}),
				),
			);
			assert.equal(raced.filter((result) => result.status === "fulfilled").length, 1);
			const rejected = raced.find((result) => result.status === "rejected");
			assert.equal(rejected.reason.code, "ACTIVE_AUTHORITY");
			const winnerIndex = raced.findIndex((result) => result.status === "fulfilled");
			const winner = raced[winnerIndex].value;
			const winnerRuntime = runtimes[winnerIndex];
			const winnerActor = winnerIndex === 0 ? "runtime-a" : "runtime-b";
			const repeated = await winnerRuntime.acquireChangeClaim({
				changeId,
				purpose: "implementation",
			});
			assert.equal(repeated.status, "already_accepted");
			assert.equal(repeated.operationId, winner.operationId);
			assert.equal(repeated.stateHead, winner.stateHead);

			const released = await winnerRuntime.releaseChangeClaim({
				changeId,
				claimOperationId: winner.operationId,
				reason: "completed",
			});
			assert.equal(released.status, "accepted");
			const releaseRetry = await winnerRuntime.releaseChangeClaim({
				changeId,
				claimOperationId: winner.operationId,
				reason: "completed",
			});
			assert.equal(releaseRetry.status, "already_accepted");

			const nextIndex = winnerIndex === 0 ? 1 : 0;
			const next = await runtimes[nextIndex].acquireChangeClaim({
				changeId,
				purpose: "implementation",
			});
			const unauthenticated = mutationRuntime(
				fixture,
				fixture.cloneA,
				state,
				"runtime-unauthenticated",
			);
			await assert.rejects(
				() =>
					unauthenticated.takeoverChangeClaim({
						changeId,
						priorClaimOperationId: next.operationId,
						purpose: "implementation",
						reason: "Maintainer-directed recovery.",
					}),
				/authenticated authority evidence/,
			);
			const takeoverRuntime = mutationRuntime(
				fixture,
				fixture.cloneA,
				state,
				"runtime-takeover",
				true,
			);
			const takeover = await takeoverRuntime.takeoverChangeClaim({
				changeId,
				priorClaimOperationId: next.operationId,
				purpose: "implementation",
				reason: "Maintainer-directed recovery.",
			});
			assert.equal(takeover.status, "accepted");
			const farFutureRuntime = createDistributedMutationRuntime({
				repoRoot: fixture.cloneB,
				remote: "origin",
				repositoryIdentity,
				currentProject: () => projectSnapshotFor(state),
				authorityBinding: authorityBinding({actorId: "runtime-future"}),
				policy: allowAllReplayPolicy,
				clock: () => "2099-01-01T00:00:00.000Z",
			});
			const farFuture = await farFutureRuntime.synchronize();
			assert.equal(activeChangeClaim(farFuture, changeId).actorId, "runtime-takeover");
			assert.equal(winnerActor, activeChangeClaim(winner.observation, changeId).actorId);
		} finally {
			await fixture.cleanup();
		}
	});

	it("keeps Work Unit Claim and Assignment authority out of generic mutation runtime", async () => {
		const fixture = await createTwoCloneFixture();
		try {
			const state = await seedChanges(fixture, ["CHG-scheduler-owned"]);
			const runtime = mutationRuntime(
				fixture,
				fixture.cloneA,
				state,
				"worker-a",
			);
			assert.equal(runtime.acquireWorkUnitClaim, undefined);
			assert.equal(runtime.releaseWorkUnitClaim, undefined);
			assert.equal(runtime.takeoverWorkUnitClaim, undefined);
		} finally {
			await fixture.cleanup();
		}
	});
});
