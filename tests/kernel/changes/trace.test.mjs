import assert from "node:assert/strict";
import test from "node:test";

import {canonicalJson} from "../../../src/kernel/data-contracts/canonical-json.ts";
import {appendProfileChangeEvent, createEmptyProfileChangeTrace, createProfileChangeTraceHeader, decodeProfileChangeTrace, encodeProfileChangeTrace, validateProfileChangeTrace, appendInquiryChangeEvent, createInquiryChangeTraceHeader, decodeInquiryChangeTraceHeader, createEmptyInquiryChangeTrace, decodeInquiryChangeTrace, encodeInquiryChangeTrace, validateInquiryChangeTrace, inquiryTraceIdentity, MAX_INQUIRY_TRACE_BYTES, MAX_INQUIRY_TRACE_EVENTS, MAX_TRACE_BYTES} from "../../../src/kernel/changes/trace.ts";
import {reduceChangeTrace} from "../../../src/kernel/changes/reducer.ts";
import {createProfileChangeEvent} from "../../../src/kernel/changes/events.ts";
import {admitted, profileRecord} from "../wiki/profile-fixtures.mjs";
import {createInquiryChange} from "../../../src/kernel/changes/inquiry.ts";
import {createProjectSnapshot} from "../../../src/kernel/changes/snapshot.ts";
import {inquiryFixture, inquiryEvent, inquiryTrace, without, ownDataAttacks, assertDeepFrozen, traceWithEvents, boundaryInquiry} from "./inquiry-fixtures.mjs";

test("Trace 15 uses the common append/replay/reducer with exact proposal recovery", () => {
	const {trace, event, change} = profileRecord();
	const text = admitted(encodeProfileChangeTrace(trace));
	assert.equal(admitted(encodeProfileChangeTrace(admitted(decodeProfileChangeTrace(text)))), text);
	assert.equal(validateProfileChangeTrace(trace).ok, true);
	const reduced = admitted(reduceChangeTrace(trace));
	assert.equal(reduced.state, "proposed");
	assert.deepEqual(reduced.change, change);
	for (const key of ["gates", "work", "committedWikiTree", "completionTree"]) assert.equal(key in reduced, false);
	assert.equal(appendProfileChangeEvent(trace, event).ok, false);
	assert.equal(reduceChangeTrace({...trace, events: [event, event]}).ok, false);
	assert.equal(reduceChangeTrace({...trace, traceDigest: `sha256:${"f".repeat(64)}`}).ok, false);
	const {protocol, containingCommit, eventDigest, ...body} = event;
	void protocol; void containingCommit; void eventDigest;
	for (const patch of [
		{kind: "change.committed"},
		{ownerBinding: {...event.ownerBinding, kernelBuildDigest: `sha256:${"f".repeat(64)}`}},
		{ownerBinding: {...event.ownerBinding, transactionDigest: `sha256:${"f".repeat(64)}`}},
		{expectedProjectHead: event.payload.change.reference.after.commit}, {expectedChangeTip: event.expectedProjectHead},
	]) assert.equal(createProfileChangeEvent({...body, ...patch}).ok, false);
});

