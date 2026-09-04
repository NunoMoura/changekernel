import {
	arrayField,
	assertDigestMatch,
	booleanField,
	decodeContract,
	exactRecord,
	integerField,
	isNamespacedIdentifier,
	literalField,
	nullableValue,
	protocolField,
	protocolIdentity,
	rejectContract,
	requiredField,
	textField,
	textValue,
	type CanonicalRecord,
	type ContractIssue,
} from "../canonical/contract.ts";
import {isCanonicalObject, type CanonicalPrimitive, type CanonicalValue} from "../canonical/json.ts";
import {failure, type Outcome} from "../canonical/outcome.ts";
import {decodeEvidenceReferenceValue, type EvidenceReference} from "../evidence/reference.ts";
import {decodeGitOidValue, type GitOid} from "../identity/git.ts";
import {semanticDigest, semanticId, type SemanticIdentityIssue} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";
import {CHANGE_REALIZATIONS, CHANGE_TYPES, type ChangeRealization, type ChangeType} from "../changes/contracts.ts";
import {
	checkDefinitionDigest,
	decodeCheckDefinition,
	type CheckDefinition,
	type CheckImplementationKind,
	type CheckInputSource,
} from "./check-definition.ts";

export const GATE_PROTOCOL = protocolIdentity("codewiki.gate", "1.0.0");
export const CHECK_RUN_PROTOCOL = protocolIdentity("codewiki.check-run", "1.0.0");
export const RESULT_PROTOCOL = protocolIdentity("codewiki.result", "1.0.0");

export const CHECK_STAGES = ["decision", "implementation", "planning", "review"] as const;
export const CHECK_ENFORCEMENTS = ["advisory", "observe", "required"] as const;
export const GATE_SUBJECT_KINDS = ["change", "effect", "plan", "review", "work"] as const;
export const CHECK_RUN_STATUSES = ["completed", "error", "stopped"] as const;
export const RESULT_STATUSES = ["failed", "passed"] as const;

export type CheckStage = (typeof CHECK_STAGES)[number];
export type CheckEnforcement = (typeof CHECK_ENFORCEMENTS)[number];
export type GateSubjectKind = (typeof GATE_SUBJECT_KINDS)[number];
export type CheckRunStatus = (typeof CHECK_RUN_STATUSES)[number];
export type ResultStatus = (typeof RESULT_STATUSES)[number];
export type CheckRegistrationSource = "product" | "project";

export interface GateSubjectBody {
	readonly kind: GateSubjectKind;
	readonly repositoryId: string;
	readonly changeId: string;
	readonly workId: string | null;
	readonly projectCommit: GitOid;
	readonly projectTree: GitOid;
	readonly changeTip: GitOid;
	readonly artifactCommit: GitOid | null;
	readonly artifactTree: GitOid | null;
	readonly facts: Readonly<{[key: string]: CanonicalValue}>;
	readonly subjectDigest: Sha256Digest;
}

export type GateSubject = GateSubjectBody;

export interface CheckApplicability {
	readonly changeTypes: readonly ChangeType[];
	readonly realizations: readonly ChangeRealization[];
	readonly subjectKinds: readonly GateSubjectKind[];
	readonly workTypes: readonly string[];
	readonly facts: Readonly<{[key: string]: CanonicalPrimitive}>;
}

export interface CheckRegistrationBody {
	readonly source: CheckRegistrationSource;
	readonly packId: string;
	readonly stage: CheckStage;
	readonly enforcement: CheckEnforcement;
	readonly universalSafety: boolean;
	readonly applicability: CheckApplicability;
	readonly definition: CheckDefinition;
	readonly definitionDigest: Sha256Digest;
}

export interface CheckRegistration extends CheckRegistrationBody {
	readonly registrationDigest: Sha256Digest;
}

export interface GateInputReference {
	readonly source: CheckInputSource;
	readonly ref: string;
	readonly digest: Sha256Digest;
}

export interface GateOmission {
	readonly registrationDigest: Sha256Digest;
	readonly reason: "inapplicable" | "optional_pack_disabled";
}

export interface GateResolverIdentity {
	readonly id: string;
	readonly version: string;
}

export interface GateSelectionInputs {
	readonly changeType: ChangeType;
	readonly realization: ChangeRealization;
	readonly workType: string | null;
	readonly enabledProjectPacks: readonly string[];
}

export interface GateBody {
	readonly protocol: typeof GATE_PROTOCOL;
	readonly gateId: string;
	readonly stage: CheckStage;
	readonly subject: GateSubject;
	readonly selectionInputs: GateSelectionInputs;
	readonly availablePolicyDigest: Sha256Digest;
	readonly resolver: GateResolverIdentity;
	readonly activeChecks: readonly CheckRegistration[];
	readonly inputs: readonly GateInputReference[];
	readonly omissions: readonly GateOmission[];
	readonly selectionComplete: boolean;
	readonly kernelBuildDigest: Sha256Digest;
}

