import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createContainerCandidateClient, createContainerIntakeClient, openSqliteContainerCandidates, openSqliteContainerIntake} from "../../../src/index.ts";

export const container = {containerId: "app:container:one"};
export const types = [
	{typeId: "app:show", fields: [{name: "title", type: "string"}]},
	{typeId: "app:tour", fields: [{name: "budget", type: "number"}, {name: "title", type: "string"}]},
	{typeId: "app:venue", fields: [{name: "title", type: "string"}]},
];
export const proposal = {...container, requestId: "app:request:intent", what: "Prepare a tour and two shows", why: "Plan our summer tour."};
export const ok = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };
export const fail = (result, code) => { assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(result.error.code, code); };
export const plain = value => JSON.parse(JSON.stringify(value));
export const ref = (entityId, sourceId = "changekernel:generic") => ({sourceId, entityId});
export const entity = (typeId, data, links = []) => ({typeId, data, links});
export const key = target => target.sourceId + "\0" + target.entityId;
export const order = list => list.sort((a, b) => key(a.target) < key(b.target) ? -1 : 1);
export async function withDb(run) {
	const root = await mkdtemp(join(tmpdir(), "ck-batch-"));
	try { await run(join(root, "app.sqlite")); }
	finally { await rm(root, {recursive: true, force: true}); }
}
export function clients(path, sources = []) {
	const intake = openSqliteContainerIntake(path);
	let candidates;
	try { candidates = openSqliteContainerCandidates(path, sources); }
	catch (error) { intake.close(); throw error; }
	return {change: createContainerIntakeClient(intake), client: createContainerCandidateClient(candidates),
		close() { candidates.close(); intake.close(); }};
}
export function setup(s) {
	ok(s.change.create(container, "owner"));
	const change = ok(s.change.propose(proposal, "owner"));
	const definition = ok(s.client.install({...container, expectedDigest: null, types}, "owner"));
	return {change, definition};
}
export function request(change, definition) {
	return {...container, changeId: change.changeId, requestId: "app:request:candidate", definitionDigest: definition.digest,
		effects: [
			{target: ref("app:show:one"), expectedVersion: null, after: entity("app:show", {title: "Opening show"}, [{role: "app:tour", target: ref("app:tour:one")}])},
			{target: ref("app:show:two"), expectedVersion: null, after: entity("app:show", {title: "Closing show"}, [{role: "app:tour", target: ref("app:tour:one")}])},
			{target: ref("app:tour:one"), expectedVersion: null, after: entity("app:tour", {budget: 120000, title: "Summer tour"})},
		], dependencies: []};
}
