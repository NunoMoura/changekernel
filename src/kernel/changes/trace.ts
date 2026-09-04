import {
	assertDigestMatch,
	decodeContract,
	exactRecord,
	isNamespacedIdentifier,
	literalField,
	protocolField,
	protocolIdentity,
	rejectContract,
	textField,
	type ContractIssue,
} from "../canonical/contract.ts";
import {
	canonicalJson,
	parseCanonicalJson,
	type CanonicalValue,
} from "../canonical/json.ts";
import {failure, success, type Outcome} from "../canonical/outcome.ts";
import {semanticDigest, semanticId, type SemanticIdentityIssue} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";
import {decodeGitOid, type GitObjectFormat} from "../identity/git.ts";
import {
	decodeChangeEvent,
	type ChangeEvent,
	type SemanticEventOwners,
} from "./events.ts";

export const CHANGE_TRACE_PROTOCOL = protocolIdentity("codewiki.change-trace", "14.0.0");
export const MAX_TRACE_BYTES = 16 * 1024 * 1024;
export const MAX_TRACE_EVENTS = 4_096;

export interface ChangeTraceHeaderBody {
	readonly protocol: typeof CHANGE_TRACE_PROTOCOL;
	readonly traceId: string;
	readonly repositoryId: string;
	readonly changeId: string;
	readonly objectFormat: GitObjectFormat;
	readonly createdBy: string;
	readonly createdAt: string;
}

export interface ChangeTraceHeader extends ChangeTraceHeaderBody {
	readonly headerDigest: Sha256Digest;
}

export interface ChangeTrace {
	readonly header: ChangeTraceHeader;
	readonly events: readonly ChangeEvent[];
	readonly traceDigest: Sha256Digest;
}

export type ChangeTraceIssue = ContractIssue | SemanticIdentityIssue | Readonly<{
	code: "invalid_trace";
	path: string;
	message: string;
}>;

export function traceIdentity(repositoryId: string, changeId: string): Outcome<string, SemanticIdentityIssue> {
	return semanticId("cw:trace", protocolLabel(), {repositoryId, changeId});
}

export function createChangeTraceHeader(
	body: Omit<ChangeTraceHeaderBody, "protocol" | "traceId">,
): Outcome<ChangeTraceHeader, ChangeTraceIssue> {
	const identity = traceIdentity(body.repositoryId, body.changeId);
	if (!identity.ok) return failure(identity.error);
	const value = {...body, protocol: CHANGE_TRACE_PROTOCOL, traceId: identity.value};
	const digest = semanticDigest(`${protocolLabel()}/header`, value);
	if (!digest.ok) return failure(digest.error);
	return decodeChangeTraceHeader({...value, headerDigest: digest.value});
}

export function decodeChangeTraceHeader(input: unknown): Outcome<ChangeTraceHeader, ContractIssue> {
	return decodeContract("Change Trace header", input, (value) => decodeHeaderValue(value));
}

export function createEmptyChangeTrace(header: ChangeTraceHeader): Outcome<ChangeTrace, ChangeTraceIssue> {
	const decoded = decodeChangeTraceHeader(header);
	if (!decoded.ok) return decoded;
	return materializeTrace(decoded.value, []);
}

export function appendChangeEvent(
	trace: ChangeTrace,
	event: ChangeEvent,
	owners: SemanticEventOwners,
): Outcome<ChangeTrace, ChangeTraceIssue> {
	const validated = validateChangeTrace(trace, owners, true);
	if (!validated.ok) return validated;
	if (trace.events.length >= MAX_TRACE_EVENTS) return failure(traceIssue("$.events", "Change Trace event limit reached."));
	const decodedEvent = decodeChangeEvent(event, owners);
	if (!decodedEvent.ok) return decodedEvent;
	const issue = validateNextEvent(trace.header, trace.events, decodedEvent.value);
	if (issue) return failure(issue);
	return materializeTrace(trace.header, [...trace.events, decodedEvent.value]);
}

