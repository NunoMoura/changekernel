import {
	assertDigestMatch,
	decodeContract,
	exactRecord,
	isNamespacedIdentifier,
	literalField,
	nullableValue,
	protocolField,
	protocolIdentity,
	rejectContract,
	requiredField,
	textField,
	type CanonicalRecord,
	type ContractIssue,
} from "../data-contracts/validation.ts";
import type {CanonicalValue} from "../data-contracts/canonical-json.ts";
import {failure, type Outcome} from "../data-contracts/outcome.ts";
import {decodeGitOidValue, sameGitOid, type GitOid} from "../identity/git.ts";
import {semanticDigest, type SemanticIdentityIssue} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";
import {decodeProfileChangeValue, type ProfileChange} from "./contracts.ts";
import {decodeInquiryChangeValue, INQUIRY_CANONICAL_LIMITS, INQUIRY_LIMITS, type InquiryChange} from "./inquiry.ts";
import {WIKI_PROFILE_ID} from "../wiki/profile.ts";

export const CONTAINING_COMMIT = "containing_commit" as const;

export const PROFILE_CHANGE_EVENT_PROTOCOL = protocolIdentity("codewiki.change-event", "2.0.0");
export const PROFILE_CHANGE_EVENT_KINDS = Object.freeze(["change.proposed"] as const);
export type ProfileChangeEventKind = (typeof PROFILE_CHANGE_EVENT_KINDS)[number];

export interface ProfileChangeOwnerBinding {
	readonly kind: "kernel";
	readonly profile: typeof WIKI_PROFILE_ID;
	readonly kernelBuildDigest: Sha256Digest;
	readonly transactionDigest: Sha256Digest;
}

export interface ProfileChangeProposedPayload {
	readonly change: ProfileChange;
}

export interface ProfileChangeEventBody {
	readonly protocol: typeof PROFILE_CHANGE_EVENT_PROTOCOL;
	readonly kind: ProfileChangeEventKind;
	readonly ownerBinding: ProfileChangeOwnerBinding;
	readonly actorId: string;
	readonly authorityId: string;
	readonly commandId: string;
	readonly commandDigest: Sha256Digest;
	readonly occurredAt: string;
	readonly expectedProjectHead: GitOid;
	readonly expectedChangeTip: GitOid | null;
	readonly containingCommit: typeof CONTAINING_COMMIT;
	readonly predecessorEventDigest: Sha256Digest | null;
	readonly payload: ProfileChangeProposedPayload;
}

export interface ProfileChangeEvent extends ProfileChangeEventBody {
	readonly eventDigest: Sha256Digest;
}

export function createProfileChangeEvent(
	body: Omit<ProfileChangeEventBody, "protocol" | "containingCommit">,
): Outcome<ProfileChangeEvent, ContractIssue | SemanticIdentityIssue> {
	const value = {...body, protocol: PROFILE_CHANGE_EVENT_PROTOCOL, containingCommit: CONTAINING_COMMIT};
	const digest = semanticDigest(profileEventProtocolLabel(), value);
	if (!digest.ok) return failure(digest.error);
	return decodeProfileChangeEvent({...value, eventDigest: digest.value});
}

export function decodeProfileChangeEvent(input: unknown): Outcome<ProfileChangeEvent, ContractIssue> {
	return decodeContract("Profile Change event", input, (value) => decodeProfileChangeEventValue(value));
}

