import assert from "node:assert/strict";
import test from "node:test";
import {
	CHANGE_EVENT_KINDS,
	CONTAINING_COMMIT,
	createChangeEvent,
	decodeChangeEvent,
} from "../../../src/kernel/changes/events.ts";
import {changeFixture} from "./contracts.test.mjs";

export const digest = (character) => `sha256:${character.repeat(64)}`;
export const oid = (character) => ({algorithm: "sha1", hex: character.repeat(40)});

export const EVENT_OWNERS = Object.freeze({
	"change.proposed": "cw:component:change-intake",
	"change.revised": "cw:component:change-intake",
	"gate.recorded": "cw:component:checks",
	"change.committed": "cw:component:decision",
	"change.deferred": "cw:component:decision",
	"change.rejected": "cw:component:decision",
	"change.resumed": "cw:component:decision",
	"change.withdrawn": "cw:component:decision",
	"change.planned": "cw:component:planning",
	"work.claimed": "cw:component:implementation",
	"work.assigned": "cw:component:implementation",
	"work.attempt.recorded": "cw:component:implementation",
	"work.integrated": "cw:component:implementation",
	"review.reconciled": "cw:component:review",
	"change.completed": "cw:component:project-server",
	"change.superseded": "cw:component:project-server",
	"effect.recorded": "cw:component:project-server",
});

export function eventFixture(kind = "change.proposed", payload = {change: changeFixture()}, overrides = {}) {
	const result = createChangeEvent({
		kind,
		ownerItemId: EVENT_OWNERS[kind],
		actorId: "cw:actor:maintainer",
		authorityId: "cw:authority:project-server",
		commandId: "cw:command:test-event",
		commandDigest: digest("c"),
		occurredAt: "2026-09-01T00:00:00Z",
		expectedProjectHead: oid("1"),
		expectedChangeTip: kind === "change.proposed" ? null : oid("9"),
		predecessorEventDigest: null,
		payload,
		...overrides,
	}, EVENT_OWNERS);
	assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
	return result.value;
}

test("semantic event catalog is closed, owned, and exact", () => {
	assert.equal(CHANGE_EVENT_KINDS.length, 17);
	assert.deepEqual(Object.keys(EVENT_OWNERS).sort(), [...CHANGE_EVENT_KINDS].sort());
	const event = eventFixture();
	assert.equal(decodeChangeEvent(event, EVENT_OWNERS).ok, true);
	assert.equal(event.ownerItemId, "cw:component:change-intake");
	assert.equal(event.containingCommit, CONTAINING_COMMIT);
});

test("event identity binds actor, authority, command, time, expected heads, predecessor, and payload", () => {
	const first = eventFixture();
	for (const override of [
		{actorId: "cw:actor:other"},
		{authorityId: "cw:authority:other"},
		{commandId: "cw:command:other"},
		{commandDigest: digest("d")},
		{occurredAt: "2026-09-01T00:00:01Z"},
		{expectedProjectHead: oid("2")},
	]) assert.notEqual(eventFixture("change.proposed", first.payload, override).eventDigest, first.eventDigest);
});

test("event decoder rejects wrong owner, forged digest, containing OID, and unknown kind", () => {
	const event = eventFixture();
	assert.equal(decodeChangeEvent({...event, ownerItemId: "cw:component:decision"}, EVENT_OWNERS).ok, false);
	assert.equal(decodeChangeEvent({...event, eventDigest: digest("f")}, EVENT_OWNERS).ok, false);
	assert.equal(decodeChangeEvent({...event, containingCommit: oid("2")}, EVENT_OWNERS).ok, false);
	assert.equal(decodeChangeEvent({...event, kind: "change.approved"}, EVENT_OWNERS).ok, false);
	assert.equal(decodeChangeEvent({...event, authorization: "self"}, EVENT_OWNERS).ok, false);
});

test("event payload contracts reject legacy parallel authority concepts", () => {
	for (const [kind, payload] of [
		["change.committed", {decisionGateDigest: digest("a"), wikiTree: oid("1"), candidateId: "candidate-1"}],
		["change.planned", {planningGateDigest: digest("a"), work: [], workGraphId: "graph"}],
		["review.reconciled", {prospectiveTree: oid("1"), integratedWorkIds: [], reviewSubjectDigest: digest("a"), reviewAttemptId: "attempt"}],
		["change.completed", {completionTree: oid("1"), reviewGateDigest: null, completionRequirementId: "requirement"}],
	]) {
		const result = createChangeEvent({
			kind,
			ownerItemId: EVENT_OWNERS[kind],
			actorId: "cw:actor:test",
			authorityId: "cw:authority:project-server",
			commandId: "cw:command:legacy-payload",
			commandDigest: digest("c"),
			occurredAt: "2026-09-01T00:00:00Z",
			expectedProjectHead: oid("1"),
			expectedChangeTip: oid("2"),
			predecessorEventDigest: null,
			payload,
		}, EVENT_OWNERS);
		assert.equal(result.ok, false, kind);
	}
});