export interface Gate extends GateBody {
	readonly gateDigest: Sha256Digest;
}

export interface CheckExecutionIdentity {
	readonly kind: CheckImplementationKind;
	readonly executorId: string;
	readonly executorVersion: string;
	readonly profile: string;
	readonly route: string | null;
	readonly configurationDigest: Sha256Digest;
}

export interface CheckRunBody {
	readonly protocol: typeof CHECK_RUN_PROTOCOL;
	readonly runId: string;
	readonly gateDigest: Sha256Digest;
	readonly subjectDigest: Sha256Digest;
	readonly registrationDigest: Sha256Digest;
	readonly definitionDigest: Sha256Digest;
	readonly inputs: readonly GateInputReference[];
	readonly execution: CheckExecutionIdentity;
	readonly attempt: number;
	readonly predecessorRunDigest: Sha256Digest | null;
	readonly quiescenceReceipt: EvidenceReference | null;
	readonly status: CheckRunStatus;
	readonly resultDigest: Sha256Digest | null;
	readonly executionReceipt: EvidenceReference | null;
}

export interface CheckRun extends CheckRunBody {
	readonly runDigest: Sha256Digest;
}

export type CheckMeasurement =
	| Readonly<{kind: "binary"; value: boolean}>
	| Readonly<{kind: "quantitative"; value: number}>;

export interface ResultDetail {
	readonly message: string;
	readonly ref: string | null;
	readonly startLine: number | null;
	readonly endLine: number | null;
}

export interface ResultFailure {
	readonly code: string;
	readonly message: string;
	readonly remediation: readonly string[];
}

export interface ResultBody {
	readonly protocol: typeof RESULT_PROTOCOL;
	readonly resultId: string;
	readonly gateDigest: Sha256Digest;
	readonly runId: string;
	readonly subjectDigest: Sha256Digest;
	readonly registrationDigest: Sha256Digest;
	readonly definitionDigest: Sha256Digest;
	readonly inputs: readonly GateInputReference[];
	readonly measurement: CheckMeasurement;
	readonly evidence: readonly EvidenceReference[];
	readonly executionDigest: Sha256Digest;
	readonly status: ResultStatus;
	readonly summary: string;
	readonly details: readonly ResultDetail[];
	readonly failure: ResultFailure | null;
}

export interface Result extends ResultBody {
	readonly resultDigest: Sha256Digest;
}

export function createGateSubject(body: GateSubjectBody): Outcome<GateSubject, ContractIssue> {
	return decodeContract("Gate subject", body, (value) => decodeGateSubjectValue(value));
}

export function decodeGateSubject(input: unknown): Outcome<GateSubject, ContractIssue> {
	return decodeContract("Gate subject", input, (value) => decodeGateSubjectValue(value));
}

export function decodeGateSubjectValue(value: CanonicalValue, path = "$"): GateSubject {
	const record = exactRecord("Gate subject", value, path, [
		"artifactCommit",
		"artifactTree",
		"changeId",
		"changeTip",
		"facts",
		"kind",
		"projectCommit",
		"projectTree",
		"repositoryId",
		"subjectDigest",
		"workId",
	]);
	const projectCommit = decodeGitOidValue(requiredField("Gate subject", record, "projectCommit", path), `${path}.projectCommit`);
	const projectTree = decodeGitOidValue(requiredField("Gate subject", record, "projectTree", path), `${path}.projectTree`);
	const changeTip = decodeGitOidValue(requiredField("Gate subject", record, "changeTip", path), `${path}.changeTip`);
	const artifactCommit = nullableValue(requiredField("Gate subject", record, "artifactCommit", path), (entry) => decodeGitOidValue(entry, `${path}.artifactCommit`));
	const artifactTree = nullableValue(requiredField("Gate subject", record, "artifactTree", path), (entry) => decodeGitOidValue(entry, `${path}.artifactTree`));
	const algorithm = projectCommit.algorithm;
	if (
		projectTree.algorithm !== algorithm ||
		changeTip.algorithm !== algorithm ||
		(artifactCommit !== null && artifactCommit.algorithm !== algorithm) ||
		(artifactTree !== null && artifactTree.algorithm !== algorithm)
	) rejectContract("invalid_field", "Gate subject", path, "All Gate subject OIDs must use one object format.");
	if ((artifactCommit === null) !== (artifactTree === null)) rejectContract("invalid_field", "Gate subject", path, "Artifact commit and tree must both be present or absent.");
	const facts = namespacedPrimitiveRecord(requiredField("Gate subject", record, "facts", path), `${path}.facts`, false);
	const subjectDigest = digestField("Gate subject", record, "subjectDigest", path);
	const result = Object.freeze({
		kind: literalField("Gate subject", record, "kind", GATE_SUBJECT_KINDS, path),
		repositoryId: namespacedField("Gate subject", record, "repositoryId", path),
		changeId: changeIdField("Gate subject", record, "changeId", path),
		workId: nullableNamespacedField("Gate subject", record, "workId", path),
		projectCommit,
		projectTree,
		changeTip,
		artifactCommit,
		artifactTree,
		facts,
		subjectDigest,
	});
	if (result.kind === "work" && result.workId === null) rejectContract("missing_field", "Gate subject", `${path}.workId`, "Work subject requires Work identity.");
	if (result.kind !== "work" && result.workId !== null) rejectContract("invalid_field", "Gate subject", `${path}.workId`, "Only Work subject may carry Work identity.");
	return result;
}