export function decodeProfileChangeEventValue(value: CanonicalValue, path = "$"): ProfileChangeEvent {
	const record = exactRecord("Profile Change event", value, path, [
		"actorId",
		"authorityId",
		"commandDigest",
		"commandId",
		"containingCommit",
		"eventDigest",
		"expectedChangeTip",
		"expectedProjectHead",
		"kind",
		"occurredAt",
		"ownerBinding",
		"payload",
		"predecessorEventDigest",
		"protocol",
	]);
	protocolField("Profile Change event", record, path, PROFILE_CHANGE_EVENT_PROTOCOL);
	const kind = literalField("Profile Change event", record, "kind", PROFILE_CHANGE_EVENT_KINDS, path);
	const ownerBinding = decodeOwnerBinding(requiredField("Profile Change event", record, "ownerBinding", path), `${path}.ownerBinding`);
	const expectedProjectHead = decodeGitOidValue(requiredField("Profile Change event", record, "expectedProjectHead", path), `${path}.expectedProjectHead`);
	const expectedChangeTip = nullableValue(requiredField("Profile Change event", record, "expectedChangeTip", path), (entry) => decodeGitOidValue(entry, `${path}.expectedChangeTip`));
	if (expectedChangeTip !== null) rejectContract("invalid_field", "Profile Change event", `${path}.expectedChangeTip`, "Profile proposal event cannot attach an existing Change tip.");
	const predecessorEventDigest = nullableProfileDigest(record, "predecessorEventDigest", path);
	if (predecessorEventDigest !== null) rejectContract("invalid_field", "Profile Change event", `${path}.predecessorEventDigest`, "Profile proposal event must begin a new Trace.");
	const payload = decodeProfileProposed(requiredField("Profile Change event", record, "payload", path), `${path}.payload`);
	const reference = payload.change.reference;
	if (ownerBinding.profile !== reference.profile || ownerBinding.kernelBuildDigest !== reference.kernelBuildDigest || ownerBinding.transactionDigest !== reference.transactionDigest) {
		rejectContract("invalid_field", "Profile Change event", `${path}.ownerBinding`, "Owner binding does not match profile reference grounds.");
	}
	if (reference.before.commit.algorithm !== expectedProjectHead.algorithm || reference.before.commit.hex !== expectedProjectHead.hex) {
		rejectContract("invalid_field", "Profile Change event", `${path}.payload.change.reference.before`, "Proposed Change comparison state differs from expected Project head.");
	}
	const marker = textField("Profile Change event", record, "containingCommit", path, {maximumBytes: 32});
	if (marker !== CONTAINING_COMMIT) rejectContract("invalid_field", "Profile Change event", `${path}.containingCommit`, `Expected ${CONTAINING_COMMIT}.`);
	const eventDigest = profileDigestField(record, "eventDigest", path);
	const result = Object.freeze({
		protocol: PROFILE_CHANGE_EVENT_PROTOCOL,
		kind,
		ownerBinding,
		actorId: profileNamespacedField(record, "actorId", path),
		authorityId: profileNamespacedField(record, "authorityId", path),
		commandId: profileNamespacedField(record, "commandId", path),
		commandDigest: profileDigestField(record, "commandDigest", path),
		occurredAt: textField("Profile Change event", record, "occurredAt", path, {
			maximumBytes: 35,
			pattern: /^\d{4}-\d{2}-\d{2}(?:T)\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u,
		}),
		expectedProjectHead,
		expectedChangeTip: null,
		containingCommit: CONTAINING_COMMIT,
		predecessorEventDigest: null,
		payload,
		eventDigest,
	});
	const {eventDigest: _eventDigest, ...body} = result;
	const expected = semanticDigest(profileEventProtocolLabel(), body);
	if (!expected.ok) rejectContract("invalid_field", "Profile Change event", `${path}.eventDigest`, expected.error.message);
	assertDigestMatch("Profile Change event", `${path}.eventDigest`, eventDigest, expected.value);
	return result;
}

function decodeOwnerBinding(value: CanonicalValue, path: string): ProfileChangeOwnerBinding {
	const record = exactRecord("Profile Change event", value, path, ["kernelBuildDigest", "kind", "profile", "transactionDigest"]);
	return Object.freeze({
		kind: literalField("Profile Change event", record, "kind", ["kernel"] as const, path),
		profile: literalField("Profile Change event", record, "profile", [WIKI_PROFILE_ID] as const, path),
		kernelBuildDigest: profileDigestField(record, "kernelBuildDigest", path),
		transactionDigest: profileDigestField(record, "transactionDigest", path),
	});
}

function decodeProfileProposed(value: CanonicalValue, path: string): ProfileChangeProposedPayload {
	const record = exactRecord("Profile Change event", value, path, ["change"]);
	return Object.freeze({change: decodeProfileChangeValue(requiredField("Profile Change event", record, "change", path), `${path}.change`)});
}

function profileNamespacedField(record: CanonicalRecord, field: string, path: string): string {
	const value = textField("Profile Change event", record, field, path, {maximumBytes: 256});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", "Profile Change event", `${path}.${field}`, "Identity must be canonical namespaced text.");
	return value;
}