export function validateChangeTrace(
	trace: ChangeTrace,
	owners: SemanticEventOwners,
	allowEmpty = false,
): Outcome<ChangeTrace, ChangeTraceIssue> {
	const header = decodeChangeTraceHeader(trace.header);
	if (!header.ok) return header;
	if (trace.events.length > MAX_TRACE_EVENTS || (!allowEmpty && trace.events.length === 0)) {
		return failure(traceIssue("$.events", "Change Trace event count is invalid."));
	}
	const events: ChangeEvent[] = [];
	for (let index = 0; index < trace.events.length; index += 1) {
		const decoded = decodeChangeEvent(trace.events[index], owners);
		if (!decoded.ok) return decoded;
		const issue = validateNextEvent(header.value, events, decoded.value);
		if (issue) return failure(traceIssue(`$.events[${index}]`, issue.message));
		events.push(decoded.value);
	}
	const materialized = materializeTrace(header.value, events);
	if (!materialized.ok) return materialized;
	if (materialized.value.traceDigest !== trace.traceDigest) return failure(traceIssue("$.traceDigest", "Change Trace digest does not match immutable prefix."));
	return materialized;
}

export function decodeChangeTrace(
	text: string,
	owners: SemanticEventOwners,
): Outcome<ChangeTrace, ChangeTraceIssue> {
	const byteLength = new TextEncoder().encode(text).byteLength;
	if (byteLength === 0 || byteLength > MAX_TRACE_BYTES) return failure(traceIssue("$", "Change Trace byte length is outside bounds."));
	if (!text.endsWith("\n") || text.includes("\r")) return failure(traceIssue("$", "Change Trace must use LF lines and one terminal LF."));
	const lines = text.slice(0, -1).split("\n");
	if (lines.length < 2 || lines.length > MAX_TRACE_EVENTS + 1 || lines.some((line) => line.length === 0)) {
		return failure(traceIssue("$", "Change Trace line count or empty-line structure is invalid."));
	}
	const headerLine = parseCanonicalJson(lines[0] ?? "", {requireCanonicalBytes: true});
	if (!headerLine.ok) return failure(traceIssue("$[0]", headerLine.error.message));
	const header = decodeChangeTraceHeader(headerLine.value);
	if (!header.ok) return header;
	const events: ChangeEvent[] = [];
	for (let index = 1; index < lines.length; index += 1) {
		const line = parseCanonicalJson(lines[index] ?? "", {requireCanonicalBytes: true});
		if (!line.ok) return failure(traceIssue(`$[${index}]`, line.error.message));
		const event = decodeChangeEvent(line.value, owners);
		if (!event.ok) return event;
		const issue = validateNextEvent(header.value, events, event.value);
		if (issue) return failure(traceIssue(`$[${index}]`, issue.message));
		events.push(event.value);
	}
	return materializeTrace(header.value, events);
}

export function encodeChangeTrace(trace: ChangeTrace, owners: SemanticEventOwners): Outcome<string, ChangeTraceIssue> {
	const validated = validateChangeTrace(trace, owners);
	if (!validated.ok) return validated;
	const values: unknown[] = [validated.value.header, ...validated.value.events];
	const lines: string[] = [];
	for (let index = 0; index < values.length; index += 1) {
		const encoded = canonicalJson(values[index]);
		if (!encoded.ok) return failure(traceIssue(`$[${index}]`, encoded.error.message));
		lines.push(encoded.value);
	}
	const text = `${lines.join("\n")}\n`;
	if (new TextEncoder().encode(text).byteLength > MAX_TRACE_BYTES) return failure(traceIssue("$", "Encoded Change Trace exceeds byte limit."));
	return success(text);
}

function decodeHeaderValue(value: CanonicalValue): ChangeTraceHeader {
	const record = exactRecord("Change Trace header", value, "$", [
		"changeId",
		"createdAt",
		"createdBy",
		"headerDigest",
		"objectFormat",
		"protocol",
		"repositoryId",
		"traceId",
	]);
	protocolField("Change Trace header", record, "$", CHANGE_TRACE_PROTOCOL);
	const repositoryId = namespacedField(record, "repositoryId");
	const changeId = textField("Change Trace header", record, "changeId", "$", {
		maximumBytes: 200,
		pattern: /^CHG-[A-Za-z0-9][A-Za-z0-9._-]*$/u,
	});
	const traceId = namespacedField(record, "traceId");
	const expectedId = traceIdentity(repositoryId, changeId);
	if (!expectedId.ok || traceId !== expectedId.value) rejectContract("invalid_field", "Change Trace header", "$.traceId", "Trace identity does not match repository and Change.");
	const headerDigest = digestField(record, "headerDigest");
	const result = Object.freeze({
		protocol: CHANGE_TRACE_PROTOCOL,
		traceId,
		repositoryId,
		changeId,
		objectFormat: literalField("Change Trace header", record, "objectFormat", ["sha1", "sha256"] as const),
		createdBy: namespacedField(record, "createdBy"),
		createdAt: textField("Change Trace header", record, "createdAt", "$", {
			maximumBytes: 35,
			pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u,
		}),
		headerDigest,
	});
	const {headerDigest: _headerDigest, ...body} = result;
	const expected = semanticDigest(`${protocolLabel()}/header`, body);
	if (!expected.ok) rejectContract("invalid_field", "Change Trace header", "$.headerDigest", expected.error.message);
	assertDigestMatch("Change Trace header", "$.headerDigest", headerDigest, expected.value);
	return result;
}

