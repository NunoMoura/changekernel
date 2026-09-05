import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";

import {installLlmReplay} from "@deepseek-ai/dsh-llm-replay";

import {runDshSession} from "../../../src/adapters/dsh/session-runner.ts";
import {gitOid} from "../../../src/kernel/identity/git.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {authorizeAgentRun} from "../../../src/server/effects/agent-runs.ts";

const fixture = fileURLToPath(new URL("./fixtures/replay-session.jsonl", import.meta.url));
const systemPrompt = "Return only the requested bounded assessment.";
const prompt = "Evaluate the exact Decision subject.";
const digest = (character) => `sha256:${character.repeat(64)}`;
const semantic = (protocol, value) => {
	const result = semanticDigest(protocol, value);
	assert.equal(result.ok, true);
	return result.value;
};
const oid = (character) => {
	const result = gitOid("sha1", character.repeat(40));
	assert.equal(result.ok, true);
	return result.value;
};

function authorization() {
	const routeBody = {routeId: "cw:route:model-check", providerId: "cw:provider:replay", modelId: "cw:model:replay"};
	const result = authorizeAgentRun({
		role: "model-check",
		stage: "decision",
		actorId: "cw:actor:model-check",
		authorizationId: "cw:authorization:model-check",
		subject: {
			subjectId: "cw:subject:decision-check",
			subjectDigest: digest("1"),
			repositoryId: "cw:repository:test",
			projectCommit: oid("1"),
			projectTree: oid("2"),
			changeId: "CHG-dsh-session",
			changeTip: oid("3"),
			workId: null,
			artifactCommit: null,
			artifactTree: null,
		},
		route: {...routeBody, routeDigest: semantic("codewiki.agent-route@1.0.0", routeBody)},
		wikiCommit: oid("3"),
		itemIds: ["cw:item:one"],
		feedbackDigest: null,
		material: {systemPrompt, prompt},
		writableScope: [],
		previewSubjectDigest: null,
		attempt: 1,
		predecessor: null,
		issuedAt: "2026-09-05T05:00:00.000Z",
		deadlineAt: "2026-09-05T05:02:00.000Z",
	});
	assert.equal(result.ok, true);
	return result.value;
}

function replayInstaller(context, auth) {
	const replay = installLlmReplay(context, {
		file: fixture,
		providers: [{id: auth.route.providerId, models: [{id: auth.route.modelId}]}],
	});
	return {
		providerReceiptDigest: semantic("codewiki.test-replay-provider@1.0.0", {routeDigest: auth.route.routeDigest}),
		assertComplete: replay.assertConsumed,
		dispose: replay.dispose,
	};
}

test("bounded DSH Session runner executes one exact tool-free Model Check through pinned DSH", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-dsh-session-"));
	try {
		const auth = authorization();
		const times = ["2026-09-05T05:00:01.000Z", "2026-09-05T05:00:02.000Z"];
		const result = await runDshSession({
			authorization: auth,
			material: {
				systemPrompt,
				prompt,
				workspacePath: root,
				sessionRoot: join(root, "sessions"),
				sessionId: "cw:session:model-check",
				resume: false,
			},
			installProvider: replayInstaller,
			clock: () => times.shift(),
		});
		assert.equal(result.outcome, "completed");
		assert.equal(result.output, "DSH vertical slice complete.");
		assert.equal(result.runId, auth.runId);
		assert.match(result.outputDigest, /^sha256:/u);
		assert.match(result.sessionReceiptDigest, /^sha256:/u);
		assert.match(result.rawSessionDigest, /^sha256:/u);
		assert.ok(result.eventCount > 10);
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("DSH Session runner refuses tools, relative custody paths, and pre-cancelled Runs", async () => {
	const auth = authorization();
	const base = {
		authorization: auth,
		material: {systemPrompt, prompt, workspacePath: tmpdir(), sessionRoot: tmpdir(), sessionId: "cw:session:test", resume: false},
		installProvider: replayInstaller,
	};
	await assert.rejects(() => runDshSession({...base, authorization: {...auth, toolIds: ["codewiki.tool:wiki.get"]}}), /authorization is invalid|no admitted tool binding/u);
	await assert.rejects(() => runDshSession({...base, material: {...base.material, workspacePath: "relative"}}), /must be absolute/u);
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(() => runDshSession({...base, signal: controller.signal}), /cancelled before admission/u);
});
