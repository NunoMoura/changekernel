import assert from "node:assert/strict";
import {execFileSync, spawn, spawnSync} from "node:child_process";
import {DatabaseSync} from "node:sqlite";
import test from "node:test";
import {openSqliteContainerCandidates, openSqliteContainerIntake} from "../../../src/index.ts";
import {container, types, proposal, ok, fail, plain, ref, entity, order, withDb, clients, setup, request} from "./candidate-fixtures.mjs";

const moduleUrl = new URL("../../../src/index.ts", import.meta.url).href;
function counts(path) {
	const db = new DatabaseSync(path, {readOnly: true});
	try { return {batches: db.prepare("SELECT count(*) AS n FROM ck_candidate_batches").get().n, entities: db.prepare("SELECT count(*) AS n FROM ck_generic_entities").get().n}; }
	finally { db.close(); }
}

test("candidate: describe distinguishes unbound scope, observed empty generic State, and present State", async () => withDb(path => {
	const s = clients(path);
	try {
		ok(s.change.create(container, "owner"));
		assert.deepEqual(ok(s.client.describe(container, "owner")), {definition: null, genericState: "unknown", capabilities: {prepare: false, publish: false, checks: false}});
		const definition = ok(s.client.install({...container, types, expectedDigest: null}, "owner"));
		assert.deepEqual(ok(s.client.describe(container, "owner")), {definition, genericState: "empty", capabilities: {prepare: true, publish: false, checks: false}});
		assert.deepEqual(ok(s.client.install({...container, types, expectedDigest: null}, "owner")), definition);
		fail(s.client.install({...container, types: types.slice(1), expectedDigest: null}, "owner"), "stale");
		fail(s.client.describe(container, "other"), "denied");
		fail(s.client.install({...container, types, expectedDigest: definition.digest}, "other"), "denied");
		const db = new DatabaseSync(path);
		try { db.prepare("INSERT INTO ck_generic_entities VALUES (?, ?, ?)").run(container.containerId, "app:outside", '{}'); }
		finally { db.close(); }
		// Presence is an observation, not a claim that the row is a valid governed value.
		assert.equal(ok(s.client.describe(container, "owner")).genericState, "present");
	} finally { s.close(); }
}));

test("candidate: three entities and links survive restart without becoming current State", async () => withDb(path => {
	let s = clients(path);
	try {
		const {change, definition} = setup(s), input = request(change, definition);
		const first = ok(s.client.prepare(input, "owner"));
		assert.equal(first.status, "prepared-only");
		assert.equal(first.freshness, "current");
		assert.deepEqual(plain(first.effects), input.effects);
		assert.equal(first.grounds.length, 3);
		assert.ok(first.grounds.every(ground => ground.observation.status === "absent"));
		assert.deepEqual(counts(path), {batches: 1, entities: 0});
		input.effects[0].after.data.title = "Mutated client object";
		assert.equal(first.effects[0].after.data.title, "Opening show");
		s.close(); s = clients(path);
		assert.deepEqual(ok(s.client.read(container, first.candidateId, "owner")), first);
		assert.deepEqual(ok(s.client.prepare(request(change, definition), "owner")), first);
		assert.equal(ok(s.change.read(container, change.changeId, "owner")).state, "awaiting-assessment");
		assert.equal(ok(s.client.describe(container, "owner")).genericState, "empty");
		fail(s.client.read(container, first.candidateId, "other"), "denied");
		ok(s.change.create({containerId: "app:container:two"}, "owner"));
		fail(s.client.read({containerId: "app:container:two"}, first.candidateId, "owner"), "denied");
		const revised = request(change, definition);
		revised.requestId = "app:request:revision";
		revised.effects[2].after.data.budget = 150000;
		const next = ok(s.client.prepare(revised, "owner"));
		assert.notEqual(next.candidateId, first.candidateId);
		assert.equal(next.changeId, first.changeId);
		assert.deepEqual(ok(s.client.read(container, first.candidateId, "owner")), first);
		assert.deepEqual(counts(path), {batches: 2, entities: 0});
	} finally { s.close(); }
}));

test("candidate: whole-batch retry identities survive restart and cannot be reused across Changes", async () => withDb(path => {
	let s = clients(path);
	try {
		const {change, definition} = setup(s), input = request(change, definition);
		const first = ok(s.client.prepare(input, "owner"));
		s.close(); s = clients(path);
		const secondChange = ok(s.change.propose({...proposal, requestId: "app:request:second-change"}, "owner"));
		fail(s.client.prepare({...input, changeId: secondChange.changeId}, "owner"), "conflict");
		const edited = plain(input); edited.effects[2].after.data.budget = 500;
		fail(s.client.prepare(edited, "owner"), "conflict");
		assert.deepEqual(ok(s.client.prepare(input, "owner")), first);
		assert.deepEqual(counts(path), {batches: 1, entities: 0});
	} finally { s.close(); }
}));

