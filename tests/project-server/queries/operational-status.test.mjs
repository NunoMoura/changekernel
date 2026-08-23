import assert from "node:assert/strict";
import test from "node:test";

import {projectOperationalStatus} from "../../../src/project-server/queries/operational-status.ts";
import {resolveExecutionRecovery} from "../../../src/project-server/workers/execution-recovery.ts";

const digest = (character) => `sha256:${character.repeat(64)}`;
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
	assert.equal(status.synchronization.state, "current");
	assert.equal(status.synchronization.snapshotDigest, digest("5"));
	assert.deepEqual(status.recovery.map((item) => item.owner), ["broker", "user"]);
	assert.match(status.recovery[1].message, /user authorization/);
});

test("operational status blocks mutation and gives explicit stale/offline recovery UX", () => {
	const stale = projectOperationalStatus({
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
		synchronization: {...stale.synchronization, status: "offline", canMutate: false, teamSnapshot: snapshot, workState: null, alignmentGraph: null, staleReasons: [], failureCode: "remote_unavailable"},
		recovery: [],
	});
	assert.equal(offline.synchronization.state, "offline");
	assert.match(offline.synchronization.message, /canonical mutations are blocked/);
});
