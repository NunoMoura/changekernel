import type {CanonicalJsonValue} from "../../utils/canonical-json.ts";
import {
	assertRequiredExactKeys as assertExactKeys,
	plainRecord as record,
} from "../../utils/json.ts";
import {
	assertNfcString,
	assertSemanticJsonValue,
	canonicalSemanticJson,
	parseCanonicalSemanticJson,
} from "../../utils/semantic-digest.ts";
import {
	assertGitObjectFormat,
	assertGitOid,
	assertStableId,
	type GitObjectFormat,
} from "../../project/git-store-profile.ts";
import {
	assertCompletionRequirementSet,
	type ChangeCompletionRequirement,
} from "../completion-requirement.ts";

export const CHANGE_TRACE_PROTOCOL =
	"codewiki.change-trace@13.0.0" as const;
export const CHANGE_TRACE_OPERATION_PROTOCOL =
	"codewiki.change-trace-operation@1.0.0" as const;

export const AUTHORITY_BEARING_CHANGE_OPERATION_KINDS = [
	"change.proposed",
	"decision.running",
	"decision.passed",
	"decision.failed",
	"decision.stopped",
	"confirmation.recorded",
	"change.accepted",
	"change.rejected",
	"change.deferred",
	"change.withdrawn",
	"requirement.ready",
	"requirement.running",
	"requirement.satisfied",
	"requirement.failed",
	"requirement.stopped",
	"requirement.superseded",
	"change.completed",
	"plugin.receipt.recorded",
	"delivery.recorded",
	"migration.applied",
] as const;

export type AuthorityBearingChangeOperationKind =
	(typeof AUTHORITY_BEARING_CHANGE_OPERATION_KINDS)[number];

export interface ChangeTraceHeader {
	readonly protocol: typeof CHANGE_TRACE_PROTOCOL;
	readonly traceId: string;
	readonly changeId: string;
	readonly projectId: string;
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly createdAt: string;
	readonly createdBy: string;
}

export interface ChangeTraceOperation {
	readonly protocol: typeof CHANGE_TRACE_OPERATION_PROTOCOL;
	readonly operationId: string;
	readonly kind: string;
	readonly authorityBearing: boolean;
	readonly actorId: string;
	readonly authorityId: string;
	readonly occurredAt: string;
	readonly payload: Readonly<Record<string, CanonicalJsonValue>>;
}

export interface ParsedChangeTrace {
	readonly header: ChangeTraceHeader;
	readonly operations: readonly ChangeTraceOperation[];
}

export interface ChangeTraceState {
	readonly changeId: string;
	readonly status:
		| "empty"
		| "proposed"
		| "decision_running"
		| "decision_passed"
		| "decision_failed"
		| "decision_stopped"
		| "confirmed"
		| "accepted_incomplete"
		| "completed"
		| "rejected"
		| "deferred"
		| "withdrawn";
	readonly proposalOrdinal: number;
	readonly completionRequirements: readonly ChangeCompletionRequirement[];
	readonly requirementStates: Readonly<Record<string, RequirementState>>;
	readonly operationCount: number;
}

export type RequirementState =
	| "pending"
	| "ready"
	| "running"
	| "satisfied"
	| "failed"
	| "stopped"
	| "superseded";

export function createChangeTraceHeader(input: {
	readonly changeId: string;
	readonly projectId: string;
	readonly repositoryId: string;
	readonly objectFormat: GitObjectFormat;
	readonly createdAt: string;
	readonly createdBy: string;
}): ChangeTraceHeader {
	const header = parseCanonicalSemanticJson(canonicalSemanticJson({
		protocol: CHANGE_TRACE_PROTOCOL,
		traceId: `TRACE-${input.changeId}`,
		...input,
	}));
	assertChangeTraceHeader(header);
	return header;
}

export function createChangeTraceOperation(input: {
	readonly operationId: string;
	readonly kind: string;
	readonly authorityBearing: boolean;
	readonly actorId: string;
	readonly authorityId: string;
	readonly occurredAt: string;
	readonly payload: Readonly<Record<string, CanonicalJsonValue>>;
}): ChangeTraceOperation {
	const operation = parseCanonicalSemanticJson(canonicalSemanticJson({
		protocol: CHANGE_TRACE_OPERATION_PROTOCOL,
		...input,
	}));
	assertChangeTraceOperation(operation);
	return operation;
}

export function changeTracePath(changeId: string): string {
	assertChangeId(changeId);
	return `.codewiki/changes/TRACE-${changeId}.jsonl`;
}

