import assert from "node:assert/strict";
import test from "node:test";
import {
	appendChangeEvent,
	createEmptyChangeTrace,
	decodeChangeTrace,
	encodeChangeTrace,
	validateChangeTrace,
} from "../../../src/kernel/changes/trace.ts";
import {createChangeEvent} from "../../../src/kernel/changes/events.ts";
import {EVENT_OWNERS} from "./events.test.mjs";
import {validTrace} from "./reducer.test.mjs";

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
