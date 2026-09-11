import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {canonicalJson} from "../../../src/kernel/data-contracts/canonical-json.ts";
import {changeFixture} from "./contracts.test.mjs";
import {
	appendChangeEvent,
	createEmptyChangeTrace,
	decodeChangeTrace,
	encodeChangeTrace,
	validateChangeTrace,
	appendProfileChangeEvent,
	createEmptyProfileChangeTrace,
	decodeProfileChangeTrace,
	encodeProfileChangeTrace,
	validateProfileChangeTrace,
} from "../../../src/kernel/changes/trace.ts";
import {createChangeEvent} from "../../../src/kernel/changes/events.ts";
import {EVENT_OWNERS} from "./events.test.mjs";
import {validTrace} from "./reducer.test.mjs";
import {reduceChangeTrace} from "../../../src/kernel/changes/reducer.ts";
import {createProfileChangeEvent} from "../../../src/kernel/changes/events.ts";
import {admitted, profileRecord} from "../wiki/profile-fixtures.mjs";

test("Trace 15 uses the common append/replay/reducer with strict old/new protocol separation", () => {
	const {trace, event, change} = profileRecord();
	const text = admitted(encodeProfileChangeTrace(trace));
	assert.equal(admitted(encodeProfileChangeTrace(admitted(decodeProfileChangeTrace(text)))), text);
	assert.equal(validateProfileChangeTrace(trace).ok, true);
	const reduced = admitted(reduceChangeTrace(trace));
	assert.equal(reduced.state, "proposed");
	assert.deepEqual(reduced.change, change);
	assert.deepEqual(reduced.gates, []); assert.deepEqual(reduced.work, []);
	assert.equal(reduced.committedWikiTree, null); assert.equal(reduced.completionTree, null);
	const old = traceFixture();
	assert.equal(decodeChangeTrace(text, EVENT_OWNERS).ok, false);
	assert.equal(decodeProfileChangeTrace(admitted(encodeChangeTrace(old, EVENT_OWNERS))).ok, false);
	assert.equal(appendChangeEvent(admitted(createEmptyChangeTrace(old.header)), event, EVENT_OWNERS).ok, false);
	assert.equal(appendProfileChangeEvent(admitted(createEmptyProfileChangeTrace(trace.header)), old.events[0]).ok, false);
	assert.equal(appendProfileChangeEvent(trace, event).ok, false);
	assert.equal(reduceChangeTrace({...trace, events: [event, event]}).ok, false);
	assert.equal(reduceChangeTrace({...trace, traceDigest: `sha256:${"f".repeat(64)}`}).ok, false);
	const {protocol, containingCommit, eventDigest, ...body} = event;
	void protocol; void containingCommit; void eventDigest;
	for (const patch of [
		{payload: {change: old.events[0].payload.change}}, {kind: "change.committed"},
		{ownerBinding: {...event.ownerBinding, kernelBuildDigest: `sha256:${"f".repeat(64)}`}},
		{ownerBinding: {...event.ownerBinding, transactionDigest: `sha256:${"f".repeat(64)}`}},
		{expectedProjectHead: event.payload.change.reference.after.commit}, {expectedChangeTip: event.expectedProjectHead},
	]) assert.equal(createProfileChangeEvent({...body, ...patch}).ok, false);
});

test("legacy canonical Change, Trace and reduction bytes match the pre-attachment checkpoint", () => {
	// Independently captured from immutable checkpoint 3778a6651d03d1fe0e66f6222677655c0ea8fd97.
	const hash = (text) => createHash("sha256").update(text).digest("hex");
	const trace = traceFixture();
	assert.equal(hash(admitted(canonicalJson(changeFixture()))), "4677bc2f210771be9fbdc1ffeb780e8b0d0a0404839cdb556b1076cf6e2c9e26");
	assert.equal(hash(admitted(encodeChangeTrace(trace, EVENT_OWNERS))), "dc5c028fd6e100107bc823d7d97e311bf651a8a508f77dc3c94be4949b31233d");
	assert.equal(hash(admitted(canonicalJson(admitted(reduceChangeTrace(trace))))), "05911d9b70d14952f4a9da8b63eacc3bf80734fe0070416aaf23a895df547055");
});

