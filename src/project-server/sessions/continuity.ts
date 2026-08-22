import {
	createRunSessionLeaseBinding,
	type RunRawLogReference,
	type RunReceipt,
	type RunSessionBinding,
	type RunSessionLeaseBinding,
	type RuntimeBuildBinding,
} from "../../runtime/contracts.ts";
import {
	assertSha256Digest,
	canonicalJson,
	canonicalJsonDigest,
	toCanonicalJsonValue,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export const SESSION_CONTINUITY_PROTOCOL = Object.freeze({
	id: "codewiki.session-continuity",
	version: "1.0.0",
} as const);

export type SessionHead = Sha256Digest | "absent";
export type SessionRolloverReason =
	| "runtime-build-change"
	| "protocol-change"
	| "corruption"
	| "role-change"
	| "compaction-lock"
	| "quality-decline";

export interface ActiveSessionLease {
	readonly binding: RunSessionLeaseBinding;
	readonly cancellationRequestedAt: string | null;
}

export interface SessionRollover {
	readonly previousSessionId: string;
	readonly previousSessionHead: SessionHead;
	readonly previousRuntimeBuild: RuntimeBuildBinding;
	readonly reason: SessionRolloverReason;
	readonly rehydrationDigest: Sha256Digest;
	readonly rolledAt: string;
	readonly rolloverDigest: Sha256Digest;
}

export interface SessionContinuityRecord {
	readonly protocol: typeof SESSION_CONTINUITY_PROTOCOL;
	readonly continuityKey: string;
	readonly generation: number;
	readonly previousRecordDigest: Sha256Digest | null;
	readonly sessionId: string;
	readonly sessionHead: SessionHead;
	readonly runtimeBuild: RuntimeBuildBinding;
	readonly activeLease: ActiveSessionLease | null;
	readonly lastReceiptDigest: Sha256Digest | null;
	readonly rollover: SessionRollover | null;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly recordDigest: Sha256Digest;
}

export interface SessionLeaseAdmission {
	readonly record: SessionContinuityRecord;
	readonly session: RunSessionBinding;
}

export function createSessionContinuity(input: {
	readonly continuityKey: string;
	readonly sessionId: string;
	readonly runtimeBuild: RuntimeBuildBinding;
	readonly createdAt: string;
}): SessionContinuityRecord {
	const createdAt = timestamp(input.createdAt, "Session continuity createdAt");
	return recordFrom({
		continuityKey: identifier(input.continuityKey, "Session continuity key"),
		generation: 0,
		previousRecordDigest: null,
		sessionId: identifier(input.sessionId, "Session ID"),
		sessionHead: "absent",
		runtimeBuild: runtimeBuild(input.runtimeBuild),
		activeLease: null,
		lastReceiptDigest: null,
		rollover: null,
		createdAt,
		updatedAt: createdAt,
	});
}

export function acquireSessionLease(input: {
	readonly record: SessionContinuityRecord;
	readonly expectedRecordDigest: Sha256Digest;
	readonly expectedSessionHead: SessionHead;
	readonly leaseId: string;
	readonly runId: string;
	readonly acquiredAt: string;
	readonly expiresAt: string;
	readonly resumeLog: RunRawLogReference | null;
}): SessionLeaseAdmission {
	const record = assertSessionContinuityRecord(input.record);
	assertExpectedRecord(record, input.expectedRecordDigest);
	if (record.activeLease !== null) {
		throw new Error("Session continuity already has an active writer lease.");
	}
	if (record.sessionHead !== input.expectedSessionHead) {
		throw new Error("Session lease expected head is stale.");
	}
	const acquiredAt = advancingTimestamp(
		input.acquiredAt,
		record.updatedAt,
		"Session lease acquisition",
	);
	const binding = createRunSessionLeaseBinding({
		leaseId: identifier(input.leaseId, "Session lease ID"),
		generation: record.generation + 1,
		runId: identifier(input.runId, "Session lease Run ID"),
		acquiredAt,
		expiresAt: timestamp(input.expiresAt, "Session lease expiresAt"),
	});
	const session = sessionBinding(record, binding, input.resumeLog);
	const next = recordFrom({
		...recordBody(record),
		generation: record.generation + 1,
		previousRecordDigest: record.recordDigest,
		activeLease: Object.freeze({binding, cancellationRequestedAt: null}),
		updatedAt: acquiredAt,
	});
	return Object.freeze({record: next, session});
}

export function requestSessionLeaseCancellation(input: {
	readonly record: SessionContinuityRecord;
	readonly expectedRecordDigest: Sha256Digest;
	readonly leaseId: string;
	readonly requestedAt: string;
}): SessionContinuityRecord {
	const record = activeLeaseRecord(input.record, input.expectedRecordDigest, input.leaseId);
	if (record.activeLease.cancellationRequestedAt !== null) {
		throw new Error("Session writer lease cancellation is already requested.");
	}
	const requestedAt = advancingTimestamp(
		input.requestedAt,
		record.updatedAt,
		"Session lease cancellation",
	);
	return recordFrom({
		...recordBody(record),
		generation: record.generation + 1,
		previousRecordDigest: record.recordDigest,
		activeLease: Object.freeze({
			binding: record.activeLease.binding,
			cancellationRequestedAt: requestedAt,
		}),
		updatedAt: requestedAt,
	});
}

export function expireSessionLease(input: {
	readonly record: SessionContinuityRecord;
	readonly expectedRecordDigest: Sha256Digest;
	readonly leaseId: string;
	readonly observedAt: string;
}): SessionContinuityRecord {
	const record = activeLeaseRecord(input.record, input.expectedRecordDigest, input.leaseId);
	const observedAt = advancingTimestamp(
		input.observedAt,
		record.updatedAt,
		"Session lease expiry observation",
	);
	if (Date.parse(observedAt) < Date.parse(record.activeLease.binding.expiresAt)) {
		throw new Error("Session writer lease has not expired.");
	}
	return recordFrom({
		...recordBody(record),
		generation: record.generation + 1,
		previousRecordDigest: record.recordDigest,
		activeLease: null,
		updatedAt: observedAt,
	});
}

export function commitSessionRunReceipt(input: {
	readonly record: SessionContinuityRecord;
	readonly expectedRecordDigest: Sha256Digest;
	readonly leaseId: string;
	readonly receipt: RunReceipt;
}): SessionContinuityRecord {
	const record = activeLeaseRecord(input.record, input.expectedRecordDigest, input.leaseId);
	const {receipt, activeLease} = {receipt: input.receipt, activeLease: record.activeLease};
	if (
		receipt.continuityKey !== record.continuityKey ||
		receipt.sessionId !== record.sessionId ||
		receipt.expectedSessionHead !== record.sessionHead ||
		receipt.sessionLeaseDigest !== activeLease.binding.leaseDigest ||
		receipt.runId !== activeLease.binding.runId ||
		canonicalJson(receipt.runtimeBuild) !== canonicalJson(record.runtimeBuild)
	) {
		throw new Error("Run Receipt does not match its Session continuity lease.");
	}
	if (Date.parse(receipt.finishedAt) > Date.parse(activeLease.binding.expiresAt)) {
		throw new Error("Run Receipt finished after its Session writer lease expired.");
	}
	const updatedAt = advancingTimestamp(
		receipt.finishedAt,
		record.updatedAt,
		"Session receipt commit",
	);
	return recordFrom({
		...recordBody(record),
		generation: record.generation + 1,
		previousRecordDigest: record.recordDigest,
		sessionHead: receipt.resultingSessionHead ?? record.sessionHead,
		activeLease: null,
		lastReceiptDigest: receipt.receiptDigest,
		updatedAt,
	});
}

export function rolloverSessionContinuity(input: {
	readonly record: SessionContinuityRecord;
	readonly expectedRecordDigest: Sha256Digest;
	readonly newSessionId: string;
	readonly newRuntimeBuild: RuntimeBuildBinding;
	readonly reason: SessionRolloverReason;
	readonly rehydrationDigest: Sha256Digest;
	readonly rolledAt: string;
}): SessionContinuityRecord {
	const record = assertSessionContinuityRecord(input.record);
	assertExpectedRecord(record, input.expectedRecordDigest);
	if (record.activeLease !== null) {
		throw new Error("Cannot roll over Session continuity with an active writer lease.");
	}
	const newSessionId = identifier(input.newSessionId, "Rollover Session ID");
	if (newSessionId === record.sessionId) {
		throw new Error("Session rollover requires a new Session ID.");
	}
	const newRuntimeBuild = runtimeBuild(input.newRuntimeBuild);
	if (
		input.reason === "runtime-build-change" &&
		newRuntimeBuild.buildDigest === record.runtimeBuild.buildDigest
	) {
		throw new Error("Runtime Build rollover requires a changed Build digest.");
	}
	if (
		input.reason === "protocol-change" &&
		newRuntimeBuild.runProtocolVersion === record.runtimeBuild.runProtocolVersion
	) {
		throw new Error("Protocol rollover requires a changed Run protocol version.");
	}
	const rolledAt = advancingTimestamp(input.rolledAt, record.updatedAt, "Session rollover");
	const rolloverBody = {
		previousSessionId: record.sessionId,
		previousSessionHead: record.sessionHead,
		previousRuntimeBuild: record.runtimeBuild,
		reason: rolloverReason(input.reason),
		rehydrationDigest: assertSha256Digest(
			input.rehydrationDigest,
			"Session rollover rehydration digest",
		),
		rolledAt,
	};
	// SAFETY: rolloverBody is constructed from validated protocol fields; canonicalization preserves that shape.
	const rollover = toCanonicalJsonValue({
		...rolloverBody,
		rolloverDigest: canonicalJsonDigest(rolloverBody),
	}) as unknown as SessionRollover;
	return recordFrom({
		...recordBody(record),
		generation: record.generation + 1,
		previousRecordDigest: record.recordDigest,
		sessionId: newSessionId,
		sessionHead: "absent",
		runtimeBuild: newRuntimeBuild,
		activeLease: null,
		lastReceiptDigest: null,
		rollover,
		updatedAt: rolledAt,
	});
}

export function assertSessionContinuityRecord(value: unknown): SessionContinuityRecord {
	if (!isRecord(value) || !hasExactKeys(value, [
		"protocol",
		"continuityKey",
		"generation",
		"previousRecordDigest",
		"sessionId",
		"sessionHead",
		"runtimeBuild",
		"activeLease",
		"lastReceiptDigest",
		"rollover",
		"createdAt",
		"updatedAt",
		"recordDigest",
	])) {
		throw new Error("Session continuity record shape is invalid.");
	}
	if (
		!isRecord(value.protocol) ||
		value.protocol.id !== SESSION_CONTINUITY_PROTOCOL.id ||
		value.protocol.version !== SESSION_CONTINUITY_PROTOCOL.version
	) {
		throw new Error("Session continuity protocol is unsupported.");
	}
	const generation = integer(value.generation, "Session continuity generation");
	const previousRecordDigest = optionalDigest(value.previousRecordDigest, "Previous Session continuity digest");
	if ((generation === 0) !== (previousRecordDigest === null)) {
		throw new Error("Session continuity generation and previous digest disagree.");
	}
	const activeLease = normalizeActiveLease(value.activeLease);
	const rollover = normalizeRollover(value.rollover);
	const body = {
		continuityKey: identifier(value.continuityKey, "Session continuity key"),
		generation,
		previousRecordDigest,
		sessionId: identifier(value.sessionId, "Session ID"),
		sessionHead: sessionHead(value.sessionHead, "Session head"),
		runtimeBuild: runtimeBuild(value.runtimeBuild),
		activeLease,
		lastReceiptDigest: optionalDigest(value.lastReceiptDigest, "Last Run Receipt digest"),
		rollover,
		createdAt: timestamp(value.createdAt, "Session continuity createdAt"),
		updatedAt: timestamp(value.updatedAt, "Session continuity updatedAt"),
	};
	const recordDigest = assertSha256Digest(value.recordDigest, "Session continuity record digest");
	const expected = recordFrom(body);
	if (recordDigest !== expected.recordDigest || canonicalJson(value) !== canonicalJson(expected)) {
		throw new Error("Session continuity record identity is invalid.");
	}
	return expected;
}

function sessionBinding(
	record: SessionContinuityRecord,
	lease: RunSessionLeaseBinding,
	resumeLog: RunRawLogReference | null,
): RunSessionBinding {
	if (record.sessionHead === "absent") {
		if (resumeLog !== null) {
			throw new Error("New Session continuity cannot carry a resume log.");
		}
		return Object.freeze({
			mode: "create",
			continuityKey: record.continuityKey,
			sessionId: record.sessionId,
			expectedHead: "absent",
			lease,
			resumeLog: null,
		});
	}
	if (
		resumeLog === null ||
		resumeLog.sessionId !== record.sessionId ||
		resumeLog.digest !== record.sessionHead ||
		resumeLog.runtimeBuildDigest !== record.runtimeBuild.buildDigest
	) {
		throw new Error("Session resume log does not match retained continuity.");
	}
	return Object.freeze({
		mode: "resume",
		continuityKey: record.continuityKey,
		sessionId: record.sessionId,
		expectedHead: record.sessionHead,
		lease,
		resumeLog,
	});
}

function activeLeaseRecord(
	value: SessionContinuityRecord,
	expectedRecordDigest: Sha256Digest,
	leaseId: string,
): SessionContinuityRecord & {readonly activeLease: ActiveSessionLease} {
	const record = assertSessionContinuityRecord(value);
	assertExpectedRecord(record, expectedRecordDigest);
	if (record.activeLease?.binding.leaseId !== leaseId) {
		throw new Error("Session writer lease identity is stale.");
	}
	return record as SessionContinuityRecord & {readonly activeLease: ActiveSessionLease};
}

function assertExpectedRecord(record: SessionContinuityRecord, expected: Sha256Digest): void {
	if (assertSha256Digest(expected, "Expected Session continuity digest") !== record.recordDigest) {
		throw new Error("Session continuity expected head is stale.");
	}
}

type SessionRecordBody = Omit<SessionContinuityRecord, "protocol" | "recordDigest">;

function recordBody(record: SessionContinuityRecord): SessionRecordBody {
	const {protocol: _protocol, recordDigest: _digest, ...body} = record;
	return body;
}

function recordFrom(body: SessionRecordBody): SessionContinuityRecord {
	const normalized = toCanonicalJsonValue({protocol: SESSION_CONTINUITY_PROTOCOL, ...body});
	// SAFETY: callers construct complete SessionRecordBody values; canonicalization only deep-freezes JSON fields.
	const digestBody = normalized as unknown as Omit<SessionContinuityRecord, "recordDigest">;
	// SAFETY: digestBody plus its canonical digest is exactly the SessionContinuityRecord wire shape.
	return toCanonicalJsonValue({
		...digestBody,
		recordDigest: canonicalJsonDigest(digestBody),
	}) as unknown as SessionContinuityRecord;
}

function normalizeActiveLease(value: unknown): ActiveSessionLease | null {
	if (value === null) return null;
	if (!isRecord(value) || !hasExactKeys(value, ["binding", "cancellationRequestedAt"])) {
		throw new Error("Active Session lease shape is invalid.");
	}
	if (!isRecord(value.binding)) {
		throw new Error("Active Session lease binding is invalid.");
	}
	const binding = createRunSessionLeaseBinding({
		leaseId: identifier(value.binding.leaseId, "Session lease ID"),
		generation: positiveInteger(value.binding.generation, "Session lease generation"),
		runId: identifier(value.binding.runId, "Session lease Run ID"),
		acquiredAt: timestamp(value.binding.acquiredAt, "Session lease acquiredAt"),
		expiresAt: timestamp(value.binding.expiresAt, "Session lease expiresAt"),
	});
	if (canonicalJson(binding) !== canonicalJson(value.binding)) {
		throw new Error("Active Session lease identity is invalid.");
	}
	return Object.freeze({
		binding,
		cancellationRequestedAt: value.cancellationRequestedAt === null
			? null
			: timestamp(value.cancellationRequestedAt, "Session lease cancellation time"),
	});
}

function normalizeRollover(value: unknown): SessionRollover | null {
	if (value === null) return null;
	if (!isRecord(value) || !hasExactKeys(value, [
		"previousSessionId",
		"previousSessionHead",
		"previousRuntimeBuild",
		"reason",
		"rehydrationDigest",
		"rolledAt",
		"rolloverDigest",
	])) {
		throw new Error("Session rollover shape is invalid.");
	}
	const body = {
		previousSessionId: identifier(value.previousSessionId, "Previous Session ID"),
		previousSessionHead: sessionHead(value.previousSessionHead, "Previous Session head"),
		previousRuntimeBuild: runtimeBuild(value.previousRuntimeBuild),
		reason: rolloverReason(value.reason),
		rehydrationDigest: assertSha256Digest(value.rehydrationDigest, "Session rollover rehydration digest"),
		rolledAt: timestamp(value.rolledAt, "Session rollover time"),
	};
	const rolloverDigest = assertSha256Digest(value.rolloverDigest, "Session rollover digest");
	if (canonicalJsonDigest(body) !== rolloverDigest) {
		throw new Error("Session rollover digest is invalid.");
	}
	// SAFETY: every rollover field and its canonical digest are validated above.
	return toCanonicalJsonValue({...body, rolloverDigest}) as unknown as SessionRollover;
}

function runtimeBuild(value: unknown): RuntimeBuildBinding {
	if (!isRecord(value) || !hasExactKeys(value, ["buildDigest", "runProtocolVersion"])) {
		throw new Error("Session Runtime Build binding shape is invalid.");
	}
	if (typeof value.runProtocolVersion !== "string" || !/^\d+\.\d+\.\d+$/.test(value.runProtocolVersion)) {
		throw new Error("Session Run protocol version is invalid.");
	}
	return Object.freeze({
		buildDigest: assertSha256Digest(value.buildDigest, "Session Runtime Build digest"),
		runProtocolVersion: value.runProtocolVersion,
	});
}

function sessionHead(value: unknown, field: string): SessionHead {
	return value === "absent" ? "absent" : assertSha256Digest(value, field);
}

function rolloverReason(value: unknown): SessionRolloverReason {
	const reasons: readonly SessionRolloverReason[] = [
		"runtime-build-change",
		"protocol-change",
		"corruption",
		"role-change",
		"compaction-lock",
		"quality-decline",
	];
	if (!reasons.includes(value as SessionRolloverReason)) {
		throw new Error("Session rollover reason is invalid.");
	}
	return value as SessionRolloverReason;
}

function identifier(value: unknown, field: string): string {
	if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value)) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}

function timestamp(value: unknown, field: string): string {
	if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
		throw new Error(`${field} is invalid.`);
	}
	return value;
}

function advancingTimestamp(value: string, previous: string, action: string): string {
	const normalized = timestamp(value, `${action} time`);
	if (Date.parse(normalized) < Date.parse(previous)) {
		throw new Error(`${action} cannot move time backward.`);
	}
	return normalized;
}

function integer(value: unknown, field: string): number {
	if (!Number.isSafeInteger(value) || (value as number) < 0) {
		throw new Error(`${field} is invalid.`);
	}
	return value as number;
}

function positiveInteger(value: unknown, field: string): number {
	const normalized = integer(value, field);
	if (normalized < 1) throw new Error(`${field} is invalid.`);
	return normalized;
}

function optionalDigest(value: unknown, field: string): Sha256Digest | null {
	return value === null ? null : assertSha256Digest(value, field);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
	const actual = Object.keys(value).sort(compareText);
	const expected = [...keys].sort(compareText);
	return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
