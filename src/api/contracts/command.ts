import {
	arrayField,
	decodeContract,
	exactRecord,
	integerField,
	isNamespacedIdentifier,
	literalField,
	nullableValue,
	rejectContract,
	requiredField,
	sortedUniqueTextArray,
	textField,
	type CanonicalRecord,
	type ContractIssue,
} from "../../kernel/data-contracts/validation.ts";
import type {CanonicalValue} from "../../kernel/data-contracts/canonical-json.ts";
import type {Outcome} from "../../kernel/data-contracts/outcome.ts";
import {
	CHANGE_REALIZATIONS,
	CHANGE_RELATIONS,
	CHANGE_TYPES,
	type ChangeRealization,
	type ChangeRelationKind,
	type ChangeType,
} from "../../kernel/changes/contracts.ts";
import {decodeGitOidValue, type GitOid} from "../../kernel/identity/git.ts";
import {decodeSha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {decodeProfiledPathUtf8Hex} from "../../kernel/wiki/profile-reference.ts";
import {PROFILED_WIKI_MAPPING_KINDS, type ProfiledWikiMappingKind} from "../../kernel/wiki/profile-transaction.ts";
import {WIKI_PROFILE_ID} from "../../kernel/wiki/profile.ts";

export const PRODUCT_COMMAND_OPERATIONS = Object.freeze([
	"changes.complete",
	"changes.propose",
	"changes.propose-profile",
	"changes.revise",
	"changes.supersede",
	"decision.commit",
	"decision.defer",
	"decision.evaluate",
	"decision.reject",
	"decision.resume",
	"decision.withdraw",
	"effects.request",
	"planning.admit",
	"planning.evaluate",
	"review.evaluate",
	"review.reconcile",
	"work.admit",
	"work.evaluate",
	"work.integrate",
] as const);

export type ProductCommandOperation = (typeof PRODUCT_COMMAND_OPERATIONS)[number];

export interface CommandBindingInput {
	readonly commandId: string;
	readonly expectedProjectHead: GitOid;
	readonly expectedChangeTip: GitOid;
}

export interface ProposalTargetInput {
	readonly itemId: string;
	readonly facets: readonly string[];
}

export interface ProposalRelationshipInput {
	readonly type: ChangeRelationKind;
	readonly target: Readonly<{kind: "change"; changeId: string}> | Readonly<{kind: "proposal"; proposalKey: string}>;
	readonly rationale: string;
}

export interface WikiPatchInput {
	readonly upserts: readonly Readonly<{path: string; content: string}>[];
	readonly deletes: readonly string[];
}

export interface ProposalInput {
	readonly proposalKey: string;
	readonly changeType: ChangeType;
	readonly realization: ChangeRealization;
	readonly intent: string;
	readonly rationale: string;
	readonly acceptance: readonly string[];
	readonly targets: readonly ProposalTargetInput[];
	readonly relationships: readonly ProposalRelationshipInput[];
	readonly contributorRefs: readonly string[];
	readonly producerRunRefs: readonly string[];
	readonly wiki: WikiPatchInput;
}

export interface ProposeChangesInput {
	readonly commandId: string;
	readonly expectedProjectHead: GitOid;
	readonly proposals: readonly ProposalInput[];
}

export interface ProfileProposalEndpointInput {
	readonly pathUtf8Hex: string;
	readonly blob: GitOid;
}

export interface ProfileProposalMappingInput {
	readonly kind: ProfiledWikiMappingKind;
	readonly before: readonly ProfileProposalEndpointInput[];
	readonly after: readonly ProfileProposalEndpointInput[];
}

export interface ProfileProposalInput {
	readonly changeType: ChangeType;
	readonly realization: ChangeRealization;
	readonly intent: string;
	readonly rationale: string;
	readonly acceptance: readonly string[];
	readonly relationships: readonly Readonly<{kind: ChangeRelationKind; changeId: string}>[];
	readonly contributorRefs: readonly string[];
	readonly producerRunRefs: readonly string[];
}

export interface ProposeProfileChangeInput {
	readonly commandId: string;
	readonly changeId: string;
	readonly expectedProjectHead: GitOid;
	readonly profile: typeof WIKI_PROFILE_ID;
	readonly kernelBuildDigest: Sha256Digest;
	readonly afterCommit: GitOid;
	readonly proposal: ProfileProposalInput;
	readonly mappings: readonly ProfileProposalMappingInput[];
}

export interface ReviseChangeInput extends CommandBindingInput {
	readonly changeId: string;
	readonly proposal: Omit<ProposalInput, "proposalKey">;
}

export interface ChangeCommandInput extends CommandBindingInput {
	readonly changeId: string;
}

export interface ReasonedChangeCommandInput extends ChangeCommandInput {
	readonly reason: string;
}

export interface PlanWorkInput {
	readonly ordinal: number;
	readonly workType: string;
	readonly targets: readonly ProposalTargetInput[];
	readonly writablePaths: readonly string[];
	readonly dependencyOrdinals: readonly number[];
	readonly capabilities: readonly string[];
	readonly acceptance: readonly string[];
}

export interface PlanningCommandInput extends ChangeCommandInput {
	readonly work: readonly PlanWorkInput[];
}

export interface WorkCandidateInput extends ChangeCommandInput {
	readonly workId: string;
	readonly resultCommit: GitOid;
}

export interface WorkCommandInput extends ChangeCommandInput {
	readonly workId: string;
}

export interface SupersedeChangeInput extends ChangeCommandInput {
	readonly supersedingChangeId: string;
}

export interface ProtectedEffectInput extends ChangeCommandInput {
	readonly capability: string;
	readonly expectedEffectHead: GitOid | null;
}

export type ProductCommandInput =
	| ProposeChangesInput
	| ProposeProfileChangeInput
	| ReviseChangeInput
	| ChangeCommandInput
	| ReasonedChangeCommandInput
	| PlanningCommandInput
	| WorkCandidateInput
	| WorkCommandInput
	| SupersedeChangeInput
	| ProtectedEffectInput;

const CONTRACT = "codewiki.product-command-input@1.0.0";
const CHANGE_ID = /^CHG-[A-Za-z0-9][A-Za-z0-9._-]{0,195}$/u;
const PROPOSAL_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const WORK_ID = /^cw:work:[A-Za-z0-9][A-Za-z0-9._:-]{0,220}$/u;

export function decodeProductCommandInput(
	operation: ProductCommandOperation,
	input: unknown,
): Outcome<ProductCommandInput, ContractIssue> {
	return decodeContract(CONTRACT, input, (value) => {
		switch (operation) {
			case "changes.propose":
				return decodePropose(value);
			case "changes.propose-profile":
				return decodeProposeProfile(value);
			case "changes.revise":
				return decodeRevise(value);
			case "decision.defer":
			case "decision.reject":
			case "decision.resume":
			case "decision.withdraw":
				return decodeReasonedChange(value);
			case "planning.evaluate":
			case "planning.admit":
				return decodePlanning(value);
			case "work.admit":
				return decodeWorkCandidate(value);
			case "work.evaluate":
			case "work.integrate":
				return decodeWorkCommand(value);
			case "changes.supersede":
				return decodeSupersede(value);
			case "effects.request":
				return decodeEffect(value);
			case "changes.complete":
			case "decision.commit":
			case "decision.evaluate":
			case "review.evaluate":
			case "review.reconcile":
				return decodeChangeCommand(value);
			default:
				rejectContract("invalid_field", CONTRACT, "$.operation", "Product command operation is unsupported.");
		}
	});
}

function decodePropose(value: CanonicalValue): ProposeChangesInput {
	const record = exactRecord(CONTRACT, value, "$", ["commandId", "expectedProjectHead", "proposals"]);
	const proposals = arrayField(CONTRACT, record, "proposals", "$", 32).map((entry, index) =>
		decodeProposal(entry, `$.proposals[${index}]`, true) as ProposalInput);
	if (proposals.length === 0) rejectContract("missing_field", CONTRACT, "$.proposals", "At least one proposal is required.");
	assertOrderedUnique(proposals.map((entry) => entry.proposalKey), "$.proposals");
	return Object.freeze({
		commandId: commandIdField(record),
		expectedProjectHead: oidField(record, "expectedProjectHead"),
		proposals: Object.freeze(proposals),
	});
}

function decodeProposeProfile(value: CanonicalValue): ProposeProfileChangeInput {
	const record = exactRecord(CONTRACT, value, "$", ["afterCommit", "changeId", "commandId", "expectedProjectHead", "kernelBuildDigest", "mappings", "profile", "proposal"]);
	const expectedProjectHead = oidField(record, "expectedProjectHead");
	const afterCommit = oidField(record, "afterCommit");
	if (expectedProjectHead.algorithm !== afterCommit.algorithm) rejectContract("invalid_field", CONTRACT, "$.afterCommit", "Profile source commits must use expected Project object format.");
	return Object.freeze({
		commandId: commandIdField(record),
		changeId: changeIdField(record, "changeId"),
		expectedProjectHead,
		profile: literalField(CONTRACT, record, "profile", [WIKI_PROFILE_ID] as const, "$"),
		kernelBuildDigest: sha256Field(record, "kernelBuildDigest"),
		afterCommit,
		proposal: decodeProfileProposal(requiredField(CONTRACT, record, "proposal"), "$.proposal"),
		mappings: decodeProfileMappings(requiredField(CONTRACT, record, "mappings"), "$.mappings"),
	});
}

function decodeProfileProposal(value: CanonicalValue, path: string): ProfileProposalInput {
	const record = exactRecord(CONTRACT, value, path, ["acceptance", "changeType", "contributorRefs", "intent", "producerRunRefs", "rationale", "realization", "relationships"]);
	const relationships = arrayField(CONTRACT, record, "relationships", path, 1_024).map((entry, index) => {
		const relationshipPath = `${path}.relationships[${index}]`;
		const relationship = exactRecord(CONTRACT, entry, relationshipPath, ["changeId", "kind"]);
		return Object.freeze({
			kind: literalField(CONTRACT, relationship, "kind", CHANGE_RELATIONS, relationshipPath),
			changeId: changeIdField(relationship, "changeId", relationshipPath),
		});
	});
	assertOrderedUnique(relationships.map((entry) => `${entry.kind}\0${entry.changeId}`), `${path}.relationships`);
	return Object.freeze({
		changeType: literalField(CONTRACT, record, "changeType", CHANGE_TYPES, path),
		realization: literalField(CONTRACT, record, "realization", CHANGE_REALIZATIONS, path),
		intent: textField(CONTRACT, record, "intent", path, {minimumBytes: 1, maximumBytes: 16_384}),
		rationale: textField(CONTRACT, record, "rationale", path, {minimumBytes: 1, maximumBytes: 16_384}),
		acceptance: boundedTextSet(record, "acceptance", path, 256, 4_096),
		relationships: Object.freeze(relationships),
		contributorRefs: namespacedSet(record, "contributorRefs", path, 1_024),
		producerRunRefs: namespacedSet(record, "producerRunRefs", path, 1_024),
	});
}

function decodeProfileMappings(value: CanonicalValue, path: string): readonly ProfileProposalMappingInput[] {
	const input = arrayField(CONTRACT, {mappings: value}, "mappings", "$", 1_024);
	const mappings: ProfileProposalMappingInput[] = [];
	let beforeBudget = 512;
	let afterBudget = 512;
	for (let index = 0; index < input.length; index += 1) {
		const entry = input[index] as CanonicalValue;
		const mappingPath = `${path}[${index}]`;
		const record = exactRecord(CONTRACT, entry, mappingPath, ["after", "before", "kind"]);
		const before = decodeProfileEndpoints(requiredField(CONTRACT, record, "before", mappingPath), `${mappingPath}.before`, beforeBudget);
		const after = decodeProfileEndpoints(requiredField(CONTRACT, record, "after", mappingPath), `${mappingPath}.after`, afterBudget);
		beforeBudget -= before.length;
		afterBudget -= after.length;
		mappings.push(Object.freeze({
			kind: literalField(CONTRACT, record, "kind", PROFILED_WIKI_MAPPING_KINDS, mappingPath),
			before,
			after,
		}));
	}
	assertOrderedUnique(mappings.map((entry) => `${entry.kind}\0${entry.before.map((endpoint) => `${endpoint.pathUtf8Hex}:${endpoint.blob.algorithm}:${endpoint.blob.hex}`).join("\0")}\0${entry.after.map((endpoint) => `${endpoint.pathUtf8Hex}:${endpoint.blob.algorithm}:${endpoint.blob.hex}`).join("\0")}`), path);
	return Object.freeze(mappings);
}

function decodeProfileEndpoints(value: CanonicalValue, path: string, maximum: number): readonly ProfileProposalEndpointInput[] {
	const endpoints = arrayField(CONTRACT, {endpoints: value}, "endpoints", "$", Math.min(512, maximum)).map((entry, index) => {
		const endpointPath = `${path}[${index}]`;
		const record = exactRecord(CONTRACT, entry, endpointPath, ["blob", "pathUtf8Hex"]);
		const pathUtf8Hex = textField(CONTRACT, record, "pathUtf8Hex", endpointPath, {maximumBytes: 8_192});
		const decoded = decodeProfiledPathUtf8Hex(pathUtf8Hex);
		if (!decoded.ok) rejectContract("invalid_field", CONTRACT, `${endpointPath}.pathUtf8Hex`, decoded.error.message);
		return Object.freeze({pathUtf8Hex, blob: oidField(record, "blob")});
	});
	assertOrderedUnique(endpoints.map((entry) => `${entry.pathUtf8Hex}\0${entry.blob.algorithm}:${entry.blob.hex}`), path);
	return Object.freeze(endpoints);
}

function sha256Field(record: CanonicalRecord, field: string): Sha256Digest {
	const decoded = decodeSha256Digest(requiredField(CONTRACT, record, field));
	if (!decoded.ok) rejectContract("invalid_field", CONTRACT, `$.${field}`, decoded.error.message);
	return decoded.value;
}

function decodeRevise(value: CanonicalValue): ReviseChangeInput {
	const record = exactRecord(CONTRACT, value, "$", ["changeId", "commandId", "expectedChangeTip", "expectedProjectHead", "proposal"]);
	return Object.freeze({
		...decodeBinding(record),
		changeId: changeIdField(record, "changeId"),
		proposal: decodeProposal(requiredField(CONTRACT, record, "proposal"), "$.proposal", false) as Omit<ProposalInput, "proposalKey">,
	});
}

function decodeChangeCommand(value: CanonicalValue): ChangeCommandInput {
	const record = exactRecord(CONTRACT, value, "$", ["changeId", "commandId", "expectedChangeTip", "expectedProjectHead"]);
	return Object.freeze({...decodeBinding(record), changeId: changeIdField(record, "changeId")});
}

function decodeReasonedChange(value: CanonicalValue): ReasonedChangeCommandInput {
	const record = exactRecord(CONTRACT, value, "$", ["changeId", "commandId", "expectedChangeTip", "expectedProjectHead", "reason"]);
	return Object.freeze({
		...decodeBinding(record),
		changeId: changeIdField(record, "changeId"),
		reason: textField(CONTRACT, record, "reason", "$", {minimumBytes: 1, maximumBytes: 4_096}),
	});
}

function decodePlanning(value: CanonicalValue): PlanningCommandInput {
	const record = exactRecord(CONTRACT, value, "$", ["changeId", "commandId", "expectedChangeTip", "expectedProjectHead", "work"]);
	const work = arrayField(CONTRACT, record, "work", "$", 1_024).map((entry, index) => decodePlanWork(entry, `$.work[${index}]`));
	if (work.length === 0) rejectContract("missing_field", CONTRACT, "$.work", "Project realization requires at least one Work Unit.");
	assertOrderedUnique(work.map((entry) => entry.ordinal), "$.work");
	return Object.freeze({...decodeBinding(record), changeId: changeIdField(record, "changeId"), work: Object.freeze(work)});
}

function decodeWorkCandidate(value: CanonicalValue): WorkCandidateInput {
	const record = exactRecord(CONTRACT, value, "$", ["changeId", "commandId", "expectedChangeTip", "expectedProjectHead", "resultCommit", "workId"]);
	return Object.freeze({
		...decodeBinding(record),
		changeId: changeIdField(record, "changeId"),
		workId: workIdField(record),
		resultCommit: oidField(record, "resultCommit"),
	});
}

function decodeWorkCommand(value: CanonicalValue): WorkCommandInput {
	const record = exactRecord(CONTRACT, value, "$", ["changeId", "commandId", "expectedChangeTip", "expectedProjectHead", "workId"]);
	return Object.freeze({...decodeBinding(record), changeId: changeIdField(record, "changeId"), workId: workIdField(record)});
}

function decodeSupersede(value: CanonicalValue): SupersedeChangeInput {
	const record = exactRecord(CONTRACT, value, "$", ["changeId", "commandId", "expectedChangeTip", "expectedProjectHead", "supersedingChangeId"]);
	return Object.freeze({
		...decodeBinding(record),
		changeId: changeIdField(record, "changeId"),
		supersedingChangeId: changeIdField(record, "supersedingChangeId"),
	});
}

function decodeEffect(value: CanonicalValue): ProtectedEffectInput {
	const record = exactRecord(CONTRACT, value, "$", ["capability", "changeId", "commandId", "expectedChangeTip", "expectedEffectHead", "expectedProjectHead"]);
	return Object.freeze({
		...decodeBinding(record),
		changeId: changeIdField(record, "changeId"),
		capability: namespacedField(record, "capability", "$"),
		expectedEffectHead: nullableValue(requiredField(CONTRACT, record, "expectedEffectHead"), (entry) => decodeGitOidValue(entry, "$.expectedEffectHead")),
	});
}

function decodeProposal(value: CanonicalValue, path: string, keyed: boolean): ProposalInput | Omit<ProposalInput, "proposalKey"> {
	const required = ["acceptance", "changeType", "contributorRefs", "intent", "producerRunRefs", "rationale", "realization", "relationships", "targets", "wiki"];
	if (keyed) required.push("proposalKey");
	const record = exactRecord(CONTRACT, value, path, required);
	const proposalKey = keyed ? textField(CONTRACT, record, "proposalKey", path, {maximumBytes: 64, pattern: PROPOSAL_KEY}) : null;
	const body = {
		changeType: literalField(CONTRACT, record, "changeType", CHANGE_TYPES, path),
		realization: literalField(CONTRACT, record, "realization", CHANGE_REALIZATIONS, path),
		intent: textField(CONTRACT, record, "intent", path, {minimumBytes: 1, maximumBytes: 16_384}),
		rationale: textField(CONTRACT, record, "rationale", path, {minimumBytes: 1, maximumBytes: 16_384}),
		acceptance: boundedTextSet(record, "acceptance", path, 256, 4_096),
		targets: decodeTargets(requiredField(CONTRACT, record, "targets", path), `${path}.targets`),
		relationships: decodeRelationships(requiredField(CONTRACT, record, "relationships", path), `${path}.relationships`),
		contributorRefs: namespacedSet(record, "contributorRefs", path, 1_024),
		producerRunRefs: namespacedSet(record, "producerRunRefs", path, 1_024),
		wiki: decodeWikiPatch(requiredField(CONTRACT, record, "wiki", path), `${path}.wiki`),
	};
	return proposalKey === null ? Object.freeze(body) : Object.freeze({proposalKey, ...body});
}

function decodeTargets(value: CanonicalValue, path: string): readonly ProposalTargetInput[] {
	if (!Array.isArray(value) || value.length > 1_024) rejectContract("limit_exceeded", CONTRACT, path, "Proposal targets exceed their bound.");
	const targets = value.map((entry, index) => {
		const itemPath = `${path}[${index}]`;
		const record = exactRecord(CONTRACT, entry, itemPath, ["facets", "itemId"]);
		return Object.freeze({
			itemId: namespacedField(record, "itemId", itemPath),
			facets: boundedTextSet(record, "facets", itemPath, 128, 256),
		});
	});
	assertOrderedUnique(targets.map((entry) => `${entry.itemId}\0${entry.facets.join("\0")}`), path);
	return Object.freeze(targets);
}

function decodeRelationships(value: CanonicalValue, path: string): readonly ProposalRelationshipInput[] {
	if (!Array.isArray(value) || value.length > 1_024) rejectContract("limit_exceeded", CONTRACT, path, "Proposal relationships exceed their bound.");
	const relationships = value.map((entry, index) => {
		const itemPath = `${path}[${index}]`;
		const record = exactRecord(CONTRACT, entry, itemPath, ["rationale", "target", "type"]);
		const targetValue = requiredField(CONTRACT, record, "target", itemPath);
		const targetRecord = exactRecord(CONTRACT, targetValue, `${itemPath}.target`, ["kind"], ["changeId", "proposalKey"]);
		const kind = literalField(CONTRACT, targetRecord, "kind", ["change", "proposal"] as const, `${itemPath}.target`);
		const target = kind === "change"
			? Object.freeze({kind, changeId: changeIdField(targetRecord, "changeId", `${itemPath}.target`)})
			: Object.freeze({kind, proposalKey: textField(CONTRACT, targetRecord, "proposalKey", `${itemPath}.target`, {maximumBytes: 64, pattern: PROPOSAL_KEY})});
		return Object.freeze({
			type: literalField(CONTRACT, record, "type", CHANGE_RELATIONS, itemPath),
			target,
			rationale: textField(CONTRACT, record, "rationale", itemPath, {minimumBytes: 1, maximumBytes: 4_096}),
		});
	});
	assertOrderedUnique(relationships.map((entry) => `${entry.type}\0${entry.target.kind === "change" ? entry.target.changeId : entry.target.proposalKey}`), path);
	return Object.freeze(relationships);
}

function decodeWikiPatch(value: CanonicalValue, path: string): WikiPatchInput {
	const record = exactRecord(CONTRACT, value, path, ["deletes", "upserts"]);
	const upserts = arrayField(CONTRACT, record, "upserts", path, 1_024).map((entry, index) => {
		const itemPath = `${path}.upserts[${index}]`;
		const item = exactRecord(CONTRACT, entry, itemPath, ["content", "path"]);
		return Object.freeze({
			path: wikiPathField(item, "path", itemPath),
			content: textField(CONTRACT, item, "content", itemPath, {maximumBytes: 1024 * 1024}),
		});
	});
	const deletes = sortedUniqueTextArray(CONTRACT, requiredField(CONTRACT, record, "deletes", path), `${path}.deletes`, {maximumEntries: 1_024, maximumBytes: 4_096});
	for (const entry of deletes) if (!isWikiItemPath(entry)) rejectContract("invalid_field", CONTRACT, `${path}.deletes`, "Wiki deletion path is invalid.");
	assertOrderedUnique(upserts.map((entry) => entry.path), `${path}.upserts`);
	if (upserts.some((entry) => deletes.includes(entry.path))) rejectContract("invalid_field", CONTRACT, path, "Wiki path cannot be both updated and deleted.");
	return Object.freeze({upserts: Object.freeze(upserts), deletes});
}

function decodePlanWork(value: CanonicalValue, path: string): PlanWorkInput {
	const record = exactRecord(CONTRACT, value, path, ["acceptance", "capabilities", "dependencyOrdinals", "ordinal", "targets", "workType", "writablePaths"]);
	const dependencyOrdinals = arrayField(CONTRACT, record, "dependencyOrdinals", path, 1_024).map((entry, index) => {
		if (typeof entry !== "number" || !Number.isSafeInteger(entry) || entry < 1 || entry > 1_024) rejectContract("invalid_field", CONTRACT, `${path}.dependencyOrdinals[${index}]`, "Dependency ordinal is invalid.");
		return entry;
	});
	assertOrderedUnique(dependencyOrdinals, `${path}.dependencyOrdinals`);
	return Object.freeze({
		ordinal: integerField(CONTRACT, record, "ordinal", path, 1, 1_024),
		workType: namespacedField(record, "workType", path),
		targets: decodeTargets(requiredField(CONTRACT, record, "targets", path), `${path}.targets`),
		writablePaths: boundedTextSet(record, "writablePaths", path, 1_024, 512),
		dependencyOrdinals: Object.freeze(dependencyOrdinals),
		capabilities: namespacedSet(record, "capabilities", path, 256),
		acceptance: boundedTextSet(record, "acceptance", path, 256, 4_096),
	});
}

function decodeBinding(record: CanonicalRecord): CommandBindingInput {
	return Object.freeze({
		commandId: commandIdField(record),
		expectedProjectHead: oidField(record, "expectedProjectHead"),
		expectedChangeTip: oidField(record, "expectedChangeTip"),
	});
}

function boundedTextSet(record: CanonicalRecord, field: string, path: string, maximumEntries: number, maximumBytes: number): readonly string[] {
	return sortedUniqueTextArray(CONTRACT, requiredField(CONTRACT, record, field, path), `${path}.${field}`, {maximumEntries, maximumBytes});
}

function namespacedSet(record: CanonicalRecord, field: string, path: string, maximumEntries: number): readonly string[] {
	const values = boundedTextSet(record, field, path, maximumEntries, 256);
	for (let index = 0; index < values.length; index += 1) if (!isNamespacedIdentifier(values[index] as string)) rejectContract("invalid_field", CONTRACT, `${path}.${field}[${index}]`, "Reference must be namespaced.");
	return values;
}

function namespacedField(record: CanonicalRecord, field: string, path: string): string {
	const value = textField(CONTRACT, record, field, path, {maximumBytes: 256});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", CONTRACT, `${path}.${field}`, "Identity must be namespaced.");
	return value;
}

function commandIdField(record: CanonicalRecord): string {
	return namespacedField(record, "commandId", "$");
}

function changeIdField(record: CanonicalRecord, field: string, path = "$"): string {
	return textField(CONTRACT, record, field, path, {maximumBytes: 200, pattern: CHANGE_ID});
}

function workIdField(record: CanonicalRecord): string {
	return textField(CONTRACT, record, "workId", "$", {maximumBytes: 256, pattern: WORK_ID});
}

function oidField(record: CanonicalRecord, field: string): GitOid {
	return decodeGitOidValue(requiredField(CONTRACT, record, field), `$.${field}`);
}

function wikiPathField(record: CanonicalRecord, field: string, path: string): string {
	const value = textField(CONTRACT, record, field, path, {maximumBytes: 4_096});
	if (!isWikiItemPath(value)) rejectContract("invalid_field", CONTRACT, `${path}.${field}`, "Wiki Item path is invalid.");
	return value;
}

function isWikiItemPath(value: string): boolean {
	return value.startsWith(".codewiki/wiki/items/") && /\.(?:md|ya?ml)$/u.test(value) && value.normalize("NFC") === value &&
		!/[\\\0\r\n]/u.test(value) && value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function assertOrderedUnique(values: readonly (number | string)[], path: string): void {
	for (let index = 1; index < values.length; index += 1) {
		if ((values[index - 1] as number | string) >= (values[index] as number | string)) rejectContract("invalid_field", CONTRACT, path, "Values must be strictly ordered and unique.");
	}
}
