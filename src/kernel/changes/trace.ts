import {
	assertDigestMatch, decodeContract, exactRecord, isNamespacedIdentifier, literalField,
	protocolField, protocolIdentity, rejectContract, requiredField, textField, type ContractIssue,
} from "../data-contracts/validation.ts";
import {canonicalJson, DEFAULT_CANONICAL_LIMITS, parseCanonicalJson, type CanonicalLimits, type CanonicalValue} from "../data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../data-contracts/outcome.ts";
import {semanticDigest, semanticId, type SemanticIdentityIssue} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";
import {decodeGitOid, type GitObjectFormat} from "../identity/git.ts";
import {decodeProfileChangeEvent, decodeInquiryChangeEvent, INQUIRY_EVENT_CANONICAL_LIMITS, type ProfileChangeEvent, type InquiryChangeEvent} from "./events.ts";
export const PROFILE_CHANGE_TRACE_PROTOCOL = protocolIdentity("codewiki.change-trace", "15.0.0");
export const INQUIRY_CHANGE_TRACE_PROTOCOL = protocolIdentity("codewiki.change-trace", "16.0.0");
export const MAX_INQUIRY_TRACE_BYTES = 1024 * 1024;
export const MAX_INQUIRY_TRACE_EVENTS = 64;
const INQUIRY_TRACE_CANONICAL_LIMITS: CanonicalLimits = Object.freeze({
	maximumDepth: 40, maximumEntriesPerContainer: 1024, maximumNodes: 100_000,
	maximumTextBytes: MAX_INQUIRY_TRACE_BYTES,
});
export const MAX_TRACE_BYTES = 16 * 1024 * 1024;

export interface ChangeTraceHeaderBody {
	readonly protocol: typeof PROFILE_CHANGE_TRACE_PROTOCOL;
	readonly traceId: string;
	readonly repositoryId: string;
	readonly changeId: string;
	readonly objectFormat: GitObjectFormat;
	readonly createdBy: string;
	readonly createdAt: string;
}
export interface ChangeTraceHeader extends ChangeTraceHeaderBody {readonly headerDigest: Sha256Digest;}
type TraceEvent = ProfileChangeEvent | InquiryChangeEvent;
interface TraceRecord<E extends TraceEvent> {
	readonly header: ChangeTraceHeader;
	readonly events: readonly E[];
	readonly traceDigest: Sha256Digest;
}
export type ProfileChangeTraceHeaderBody = ChangeTraceHeaderBody;
export type ProfileChangeTraceHeader = ChangeTraceHeader;
export type ProfileChangeTrace = TraceRecord<ProfileChangeEvent>;
export type InquiryChangeTraceHeaderBody = ChangeTraceHeaderBody;
export type InquiryChangeTraceHeader = ChangeTraceHeader;
export type InquiryChangeTrace = TraceRecord<InquiryChangeEvent>;
export type ChangeTraceIssue = ContractIssue | SemanticIdentityIssue | Readonly<{code: "invalid_trace"; path: string; message: string}>;
export type ProfileChangeTraceIssue = ChangeTraceIssue;

type HeaderInput = Omit<ChangeTraceHeaderBody, "protocol" | "traceId">;
type TraceProtocol = typeof PROFILE_CHANGE_TRACE_PROTOCOL;
interface TraceCodec<E extends TraceEvent> {
	readonly protocol: TraceProtocol;
	readonly maximumEvents: number;
	readonly maximumBytes?: number;
	readonly lineLimits?: CanonicalLimits;
	readonly decodeEvent: (input: unknown) => Outcome<E, ContractIssue>;
}
const INQUIRY_CODEC: TraceCodec<InquiryChangeEvent> = Object.freeze({
	protocol: INQUIRY_CHANGE_TRACE_PROTOCOL, maximumEvents: MAX_INQUIRY_TRACE_EVENTS,
	maximumBytes: MAX_INQUIRY_TRACE_BYTES, lineLimits: INQUIRY_EVENT_CANONICAL_LIMITS, decodeEvent: decodeInquiryChangeEvent,
});
const PROFILE_CODEC: TraceCodec<ProfileChangeEvent> = Object.freeze({
	protocol: PROFILE_CHANGE_TRACE_PROTOCOL, maximumEvents: 1, decodeEvent: decodeProfileChangeEvent,
});
function protocolLabel(protocol: TraceProtocol): string {return `${protocol.id}@${protocol.version}`;}
export function profileTraceIdentity(repositoryId: string, changeId: string): Outcome<string, SemanticIdentityIssue> {
	return semanticId("cw:trace", protocolLabel(PROFILE_CHANGE_TRACE_PROTOCOL), {repositoryId, changeId});
}
export function createProfileChangeTraceHeader(body: HeaderInput): Outcome<ProfileChangeTraceHeader, ChangeTraceIssue> {
	return createHeader(body, PROFILE_CHANGE_TRACE_PROTOCOL);
}
export function decodeProfileChangeTraceHeader(input: unknown): Outcome<ProfileChangeTraceHeader, ContractIssue> {
	return decodeHeader(input, PROFILE_CHANGE_TRACE_PROTOCOL);
}
export function createEmptyProfileChangeTrace(header: ProfileChangeTraceHeader): Outcome<ProfileChangeTrace, ChangeTraceIssue> {
	return emptyTrace<ProfileChangeEvent>(header, PROFILE_CHANGE_TRACE_PROTOCOL);
}
export function appendProfileChangeEvent(trace: ProfileChangeTrace, event: ProfileChangeEvent): Outcome<ProfileChangeTrace, ChangeTraceIssue> {
	return appendEvent(trace, event, PROFILE_CODEC);
}
export function validateProfileChangeTrace(trace: unknown, allowEmpty = false): Outcome<ProfileChangeTrace, ChangeTraceIssue> {
	return validateTrace(trace, PROFILE_CODEC, allowEmpty);
}
export function decodeProfileChangeTrace(text: string): Outcome<ProfileChangeTrace, ChangeTraceIssue> {
	return decodeTrace(text, PROFILE_CODEC);
}
export function encodeProfileChangeTrace(trace: ProfileChangeTrace): Outcome<string, ChangeTraceIssue> {
	return encodeTrace(trace, PROFILE_CODEC);
}

