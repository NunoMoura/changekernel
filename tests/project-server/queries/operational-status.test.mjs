import assert from "node:assert/strict";
import test from "node:test";

import {DEFAULT_BACKEND_BUILD} from "../../../src/project-server/operations/build.ts";
import {projectOperationalStatus} from "../../../src/project-server/queries/operational-status.ts";
import {resolveExecutionRecovery} from "../../../src/project-server/workers/execution-recovery.ts";

const digest = (character) => `sha256:${character.repeat(64)}`;
const backend = {
	stateGeneration: 7,
	activeBuild: DEFAULT_BACKEND_BUILD,
	activeRuntimeBuildDigest: digest("6"),
};
const snapshot = {
	repositoryIdentity: digest("1"),
	remoteStateHead: "a".repeat(40),
	protectedSourceHead: "b".repeat(40),
	knowledgeDigest: digest("2"),
	configDigest: digest("3"),
	policyDigest: digest("4"),
	snapshotDigest: digest("5"),
};

test("operational status exposes exact synchronization and typed recovery ownership", () => {
	const status = projectOperationalStatus({
		backend,
		synchronization: {
			status: "fresh",
			canMutate: true,
			teamSnapshot: snapshot,
			workState: null,
			alignmentGraph: null,
			staleReasons: [],
			failureCode: null,
		},
		recovery: [
			resolveExecutionRecovery("provider-timeout"),
			resolveExecutionRecovery("provider-authentication"),
		],
	});
	assert.equal(status.backend.stateGeneration, 7);
	assert.equal(status.backend.backendBuildProtocol.version, "2.0.0");
	assert.equal(status.backend.backendBuildDigest, DEFAULT_BACKEND_BUILD.backendBuildDigest);
	assert.equal(status.backend.supportMatrixDigest, DEFAULT_BACKEND_BUILD.supportMatrixDigest);
	assert.equal(status.backend.activeRuntimeBuildDigest, digest("6"));
	assert.deepEqual(
		status.backend.dshProfiles.map(({id}) => id),
		["codewiki.dsh.broker-host", "codewiki.dsh.managed-run"],
	);
	assert.equal(status.synchronization.state, "current");
	assert.equal(status.synchronization.snapshotDigest, digest("5"));
	assert.deepEqual(status.recovery.map((item) => item.owner), ["broker", "user"]);
	assert.match(status.recovery[1].message, /user authorization/);
});

test("operational status blocks mutation and gives explicit stale/offline recovery UX", () => {
	const stale = projectOperationalStatus({
		backend,
		synchronization: {
			status: "stale",
			canMutate: false,
			teamSnapshot: snapshot,
			workState: null,
			alignmentGraph: null,
			staleReasons: ["knowledge_changed", "config_changed"],
			failureCode: null,
		},
		recovery: [],
	});
	assert.equal(stale.synchronization.canMutate, false);
	assert.match(stale.synchronization.message, /Refresh exact remote state/);
	const offline = projectOperationalStatus({
		backend,
		synchronization: {...stale.synchronization, status: "offline", canMutate: false, teamSnapshot: snapshot, workState: null, alignmentGraph: null, staleReasons: [], failureCode: "remote_unavailable"},
		recovery: [],
	});
	assert.equal(offline.synchronization.state, "offline");
	assert.match(offline.synchronization.message, /canonical mutations are blocked/);
});