test("Trace 16 common framing preserves exact proposed/revised prefixes and supports explicit baseline replacement", () => {
	for (const format of ["sha1", "sha256"]) {
		const first = inquiryFixture(format);
		const baseline = admitted(createProjectSnapshot({...without(first.baseline, "protocol", "snapshotDigest"),
			commit: {...first.baseline.commit, hex: "d".repeat(format === "sha1" ? 40 : 64)}, parents: [first.baseline.commit]}));
		const revised = admitted(createInquiryChange({...without(first, "protocol", "changeDigest"), revision: 2, baseline, scope: "A clarified scope."}));
		let trace = inquiryTrace(format); const prefix = admitted(encodeInquiryChangeTrace(trace));
		trace = admitted(appendInquiryChangeEvent(trace, inquiryEvent(revised, trace.events[0])));
		const encoded = admitted(encodeInquiryChangeTrace(trace)); assert.ok(encoded.startsWith(prefix));
		assert.equal(trace.header.traceId, admitted(inquiryTraceIdentity(first.repositoryId, first.changeId)));
		assert.deepEqual(admitted(decodeInquiryChangeTrace(encoded)), trace); assertDeepFrozen(trace);
		assert.equal(admitted(encodeInquiryChangeTrace(admitted(decodeInquiryChangeTrace(encoded)))), encoded);
		assert.equal(admitted(reduceChangeTrace(trace)).change.baseline.snapshotDigest, baseline.snapshotDigest);
		const large = boundaryInquiry(format, 3);
		const escaped = inquiryEvent(large, trace.events.at(-1), {payload: {change: large, reason: "x" + "\u0001".repeat(16383)}});
		trace = admitted(appendInquiryChangeEvent(trace, escaped));
		assert.deepEqual(admitted(decodeInquiryChangeTrace(admitted(encodeInquiryChangeTrace(trace)))), trace);
	}
});

test("Trace 16 rejects reidentified broken predecessors, commands, revisions and Change identities", () => {
	const trace = inquiryTrace(); const first = trace.events[0]; const next = inquiryFixture("sha1", {revision: 2});
	const otherRepositoryBaseline = admitted(createProjectSnapshot({...without(next.baseline, "protocol", "snapshotDigest"), repositoryId: "cw:repository:other"}));
	const invalidEvents = [
		inquiryEvent(next, first, {predecessorEventDigest: `sha256:${"e".repeat(64)}`}),
		inquiryEvent(next, first, {commandId: first.commandId}),
		inquiryEvent(inquiryFixture("sha1", {revision: 3}), first),
		inquiryEvent(inquiryFixture("sha1", {revision: 2, changeId: "CHG-other"}), first),
		inquiryEvent(inquiryFixture("sha1", {revision: 2, repositoryId: "cw:repository:other", baseline: otherRepositoryBaseline}), first),
		inquiryEvent(inquiryFixture("sha256", {revision: 2}), first),
		inquiryEvent(),
	];
	for (const event of invalidEvents) {
		assert.equal(appendInquiryChangeEvent(trace, event).ok, false);
		const forged = traceWithEvents(trace, [first, event]);
		assert.equal(validateInquiryChangeTrace(forged).ok, false); assert.equal(encodeInquiryChangeTrace(forged).ok, false);
		const text = [forged.header, ...forged.events].map(value => admitted(canonicalJson(value))).join("\n") + "\n";
		assert.equal(decodeInquiryChangeTrace(text).ok, false); assert.equal(reduceChangeTrace(forged).ok, false);
	}
	const empty = admitted(createEmptyInquiryChangeTrace(trace.header));
	assert.equal(appendInquiryChangeEvent(empty, inquiryEvent(next, first)).ok, false);
	assert.equal(validateInquiryChangeTrace(empty).ok, false); assert.equal(validateInquiryChangeTrace(empty, true).ok, true);
	assert.equal(encodeInquiryChangeTrace(empty).ok, false); assert.equal(reduceChangeTrace(empty).ok, false);
});

