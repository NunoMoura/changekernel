import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {cp} from "node:fs/promises";
import {promisify} from "node:util";
import test from "node:test";

import {createCodewikiClient} from "../../../src/api/client/index.ts";
import {createLocalProjectServer} from "../../../src/adapters/git/local-server.ts";

const execFileAsync = promisify(execFile);

async function makeGitProject(label) {
	const root = await mkdtemp(join(tmpdir(), `codewiki-local-${label}-`));
	await execFileAsync("git", ["init", "-q", "-b", "main"], {cwd: root});
	await execFileAsync("git", ["config", "user.email", "console@test"], {cwd: root});
	await execFileAsync("git", ["config", "user.name", "Console Test"], {cwd: root});
	return root;
}

const sourceRoot = fileURLToPath(new URL("../../..", import.meta.url));

async function commitCodewiki(root) {
	await cp(join(sourceRoot, ".codewiki", "wiki", "items"), join(root, ".codewiki", "wiki", "items"), {recursive: true});
	await execFileAsync("git", ["add", ".codewiki"], {cwd: root});
	await execFileAsync("git", ["commit", "-q", "-m", "bootstrap CodeWiki"], {cwd: root});
}

function clientFor(local) {
	return createCodewikiClient({
		repositoryId: local.repositoryId,
		transport: {send: (request) => local.server.handle(request)},
		client: {kind: "cli", instanceId: "cw:client:local-test"},
		authentication: {identityRef: "cw:identity:local-console", proof: `local-console:${local.repositoryId}`},
	}).value;
}

test("local composition bootstraps, binds, and serves real reads over real Git", async () => {
	const root = await makeGitProject("bind");
	try {
		const composed = await createLocalProjectServer({projectRoot: root, projectName: "Local Test"});
		assert.equal(composed.ok, true, composed.ok ? "" : composed.error.message);
		await commitCodewiki(root);
		assert.equal(composed.value.objectFormat, "sha1");
		assert.match(composed.value.repositoryId, /^cw:repository:local-[0-9a-f]{16}$/u);

		const client = clientFor(composed.value);
		const expiresAt = "2036-01-01T00:00:00Z";
		const discover = await client.discover({requestId: "cw:request:d1", expiresAt});
		assert.equal(discover.ok, true, discover.ok ? "" : discover.error.message);
		assert.equal(discover.value.project, "Local Test");
		assert.equal(discover.value.status, "available");

		const status = await client.status({requestId: "cw:request:s1", expiresAt, source: {kind: "canonical"}});
		assert.equal(status.ok, true, status.ok ? "" : status.error.message);
		assert.equal(status.value.project, "Local Test");
		assert.equal(status.value.changes.total, 0);
		assert.equal(status.value.status, "ready");
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("local composition is idempotent and rejects mutations fail-closed", async () => {
	const root = await makeGitProject("idem");
	try {
		const first = await createLocalProjectServer({projectRoot: root, projectName: "Idem"});
		assert.equal(first.ok, true);
		const second = await createLocalProjectServer({projectRoot: root, projectName: "Idem"});
		assert.equal(second.ok, true);
		assert.equal(first.value.repositoryId, second.value.repositoryId);

		const client = clientFor(first.value);
		const denied = await client.proposeChanges({
			requestId: "cw:request:p1",
			expiresAt: "2036-01-01T00:00:00Z",
			commandId: "cw:command:local-readonly",
			expectedProjectHead: null,
			proposals: [],
		});
		assert.equal(denied.ok, false, "read-only grants must not authorize proposals");
		assert.ok(
			["authorization_denied", "invalid_request"].includes(denied.error.code),
			`mutations must fail closed, got ${denied.error.code}`,
		);
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("local composition fails closed on a non-Git root", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-local-nogit-"));
	try {
		const composed = await createLocalProjectServer({projectRoot: root});
		assert.equal(composed.ok, false);
		assert.equal(composed.error.code, "bootstrap_failed");
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});
