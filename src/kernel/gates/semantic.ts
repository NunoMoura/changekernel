import {
	arrayField, assertDigestMatch, booleanField, decodeContract, exactRecord, integerField, isNamespacedIdentifier,
	literalField, nullableValue, protocolField, protocolIdentity, rejectContract, requiredField,
	textField, type CanonicalRecord, type ContractIssue,
} from "../data-contracts/validation.ts";
import {canonicalJson, isCanonicalObject, parseCanonicalJson, type CanonicalValue} from "../data-contracts/canonical-json.ts";
import type {Outcome} from "../data-contracts/outcome.ts";
import {semanticDigest} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";
import {decodeGitOidValue, type GitOid} from "../identity/git.ts";

const CHECK_STAGES = Object.freeze(["decision", "implementation", "planning", "review"] as const);
type CheckStage = (typeof CHECK_STAGES)[number];

interface GateSubject {
	readonly kind: "change" | "plan" | "review" | "work";
	readonly repositoryId: string;
	readonly changeId: string;
	readonly workId: string | null;
	readonly projectCommit: GitOid;
	readonly projectTree: GitOid;
	readonly changeTip: GitOid;
	readonly artifactCommit: GitOid | null;
	readonly artifactTree: GitOid | null;
	readonly facts: CanonicalRecord;
	readonly subjectDigest: Sha256Digest;
}

export const SEMANTIC_GATE_PROTOCOL = protocolIdentity("codewiki.gate", "2.0.0");
export const GATE_FINDING_PROTOCOL = protocolIdentity("codewiki.gate-finding", "1.0.0");
const OUTCOME_DOMAIN = "codewiki.gate-outcome@2.0.0";
const CONTRACT = "Semantic Gate";
const LIMITS = Object.freeze({maximumDepth: 32, maximumNodes: 16_384, maximumEntriesPerContainer: 256, maximumTextBytes: 256 * 1024});
const REDUCTION_LIMITS = Object.freeze({...LIMITS, maximumDepth: 36, maximumNodes: 65_536, maximumTextBytes: 1024 * 1024});

