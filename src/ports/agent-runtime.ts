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
	sortedUniqueTextArray,
	textField,
	type CanonicalRecord,
	type ContractIssue,
} from "../kernel/data-contracts/validation.ts";
import type {CanonicalValue} from "../kernel/data-contracts/canonical-json.ts";
import {failure, type Outcome} from "../kernel/data-contracts/outcome.ts";
import {decodeGitOidValue, sameGitOid, type GitOid} from "../kernel/identity/git.ts";
import {semanticDigest, semanticId, type SemanticIdentityIssue} from "../kernel/identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../kernel/identity/sha256.ts";

export const AGENT_RUNTIME_PORT_PROTOCOL = Object.freeze({
	id: "codewiki.port.agent-runtime",
	version: "1.1.0",
} as const);
export const AGENT_RUN_AUTHORIZATION_PROTOCOL = protocolIdentity("codewiki.agent-run-authorization", "1.0.0");
export const AGENT_RUN_RECEIPT_PROTOCOL = protocolIdentity("codewiki.agent-run-receipt", "1.0.0");
export const AGENT_RUN_QUIESCENCE_PROTOCOL = protocolIdentity("codewiki.agent-run-quiescence", "1.0.0");
export const AGENT_RUN_ROLES = ["decision", "model-check", "planning", "review", "worker"] as const;
export const AGENT_RUN_STAGES = ["decision", "implementation", "planning", "review"] as const;
export const AGENT_RUN_OUTCOMES = ["cancelled", "completed", "failed", "stopped"] as const;
export const AGENT_RUN_OPERATIONAL_STATUSES = ["accepted", "cancelling", "running", "terminal"] as const;

export type AgentRunRole = (typeof AGENT_RUN_ROLES)[number];
export type AgentRunStage = (typeof AGENT_RUN_STAGES)[number];
export type AgentRunOutcome = (typeof AGENT_RUN_OUTCOMES)[number];
export type AgentRunOperationalStatus = (typeof AGENT_RUN_OPERATIONAL_STATUSES)[number];

export interface AgentRunSubject {
	readonly subjectId: string;
	readonly subjectDigest: Sha256Digest;
	readonly repositoryId: string;
	readonly projectCommit: GitOid;
	readonly projectTree: GitOid;
	readonly changeId: string;
	readonly changeTip: GitOid;
	readonly workId: string | null;
	readonly artifactCommit: GitOid | null;
	readonly artifactTree: GitOid | null;
}

export interface AgentRunRoute {
	readonly routeId: string;
	readonly providerId: string;
	readonly modelId: string;
	readonly routeDigest: Sha256Digest;
}

export interface AgentRunContext {
	readonly wikiCommit: GitOid;
	readonly itemIds: readonly string[];
	readonly contextDigest: Sha256Digest;
	readonly queryPolicyDigest: Sha256Digest;
	readonly feedbackDigest: Sha256Digest | null;
}

export interface AgentRunBudget {
	readonly timeoutMs: number;
	readonly maximumModelRequests: number;
	readonly maximumToolCalls: number;
	readonly maximumInputTokens: number;
	readonly maximumOutputTokens: number;
	readonly maximumOutputBytes: number;
}

export interface AgentRunPredecessor {
	readonly runId: string;
	readonly authorizationDigest: Sha256Digest;
	readonly receiptDigest: Sha256Digest | null;
	readonly quiescenceDigest: Sha256Digest;
	readonly outcome: AgentRunOutcome | null;
}

export interface AgentRunAuthorizationBody {
	readonly protocol: typeof AGENT_RUN_AUTHORIZATION_PROTOCOL;
	readonly runId: string;
	readonly attempt: number;
	readonly role: AgentRunRole;
	readonly stage: AgentRunStage;
	readonly actorId: string;
	readonly authorityDigest: Sha256Digest;
	readonly subject: AgentRunSubject;
	readonly route: AgentRunRoute;
	readonly context: AgentRunContext;
	readonly toolIds: readonly string[];
	readonly toolSetDigest: Sha256Digest;
	readonly capabilities: readonly string[];
	readonly writableScope: readonly string[];
	readonly previewSubjectDigest: Sha256Digest | null;
	readonly budget: AgentRunBudget;
	readonly outputSchemaDigest: Sha256Digest;
	readonly policyDigest: Sha256Digest;
	readonly issuedAt: string;
	readonly deadlineAt: string;
	readonly predecessor: AgentRunPredecessor | null;
}

