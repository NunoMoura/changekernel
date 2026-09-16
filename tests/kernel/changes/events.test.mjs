import assert from "node:assert/strict";
import test from "node:test";
import {CONTAINING_COMMIT, createInquiryChangeEvent, decodeInquiryChangeEvent, decodeProfileChangeEvent, INQUIRY_CHANGE_EVENT_KINDS, INQUIRY_EVENT_CANONICAL_LIMITS} from "../../../src/kernel/changes/events.ts";
import {canonicalJson, parseCanonicalJson} from "../../../src/kernel/data-contracts/canonical-json.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {inquiryFixture, inquiryEvent, boundaryInquiry, without, ownDataAttacks, assertDeepFrozen} from "./inquiry-fixtures.mjs";
import {admitted, profileRecord} from "../wiki/profile-fixtures.mjs";

export const digest = (character) => `sha256:${character.repeat(64)}`;
export const oid = (character) => ({algorithm: "sha1", hex: character.repeat(40)});

test("Event 3 admits only proposals and reasoned revisions with existing immutable framing", () => {
	assert.deepEqual(INQUIRY_CHANGE_EVENT_KINDS, ["change.proposed", "change.revised"]);
	for (const format of ["sha1", "sha256"]) {
		const proposed = inquiryEvent(inquiryFixture(format));
		const revised = inquiryEvent(inquiryFixture(format, {revision: 2, scope: "Clarified scope"}), proposed);
		for (const event of [proposed, revised]) {
			assert.equal(event.protocol.version, "3.0.0"); assert.equal(event.containingCommit, CONTAINING_COMMIT);
			assert.deepEqual(admitted(decodeInquiryChangeEvent(event)), event); assertDeepFrozen(event);
			assert.equal(event.eventDigest, admitted(semanticDigest("codewiki.change-event@3.0.0", without(event, "eventDigest"))));
			assert.notEqual(event.eventDigest, admitted(semanticDigest("codewiki.change-event@2.0.0", without(event, "eventDigest"))));
			assert.equal(decodeProfileChangeEvent(event).ok, false);
			assert.equal("ownerItemId" in event, false); assert.equal("transactionDigest" in event.ownerBinding, false);
		}
		assert.equal(proposed.predecessorEventDigest, null); assert.equal(proposed.expectedChangeTip, null);
		assert.equal(revised.predecessorEventDigest, proposed.eventDigest); assert.ok(revised.expectedChangeTip);
		assert.equal(revised.payload.reason, "Retain the original question; refine its scope.");
	}
	assert.equal(decodeInquiryChangeEvent(profileRecord().event).ok, false);
});

test("Event 3 digest binds capture authority, build, source interpretation and revision grounds", () => {
	const first = inquiryEvent(); const body = without(first, "eventDigest", "protocol", "containingCommit");
	for (const patch of [
		{actorId: "cw:actor:other"}, {authorityId: "cw:authority:other"}, {commandId: "cw:command:other"},
		{commandDigest: digest("c")}, {occurredAt: "2026-09-04T00:00:00Z"},
		{ownerBinding: {...body.ownerBinding, kernelBuildDigest: digest("e")}},
		{payload: {change: inquiryFixture("sha1", {intent: "Another question?"})}},
	]) {
		assert.notEqual(admitted(createInquiryChangeEvent({...body, ...patch})).eventDigest, first.eventDigest);
		assert.equal(decodeInquiryChangeEvent({...first, ...patch}).ok, false);
	}
	const revised = inquiryEvent(inquiryFixture("sha1", {revision: 2}), first);
	const revisionBody = without(revised, "eventDigest", "protocol", "containingCommit");
	for (const patch of [
		{predecessorEventDigest: digest("e")}, {expectedChangeTip: oid("8")},
		{payload: {...revised.payload, reason: "New source resolves uncertainty."}},
	]) {
		assert.notEqual(admitted(createInquiryChangeEvent({...revisionBody, ...patch})).eventDigest, revised.eventDigest);
		assert.equal(decodeInquiryChangeEvent({...revised, ...patch}).ok, false);
	}
});