test("candidate: definition changes stale the entire batch without rewriting historical candidates", async () => withDb(path => {
	let s = clients(path);
	try {
		const {change, definition} = setup(s), input = request(change, definition);
		const candidate = ok(s.client.prepare(input, "owner"));
		const nextTypes = plain(types); nextTypes[0].fields.unshift({name: "date", type: "string"});
		const update = {...container, expectedDigest: definition.digest, types: nextTypes};
		const second = ok(s.client.install(update, "owner"));
		assert.equal(second.revision, 2);
		assert.deepEqual(ok(s.client.install(update, "owner")), second);
		fail(s.client.prepare({...input, requestId: "app:request:new"}, "owner"), "stale");
		assert.deepEqual(ok(s.client.prepare(input, "owner")), {...candidate, freshness: "stale"});
		s.close(); s = clients(path);
		assert.deepEqual(ok(s.client.read(container, candidate.candidateId, "owner")), {...candidate, freshness: "stale"});
		assert.equal(ok(s.client.describe(container, "owner")).definition.digest, second.digest);
		assert.deepEqual(counts(path), {batches: 1, entities: 0});
	} finally { s.close(); }
}));

test("candidate: native dependency versions and exact before-values bind create, replace and delete together", async () => withDb(path => {
	const bootstrap = openSqliteContainerIntake(path); bootstrap.close();
	const db = new DatabaseSync(path);
	db.exec("CREATE TABLE venues (scope TEXT, id TEXT, version TEXT, title TEXT, PRIMARY KEY(scope, id)) STRICT");
	for (const id of ["app:venue:keep", "app:venue:replace", "app:venue:remove"]) db.prepare("INSERT INTO venues VALUES (?, ?, ?, ?)").run(container.containerId, id, "v1", id);
	let access = true, coverage = true, calls = 0;
	const source = {sourceId: "app:venues", bindingDigest: "sha256:" + "1".repeat(64), observe({containerId, actor, entityId}) {
		calls++;
		if (!access || actor !== "owner" || containerId !== container.containerId) return {status: "denied"};
		if (!coverage) return {status: "unknown"};
		const row = db.prepare("SELECT version, title FROM venues WHERE scope = ? AND id = ?").get(containerId, entityId);
		return row ? {status: "present", version: row.version, value: entity("app:venue", {title: row.title})} : {status: "absent"};
	}};
	let s = clients(path, [source]);
	try {
		const {change, definition} = setup(s), input = request(change, definition);
		const keep = ref("app:venue:keep", "app:venues");
		input.effects[0].after.links.push({role: "app:venue", target: keep});
		input.dependencies = [{target: keep, expectedVersion: "v1"}];
		input.effects = order([...input.effects,
			{target: ref("app:venue:remove", "app:venues"), expectedVersion: "v1", after: null},
			{target: ref("app:venue:replace", "app:venues"), expectedVersion: "v1", after: entity("app:venue", {title: "Proposed rename"})},
		]);
		const candidate = ok(s.client.prepare(input, "owner"));
		assert.equal(candidate.effects.length, 5);
		assert.equal(candidate.grounds.length, 6);
		assert.equal(candidate.grounds[0].observation.value.data.title, "app:venue:keep");
		assert.equal(db.prepare("SELECT count(*) AS n FROM venues").get().n, 3);
		assert.equal(db.prepare("SELECT title FROM venues WHERE id = 'app:venue:replace'").get().title, "app:venue:replace");
		assert.deepEqual(counts(path), {batches: 1, entities: 0});
		const beforeDenied = calls;
		fail(s.client.read(container, candidate.candidateId, "other"), "denied");
		assert.equal(calls, beforeDenied, "Unauthorized caller must not reach native source");
		coverage = false;
		assert.equal(ok(s.client.read(container, candidate.candidateId, "owner")).freshness, "unknown");
		fail(s.client.prepare({...input, requestId: "app:request:unknown"}, "owner"), "unavailable");
		coverage = true; access = false;
		fail(s.client.read(container, candidate.candidateId, "owner"), "denied");
		fail(s.client.prepare(input, "owner"), "denied");
		access = true;
		// Even a source that fails to bump its version cannot turn different retained bytes into a fresh result.
		db.prepare("UPDATE venues SET title = ? WHERE id = ?").run("Outside rename", "app:venue:keep");
		const stale = ok(s.client.read(container, candidate.candidateId, "owner"));
		assert.equal(stale.freshness, "stale");
		assert.deepEqual(stale.grounds, candidate.grounds);
		db.prepare("UPDATE venues SET version = ? WHERE id = ?").run("v2", "app:venue:keep");
		fail(s.client.prepare({...input, requestId: "app:request:stale"}, "owner"), "stale");
		s.close(); s = clients(path, [source]);
		assert.deepEqual(ok(s.client.prepare(input, "owner")), stale);
		s.close(); s = clients(path);
		fail(s.client.read(container, candidate.candidateId, "owner"), "denied");
	} finally { s.close(); db.close(); }
}));