/** A backend-selected execution obligation, not a Project-authored policy pack. */
export interface SemanticGateCheck {
	readonly checkId: string;
	readonly purpose: string;
	/** Digest of the selected executor, implementation and execution configuration. */
	readonly executionDigest: Sha256Digest;
}
export interface SemanticGateBody {
	readonly protocol: typeof SEMANTIC_GATE_PROTOCOL;
	readonly stage: CheckStage;
	readonly subject: GateSubject;
	/** Exact context manifest: sources, adopted obligations, evidence and omissions. */
	readonly contextDigest: Sha256Digest;
	/** False when required context is missing, redacted or otherwise unresolved. */
	readonly contextComplete: boolean;
	readonly kernelBuildDigest: Sha256Digest;
	readonly configurationDigest: Sha256Digest;
	readonly checks: readonly SemanticGateCheck[];
}
export interface SemanticGate extends SemanticGateBody {readonly gateDigest: Sha256Digest;}
export interface GateFindingBody {
	readonly protocol: typeof GATE_FINDING_PROTOCOL;
	readonly gateDigest: Sha256Digest;
	readonly checkId: string;
	readonly executionDigest: Sha256Digest;
	readonly producerId: string;
	/** Unavailable is operational failure, not a semantic counterexample. */
	readonly status: "supported" | "contradicted" | "unresolved" | "unavailable";
	readonly reason: string;
	readonly evidenceDigests: readonly Sha256Digest[];
	readonly assumptions: readonly string[];
}
export interface GateFinding extends GateFindingBody {readonly findingDigest: Sha256Digest;}
export interface SemanticGateOutcome {
	readonly gateDigest: Sha256Digest;
	readonly currentGateDigest: Sha256Digest;
	readonly findingDigests: readonly Sha256Digest[];
	readonly status: "passed" | "failed" | "stopped";
	readonly stopReasons: readonly string[];
	readonly contradictedChecks: readonly string[];
	readonly outcomeDigest: Sha256Digest;
}
function decodeGateSubjectValue(value: CanonicalValue, path: string): GateSubject {
	const record = exactRecord(CONTRACT, value, path, [
		"artifactCommit", "artifactTree", "changeId", "changeTip", "facts", "kind",
		"projectCommit", "projectTree", "repositoryId", "subjectDigest", "workId",
	]);
	const oid = (field: string) => decodeGitOidValue(requiredField(CONTRACT, record, field, path), `${path}.${field}`);
	const optionalOid = (field: string) => nullableValue(requiredField(CONTRACT, record, field, path), () => oid(field));
	const projectCommit = oid("projectCommit"), projectTree = oid("projectTree"), changeTip = oid("changeTip");
	const artifactCommit = optionalOid("artifactCommit"), artifactTree = optionalOid("artifactTree");
	if ([projectTree, changeTip, artifactCommit, artifactTree].some(value => value !== null && value.algorithm !== projectCommit.algorithm)) {
		rejectContract("invalid_field", CONTRACT, path, "All Gate subject objects must use one object format.");
	}
	if ((artifactCommit === null) !== (artifactTree === null)) rejectContract("invalid_field", CONTRACT, path, "Artifact commit and tree must both be present or absent.");
	const facts = requiredField(CONTRACT, record, "facts", path);
	if (!isCanonicalObject(facts) || Object.keys(facts).length > 256 || Object.keys(facts).some(key => !isNamespacedIdentifier(key))) {
		rejectContract("invalid_field", CONTRACT, `${path}.facts`, "Facts must be a bounded object with namespaced keys.");
	}
	const kind = literalField(CONTRACT, record, "kind", ["change", "plan", "review", "work"] as const, path);
	const workId = nullableValue(requiredField(CONTRACT, record, "workId", path), () => identity(record, "workId", path));
	if ((kind === "work") !== (workId !== null)) rejectContract("invalid_field", CONTRACT, `${path}.workId`, "Exactly Work subjects require a Work identity.");
	return Object.freeze({
		kind, repositoryId: identity(record, "repositoryId", path),
		changeId: textField(CONTRACT, record, "changeId", path, {maximumBytes: 200, pattern: /^CHG-[A-Za-z0-9][A-Za-z0-9._-]*$/u}),
		workId, projectCommit, projectTree, changeTip, artifactCommit, artifactTree, facts,
		subjectDigest: digestField(record, "subjectDigest", path),
	});
}

const GATE_FIELDS = ["stage", "subject", "contextDigest", "contextComplete", "kernelBuildDigest", "configurationDigest", "checks"];
const FINDING_FIELDS = ["gateDigest", "checkId", "executionDigest", "producerId", "status", "reason", "evidenceDigests", "assumptions"];

