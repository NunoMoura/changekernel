import assert from "node:assert/strict";
import {execFileSync, spawn} from "node:child_process";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {createContainerIntakeClient, openSqliteContainerIntake} from "../../../src/index.ts";

const container = {containerId: "app:container:alpha"};
const proposal = {...container, requestId: "app:request:one", what: "Replace value — exact text", why: "Existing value is wrong."};

async function withDatabase(run) {
	const root = await mkdtemp(join(tmpdir(), "ck-intake-"));
	try { await run(join(root, "app.sqlite")); }
	finally { await rm(root, {recursive: true, force: true}); }
}
function ok(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; }
function error(result, code) { assert.equal(result.ok, false); assert.equal(result.error.code, code); }

test("intake: create/open never resets owner or history; restart and lost-response retry", async () => withDatabase(path => {
	let store = openSqliteContainerIntake(path), client = createContainerIntakeClient(store);
	ok(client.create(container, "owner"));
	const first = ok(client.propose(proposal, "owner"));
	assert.equal(first.state, "awaiting-assessment");
	store.close();
	store = openSqliteContainerIntake(path); client = createContainerIntakeClient(store);
	try {
		assert.deepEqual(ok(client.open(container, "owner")), container);
		assert.deepEqual(ok(client.create(container, "owner")), container);
		assert.deepEqual(ok(client.read(container, first.changeId, "owner")), first);
		assert.deepEqual(ok(client.propose(proposal, "owner")), first);
		error(client.propose({...proposal, why: "Different cause"}, "owner"), "conflict");
		assert.deepEqual(ok(client.read(container, first.changeId, "owner")), first);
	} finally { store.close(); }
}));

test("intake: owner isolation and denied cross-container reads, writes, and create", async () => withDatabase(path => {
	const store = openSqliteContainerIntake(path), client = createContainerIntakeClient(store);
	try {
		ok(client.create(container, "owner"));
		const receipt = ok(client.propose(proposal, "owner"));
		for (const actor of ["other", null, {id: "owner"}]) {
			error(client.open(container, actor), "denied");
			error(client.create(container, actor), "denied");
			error(client.propose(proposal, actor), "denied");
			error(client.read(container, receipt.changeId, actor), "denied");
		}
		const another = {containerId: "app:container:beta"};
		ok(client.create(another, "other"));
		error(client.read(another, receipt.changeId, "other"), "denied");
		error(client.read({containerId: "app:container:missing"}, receipt.changeId, "owner"), "denied");
		assert.deepEqual(ok(client.read(container, receipt.changeId, "owner")), receipt);
	} finally { store.close(); }
}));

test("intake: two connections and a fresh process reconcile a request without duplicates", async () => withDatabase(path => {
	const one = openSqliteContainerIntake(path), two = openSqliteContainerIntake(path);
	try {
		const first = createContainerIntakeClient(one), second = createContainerIntakeClient(two);
		ok(first.create(container, "owner"));
		const receipt = ok(first.propose(proposal, "owner"));
		assert.deepEqual(ok(second.propose(proposal, "owner")), receipt);
		const source = `import {openSqliteContainerIntake,createContainerIntakeClient} from './src/index.ts';
			const s=openSqliteContainerIntake(process.argv[1]); const c=createContainerIntakeClient(s);
			const result=c.propose(JSON.parse(process.argv[2]), 'owner'); s.close();
			console.log(JSON.stringify(result));`;
		const processResult = JSON.parse(execFileSync(process.execPath,
			["--experimental-strip-types", "--input-type=module", "-e", source, path, JSON.stringify(proposal)],
			{cwd: process.cwd(), encoding: "utf8"}));
		assert.deepEqual(ok(processResult), receipt);
		const db = new DatabaseSync(path, {readOnly: true});
		try { assert.equal(db.prepare("SELECT count(*) AS n FROM ck_intake_changes").get().n, 1); }
		finally { db.close(); }
	} finally { one.close(); two.close(); }
}));

test("intake: concurrent processes submit one receipt and reject conflicting content", async () => withDatabase(async path => {
	const store = openSqliteContainerIntake(path);
	try { ok(createContainerIntakeClient(store).create(container, "owner")); }
	finally { store.close(); }
	const code = `import {openSqliteContainerIntake,createContainerIntakeClient} from './src/index.ts';
		const s=openSqliteContainerIntake(process.argv[1]);
		const result=createContainerIntakeClient(s).propose(JSON.parse(process.argv[2]),'owner');
		s.close(); console.log(JSON.stringify(result));`;
	function submit(value) {
		return new Promise((resolve, reject) => {
			const child = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", code, path, JSON.stringify(value)],
				{cwd: process.cwd()});
			let output = "", diagnostic = "";
			child.stdout.setEncoding("utf8").on("data", chunk => { output += chunk; });
			child.stderr.setEncoding("utf8").on("data", chunk => { diagnostic += chunk; });
			child.on("error", reject);
			child.on("close", status => status === 0 ? resolve(JSON.parse(output)) : reject(new Error(diagnostic)));
		});
	}
	const [first, second] = await Promise.all([submit(proposal), submit(proposal)]);
	assert.deepEqual(ok(first), ok(second));
	const [retained, conflict] = await Promise.all([submit(proposal), submit({...proposal, why: "Another intent"})]);
	assert.deepEqual(ok(retained), first.value);
	error(conflict, "conflict");
	const db = new DatabaseSync(path, {readOnly: true});
	try { assert.equal(db.prepare("SELECT count(*) AS n FROM ck_intake_changes").get().n, 1); }
	finally { db.close(); }
}));

test("intake: failed insertion retains no receipt; retry after repair succeeds", async () => withDatabase(path => {
	const store = openSqliteContainerIntake(path), client = createContainerIntakeClient(store);
	const db = new DatabaseSync(path);
	try {
		ok(client.create(container, "owner"));
		db.exec("CREATE TRIGGER refuse_intake BEFORE INSERT ON ck_intake_changes BEGIN SELECT RAISE(ABORT, 'test failure'); END");
		error(client.propose(proposal, "owner"), "unavailable");
		assert.equal(db.prepare("SELECT count(*) AS n FROM ck_intake_changes").get().n, 0);
		db.exec("DROP TRIGGER refuse_intake");
		const receipt = ok(client.propose(proposal, "owner"));
		assert.deepEqual(ok(client.read(container, receipt.changeId, "owner")), receipt);
	} finally { db.close(); store.close(); }
}));

test("intake: invalid input, retained corruption, and unsupported schema fail closed", async () => withDatabase(path => {
	const store = openSqliteContainerIntake(path), client = createContainerIntakeClient(store);
	try {
		ok(client.create(container, "owner"));
		for (const input of [{...proposal, owner: "owner"}, {...proposal, what: "e\u0301"}, {...proposal, why: ""}, {...proposal, requestId: "bad"}]) {
			error(client.propose(input, "owner"), "invalid_input");
		}
		const receipt = ok(client.propose(proposal, "owner"));
		const db = new DatabaseSync(path);
		try {
			db.prepare("UPDATE ck_intake_changes SET what_text = ? WHERE change_id = ?").run("tampered", receipt.changeId);
			error(client.read(container, receipt.changeId, "owner"), "unavailable");
			error(client.propose(proposal, "owner"), "unavailable");
			db.prepare("UPDATE ck_intake_schema SET version = ? WHERE id = 1").run("unsupported");
		} finally { db.close(); }
	} finally { store.close(); }
	assert.throws(() => openSqliteContainerIntake(path), /Unsupported container intake schema/);
}));