test("candidate: source rebinding, absent dependencies and stale create expectations cannot masquerade as freshness", async () => withDb(path => {
	let observation = {status: "present", version: "v1", value: entity("app:venue", {title: "Existing"})};
	const source = {sourceId: "app:source", bindingDigest: "sha256:" + "1".repeat(64), observe: () => observation};
	let s = clients(path, [source]);
	try {
		const {change, definition} = setup(s), input = request(change, definition);
		input.dependencies = [{target: ref("app:venue:one", source.sourceId), expectedVersion: "v1"}];
		const candidate = ok(s.client.prepare(input, "owner"));
		observation = {status: "absent"};
		assert.equal(ok(s.client.read(container, candidate.candidateId, "owner")).freshness, "stale");
		fail(s.client.prepare({...input, requestId: "app:request:missing"}, "owner"), "stale");
		observation = {status: "present", version: "v1", value: entity("app:venue", {title: "Existing"})};
		s.close(); s = clients(path, [{...source, bindingDigest: "sha256:" + "2".repeat(64)}]);
		assert.equal(ok(s.client.read(container, candidate.candidateId, "owner")).freshness, "stale");
		const create = {...input, requestId: "app:request:create", dependencies: [], effects: [{target: ref("app:venue:one", source.sourceId), expectedVersion: null, after: entity("app:venue", {title: "New"})}]};
		fail(s.client.prepare(create, "owner"), "stale");
	} finally { s.close(); }
}));

test("candidate: failed insertion or delivery denial rolls back the whole batch", async () => withDb(path => {
	let calls = 0;
	const source = {sourceId: "app:source", bindingDigest: "sha256:" + "1".repeat(64), observe() { return ++calls === 1 ? {status: "present", version: "v1", value: entity("app:venue", {title: "Existing"})} : {status: "denied"}; }};
	const s = clients(path, [source]), db = new DatabaseSync(path);
	try {
		const {change, definition} = setup(s), input = request(change, definition);
		db.exec("CREATE TRIGGER refuse_candidate BEFORE INSERT ON ck_candidate_batches BEGIN SELECT RAISE(ABORT, 'test failure'); END");
		fail(s.client.prepare(input, "owner"), "unavailable");
		assert.deepEqual(counts(path), {batches: 0, entities: 0});
		db.exec("DROP TRIGGER refuse_candidate");
		fail(s.client.prepare({...input, dependencies: [{target: ref("app:venue:one", source.sourceId), expectedVersion: "v1"}]}, "owner"), "denied");
		assert.deepEqual(counts(path), {batches: 0, entities: 0});
		ok(s.client.prepare(input, "owner"));
		assert.deepEqual(counts(path), {batches: 1, entities: 0});
	} finally { s.close(); db.close(); }
}));

test("candidate: stored request, grounds, definition and parent identities are checked before delivery", async () => withDb(path => {
	const s = clients(path), db = new DatabaseSync(path);
	try {
		const {change, definition} = setup(s), input = request(change, definition);
		const candidate = ok(s.client.prepare(input, "owner"));
		for (const [table, column, condition] of [
			["ck_candidate_batches", "request_json", "1 = 1"],
			["ck_candidate_batches", "grounds_json", "1 = 1"],
			["ck_candidate_definitions", "definition_json", "1 = 1"],
			["ck_intake_changes", "what_text", "1 = 1"],
		]) {
			const original = db.prepare(`SELECT ${column} AS value FROM ${table} WHERE ${condition}`).get().value;
			db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${condition}`).run('{}');
			fail(s.client.read(container, candidate.candidateId, "owner"), "unavailable");
			fail(s.client.prepare(input, "owner"), "unavailable");
			db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${condition}`).run(original);
		}
		assert.deepEqual(ok(s.client.read(container, candidate.candidateId, "owner")), candidate);
	} finally { s.close(); db.close(); }
}));

