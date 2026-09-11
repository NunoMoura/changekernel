import {
	assertDigestMatch, decodeContract, exactRecord, isNamespacedIdentifier, literalField,
	protocolField, protocolIdentity, rejectContract, textField, type ContractIssue,
} from "../data-contracts/validation.ts";
import {canonicalJson, parseCanonicalJson, type CanonicalValue} from "../data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../data-contracts/outcome.ts";
import {semanticDigest, semanticId, type SemanticIdentityIssue} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";
import {decodeGitOid, type GitObjectFormat} from "../identity/git.ts";
import {decodeChangeEvent, decodeProfileChangeEvent, type ChangeEvent, type ProfileChangeEvent, type SemanticEventOwners} from "./events.ts";

export const CHANGE_TRACE_PROTOCOL = protocolIdentity("codewiki.change-trace", "14.0.0");
export const PROFILE_CHANGE_TRACE_PROTOCOL = protocolIdentity("codewiki.change-trace", "15.0.0");
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
export interface ChangeTraceHeader extends ChangeTraceHeaderBody {readonly headerDigest: Sha256Digest;}
type TraceEvent = ChangeEvent | ProfileChangeEvent;
interface TraceRecord<E extends TraceEvent> {
	readonly header: ChangeTraceHeader;
	readonly events: readonly E[];
	readonly traceDigest: Sha256Digest;
}
export type ChangeTrace = TraceRecord<ChangeEvent>;
export type ProfileChangeTraceHeaderBody = ChangeTraceHeaderBody;
export type ProfileChangeTraceHeader = ChangeTraceHeader;
export type ProfileChangeTrace = TraceRecord<ProfileChangeEvent>;
export type ChangeTraceIssue = ContractIssue | SemanticIdentityIssue | Readonly<{code: "invalid_trace"; path: string; message: string}>;
export type ProfileChangeTraceIssue = ChangeTraceIssue;

type HeaderInput = Omit<ChangeTraceHeaderBody, "protocol" | "traceId">;
type TraceProtocol = typeof CHANGE_TRACE_PROTOCOL;
interface TraceCodec<E extends TraceEvent> {
	readonly protocol: TraceProtocol;
	readonly maximumEvents: number;
	readonly decodeEvent: (input: unknown) => Outcome<E, ContractIssue>;
}
const PROFILE_CODEC: TraceCodec<ProfileChangeEvent> = Object.freeze({
	protocol: PROFILE_CHANGE_TRACE_PROTOCOL, maximumEvents: 1, decodeEvent: decodeProfileChangeEvent,
});
function legacyCodec(owners: SemanticEventOwners): TraceCodec<ChangeEvent> {
	return {protocol: CHANGE_TRACE_PROTOCOL, maximumEvents: MAX_TRACE_EVENTS, decodeEvent: (input) => decodeChangeEvent(input, owners)};
}
function protocolLabel(protocol: TraceProtocol): string {return `${protocol.id}@${protocol.version}`;}