export function createCheckRegistration(
	body: Omit<CheckRegistrationBody, "definitionDigest">,
): Outcome<CheckRegistration, ContractIssue | SemanticIdentityIssue> {
	const definitionDigest = checkDefinitionDigest(body.definition);
	const value = {...body, definitionDigest};
	const digest = semanticDigest("codewiki.check-registration@1.0.0", value);
	if (!digest.ok) return failure(digest.error);
	return decodeCheckRegistration({...value, registrationDigest: digest.value});
}

export function decodeCheckRegistration(input: unknown): Outcome<CheckRegistration, ContractIssue> {
	return decodeContract("Check registration", input, (value) => decodeCheckRegistrationValue(value));
}

export function decodeCheckRegistrationValue(value: CanonicalValue, path = "$"): CheckRegistration {
	const record = exactRecord("Check registration", value, path, [
		"applicability",
		"definition",
		"definitionDigest",
		"enforcement",
		"packId",
		"registrationDigest",
		"source",
		"stage",
		"universalSafety",
	]);
	const definitionResult = decodeCheckDefinition(requiredField("Check registration", record, "definition", path));
	if (!definitionResult.ok) rejectContract("invalid_field", "Check registration", `${path}.definition`, definitionResult.error.message);
	const definition = definitionResult.value;
	const definitionDigest = digestField("Check registration", record, "definitionDigest", path);
	assertDigestMatch("Check registration", `${path}.definitionDigest`, definitionDigest, checkDefinitionDigest(definition));
	const result = Object.freeze({
		source: literalField("Check registration", record, "source", ["product", "project"] as const, path),
		packId: identifierField("Check registration", record, "packId", path),
		stage: literalField("Check registration", record, "stage", CHECK_STAGES, path),
		enforcement: literalField("Check registration", record, "enforcement", CHECK_ENFORCEMENTS, path),
		universalSafety: booleanField("Check registration", record, "universalSafety", path),
		applicability: decodeApplicability(requiredField("Check registration", record, "applicability", path), `${path}.applicability`),
		definition,
		definitionDigest,
		registrationDigest: digestField("Check registration", record, "registrationDigest", path),
	});
	if (result.universalSafety && result.enforcement !== "required") {
		rejectContract("invalid_field", "Check registration", `${path}.enforcement`, "Universal-safety Check must be required.");
	}
	const {registrationDigest: _registrationDigest, ...body} = result;
	assertSemanticDigest("Check registration", `${path}.registrationDigest`, "codewiki.check-registration@1.0.0", body, result.registrationDigest);
	return result;
}

export function checkRegistrationKey(registration: CheckRegistration): string {
	return `${registration.stage}/${registration.packId}/${registration.definition.id}/${registration.definition.version}`;
}

export function createGate(
	body: Omit<GateBody, "protocol" | "gateId">,
): Outcome<Gate, ContractIssue | SemanticIdentityIssue> {
	const identity = semanticId("cw:gate", protocolLabel(GATE_PROTOCOL), body);
	if (!identity.ok) return failure(identity.error);
	const value = {...body, protocol: GATE_PROTOCOL, gateId: identity.value};
	const digest = semanticDigest(protocolLabel(GATE_PROTOCOL), value);
	if (!digest.ok) return failure(digest.error);
	return decodeGate({...value, gateDigest: digest.value});
}

export function decodeGate(input: unknown): Outcome<Gate, ContractIssue> {
	return decodeContract("Gate", input, (value) => decodeGateValue(value));
}

