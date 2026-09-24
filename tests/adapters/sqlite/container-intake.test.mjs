import assert from "node:assert/strict";
import {execFileSync, spawn} from "node:child_process";
import {readFile, mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {createContainerIntakeClient, openSqliteContainerIntake} from "../../../src/index.ts";

// Portable inputs and semantic expectations live in JSON. Actor values below are
// trusted host context passed separately to the client, never proposal fields.
const {fixtures: {container, otherContainer, proposal, conflictingProposal, owner, outsider}, cases} =
	JSON.parse(await readFile(new URL("./intake-conformance.json", import.meta.url), "utf8"));

async function withDatabase(run) {
	const root = await mkdtemp(join(tmpdir(), "ck-intake-"));
	try { await run(join(root, "app.sqlite")); }
	finally { await rm(root, {recursive: true, force: true}); }
}
function ok(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; }
function error(result, code) { assert.equal(result.ok, false); assert.equal(result.error.code, code); }
function client(store) { return createContainerIntakeClient(store); }
function assertIntent(receipt, expected) {
	assert.equal(receipt.state, expected.state);
	assert.equal(receipt.what, expected.what);
	assert.equal(receipt.why, expected.why);
	assert.equal(receipt.containerId, proposal.containerId);
	assert.equal(receipt.requestId, proposal.requestId);
}

// SQLite-specific inspection: semantic equality alone cannot rule out extra rows.
function assertSingleRow(path) {
	const db = new DatabaseSync(path, {readOnly: true});
	try { assert.equal(db.prepare("SELECT count(*) AS n FROM ck_intake_changes").get().n, 1); }
	finally { db.close(); }
}

// Separate process: no shared in-memory client or store. Result is still checked
// against the same semantic case; process setup is reference-adapter plumbing.
const childCode = `import {openSqliteContainerIntake,createContainerIntakeClient} from './src/index.ts';
	const s=openSqliteContainerIntake(process.argv[1]);
	const result=createContainerIntakeClient(s).propose(JSON.parse(process.argv[2]),process.argv[3]);
	s.close(); console.log(JSON.stringify(result));`;
const childArgs = (path, input) => ["--experimental-strip-types", "--input-type=module", "-e", childCode, path, JSON.stringify(input), owner];
function submit(path, input) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, childArgs(path, input), {cwd: process.cwd()});
		let output = "", diagnostic = "";
		child.stdout.setEncoding("utf8").on("data", chunk => { output += chunk; });
		child.stderr.setEncoding("utf8").on("data", chunk => { diagnostic += chunk; });
		child.on("error", reject);
		child.on("close", status => status === 0 ? resolve(JSON.parse(output)) : reject(new Error(diagnostic)));
	});
}

