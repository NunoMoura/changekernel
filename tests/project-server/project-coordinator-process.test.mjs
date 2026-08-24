import assert from "node:assert/strict";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {
	connectEnsuredProjectCoordinatorClient,
	ensureProjectCoordinatorService,
} from "../../src/project-server/coordinator/process.ts";
import {
	startProjectCoordinatorService,
	stopProjectCoordinatorService,
} from "../../src/project-server/coordinator/service.ts";
import {readProjectCoordinatorEndpoint} from "../../src/project-server/coordinator/endpoint.ts";

async function projectFixture(prefix) {
	const base = await mkdtemp(join(tmpdir(), prefix));
	const root = join(base, "project");
	const stateRoot = join(base, "state");
	await mkdir(join(root, ".codewiki"), {recursive: true});
	await writeFile(join(root, ".codewiki", "config.json"), "{}\n");
	return {base, root, stateRoot};
}

test("Project Server process fails closed without an injected daemon spawner", async () => {
	const fixture = await projectFixture("codewiki-coordinator-no-spawner-");
	try {
		await assert.rejects(
			() => ensureProjectCoordinatorService(fixture.root, {stateRoot: fixture.stateRoot}),
			/Project Server daemon spawner is required\./,
		);
	} finally {
		await rm(fixture.base, {recursive: true, force: true});
	}
});

test("Project Server process ensure reuses one responsive service", async () => {
	const fixture = await projectFixture("codewiki-coordinator-process-");
	let service;
	let starts = 0;
	const options = {
		timeoutMs: 2_000,
		stateRoot: fixture.stateRoot,
		spawnDaemon(repoRoot, daemonOptions) {
			starts += 1;
			void startProjectCoordinatorService(repoRoot, {
				generationId: "generation:ensured",
				stateRoot: daemonOptions?.stateRoot,
			}).then((started) => {
				service = started;
			});
		},
	};
	try {
		const first = await ensureProjectCoordinatorService(fixture.root, options);
		const second = await ensureProjectCoordinatorService(fixture.root, {
			...options,
			spawnDaemon() {
				throw new Error("responsive service must be reused");
			},
		});
		assert.equal(first.generationId, "generation:ensured");
		assert.equal(second.generationId, first.generationId);
		assert.equal(starts, 1);
		const client = await connectEnsuredProjectCoordinatorClient(
			fixture.root,
			{
				clientId: "test:ensured",
				kind: "test",
				supervision: "approved",
			},
			options,
		);
		assert.equal((await client.state()).clientCount, 1);
		await client.disconnect();
		await stopProjectCoordinatorService(fixture.root, {
			timeoutMs: 2_000,
			stateRoot: fixture.stateRoot,
		});
		assert.equal(
			await readProjectCoordinatorEndpoint(fixture.root, fixture.stateRoot),
			undefined,
		);
	} finally {
		if (service) await service.close();
		await rm(fixture.base, {recursive: true, force: true});
	}
});
