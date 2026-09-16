import {failure, success, type Outcome} from "../data-contracts/outcome.ts";
import {semanticDigest} from "../identity/semantic-digest.ts";
import type {Sha256Digest} from "../identity/sha256.ts";
import type {ProfileChange} from "./contracts.ts";
import type {InquiryChange} from "./inquiry.ts";
import {
	validateProfileChangeTrace, validateInquiryChangeTrace, PROFILE_CHANGE_TRACE_PROTOCOL, INQUIRY_CHANGE_TRACE_PROTOCOL,
	type ProfileChangeTrace, type InquiryChangeTrace,
} from "./trace.ts";

type RecordedChange = ProfileChange | InquiryChange;
type RecordedTrace = ProfileChangeTrace | InquiryChangeTrace;

/** Only proposed state is implemented. No empty placeholders for future lifecycle facts. */
export interface ReducedChange<C extends RecordedChange = ProfileChange> {
	readonly traceId: string;
	readonly change: C;
	readonly state: "proposed";
	readonly latestEventDigest: Sha256Digest;
	readonly traceDigest: Sha256Digest;
	readonly stateDigest: Sha256Digest;
}

export type ReducedProfileChange = ReducedChange<ProfileChange>;
export type ReducedInquiryChange = ReducedChange<InquiryChange>;

export interface ChangeReductionIssue {
	readonly code: "invalid_transition" | "reduction_failed";
	readonly eventIndex: number;
	readonly message: string;
}

export function reduceChangeTrace(trace: ProfileChangeTrace): Outcome<ReducedProfileChange, ChangeReductionIssue>;
export function reduceChangeTrace(trace: InquiryChangeTrace): Outcome<ReducedInquiryChange, ChangeReductionIssue>;
export function reduceChangeTrace(trace: RecordedTrace): Outcome<ReducedChange<RecordedChange>, ChangeReductionIssue> {
	const version = traceVersion(trace);
	if (version !== PROFILE_CHANGE_TRACE_PROTOCOL.version && version !== INQUIRY_CHANGE_TRACE_PROTOCOL.version) return failure(issue("Unsupported Trace protocol."));
	const admitted = version === PROFILE_CHANGE_TRACE_PROTOCOL.version
		? validateProfileChangeTrace(trace)
		: validateInquiryChangeTrace(trace);
	if (!admitted.ok) return failure(issue(admitted.error.message));
	const current = admitted.value;
	const latest = current.events.at(-1);
	if (!latest) return failure(issue("Change Trace has no proposal event."));
	const body = Object.freeze({
		traceId: current.header.traceId,
		change: latest.payload.change,
		state: "proposed" as const,
		latestEventDigest: latest.eventDigest,
		traceDigest: current.traceDigest,
	});
	const domain = version === INQUIRY_CHANGE_TRACE_PROTOCOL.version ? "codewiki.reduced-change@3.0.0" : "codewiki.reduced-change@2.0.0";
	const digest = semanticDigest(domain, body);
	if (!digest.ok) return failure(issue(digest.error.message, "reduction_failed", current.events.length));
	return success(Object.freeze({...body, stateDigest: digest.value}));
}

// Read explicit own protocol data before selecting a decoder. Never invoke accessors.
function traceVersion(trace: unknown): string | null {
	const own = (value: unknown, field: string): PropertyDescriptor | undefined => {
		if (typeof value !== "object" || value === null) return undefined;
		const descriptor = Object.getOwnPropertyDescriptor(value, field);
		return descriptor && "value" in descriptor ? descriptor : undefined;
	};
	try {
		const protocol: unknown = own(own(trace, "header")?.value, "protocol")?.value;
		const version: unknown = own(protocol, "version")?.value;
		return own(protocol, "id")?.value === PROFILE_CHANGE_TRACE_PROTOCOL.id && typeof version === "string" ? version : null;
	} catch {
		return null;
	}
}

function issue(message: string, code: ChangeReductionIssue["code"] = "invalid_transition", eventIndex = 0): ChangeReductionIssue {
	return Object.freeze({code, eventIndex, message});
}