export function traceFixture() {
	return validTrace().trace;
}

test("Change Trace v14 is one bounded append-only Change history", () => {
	const trace = traceFixture();
	assert.equal(trace.header.protocol.version, "14.0.0");
	assert.equal(trace.events.length, 14);
	assert.equal(validateChangeTrace(trace, EVENT_OWNERS).ok, true);
});

test("canonical JSONL replay is deterministic and idempotent", () => {
	const trace = traceFixture();
	const encoded = encodeChangeTrace(trace, EVENT_OWNERS);
	assert.equal(encoded.ok, true);
	const first = decodeChangeTrace(encoded.value, EVENT_OWNERS);
	const second = decodeChangeTrace(encoded.value, EVENT_OWNERS);
	assert.equal(first.ok, true);
	assert.equal(second.ok, true);
	assert.equal(first.value.traceDigest, trace.traceDigest);
	assert.equal(second.value.traceDigest, trace.traceDigest);
	assert.equal(encodeChangeTrace(first.value, EVENT_OWNERS).value, encoded.value);
});

test("append API preserves exact accepted prefix", () => {
	const complete = traceFixture();
	let current = createEmptyChangeTrace(complete.header).value;
	for (const event of complete.events) {
		const prefix = JSON.stringify(current.events);
		const appended = appendChangeEvent(current, event, EVENT_OWNERS);
		assert.equal(appended.ok, true, appended.ok ? undefined : appended.error.message);
		current = appended.value;
		assert.equal(JSON.stringify(current.events.slice(0, -1)), prefix);
	}
	assert.equal(current.traceDigest, complete.traceDigest);
});

test("v13, malformed JSONL, noncanonical bytes, and forged digest are rejected", () => {
	const trace = traceFixture();
	const encoded = encodeChangeTrace(trace, EVENT_OWNERS).value;
	const lines = encoded.trimEnd().split("\n");
	const header = JSON.parse(lines[0]);
	for (const input of [
		[JSON.stringify({...header, protocol: {...header.protocol, version: "13.0.0"}}), ...lines.slice(1)].join("\n") + "\n",
		"not-json\n",
		`${encoded}\n`,
		encoded.replace("\"changeId\"", "\"changeId\" "),
	]) assert.equal(decodeChangeTrace(input, EVENT_OWNERS).ok, false);
	assert.equal(validateChangeTrace({...trace, traceDigest: `sha256:${"f".repeat(64)}`}, EVENT_OWNERS).ok, false);
});

test("Trace rejects broken predecessor, event repository binding, mixed object format, and empty accepted history", () => {
	const trace = traceFixture();
	const broken = {...trace, events: trace.events.map((event, index) => index === 1 ? {...event, predecessorEventDigest: null} : event)};
	assert.equal(validateChangeTrace(broken, EVENT_OWNERS).ok, false);
	const wrongRepository = {...trace, events: trace.events.map((event, index) => index === 0 ? {...event, payload: {change: {...event.payload.change, repositoryId: "cw:repository:other"}}} : event)};
	assert.equal(validateChangeTrace(wrongRepository, EVENT_OWNERS).ok, false);

	const mixedIndex = trace.events.findIndex((event) => event.kind === "work.attempt.recorded");
	let prefix = createEmptyChangeTrace(trace.header).value;
	for (const event of trace.events.slice(0, mixedIndex)) prefix = appendChangeEvent(prefix, event, EVENT_OWNERS).value;
	const source = trace.events[mixedIndex];
	const {protocol: ignoredProtocol, containingCommit: ignoredMarker, eventDigest: ignoredDigest, ...body} = source;
	void ignoredProtocol;
	void ignoredMarker;
	void ignoredDigest;
	const mixed = createChangeEvent({...body, payload: {
		...source.payload,
		resultCommit: {algorithm: "sha256", hex: "e".repeat(64)},
		resultTree: {algorithm: "sha256", hex: "f".repeat(64)},
	}}, EVENT_OWNERS);
	assert.equal(mixed.ok, true);
	assert.equal(appendChangeEvent(prefix, mixed.value, EVENT_OWNERS).ok, false);
	assert.equal(validateChangeTrace(createEmptyChangeTrace(trace.header).value, EVENT_OWNERS).ok, false);
});