export function decodeGateValue(value: CanonicalValue, path = "$"): Gate {
	const record = exactRecord("Gate", value, path, [
		"activeChecks",
		"availablePolicyDigest",
		"gateDigest",
		"gateId",
		"inputs",
		"kernelBuildDigest",
		"omissions",
		"protocol",
		"resolver",
		"selectionComplete",
		"selectionInputs",
		"stage",
		"subject",
	]);
	protocolField("Gate", record, path, GATE_PROTOCOL);
	const stage = literalField("Gate", record, "stage", CHECK_STAGES, path);
	const activeChecks = decodeRegistrationArray(arrayField("Gate", record, "activeChecks", path, 256), `${path}.activeChecks`);
	if (activeChecks.some((entry) => entry.stage !== stage)) rejectContract("invalid_field", "Gate", `${path}.activeChecks`, "Active Check stage must match Gate stage.");
	const resolverRecord = exactRecord("Gate", requiredField("Gate", record, "resolver", path), `${path}.resolver`, ["id", "version"]);
	const result = Object.freeze({
		protocol: GATE_PROTOCOL,
		gateId: namespacedField("Gate", record, "gateId", path),
		stage,
		subject: decodeGateSubjectValue(requiredField("Gate", record, "subject", path), `${path}.subject`),
		selectionInputs: decodeGateSelectionInputs(requiredField("Gate", record, "selectionInputs", path), `${path}.selectionInputs`),
		availablePolicyDigest: digestField("Gate", record, "availablePolicyDigest", path),
		resolver: Object.freeze({
			id: namespacedField("Gate", resolverRecord, "id", `${path}.resolver`),
			version: textField("Gate", resolverRecord, "version", `${path}.resolver`, {maximumBytes: 64, pattern: /^\d+\.\d+\.\d+$/u}),
		}),
		activeChecks,
		inputs: decodeInputReferences("Gate", arrayField("Gate", record, "inputs", path, 4_096), `${path}.inputs`),
		omissions: decodeOmissions(arrayField("Gate", record, "omissions", path, 256), `${path}.omissions`),
		selectionComplete: booleanField("Gate", record, "selectionComplete", path),
		kernelBuildDigest: digestField("Gate", record, "kernelBuildDigest", path),
		gateDigest: digestField("Gate", record, "gateDigest", path),
	});
	if ((result.subject.kind === "work") !== (result.selectionInputs.workType !== null)) {
		rejectContract("invalid_field", "Gate", `${path}.selectionInputs.workType`, "Work type must be present exactly for Work subjects.");
	}
	const activeDigests = new Set(result.activeChecks.map((entry) => entry.registrationDigest));
	if (result.omissions.some((entry) => activeDigests.has(entry.registrationDigest))) {
		rejectContract("invalid_field", "Gate", `${path}.omissions`, "One Check registration cannot be both active and omitted.");
	}
	const {gateDigest: _gateDigest, ...withId} = result;
	const {gateId: _gateId, protocol: _protocol, ...identityBody} = withId;
	const expectedId = semanticId("cw:gate", protocolLabel(GATE_PROTOCOL), identityBody);
	if (!expectedId.ok || expectedId.value !== result.gateId) rejectContract("invalid_field", "Gate", `${path}.gateId`, "Gate identity does not match canonical subject and policy.");
	assertSemanticDigest("Gate", `${path}.gateDigest`, protocolLabel(GATE_PROTOCOL), withId, result.gateDigest);
	return result;
}

export function checkRunIdentity(
	gateDigest: Sha256Digest,
	registrationDigest: Sha256Digest,
	attempt: number,
): Outcome<string, SemanticIdentityIssue> {
	return semanticId("cw:check-run", protocolLabel(CHECK_RUN_PROTOCOL), {gateDigest, registrationDigest, attempt});
}

export function createCheckRun(
	body: Omit<CheckRunBody, "protocol" | "runId">,
): Outcome<CheckRun, ContractIssue | SemanticIdentityIssue> {
	const identity = checkRunIdentity(body.gateDigest, body.registrationDigest, body.attempt);
	if (!identity.ok) return failure(identity.error);
	const value = {...body, protocol: CHECK_RUN_PROTOCOL, runId: identity.value};
	const digest = semanticDigest(protocolLabel(CHECK_RUN_PROTOCOL), value);
	if (!digest.ok) return failure(digest.error);
	return decodeCheckRun({...value, runDigest: digest.value});
}

export function decodeCheckRun(input: unknown): Outcome<CheckRun, ContractIssue> {
	return decodeContract("Check Run", input, (value) => decodeCheckRunValue(value));
}