export function createSemanticGate(body: Omit<SemanticGateBody, "protocol">): Outcome<SemanticGate, ContractIssue> {
	return decodeContract(CONTRACT, body, value => {
		const record = exactRecord(CONTRACT, value, "$", GATE_FIELDS);
		const content = {...record, protocol: {...SEMANTIC_GATE_PROTOCOL}};
		return gateValue({...content, gateDigest: digest("codewiki.gate@2.0.0", content)});
	}, LIMITS);
}
export function decodeSemanticGate(input: unknown): Outcome<SemanticGate, ContractIssue> {
	return decodeContract(CONTRACT, input, gateValue, LIMITS);
}
function gateValue(value: CanonicalValue): SemanticGate {
	const record = exactRecord(CONTRACT, value, "$", [...GATE_FIELDS, "protocol", "gateDigest"]);
	protocolField(CONTRACT, record, "$", SEMANTIC_GATE_PROTOCOL);
	const subject = decodeGateSubjectValue(requiredField(CONTRACT, record, "subject"), "$.subject");
	const stage = literalField(CONTRACT, record, "stage", CHECK_STAGES);
	const expectedKind = {decision: "change", planning: "plan", implementation: "work", review: "review"}[stage];
	if (subject.kind !== expectedKind) rejectContract("invalid_field", CONTRACT, "$.subject.kind", "Gate stage and subject kind must agree.");
	const checks = Object.freeze(arrayField(CONTRACT, record, "checks", "$", 64).map((entry, index) => {
		const path = `$.checks[${index}]`;
		const check = exactRecord(CONTRACT, entry, path, ["checkId", "purpose", "executionDigest"]);
		return Object.freeze({checkId: identity(check, "checkId", path), purpose: prose(check, "purpose", path), executionDigest: digestField(check, "executionDigest", path)});
	}));
	ordered(checks.map(check => check.checkId), "$.checks");
	const body = Object.freeze({protocol: SEMANTIC_GATE_PROTOCOL, stage, subject,
		contextDigest: digestField(record, "contextDigest"), contextComplete: booleanField(CONTRACT, record, "contextComplete"),
		kernelBuildDigest: digestField(record, "kernelBuildDigest"),
		configurationDigest: digestField(record, "configurationDigest"), checks});
	const gateDigest = digestField(record, "gateDigest");
	assertDigestMatch(CONTRACT, "$.gateDigest", gateDigest, digest("codewiki.gate@2.0.0", body));
	return Object.freeze({...body, gateDigest});
}
export function createGateFinding(body: Omit<GateFindingBody, "protocol">): Outcome<GateFinding, ContractIssue> {
	return decodeContract(CONTRACT, body, value => {
		const record = exactRecord(CONTRACT, value, "$", FINDING_FIELDS);
		const content = {...record, protocol: {...GATE_FINDING_PROTOCOL}};
		return findingValue({...content, findingDigest: digest("codewiki.gate-finding@1.0.0", content)});
	}, LIMITS);
}
export function decodeGateFinding(input: unknown): Outcome<GateFinding, ContractIssue> {
	return decodeContract(CONTRACT, input, findingValue, LIMITS);
}
function findingValue(value: CanonicalValue): GateFinding {
	const record = exactRecord(CONTRACT, value, "$", [...FINDING_FIELDS, "protocol", "findingDigest"]);
	protocolField(CONTRACT, record, "$", GATE_FINDING_PROTOCOL);
	const evidenceDigests = Object.freeze(arrayField(CONTRACT, record, "evidenceDigests", "$", 64).map((entry, index) => {
		const decoded = decodeSha256Digest(entry);
		if (!decoded.ok) rejectContract("invalid_field", CONTRACT, `$.evidenceDigests[${index}]`, decoded.error.message);
		return decoded.value;
	}));
	ordered(evidenceDigests, "$.evidenceDigests");
	const assumptions = Object.freeze(arrayField(CONTRACT, record, "assumptions", "$", 32).map((entry, index) =>
		prose({value: entry}, "value", `$.assumptions[${index}]`)));
	const body = Object.freeze({protocol: GATE_FINDING_PROTOCOL,
		gateDigest: digestField(record, "gateDigest"), checkId: identity(record, "checkId"),
		executionDigest: digestField(record, "executionDigest"), producerId: identity(record, "producerId"),
		status: literalField(CONTRACT, record, "status", ["supported", "contradicted", "unresolved", "unavailable"] as const),
		reason: prose(record, "reason"), evidenceDigests, assumptions});
	const findingDigest = digestField(record, "findingDigest");
	assertDigestMatch(CONTRACT, "$.findingDigest", findingDigest, digest("codewiki.gate-finding@1.0.0", body));
	return Object.freeze({...body, findingDigest});
}

/**
 * Re-admit the entire input. The runtime must rebuild currentGate from current,
 * authorized exact sources and authenticate execution/evidence before calling.
 * Digests bind claims; this reducer cannot certify their truth or grant authority.
 * All selected checks are required in this slice; no waiver/advisory path exists.
 */