export interface AgentRunAuthorization extends AgentRunAuthorizationBody {
	readonly authorizationDigest: Sha256Digest;
}

export interface AgentRunCustodyClosure {
	readonly processTreeTerminated: boolean;
	readonly providerRequestsClosed: boolean;
	readonly previewClosed: boolean;
	readonly temporaryStateClosed: boolean;
	readonly quiescenceDigest: Sha256Digest;
}

export interface AgentRunReceiptBody {
	readonly protocol: typeof AGENT_RUN_RECEIPT_PROTOCOL;
	readonly runId: string;
	readonly authorizationDigest: Sha256Digest;
	readonly outcome: AgentRunOutcome;
	readonly startedAt: string;
	readonly finishedAt: string;
	readonly outputDigest: Sha256Digest | null;
	readonly usageDigest: Sha256Digest | null;
	readonly providerReceiptDigest: Sha256Digest | null;
	readonly sessionReceiptDigest: Sha256Digest;
	readonly queryReceiptDigests: readonly string[];
	readonly cancellationDigest: Sha256Digest | null;
	readonly custody: AgentRunCustodyClosure;
	readonly operationalGaps: readonly string[];
}

export interface AgentRunReceipt extends AgentRunReceiptBody {
	readonly receiptDigest: Sha256Digest;
}

export interface AgentRunQuiescenceBody {
	readonly protocol: typeof AGENT_RUN_QUIESCENCE_PROTOCOL;
	readonly runId: string;
	readonly authorizationDigest: Sha256Digest;
	readonly observedAt: string;
	readonly processTreeTerminated: true;
	readonly providerRequestsClosed: true;
	readonly previewClosed: true;
	readonly temporaryStateClosed: true;
}

export interface AgentRunQuiescence extends AgentRunQuiescenceBody {
	readonly quiescenceDigest: Sha256Digest;
}

export interface AgentRunMaterial {
	readonly systemPrompt: string;
	readonly prompt: string;
}

export interface AgentRunStartRequest {
	readonly requestDigest: Sha256Digest;
	readonly authorization: AgentRunAuthorization;
	readonly material: AgentRunMaterial;
}

export interface AgentRunInspectRequest {
	readonly requestDigest: Sha256Digest;
	readonly runId: string;
	readonly authorizationDigest: Sha256Digest;
}

export interface AgentRunCancellationRequest extends AgentRunInspectRequest {
	readonly reason: "deadline" | "operator" | "policy" | "shutdown" | "superseded";
	readonly requestedAt: string;
}

export interface AgentRunHandle {
	readonly runId: string;
	readonly authorizationDigest: Sha256Digest;
	readonly status: AgentRunOperationalStatus;
	readonly receipt: AgentRunReceipt | null;
	readonly quiescence: AgentRunQuiescence | null;
}

export interface AgentRuntimeIssue {
	readonly code:
		| "authorization_conflict"
		| "environment_unavailable"
		| "invalid_receipt"
		| "invalid_request"
		| "not_found"
		| "quiescence_unproven"
		| "stale_authorization"
		| "transport_lost";
	readonly message: string;
}

/** Host-neutral Run boundary. Pi owns Sessions, model/tool loops, provider mechanics, and compaction. */
export interface AgentRuntimePort {
	readonly protocol: typeof AGENT_RUNTIME_PORT_PROTOCOL;
	start(request: AgentRunStartRequest): Promise<Outcome<AgentRunHandle, AgentRuntimeIssue>>;
	inspect(request: AgentRunInspectRequest): Promise<Outcome<AgentRunHandle, AgentRuntimeIssue>>;
	cancel(request: AgentRunCancellationRequest): Promise<Outcome<AgentRunHandle, AgentRuntimeIssue>>;
}

export function createAgentRunAuthorization(
	body: Omit<AgentRunAuthorizationBody, "protocol" | "runId">,
): Outcome<AgentRunAuthorization, ContractIssue | SemanticIdentityIssue> {
	const runId = semanticId("cw:run", protocolLabel(AGENT_RUN_AUTHORIZATION_PROTOCOL), body);
	if (!runId.ok) return failure(runId.error);
	const value = {...body, protocol: AGENT_RUN_AUTHORIZATION_PROTOCOL, runId: runId.value};
	const digest = semanticDigest(protocolLabel(AGENT_RUN_AUTHORIZATION_PROTOCOL), value);
	if (!digest.ok) return failure(digest.error);
	return decodeAgentRunAuthorization({...value, authorizationDigest: digest.value});
}