test("Event 3 rejects missing or manufactured grounds, unsupported transitions and authority fields", () => {
	const first = inquiryEvent(); const body = without(first, "eventDigest", "protocol", "containingCommit");
	for (const patch of [
		{expectedProjectHead: oid("e")}, {expectedChangeTip: oid("9")}, {predecessorEventDigest: digest("e")},
		{payload: {change: inquiryFixture("sha1", {revision: 2})}}, {payload: {...body.payload, reason: "Not a revision"}},
		{payload: {change: profileRecord().change}},
		{ownerBinding: {...body.ownerBinding, profile: "unsupported"}}, {ownerBinding: {...body.ownerBinding, kind: "wiki"}},
		{ownerBinding: {...body.ownerBinding, transactionDigest: digest("e")}},
		{ownerBinding: without(body.ownerBinding, "kernelBuildDigest")},
		{actorId: "unqualified"}, {authorityId: "unqualified"}, {commandId: "unqualified"},
		{commandDigest: "sha1:invalid"}, {occurredAt: "yesterday"},
	]) assert.equal(createInquiryChangeEvent({...body, ...patch}).ok, false, JSON.stringify(patch));
	for (const field of Object.keys(body)) assert.equal(createInquiryChangeEvent(without(body, field)).ok, false, field);
	for (const kind of ["gate.recorded", "work.claimed", "change.completed", "change.approved", "queue.running"]) {
		assert.equal(createInquiryChangeEvent({...body, kind}).ok, false, kind);
	}
	for (const field of ["approval", "gate", "work", "ready", "status", "authorization", "ownerItemId", "effect"]) {
		assert.equal(createInquiryChangeEvent({...body, [field]: true}).ok, false, field);
	}
	for (const patch of [{eventDigest: digest("f")}, {containingCommit: oid("9")}, {protocol: {...first.protocol, version: "2.0.0"}}]) {
		assert.equal(decodeInquiryChangeEvent({...first, ...patch}).ok, false);
	}
	const revision = inquiryEvent(inquiryFixture("sha1", {revision: 2}), first);
	const revisedBody = without(revision, "eventDigest", "protocol", "containingCommit");
	for (const patch of [
		{expectedChangeTip: null}, {predecessorEventDigest: null}, {expectedChangeTip: {algorithm: "sha256", hex: "e".repeat(64)}},
		{payload: {change: first.payload.change, reason: "Not the next revision"}}, {payload: {change: revision.payload.change}},
		... ["", " \n", "e\u0301", "\ud800", "é".repeat(8193)].map(reason => ({payload: {...revision.payload, reason}})),
	]) assert.equal(createInquiryChangeEvent({...revisedBody, ...patch}).ok, false);
});

test("Event 3 attachment build is exact; removal permits explicitly changed build grounds", () => {
	for (const format of ["sha1", "sha256"]) {
		const {reference} = profileRecord(format);
		const attached = inquiryEvent(inquiryFixture(format, {wikiConsequences: {kind: "profile", reference}}));
		const body = without(attached, "eventDigest", "protocol", "containingCommit");
		assert.equal(createInquiryChangeEvent({...body, ownerBinding: {...body.ownerBinding, kernelBuildDigest: digest("e")}}).ok, false);
		const revision = inquiryEvent(inquiryFixture(format, {revision: 2, wikiConsequences: {kind: "profile", reference}}), attached);
		const nextBody = without(revision, "eventDigest", "protocol", "containingCommit");
		assert.equal(createInquiryChangeEvent({...nextBody, ownerBinding: {...nextBody.ownerBinding, kernelBuildDigest: digest("e")}}).ok, false);
		assert.equal(createInquiryChangeEvent({...nextBody, ownerBinding: {...nextBody.ownerBinding, kernelBuildDigest: digest("e")},
			payload: {change: inquiryFixture(format, {revision: 2, wikiConsequences: {kind: "none", reason: "Attachment is obsolete."}}), reason: "Remove stale attachment."}}).ok, true);
	}
});

test("Event 3 own-data boundaries reject hostile nested data and return independent frozen records", () => {
	const event = inquiryEvent(); const body = without(event, "eventDigest", "protocol", "containingCommit");
	let accesses = 0; const onAccess = () => { accesses++; };
	for (const attack of ownDataAttacks(body, onAccess)) assert.equal(createInquiryChangeEvent(attack).ok, false);
	for (const attack of ownDataAttacks(event, onAccess)) assert.equal(decodeInquiryChangeEvent(attack).ok, false);
	for (const field of ["ownerBinding", "payload", "expectedProjectHead"]) {
		for (const attack of ownDataAttacks(body[field], onAccess)) assert.equal(createInquiryChangeEvent({...body, [field]: attack}).ok, false);
	}
	assert.equal(accesses, 0);
	for (const field of ["protocol", "containingCommit", "eventDigest"]) assert.equal(createInquiryChangeEvent({...body, [field]: event[field]}).ok, false);
	const mutable = structuredClone(event); const decoded = admitted(decodeInquiryChangeEvent(mutable));
	mutable.ownerBinding.kernelBuildDigest = digest("e"); mutable.payload.change.intent = "Changed";
	assert.deepEqual(decoded, event); assertDeepFrozen(decoded); assert.equal(decodeInquiryChangeEvent(mutable).ok, false);
});

test("full-size Change and maximally escaped revision reason fit the Event 3 line budget", () => {
	const change = boundaryInquiry("sha1", 2);
	const event = inquiryEvent(change, inquiryEvent(), {payload: {change, reason: "x" + "\u0001".repeat(16383)}});
	const encoded = admitted(canonicalJson(event, INQUIRY_EVENT_CANONICAL_LIMITS));
	assert.ok(Buffer.byteLength(encoded) > 256 * 1024 + 16 * 1024);
	assert.deepEqual(admitted(decodeInquiryChangeEvent(admitted(parseCanonicalJson(encoded, {requireCanonicalBytes: true, limits: INQUIRY_EVENT_CANONICAL_LIMITS})))), event);
});