test("candidate: fresh processes race on one whole-batch request and reconcile lost responses", async () => withDb(async path => {
	const s = clients(path), {change, definition} = setup(s), input = request(change, definition);
	s.close();
	const code = `import {openSqliteContainerCandidates,createContainerCandidateClient} from ${JSON.stringify(moduleUrl)};
		const store=openSqliteContainerCandidates(process.argv[1]);
		try { console.log(JSON.stringify(createContainerCandidateClient(store).prepare(JSON.parse(process.argv[2]),'owner'))); }
		finally { store.close(); }`;
	function submit(value) {
		return new Promise((resolve, reject) => {
			const child = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", code, path, JSON.stringify(value)]);
			let output = "", diagnostic = "";
			child.stdout.setEncoding("utf8").on("data", chunk => { output += chunk; });
			child.stderr.setEncoding("utf8").on("data", chunk => { diagnostic += chunk; });
			child.on("error", reject);
			child.on("close", status => {
				if (status !== 0) { reject(new Error(diagnostic)); return; }
				try { resolve(JSON.parse(output)); } catch (error) { reject(error); }
			});
		});
	}
	const [first, second] = await Promise.all([submit(input), submit(input)]);
	assert.deepEqual(ok(first), ok(second));
	const modified = plain(input); modified.effects[2].after.data.budget = 700;
	fail(await submit(modified), "conflict");
	const restarted = JSON.parse(execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", code, path, JSON.stringify(input)], {encoding: "utf8"}));
	assert.deepEqual(ok(restarted), first.value);
	assert.deepEqual(counts(path), {batches: 1, entities: 0});
}));

test("candidate: abrupt process death before commit rolls back, and lost reply after commit replays", async () => withDb(path => {
	const s = clients(path), {change, definition} = setup(s), input = request(change, definition);
	input.dependencies = [{target: ref("app:venue:one", "app:source"), expectedVersion: "v1"}];
	s.close();
	const code = `import {openSqliteContainerCandidates,createContainerCandidateClient} from ${JSON.stringify(moduleUrl)};
		let calls=0;
		const source={sourceId:'app:source',bindingDigest:'sha256:'+'1'.repeat(64),observe(){
			if (++calls===2 && process.argv[3]==='before') process.exit(77);
			return {status:'present',version:'v1',value:{typeId:'app:venue',data:{title:'Venue'},links:[]}};
		}};
		const store=openSqliteContainerCandidates(process.argv[1],[source]);
		const result=createContainerCandidateClient(store).prepare(JSON.parse(process.argv[2]),'owner');
		if (!result.ok) throw new Error(JSON.stringify(result));
		if (process.argv[3]==='after') process.exit(78);
		store.close(); console.log(JSON.stringify(result));`;
	function run(mode) { return spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", code, path, JSON.stringify(input), mode], {encoding: "utf8", timeout: 10_000}); }
	const interrupted = run("before");
	assert.equal(interrupted.status, 77, interrupted.stderr);
	const recovery = openSqliteContainerCandidates(path); recovery.close();
	assert.deepEqual(counts(path), {batches: 0, entities: 0});
	const lostReply = run("after");
	assert.equal(lostReply.status, 78, lostReply.stderr);
	assert.equal(lostReply.stdout, "");
	assert.deepEqual(counts(path), {batches: 1, entities: 0});
	const recovered = run("read");
	assert.equal(recovered.status, 0, recovered.stderr);
	assert.equal(ok(JSON.parse(recovered.stdout)).freshness, "current");
	assert.deepEqual(counts(path), {batches: 1, entities: 0});
}));

test("candidate: unversioned, missing or incompatible schemas are not repaired or migrated", async () => withDb(path => {
	assert.throws(() => openSqliteContainerCandidates(path), /intake/);
	const intake = openSqliteContainerIntake(path); intake.close();
	const db = new DatabaseSync(path);
	try {
		db.exec("CREATE TABLE ck_candidate_batches (marker TEXT)");
		assert.throws(() => openSqliteContainerCandidates(path), /unversioned/);
		assert.equal(db.prepare("SELECT 1 FROM sqlite_schema WHERE name = 'ck_candidate_schema'").get(), undefined);
		db.exec("DROP TABLE ck_candidate_batches");
		const store = openSqliteContainerCandidates(path); store.close();
		db.prepare("UPDATE ck_candidate_schema SET version = ? WHERE id = 1").run("changekernel.container-candidate-store@1.0.0");
		assert.throws(() => openSqliteContainerCandidates(path), /Unsupported candidate schema/);
		assert.equal(db.prepare("SELECT version FROM ck_intake_schema WHERE id = 1").get().version, "changekernel.container-intake-store@1.0.0");
	} finally { db.close(); }
}));
