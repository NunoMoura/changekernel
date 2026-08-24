import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import test from "node:test";

import {
	PROJECT_STATE_REF_PREFIX,
	projectServerStatePaths,
	projectStateRef,
	resolveProjectStateRef,
} from "../../../src/project-server/operations/paths.ts";

test("private Project Server paths are external and repository-identity isolated", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-state-paths-"));
	const projectA = join(root, "project-a");
	const projectB = join(root, "project-b");
	const stateRoot = join(root, "private-state");
	try {
		const a = projectServerStatePaths({repoRoot: projectA, stateRoot});
		const again = projectServerStatePaths({repoRoot: projectA, stateRoot});
		const b = projectServerStatePaths({repoRoot: projectB, stateRoot});
		assert.equal(a.repositoryIdentity, again.repositoryIdentity);
		assert.equal(a.projectStateRoot, again.projectStateRoot);
		assert.notEqual(a.repositoryIdentity, b.repositoryIdentity);
		assert.notEqual(a.projectStateRoot, b.projectStateRoot);
		assert.equal(a.registryRoot, join(stateRoot, "registry"));
		assert.equal(a.runtimeBuildsRoot, join(stateRoot, "runtime-builds"));
		assert.equal(a.projectServerRoot, join(a.projectStateRoot, "project-server"));
		assert.equal(a.runtimeRoot, join(a.projectStateRoot, "runtime"));
		assert.equal(a.projectStateRoot.startsWith(resolve(projectA)), false);
		assert.equal(b.projectStateRoot.startsWith(resolve(projectB)), false);
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("project state references are portable and cannot escape private state", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-state-refs-"));
	try {
		const paths = projectServerStatePaths({
			repoRoot: join(root, "project"),
			stateRoot: join(root, "state"),
		});
		const artifact = join(paths.publicationArtifactsRoot, "candidate.tgz");
		const ref = projectStateRef(paths, artifact);
		assert.equal(
			ref,
			`${PROJECT_STATE_REF_PREFIX}runtime/publications/artifacts/candidate.tgz`,
		);
		assert.equal(resolveProjectStateRef(paths, ref), artifact);
		assert.throws(
			() => resolveProjectStateRef(paths, `${PROJECT_STATE_REF_PREFIX}../secret`),
			/Project state reference is invalid/,
		);
		assert.throws(
			() => projectStateRef(paths, join(root, "outside")),
			/must stay inside private project state/,
		);
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("CodeWiki state root cannot be inside governed checkout", () => {
	assert.throws(
		() => projectServerStatePaths({
			repoRoot: "/tmp/codewiki-project",
			stateRoot: "/tmp/codewiki-project/.private",
		}),
		/must stay outside the governed project checkout/,
	);
	assert.throws(
		() => projectServerStatePaths({
			repoRoot: "/tmp/codewiki-state/projects/project",
			stateRoot: "/tmp/codewiki-state",
		}),
		/must stay outside the governed project checkout/,
	);
	assert.throws(
		() => projectServerStatePaths({repoRoot: "/tmp/project", stateRoot: "relative"}),
		/CodeWiki state root must be absolute/,
	);
});
