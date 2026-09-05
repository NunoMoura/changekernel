import assert from "node:assert/strict";
import test from "node:test";
import {createChangeEvent} from "../../../src/kernel/changes/events.ts";
import {reduceChangeTrace} from "../../../src/kernel/changes/reducer.ts";
import {
	appendChangeEvent,
	createChangeTraceHeader,
	createEmptyChangeTrace,
	validateChangeTrace,
} from "../../../src/kernel/changes/trace.ts";
import {workPlanDigest} from "../../../src/kernel/work/contracts.ts";
import {workFixture} from "../work/contracts.test.mjs";
import {changeFixture, CHANGE_ID} from "./contracts.test.mjs";
import {digest, EVENT_OWNERS, oid} from "./events.test.mjs";

function append(trace, kind, payload) {
	const previous = trace.events.at(-1) ?? null;
	const event = createChangeEvent({
		kind,
		ownerItemId: EVENT_OWNERS[kind],
		actorId: "cw:actor:maintainer",
		authorityId: "cw:authority:project-server",
		commandId: `cw:command:event-${String(trace.events.length).padStart(2, "0")}`,
		commandDigest: digest("c"),
		occurredAt: `2026-09-01T00:00:${String(trace.events.length).padStart(2, "0")}Z`,
		expectedProjectHead: oid("1"),
		expectedChangeTip: previous === null ? null : oid("9"),
		predecessorEventDigest: previous?.eventDigest ?? null,
		payload,
	}, EVENT_OWNERS);
	assert.equal(event.ok, true, event.ok ? undefined : event.error.message);
	const next = appendChangeEvent(trace, event.value, EVENT_OWNERS);
	assert.equal(next.ok, true, next.ok ? undefined : next.error.message);
	return next.value;
}

function emptyTrace() {
	const header = createChangeTraceHeader({
		repositoryId: "cw:repository:test",
		changeId: CHANGE_ID,
		objectFormat: "sha1",
		createdBy: "cw:authority:project-server",
		createdAt: "2026-09-01T00:00:00Z",
	});
	assert.equal(header.ok, true, header.ok ? undefined : header.error.message);
	const trace = createEmptyChangeTrace(header.value);
	assert.equal(trace.ok, true, trace.ok ? undefined : trace.error.message);
	return trace.value;
}

export function validTrace() {
	const change = changeFixture();
	const work = workFixture();
	let trace = emptyTrace();
	trace = append(trace, "change.proposed", {change});
	trace = append(trace, "gate.recorded", {gateDigest: digest("1"), outcomeDigest: digest("2"), stage: "decision", status: "passed", subjectDigest: change.changeDigest, workId: null, runDigests: [], resultDigests: [], evidenceDigests: []});
	trace = append(trace, "change.committed", {decisionGateDigest: digest("1"), wikiTree: oid("a")});
	const planDigest = workPlanDigest([work]).value;
	trace = append(trace, "gate.recorded", {gateDigest: digest("3"), outcomeDigest: digest("4"), stage: "planning", status: "passed", subjectDigest: planDigest, workId: null, runDigests: [], resultDigests: [], evidenceDigests: []});
	trace = append(trace, "change.planned", {planningGateDigest: digest("3"), planDigest, work: [work]});
	trace = append(trace, "work.claimed", {workId: work.workId, claimId: "cw:claim:one", receiptDigest: digest("5")});
	trace = append(trace, "work.assigned", {workId: work.workId, claimId: "cw:claim:one", assignmentId: "cw:assignment:one", baseCommit: oid("b"), baseTree: oid("c"), runRequestDigest: digest("6")});
	trace = append(trace, "work.attempt.recorded", {workId: work.workId, assignmentId: "cw:assignment:one", runId: "cw:dsh-run:one", runReceiptDigest: digest("7"), resultCommit: oid("d"), resultTree: oid("e")});
	trace = append(trace, "gate.recorded", {gateDigest: digest("8"), outcomeDigest: digest("9"), stage: "implementation", status: "passed", subjectDigest: work.workDigest, workId: work.workId, runDigests: [], resultDigests: [], evidenceDigests: []});
	trace = append(trace, "work.integrated", {workId: work.workId, resultCommit: oid("d"), resultTree: oid("e"), implementationGateDigest: digest("8")});
	trace = append(trace, "review.reconciled", {prospectiveTree: oid("f"), integratedWorkIds: [work.workId], reviewSubjectDigest: digest("a")});
	trace = append(trace, "gate.recorded", {gateDigest: digest("b"), outcomeDigest: digest("c"), stage: "review", status: "passed", subjectDigest: digest("a"), workId: null, runDigests: [], resultDigests: [], evidenceDigests: []});
	trace = append(trace, "change.completed", {completionTree: oid("f"), reviewGateDigest: digest("b")});
	trace = append(trace, "effect.recorded", {capability: "codewiki.capability:publish", authorizationId: "cw:authorization:publish", kernelBuildDigest: digest("f"), requestDigest: digest("d"), receiptDigest: digest("e"), status: "passed", subjectOids: [oid("f")]});
	return {change, work, trace};
}

test("Change reducer reaches completion from one append-only semantic history", () => {
	const {change, work, trace} = validTrace();
	const reduced = reduceChangeTrace(trace);
	assert.equal(reduced.ok, true, reduced.ok ? undefined : reduced.error.message);
	assert.equal(reduced.value.state, "completed");
	assert.equal(reduced.value.change.changeDigest, change.changeDigest);
	assert.equal(reduced.value.work[0].work.workDigest, work.workDigest);
	assert.equal(reduced.value.work[0].status, "integrated");
	assert.equal(reduced.value.gates.length, 4);
	assert.equal(reduced.value.effects[0].capability, "codewiki.capability:publish");
});