export function decodeCheckRunValue(value: CanonicalValue, path = "$"): CheckRun {
	const record = exactRecord("Check Run", value, path, [
		"attempt",
		"definitionDigest",
		"execution",
		"executionReceipt",
		"gateDigest",
		"inputs",
		"predecessorRunDigest",
		"protocol",
		"quiescenceReceipt",
		"registrationDigest",
		"resultDigest",
		"runDigest",
		"runId",
		"status",
		"subjectDigest",
	]);
	protocolField("Check Run", record, path, CHECK_RUN_PROTOCOL);
	const attempt = integerField("Check Run", record, "attempt", path, 1, 3);
	const predecessorRunDigest = nullableDigestField("Check Run", record, "predecessorRunDigest", path);
	const quiescenceReceipt = nullableValue(requiredField("Check Run", record, "quiescenceReceipt", path), (entry) => decodeEvidenceReferenceValue(entry, `${path}.quiescenceReceipt`));
	if (attempt === 1 && (predecessorRunDigest !== null || quiescenceReceipt !== null)) {
		rejectContract("invalid_field", "Check Run", path, "First Check Run cannot have retry bindings.");
	}
	if (attempt > 1 && predecessorRunDigest === null) {
		rejectContract("missing_field", "Check Run", path, "Retry requires predecessor Run binding.");
	}
	if (quiescenceReceipt !== null && quiescenceReceipt.subjectDigest !== predecessorRunDigest) {
		rejectContract("invalid_field", "Check Run", `${path}.quiescenceReceipt.subjectDigest`, "Quiescence receipt must target predecessor Run digest.");
	}
	const status = literalField("Check Run", record, "status", CHECK_RUN_STATUSES, path);
	const resultDigest = nullableDigestField("Check Run", record, "resultDigest", path);
	if ((status === "completed") !== (resultDigest !== null)) rejectContract("invalid_field", "Check Run", `${path}.resultDigest`, "Only completed Check Run has one Result digest.");
	const subjectDigest = digestField("Check Run", record, "subjectDigest", path);
	const executionReceipt = nullableValue(requiredField("Check Run", record, "executionReceipt", path), (entry) => decodeEvidenceReferenceValue(entry, `${path}.executionReceipt`));
	if (executionReceipt !== null && executionReceipt.subjectDigest !== subjectDigest) {
		rejectContract("invalid_field", "Check Run", `${path}.executionReceipt.subjectDigest`, "Execution receipt must target Check Run subject.");
	}
	if (status === "completed" && executionReceipt === null) rejectContract("missing_field", "Check Run", `${path}.executionReceipt`, "Completed Check Run requires execution receipt.");
	const result = Object.freeze({
		protocol: CHECK_RUN_PROTOCOL,
		runId: namespacedField("Check Run", record, "runId", path),
		gateDigest: digestField("Check Run", record, "gateDigest", path),
		subjectDigest,
		registrationDigest: digestField("Check Run", record, "registrationDigest", path),
		definitionDigest: digestField("Check Run", record, "definitionDigest", path),
		inputs: decodeInputReferences("Check Run", arrayField("Check Run", record, "inputs", path, 4_096), `${path}.inputs`),
		execution: decodeExecution(requiredField("Check Run", record, "execution", path), `${path}.execution`),
		attempt,
		predecessorRunDigest,
		quiescenceReceipt,
		status,
		resultDigest,
		executionReceipt,
		runDigest: digestField("Check Run", record, "runDigest", path),
	});
	const {runDigest: _runDigest, ...withId} = result;
	const expectedId = checkRunIdentity(result.gateDigest, result.registrationDigest, result.attempt);
	if (!expectedId.ok || expectedId.value !== result.runId) rejectContract("invalid_field", "Check Run", `${path}.runId`, "Check Run identity mismatch.");
	assertSemanticDigest("Check Run", `${path}.runDigest`, protocolLabel(CHECK_RUN_PROTOCOL), withId, result.runDigest);
	return result;
}

export function createResult(
	body: Omit<ResultBody, "protocol" | "resultId">,
): Outcome<Result, ContractIssue | SemanticIdentityIssue> {
	const identity = semanticId("cw:result", protocolLabel(RESULT_PROTOCOL), {runId: body.runId});
	if (!identity.ok) return failure(identity.error);
	const value = {...body, protocol: RESULT_PROTOCOL, resultId: identity.value};
	const digest = semanticDigest(protocolLabel(RESULT_PROTOCOL), value);
	if (!digest.ok) return failure(digest.error);
	return decodeResult({...value, resultDigest: digest.value});
}

export function decodeResult(input: unknown): Outcome<Result, ContractIssue> {
	return decodeContract("Result", input, (value) => decodeResultValue(value));
}