export function inquiryTraceIdentity(repositoryId: string, changeId: string): Outcome<string, SemanticIdentityIssue> {
	return semanticId("cw:trace", protocolLabel(INQUIRY_CHANGE_TRACE_PROTOCOL), {repositoryId, changeId});
}
export function createInquiryChangeTraceHeader(body: HeaderInput): Outcome<InquiryChangeTraceHeader, ChangeTraceIssue> {
	return createHeader(body, INQUIRY_CHANGE_TRACE_PROTOCOL);
}
export function decodeInquiryChangeTraceHeader(input: unknown): Outcome<InquiryChangeTraceHeader, ContractIssue> {
	return decodeHeader(input, INQUIRY_CHANGE_TRACE_PROTOCOL);
}
export function createEmptyInquiryChangeTrace(header: InquiryChangeTraceHeader): Outcome<InquiryChangeTrace, ChangeTraceIssue> {
	return emptyTrace<InquiryChangeEvent>(header, INQUIRY_CHANGE_TRACE_PROTOCOL);
}
export function appendInquiryChangeEvent(trace: InquiryChangeTrace, event: InquiryChangeEvent): Outcome<InquiryChangeTrace, ChangeTraceIssue> {
	return appendEvent(trace, event, INQUIRY_CODEC);
}
export function validateInquiryChangeTrace(trace: unknown, allowEmpty = false): Outcome<InquiryChangeTrace, ChangeTraceIssue> {
	return validateTrace(trace, INQUIRY_CODEC, allowEmpty);
}
export function decodeInquiryChangeTrace(text: string): Outcome<InquiryChangeTrace, ChangeTraceIssue> {
	return decodeTrace(text, INQUIRY_CODEC);
}
export function encodeInquiryChangeTrace(trace: InquiryChangeTrace): Outcome<string, ChangeTraceIssue> {
	return encodeTrace(trace, INQUIRY_CODEC);
}

