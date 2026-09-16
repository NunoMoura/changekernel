import assert from "node:assert/strict";
import test from "node:test";
import {reduceChangeTrace} from "../../../src/kernel/changes/reducer.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";
import {canonicalJson} from "../../../src/kernel/data-contracts/canonical-json.ts";
import {decodeInquiryChangeTrace, encodeInquiryChangeTrace} from "../../../src/kernel/changes/trace.ts";
import {admitted, profileRecord} from "../wiki/profile-fixtures.mjs";
import {inquiryFixture, inquiryEvent, inquiryTrace, repositorySource, traceWithEvents, without, assertDeepFrozen, fixtureDigest as digest} from "./inquiry-fixtures.mjs";

test("common reducer retains inquiry history and attribution without Gate, Work or acceptance facts", () => {
	for (const format of ["sha1", "sha256"]) {
		const first = inquiryFixture(format); const source = repositorySource(format);
		const second = inquiryFixture(format, {revision: 2, sources: [source], intent: "An explicit interpretation.",
			intentBasis: {kind: "interpreted", sourceDigests: [source.sourceDigest], producerRunRef: "cw:run:interpretation"},
			wikiConsequences: {kind: "none", reason: "Current question concerns source behavior."}});
		const {reference} = profileRecord(format);
		const third = inquiryFixture(format, {revision: 3, wikiConsequences: {kind: "profile", reference}});
		const trace = inquiryTrace(format, [first, second, third]);
		const replayed = admitted(decodeInquiryChangeTrace(admitted(encodeInquiryChangeTrace(trace))));
		const reduced = admitted(reduceChangeTrace(replayed));
		assert.equal(reduced.state, "proposed"); assert.deepEqual(reduced.change, third);
		for (const field of ["gates", "work", "effects", "committedWikiTree", "completionTree", "supersedingChangeId", "review"]) assert.equal(field in reduced, false);
		for (const field of ["approval", "approved", "ready", "readiness", "queue", "authorized"]) assert.equal(field in reduced, false);
		assert.deepEqual(replayed.events[0].payload.change.sources, first.sources);
		assert.deepEqual(replayed.events[1].payload.change, second);
		assert.equal(replayed.events[1].payload.reason, "Retain the original question; refine its scope.");
		assert.equal(reduced.latestEventDigest, trace.events[2].eventDigest); assert.equal(reduced.traceDigest, trace.traceDigest);
		assert.equal(reduced.stateDigest, admitted(semanticDigest("codewiki.reduced-change@3.0.0", without(reduced, "stateDigest"))));
		assert.notEqual(reduced.stateDigest, admitted(semanticDigest("codewiki.reduced-change@2.0.0", without(reduced, "stateDigest"))));
		assert.equal(admitted(canonicalJson(admitted(reduceChangeTrace(trace)))), admitted(canonicalJson(reduced))); assertDeepFrozen(reduced);
	}
});

test("inquiry reduction re-admits the full prefix rather than trusting Trace or event digests", () => {
	const trace = inquiryTrace("sha1", [inquiryFixture(), inquiryFixture("sha1", {revision: 2})]);
	const first = trace.events[0]; const second = trace.events[1];
	for (const events of [
		[first, inquiryEvent(inquiryFixture("sha1", {revision: 3}), first)],
		[first, inquiryEvent(inquiryFixture("sha1", {revision: 2}), first, {commandId: first.commandId})],
		[first, inquiryEvent(inquiryFixture("sha1", {revision: 2}), first, {predecessorEventDigest: digest("e")})],
		[first, {...second, payload: {change: second.payload.change, reason: "Forged reason"}}],
		[{...first, payload: {change: {...first.payload.change, intent: "Rewritten original"}}}, second],
		[first, {...second, kind: "gate.recorded", payload: {status: "passed"}}],
		[first, {...second, payload: {...second.payload, change: {...second.payload.change, profile: "unsupported"}}}],
		[first, {...second, expectedChangeTip: null}],
	]) assert.equal(reduceChangeTrace(traceWithEvents(trace, events)).ok, false);
	assert.equal(reduceChangeTrace({...trace, traceDigest: digest("e")}).ok, false);
	const copy = structuredClone(trace); const reduced = admitted(reduceChangeTrace(copy));
	copy.events[1].payload.change.intent = "Mutated later";
	assert.equal(reduced.change.intent, second.payload.change.intent); assertDeepFrozen(reduced);
});

test("common reducer dispatches on explicit own protocol, not reference presence or missing fields", () => {
	const trace = inquiryTrace(); let invoked = 0;
	const headerAccessor = {...trace}; Object.defineProperty(headerAccessor, "header", {get() { invoked++; throw new Error("must not run"); }});
	const protocolAccessor = {...trace.header}; Object.defineProperty(protocolAccessor, "protocol", {get() { invoked++; throw new Error("must not run"); }});
	const versionAccessor = {...trace.header.protocol}; Object.defineProperty(versionAccessor, "version", {get() { invoked++; throw new Error("must not run"); }});
	const revoked = Proxy.revocable({}, {}); revoked.revoke();
	for (const input of [null, undefined, {}, [], revoked.proxy, headerAccessor, {...trace, header: protocolAccessor},
		{...trace, header: {...trace.header, protocol: versionAccessor}},
		Object.assign(Object.create({header: trace.header}), without(trace, "header")),
		{...trace, header: {...trace.header, protocol: {id: "other.trace", version: "16.0.0"}}},
		{...trace, header: {...trace.header, protocol: {...trace.header.protocol, version: "17.0.0"}}},
		{...trace, events: [{...trace.events[0], payload: {change: without(trace.events[0].payload.change, "wikiConsequences")}}]},
	]) assert.equal(reduceChangeTrace(input).ok, false);
	assert.equal(invoked, 0);
	for (const historical of [profileRecord().trace]) {
		assert.equal(reduceChangeTrace(traceWithEvents(trace, [historical.events[0]])).ok, false);
		assert.equal(reduceChangeTrace(traceWithEvents(historical, trace.events)).ok, false);
		assert.equal(reduceChangeTrace(historical).ok, true);
	}
});