export function decodeAgentRunAuthorization(input: unknown): Outcome<AgentRunAuthorization, ContractIssue> {
	return decodeContract("Agent Run authorization", input, (value) => decodeAgentRunAuthorizationValue(value));
}

export function createAgentRunReceipt(
	body: Omit<AgentRunReceiptBody, "protocol">,
): Outcome<AgentRunReceipt, ContractIssue | SemanticIdentityIssue> {
	const value = {...body, protocol: AGENT_RUN_RECEIPT_PROTOCOL};
	const digest = semanticDigest(protocolLabel(AGENT_RUN_RECEIPT_PROTOCOL), value);
	if (!digest.ok) return failure(digest.error);
	return decodeAgentRunReceipt({...value, receiptDigest: digest.value});
}

export function decodeAgentRunReceipt(input: unknown): Outcome<AgentRunReceipt, ContractIssue> {
	return decodeContract("Agent Run receipt", input, (value) => decodeAgentRunReceiptValue(value));
}

export function createAgentRunQuiescence(
	body: Omit<AgentRunQuiescenceBody, "protocol">,
): Outcome<AgentRunQuiescence, ContractIssue | SemanticIdentityIssue> {
	const value = {...body, protocol: AGENT_RUN_QUIESCENCE_PROTOCOL};
	const digest = semanticDigest(protocolLabel(AGENT_RUN_QUIESCENCE_PROTOCOL), value);
	if (!digest.ok) return failure(digest.error);
	return decodeAgentRunQuiescence({...value, quiescenceDigest: digest.value});
}

export function decodeAgentRunQuiescence(input: unknown): Outcome<AgentRunQuiescence, ContractIssue> {
	return decodeContract("Agent Run quiescence", input, (value) => decodeAgentRunQuiescenceValue(value));
}

export function agentRunStartRequestDigest(request: AgentRunStartRequest): Outcome<Sha256Digest, SemanticIdentityIssue> {
	return semanticDigest("codewiki.agent-run.start@1.0.0", {authorization: request.authorization, material: request.material});
}

export function agentRunContextMaterialDigest(
	material: AgentRunMaterial,
	itemIds: readonly string[],
): Outcome<Sha256Digest, SemanticIdentityIssue> {
	return semanticDigest("codewiki.agent-context-material@1.0.0", {
		systemPrompt: material.systemPrompt,
		prompt: material.prompt,
		itemIds: [...itemIds].sort(compareText),
	});
}

export function agentRunInspectRequestDigest(request: AgentRunInspectRequest): Outcome<Sha256Digest, SemanticIdentityIssue> {
	return semanticDigest("codewiki.agent-run.inspect@1.0.0", {
		runId: request.runId,
		authorizationDigest: request.authorizationDigest,
	});
}

export function agentRunCancellationRequestDigest(request: AgentRunCancellationRequest): Outcome<Sha256Digest, SemanticIdentityIssue> {
	return semanticDigest("codewiki.agent-run.cancel@1.0.0", {
		runId: request.runId,
		authorizationDigest: request.authorizationDigest,
		reason: request.reason,
		requestedAt: request.requestedAt,
	});
}

export function agentRunReceiptClosesAuthorization(authorization: AgentRunAuthorization, receipt: AgentRunReceipt): boolean {
	const decodedAuthorization = decodeAgentRunAuthorization(authorization);
	const decodedReceipt = decodeAgentRunReceipt(receipt);
	return decodedAuthorization.ok && decodedReceipt.ok &&
		decodedReceipt.value.runId === decodedAuthorization.value.runId &&
		decodedReceipt.value.authorizationDigest === decodedAuthorization.value.authorizationDigest &&
		custodyIsClosed(decodedReceipt.value.custody) &&
		decodedReceipt.value.operationalGaps.length === 0;
}