function createHeader(body: HeaderInput, protocol: TraceProtocol): Outcome<ChangeTraceHeader, ChangeTraceIssue> {
	const owned = decodeContract("Change Trace header", body, value => {
		const record = exactRecord("Change Trace header", value, "$", ["changeId", "createdAt", "createdBy", "objectFormat", "repositoryId"]);
		return {
			changeId: textField("Change Trace header", record, "changeId"),
			createdAt: textField("Change Trace header", record, "createdAt"),
			createdBy: textField("Change Trace header", record, "createdBy"),
			objectFormat: literalField("Change Trace header", record, "objectFormat", ["sha1", "sha256"] as const),
			repositoryId: textField("Change Trace header", record, "repositoryId"),
		};
	});
	if (!owned.ok) return owned;
	const identity = semanticId("cw:trace", protocolLabel(protocol), {repositoryId: owned.value.repositoryId, changeId: owned.value.changeId});
	if (!identity.ok) return identity;
	const value = {...owned.value, protocol, traceId: identity.value};
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
function validateTrace<E extends TraceEvent>(input: unknown, codec: TraceCodec<E>, allowEmpty: boolean): Outcome<TraceRecord<E>, ChangeTraceIssue> {
	const limits = codec.protocol.version === INQUIRY_CHANGE_TRACE_PROTOCOL.version
		? INQUIRY_TRACE_CANONICAL_LIMITS
		: {...DEFAULT_CANONICAL_LIMITS, maximumDepth: DEFAULT_CANONICAL_LIMITS.maximumDepth + 2, maximumTextBytes: MAX_TRACE_BYTES};
	const owned = decodeContract("Change Trace", input, (value) => {
		const record = exactRecord("Change Trace", value, "$", ["header", "events", "traceDigest"]);
		return {header: requiredField("Change Trace", record, "header"), events: requiredField("Change Trace", record, "events"), traceDigest: requiredField("Change Trace", record, "traceDigest")};
	}, limits);
	return owned.ok ? validateTraceRecord(owned.value, codec, allowEmpty) : owned;
}
function validateTraceRecord<E extends TraceEvent>(trace: Readonly<{header: unknown; events: unknown; traceDigest: unknown}>, codec: TraceCodec<E>, allowEmpty: boolean): Outcome<TraceRecord<E>, ChangeTraceIssue> {
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
	const maximumBytes = codec.maximumBytes ?? MAX_TRACE_BYTES;
	if (typeof text !== "string" || text.length === 0 || text.length > maximumBytes || new TextEncoder().encode(text).byteLength > maximumBytes) return failure(traceIssue("$", "Change Trace byte length is outside bounds."));
	if (!text.endsWith("\n") || text.includes("\r")) return failure(traceIssue("$", "Change Trace must use LF lines and one terminal LF."));
	const lines = text.slice(0, -1).split("\n");
	if (lines.length < 2 || lines.length > codec.maximumEvents + 1 || lines.some((line) => line.length === 0)) return failure(traceIssue("$", "Change Trace line count or empty-line structure is invalid."));
	const headerLine = parseCanonicalJson(lines[0] ?? "", {requireCanonicalBytes: true, limits: codec.lineLimits});
	if (!headerLine.ok) return failure(traceIssue("$[0]", headerLine.error.message));
	const header = decodeHeader(headerLine.value, codec.protocol);
	if (!header.ok) return header;
	const events: E[] = [];
	for (let index = 1; index < lines.length; index += 1) {
		const line = parseCanonicalJson(lines[index] ?? "", {requireCanonicalBytes: true, limits: codec.lineLimits});
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
		const encoded = canonicalJson(value, codec.lineLimits);
		if (!encoded.ok) return failure(traceIssue(`$[${index}]`, encoded.error.message));
		lines.push(encoded.value);
	}
	const text = `${lines.join("\n")}\n`;
	if (new TextEncoder().encode(text).byteLength > (codec.maximumBytes ?? MAX_TRACE_BYTES)) return failure(traceIssue("$", "Encoded Change Trace exceeds byte limit."));
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
	if (header.protocol.version === INQUIRY_CHANGE_TRACE_PROTOCOL.version) {
		if (!isInquiryEvent(event)) return traceIssue("$.event.protocol", "Inquiry Trace requires Event 3.");
		const previous = prefix.at(-1);
		if (prefix.some((entry) => entry.commandId === event.commandId)) return traceIssue("$.event.commandId", "Inquiry command identity is duplicated.");
		if (previous) {
			if (!isInquiryEvent(previous) || event.kind !== "change.revised" || event.payload.change.revision !== previous.payload.change.revision + 1 || event.payload.change.profile !== previous.payload.change.profile) {
				return traceIssue("$.event.payload.change", "Inquiry revision must preserve profile and increment exactly once; proposals cannot recur.");
			}
		}
	}
	return null;
}
function isInquiryEvent(event: TraceEvent): event is InquiryChangeEvent {
	return event.protocol.id === "codewiki.change-event" && event.protocol.version === "3.0.0";
}
function containsForeignGitOid(value: unknown, objectFormat: GitObjectFormat): boolean {
	if (Array.isArray(value)) return value.some((entry) => containsForeignGitOid(entry, objectFormat));
	if (typeof value !== "object" || value === null) return false;
	const oid = decodeGitOid(value);
	if (oid.ok) return oid.value.algorithm !== objectFormat;
	return Object.values(value).some((entry) => containsForeignGitOid(entry, objectFormat));
}
function materializeTrace<E extends TraceEvent>(header: ChangeTraceHeader, events: readonly E[]): Outcome<TraceRecord<E>, ChangeTraceIssue> {
	if (header.protocol.version === INQUIRY_CHANGE_TRACE_PROTOCOL.version) {
		let bytes = 0;
		for (const value of [header, ...events]) {
			const encoded = canonicalJson(value, INQUIRY_EVENT_CANONICAL_LIMITS);
			if (!encoded.ok) return failure(traceIssue("$", encoded.error.message));
			bytes += new TextEncoder().encode(encoded.value).byteLength + 1;
			if (bytes > MAX_INQUIRY_TRACE_BYTES) return failure(traceIssue("$", "Inquiry Trace exceeds 1 MiB."));
		}
	}
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