function profileDigestField(record: CanonicalRecord, field: string, path: string): Sha256Digest {
	const decoded = decodeSha256Digest(record[field]);
	if (!decoded.ok) rejectContract("invalid_field", "Profile Change event", `${path}.${field}`, decoded.error.message);
	return decoded.value;
}

function nullableProfileDigest(record: CanonicalRecord, field: string, path: string): Sha256Digest | null {
	const value = requiredField("Profile Change event", record, field, path);
	if (value === null) return null;
	return profileDigestField(record, field, path);
}

function profileEventProtocolLabel(): string {
	return `${PROFILE_CHANGE_EVENT_PROTOCOL.id}@${PROFILE_CHANGE_EVENT_PROTOCOL.version}`;
}

export const INQUIRY_CHANGE_EVENT_PROTOCOL = protocolIdentity("codewiki.change-event", "3.0.0");
export const INQUIRY_CHANGE_EVENT_KINDS = Object.freeze(["change.proposed", "change.revised"] as const);
export const INQUIRY_EVENT_CANONICAL_LIMITS = Object.freeze({
	...INQUIRY_CANONICAL_LIMITS,
	// A full Change plus a maximally JSON-escaped revision reason and bounded framing.
	maximumTextBytes: INQUIRY_LIMITS.changeBytes + 6 * INQUIRY_LIMITS.proseBytes + 8 * 1024,
});
export interface InquiryChangeOwnerBinding {
	readonly kind: "kernel";
	readonly profile: typeof WIKI_PROFILE_ID;
	readonly kernelBuildDigest: Sha256Digest;
}
export interface InquiryChangeProposedPayload {readonly change: InquiryChange;}
export interface InquiryChangeRevisedPayload extends InquiryChangeProposedPayload {readonly reason: string;}
export interface InquiryChangeEventBody {
	readonly protocol: typeof INQUIRY_CHANGE_EVENT_PROTOCOL;
	readonly kind: (typeof INQUIRY_CHANGE_EVENT_KINDS)[number];
	readonly ownerBinding: InquiryChangeOwnerBinding;
	readonly actorId: string;
	readonly authorityId: string;
	readonly commandId: string;
	readonly commandDigest: Sha256Digest;
	readonly occurredAt: string;
	readonly expectedProjectHead: GitOid;
	readonly expectedChangeTip: GitOid | null;
	readonly containingCommit: typeof CONTAINING_COMMIT;
	readonly predecessorEventDigest: Sha256Digest | null;
	readonly payload: InquiryChangeProposedPayload | InquiryChangeRevisedPayload;
}
export interface InquiryChangeEvent extends InquiryChangeEventBody {readonly eventDigest: Sha256Digest;}
const INQUIRY_EVENT_FIELDS = [
	"actorId", "authorityId", "commandDigest", "commandId", "expectedChangeTip", "expectedProjectHead",
	"kind", "occurredAt", "ownerBinding", "payload", "predecessorEventDigest",
];
const INQUIRY_EVENT_DOMAIN = `${INQUIRY_CHANGE_EVENT_PROTOCOL.id}@${INQUIRY_CHANGE_EVENT_PROTOCOL.version}`;