export function decodeResultValue(value: CanonicalValue, path = "$"): Result {
	const record = exactRecord("Result", value, path, [
		"definitionDigest",
		"details",
		"evidence",
		"executionDigest",
		"failure",
		"gateDigest",
		"inputs",
		"measurement",
		"protocol",
		"registrationDigest",
		"resultDigest",
		"resultId",
		"runId",
		"status",
		"subjectDigest",
		"summary",
	]);
	protocolField("Result", record, path, RESULT_PROTOCOL);
	const status = literalField("Result", record, "status", RESULT_STATUSES, path);
	const failureValue = nullableValue(requiredField("Result", record, "failure", path), (entry) => decodeResultFailure(entry, `${path}.failure`));
	if ((status === "failed") !== (failureValue !== null)) rejectContract("invalid_field", "Result", `${path}.failure`, "Failed Result requires failure; passed Result forbids it.");
	const subjectDigest = digestField("Result", record, "subjectDigest", path);
	const evidence = arrayField("Result", record, "evidence", path, 1_024).map((entry, index) =>
		decodeEvidenceReferenceValue(entry, `${path}.evidence[${index}]`));
	evidence.sort((left, right) => compareText(left.referenceDigest, right.referenceDigest));
	assertUnique(evidence.map((entry) => entry.referenceDigest), `${path}.evidence`, "Result");
	const result = Object.freeze({
		protocol: RESULT_PROTOCOL,
		resultId: namespacedField("Result", record, "resultId", path),
		gateDigest: digestField("Result", record, "gateDigest", path),
		runId: namespacedField("Result", record, "runId", path),
		subjectDigest,
		registrationDigest: digestField("Result", record, "registrationDigest", path),
		definitionDigest: digestField("Result", record, "definitionDigest", path),
		inputs: decodeInputReferences("Result", arrayField("Result", record, "inputs", path, 4_096), `${path}.inputs`),
		measurement: decodeResultMeasurement(requiredField("Result", record, "measurement", path), `${path}.measurement`),
		evidence: Object.freeze(evidence),
		executionDigest: digestField("Result", record, "executionDigest", path),
		status,
		summary: textField("Result", record, "summary", path, {maximumBytes: 65_536}),
		details: decodeResultDetails(arrayField("Result", record, "details", path, 128), `${path}.details`),
		failure: failureValue,
		resultDigest: digestField("Result", record, "resultDigest", path),
	});
	if (result.evidence.some((entry) => entry.subjectDigest !== result.subjectDigest)) {
		rejectContract("invalid_field", "Result", `${path}.evidence`, "Every Result Evidence reference must target Result subject.");
	}
	const {resultDigest: _resultDigest, ...withId} = result;
	const expectedId = semanticId("cw:result", protocolLabel(RESULT_PROTOCOL), {runId: result.runId});
	if (!expectedId.ok || expectedId.value !== result.resultId) rejectContract("invalid_field", "Result", `${path}.resultId`, "Result identity mismatch.");
	assertSemanticDigest("Result", `${path}.resultDigest`, protocolLabel(RESULT_PROTOCOL), withId, result.resultDigest);
	return result;
}

function decodeApplicability(value: CanonicalValue, path: string): CheckApplicability {
	const record = exactRecord("Check registration", value, path, ["changeTypes", "facts", "realizations", "subjectKinds", "workTypes"]);
	return Object.freeze({
		changeTypes: literalSet("Check registration", arrayField("Check registration", record, "changeTypes", path, CHANGE_TYPES.length), `${path}.changeTypes`, CHANGE_TYPES),
		realizations: literalSet("Check registration", arrayField("Check registration", record, "realizations", path, CHANGE_REALIZATIONS.length), `${path}.realizations`, CHANGE_REALIZATIONS),
		subjectKinds: literalSet("Check registration", arrayField("Check registration", record, "subjectKinds", path, GATE_SUBJECT_KINDS.length), `${path}.subjectKinds`, GATE_SUBJECT_KINDS),
		workTypes: namespacedSet("Check registration", arrayField("Check registration", record, "workTypes", path, 256), `${path}.workTypes`),
		facts: namespacedPrimitiveRecord(requiredField("Check registration", record, "facts", path), `${path}.facts`, true),
	});
}

function decodeGateSelectionInputs(value: CanonicalValue, path: string): GateSelectionInputs {
	const record = exactRecord("Gate", value, path, ["changeType", "enabledProjectPacks", "realization", "workType"]);
	const enabledProjectPacks = arrayField("Gate", record, "enabledProjectPacks", path, 256).map((entry, index) =>
		textValue("Gate", entry, `${path}.enabledProjectPacks[${index}]`, {maximumBytes: 128, pattern: /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u}));
	assertOrdered(enabledProjectPacks, `${path}.enabledProjectPacks`, "Gate");
	return Object.freeze({
		changeType: literalField("Gate", record, "changeType", CHANGE_TYPES, path),
		realization: literalField("Gate", record, "realization", CHANGE_REALIZATIONS, path),
		workType: nullableValue(requiredField("Gate", record, "workType", path), (entry) => {
			const candidate = textValue("Gate", entry, `${path}.workType`, {maximumBytes: 256});
			if (!isNamespacedIdentifier(candidate)) rejectContract("invalid_field", "Gate", `${path}.workType`, "Work type must be canonical namespaced text.");
			return candidate;
		}),
		enabledProjectPacks: Object.freeze(enabledProjectPacks),
	});
}