function decodeAgentRunAuthorizationValue(value: CanonicalValue): AgentRunAuthorization {
	const record = exactRecord("Agent Run authorization", value, "$", [
		"actorId", "attempt", "authorizationDigest", "authorityDigest", "budget", "capabilities", "context", "deadlineAt", "issuedAt",
		"outputSchemaDigest", "policyDigest", "predecessor", "previewSubjectDigest", "protocol", "role", "route", "runId", "stage", "subject",
		"toolIds", "toolSetDigest", "writableScope",
	]);
	protocolField("Agent Run authorization", record, "$", AGENT_RUN_AUTHORIZATION_PROTOCOL);
	const attempt = integerField("Agent Run authorization", record, "attempt", "$", 1, 1_000);
	const role = literalField("Agent Run authorization", record, "role", AGENT_RUN_ROLES);
	const stage = literalField("Agent Run authorization", record, "stage", AGENT_RUN_STAGES);
	if (!roleMatchesStage(role, stage)) rejectContract("invalid_field", "Agent Run authorization", "$.role", "Agent role does not match lifecycle stage.");
	const subject = decodeRunSubject(requiredField("Agent Run authorization", record, "subject"), "$.subject");
	const route = decodeRunRoute(requiredField("Agent Run authorization", record, "route"), "$.route");
	const context = decodeRunContext(requiredField("Agent Run authorization", record, "context"), "$.context", subject);
	if (role === "worker" && subject.workId === null) rejectContract("missing_field", "Agent Run authorization", "$.subject.workId", "Worker Run requires exact Work identity.");
	if (role !== "worker" && role !== "model-check" && subject.workId !== null) rejectContract("invalid_field", "Agent Run authorization", "$.subject.workId", "Only Worker or Model Check Run may bind Work identity.");
	const capabilities = namespacedArray(record, "capabilities", 128);
	const toolIds = namespacedArray(record, "toolIds", 128);
	const toolSetDigest = digestField("Agent Run authorization", record, "toolSetDigest", "$");
	assertSemanticDigest("Agent Run authorization", "$.toolSetDigest", "codewiki.agent-tool-set@1.0.0", {toolIds}, toolSetDigest);
	const writableScope = sortedUniqueTextArray("Agent Run authorization", requiredField("Agent Run authorization", record, "writableScope"), "$.writableScope", {
		maximumEntries: 1_024,
		maximumBytes: 512,
	});
	if (writableScope.some((entry) => !isPortableScope(entry))) rejectContract("invalid_field", "Agent Run authorization", "$.writableScope", "Writable scope is not portable.");
	if (role !== "worker" && writableScope.length > 0) rejectContract("invalid_field", "Agent Run authorization", "$.writableScope", "Only Worker Runs may receive writable scope.");
	const previewSubjectDigest = nullableDigest(requiredField("Agent Run authorization", record, "previewSubjectDigest"), "$.previewSubjectDigest");
	if (previewSubjectDigest !== null && (role !== "worker" || !capabilities.includes("codewiki.capability:preview.work"))) {
		rejectContract("invalid_field", "Agent Run authorization", "$.previewSubjectDigest", "Preview requires Worker role and preview.work capability.");
	}
	const issuedAt = timestampField("Agent Run authorization", record, "issuedAt");
	const deadlineAt = timestampField("Agent Run authorization", record, "deadlineAt");
	if (Date.parse(deadlineAt) <= Date.parse(issuedAt)) rejectContract("invalid_field", "Agent Run authorization", "$.deadlineAt", "Run deadline must follow issuance.");
	const predecessor = nullableValue(requiredField("Agent Run authorization", record, "predecessor"), (entry) => decodePredecessor(entry, "$.predecessor"));
	if ((attempt === 1) !== (predecessor === null)) rejectContract("invalid_field", "Agent Run authorization", "$.predecessor", "Only successor attempts require one closed predecessor.");
	const result = Object.freeze({
		protocol: AGENT_RUN_AUTHORIZATION_PROTOCOL,
		runId: namespacedField("Agent Run authorization", record, "runId", "$"),
		attempt,
		role,
		stage,
		actorId: namespacedField("Agent Run authorization", record, "actorId", "$"),
		authorityDigest: digestField("Agent Run authorization", record, "authorityDigest", "$"),
		subject,
		route,
		context,
		toolIds: Object.freeze(toolIds),
		toolSetDigest,
		capabilities: Object.freeze(capabilities),
		writableScope: Object.freeze(writableScope),
		previewSubjectDigest,
		budget: decodeBudget(requiredField("Agent Run authorization", record, "budget"), "$.budget"),
		outputSchemaDigest: digestField("Agent Run authorization", record, "outputSchemaDigest", "$"),
		policyDigest: digestField("Agent Run authorization", record, "policyDigest", "$"),
		issuedAt,
		deadlineAt,
		predecessor,
		authorizationDigest: digestField("Agent Run authorization", record, "authorizationDigest", "$"),
	});
	const {authorizationDigest, ...withId} = result;
	const {runId, protocol: ignoredProtocol, ...identityBody} = withId;
	void ignoredProtocol;
	const expectedId = semanticId("cw:run", protocolLabel(AGENT_RUN_AUTHORIZATION_PROTOCOL), identityBody);
	if (!expectedId.ok || expectedId.value !== runId) rejectContract("invalid_field", "Agent Run authorization", "$.runId", "Run identity mismatch.");
	assertBodyDigest("Agent Run authorization", "$.authorizationDigest", AGENT_RUN_AUTHORIZATION_PROTOCOL, withId, authorizationDigest);
	return result;
}

