import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {readFile, mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {createContainerIntakeClient, openSqliteContainerIntake} from "../../../src/index.ts";

// Optional external copy supports negative-control mutation without editing frozen inputs.
const corpus = process.env.CK_INTAKE_RECOVERY_CASES ?? fileURLToPath(new URL("./intake-recovery-conformance.json", import.meta.url));
const {fixtures: {owner, otherOwner, container, otherContainer, proposal, competitor, otherProposal}, cases} =
	JSON.parse(await readFile(corpus, "utf8"));
const processFile = fileURLToPath(new URL("./intake-recovery-process.mjs", import.meta.url));
const WAIT_MS = 15_000; // Exceeds reference store's 5s lock timeout; never proves ordering by sleep.

function ok(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; }
function error(result, code) { assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(result.error.code, code); }
function client(store) { return createContainerIntakeClient(store); }
function intent(receipt, input, expected) {
	assert.equal(receipt.state, expected.state);
	assert.equal(receipt.containerId, input.containerId);
	assert.equal(receipt.requestId, input.requestId);
	assert.equal(receipt.what, expected.what);
	assert.equal(receipt.why, expected.why);
	assert.equal(typeof receipt.changeId, "string");
	assert.notEqual(receipt.changeId.length, 0);
}
function rows(path, expected) {
	// Reference-specific duplicate inspection; no table/hash contract in portable data.
	const db = new DatabaseSync(path, {readOnly: true});
	try { assert.equal(db.prepare("SELECT count(*) AS n FROM ck_intake_changes").get().n, expected); }
	finally { db.close(); }
}
function processClient(mode, path, actor = owner, input = proposal) {
	const child = spawn(process.execPath, ["--experimental-strip-types", processFile, mode, path, actor, JSON.stringify(input)],
		{stdio: ["pipe", "pipe", "pipe"]});
	let text = "", diagnostic = "", stopped = false, failure;
	const pending = [];
	const queued = [];
	child.stderr.setEncoding("utf8").on("data", part => { diagnostic += part; });
	child.stdout.setEncoding("utf8").on("data", part => {
		text += part;
		let end;
		while ((end = text.indexOf("\n")) !== -1) {
			const message = JSON.parse(text.slice(0, end));
			text = text.slice(end + 1);
			if (pending.length) pending.shift()(message);
			else queued.push(message);
		}
	});
	child.on("error", err => { failure = err; });
	child.on("close", (code, signal) => {
		stopped = true;
		failure ??= new Error(`child exited ${code ?? signal}: ${diagnostic}`);
		while (pending.length) pending.shift()(null);
	});
	return {
		async next(event) {
			const message = queued.length ? queued.shift() : await new Promise((resolve, reject) => {
				const timer = setTimeout(() => { pending.splice(pending.indexOf(deliver), 1); reject(new Error(`child ${mode} timed out waiting for ${event}: ${diagnostic}`)); }, WAIT_MS);
				const deliver = value => { clearTimeout(timer); resolve(value); };
				if (stopped) deliver(null);
				else pending.push(deliver);
			});
			if (!message) throw failure ?? new Error(`child ${mode} exited`);
			assert.equal(message.event, event, JSON.stringify(message));
			return message;
		},
		command(value) { assert.equal(stopped, false, `child ${mode} already exited: ${diagnostic}`); child.stdin.write(value + "\n"); },
		async stop() {
			if (stopped) return;
			child.kill("SIGKILL");
			await new Promise((resolve, reject) => {
				const timer = setTimeout(() => reject(new Error(`child ${mode} did not exit`)), WAIT_MS);
				child.once("close", () => { clearTimeout(timer); resolve(); });
			});
		},
	};
}
async function freshProposal(path, input, actor) {
	const child = processClient("propose", path, actor, input);
	try { await child.next("ready"); child.command("go"); return (await child.next("result")).result; }
	finally { await child.stop(); }
}
async function withStore(run) {
	const root = await mkdtemp(join(tmpdir(), "ck-intake-recovery-"));
	try { await run(join(root, "app.sqlite")); }
	finally { await rm(root, {recursive: true, force: true}); }
}
function initialize(path, entries) {
	const store = openSqliteContainerIntake(path);
	try { for (const [identity, actor] of entries) ok(client(store).create(identity, actor)); }
	finally { store.close(); }
}

const scenarios = {
	"lost-reply-after-commit": async (path, {expect}) => {
		initialize(path, [[container, owner]]);
		const child = processClient("lost-reply", path);
		try {
			await child.next("ready");
			child.command("go");
			await child.next("committed"); // Commit happened; reply withheld from caller.
		} finally { await child.stop(); }
		const receipt = ok(await freshProposal(path, proposal, owner));
		intent(receipt, proposal, expect);
		const store = openSqliteContainerIntake(path);
		try { assert.deepEqual(ok(client(store).read(container, receipt.changeId, owner)), receipt); }
		finally { store.close(); }
		assert.deepEqual(ok(await freshProposal(path, proposal, owner)), receipt);
		rows(path, expect.rows);
	},
	"competing-first-proposals": async (path, {expect}) => {
		initialize(path, [[container, owner]]);
		const contenders = [processClient("propose", path, owner, proposal), processClient("propose", path, owner, competitor)];
		try {
			await Promise.all(contenders.map(child => child.next("ready")));
			for (const child of contenders) child.command("go");
			const results = await Promise.all(contenders.map(child => child.next("result").then(message => message.result)));
			assert.equal(results.filter(result => result.ok).length, 1);
			const winnerIndex = results.findIndex(result => result.ok);
			const winnerInput = [proposal, competitor][winnerIndex];
			const receipt = ok(results[winnerIndex]);
			assert.ok(expect.allowedWhy.includes(receipt.why));
			intent(receipt, winnerInput, {...expect, why: winnerInput.why});
			error(results[1 - winnerIndex], expect.loser);
			assert.deepEqual(ok(await freshProposal(path, winnerInput, owner)), receipt);
			error(await freshProposal(path, [proposal, competitor][1 - winnerIndex], owner), expect.loser);
			const store = openSqliteContainerIntake(path);
			try { assert.deepEqual(ok(client(store).read(container, receipt.changeId, owner)), receipt); }
			finally { store.close(); }
			rows(path, expect.rows);
		} finally { await Promise.all(contenders.map(child => child.stop())); }
	},
	"lock-timeout-and-retry": async (path, {expect}) => {
		initialize(path, [[container, owner]]);
		const store = openSqliteContainerIntake(path);
		const lock = processClient("lock", path);
		try {
			await lock.next("ready"); // BEGIN IMMEDIATE held in separate process.
			error(client(store).propose(proposal, owner), expect.first);
			lock.command("release");
			await lock.next("released");
			const receipt = ok(client(store).propose(proposal, owner));
			intent(receipt, proposal, expect);
			assert.deepEqual(ok(client(store).read(container, receipt.changeId, owner)), receipt);
			assert.deepEqual(ok(await freshProposal(path, proposal, owner)), receipt);
			rows(path, expect.rows);
		} finally { await lock.stop(); store.close(); }
	},
	"independent-containers": async (path, {expect}) => {
		initialize(path, [[container, owner], [otherContainer, otherOwner]]);
		const first = ok(await freshProposal(path, proposal, owner));
		const second = ok(await freshProposal(path, otherProposal, otherOwner));
		intent(first, proposal, {state: expect.state, what: expect.firstWhat, why: expect.firstWhy});
		intent(second, otherProposal, {state: expect.state, what: expect.secondWhat, why: expect.secondWhy});
		const store = openSqliteContainerIntake(path);
		try {
			assert.deepEqual(ok(client(store).read(container, first.changeId, owner)), first);
			assert.deepEqual(ok(client(store).read(otherContainer, second.changeId, otherOwner)), second);
			error(client(store).read(container, first.changeId, otherOwner), expect.denied);
			error(client(store).read(otherContainer, second.changeId, owner), expect.denied);
			error(client(store).propose(otherProposal, owner), expect.denied);
			error(client(store).propose(proposal, otherOwner), expect.denied);
		} finally { store.close(); }
		assert.deepEqual(ok(await freshProposal(path, proposal, owner)), first);
		assert.deepEqual(ok(await freshProposal(path, otherProposal, otherOwner)), second);
		rows(path, expect.rows);
	},
};
assert.deepEqual(cases.map(entry => entry.id).sort(), Object.keys(scenarios).sort());
for (const scenario of cases) {
	test(`intake recovery: ${scenario.id}`, async () => withStore(path => scenarios[scenario.id](path, scenario)));
}