export function serializeChangeTrace(
	header: ChangeTraceHeader,
	operations: readonly ChangeTraceOperation[],
): string {
	assertChangeTraceHeader(header);
	const ids = new Set<string>();
	const lines = [canonicalSemanticJson(header)];
	for (const operation of operations) {
		assertChangeTraceOperation(operation, header);
		if (ids.has(operation.operationId)) {
			throw new Error("Change Trace operationId must be unique.");
		}
		ids.add(operation.operationId);
		lines.push(canonicalSemanticJson(operation));
	}
	return `${lines.join("\n")}\n`;
}

export function parseChangeTrace(bytes: string): ParsedChangeTrace {
	assertNfcString(bytes, "Change Trace bytes", 1, 64 * 1024 * 1024);
	if (bytes.includes("\r") || !bytes.endsWith("\n")) {
		throw new Error("Change Trace must use LF framing and end with LF.");
	}
	const lines = bytes.slice(0, -1).split("\n");
	if (lines.some((line) => line.length === 0)) {
		throw new Error("Change Trace must contain complete non-empty JSONL records.");
	}
	if (lines.some((line) => Buffer.byteLength(line, "utf8") > 1024 * 1024)) {
		throw new Error("Change Trace record exceeds 1048576 bytes.");
	}
	const headerValue = parseCanonicalSemanticJson(lines[0] ?? "");
	assertChangeTraceHeader(headerValue);
	const operations: ChangeTraceOperation[] = [];
	const ids = new Set<string>();
	for (const line of lines.slice(1)) {
		const value = parseCanonicalSemanticJson(line);
		assertChangeTraceOperation(value, headerValue);
		if (ids.has(value.operationId)) {
			throw new Error("Change Trace operationId must be unique.");
		}
		ids.add(value.operationId);
		operations.push(value);
	}
	const trace = Object.freeze({header: headerValue, operations: Object.freeze(operations)});
	reduceChangeTrace(trace);
	return trace;
}

export function appendChangeTraceOperation(
	predecessorBytes: string,
	operation: ChangeTraceOperation,
): string {
	const predecessor = parseChangeTrace(predecessorBytes);
	assertChangeTraceOperation(operation, predecessor.header);
	if (predecessor.operations.some(({operationId}) => operationId === operation.operationId)) {
		throw new Error("Change Trace operationId must be unique.");
	}
	const successor = `${predecessorBytes}${canonicalSemanticJson(operation)}\n`;
	parseChangeTrace(successor);
	if (!successor.startsWith(predecessorBytes)) {
		throw new Error("Change Trace successor must preserve exact predecessor bytes.");
	}
	return successor;
}

export function assertChangeTraceHeader(
	value: unknown,
): asserts value is ChangeTraceHeader {
	const header = record(value, "Change Trace header");
	assertExactKeys(header, [
		"changeId",
		"createdAt",
		"createdBy",
		"objectFormat",
		"projectId",
		"protocol",
		"repositoryId",
		"traceId",
	]);
	if (header.protocol !== CHANGE_TRACE_PROTOCOL) {
		throw new Error(`Change Trace protocol must be ${CHANGE_TRACE_PROTOCOL}.`);
	}
	assertChangeId(header.changeId);
	if (header.traceId !== `TRACE-${header.changeId}`) {
		throw new Error("Change Trace traceId must match changeId.");
	}
	assertStableId(header.projectId, "projectId");
	assertStableId(header.repositoryId, "repositoryId");
	assertGitObjectFormat(header.objectFormat);
	assertIsoTimestamp(header.createdAt, "createdAt");
	assertStableId(header.createdBy, "createdBy");
}

export function assertChangeTraceOperation(
	value: unknown,
	header?: ChangeTraceHeader,
): asserts value is ChangeTraceOperation {
	const operation = record(value, "Change Trace operation");
	assertExactKeys(operation, [
		"actorId",
		"authorityBearing",
		"authorityId",
		"kind",
		"occurredAt",
		"operationId",
		"payload",
		"protocol",
	]);
	if (operation.protocol !== CHANGE_TRACE_OPERATION_PROTOCOL) {
		throw new Error(`Change Trace operation protocol must be ${CHANGE_TRACE_OPERATION_PROTOCOL}.`);
	}
	assertStableId(operation.operationId, "operationId");
	assertOperationKind(operation.kind);
	if (typeof operation.authorityBearing !== "boolean") {
		throw new Error("authorityBearing must be boolean.");
	}
	const knownAuthority = AUTHORITY_BEARING_CHANGE_OPERATION_KINDS.includes(
		operation.kind as AuthorityBearingChangeOperationKind,
	);
	if (operation.authorityBearing !== knownAuthority) {
		throw new Error("Known authority operations cannot be downgraded and unknown authority operations fail closed.");
	}
	assertStableId(operation.actorId, "actorId");
	assertStableId(operation.authorityId, "authorityId");
	assertIsoTimestamp(operation.occurredAt, "occurredAt");
	const payload = record(operation.payload, "payload");
	assertSemanticJsonValue(payload);
	if (header !== undefined) assertKnownPayload(operation, payload, header);
}

