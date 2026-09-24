import assert from "node:assert/strict";
import test from "node:test";
import {candidateIdentity, candidateTargets, decodeCandidateGrounds, decodeCandidateRequest, decodeDefinitionRequest, decodeEntityObservation, definitionIdentity, matchingGrounds, validEntityValue} from "../../../src/kernel/containers/candidate.ts";
import {container, types, ok, plain, ref, entity, request} from "../../adapters/sqlite/candidate-fixtures.mjs";

const definition = definitionIdentity({...container, expectedDigest: null, types}, 1);
const change = {changeId: "sha256:" + "1".repeat(64)};
const input = () => request(change, definition);
const rejected = value => assert.equal(decodeCandidateRequest(value).ok, false);

test("batch contract retains all effects, nested JSON data and explicit relationships without interpreting arbitrary strings as links", () => {
	const batch = ok(decodeCandidateRequest(input()));
	assert.equal(batch.effects.length, 3);
	assert.equal(batch.effects[0].after.links[0].target.entityId, "app:tour:one");
	assert.ok(Object.isFrozen(batch.effects[0].after.data));
	assert.ok(Object.isFrozen(batch.effects));
	const types = [{typeId: "app:data", fields: [{name: "items", type: "array"}, {name: "metadata", type: "object"}, {name: "nil", type: "null"}]}];
	const d = definitionIdentity(ok(decodeDefinitionRequest({...container, types, expectedDigest: null})), 1);
	const value = entity("app:data", {items: [1, "app:looks-like-a-reference"], metadata: {nested: [true]}, nil: null});
	assert.equal(validEntityValue(d, value), true);
	assert.equal(validEntityValue(d, {...value, data: {...value.data, nil: false}}), false);
	assert.equal(validEntityValue(d, {...value, typeId: "app:unknown"}), false);
});

test("batch contract rejects missing, duplicate, unsorted or conflicting effects and dangling relationships", () => {
	const batch = input();
	for (const effects of [[], [...batch.effects].reverse(), [batch.effects[0], ...batch.effects]]) rejected({...batch, effects});
	rejected({...batch, effects: [{...batch.effects[0], after: null}]});
	rejected({...batch, dependencies: [{target: batch.effects[0].target, expectedVersion: "v1"}]});
	const dangling = plain(batch); dangling.effects[0].after.links[0].target.entityId = "app:tour:missing";
	rejected(dangling);
	const deleting = plain(batch); deleting.effects[2].expectedVersion = "v1"; deleting.effects[2].after = null;
	rejected(deleting);
	const duplicateLink = plain(batch); duplicateLink.effects[0].after.links.push(duplicateLink.effects[0].after.links[0]);
	rejected(duplicateLink);
	const linkedExisting = plain(batch);
	linkedExisting.effects.pop();
	linkedExisting.dependencies.push({target: ref("app:tour:one"), expectedVersion: "v1"});
	assert.equal(decodeCandidateRequest(linkedExisting).ok, true);
	const cycle = plain(batch);
	cycle.effects[2].after.links.push({role: "app:show", target: cycle.effects[0].target});
	assert.equal(decodeCandidateRequest(cycle).ok, true, "Graph cycles are not execution cycles or a reason to drop related entities");
});

test("batch request cannot carry caller assertions of approval, observations or actor authority", () => {
	for (const extra of [{actor: "owner"}, {approved: true}, {grounds: []}, {passed: true}, {status: "complete"}]) rejected({...input(), ...extra});
	let invoked = false;
	const value = {...input()};
	Object.defineProperty(value, "effects", {enumerable: true, get() { invoked = true; return []; }});
	rejected(value);
	assert.equal(invoked, false);
});

test("batch identity scopes retries by container, actor and request, with whole-content conflict detection", () => {
	const batch = ok(decodeCandidateRequest(input())), original = candidateIdentity("owner", batch);
	const revised = plain(batch); revised.effects[2].after.data.budget++;
	const different = candidateIdentity("owner", ok(decodeCandidateRequest(revised)));
	assert.equal(original.candidateId, different.candidateId);
	assert.notEqual(original.inputDigest, different.inputDigest);
	assert.equal(candidateIdentity("owner", {...batch, changeId: "sha256:" + "2".repeat(64)}).candidateId, original.candidateId);
	assert.notEqual(candidateIdentity("owner", {...batch, changeId: "sha256:" + "2".repeat(64)}).inputDigest, original.inputDigest);
	assert.notEqual(candidateIdentity("other", batch).candidateId, original.candidateId);
	assert.notEqual(candidateIdentity("owner", {...batch, requestId: "app:request:second"}).candidateId, original.candidateId);
});

test("batch grounds require complete exact coverage; unknown never establishes absence", () => {
	const batch = ok(decodeCandidateRequest(input()));
	const grounds = candidateTargets(batch).map(item => ({target: item.target, bindingDigest: "sha256:" + "1".repeat(64), observation: {status: "absent"}}));
	assert.equal(matchingGrounds(batch, ok(decodeCandidateGrounds({grounds}))), true);
	assert.equal(matchingGrounds(batch, grounds.slice(1)), false);
	assert.equal(matchingGrounds(batch, grounds.map(g => ({...g, observation: {status: "unknown"}}))), false);
	assert.equal(matchingGrounds(batch, grounds.map(g => ({...g, observation: {status: "denied"}}))), false);
	assert.equal(decodeCandidateGrounds({grounds: [grounds[0], ...grounds]}).ok, false);
	assert.equal(decodeEntityObservation({status: "absent", value: {}}).ok, false);
	assert.equal(decodeEntityObservation({status: "present", version: "", value: entity("app:tour", {})}).ok, false);
});

test("batch contracts bound effect counts, text, definition sizes and Unicode admission", () => {
	const batch = input();
	rejected({...batch, effects: Array.from({length: 65}, (_, i) => ({target: ref(`app:entity:${String(i).padStart(3, '0')}`), expectedVersion: null, after: entity("app:show", {title: "x"})}))});
	const huge = plain(batch); huge.effects[0].after.data.title = "x".repeat(1_048_577); rejected(huge);
	const unicode = plain(batch); unicode.effects[0].after.data.title = "e\u0301"; rejected(unicode);
	assert.equal(decodeDefinitionRequest({...container, expectedDigest: null, types: Array.from({length: 33}, (_, i) => ({typeId: `app:type:${i}`, fields: []}))}).ok, false);
	assert.equal(decodeDefinitionRequest({...container, expectedDigest: null, types: []}).ok, false);
});