export function reduceSemanticGate(input: Readonly<{gate: SemanticGate; currentGate: SemanticGate; findings: readonly GateFinding[]}>): Outcome<SemanticGateOutcome, ContractIssue> {
	return decodeContract(CONTRACT, input, value => {
		const record = exactRecord(CONTRACT, value, "$", ["gate", "currentGate", "findings"]);
		const gate = admitted(decodeSemanticGate(requiredField(CONTRACT, record, "gate")));
		const current = admitted(decodeSemanticGate(requiredField(CONTRACT, record, "currentGate")));
		const findings = arrayField(CONTRACT, record, "findings", "$", 64).map(entry => admitted(decodeGateFinding(entry)));
		const byCheck = new Map<string, GateFinding>();
		for (const finding of findings) {
			const check = gate.checks.find(check => check.checkId === finding.checkId);
			if (byCheck.has(finding.checkId) || !check || finding.gateDigest !== gate.gateDigest || finding.executionDigest !== check.executionDigest) {
				rejectContract("invalid_field", CONTRACT, "$.findings", "Findings must uniquely match the exact Gate and selected execution.");
			}
			byCheck.set(finding.checkId, finding);
		}
		const stops: string[] = [];
		const contradicted: string[] = [];
		if (gate.gateDigest !== current.gateDigest) stops.push("stale_gate");
		if (gate.checks.length === 0) stops.push("empty_checks");
		if (!gate.contextComplete) stops.push("incomplete_context");
		for (const check of gate.checks) {
			const finding = byCheck.get(check.checkId);
			if (!finding) {stops.push(`missing:${check.checkId}`); continue;}
			if (finding.status === "unavailable" || finding.status === "unresolved") stops.push(`${finding.status}:${check.checkId}`);
			if (finding.status === "supported" || finding.status === "contradicted") {
				if (finding.evidenceDigests.length === 0) stops.push(`missing_evidence:${check.checkId}`);
				if (finding.assumptions.length > 0) stops.push(`conditional:${check.checkId}`);
			}
			if (finding.status === "contradicted") contradicted.push(check.checkId);
		}
		const body = Object.freeze({gateDigest: gate.gateDigest, currentGateDigest: current.gateDigest,
			findingDigests: Object.freeze(findings.map(finding => finding.findingDigest).sort()),
			status: stops.length > 0 ? "stopped" as const : contradicted.length > 0 ? "failed" as const : "passed" as const,
			stopReasons: Object.freeze(stops.sort()), contradictedChecks: Object.freeze(contradicted.sort())});
		return Object.freeze({...body, outcomeDigest: digest(OUTCOME_DOMAIN, body)});
	}, REDUCTION_LIMITS);
}
/**
 * Verify a retained outcome against its complete recorded reduction grounds.
 * Replaying does not execute checks or establish present-day freshness, source
 * coverage, evidence provenance or authority. Callers must verify those separately.
 * A self-consistent outcome hash alone is not sufficient for recovery.
 */