export function reduceChangeTrace(
	trace: ParsedChangeTrace,
): ChangeTraceState {
	assertChangeTraceHeader(trace.header);
	let status: ChangeTraceState["status"] = "empty";
	let proposalOrdinal = 0;
	let requirements: readonly ChangeCompletionRequirement[] = [];
	const requirementStates: Record<string, RequirementState> = Object.create(null);
	for (const operation of trace.operations) {
		assertChangeTraceOperation(operation, trace.header);
		if (!operation.authorityBearing) continue;
		switch (operation.kind) {
			case "change.proposed": {
				if (["accepted_incomplete", "completed", "rejected", "deferred", "withdrawn"].includes(status)) {
					throw new Error("Terminal Change cannot receive another proposal.");
				}
				if (!["empty", "proposed", "decision_failed", "decision_stopped", "decision_passed", "confirmed"].includes(status)) {
					throw new Error("change.proposed is invalid in current state.");
				}
				proposalOrdinal += 1;
				requirements = proposedRequirements(operation.payload, trace.header);
				for (const key of Object.keys(requirementStates)) delete requirementStates[key];
				for (const requirement of requirements) requirementStates[requirement.requirementId] = "pending";
				status = "proposed";
				break;
			}
			case "decision.running":
				requireState(status, ["proposed"], operation.kind);
				status = "decision_running";
				break;
			case "decision.passed":
			case "decision.failed":
			case "decision.stopped":
				requireState(status, ["decision_running"], operation.kind);
				status = operation.kind.replace(".", "_") as ChangeTraceState["status"];
				break;
			case "confirmation.recorded":
				requireState(status, ["decision_passed"], operation.kind);
				status = "confirmed";
				break;
			case "change.accepted": {
				requireState(status, ["confirmed"], operation.kind);
				const frozen = proposedRequirements(operation.payload, trace.header);
				if (canonicalSemanticJson(frozen) !== canonicalSemanticJson(requirements)) {
					throw new Error("Acceptance must freeze the exact proposed Completion Requirements.");
				}
				const expectedCompletionState = requirements.length === 0
					? "completed"
					: "accepted_incomplete";
				if (operation.payload.completionState !== expectedCompletionState) {
					throw new Error("Acceptance completionState does not match frozen requirements.");
				}
				status = expectedCompletionState;
				break;
			}
			case "change.rejected":
			case "change.deferred":
			case "change.withdrawn":
				requireState(status, ["confirmed"], operation.kind);
				status = operation.kind.slice("change.".length) as "rejected" | "deferred" | "withdrawn";
				break;
			case "requirement.ready":
			case "requirement.running":
			case "requirement.satisfied":
			case "requirement.failed":
			case "requirement.stopped":
			case "requirement.superseded": {
				requireState(status, ["accepted_incomplete"], operation.kind);
				const requirementId = payloadString(operation.payload, "requirementId");
				if (!(requirementId in requirementStates)) {
					throw new Error("Requirement operation references unknown requirement.");
				}
				const next = operation.kind.slice("requirement.".length) as RequirementState;
				const current = requirementStates[requirementId];
				if (current === undefined) {
					throw new Error("Requirement state is unavailable.");
				}
				assertRequirementTransition(
					requirementId,
					current,
					next,
					requirements,
					requirementStates,
				);
				requirementStates[requirementId] = next;
				break;
			}
			case "change.completed":
				requireState(status, ["accepted_incomplete"], operation.kind);
				if (Object.values(requirementStates).some((state) => state !== "satisfied" && state !== "superseded")) {
					throw new Error("Change cannot complete with unresolved requirements.");
				}
				status = "completed";
				break;
			default:
				break;
		}
	}
	return Object.freeze({
		changeId: trace.header.changeId,
		status,
		proposalOrdinal,
		completionRequirements: requirements,
		requirementStates: Object.freeze({...requirementStates}),
		operationCount: trace.operations.length,
	});
}

