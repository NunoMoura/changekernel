import assert from "node:assert/strict";

import {createHash} from "node:crypto";
import {canonicalJson} from "../../../src/kernel/data-contracts/canonical-json.ts";
import {semanticDigest} from "../../../src/kernel/identity/semantic-digest.ts";

import {WIKI_PROFILE_ID} from "../../../src/kernel/wiki/profile.ts";

import {createInquiryChange, createInquirySource, INQUIRY_LIMITS} from "../../../src/kernel/changes/inquiry.ts";
import {createInquiryChangeEvent} from "../../../src/kernel/changes/events.ts";
import {createInquiryChangeTraceHeader, createEmptyInquiryChangeTrace, appendInquiryChangeEvent} from "../../../src/kernel/changes/trace.ts";
import {admitted, profileRecord, PROFILE_CHANGE_ID} from "../wiki/profile-fixtures.mjs";

export const rawDigest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
export const fixtureDigest = (character = "a") => `sha256:${character.repeat(64)}`;
export const rawHex = (text) => Buffer.from(text, "utf8").toString("hex");
export function without(value, ...fields) { const body = {...value}; for (const field of fields) delete body[field]; return body; }
export function sourceFixture(text = "Why does the setting fail?\r\n", overrides = {}) {
	return admitted(createInquirySource({kind: "submitted", contentUtf8Hex: rawHex(text), contentDigest: rawDigest(Buffer.from(text)), claimedLocator: null, claimedAttribution: null, ...overrides}));
}
export function inquiryBody(format = "sha1", overrides = {}) {
	const {before} = profileRecord(format);
	const source = sourceFixture();
	return {
		changeId: PROFILE_CHANGE_ID, repositoryId: before.snapshot.repositoryId, revision: 1, baseline: before.snapshot, profile: WIKI_PROFILE_ID,
		intent: "Why does the setting fail?", intentBasis: {kind: "supplied", sourceDigests: [source.sourceDigest], producerRunRef: null},
		rationale: null, scope: null, changeType: null, realization: null,
		acceptance: [], questions: [], assumptions: [], sources: [source], relationships: [], wikiConsequences: {kind: "unresolved"}, ...overrides,
	};
}
export const inquiryFixture = (format = "sha1", overrides = {}) => admitted(createInquiryChange(inquiryBody(format, overrides)));
export function boundaryInquiry(format = "sha1", revision = 1, bytes = INQUIRY_LIMITS.changeBytes) {
	const source = sourceFixture("x".repeat(INQUIRY_LIMITS.submittedBytes));
	const body = inquiryBody(format, {revision, sources: [source], intentBasis: {kind: "supplied", sourceDigests: [source.sourceDigest], producerRunRef: null},
		acceptance: Array(32).fill("x"), questions: Array(32).fill("x"), assumptions: Array(32).fill("x")});
	let remaining = bytes - Buffer.byteLength(admitted(canonicalJson(admitted(createInquiryChange(body)))));
	assert.ok(remaining >= 0);
	for (const field of ["acceptance", "questions", "assumptions"]) {
		for (let index = 0; index < body[field].length; index++) {
			const added = Math.min(remaining, INQUIRY_LIMITS.statementBytes - 1);
			body[field][index] += "x".repeat(added); remaining -= added;
		}
	}
	assert.equal(remaining, 0);
	const change = admitted(createInquiryChange(body));
	assert.equal(Buffer.byteLength(admitted(canonicalJson(change))), bytes);
	return change;
}
export function repositorySource(format = "sha1", overrides = {}) {
	const {before} = profileRecord(format);
	return admitted(createInquirySource({kind: "repository", snapshot: before.snapshot, pathUtf8Hex: rawHex("notes/e\u0301 design.MD"), mode: "100644", blob: {algorithm: format, hex: "a".repeat(format === "sha1" ? 40 : 64)}, contentDigest: rawDigest(Buffer.from("# Notes\r\n")), ...overrides}));
}
export function inquiryEvent(change = inquiryFixture(), predecessor = null, overrides = {}) {
	return admitted(createInquiryChangeEvent({
		kind: predecessor ? "change.revised" : "change.proposed",
		ownerBinding: {kind: "kernel", profile: change.profile, kernelBuildDigest: change.wikiConsequences.kind === "profile" ? change.wikiConsequences.reference.kernelBuildDigest : fixtureDigest("a")},
		actorId: "cw:actor:intake", authorityId: "cw:authority:project-server",
		commandId: `cw:command:inquiry-${change.revision}`, commandDigest: fixtureDigest("b"), occurredAt: "2026-09-03T12:00:00Z",
		expectedProjectHead: change.baseline.commit,
		expectedChangeTip: predecessor ? {algorithm: change.baseline.objectFormat, hex: "9".repeat(change.baseline.objectFormat === "sha1" ? 40 : 64)} : null,
		predecessorEventDigest: predecessor?.eventDigest ?? null,
		payload: predecessor ? {change, reason: "Retain the original question; refine its scope."} : {change}, ...overrides,
	}));
}
export function inquiryTrace(format = "sha1", changes = [inquiryFixture(format)]) {
	const header = admitted(createInquiryChangeTraceHeader({repositoryId: changes[0].repositoryId, changeId: changes[0].changeId, objectFormat: format, createdBy: "cw:authority:project-server", createdAt: "2026-09-03T12:00:00Z"}));
	let trace = admitted(createEmptyInquiryChangeTrace(header));
	for (const change of changes) trace = admitted(appendInquiryChangeEvent(trace, inquiryEvent(change, trace.events.at(-1))));
	return trace;
}
export function traceWithEvents(trace, events) {
	return {...trace, events, traceDigest: admitted(semanticDigest(`${trace.header.protocol.id}@${trace.header.protocol.version}`, {
		headerDigest: trace.header.headerDigest, eventDigests: events.map(event => event.eventDigest),
	}))};
}
export function assertDeepFrozen(value) {
	if (typeof value !== "object" || value === null) return;
	assert.equal(Object.isFrozen(value), true);
	for (const child of Object.values(value)) assertDeepFrozen(child);
}
export function ownDataAttacks(body, onAccess = () => {}) {
	const key = Object.keys(body)[0];
	const accessor = {...body}; Object.defineProperty(accessor, key, {enumerable: true, get() { onAccess(); throw new Error("getter must not run"); }});
	const hidden = {...body}; Object.defineProperty(hidden, "secret", {value: 1});
	const symbol = {...body, [Symbol("hidden")]: 1};
	const inherited = Object.assign(Object.create({inherited: true}), body);
	const undefinedField = {...body, extra: undefined};
	const cyclic = {...body}; cyclic.extra = cyclic;
	const sparse = {...body, extra: Array(2)};
	const adorned = []; adorned.extra = true;
	const getterArray = [1]; Object.defineProperty(getterArray, "0", {get() { onAccess(); throw new Error("array getter must not run"); }});
	return [accessor, hidden, symbol, inherited, undefinedField, cyclic, sparse, {...body, extra: adorned}, {...body, extra: getterArray}];
}