function decodeRegistrationArray(input: readonly CanonicalValue[], path: string): readonly CheckRegistration[] {
	const output = input.map((entry, index) => decodeCheckRegistrationValue(entry, `${path}[${index}]`));
	assertOrdered(output.map(checkRegistrationKey), path, "Gate");
	return Object.freeze(output);
}

function decodeOmissions(input: readonly CanonicalValue[], path: string): readonly GateOmission[] {
	const output = input.map((entry, index) => {
		const itemPath = `${path}[${index}]`;
		const record = exactRecord("Gate", entry, itemPath, ["reason", "registrationDigest"]);
		return Object.freeze({
			registrationDigest: digestField("Gate", record, "registrationDigest", itemPath),
			reason: literalField("Gate", record, "reason", ["inapplicable", "optional_pack_disabled"] as const, itemPath),
		});
	});
	assertOrdered(output.map((entry) => entry.registrationDigest), path, "Gate");
	return Object.freeze(output);
}

function decodeExecution(value: CanonicalValue, path: string): CheckExecutionIdentity {
	const record = exactRecord("Check Run", value, path, ["configurationDigest", "executorId", "executorVersion", "kind", "profile", "route"]);
	return Object.freeze({
		kind: literalField("Check Run", record, "kind", ["code", "model"] as const, path),
		executorId: identifierField("Check Run", record, "executorId", path),
		executorVersion: textField("Check Run", record, "executorVersion", path, {maximumBytes: 128}),
		profile: identifierField("Check Run", record, "profile", path),
		route: nullableValue(requiredField("Check Run", record, "route", path), (entry) => textValue("Check Run", entry, `${path}.route`, {maximumBytes: 128, pattern: /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u})),
		configurationDigest: digestField("Check Run", record, "configurationDigest", path),
	});
}

function decodeResultMeasurement(value: CanonicalValue, path: string): CheckMeasurement {
	const record = exactRecord("Result", value, path, ["kind", "value"]);
	const kind = literalField("Result", record, "kind", ["binary", "quantitative"] as const, path);
	const measurement = requiredField("Result", record, "value", path);
	if (kind === "binary") {
		if (typeof measurement !== "boolean") rejectContract("invalid_field", "Result", `${path}.value`, "Binary measurement must be boolean.");
		return Object.freeze({kind, value: measurement});
	}
	if (typeof measurement !== "number" || !Number.isFinite(measurement)) rejectContract("invalid_field", "Result", `${path}.value`, "Quantitative measurement must be finite.");
	return Object.freeze({kind, value: measurement});
}

function decodeResultDetails(input: readonly CanonicalValue[], path: string): readonly ResultDetail[] {
	return Object.freeze(input.map((entry, index) => {
		const itemPath = `${path}[${index}]`;
		const record = exactRecord("Result", entry, itemPath, ["endLine", "message", "ref", "startLine"]);
		const startLine = nullableInteger(record, "startLine", itemPath);
		const endLine = nullableInteger(record, "endLine", itemPath);
		if ((startLine === null) !== (endLine === null) || (startLine !== null && endLine !== null && endLine < startLine)) {
			rejectContract("invalid_field", "Result", itemPath, "Result detail line range is incomplete or reversed.");
		}
		return Object.freeze({
			message: textField("Result", record, "message", itemPath, {maximumBytes: 4_096}),
			ref: nullableValue(requiredField("Result", record, "ref", itemPath), (value) => textValue("Result", value, `${itemPath}.ref`, {maximumBytes: 512})),
			startLine,
			endLine,
		});
	}));
}

function decodeResultFailure(value: CanonicalValue, path: string): ResultFailure {
	const record = exactRecord("Result", value, path, ["code", "message", "remediation"]);
	return Object.freeze({
		code: identifierField("Result", record, "code", path),
		message: textField("Result", record, "message", path, {maximumBytes: 4_096}),
		remediation: Object.freeze(arrayField("Result", record, "remediation", path, 32).map((entry, index) =>
			textValue("Result", entry, `${path}.remediation[${index}]`, {maximumBytes: 4_096}))),
	});
}

function namespacedPrimitiveRecord(value: CanonicalValue, path: string, primitiveOnly: boolean): Readonly<{[key: string]: never}> & CanonicalRecord {
	if (!isCanonicalObject(value) || Object.keys(value).length > 256) rejectContract("invalid_field", "Gate contract", path, "Facts must be a bounded object.");
	for (const [key, child] of Object.entries(value)) {
		if (!isNamespacedIdentifier(key)) rejectContract("invalid_field", "Gate contract", `${path}.${key}`, "Fact key must be namespaced.");
		if (primitiveOnly && child !== null && typeof child === "object") rejectContract("invalid_field", "Gate contract", `${path}.${key}`, "Applicability fact must be primitive.");
	}
	return value as Readonly<{[key: string]: never}> & CanonicalRecord;
}