function decodeAgentRunReceiptValue(value: CanonicalValue): AgentRunReceipt {
	const record = exactRecord("Agent Run receipt", value, "$", [
		"authorizationDigest", "cancellationDigest", "custody", "finishedAt", "operationalGaps", "outcome", "outputDigest", "protocol",
		"providerReceiptDigest", "queryReceiptDigests", "receiptDigest", "runId", "sessionReceiptDigest", "startedAt", "usageDigest",
	]);
	protocolField("Agent Run receipt", record, "$", AGENT_RUN_RECEIPT_PROTOCOL);
	const startedAt = timestampField("Agent Run receipt", record, "startedAt");
	const finishedAt = timestampField("Agent Run receipt", record, "finishedAt");
	if (Date.parse(finishedAt) < Date.parse(startedAt)) rejectContract("invalid_field", "Agent Run receipt", "$.finishedAt", "Run finish cannot precede start.");
	const outcome = literalField("Agent Run receipt", record, "outcome", AGENT_RUN_OUTCOMES);
	const outputDigest = nullableDigest(requiredField("Agent Run receipt", record, "outputDigest"), "$.outputDigest");
	if ((outcome === "completed") !== (outputDigest !== null)) rejectContract("invalid_field", "Agent Run receipt", "$.outputDigest", "Only completed Runs require output.");
	const result = Object.freeze({
		protocol: AGENT_RUN_RECEIPT_PROTOCOL,
		runId: namespacedField("Agent Run receipt", record, "runId", "$"),
		authorizationDigest: digestField("Agent Run receipt", record, "authorizationDigest", "$"),
		outcome,
		startedAt,
		finishedAt,
		outputDigest,
		usageDigest: nullableDigest(requiredField("Agent Run receipt", record, "usageDigest"), "$.usageDigest"),
		providerReceiptDigest: nullableDigest(requiredField("Agent Run receipt", record, "providerReceiptDigest"), "$.providerReceiptDigest"),
		sessionReceiptDigest: digestField("Agent Run receipt", record, "sessionReceiptDigest", "$"),
		queryReceiptDigests: Object.freeze(digestArray(record, "queryReceiptDigests", 4_096)),
		cancellationDigest: nullableDigest(requiredField("Agent Run receipt", record, "cancellationDigest"), "$.cancellationDigest"),
		custody: decodeCustody(requiredField("Agent Run receipt", record, "custody"), "$.custody"),
		operationalGaps: Object.freeze(namespacedArray(record, "operationalGaps", 128)),
		receiptDigest: digestField("Agent Run receipt", record, "receiptDigest", "$"),
	});
	if (result.outcome === "completed" && (!custodyIsClosed(result.custody) || result.operationalGaps.length > 0)) {
		rejectContract("invalid_field", "Agent Run receipt", "$.custody", "Completed Run requires closed custody without operational gaps.");
	}
	const {receiptDigest, ...body} = result;
	assertBodyDigest("Agent Run receipt", "$.receiptDigest", AGENT_RUN_RECEIPT_PROTOCOL, body, receiptDigest);
	return result;
}