export function verifySemanticGateOutcome(input: unknown): Outcome<SemanticGateOutcome, ContractIssue> {
	return decodeContract(CONTRACT, input, value => {
		const record = exactRecord(CONTRACT, value, "$", ["gate", "currentGate", "findings", "outcome"]);
		const gate = admitted(decodeSemanticGate(requiredField(CONTRACT, record, "gate")));
		const currentGate = admitted(decodeSemanticGate(requiredField(CONTRACT, record, "currentGate")));
		const findings = arrayField(CONTRACT, record, "findings", "$", 64).map(entry => admitted(decodeGateFinding(entry)));
		const expected = admitted(reduceSemanticGate({gate, currentGate, findings}));
		const retained = canonicalJson(requiredField(CONTRACT, record, "outcome"), LIMITS);
		const rebuilt = canonicalJson(expected, LIMITS);
		if (!retained.ok || !rebuilt.ok || retained.value !== rebuilt.value) {
			rejectContract("invalid_field", CONTRACT, "$.outcome", "Retained Gate outcome differs from reduction of its recorded grounds.");
		}
		return expected;
	}, {
		...REDUCTION_LIMITS,
		maximumNodes: REDUCTION_LIMITS.maximumNodes + LIMITS.maximumNodes,
		maximumTextBytes: REDUCTION_LIMITS.maximumTextBytes + LIMITS.maximumTextBytes,
	});
}
/** Model proposals are not Gate findings, evidence references or coverage claims. */
export const DECISION_CHECK_OUTPUT_PROTOCOL = protocolIdentity("codewiki.decision-check-output", "1.0.0");
export const DECISION_CHECK_OUTPUT_SCHEMA = Object.freeze({
	protocol: DECISION_CHECK_OUTPUT_PROTOCOL,
	serialization: "canonical-json",
	fields: Object.freeze(["protocol", "status", "reason", "assumptions", "citations"]),
	statuses: Object.freeze(["supported", "contradicted", "unresolved"] as const),
	maximumProseBytes: 4096, maximumAssumptions: 32, maximumCitations: 64,
	maximumPathHexBytes: 8192, maximumSelectedBytes: 256 * 1024,
	citationFields: Object.freeze(["side", "pathUtf8Hex", "sourceDigest", "startByte", "endByte"]),
	citationSides: Object.freeze(["before", "after"] as const),
	coordinateUnit: "utf8-bytes", maximumCoordinate: Number.MAX_SAFE_INTEGER,
	supportRequiresCitation: true, contradictionRequiresCitation: true,
	assumptionsSortedUnique: true, duplicateCitationsAllowed: false,
	limits: LIMITS,
});
export interface DecisionSourceCitation {
	readonly side: "before" | "after";
	readonly pathUtf8Hex: string;
	readonly sourceDigest: Sha256Digest;
	readonly startByte: number;
	readonly endByte: number;
}
export interface DecisionCheckOutput {
	readonly protocol: typeof DECISION_CHECK_OUTPUT_PROTOCOL;
	readonly status: "supported" | "contradicted" | "unresolved";
	readonly reason: string;
	readonly assumptions: readonly string[];
	readonly citations: readonly DecisionSourceCitation[];
}

/** Coordinates only. The backend must resolve every citation against real sources. */
export function decodeDecisionSourceCitations(input: unknown): Outcome<readonly DecisionSourceCitation[], ContractIssue> {
	return decodeContract(CONTRACT, input, value => {
		const entries = arrayField(CONTRACT, {citations: value}, "citations", "$", DECISION_CHECK_OUTPUT_SCHEMA.maximumCitations);
		const seen = new Set<string>();
		let remainingBytes = DECISION_CHECK_OUTPUT_SCHEMA.maximumSelectedBytes;
		return Object.freeze(entries.map((entry, index) => {
			const path = `$.citations[${index}]`;
			const record = exactRecord(CONTRACT, entry, path, DECISION_CHECK_OUTPUT_SCHEMA.citationFields);
			const side = literalField(CONTRACT, record, "side", DECISION_CHECK_OUTPUT_SCHEMA.citationSides, path);
			const pathUtf8Hex = textField(CONTRACT, record, "pathUtf8Hex", path, {maximumBytes: DECISION_CHECK_OUTPUT_SCHEMA.maximumPathHexBytes, pattern: /^(?:[0-9a-f]{2})+$/u});
			const sourceDigest = digestField(record, "sourceDigest", path);
			const startByte = integerField(CONTRACT, record, "startByte", path, 0, DECISION_CHECK_OUTPUT_SCHEMA.maximumCoordinate);
			const endByte = integerField(CONTRACT, record, "endByte", path, 1, DECISION_CHECK_OUTPUT_SCHEMA.maximumCoordinate);
			if (endByte <= startByte || endByte - startByte > remainingBytes) rejectContract("invalid_field", CONTRACT, path, "Citations require nonempty ranges totaling at most 256 KiB.");
			remainingBytes -= endByte - startByte;
			const key = `${side}:${pathUtf8Hex}:${startByte}:${endByte}`;
			if (seen.has(key)) rejectContract("invalid_field", CONTRACT, path, "Duplicate citations are not independent support.");
			seen.add(key);
			return Object.freeze({side, pathUtf8Hex, sourceDigest, startByte, endByte});
		}));
	}, LIMITS);
}