function assertKnownPayload(
	operation: Readonly<Record<string, unknown>>,
	payload: Record<string, unknown>,
	header: ChangeTraceHeader,
): void {
	const kind = operation.kind;
	assertOperationKind(kind);
	if (kind === "change.proposed") {
		assertExactKeys(payload, [
			"authorityIntent",
			"compensatesChangeIds",
			"completionRationale",
			"completionRequirements",
			"desiredOutcomes",
			"expectedCanonical",
			"intent",
			"rationale",
			"relatedChangeIds",
			"supersedesChangeIds",
			"targetRefs",
		]);
		assertGitOid(payload.expectedCanonical, "expectedCanonical", header.objectFormat);
		assertNfcString(payload.intent, "intent", 1, 16_384);
		assertNfcString(payload.rationale, "rationale", 1, 16_384);
		assertNfcString(payload.completionRationale, "completionRationale", 1, 16_384);
		assertSortedStrings(payload.desiredOutcomes, "desiredOutcomes", 1, 128);
		assertSortedOperationKinds(payload.authorityIntent, "authorityIntent", 1, 128);
		assertSortedChangeIds(payload.relatedChangeIds, "relatedChangeIds", 0, 128);
		const compensatesChangeIds = payload.compensatesChangeIds;
		const supersedesChangeIds = payload.supersedesChangeIds;
		assertSortedChangeIds(compensatesChangeIds, "compensatesChangeIds", 0, 128);
		assertSortedChangeIds(supersedesChangeIds, "supersedesChangeIds", 0, 128);
		assertSortedStableIds(payload.targetRefs, "targetRefs", 0, 128);
		for (const changeId of [...compensatesChangeIds, ...supersedesChangeIds]) {
			if (changeId === header.changeId) {
				throw new Error("Change cannot compensate or supersede itself.");
			}
		}
		if (compensatesChangeIds.some((changeId) => supersedesChangeIds.includes(changeId))) {
			throw new Error("A prior Change cannot be both compensated and superseded.");
		}
		assertCompletionRequirementSet(payload.completionRequirements, {
			projectId: header.projectId,
			changeId: header.changeId,
		});
	}
	if (kind === "change.accepted") {
		assertExactKeys(payload, [
			"acceptedItemIds",
			"completionRequirements",
			"completionState",
			"confirmationId",
			"decisionId",
			"expectedCanonical",
			"gateId",
			"proposalCommit",
			"proposalTip",
			"retiredItemIds",
		]);
		assertDispositionBindings(payload, header);
		assertSortedStrings(payload.acceptedItemIds, "acceptedItemIds", 0, 4096);
		assertSortedStrings(payload.retiredItemIds, "retiredItemIds", 0, 4096);
		assertCompletionRequirementSet(payload.completionRequirements, {
			projectId: header.projectId,
			changeId: header.changeId,
		});
		if (payload.completionState !== "completed" && payload.completionState !== "accepted_incomplete") {
			throw new Error("completionState must be completed or accepted_incomplete.");
		}
	}
	if (kind === "change.rejected" || kind === "change.deferred" || kind === "change.withdrawn") {
		assertExactKeys(payload, [
			"confirmationId",
			"decisionId",
			"expectedCanonical",
			"gateId",
			"proposalCommit",
			"proposalTip",
			"reason",
		]);
		assertDispositionBindings(payload, header);
		assertNfcString(payload.reason, "reason", 1, 16_384);
	}
	if (kind === "migration.applied") {
		assertExactKeys(payload, [
			"migrationId",
			"migrationIntentDigest",
			"receiptDigest",
		]);
		assertStableId(payload.migrationId, "migrationId");
		assertSha256Digest(payload.migrationIntentDigest, "migrationIntentDigest");
		assertSha256Digest(payload.receiptDigest, "receiptDigest");
	}
	if (kind.startsWith("requirement.")) {
		assertStableId(payload.requirementId, "requirementId");
	}
}

function assertDispositionBindings(
	payload: Readonly<Record<string, unknown>>,
	header: ChangeTraceHeader,
): void {
	assertGitOid(payload.expectedCanonical, "expectedCanonical", header.objectFormat);
	assertGitOid(payload.proposalCommit, "proposalCommit", header.objectFormat);
	assertGitOid(payload.proposalTip, "proposalTip", header.objectFormat);
	assertStableId(payload.decisionId, "decisionId");
	assertStableId(payload.gateId, "gateId");
	assertStableId(payload.confirmationId, "confirmationId");
}