function decodeAgentRunQuiescenceValue(value: CanonicalValue): AgentRunQuiescence {
	const record = exactRecord("Agent Run quiescence", value, "$", [
		"authorizationDigest", "observedAt", "previewClosed", "processTreeTerminated", "protocol", "providerRequestsClosed", "quiescenceDigest", "runId", "temporaryStateClosed",
	]);
	protocolField("Agent Run quiescence", record, "$", AGENT_RUN_QUIESCENCE_PROTOCOL);
	const result = Object.freeze({
		protocol: AGENT_RUN_QUIESCENCE_PROTOCOL,
		runId: namespacedField("Agent Run quiescence", record, "runId", "$"),
		authorizationDigest: digestField("Agent Run quiescence", record, "authorizationDigest", "$"),
		observedAt: timestampField("Agent Run quiescence", record, "observedAt"),
		processTreeTerminated: requiredTrue(record, "processTreeTerminated", "Agent Run quiescence"),
		providerRequestsClosed: requiredTrue(record, "providerRequestsClosed", "Agent Run quiescence"),
		previewClosed: requiredTrue(record, "previewClosed", "Agent Run quiescence"),
		temporaryStateClosed: requiredTrue(record, "temporaryStateClosed", "Agent Run quiescence"),
		quiescenceDigest: digestField("Agent Run quiescence", record, "quiescenceDigest", "$"),
	});
	const {quiescenceDigest, ...body} = result;
	assertBodyDigest("Agent Run quiescence", "$.quiescenceDigest", AGENT_RUN_QUIESCENCE_PROTOCOL, body, quiescenceDigest);
	return result;
}

function decodeRunSubject(value: CanonicalValue, path: string): AgentRunSubject {
	const record = exactRecord("Agent Run subject", value, path, [
		"artifactCommit", "artifactTree", "changeId", "changeTip", "projectCommit", "projectTree", "repositoryId", "subjectDigest", "subjectId", "workId",
	]);
	const projectCommit = decodeGitOidValue(requiredField("Agent Run subject", record, "projectCommit", path), `${path}.projectCommit`);
	const projectTree = decodeGitOidValue(requiredField("Agent Run subject", record, "projectTree", path), `${path}.projectTree`);
	const changeTip = decodeGitOidValue(requiredField("Agent Run subject", record, "changeTip", path), `${path}.changeTip`);
	const artifactCommit = nullableOid(record, "artifactCommit", path);
	const artifactTree = nullableOid(record, "artifactTree", path);
	if ((artifactCommit === null) !== (artifactTree === null)) rejectContract("invalid_field", "Agent Run subject", path, "Artifact commit/tree must both be present or absent.");
	for (const oid of [projectTree, changeTip, artifactCommit, artifactTree]) {
		if (oid !== null && oid.algorithm !== projectCommit.algorithm) rejectContract("invalid_field", "Agent Run subject", path, "Run subject OIDs must use one algorithm.");
	}
	return Object.freeze({
		subjectId: namespacedField("Agent Run subject", record, "subjectId", path),
		subjectDigest: digestField("Agent Run subject", record, "subjectDigest", path),
		repositoryId: namespacedField("Agent Run subject", record, "repositoryId", path),
		projectCommit,
		projectTree,
		changeId: textField("Agent Run subject", record, "changeId", path, {maximumBytes: 200, pattern: /^CHG-[A-Za-z0-9][A-Za-z0-9._-]*$/u}),
		changeTip,
		workId: nullableNamespaced(requiredField("Agent Run subject", record, "workId", path), `${path}.workId`),
		artifactCommit,
		artifactTree,
	});
}

function decodeRunRoute(value: CanonicalValue, path: string): AgentRunRoute {
	const record = exactRecord("Agent Run route", value, path, ["modelId", "providerId", "routeDigest", "routeId"]);
	const body = Object.freeze({
		routeId: namespacedField("Agent Run route", record, "routeId", path),
		providerId: namespacedField("Agent Run route", record, "providerId", path),
		modelId: namespacedField("Agent Run route", record, "modelId", path),
	});
	const routeDigest = digestField("Agent Run route", record, "routeDigest", path);
	assertSemanticDigest("Agent Run route", `${path}.routeDigest`, "codewiki.agent-route@1.0.0", body, routeDigest);
	return Object.freeze({...body, routeDigest});
}

