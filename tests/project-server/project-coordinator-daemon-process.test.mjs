import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";

import {createChangeRecord} from "../../src/changes/records.ts";
import {ChangeTraceStore} from "../../src/changes/trace/store.ts";
import {startProjectCoordinatorDaemonProcess} from "../../src/project-server/coordinator/daemon-process.ts";
import {connectProjectCoordinatorClient} from "../../src/project-server/coordinator/service.ts";
import {acceptedChangeFixture} from "../helpers/accepted-change.mjs";

test("standalone Project Server daemon does not auto-execute pending Decisions", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-project-daemon-"));
	let daemon;
	let client;
	let adapterCalls = 0;
	try {
		await new ChangeTraceStore({repoRoot: root}).write({
			expectedHead: null,
			records: [
				createChangeRecord(
					acceptedChangeFixture({id: "CHG-project-daemon-semantic"}),
				),
			],
			message: "Persist autonomous semantic Change",
			actor: "user:maintainer",
			createdAt: "2026-08-10T00:00:00.000Z",
		});
		daemon = await startProjectCoordinatorDaemonProcess(root, {
			service: {
				semanticContext: {
					decision: {
						authority: {
							kind: "user",
							actor: "user:maintainer",
							ref: "confirmation:CHG-project-daemon-semantic",
						},
						occurredAt: "2026-08-10T00:00:01.000Z",
					},
				},
				semanticAdapters: {
					decision(invocation) {
						adapterCalls += 1;
						assert.equal(invocation.change.id, "CHG-project-daemon-semantic");
						return {
							disposition: "approve",
							rationale: "Approve coordinator-owned semantic execution.",
						};
					},
				},
			},
		});
		client = await connectProjectCoordinatorClient(root, {
			clientId: "test:standalone-daemon",
			kind: "test",
			supervision: "approved",
		});
		assert.equal(client.semanticExecution, "service");
		const receipts = await client.react({kind: "manual_resume"});
		assert.equal(adapterCalls, 0);
		assert.deepEqual(receipts, []);
	} finally {
		if (client) await client.disconnect().catch(() => undefined);
		if (daemon) await daemon.close().catch(() => undefined);
		await rm(root, {recursive: true, force: true});
	}
});