function validateNextEvent(
	header: ChangeTraceHeader,
	prefix: readonly ChangeEvent[],
	event: ChangeEvent,
): Extract<ChangeTraceIssue, {code: "invalid_trace"}> | null {
	const expectedPredecessor = prefix.at(-1)?.eventDigest ?? null;
	if (event.predecessorEventDigest !== expectedPredecessor) {
		return traceIssue("$.predecessorEventDigest", "Change event does not append to current immutable prefix.");
	}
	if (prefix.length === 0 && event.kind !== "change.proposed") {
		return traceIssue("$.kind", "First Change event must be change.proposed.");
	}
	return validateEventBinding(header, event);
}

function validateEventBinding(header: ChangeTraceHeader, event: ChangeEvent): Extract<ChangeTraceIssue, {code: "invalid_trace"}> | null {
	if (event.expectedProjectHead.algorithm !== header.objectFormat || (event.expectedChangeTip !== null && event.expectedChangeTip.algorithm !== header.objectFormat) ||
		containsForeignGitOid(event.payload, header.objectFormat)) {
		return traceIssue("$.event", "Change event Git object format differs from Trace header.");
	}
	if (event.kind === "change.proposed" || event.kind === "change.revised") {
		const change = "change" in event.payload ? event.payload.change : null;
		if (!change || change.changeId !== header.changeId || change.repositoryId !== header.repositoryId) {
			return traceIssue("$.event.payload.change", "Change event targets another Trace identity.");
		}
	}
	return null;
}

function containsForeignGitOid(value: unknown, objectFormat: GitObjectFormat): boolean {
	if (Array.isArray(value)) return value.some((entry) => containsForeignGitOid(entry, objectFormat));
	if (typeof value !== "object" || value === null) return false;
	const oid = decodeGitOid(value);
	if (oid.ok) return oid.value.algorithm !== objectFormat;
	return Object.values(value).some((entry) => containsForeignGitOid(entry, objectFormat));
}

function materializeTrace(header: ChangeTraceHeader, events: readonly ChangeEvent[]): Outcome<ChangeTrace, ChangeTraceIssue> {
	const digest = semanticDigest(protocolLabel(), {
		headerDigest: header.headerDigest,
		eventDigests: events.map((event) => event.eventDigest),
	});
	if (!digest.ok) return failure(digest.error);
	return success(Object.freeze({header, events: Object.freeze([...events]), traceDigest: digest.value}));
}

function namespacedField(record: Readonly<{[key: string]: CanonicalValue}>, field: string): string {
	const value = textField("Change Trace header", record, field, "$", {maximumBytes: 256});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", "Change Trace header", `$.${field}`, "Identity must be canonical namespaced text.");
	return value;
}

function digestField(record: Readonly<{[key: string]: CanonicalValue}>, field: string): Sha256Digest {
	const decoded = decodeSha256Digest(record[field]);
	if (!decoded.ok) rejectContract("invalid_field", "Change Trace header", `$.${field}`, decoded.error.message);
	return decoded.value;
}

function traceIssue(path: string, message: string): Extract<ChangeTraceIssue, {code: "invalid_trace"}> {
	return Object.freeze({code: "invalid_trace", path, message});
}

function protocolLabel(): string {
	return `${CHANGE_TRACE_PROTOCOL.id}@${CHANGE_TRACE_PROTOCOL.version}`;
}