export function createInquiryChangeEvent(body: Omit<InquiryChangeEventBody, "protocol" | "containingCommit">): Outcome<InquiryChangeEvent, ContractIssue> {
	return decodeContract("Inquiry Change event", body, (value) => {
		const record = exactRecord("Inquiry Change event", value, "$", INQUIRY_EVENT_FIELDS);
		const content = {...record, protocol: {...INQUIRY_CHANGE_EVENT_PROTOCOL}, containingCommit: CONTAINING_COMMIT};
		const digest = semanticDigest(INQUIRY_EVENT_DOMAIN, content);
		if (!digest.ok) rejectContract("invalid_field", "Inquiry Change event", "$", digest.error.message);
		return decodeInquiryChangeEventValue({...content, eventDigest: digest.value});
	}, INQUIRY_EVENT_CANONICAL_LIMITS);
}
export function decodeInquiryChangeEvent(input: unknown): Outcome<InquiryChangeEvent, ContractIssue> {
	return decodeContract("Inquiry Change event", input, decodeInquiryChangeEventValue, INQUIRY_EVENT_CANONICAL_LIMITS);
}
export function decodeInquiryChangeEventValue(value: CanonicalValue, path = "$"): InquiryChangeEvent {
	const contract = "Inquiry Change event";
	const record = exactRecord(contract, value, path, [...INQUIRY_EVENT_FIELDS, "protocol", "containingCommit", "eventDigest"]);
	protocolField(contract, record, path, INQUIRY_CHANGE_EVENT_PROTOCOL);
	const kind = literalField(contract, record, "kind", INQUIRY_CHANGE_EVENT_KINDS, path);
	const owner = exactRecord(contract, requiredField(contract, record, "ownerBinding", path), `${path}.ownerBinding`, ["kind", "profile", "kernelBuildDigest"]);
	const ownerBinding = Object.freeze({
		kind: literalField(contract, owner, "kind", ["kernel"] as const, `${path}.ownerBinding`),
		profile: literalField(contract, owner, "profile", [WIKI_PROFILE_ID] as const, `${path}.ownerBinding`),
		kernelBuildDigest: profileDigestField(owner, "kernelBuildDigest", `${path}.ownerBinding`),
	});
	const rawPayload = exactRecord(contract, requiredField(contract, record, "payload", path), `${path}.payload`, kind === "change.proposed" ? ["change"] : ["change", "reason"]);
	const change = decodeInquiryChangeValue(requiredField(contract, rawPayload, "change", `${path}.payload`), `${path}.payload.change`);
	let payload: InquiryChangeProposedPayload | InquiryChangeRevisedPayload = Object.freeze({change});
	if (kind === "change.revised") {
		const reason = textField(contract, rawPayload, "reason", `${path}.payload`, {maximumBytes: INQUIRY_LIMITS.proseBytes});
		if (reason.trim().length === 0 || /[\uD800-\uDFFF]/u.test(reason)) rejectContract("invalid_field", contract, `${path}.payload.reason`, "Revision reason must be nonblank Unicode text.");
		payload = Object.freeze({change, reason});
	}
	const expectedProjectHead = decodeGitOidValue(requiredField(contract, record, "expectedProjectHead", path), `${path}.expectedProjectHead`);
	const expectedChangeTip = nullableValue(requiredField(contract, record, "expectedChangeTip", path), (entry) => decodeGitOidValue(entry, `${path}.expectedChangeTip`));
	const predecessorEventDigest = nullableProfileDigest(record, "predecessorEventDigest", path);
	if (!sameGitOid(expectedProjectHead, change.baseline.commit) || (expectedChangeTip !== null && expectedChangeTip.algorithm !== expectedProjectHead.algorithm)) {
		rejectContract("invalid_field", contract, path, "Event grounds must match the recorded Current Project state and object format.");
	}
	if (kind === "change.proposed" ? (change.revision !== 1 || expectedChangeTip !== null || predecessorEventDigest !== null) : (change.revision < 2 || expectedChangeTip === null || predecessorEventDigest === null)) {
		rejectContract("invalid_field", contract, path, "Proposal requires revision 1 and null tips; revision requires non-null exact tip and predecessor.");
	}
	const attachment = change.wikiConsequences;
	if (attachment.kind === "profile" && attachment.reference.kernelBuildDigest !== ownerBinding.kernelBuildDigest) rejectContract("invalid_field", contract, `${path}.ownerBinding`, "Kernel owner build differs from attached profile reference.");
	const containingCommit = literalField(contract, record, "containingCommit", [CONTAINING_COMMIT] as const, path);
	const eventDigest = profileDigestField(record, "eventDigest", path);
	const result = Object.freeze({
		protocol: INQUIRY_CHANGE_EVENT_PROTOCOL, kind, ownerBinding,
		actorId: profileNamespacedField(record, "actorId", path), authorityId: profileNamespacedField(record, "authorityId", path),
		commandId: profileNamespacedField(record, "commandId", path), commandDigest: profileDigestField(record, "commandDigest", path),
		occurredAt: textField(contract, record, "occurredAt", path, {maximumBytes: 35, pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u}),
		expectedProjectHead, expectedChangeTip, containingCommit, predecessorEventDigest, payload, eventDigest,
	});
	const {eventDigest: _digest, ...body} = result;
	const expected = semanticDigest(INQUIRY_EVENT_DOMAIN, body);
	if (!expected.ok) rejectContract("invalid_field", contract, path, expected.error.message);
	assertDigestMatch(contract, `${path}.eventDigest`, eventDigest, expected.value);
	return result;
}