function decodeRunContext(value: CanonicalValue, path: string, subject: AgentRunSubject): AgentRunContext {
	const record = exactRecord("Agent Run context", value, path, ["contextDigest", "feedbackDigest", "itemIds", "queryPolicyDigest", "wikiCommit"]);
	const wikiCommit = decodeGitOidValue(requiredField("Agent Run context", record, "wikiCommit", path), `${path}.wikiCommit`);
	if (wikiCommit.algorithm !== subject.projectCommit.algorithm || ![subject.projectCommit, subject.changeTip, subject.artifactCommit].some((oid) => oid !== null && sameGitOid(wikiCommit, oid))) {
		rejectContract("invalid_field", "Agent Run context", `${path}.wikiCommit`, "Wiki context must bind one exact authorized subject commit.");
	}
	return Object.freeze({
		wikiCommit,
		itemIds: Object.freeze(namespacedArray(record, "itemIds", 4_096, "Agent Run context", path)),
		contextDigest: digestField("Agent Run context", record, "contextDigest", path),
		queryPolicyDigest: digestField("Agent Run context", record, "queryPolicyDigest", path),
		feedbackDigest: nullableDigest(requiredField("Agent Run context", record, "feedbackDigest", path), `${path}.feedbackDigest`),
	});
}

function decodeBudget(value: CanonicalValue, path: string): AgentRunBudget {
	const record = exactRecord("Agent Run budget", value, path, [
		"maximumInputTokens", "maximumModelRequests", "maximumOutputBytes", "maximumOutputTokens", "maximumToolCalls", "timeoutMs",
	]);
	return Object.freeze({
		timeoutMs: integerField("Agent Run budget", record, "timeoutMs", path, 1_000, 86_400_000),
		maximumModelRequests: integerField("Agent Run budget", record, "maximumModelRequests", path, 1, 1_000),
		maximumToolCalls: integerField("Agent Run budget", record, "maximumToolCalls", path, 0, 100_000),
		maximumInputTokens: integerField("Agent Run budget", record, "maximumInputTokens", path, 1, 10_000_000),
		maximumOutputTokens: integerField("Agent Run budget", record, "maximumOutputTokens", path, 1, 1_000_000),
		maximumOutputBytes: integerField("Agent Run budget", record, "maximumOutputBytes", path, 1, 64 * 1_024 * 1_024),
	});
}

function decodePredecessor(value: CanonicalValue, path: string): AgentRunPredecessor {
	const record = exactRecord("Agent Run predecessor", value, path, ["authorizationDigest", "outcome", "quiescenceDigest", "receiptDigest", "runId"]);
	const receiptDigest = nullableDigest(requiredField("Agent Run predecessor", record, "receiptDigest", path), `${path}.receiptDigest`);
	const outcome = nullableValue(requiredField("Agent Run predecessor", record, "outcome", path), (entry) => literalField("Agent Run predecessor", {outcome: entry}, "outcome", AGENT_RUN_OUTCOMES, path));
	if ((receiptDigest === null) !== (outcome === null)) rejectContract("invalid_field", "Agent Run predecessor", path, "Predecessor receipt and outcome must appear together.");
	return Object.freeze({
		runId: namespacedField("Agent Run predecessor", record, "runId", path),
		authorizationDigest: digestField("Agent Run predecessor", record, "authorizationDigest", path),
		receiptDigest,
		quiescenceDigest: digestField("Agent Run predecessor", record, "quiescenceDigest", path),
		outcome,
	});
}

function decodeCustody(value: CanonicalValue, path: string): AgentRunCustodyClosure {
	const record = exactRecord("Agent Run custody", value, path, ["previewClosed", "processTreeTerminated", "providerRequestsClosed", "quiescenceDigest", "temporaryStateClosed"]);
	return Object.freeze({
		processTreeTerminated: booleanField("Agent Run custody", record, "processTreeTerminated", path),
		providerRequestsClosed: booleanField("Agent Run custody", record, "providerRequestsClosed", path),
		previewClosed: booleanField("Agent Run custody", record, "previewClosed", path),
		temporaryStateClosed: booleanField("Agent Run custody", record, "temporaryStateClosed", path),
		quiescenceDigest: digestField("Agent Run custody", record, "quiescenceDigest", path),
	});
}

function namespacedArray(record: CanonicalRecord, field: string, maximum: number, contract = "Agent Run authorization", path = "$"): readonly string[] {
	const values = sortedUniqueTextArray(contract, requiredField(contract, record, field, path), `${path}.${field}`, {maximumEntries: maximum, maximumBytes: 256});
	if (values.some((entry) => !isNamespacedIdentifier(entry))) rejectContract("invalid_field", contract, `${path}.${field}`, "Values must be namespaced identities.");
	return values;
}