export function traceIdentity(repositoryId: string, changeId: string): Outcome<string, SemanticIdentityIssue> {
	return semanticId("cw:trace", protocolLabel(CHANGE_TRACE_PROTOCOL), {repositoryId, changeId});
}
export function profileTraceIdentity(repositoryId: string, changeId: string): Outcome<string, SemanticIdentityIssue> {
	return semanticId("cw:trace", protocolLabel(PROFILE_CHANGE_TRACE_PROTOCOL), {repositoryId, changeId});
}
export function createChangeTraceHeader(body: HeaderInput): Outcome<ChangeTraceHeader, ChangeTraceIssue> {
	return createHeader(body, CHANGE_TRACE_PROTOCOL);
}
export function createProfileChangeTraceHeader(body: HeaderInput): Outcome<ProfileChangeTraceHeader, ChangeTraceIssue> {
	return createHeader(body, PROFILE_CHANGE_TRACE_PROTOCOL);
}
export function decodeChangeTraceHeader(input: unknown): Outcome<ChangeTraceHeader, ContractIssue> {
	return decodeHeader(input, CHANGE_TRACE_PROTOCOL);
}
export function decodeProfileChangeTraceHeader(input: unknown): Outcome<ProfileChangeTraceHeader, ContractIssue> {
	return decodeHeader(input, PROFILE_CHANGE_TRACE_PROTOCOL);
}
export function createEmptyChangeTrace(header: ChangeTraceHeader): Outcome<ChangeTrace, ChangeTraceIssue> {
	return emptyTrace<ChangeEvent>(header, CHANGE_TRACE_PROTOCOL);
}
export function createEmptyProfileChangeTrace(header: ProfileChangeTraceHeader): Outcome<ProfileChangeTrace, ChangeTraceIssue> {
	return emptyTrace<ProfileChangeEvent>(header, PROFILE_CHANGE_TRACE_PROTOCOL);
}
export function appendChangeEvent(trace: ChangeTrace, event: ChangeEvent, owners: SemanticEventOwners): Outcome<ChangeTrace, ChangeTraceIssue> {
	return appendEvent(trace, event, legacyCodec(owners));
}
export function appendProfileChangeEvent(trace: ProfileChangeTrace, event: ProfileChangeEvent): Outcome<ProfileChangeTrace, ChangeTraceIssue> {
	return appendEvent(trace, event, PROFILE_CODEC);
}
export function validateChangeTrace(trace: ChangeTrace, owners: SemanticEventOwners, allowEmpty = false): Outcome<ChangeTrace, ChangeTraceIssue> {
	return validateTrace(trace, legacyCodec(owners), allowEmpty);
}
export function validateProfileChangeTrace(trace: ProfileChangeTrace, allowEmpty = false): Outcome<ProfileChangeTrace, ChangeTraceIssue> {
	return validateTrace(trace, PROFILE_CODEC, allowEmpty);
}
export function decodeChangeTrace(text: string, owners: SemanticEventOwners): Outcome<ChangeTrace, ChangeTraceIssue> {
	return decodeTrace(text, legacyCodec(owners));
}
export function decodeProfileChangeTrace(text: string): Outcome<ProfileChangeTrace, ChangeTraceIssue> {
	return decodeTrace(text, PROFILE_CODEC);
}
export function encodeChangeTrace(trace: ChangeTrace, owners: SemanticEventOwners): Outcome<string, ChangeTraceIssue> {
	return encodeTrace(trace, legacyCodec(owners));
}
export function encodeProfileChangeTrace(trace: ProfileChangeTrace): Outcome<string, ChangeTraceIssue> {
	return encodeTrace(trace, PROFILE_CODEC);
}