test("concrete and inquiry traces reject cross-protocol substitution", () => {
	assert.equal(MAX_INQUIRY_TRACE_EVENTS, 64); assert.equal(MAX_INQUIRY_TRACE_BYTES, 1024 * 1024);
	assert.equal(MAX_TRACE_BYTES, 16 * 1024 * 1024);
	const modes = [
		{trace: profileRecord().trace, decode: decodeProfileChangeTrace, encode: encodeProfileChangeTrace, append: appendProfileChangeEvent, empty: createEmptyProfileChangeTrace},
		{trace: inquiryTrace(), decode: decodeInquiryChangeTrace, encode: encodeInquiryChangeTrace, append: appendInquiryChangeEvent, empty: createEmptyInquiryChangeTrace},
	];
	for (const mode of modes) {
		for (const other of modes.filter(other => other !== mode)) {
			assert.equal(mode.decode(admitted(other.encode(other.trace))).ok, false);
			assert.equal(mode.append(admitted(mode.empty(mode.trace.header)), other.trace.events[0]).ok, false);
			assert.equal(mode.encode({...mode.trace, events: [other.trace.events[0]]}).ok, false);
			assert.equal(reduceChangeTrace(traceWithEvents(mode.trace, [other.trace.events[0]])).ok, false);
		}
	}
	assert.equal(appendProfileChangeEvent(modes[0].trace, modes[0].trace.events[0]).ok, false, "Trace 15 still has exactly one event");
});

test("Trace 16 header, append and replay reject hostile own data, malformed framing and noncanonical lines", () => {
	const trace = inquiryTrace(); const text = admitted(encodeInquiryChangeTrace(trace));
	const headerBody = without(trace.header, "protocol", "traceId", "headerDigest");
	let accesses = 0; const onAccess = () => { accesses++; };
	for (const attack of ownDataAttacks(headerBody, onAccess)) assert.equal(createInquiryChangeTraceHeader(attack).ok, false);
	for (const attack of ownDataAttacks(trace.header, onAccess)) {
		assert.equal(decodeInquiryChangeTraceHeader(attack).ok, false); assert.equal(createEmptyInquiryChangeTrace(attack).ok, false);
	}
	for (const attack of [...ownDataAttacks(trace, onAccess), ...ownDataAttacks(trace.header, onAccess).map(header => ({...trace, header}))]) {
		assert.equal(validateInquiryChangeTrace(attack).ok, false); assert.equal(encodeInquiryChangeTrace(attack).ok, false);
		assert.equal(appendInquiryChangeEvent(attack, trace.events[0]).ok, false); assert.equal(reduceChangeTrace(attack).ok, false);
	}
	assert.equal(accesses, 0);
	const manyNodes = Array.from({length: 100}, () => Array(1024).fill(null));
	const rejected = validateInquiryChangeTrace({...trace, extra: manyNodes});
	assert.equal(rejected.ok, false); assert.equal(rejected.error.cause.code, "too_many_nodes");
	for (const input of [
		"", "not-json\n", text.slice(0, -1), text + "\n", text.replaceAll("\n", "\r\n"), text.replace('"changeId"', '"changeId" '),
		text.replace('"changeId":', '"changeId":"CHG-duplicate","changeId":'),
		text.replace('"version":"16.0.0"', '"version":"17.0.0"'), text.replace('"kind":"change.proposed"', '"kind":"change.approved"'),
		text.replace('"intent":"', '"intent":"e\u0301'), text.split("\n")[0] + "\n",
	]) assert.equal(decodeInquiryChangeTrace(input).ok, false);
	for (const patch of [{traceDigest: `sha256:${"f".repeat(64)}`}, {header: {...trace.header, createdBy: "cw:actor:other"}},
		{header: {...trace.header, headerDigest: `sha256:${"f".repeat(64)}`}}, {header: {...trace.header, traceId: "cw:trace:wrong"}}]) {
		assert.equal(validateInquiryChangeTrace({...trace, ...patch}).ok, false);
	}
	const mutable = structuredClone(trace); const copy = admitted(validateInquiryChangeTrace(mutable));
	mutable.events[0].payload.change.intent = "Changed"; assertDeepFrozen(copy); assert.deepEqual(copy, trace);
});