function assertRequirementTransition(
	requirementId: string,
	current: RequirementState,
	next: RequirementState,
	requirements: readonly ChangeCompletionRequirement[],
	states: Readonly<Record<string, RequirementState>>,
): void {
	const allowed: Readonly<Record<RequirementState, readonly RequirementState[]>> = {
		pending: ["ready", "superseded"],
		ready: ["running", "superseded"],
		running: ["satisfied", "failed", "stopped", "superseded"],
		satisfied: [],
		failed: ["ready", "superseded"],
		stopped: ["ready", "superseded"],
		superseded: [],
	};
	if (!allowed[current].includes(next)) {
		throw new Error(`Requirement transition ${current} -> ${next} is invalid.`);
	}
	if (next !== "ready") return;
	const requirement = requirements.find(
		(candidate) => candidate.requirementId === requirementId,
	);
	if (requirement === undefined) {
		throw new Error("Requirement definition is unavailable.");
	}
	for (const dependencyId of requirement.dependencyIds) {
		const dependencyState = states[dependencyId];
		if (dependencyState !== "satisfied" && dependencyState !== "superseded") {
			throw new Error("Requirement cannot become ready before dependencies close.");
		}
	}
}

function proposedRequirements(
	payload: Readonly<Record<string, CanonicalJsonValue>>,
	header: ChangeTraceHeader,
): readonly ChangeCompletionRequirement[] {
	const value = payload.completionRequirements;
	assertCompletionRequirementSet(value, {
		projectId: header.projectId,
		changeId: header.changeId,
	});
	return value;
}

function payloadString(
	payload: Readonly<Record<string, CanonicalJsonValue>>,
	field: string,
): string {
	const value = payload[field];
	assertStableId(value, field);
	return value;
}

function requireState(
	actual: ChangeTraceState["status"],
	expected: readonly ChangeTraceState["status"][],
	kind: string,
): void {
	if (!expected.includes(actual)) {
		throw new Error(`${kind} is invalid while Change is ${actual}.`);
	}
}

function assertChangeId(value: unknown): asserts value is string {
	assertStableId(value, "changeId");
	if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value)) {
		throw new Error("changeId is not path-safe.");
	}
}

function assertOperationKind(value: unknown): asserts value is string {
	assertNfcString(value, "operation kind", 3, 256);
	if (!/^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/u.test(value)) {
		throw new Error("operation kind must be namespaced lowercase text.");
	}
}

function assertSha256Digest(value: unknown, field: string): asserts value is string {
	if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
		throw new Error(`${field} must be a lowercase SHA-256 digest.`);
	}
}

function assertIsoTimestamp(value: unknown, field: string): asserts value is string {
	assertNfcString(value, field, 20, 32);
	const parsed = new Date(value);
	if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) {
		throw new Error(`${field} must be canonical ISO-8601 UTC.`);
	}
}

function assertSortedStableIds(
	value: unknown,
	field: string,
	minimum: number,
	maximum: number,
): asserts value is readonly string[] {
	assertSortedStrings(value, field, minimum, maximum);
	for (const [index, entry] of value.entries()) {
		assertStableId(entry, `${field}[${index}]`);
	}
}

function assertSortedChangeIds(
	value: unknown,
	field: string,
	minimum: number,
	maximum: number,
): asserts value is readonly string[] {
	assertSortedStrings(value, field, minimum, maximum);
	for (const entry of value) assertChangeId(entry);
}

function assertSortedOperationKinds(
	value: unknown,
	field: string,
	minimum: number,
	maximum: number,
): asserts value is readonly string[] {
	assertSortedStrings(value, field, minimum, maximum);
	for (const entry of value) assertOperationKind(entry);
}

function assertSortedStrings(
	value: unknown,
	field: string,
	minimum: number,
	maximum: number,
): asserts value is readonly string[] {
	if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
		throw new Error(`${field} must contain ${minimum}..${maximum} entries.`);
	}
	let previous: string | undefined;
	for (const [index, entry] of value.entries()) {
		assertNfcString(entry, `${field}[${index}]`, 1, 16_384);
		if (previous !== undefined && previous >= entry) {
			throw new Error(`${field} must be sorted and duplicate-free.`);
		}
		previous = entry;
	}
}