function literalSet<const Value extends string>(
	contract: string,
	input: readonly CanonicalValue[],
	path: string,
	allowed: readonly Value[],
): readonly Value[] {
	const output = input.map((entry, index) => {
		if (typeof entry !== "string" || !allowed.includes(entry as Value)) rejectContract("invalid_field", contract, `${path}[${index}]`, "Applicability value is unsupported.");
		return entry as Value;
	});
	assertOrdered(output, path, contract);
	return Object.freeze(output);
}

function namespacedSet(contract: string, input: readonly CanonicalValue[], path: string): readonly string[] {
	const output = input.map((entry, index) => {
		const value = textValue(contract, entry, `${path}[${index}]`, {maximumBytes: 256});
		if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", contract, `${path}[${index}]`, "Value must be namespaced.");
		return value;
	});
	assertOrdered(output, path, contract);
	return Object.freeze(output);
}

function decodeInputReferences(contract: string, input: readonly CanonicalValue[], path: string): readonly GateInputReference[] {
	const output = input.map((entry, index) => {
		const itemPath = `${path}[${index}]`;
		const record = exactRecord(contract, entry, itemPath, ["digest", "ref", "source"]);
		const ref = textField(contract, record, "ref", itemPath, {minimumBytes: 1, maximumBytes: 512});
		if (ref.includes("://") || ref.includes("\0")) rejectContract("invalid_field", contract, `${itemPath}.ref`, "Input ref must be opaque local identity, not a network location.");
		return Object.freeze({
			source: literalField(contract, record, "source", ["evidence", "knowledge", "provider_receipts", "repository", "subject"] as const, itemPath),
			ref,
			digest: digestField(contract, record, "digest", itemPath),
		});
	});
	assertOrdered(output.map((entry) => `${entry.source}\0${entry.ref}\0${entry.digest}`), path, contract);
	return Object.freeze(output);
}

function digestField(contract: string, record: CanonicalRecord, field: string, path: string): Sha256Digest {
	const decoded = decodeSha256Digest(record[field]);
	if (!decoded.ok) rejectContract("invalid_field", contract, `${path}.${field}`, decoded.error.message);
	return decoded.value;
}

function nullableDigestField(contract: string, record: CanonicalRecord, field: string, path: string): Sha256Digest | null {
	const value = requiredField(contract, record, field, path);
	if (value === null) return null;
	const decoded = decodeSha256Digest(value);
	if (!decoded.ok) rejectContract("invalid_field", contract, `${path}.${field}`, decoded.error.message);
	return decoded.value;
}

function nullableInteger(record: CanonicalRecord, field: string, path: string): number | null {
	const value = requiredField("Result", record, field, path);
	if (value === null) return null;
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) rejectContract("invalid_field", "Result", `${path}.${field}`, "Line must be a positive integer or null.");
	return value;
}

function namespacedField(contract: string, record: CanonicalRecord, field: string, path: string): string {
	const value = textField(contract, record, field, path, {maximumBytes: 256});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", contract, `${path}.${field}`, "Identity must be canonical namespaced text.");
	return value;
}

function nullableNamespacedField(contract: string, record: CanonicalRecord, field: string, path: string): string | null {
	const value = requiredField(contract, record, field, path);
	if (value === null) return null;
	if (typeof value !== "string" || !isNamespacedIdentifier(value)) rejectContract("invalid_field", contract, `${path}.${field}`, "Identity must be namespaced or null.");
	return value;
}

function changeIdField(contract: string, record: CanonicalRecord, field: string, path: string): string {
	return textField(contract, record, field, path, {maximumBytes: 200, pattern: /^CHG-[A-Za-z0-9][A-Za-z0-9._-]*$/u});
}

function identifierField(contract: string, record: CanonicalRecord, field: string, path: string): string {
	return textField(contract, record, field, path, {maximumBytes: 128, pattern: /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u});
}

function assertSemanticDigest(
	contract: string,
	path: string,
	protocol: string,
	value: unknown,
	actual: Sha256Digest,
): void {
	const expected = semanticDigest(protocol, value);
	if (!expected.ok) rejectContract("invalid_field", contract, path, expected.error.message);
	assertDigestMatch(contract, path, actual, expected.value);
}

function assertOrdered(values: readonly string[], path: string, contract: string): void {
	for (let index = 1; index < values.length; index += 1) {
		if ((values[index - 1] ?? "") >= (values[index] ?? "")) rejectContract("non_canonical_order", contract, path, "Values must be strictly sorted and unique.");
	}
}

function assertUnique(values: readonly string[], path: string, contract: string): void {
	if (new Set(values).size !== values.length) rejectContract("invalid_field", contract, path, "Values must be unique.");
}

function protocolLabel(protocol: Readonly<{id: string; version: string}>): string {
	return `${protocol.id}@${protocol.version}`;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