test("Trace 16 event-count boundary is inclusive and enforced by append, validation, encoding and replay", () => {
	const start = inquiryTrace(); const body = without(start.events[0].payload.change, "protocol", "changeDigest");
	const events = [start.events[0]];
	for (let revision = 2; revision <= 65; revision++) {
		events.push(inquiryEvent(admitted(createInquiryChange({...body, revision})), events.at(-1)));
	}
	const max = traceWithEvents(start, events.slice(0, 64));
	assert.equal(validateInquiryChangeTrace(max).ok, true);
	assert.deepEqual(admitted(decodeInquiryChangeTrace(admitted(encodeInquiryChangeTrace(max)))), max);
	assert.deepEqual(admitted(appendInquiryChangeEvent(traceWithEvents(start, events.slice(0, 63)), events[63])), max);
	const over = traceWithEvents(start, events);
	assert.equal(appendInquiryChangeEvent(max, events[64]).ok, false);
	assert.equal(validateInquiryChangeTrace(over).ok, false); assert.equal(encodeInquiryChangeTrace(over).ok, false);
	assert.equal(reduceChangeTrace(over).ok, false);
	const text = [start.header, ...events].map(value => admitted(canonicalJson(value))).join("\n") + "\n";
	assert.equal(decodeInquiryChangeTrace(text).ok, false);
});

test("Trace 16 exact 1-MiB JSONL boundary includes framing; one more byte fails on every path", () => {
	const prefix = inquiryTrace("sha1", [boundaryInquiry("sha1", 1), boundaryInquiry("sha1", 2), boundaryInquiry("sha1", 3)]);
	const maximal = inquiryEvent(boundaryInquiry("sha1", 4), prefix.events.at(-1));
	const overshoot = Buffer.byteLength(admitted(encodeInquiryChangeTrace(prefix))) + Buffer.byteLength(admitted(canonicalJson(maximal))) + 1 - MAX_INQUIRY_TRACE_BYTES;
	assert.ok(overshoot > 0);
	const bytes = 256 * 1024 - overshoot;
	const fourth = inquiryEvent(boundaryInquiry("sha1", 4, bytes), prefix.events.at(-1));
	const max = admitted(appendInquiryChangeEvent(prefix, fourth));
	const text = admitted(encodeInquiryChangeTrace(max)); assert.equal(Buffer.byteLength(text), MAX_INQUIRY_TRACE_BYTES);
	assert.deepEqual(admitted(decodeInquiryChangeTrace(text)), max); assert.equal(admitted(reduceChangeTrace(max)).change.revision, 4);
	const extra = inquiryEvent(boundaryInquiry("sha1", 4, bytes + 1), prefix.events.at(-1));
	const over = traceWithEvents(prefix, [...prefix.events, extra]);
	assert.equal(appendInquiryChangeEvent(prefix, extra).ok, false);
	assert.equal(validateInquiryChangeTrace(over).ok, false); assert.equal(encodeInquiryChangeTrace(over).ok, false);
	assert.equal(reduceChangeTrace(over).ok, false);
	const overText = [over.header, ...over.events].map(value => admitted(canonicalJson(value))).join("\n") + "\n";
	assert.equal(Buffer.byteLength(overText), MAX_INQUIRY_TRACE_BYTES + 1); assert.equal(decodeInquiryChangeTrace(overText).ok, false);
});

test("concrete Trace construction and replay reject hostile own-data shapes without running getters", () => {
	const {trace} = profileRecord();
	let accessed = 0;
	const fail = () => {accessed++; throw new Error("must not run");};
	const header = without(trace.header, "protocol", "traceId", "headerDigest");
	Object.defineProperty(header, "repositoryId", {enumerable: true, get: fail});
	assert.equal(createProfileChangeTraceHeader(header).ok, false);
	const hostile = {...trace}; Object.defineProperty(hostile, "events", {enumerable: true, get: fail});
	assert.equal(validateProfileChangeTrace(hostile).ok, false);
	assert.equal(encodeProfileChangeTrace(hostile).ok, false);
	assert.equal(reduceChangeTrace(hostile).ok, false);
	assert.equal(validateProfileChangeTrace({...trace, unrecorded: true}).ok, false);
	assert.equal(validateProfileChangeTrace(Object.create(trace)).ok, false);
	assert.equal(accessed, 0);
});