const referenceCases = {
	"reopen-and-retry": async (path, {expect}) => {
		let store = openSqliteContainerIntake(path), intake = client(store);
		let first;
		try {
			ok(intake.create(container, owner));
			first = ok(intake.propose(proposal, owner));
			assertIntent(first, expect);
		} finally { store.close(); }
		store = openSqliteContainerIntake(path); intake = client(store);
		try {
			assert.deepEqual(ok(intake.open(container, owner)), container);
			assert.deepEqual(ok(intake.create(container, owner)), container);
			assert.deepEqual(ok(intake.read(container, first.changeId, owner)), first);
			assert.deepEqual(ok(intake.propose(proposal, owner)), first);
			error(intake.propose(conflictingProposal, owner), expect.conflictingRetry);
			assert.deepEqual(ok(intake.read(container, first.changeId, owner)), first);
			assertSingleRow(path);
		} finally { store.close(); }
	},
	"trusted-actor-and-container-isolation": async (path, {expect}) => {
		const store = openSqliteContainerIntake(path), intake = client(store);
		try {
			ok(intake.create(container, owner));
			const receipt = ok(intake.propose(proposal, owner));
			for (const actor of [outsider, null, {id: owner}]) {
				error(intake.open(container, actor), expect.unauthorized);
				error(intake.create(container, actor), expect.unauthorized);
				error(intake.propose(proposal, actor), expect.unauthorized);
				error(intake.read(container, receipt.changeId, actor), expect.unauthorized);
			}
			ok(intake.create(otherContainer, outsider));
			error(intake.read(otherContainer, receipt.changeId, outsider), expect.unauthorized);
			error(intake.read({containerId: "app:container:missing"}, receipt.changeId, owner), expect.unauthorized);
			assert.deepEqual(ok(intake.read(container, receipt.changeId, owner)), receipt);
		} finally { store.close(); }
	},
	"fresh-process-and-concurrent-retry": async (path, {expect}) => {
		const setup = openSqliteContainerIntake(path);
		try { ok(client(setup).create(container, owner)); }
		finally { setup.close(); }
		// Compete on first insertion, not only on already-retained retries.
		const [first, second] = await Promise.all([submit(path, proposal), submit(path, proposal)]);
		const receipt = ok(first);
		assert.deepEqual(ok(second), receipt);
		const one = openSqliteContainerIntake(path), two = openSqliteContainerIntake(path);
		try {
			assert.deepEqual(ok(client(one).propose(proposal, owner)), receipt);
			assert.deepEqual(ok(client(two).propose(proposal, owner)), receipt);
			const fresh = JSON.parse(execFileSync(process.execPath, childArgs(path, proposal), {cwd: process.cwd(), encoding: "utf8"}));
			assert.deepEqual(ok(fresh), receipt);
		} finally { one.close(); two.close(); }
		const [retained, conflict] = await Promise.all([submit(path, proposal), submit(path, conflictingProposal)]);
		assert.deepEqual(ok(retained), receipt);
		error(conflict, expect.conflictingRetry);
		assertSingleRow(path);
	},
	"failed-insertion-and-repair": async (path, {expect}) => {
		const store = openSqliteContainerIntake(path), intake = client(store);
		const db = new DatabaseSync(path);
		try {
			ok(intake.create(container, owner));
			// Reference-only fault injection; not a portable schema or failure mechanism.
			db.exec("CREATE TRIGGER refuse_intake BEFORE INSERT ON ck_intake_changes BEGIN SELECT RAISE(ABORT, 'test failure'); END");
			error(intake.propose(proposal, owner), expect.failedInsertion);
			assert.equal(db.prepare("SELECT count(*) AS n FROM ck_intake_changes").get().n, 0);
			db.exec("DROP TRIGGER refuse_intake");
			const receipt = ok(intake.propose(proposal, owner));
			assert.deepEqual(ok(intake.read(container, receipt.changeId, owner)), receipt);
			assertSingleRow(path);
		} finally { db.close(); store.close(); }
	},
};

for (const scenario of cases) {
	test(`intake conformance: ${scenario.id}`, async () => withDatabase(path => referenceCases[scenario.id](path, scenario)));
}

test("intake: invalid input, retained corruption, and unsupported schema fail closed", async () => withDatabase(path => {
	const store = openSqliteContainerIntake(path), intake = client(store);
	try {
		ok(intake.create(container, owner));
		for (const input of [{...proposal, owner}, {...proposal, what: "e\u0301"}, {...proposal, why: ""}, {...proposal, requestId: "bad"}]) {
			error(intake.propose(input, owner), "invalid_input");
		}
		const receipt = ok(intake.propose(proposal, owner));
		const db = new DatabaseSync(path);
		try {
			db.prepare("UPDATE ck_intake_changes SET what_text = ? WHERE change_id = ?").run("tampered", receipt.changeId);
			error(intake.read(container, receipt.changeId, owner), "unavailable");
			error(intake.propose(proposal, owner), "unavailable");
			db.prepare("UPDATE ck_intake_schema SET version = ? WHERE id = 1").run("unsupported");
		} finally { db.close(); }
	} finally { store.close(); }
	assert.throws(() => openSqliteContainerIntake(path), /Unsupported container intake schema/);
}));
