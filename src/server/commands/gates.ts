import {canonicalJson, decodeCanonicalValue, parseCanonicalJson, type CanonicalValue} from "../../kernel/data-contracts/canonical-json.ts";
import {failure, success, type Outcome} from "../../kernel/data-contracts/outcome.ts";
import type {Change} from "../../kernel/changes/contracts.ts";
import {decodeCheckDefinition, type CheckDefinition} from "../../kernel/gates/check-definition.ts";
import {
	checkRunIdentity,
	createCheckRegistration,
	createCheckRun,
	createResult,
	decodeCheckRun,
	decodeResult,
	type CheckExecutionIdentity,
	type CheckRegistration,
	type CheckRun,
	type CheckStage,
	type GateInputReference,
	type GateSubject,
	type Result,
} from "../../kernel/gates/contracts.ts";
import {reduceGate} from "../../kernel/gates/reducer.ts";
import {createGateFromSelection} from "../../kernel/gates/selection.ts";
import {canonicalValueDigest, semanticDigest} from "../../kernel/identity/semantic-digest.ts";
import {decodeSha256Digest, sha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {checkRunnerRequestDigest, type CheckRunnerInputItem, type CheckRunnerPort} from "../../ports/check-runner.ts";
import type {ProjectStoreTreeEntry} from "../../ports/project-store.ts";
import {productError, type ProductError} from "../../api/transport/envelope.ts";
import type {AuthorizedProjectActor} from "../authorization/policy.ts";
import {
	createGateBundle,
	decodeGateBundle,
	gateBundleWriteRequestDigest,
	type GateBundle,
	type ProjectServerFactsPort,
} from "../recovery/facts.ts";
import type {LifecycleRepositoryEnvironment} from "./repository.ts";

export interface GateExecutionEnvironment extends LifecycleRepositoryEnvironment {
	readonly checkRunner: CheckRunnerPort;
	readonly facts: ProjectServerFactsPort;
}

export interface GateMaterial {
	readonly source: CheckRunnerInputItem["source"];
	readonly ref: string;
	readonly content: CanonicalValue;
}

export interface GateEvaluationInput {
	readonly stage: CheckStage;
	readonly subject: GateSubject;
	readonly change: Change;
	readonly workType: string | null;
	readonly commandId: string;
	readonly commandDigest: Sha256Digest;
	readonly actor: AuthorizedProjectActor;
	readonly materials: readonly GateMaterial[];
}

interface LoadedCheckPolicy {
	readonly registrations: readonly CheckRegistration[];
	readonly enabledProjectPacks: readonly string[];
	readonly materials: readonly GateMaterial[];
}

const ZERO_DIGEST = `sha256:${"0".repeat(64)}` as Sha256Digest;
const TEXT = new TextDecoder("utf-8", {fatal: true});
const CHECK_PACK_LOCK_PATH = ".codewiki/check-packs.lock.json";

export async function evaluateGate(
	environment: GateExecutionEnvironment,
	input: GateEvaluationInput,
): Promise<Outcome<GateBundle, ProductError>> {
	const policy = await loadCheckPolicy(environment, input.stage, input.subject.projectCommit, input.actor.authorizationId);
	if (!policy.ok) return policy;
	const baseline = baselineMaterials(input);
	if (!baseline.ok) return failure(invalidState("Gate baseline material is not canonical."));
	const materials = normalizeMaterials([
		...baseline.value,
		...policy.value.materials,
		...input.materials,
	]);
	if (!materials.ok) return materials;
	const gateInputs: GateInputReference[] = materials.value.map((entry) => Object.freeze({
		source: entry.source,
		ref: entry.ref,
		digest: entry.digest,
	}));
	const gate = createGateFromSelection({
		selectionInput: {
			stage: input.stage,
			changeType: input.change.changeType,
			realization: input.change.realization,
			subject: input.subject,
			workType: input.workType,
			registrations: policy.value.registrations,
			enabledProjectPacks: policy.value.enabledProjectPacks,
		},
		inputs: gateInputs,
		kernelBuildDigest: environment.configuration.kernelBuildDigest,
	});
	if (!gate.ok) return failure(invalidState("Active Checks could not be resolved for the exact stage subject."));
	const stored = await environment.facts.readGateBundle({
		repositoryId: environment.configuration.repositoryId,
		gateDigest: gate.value.gateDigest,
	});
	if (stored.ok) {
		const decoded = decodeGateBundle(stored.value);
		if (!decoded.ok || decoded.value.gate.gateDigest !== gate.value.gateDigest) return failure(invalidState("Stored Gate facts are malformed or substituted."));
		return success(decoded.value);
	}
	if (stored.error.code !== "not_found") return failure(unknownOutcome("Gate facts could not be reconciled before execution."));
	const runs: CheckRun[] = [];
	const results: Result[] = [];
	for (const registration of gate.value.activeChecks) {
		const executed = await executeCheck(environment.checkRunner, input.actor, gate.value, registration, materials.value);
		runs.push(executed.run);
		if (executed.result !== null) results.push(executed.result);
	}
	const outcome = reduceGate({
		gate: gate.value,
		currentSubject: input.subject,
		currentKernelBuildDigest: environment.configuration.kernelBuildDigest,
		kernelValidation: "passed",
		runs,
		results,
	});
	if (!outcome.ok) return failure(invalidState("Gate facts did not reduce to a valid stage outcome."));
	const bundle = createGateBundle({gate: gate.value, runs: Object.freeze(runs), results: Object.freeze(results), outcome: outcome.value});
	if (!bundle.ok) return failure(invalidState("Gate facts could not be frozen safely."));
	const writeRequest = {
		repositoryId: environment.configuration.repositoryId,
		gateDigest: gate.value.gateDigest,
		bundle: bundle.value,
		requestDigest: ZERO_DIGEST,
	};
	const writeDigest = gateBundleWriteRequestDigest(writeRequest);
	if (!writeDigest.ok) return failure(internalFailure());
	const written = await environment.facts.writeGateBundle({...writeRequest, requestDigest: writeDigest.value});
	if (!written.ok) return failure(unknownOutcome("Gate execution completed but its immutable facts are not yet reconciled."));
	if (written.value.gateDigest !== gate.value.gateDigest || written.value.bundleDigest !== bundle.value.bundleDigest || written.value.requestDigest !== writeDigest.value) {
		return failure(invalidState("Gate fact storage returned a substituted receipt."));
	}
	return success(bundle.value);
}

async function executeCheck(
	runner: CheckRunnerPort,
	actor: AuthorizedProjectActor,
	gate: GateBundle["gate"],
	registration: CheckRegistration,
	inputs: readonly CheckRunnerInputItem[],
): Promise<Readonly<{run: CheckRun; result: Result | null}>> {
	const request = {
		authorizationId: actor.authorizationId,
		requestDigest: ZERO_DIGEST,
		gate,
		registration,
		inputs,
		attempt: 1,
		predecessorRunDigest: null,
		quiescenceReceipt: null,
	};
	const requestDigest = checkRunnerRequestDigest(request);
	if (!requestDigest.ok) return stoppedRun(gate, registration, fallbackExecution(registration, ZERO_DIGEST));
	let completion;
	try {
		const response = await runner.run({...request, requestDigest: requestDigest.value});
		if (!response.ok) return stoppedRun(gate, registration, fallbackExecution(registration, requestDigest.value));
		completion = response.value;
	} catch {
		return stoppedRun(gate, registration, fallbackExecution(registration, requestDigest.value));
	}
	const execution = completion.execution;
	if (completion.status !== "completed") return stoppedRun(gate, registration, execution, completion.status, completion.executionReceipt);
	const runId = checkRunIdentity(gate.gateDigest, registration.registrationDigest, 1);
	const executionDigest = semanticDigest("codewiki.check-execution@1.0.0", execution);
	if (!runId.ok || !executionDigest.ok || completion.measurement === null || completion.executionReceipt === null) {
		return stoppedRun(gate, registration, fallbackExecution(registration, requestDigest.value));
	}
	const result = createResult({
		gateDigest: gate.gateDigest,
		runId: runId.value,
		subjectDigest: gate.subject.subjectDigest,
		registrationDigest: registration.registrationDigest,
		definitionDigest: registration.definitionDigest,
		inputs: gate.inputs,
		measurement: completion.measurement,
		evidence: completion.evidence,
		executionDigest: executionDigest.value,
		status: completion.failure === null ? "passed" : "failed",
		summary: completion.summary,
		details: completion.details,
		failure: completion.failure,
	});
	if (!result.ok) return stoppedRun(gate, registration, fallbackExecution(registration, requestDigest.value));
	const run = createCheckRun({
		gateDigest: gate.gateDigest,
		subjectDigest: gate.subject.subjectDigest,
		registrationDigest: registration.registrationDigest,
		definitionDigest: registration.definitionDigest,
		inputs: gate.inputs,
		execution,
		attempt: 1,
		predecessorRunDigest: null,
		quiescenceReceipt: null,
		status: "completed",
		resultDigest: result.value.resultDigest,
		executionReceipt: completion.executionReceipt,
	});
	if (!run.ok || !decodeCheckRun(run.value).ok || !decodeResult(result.value).ok) {
		return stoppedRun(gate, registration, fallbackExecution(registration, requestDigest.value));
	}
	return Object.freeze({run: run.value, result: result.value});
}

function stoppedRun(
	gate: GateBundle["gate"],
	registration: CheckRegistration,
	execution: CheckExecutionIdentity,
	status: "error" | "stopped" = "error",
	executionReceipt: CheckRun["executionReceipt"] = null,
): Readonly<{run: CheckRun; result: null}> {
	const created = createCheckRun({
		gateDigest: gate.gateDigest,
		subjectDigest: gate.subject.subjectDigest,
		registrationDigest: registration.registrationDigest,
		definitionDigest: registration.definitionDigest,
		inputs: gate.inputs,
		execution,
		attempt: 1,
		predecessorRunDigest: null,
		quiescenceReceipt: null,
		status,
		resultDigest: null,
		executionReceipt,
	});
	if (!created.ok) throw new Error("Invariant: fallback Check Run must be valid.");
	return Object.freeze({run: created.value, result: null});
}

async function loadCheckPolicy(
	environment: GateExecutionEnvironment,
	stage: CheckStage,
	projectCommit: GateBundle["gate"]["subject"]["projectCommit"],
	authorizationId: string,
): Promise<Outcome<LoadedCheckPolicy, ProductError>> {
	void authorizationId;
	const tree = await environment.store.readTree({
		repositoryId: environment.configuration.repositoryId,
		objectFormat: environment.configuration.objectFormat,
		commit: projectCommit,
		pathPrefix: `.codewiki/check-packs/${stage}`,
		maximumEntries: 4_096,
	});
	if (!tree.ok || projectCommit.hex !== tree.value.commit.hex) return failure(invalidState("The exact stage Check Packs are unavailable."));
	const lock = await readText(environment, projectCommit, CHECK_PACK_LOCK_PATH, 1024 * 1024);
	if (!lock.ok) return lock;
	const locked = decodeLock(lock.value, stage);
	if (!locked.ok) return locked;
	const byPack = groupPackEntries(tree.value.entries, stage);
	if (!sameText([...byPack.keys()].sort(compareText), [...locked.value.keys()].sort(compareText))) return failure(invalidState("Check Pack lock and exact Project tree disagree."));
	const registrations: CheckRegistration[] = [...fixedRegistrations(stage)];
	const materials: GateMaterial[] = [];
	for (const [packId, entries] of [...byPack.entries()].sort(([left], [right]) => compareText(left, right))) {
		const digestEntries: Readonly<{path: string; digest: Sha256Digest}>[] = [];
		for (const entry of entries) {
			const text = await readText(environment, projectCommit, entry.path, 4 * 1024 * 1024);
			if (!text.ok) return text;
			const relativePath = entry.path.slice(`.codewiki/check-packs/${stage}/${packId}/`.length);
			digestEntries.push(Object.freeze({path: relativePath, digest: sha256Digest(text.value)}));
			materials.push(Object.freeze({source: "repository", ref: `check-pack:${stage}:${packId}:${relativePath}`, content: text.value}));
			if (!entry.path.endsWith("/check.json")) continue;
			const parsed = parseCanonicalJson(text.value);
			if (!parsed.ok) return failure(invalidState("A stage Check definition is malformed."));
			const definition = decodeCheckDefinition(parsed.value);
			if (!definition.ok) return failure(invalidState("A stage Check definition is invalid."));
			const registration = createCheckRegistration({
				source: "project",
				packId,
				stage,
				enforcement: "required",
				universalSafety: false,
				applicability: {changeTypes: [], realizations: [], subjectKinds: [], workTypes: [], facts: {}},
				definition: definition.value,
			});
			if (!registration.ok) return failure(invalidState("A stage Check registration is invalid."));
			registrations.push(registration.value);
		}
		const packDigest = canonicalValueDigest(digestEntries);
		if (!packDigest.ok || packDigest.value !== locked.value.get(packId)) return failure(invalidState("A stage Check Pack differs from its exact lock identity."));
	}
	registrations.sort((left, right) => compareText(left.registrationDigest, right.registrationDigest));
	materials.sort((left, right) => compareText(`${left.source}\0${left.ref}`, `${right.source}\0${right.ref}`));
	return success(Object.freeze({
		registrations: Object.freeze(registrations),
		enabledProjectPacks: Object.freeze([...byPack.keys()].sort(compareText)),
		materials: Object.freeze(materials),
	}));
}

async function readText(
	environment: GateExecutionEnvironment,
	commit: GateBundle["gate"]["subject"]["projectCommit"],
	path: string,
	maximumBytes: number,
): Promise<Outcome<string, ProductError>> {
	const blob = await environment.store.readBlob({
		repositoryId: environment.configuration.repositoryId,
		objectFormat: environment.configuration.objectFormat,
		commit,
		path,
		maximumBytes,
	});
	if (!blob.ok) return failure(invalidState("Check policy material is unavailable."));
	try {
		return success(TEXT.decode(blob.value.bytes));
	} catch {
		return failure(invalidState("Check policy material is not canonical UTF-8."));
	}
}

function decodeLock(text: string, stage: CheckStage): Outcome<ReadonlyMap<string, Sha256Digest>, ProductError> {
	const parsed = parseCanonicalJson(text.endsWith("\n") ? text.slice(0, -1) : text, {requireCanonicalBytes: true});
	if (!parsed.ok || !isRecord(parsed.value) || parsed.value.protocolId !== "codewiki.check-pack-lock" || parsed.value.protocolVersion !== "1.0.0") {
		return failure(invalidState("Check Pack lock is malformed."));
	}
	const packages = parsed.value.packages;
	if (!isRecord(packages)) return failure(invalidState("Check Pack lock packages are malformed."));
	const output = new Map<string, Sha256Digest>();
	for (const packageValue of Object.values(packages)) {
		if (!isRecord(packageValue) || !Array.isArray(packageValue.resources)) return failure(invalidState("Check Pack lock resources are malformed."));
		for (const resource of packageValue.resources) {
			if (!isRecord(resource) || resource.stage !== stage) continue;
			if (typeof resource.packId !== "string" || typeof resource.treeDigest !== "string" || !decodeSha256Digest(resource.treeDigest).ok || output.has(resource.packId)) {
				return failure(invalidState("Check Pack lock contains an invalid stage identity."));
			}
			output.set(resource.packId, resource.treeDigest as Sha256Digest);
		}
	}
	if (output.size === 0) return failure(invalidState("No exact Check Pack is locked for this stage."));
	return success(output);
}

function groupPackEntries(entries: readonly ProjectStoreTreeEntry[], stage: CheckStage): ReadonlyMap<string, readonly ProjectStoreTreeEntry[]> {
	const prefix = `.codewiki/check-packs/${stage}/`;
	const grouped = new Map<string, ProjectStoreTreeEntry[]>();
	for (const entry of entries) {
		const remainder = entry.path.slice(prefix.length);
		const separator = remainder.indexOf("/");
		if (!entry.path.startsWith(prefix) || separator < 1 || entry.kind !== "blob" || entry.mode !== "100644") continue;
		const packId = remainder.slice(0, separator);
		const values = grouped.get(packId) ?? [];
		values.push(entry);
		grouped.set(packId, values);
	}
	return grouped;
}

function fixedRegistrations(stage: CheckStage): readonly CheckRegistration[] {
	if (stage !== "decision") return Object.freeze([]);
	return Object.freeze([
		fixedRegistration("change_type_alignment", "Confirm that the required Change type and realization route match the exact proposal."),
		fixedRegistration("wiki_semantic_alignment", "Confirm that the exact proposal remains aligned with accepted Wiki meaning."),
	]);
}

function fixedRegistration(id: string, requirement: string): CheckRegistration {
	const definition = fixedDefinition(id, requirement);
	const registration = createCheckRegistration({
		source: "product",
		packId: "codewiki-product-fixed",
		stage: "decision",
		enforcement: "required",
		universalSafety: true,
		applicability: {changeTypes: [], realizations: [], subjectKinds: [], workTypes: [], facts: {}},
		definition,
	});
	if (!registration.ok) throw new Error("Invariant: Product-fixed Check registration must be valid.");
	return registration.value;
}

function fixedDefinition(id: string, requirement: string): CheckDefinition {
	const decoded = decodeCheckDefinition({
		schemaVersion: "1.0.0",
		id,
		version: "1.0.0",
		description: requirement,
		requirement,
		implementation: {kind: "model", route: id, profile: id, maximumTokens: 4_096},
		inputs: [{source: "subject", refs: [], required: true, maximumBytes: 1024 * 1024}],
		measurement: {kind: "binary"},
		failure: {code: `${id}_failed`, message: requirement, remediation: ["Revise the proposal and run a fresh Decision Gate."]},
		limits: {timeoutMs: 120_000, maximumAttempts: 1, maximumInputBytes: 4 * 1024 * 1024, maximumOutputBytes: 65_536},
	});
	if (!decoded.ok) throw new Error("Invariant: Product-fixed Check definition must be valid.");
	return decoded.value;
}

function baselineMaterials(input: GateEvaluationInput): Outcome<readonly GateMaterial[], ProductError> {
	const change = decodeCanonicalValue(input.change);
	const repository = decodeCanonicalValue({
		repositoryId: input.subject.repositoryId,
		projectCommit: input.subject.projectCommit,
		projectTree: input.subject.projectTree,
		changeTip: input.subject.changeTip,
	});
	const subject = decodeCanonicalValue(input.subject);
	if (!change.ok || !repository.ok || !subject.ok) return failure(internalFailure());
	return success(Object.freeze([
		Object.freeze({source: "evidence" as const, ref: "gate:evidence", content: []}),
		Object.freeze({source: "knowledge" as const, ref: `change:${input.change.changeId}`, content: change.value}),
		Object.freeze({source: "provider_receipts" as const, ref: "gate:provider-receipts", content: []}),
		Object.freeze({source: "repository" as const, ref: "gate:project-snapshot", content: repository.value}),
		Object.freeze({source: "subject" as const, ref: `gate:${input.stage}:subject`, content: subject.value}),
		Object.freeze({source: "subject" as const, ref: input.commandId, content: {commandDigest: input.commandDigest}}),
	]));
}

function normalizeMaterials(materials: readonly GateMaterial[]): Outcome<readonly CheckRunnerInputItem[], ProductError> {
	const output = materials.map((entry) => {
		const encoded = canonicalJson(entry.content);
		if (!encoded.ok) return null;
		return Object.freeze({...entry, digest: sha256Digest(encoded.value)});
	});
	if (output.some((entry) => entry === null)) return failure(invalidState("Gate material is not canonical."));
	const complete = output as CheckRunnerInputItem[];
	complete.sort((left, right) => compareText(`${left.source}\0${left.ref}\0${left.digest}`, `${right.source}\0${right.ref}\0${right.digest}`));
	for (let index = 1; index < complete.length; index += 1) {
		if (complete[index - 1]?.source === complete[index]?.source && complete[index - 1]?.ref === complete[index]?.ref) return failure(invalidState("Gate material identity is duplicated."));
	}
	return success(Object.freeze(complete));
}

function fallbackExecution(registration: CheckRegistration, configurationDigest: Sha256Digest): CheckExecutionIdentity {
	return Object.freeze({
		kind: registration.definition.implementation.kind,
		executorId: "codewiki-check-runner",
		executorVersion: "1.0.0",
		profile: registration.definition.implementation.profile,
		route: registration.definition.implementation.kind === "model" ? registration.definition.implementation.route : null,
		configurationDigest,
	});
}

function isRecord(value: unknown): value is Readonly<{[key: string]: CanonicalValue}> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameText(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function invalidState(message: string): ProductError {
	return productError("invalid_project_state", message, "Repair exact Project policy or lifecycle state before retrying.", true);
}

function unknownOutcome(message: string): ProductError {
	return productError("operation_unknown", message, "Reconcile immutable Gate facts before starting another semantic attempt.", true);
}

function internalFailure(): ProductError {
	return productError("internal_failure", "The Gate action could not be prepared safely.", "Retry after the Project service is healthy.", false);
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