test("Trace and reducer enforce immutable predecessor and expected-tip shape", () => {
	const {trace} = validTrace();
	const predecessor = {...trace, events: trace.events.map((event, index) => index === 1 ? {...event, predecessorEventDigest: null} : event)};
	assert.equal(validateChangeTrace(predecessor, EVENT_OWNERS).ok, false);
	const missingTip = {...trace, events: trace.events.map((event, index) => index === 1 ? {...event, expectedChangeTip: null} : event)};
	assert.equal(reduceChangeTrace(missingTip).ok, false);
	const unexpectedInitialTip = {...trace, events: trace.events.map((event, index) => index === 0 ? {...event, expectedChangeTip: oid("9")} : event)};
	assert.equal(reduceChangeTrace(unexpectedInitialTip).ok, false);
});

test("Change reducer enforces gate-backed lifecycle transitions", () => {
	const change = changeFixture();
	let trace = emptyTrace();
	trace = append(trace, "change.proposed", {change});
	const decisionGate = {gateDigest: digest("1"), outcomeDigest: digest("2"), stage: "decision", status: "passed", subjectDigest: change.changeDigest, workId: null, runDigests: [], resultDigests: [], evidenceDigests: []};
	trace = append(trace, "gate.recorded", decisionGate);
	assert.equal(reduceChangeTrace(append(trace, "gate.recorded", decisionGate)).ok, false, "Gate facts cannot be replayed");
	trace = append(trace, "change.deferred", {reason: "Await dependency.", gateDigest: digest("1")});
	assert.equal(reduceChangeTrace(trace).value.state, "deferred");
	trace = append(trace, "change.resumed", {reason: "Dependency ready."});
	assert.equal(reduceChangeTrace(trace).value.state, "proposed");
	trace = append(trace, "change.rejected", {reason: "No longer valid.", gateDigest: digest("1")});
	assert.equal(reduceChangeTrace(trace).ok, false, "resume invalidates earlier decision gate");

	let wrongSubject = emptyTrace();
	wrongSubject = append(wrongSubject, "change.proposed", {change});
	wrongSubject = append(wrongSubject, "gate.recorded", {gateDigest: digest("1"), outcomeDigest: digest("2"), stage: "decision", status: "passed", subjectDigest: digest("f"), workId: null, runDigests: [], resultDigests: [], evidenceDigests: []});
	assert.equal(reduceChangeTrace(wrongSubject).ok, false, "Decision Gate must bind exact Change digest");
});

test("Work result and integration must match prior Trace facts", () => {
	const {trace} = validTrace();
	const index = trace.events.findIndex((event) => event.kind === "work.integrated");
	const changed = [...trace.events];
	changed[index] = {...changed[index], payload: {...changed[index].payload, resultTree: oid("a")}};
	assert.equal(reduceChangeTrace({...trace, events: changed}).ok, false);
});

test("Planning amendment appends Work without rewriting existing Work", () => {
	const source = validTrace();
	const integrationIndex = source.trace.events.findIndex((event) => event.kind === "work.integrated");
	let trace = emptyTrace();
	for (const event of source.trace.events.slice(0, integrationIndex + 1)) trace = append(trace, event.kind, event.payload);
	const repair = workFixture(2, {dependencies: [source.work.workId], writablePaths: ["src/repair/**"]});
	const planDigest = workPlanDigest([source.work, repair]).value;
	trace = append(trace, "gate.recorded", {gateDigest: digest("b"), outcomeDigest: digest("c"), stage: "planning", status: "passed", subjectDigest: planDigest, workId: null, runDigests: [], resultDigests: [], evidenceDigests: []});
	trace = append(trace, "change.planned", {planningGateDigest: digest("b"), planDigest, work: [source.work, repair]});
	const reduced = reduceChangeTrace(trace);
	assert.equal(reduced.ok, true, reduced.ok ? undefined : reduced.error.message);
	assert.equal(reduced.value.work.length, 2);
});

test("passed Implementation Gate cannot authorize a newer Work attempt", () => {
	const source = validTrace().trace;
	const gateIndex = source.events.findIndex((event) => event.kind === "gate.recorded" && event.payload.stage === "implementation");
	let wrongSubject = emptyTrace();
	for (const event of source.events.slice(0, gateIndex)) wrongSubject = append(wrongSubject, event.kind, event.payload);
	wrongSubject = append(wrongSubject, "gate.recorded", {...source.events[gateIndex].payload, subjectDigest: digest("f")});
	assert.equal(reduceChangeTrace(wrongSubject).ok, false, "Implementation Gate must bind exact Work digest");

	let trace = emptyTrace();
	for (const event of source.events.slice(0, gateIndex + 1)) trace = append(trace, event.kind, event.payload);
	const workId = source.events.find((event) => event.kind === "work.attempt.recorded").payload.workId;
	trace = append(trace, "work.claimed", {workId, claimId: "cw:claim:two", receiptDigest: digest("b")});
	trace = append(trace, "work.assigned", {workId, claimId: "cw:claim:two", assignmentId: "cw:assignment:two", baseCommit: oid("d"), baseTree: oid("e"), runRequestDigest: digest("c")});
	trace = append(trace, "work.attempt.recorded", {workId, assignmentId: "cw:assignment:two", runId: "cw:dsh-run:two", runReceiptDigest: digest("d"), resultCommit: oid("1"), resultTree: oid("2")});
	trace = append(trace, "work.integrated", {workId, resultCommit: oid("1"), resultTree: oid("2"), implementationGateDigest: digest("8")});
	assert.equal(reduceChangeTrace(trace).ok, false);
});