export function decodeDecisionCheckOutput(input: unknown): Outcome<DecisionCheckOutput, ContractIssue> {
	return decodeContract(CONTRACT, input, value => {
		const record = exactRecord(CONTRACT, value, "$", DECISION_CHECK_OUTPUT_SCHEMA.fields);
		protocolField(CONTRACT, record, "$", DECISION_CHECK_OUTPUT_PROTOCOL);
		const status = literalField(CONTRACT, record, "status", DECISION_CHECK_OUTPUT_SCHEMA.statuses);
		const citations = admitted(decodeDecisionSourceCitations(requiredField(CONTRACT, record, "citations")));
		if (status !== "unresolved" && citations.length === 0) rejectContract("invalid_field", CONTRACT, "$.citations", "Supported and contradicted proposals require source citations.");
		const assumptions = Object.freeze(arrayField(CONTRACT, record, "assumptions", "$", DECISION_CHECK_OUTPUT_SCHEMA.maximumAssumptions).map((entry, index) => prose({value: entry}, "value", `$.assumptions[${index}]`)));
		ordered(assumptions, "$.assumptions");
		return Object.freeze({protocol: DECISION_CHECK_OUTPUT_PROTOCOL, status, reason: prose(record, "reason"), assumptions, citations});
	}, LIMITS);
}

/** Strict canonical JSON rejects duplicate keys and ambiguous serialization. */
export function parseDecisionCheckOutput(input: unknown): Outcome<DecisionCheckOutput, ContractIssue> {
	return decodeContract(CONTRACT, input, value => {
		if (typeof value !== "string") rejectContract("invalid_field", CONTRACT, "$", "Check output must be canonical JSON text.");
		const parsed = parseCanonicalJson(value, {limits: LIMITS, requireCanonicalBytes: true});
		if (!parsed.ok) rejectContract("invalid_field", CONTRACT, "$", parsed.error.message);
		return admitted(decodeDecisionCheckOutput(parsed.value));
	}, LIMITS);
}

function admitted<T>(result: Outcome<T, ContractIssue>): T {
	if (!result.ok) rejectContract(result.error.code, CONTRACT, result.error.path, result.error.message);
	return result.value;
}
function digest(domain: string, value: unknown): Sha256Digest {
	const result = semanticDigest(domain, value);
	if (!result.ok) rejectContract("invalid_field", CONTRACT, "$", result.error.message);
	return result.value;
}
function digestField(record: CanonicalRecord, field: string, path = "$"): Sha256Digest {
	const result = decodeSha256Digest(requiredField(CONTRACT, record, field, path));
	if (!result.ok) rejectContract("invalid_field", CONTRACT, `${path}.${field}`, result.error.message);
	return result.value;
}
function identity(record: CanonicalRecord, field: string, path = "$"): string {
	const value = textField(CONTRACT, record, field, path, {maximumBytes: 256});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", CONTRACT, `${path}.${field}`, "Expected a namespaced identity.");
	return value;
}
function prose(record: CanonicalRecord, field: string, path = "$"): string {
	const value = textField(CONTRACT, record, field, path, {maximumBytes: 4096});
	if (value.trim().length === 0 || /[\uD800-\uDFFF]/u.test(value)) rejectContract("invalid_field", CONTRACT, `${path}.${field}`, "Expected nonblank Unicode prose.");
	return value;
}
function ordered(values: readonly string[], path: string): void {
	for (let index = 1; index < values.length; index++) {
		if (values[index - 1]! >= values[index]!) rejectContract("non_canonical_order", CONTRACT, path, "Entries must be sorted and unique.");
	}
}