function digestArray(record: CanonicalRecord, field: string, maximum: number): readonly Sha256Digest[] {
	const entries = arrayField("Agent Run receipt", record, field, "$", maximum);
	const values = entries.map((entry, index) => {
		const decoded = decodeSha256Digest(entry);
		if (!decoded.ok) rejectContract("invalid_field", "Agent Run receipt", `$.${field}[${index}]`, decoded.error.message);
		return decoded.value;
	});
	for (let index = 1; index < values.length; index += 1) {
		if ((values[index - 1] ?? "") >= (values[index] ?? "")) rejectContract("non_canonical_order", "Agent Run receipt", `$.${field}`, "Digests must be strictly sorted and unique.");
	}
	return values;
}

function digestField(contract: string, record: CanonicalRecord, field: string, path: string): Sha256Digest {
	const decoded = decodeSha256Digest(record[field]);
	if (!decoded.ok) rejectContract("invalid_field", contract, `${path}.${field}`, decoded.error.message);
	return decoded.value;
}

function nullableDigest(value: CanonicalValue, path: string): Sha256Digest | null {
	return nullableValue(value, (entry) => {
		const decoded = decodeSha256Digest(entry);
		if (!decoded.ok) rejectContract("invalid_field", "Agent Run", path, decoded.error.message);
		return decoded.value;
	});
}

function nullableOid(record: CanonicalRecord, field: string, path: string): GitOid | null {
	return nullableValue(requiredField("Agent Run subject", record, field, path), (entry) => decodeGitOidValue(entry, `${path}.${field}`));
}

function nullableNamespaced(value: CanonicalValue, path: string): string | null {
	return nullableValue(value, (entry) => {
		if (typeof entry !== "string" || !isNamespacedIdentifier(entry)) rejectContract("invalid_field", "Agent Run", path, "Value must be a namespaced identity or null.");
		return entry;
	});
}

function namespacedField(contract: string, record: CanonicalRecord, field: string, path: string): string {
	const value = textField(contract, record, field, path, {maximumBytes: 256});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", contract, `${path}.${field}`, "Value must be a namespaced identity.");
	return value;
}

function timestampField(contract: string, record: CanonicalRecord, field: string): string {
	const value = textField(contract, record, field, "$", {maximumBytes: 32});
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) || new Date(value).toISOString() !== value) {
		rejectContract("invalid_field", contract, `$.${field}`, "Timestamp must be canonical UTC text.");
	}
	return value;
}

function requiredTrue(record: CanonicalRecord, field: string, contract: string): true {
	if (!booleanField(contract, record, field) ) rejectContract("invalid_field", contract, `$.${field}`, "Quiescence closure must be true.");
	return true;
}

function roleMatchesStage(role: AgentRunRole, stage: AgentRunStage): boolean {
	if (role === "model-check") return true;
	if (role === "worker") return stage === "implementation";
	return role === stage;
}

function custodyIsClosed(custody: AgentRunCustodyClosure): boolean {
	return custody.processTreeTerminated && custody.providerRequestsClosed && custody.previewClosed && custody.temporaryStateClosed;
}

function isPortableScope(value: string): boolean {
	if (value.length === 0 || value.length > 512 || value.normalize("NFC") !== value || value.startsWith("/") || value.includes("\\") || value.includes("\0")) return false;
	const segments = value.split("/");
	return segments[0] !== ".changekernel" && segments[0] !== ".codewiki" && segments[0] !== ".git" && segments[0] !== "check-packs" &&
		segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function assertBodyDigest(contract: string, path: string, protocol: Readonly<{id: string; version: string}>, body: unknown, actual: Sha256Digest): void {
	assertSemanticDigest(contract, path, protocolLabel(protocol), body, actual);
}

function assertSemanticDigest(contract: string, path: string, protocol: string, body: unknown, actual: Sha256Digest): void {
	const expected = semanticDigest(protocol, body);
	if (!expected.ok) rejectContract("invalid_field", contract, path, expected.error.message);
	assertDigestMatch(contract, path, actual, expected.value);
}

function protocolLabel(protocol: Readonly<{id: string; version: string}>): string {
	return `${protocol.id}@${protocol.version}`;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
