import assert from "node:assert/strict";
import {access, mkdir, mkdtemp, readFile, readdir, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";

import {events, message, scriptedInstaller, scriptedPiLease} from "./fixtures.mjs";

import {runPiSession} from "../../../src/adapters/pi/session-runner.ts";
import {gitOid} from "../../../src/kernel/identity/git.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {authorizeAgentRun} from "../../../src/server/effects/agent-runs.ts";

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
	const routeBody = {routeId: "cw:route:model-check", providerId: "cw:provider:scripted", modelId: "cw:model:scripted"};
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
			changeId: "CHG-pi-session",
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


test("bounded Pi Session runner executes one exact tool-free Model Check through pinned Pi", async () => {
	const root = await mkdtemp(join(tmpdir(), "codewiki-pi-session-"));
	try {
		const auth = authorization();
		const times = ["2026-09-05T05:00:01.000Z", "2026-09-05T05:00:02.000Z"];
		const result = await runPiSession({
			authorization: auth,
			material: {
				systemPrompt,
				prompt,
				workspacePath: root,
				sessionRoot: join(root, "sessions"),
				sessionId: "cw:session:model-check",
				resume: false,
			},
			installProvider: scriptedInstaller,
			clock: () => times.shift(),
		});
		assert.equal(result.outcome, "completed");
		assert.equal(result.output, "Pi vertical slice complete.");
		assert.equal(result.runId, auth.runId);
		assert.match(result.outputDigest, /^sha256:/u);
		assert.match(result.sessionReceiptDigest, /^sha256:/u);
		assert.match(result.rawSessionDigest, /^sha256:/u);
		assert.ok(result.eventCount >= 6);
	} finally {
		await rm(root, {recursive: true, force: true});
	}
});

test("Pi Session runner refuses tools, relative custody paths, and pre-cancelled Runs", async () => {
	const auth = authorization();
	const base = {
		authorization: auth,
		material: {systemPrompt, prompt, workspacePath: tmpdir(), sessionRoot: tmpdir(), sessionId: "cw:session:test", resume: false},
		installProvider: scriptedInstaller,
	};
	await assert.rejects(() => runPiSession({...base, authorization: {...auth, toolIds: ["codewiki.tool:wiki.get"]}}), /authorization is invalid|no admitted tool binding/u);
	await assert.rejects(() => runPiSession({...base, material: {...base.material, workspacePath: "relative"}}), /must be absolute/u);
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(() => runPiSession({...base, signal: controller.signal}), /cancelled before admission/u);
});

async function runFixture(t, run) {
	const root = await mkdtemp(join(tmpdir(), "changekernel-pi-session-"));
	t.after(() => rm(root, {recursive: true, force: true}));
	return {authorization: authorization(), material: {systemPrompt, prompt, workspacePath: root,
		sessionRoot: join(root, "sessions"), sessionId: "cw:session:controlled", resume: false},
		installProvider: () => scriptedPiLease(run)};
}

test("Pi producer uses exact authorized context, not discovered files or an implicit workspace suffix", {timeout: 10000}, async t => {
	const input = await runFixture(t, async (stream, {context}) => {
		assert.equal(context.systemPrompt, systemPrompt);
		assert.deepEqual(context.tools, []);
		assert.equal(context.messages.length, 1);
		assert.doesNotMatch(JSON.stringify(context), /AMBIENT/);
		for (const event of events()) stream.push(event);
	});
	const root = input.material.workspacePath;
	await mkdir(join(root, '.pi', 'extensions'), {recursive: true});
	await writeFile(join(root, 'AGENTS.md'), 'AMBIENT_CONTEXT');
	await writeFile(join(root, '.pi', 'SYSTEM.md'), 'AMBIENT_SYSTEM');
	await writeFile(join(root, '.pi', 'settings.json'), '{"defaultProvider":"ambient","retry":{"enabled":true}}');
	await writeFile(join(root, '.pi', 'models.json'), '{"providers":{"ambient":{"baseUrl":"http://127.0.0.1:1"}}}');
	await writeFile(join(root, '.pi', 'extensions', 'sentinel.mjs'), `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(join(root, 'extension-loaded'))}, 'unexpected'); export default function () {}`);
	assert.equal((await runPiSession(input)).outcome, 'completed');
	await assert.rejects(access(join(root, 'extension-loaded')), {code: 'ENOENT'});
});

for (const patch of [{stopReason: 'length'}, {model: 'other'}, {usage: {...message().usage, input: 0, output: 0, totalTokens: 0}}]) {
	test('Pi producer does not treat resolved prompt or unavailable usage as success', {timeout: 10000}, async t => {
		const input = await runFixture(t, async stream => {for (const event of events(undefined, patch)) stream.push(event);});
		const result = await runPiSession(input);
		assert.equal(result.outcome, 'failed'); assert.equal(result.output, null);
	});
}

test('Pi producer failure is terminal without automatic retry', {timeout: 10000}, async t => {
	let calls = 0;
	const input = await runFixture(t, async () => {calls++; throw new Error('Synthetic provider failure');});
	assert.equal((await runPiSession(input)).outcome, 'failed'); assert.equal(calls, 1);
});

test('Pi producer cancellation reaches an active model call', {timeout: 10000}, async t => {
	const started = Promise.withResolvers(), controller = new AbortController();
	const input = await runFixture(t, async (stream, {options}) => {
		started.resolve(); await new Promise(resolve => options.signal.addEventListener('abort', resolve, {once: true}));
		stream.push({type: 'error', reason: 'aborted', error: message('', {stopReason: 'aborted'})});
	});
	const pending = runPiSession({...input, signal: controller.signal});
	await started.promise; controller.abort();
	const result = await pending;
	assert.equal(result.outcome, 'cancelled'); assert.equal(result.output, null);
});

test('Pi private history resumes only explicitly and rejects old session formats', {timeout: 10000}, async t => {
	let calls = 0;
	const input = await runFixture(t, async (stream, {context}) => {
		calls++;
		assert.equal(context.messages.filter(message => message.role === 'user').length, calls);
		for (const event of events()) stream.push(event);
	});
	const first = await runPiSession(input);
	await assert.rejects(runPiSession(input), /EEXIST/);
	assert.equal(calls, 1);
	const resumedInput = {...input, material: {...input.material, resume: true}};
	const resumed = await runPiSession(resumedInput);
	assert.equal(resumed.outcome, 'completed'); assert.notEqual(first.rawSessionDigest, resumed.rawSessionDigest);
	const [file] = await readdir(input.material.sessionRoot);
	const path = join(input.material.sessionRoot, file);
	const lines = (await readFile(path, 'utf8')).trimEnd().split('\n');
	const header = JSON.parse(lines[0]); header.version = 0; lines[0] = JSON.stringify(header);
	await writeFile(path, lines.join('\n') + '\n');
	await assert.rejects(runPiSession(resumedInput), /Unsupported or mismatched/);
	assert.equal(calls, 2);
});
