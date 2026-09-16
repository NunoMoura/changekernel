import {productError, type ProductError} from "../../api/transport/envelope.ts";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import {decodeContract, exactRecord, rejectContract, requiredField, textField} from "../../kernel/data-contracts/validation.ts";
import {sameGitOid} from "../../kernel/identity/git.ts";
import {decodeSha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {semanticDigest} from "../../kernel/identity/semantic-digest.ts";
import {createSemanticGate, createGateFinding, reduceSemanticGate, type DecisionCheckOutput, type SemanticGate, type GateFinding, type SemanticGateOutcome} from "../../kernel/gates/semantic.ts";
import type {CanonicalValue} from "../../kernel/data-contracts/canonical-json.ts";
import {decodeAgentRunOutputBinding, type AgentRunOutput, type AgentRunOutputPort} from "../../ports/agent-output.ts";
import {agentRunContextMaterialDigest, type AgentRunMaterial, type AgentRuntimeIssue} from "../../ports/agent-runtime.ts";
import type {ProjectStorePort} from "../../ports/project-store.ts";
import {profileScopeGuard, type AuthorizedProjectActor} from "../authorization/policy.ts";
import {loadProfileDecisionGrounds, readProfileDecisionSourceSlices, type ProfileDecisionSourceSlice} from "../queries/profile-change.ts";
import type {ProjectReadConfiguration} from "../queries/source.ts";
import {matchesDecisionModelCheckExecution} from "./agent-runs.ts";
import {readDecisionModelCheckOutput} from "./agent-output.ts";

export const DECISION_PROFILE_TRANSITION_CHECK = Object.freeze({
	checkId: "codewiki.check:decision.profile-transition-integrity",
	purpose: "Verify structural validity of the profile Wiki transition against its recorded before/after sources.",
	implementation: "codewiki.check.profile-transition-integrity@1.0.0",
});

/**
 * One backend-selected code check, not a complete Decision evaluation.
 * Reuses actual source/transaction validation, never a supplied validity flag.
 * Findings lack admitted durable evidence, and Decision context remains incomplete.
 * Failure to reconstruct an authorized subject returns an error, not a contradiction.
 */
export async function runDecisionProfileTransitionCheck(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	input: unknown,
): Promise<Outcome<Readonly<{gate: SemanticGate; finding: GateFinding; outcome: SemanticGateOutcome; grounds: CanonicalValue}>, ProductError>> {
	const loaded = await loadProfileDecisionGrounds(store, configuration, actor, input);
	if (!loaded.ok) return loaded;
	const grounds = loaded.value;
	const executionDigest = semanticDigest("codewiki.decision-code-check-execution@1.0.0", {
		...DECISION_PROFILE_TRANSITION_CHECK, executor: "code",
		kernelBuildDigest: configuration.kernelBuildDigest, configurationDigest: grounds.configurationDigest,
	});
	const subjectBody = Object.freeze({kind: "change" as const, repositoryId: grounds.project.repositoryId,
		changeId: grounds.reduced.change.changeId, workId: null,
		projectCommit: grounds.project.commit, projectTree: grounds.project.tree, changeTip: grounds.containing.commit,
		artifactCommit: null, artifactTree: null,
		facts: Object.freeze({"codewiki.fact:change": grounds.reduced.change.changeDigest, "codewiki.fact:transaction": grounds.transaction.transactionDigest})});
	const subjectDigest = semanticDigest("codewiki.decision-profile-check-subject@1.0.0", subjectBody);
	if (!executionDigest.ok || !subjectDigest.ok) return failure(checkRecordFailure());
	const gate = createSemanticGate({stage: "decision", subject: {...subjectBody, subjectDigest: subjectDigest.value},
		contextDigest: grounds.contextDigest, contextComplete: false,
		kernelBuildDigest: configuration.kernelBuildDigest, configurationDigest: grounds.configurationDigest,
		checks: [{checkId: DECISION_PROFILE_TRANSITION_CHECK.checkId, purpose: DECISION_PROFILE_TRANSITION_CHECK.purpose, executionDigest: executionDigest.value}]});
	if (!gate.ok) return failure(checkRecordFailure());
	const finding = createGateFinding({gateDigest: gate.value.gateDigest, checkId: DECISION_PROFILE_TRANSITION_CHECK.checkId,
		executionDigest: executionDigest.value, producerId: "codewiki.producer:profile-transition-check", status: "supported",
		reason: "The recorded profile Wiki transition was reconstructed and structurally validated against its exact before/after sources. This does not establish semantic soundness or permission to pursue the Change.",
		// Source/transaction hashes are not admitted Evidence References.
		evidenceDigests: [], assumptions: []});
	if (!finding.ok) return failure(checkRecordFailure());
	const outcome = reduceSemanticGate({gate: gate.value, currentGate: gate.value, findings: [finding.value]});
	if (!outcome.ok) return failure(checkRecordFailure());
	return success(Object.freeze({gate: gate.value, finding: finding.value, outcome: outcome.value, grounds: grounds.manifest}));
}

function checkRecordFailure(): ProductError {
	return productError("internal_failure", "The code check observation could not be bound to its exact grounds.", "Do not infer a finding or stage success from an incomplete record.", false);
}

export interface DecisionModelCheckSources {
	readonly contextDigest: Sha256Digest;
	readonly output: AgentRunOutput;
	readonly checkOutput: DecisionCheckOutput;
	readonly slices: readonly ProfileDecisionSourceSlice[];
}

/**
 * Verify retained input against the exact completed Run before any source/output read.
 * This is input identity, not proof that the prompt contains sufficient grounds or
 * that this Check was selected by the backend. Do not infer coverage or admission.
 */
export async function readDecisionModelCheckMaterial(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	port: AgentRunOutputPort,
	input: unknown,
): Promise<Outcome<DecisionModelCheckSources & Readonly<{material: AgentRunMaterial}>, ProductError | AgentRuntimeIssue>> {
	const denied = profileScopeGuard(actor, "decision.evaluate", {});
	if (denied !== null) return failure(denied);
	const contract = "Decision model check material";
	const request = decodeContract(contract, input, value => {
		const record = exactRecord(contract, value, "$", ["authorization", "handle", "expectedContextDigest", "material"]);
		const binding = decodeAgentRunOutputBinding({authorization: record.authorization, handle: record.handle});
		if (!binding.ok) rejectContract("invalid_field", contract, "$", "A completed authorized Run with closed custody is required.");
		const raw = exactRecord(contract, requiredField(contract, record, "material"), "$.material", ["systemPrompt", "prompt"]);
		const bounds = {minimumBytes: 0, maximumBytes: 256 * 1024};
		const material = Object.freeze({systemPrompt: textField(contract, raw, "systemPrompt", "$.material", bounds), prompt: textField(contract, raw, "prompt", "$.material", bounds)});
		const digest = agentRunContextMaterialDigest(material, binding.value.authorization.context.itemIds);
		if (!digest.ok || digest.value !== binding.value.authorization.context.contextDigest) rejectContract("invalid_field", contract, "$.material", "Retained material differs from the authorized model input.");
		return Object.freeze({sources: Object.freeze({...binding.value, expectedContextDigest: record.expectedContextDigest}), material});
	});
	if (!request.ok) return failure(productError("invalid_request", "Model check input is malformed, exceeds bounds or differs from its authorization.", "Retain exact authorized input; do not repair or truncate it.", false));
	const sources = await readDecisionModelCheckSources(store, configuration, actor, port, request.value.sources);
	return sources.ok ? success(Object.freeze({...sources.value, material: request.value.material})) : sources;
}

/**
 * Internal source verification for one completed model check, not finding admission.
 * The backend supplies its private output reader and authenticated actor/configuration.
 * Expected context is a freshness guard, never caller-authenticated grounds. This
 * does not establish which material the model saw, Check selection or coverage.
 */
export function verifyDecisionModelCheckRead(
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	input: unknown,
) {
	const denied = profileScopeGuard(actor, "decision.evaluate", {});
	if (denied !== null) return failure(denied);
	const contract = "Decision model check sources";
	const request = decodeContract(contract, input, value => {
		const record = exactRecord(contract, value, "$", ["authorization", "handle", "expectedContextDigest"]);
		const binding = decodeAgentRunOutputBinding({authorization: record.authorization, handle: record.handle});
		if (!binding.ok) rejectContract("invalid_field", contract, "$", "A completed authorized Run with closed custody is required.");
		const context = decodeSha256Digest(requiredField(contract, record, "expectedContextDigest"));
		if (!context.ok) rejectContract("invalid_field", contract, "$.expectedContextDigest", context.error.message);
		return Object.freeze({...binding.value, expectedContextDigest: context.value});
	});
	if (!request.ok) return failure(productError("invalid_request", "Model check source request is malformed.", "Supply a completed Run and expected context digest, not findings.", false));
	const {authorization} = request.value;
	const subject = authorization.subject;
	const authority = semanticDigest("codewiki.agent-run-actor-authority@1.0.0", {
		actorId: actor.actorId, authorizationId: actor.authorizationId,
		role: authorization.role, subjectId: subject.subjectId,
	});
	if (authorization.actorId !== actor.actorId || !authority.ok || authority.value !== authorization.authorityDigest ||
		subject.repositoryId !== configuration.repositoryId ||
		(actor.changeIds !== null && !actor.changeIds.includes(subject.changeId ?? ""))) {
		return failure(productError("authorization_denied", "Model check does not belong to this Actor, grant, repository or Change scope.", "Use the backend-authorized Run for this scope.", true));
	}
	if (!matchesDecisionModelCheckExecution(authorization)) return failure(productError("invalid_request", "Run is not a compatible Decision model check.", "Do not reinterpret historical Check outputs.", false));
	return success(request.value);
}

/** Verify receipt-bound quotations against authorized current grounds. */
export async function readDecisionModelCheckSources(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	port: AgentRunOutputPort,
	input: unknown,
): Promise<Outcome<DecisionModelCheckSources, ProductError | AgentRuntimeIssue>> {
	const request = verifyDecisionModelCheckRead(configuration, actor, input);
	if (!request.ok) return request;
	const {authorization, handle, expectedContextDigest} = request.value;
	const subject = authorization.subject;
	const coordinates = Object.freeze({changeId: subject.changeId, expectedProjectHead: subject.projectCommit, expectedChangeTip: subject.changeTip});
	const grounds = await loadProfileDecisionGrounds(store, configuration, actor, coordinates);
	if (!grounds.ok) return grounds;
	if (grounds.value.contextDigest !== expectedContextDigest || !sameGitOid(subject.projectTree, grounds.value.project.tree) ||
		!sameGitOid(authorization.context.wikiCommit, grounds.value.project.commit)) return failure(stale());
	const read = await readDecisionModelCheckOutput(port, authorization, handle);
	if (!read.ok) return read;
	let slices: readonly ProfileDecisionSourceSlice[];
	let contextDigest: Sha256Digest;
	if (read.value.checkOutput.citations.length > 0) {
		const sources = await readProfileDecisionSourceSlices(store, configuration, actor, {...coordinates, citations: read.value.checkOutput.citations});
		if (!sources.ok) return sources;
		slices = sources.value.slices;
		contextDigest = sources.value.contextDigest;
	} else {
		// Unresolved output with no citations still needs a post-read freshness check.
		const current = await loadProfileDecisionGrounds(store, configuration, actor, coordinates);
		if (!current.ok) return current;
		slices = Object.freeze([]);
		contextDigest = current.value.contextDigest;
	}
	if (contextDigest !== expectedContextDigest) return failure(stale());
	return success(Object.freeze({contextDigest, ...read.value, slices}));
}

function stale(): ProductError {
	return productError("source_stale", "Model check source context differs from current backend grounds.", "Rebuild the Check against current exact grounds.", false);
}