function createHeader(body: HeaderInput, protocol: TraceProtocol): Outcome<ChangeTraceHeader, ChangeTraceIssue> {
	const identity = semanticId("cw:trace", protocolLabel(protocol), {repositoryId: body.repositoryId, changeId: body.changeId});
	if (!identity.ok) return identity;
	const value = {...body, protocol, traceId: identity.value};
	const digest = semanticDigest(`${protocolLabel(protocol)}/header`, value);
	if (!digest.ok) return digest;
	return decodeHeader({...value, headerDigest: digest.value}, protocol);
}
function decodeHeader(input: unknown, protocol: TraceProtocol): Outcome<ChangeTraceHeader, ContractIssue> {
	return decodeContract("Change Trace header", input, (value) => decodeHeaderValue(value, protocol));
}
function decodeHeaderValue(value: CanonicalValue, protocol: TraceProtocol): ChangeTraceHeader {
	const record = exactRecord("Change Trace header", value, "$", ["changeId", "createdAt", "createdBy", "headerDigest", "objectFormat", "protocol", "repositoryId", "traceId"]);
	protocolField("Change Trace header", record, "$", protocol);
	const repositoryId = namespacedField(record, "repositoryId");
	const changeId = textField("Change Trace header", record, "changeId", "$", {maximumBytes: 200, pattern: /^CHG-[A-Za-z0-9][A-Za-z0-9._-]*$/u});
	const traceId = namespacedField(record, "traceId");
	const expectedId = semanticId("cw:trace", protocolLabel(protocol), {repositoryId, changeId});
	if (!expectedId.ok || traceId !== expectedId.value) rejectContract("invalid_field", "Change Trace header", "$.traceId", "Trace identity does not match repository and Change.");
	const headerDigest = decodeSha256Digest(record.headerDigest);
	if (!headerDigest.ok) rejectContract("invalid_field", "Change Trace header", "$.headerDigest", headerDigest.error.message);
	const body = Object.freeze({
		protocol, traceId, repositoryId, changeId,
		objectFormat: literalField("Change Trace header", record, "objectFormat", ["sha1", "sha256"] as const),
		createdBy: namespacedField(record, "createdBy"),
		createdAt: textField("Change Trace header", record, "createdAt", "$", {maximumBytes: 35, pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u}),
	});
	const expected = semanticDigest(`${protocolLabel(protocol)}/header`, body);
	if (!expected.ok) rejectContract("invalid_field", "Change Trace header", "$.headerDigest", expected.error.message);
	assertDigestMatch("Change Trace header", "$.headerDigest", headerDigest.value, expected.value);
	return Object.freeze({...body, headerDigest: headerDigest.value});
}
function emptyTrace<E extends TraceEvent>(header: ChangeTraceHeader, protocol: TraceProtocol): Outcome<TraceRecord<E>, ChangeTraceIssue> {
	const decoded = decodeHeader(header, protocol);
	return decoded.ok ? materializeTrace<E>(decoded.value, []) : decoded;
}
function appendEvent<E extends TraceEvent>(trace: TraceRecord<E>, event: E, codec: TraceCodec<E>): Outcome<TraceRecord<E>, ChangeTraceIssue> {
	const prefix = validateTrace(trace, codec, true);
	if (!prefix.ok) return prefix;
	if (prefix.value.events.length >= codec.maximumEvents) return failure(traceIssue("$.events", "Change Trace event count is invalid."));
	const decoded = codec.decodeEvent(event);
	if (!decoded.ok) return decoded;
	const issue = validateNextEvent(prefix.value.header, prefix.value.events, decoded.value);
	return issue ? failure(issue) : materializeTrace(prefix.value.header, [...prefix.value.events, decoded.value]);
}
function validateTrace<E extends TraceEvent>(trace: TraceRecord<E>, codec: TraceCodec<E>, allowEmpty: boolean): Outcome<TraceRecord<E>, ChangeTraceIssue> {
	const header = decodeHeader(trace.header, codec.protocol);
	if (!header.ok) return header;
	if (!Array.isArray(trace.events) || trace.events.length > codec.maximumEvents || (!allowEmpty && trace.events.length === 0)) return failure(traceIssue("$.events", "Change Trace event count is invalid."));
	const events: E[] = [];
	for (let index = 0; index < trace.events.length; index += 1) {
		const event = codec.decodeEvent(trace.events[index]);
		if (!event.ok) return event;
		const issue = validateNextEvent(header.value, events, event.value);
		if (issue) return failure(traceIssue(`$.events[${index}]`, issue.message));
		events.push(event.value);
	}
	const result = materializeTrace(header.value, events);
	if (!result.ok) return result;
	return result.value.traceDigest === trace.traceDigest ? result : failure(traceIssue("$.traceDigest", "Change Trace digest does not match immutable prefix."));
}
function decodeTrace<E extends TraceEvent>(text: string, codec: TraceCodec<E>): Outcome<TraceRecord<E>, ChangeTraceIssue> {
	if (typeof text !== "string" || text.length === 0 || text.length > MAX_TRACE_BYTES || new TextEncoder().encode(text).byteLength > MAX_TRACE_BYTES) return failure(traceIssue("$", "Change Trace byte length is outside bounds."));
	if (!text.endsWith("\n") || text.includes("\r")) return failure(traceIssue("$", "Change Trace must use LF lines and one terminal LF."));
	const lines = text.slice(0, -1).split("\n");
	if (lines.length < 2 || lines.length > codec.maximumEvents + 1 || lines.some((line) => line.length === 0)) return failure(traceIssue("$", "Change Trace line count or empty-line structure is invalid."));
	const headerLine = parseCanonicalJson(lines[0] ?? "", {requireCanonicalBytes: true});
	if (!headerLine.ok) return failure(traceIssue("$[0]", headerLine.error.message));
	const header = decodeHeader(headerLine.value, codec.protocol);
	if (!header.ok) return header;
	const events: E[] = [];
	for (let index = 1; index < lines.length; index += 1) {
		const line = parseCanonicalJson(lines[index] ?? "", {requireCanonicalBytes: true});
		if (!line.ok) return failure(traceIssue(`$[${index}]`, line.error.message));
		const event = codec.decodeEvent(line.value);
		if (!event.ok) return event;
		const issue = validateNextEvent(header.value, events, event.value);
		if (issue) return failure(traceIssue(`$[${index}]`, issue.message));
		events.push(event.value);
	}
	return materializeTrace(header.value, events);
}
function encodeTrace<E extends TraceEvent>(trace: TraceRecord<E>, codec: TraceCodec<E>): Outcome<string, ChangeTraceIssue> {
	const validated = validateTrace(trace, codec, false);
	if (!validated.ok) return validated;
	const lines: string[] = [];
	for (const [index, value] of [validated.value.header, ...validated.value.events].entries()) {
		const encoded = canonicalJson(value);
		if (!encoded.ok) return failure(traceIssue(`$[${index}]`, encoded.error.message));
		lines.push(encoded.value);
	}
	const text = `${lines.join("\n")}\n`;
	if (new TextEncoder().encode(text).byteLength > MAX_TRACE_BYTES) return failure(traceIssue("$", "Encoded Change Trace exceeds byte limit."));
	return success(text);
}
function validateNextEvent(header: ChangeTraceHeader, prefix: readonly TraceEvent[], event: TraceEvent): Extract<ChangeTraceIssue, {code: "invalid_trace"}> | null {
	if (event.predecessorEventDigest !== (prefix.at(-1)?.eventDigest ?? null)) return traceIssue("$.predecessorEventDigest", "Change event does not append to current immutable prefix.");
	if (prefix.length === 0 && event.kind !== "change.proposed") return traceIssue("$.kind", "First Change event must be change.proposed.");
	if (event.expectedProjectHead.algorithm !== header.objectFormat || (event.expectedChangeTip !== null && event.expectedChangeTip.algorithm !== header.objectFormat) || containsForeignGitOid(event.payload, header.objectFormat)) return traceIssue("$.event", "Change event Git object format differs from Trace header.");
	if (event.kind === "change.proposed" || event.kind === "change.revised") {
		const change = "change" in event.payload ? event.payload.change : null;
		if (!change || change.changeId !== header.changeId || change.repositoryId !== header.repositoryId) return traceIssue("$.event.payload.change", "Change event targets another Trace identity.");
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
function materializeTrace<E extends TraceEvent>(header: ChangeTraceHeader, events: readonly E[]): Outcome<TraceRecord<E>, ChangeTraceIssue> {
	const digest = semanticDigest(protocolLabel(header.protocol), {headerDigest: header.headerDigest, eventDigests: events.map((event) => event.eventDigest)});
	if (!digest.ok) return digest;
	return success(Object.freeze({header, events: Object.freeze([...events]), traceDigest: digest.value}));
}
function namespacedField(record: Readonly<{[key: string]: CanonicalValue}>, field: string): string {
	const value = textField("Change Trace header", record, field, "$", {maximumBytes: 256});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", "Change Trace header", `$.${field}`, "Identity must be canonical namespaced text.");
	return value;
}
function traceIssue(path: string, message: string): Extract<ChangeTraceIssue, {code: "invalid_trace"}> {
	return Object.freeze({code: "invalid_trace", path, message});
}
