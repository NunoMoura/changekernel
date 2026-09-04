import {arrayField, decodeContract, exactRecord, literalField, rejectContract, textValue, type ContractIssue} from "../canonical/contract.ts";
import type {CanonicalValue} from "../canonical/json.ts";
import {failure, success, type Outcome} from "../canonical/outcome.ts";
import {sameGitOid} from "../identity/git.ts";
import {semanticDigest} from "../identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../identity/sha256.ts";
import {
	checkRegistrationKey,
	decodeCheckRun,
	decodeGate,
	decodeGateSubject,
	decodeResult,
	type CheckRegistration,
	type CheckRun,
	type Gate,
	type GateSubject,
	type Result,
} from "./contracts.ts";

export type GateOutcomeStatus = "failed" | "passed" | "stopped";

export interface GateOutcome {
	readonly gateDigest: Sha256Digest;
	readonly subjectDigest: Sha256Digest;
	readonly status: GateOutcomeStatus;
	readonly requiredResults: readonly Sha256Digest[];
	readonly advisoryResults: readonly Sha256Digest[];
	readonly observedResults: readonly Sha256Digest[];
	readonly failedResults: readonly Sha256Digest[];
	readonly stopReasons: readonly string[];
	readonly outcomeDigest: Sha256Digest;
}

export interface GateReductionIssue {
	readonly code: "invalid_gate" | "invalid_result" | "invalid_run" | "reduction_failed";
	readonly path: string;
	readonly message: string;
}

export function decodeGateOutcome(input: unknown): Outcome<GateOutcome, ContractIssue> {
	return decodeContract("Gate outcome", input, (value) => decodeGateOutcomeValue(value));
}

export function decodeGateOutcomeValue(value: CanonicalValue, path = "$"): GateOutcome {
	const record = exactRecord("Gate outcome", value, path, [
		"advisoryResults", "failedResults", "gateDigest", "observedResults", "outcomeDigest", "requiredResults", "status", "stopReasons", "subjectDigest",
	]);
	const result = Object.freeze({
		gateDigest: outcomeDigestField(record, "gateDigest", path),
		subjectDigest: outcomeDigestField(record, "subjectDigest", path),
		status: literalField("Gate outcome", record, "status", ["failed", "passed", "stopped"] as const, path),
		requiredResults: outcomeDigestArray(record, "requiredResults", path),
		advisoryResults: outcomeDigestArray(record, "advisoryResults", path),
		observedResults: outcomeDigestArray(record, "observedResults", path),
		failedResults: outcomeDigestArray(record, "failedResults", path),
		stopReasons: outcomeTextArray(record, "stopReasons", path),
		outcomeDigest: outcomeDigestField(record, "outcomeDigest", path),
	});
	const categorized = [...result.requiredResults, ...result.advisoryResults, ...result.observedResults];
	if (new Set(categorized).size !== categorized.length || result.failedResults.some((entry) => !categorized.includes(entry))) {
		rejectContract("invalid_field", "Gate outcome", path, "Gate outcome Result categories conflict.");
	}
	let expectedStatus: GateOutcomeStatus = "passed";
	if (result.stopReasons.length > 0) expectedStatus = "stopped";
	else if (result.requiredResults.some((entry) => result.failedResults.includes(entry))) expectedStatus = "failed";
	if (result.status !== expectedStatus) rejectContract("invalid_field", "Gate outcome", `${path}.status`, "Gate outcome status conflicts with factual Results/stops.");
	const {outcomeDigest, ...body} = result;
	const expected = semanticDigest("codewiki.gate-outcome@1.0.0", body);
	if (!expected.ok || expected.value !== outcomeDigest) rejectContract("invalid_field", "Gate outcome", `${path}.outcomeDigest`, "Gate outcome digest mismatch.");
	return result;
}

export function reduceGate(input: Readonly<{
	gate: Gate;
	currentSubject: GateSubject;
	currentKernelBuildDigest: Sha256Digest;
	kernelValidation: "failed" | "passed";
	runs: readonly CheckRun[];
	results: readonly Result[];
}>): Outcome<GateOutcome, GateReductionIssue> {
	const gateResult = decodeGate(input.gate);
	if (!gateResult.ok) return failure(issue("invalid_gate", "$.gate", gateResult.error.message));
	const currentSubjectResult = decodeGateSubject(input.currentSubject);
	if (!currentSubjectResult.ok) return failure(issue("invalid_gate", "$.currentSubject", currentSubjectResult.error.message));
	const currentKernelBuildDigest = decodeSha256Digest(input.currentKernelBuildDigest);
	if (!currentKernelBuildDigest.ok) return failure(issue("invalid_gate", "$.currentKernelBuildDigest", currentKernelBuildDigest.error.message));
	const runs = decodeRuns(input.runs);
	if (!runs.ok) return runs;
	const results = decodeResults(input.results);
	if (!results.ok) return results;
	return reduceValidGate({
		gate: gateResult.value,
		currentSubject: currentSubjectResult.value,
		currentKernelBuildDigest: currentKernelBuildDigest.value,
		kernelValidation: input.kernelValidation,
		runs: runs.value,
		results: results.value,
	});
}

function reduceValidGate(input: Readonly<{
	gate: Gate;
	currentSubject: GateSubject;
	currentKernelBuildDigest: Sha256Digest;
	kernelValidation: "failed" | "passed";
	runs: readonly CheckRun[];
	results: readonly Result[];
}>): Outcome<GateOutcome, GateReductionIssue> {
	const {gate, currentSubject, currentKernelBuildDigest, kernelValidation, runs, results} = input;
	const stops: string[] = [];
	const required: Sha256Digest[] = [];
	const advisory: Sha256Digest[] = [];
	const observed: Sha256Digest[] = [];
	const failed: Sha256Digest[] = [];
	if (!gate.selectionComplete) stops.push("active_check_selection_incomplete");
	if (kernelValidation !== "passed") stops.push("kernel_validation_failed");
	if (gate.kernelBuildDigest !== currentKernelBuildDigest) stops.push("stale_kernel_build");
	if (!sameSubject(gate.subject, currentSubject)) stops.push("stale_subject");
	const registrations = new Map(gate.activeChecks.map((entry) => [entry.registrationDigest, entry]));
	const resultByDigest = uniqueResultMap(results, stops);
	const runsByRegistration = groupRuns(gate, runs, registrations, stops);
	for (const registration of gate.activeChecks) {
		if (registration.enforcement === "required" && !requiredCheckInputsPresent(registration, gate.inputs)) {
			stops.push(`missing_required_input:${checkRegistrationKey(registration)}`);
		}
		const terminal = terminalRun(registration, runsByRegistration.get(registration.registrationDigest) ?? [], stops);
		if (!terminal) {
			if (registration.enforcement === "required") stops.push(`missing_required_run:${checkRegistrationKey(registration)}`);
			continue;
		}
		if (terminal.status !== "completed" || terminal.resultDigest === null) {
			if (registration.enforcement === "required") stops.push(`required_run_${terminal.status}:${checkRegistrationKey(registration)}`);
			continue;
		}
		const result = resultByDigest.get(terminal.resultDigest);
		if (!result || !resultMatches(gate, registration, terminal, result)) {
			if (registration.enforcement === "required") stops.push(`missing_or_mismatched_result:${checkRegistrationKey(registration)}`);
			continue;
		}
		const measurementStatus = resultMeasurementStatus(registration, result);
		if (measurementStatus !== result.status) stops.push(`inconsistent_measurement:${checkRegistrationKey(registration)}`);
		if (result.status === "failed") failed.push(result.resultDigest);
		if (registration.enforcement === "required") required.push(result.resultDigest);
		else if (registration.enforcement === "advisory") advisory.push(result.resultDigest);
		else observed.push(result.resultDigest);
	}
	for (const result of results) {
		if (!runs.some((run) => run.resultDigest === result.resultDigest)) stops.push(`orphan_result:${result.resultDigest}`);
	}
	const stopReasons = Object.freeze([...new Set(stops)].sort(compareText));
	const requiredResults = Object.freeze([...new Set(required)].sort(compareText));
	const advisoryResults = Object.freeze([...new Set(advisory)].sort(compareText));
	const observedResults = Object.freeze([...new Set(observed)].sort(compareText));
	const failedResults = Object.freeze([...new Set(failed)].sort(compareText));
	const requiredFailed = gate.activeChecks.some((registration) => {
		if (registration.enforcement !== "required") return false;
		const terminal = (runsByRegistration.get(registration.registrationDigest) ?? []).at(-1);
		return terminal?.resultDigest !== null && terminal?.resultDigest !== undefined && resultByDigest.get(terminal.resultDigest)?.status === "failed";
	});
	let status: GateOutcomeStatus = "passed";
	if (stopReasons.length > 0) status = "stopped";
	else if (requiredFailed) status = "failed";
	const body = Object.freeze({
		gateDigest: gate.gateDigest,
		subjectDigest: gate.subject.subjectDigest,
		status,
		requiredResults,
		advisoryResults,
		observedResults,
		failedResults,
		stopReasons,
	});
	const digest = semanticDigest("codewiki.gate-outcome@1.0.0", body);
	if (!digest.ok) return failure(issue("reduction_failed", "$", digest.error.message));
	const decoded = decodeGateOutcome(Object.freeze({...body, outcomeDigest: digest.value}));
	return decoded.ok
		? success(decoded.value)
		: failure(issue("reduction_failed", "$", decoded.error.message));
}

export function requiredCheckInputsPresent(registration: CheckRegistration, inputs: Gate["inputs"]): boolean {
	for (const selector of registration.definition.inputs) {
		if (!selector.required) continue;
		const matching = inputs.filter((entry) => entry.source === selector.source);
		if (selector.refs.length === 0 ? matching.length === 0 : !selector.refs.every((ref) => matching.some((entry) => entry.ref === ref))) {
			return false;
		}
	}
	return true;
}

function decodeRuns(input: readonly CheckRun[]): Outcome<readonly CheckRun[], GateReductionIssue> {
	if (input.length > 768) return failure(issue("invalid_run", "$.runs", "Check Run collection exceeds Gate bound."));
	const output: CheckRun[] = [];
	for (let index = 0; index < input.length; index += 1) {
		const decoded = decodeCheckRun(input[index]);
		if (!decoded.ok) return failure(issue("invalid_run", `$.runs[${index}]`, decoded.error.message));
		output.push(decoded.value);
	}
	return success(Object.freeze(output));
}

function decodeResults(input: readonly Result[]): Outcome<readonly Result[], GateReductionIssue> {
	if (input.length > 256) return failure(issue("invalid_result", "$.results", "Result collection exceeds Gate bound."));
	const output: Result[] = [];
	for (let index = 0; index < input.length; index += 1) {
		const decoded = decodeResult(input[index]);
		if (!decoded.ok) return failure(issue("invalid_result", `$.results[${index}]`, decoded.error.message));
		output.push(decoded.value);
	}
	return success(Object.freeze(output));
}

function uniqueResultMap(results: readonly Result[], stops: string[]): Map<Sha256Digest, Result> {
	const output = new Map<Sha256Digest, Result>();
	for (const result of results) {
		if (output.has(result.resultDigest)) stops.push(`duplicate_result:${result.resultDigest}`);
		else output.set(result.resultDigest, result);
	}
	return output;
}

function groupRuns(
	gate: Gate,
	runs: readonly CheckRun[],
	registrations: ReadonlyMap<Sha256Digest, CheckRegistration>,
	stops: string[],
): Map<Sha256Digest, CheckRun[]> {
	const output = new Map<Sha256Digest, CheckRun[]>();
	const runDigests = new Set<Sha256Digest>();
	for (const run of runs) {
		if (runDigests.has(run.runDigest)) stops.push(`duplicate_run:${run.runDigest}`);
		runDigests.add(run.runDigest);
		const registration = registrations.get(run.registrationDigest);
		if (!registration || run.gateDigest !== gate.gateDigest || run.subjectDigest !== gate.subject.subjectDigest) {
			stops.push(`foreign_run:${run.runDigest}`);
			continue;
		}
		if (run.definitionDigest !== registration.definitionDigest || !sameInputs(run.inputs, gate.inputs)) {
			stops.push(`mismatched_run:${run.runDigest}`);
			continue;
		}
		const entries = output.get(run.registrationDigest) ?? [];
		entries.push(run);
		output.set(run.registrationDigest, entries);
	}
	for (const entries of output.values()) entries.sort((left, right) => left.attempt - right.attempt);
	return output;
}

function terminalRun(registration: CheckRegistration, runs: readonly CheckRun[], stops: string[]): CheckRun | null {
	if (runs.length === 0) return null;
	if (runs.length > registration.definition.limits.maximumAttempts) {
		stops.push(`attempt_budget_exceeded:${checkRegistrationKey(registration)}`);
	}
	for (let index = 0; index < runs.length; index += 1) {
		const run = runs[index];
		const predecessor = index === 0 ? null : runs[index - 1] ?? null;
		if (!run || run.attempt !== index + 1 || (predecessor !== null && run.predecessorRunDigest !== predecessor.runDigest) ||
			(predecessor !== null && predecessor.executionReceipt === null && run.quiescenceReceipt === null)) {
			stops.push(`invalid_retry_chain:${checkRegistrationKey(registration)}`);
			break;
		}
	}
	return runs.at(-1) ?? null;
}

function resultMatches(gate: Gate, registration: CheckRegistration, run: CheckRun, result: Result): boolean {
	if (
		result.gateDigest !== gate.gateDigest ||
		result.runId !== run.runId ||
		result.subjectDigest !== gate.subject.subjectDigest ||
		result.registrationDigest !== registration.registrationDigest ||
		result.definitionDigest !== registration.definitionDigest ||
		!sameInputs(result.inputs, run.inputs)
	) return false;
	const executionDigest = semanticDigest("codewiki.check-execution@1.0.0", run.execution);
	return executionDigest.ok && executionDigest.value === result.executionDigest;
}

export function resultMeasurementStatus(registration: CheckRegistration, result: Result): "failed" | "passed" {
	const specification = registration.definition.measurement;
	if (specification.kind === "binary" && result.measurement.kind === "binary") return result.measurement.value ? "passed" : "failed";
	if (specification.kind === "quantitative" && result.measurement.kind === "quantitative") {
		if (specification.minimum !== null && result.measurement.value < specification.minimum) return "failed";
		if (specification.maximum !== null && result.measurement.value > specification.maximum) return "failed";
		return "passed";
	}
	return "failed";
}

function outcomeDigestField(record: Readonly<{[key: string]: CanonicalValue}>, field: string, path: string): Sha256Digest {
	const decoded = decodeSha256Digest(record[field]);
	if (!decoded.ok) rejectContract("invalid_field", "Gate outcome", `${path}.${field}`, decoded.error.message);
	return decoded.value;
}

function outcomeDigestArray(record: Readonly<{[key: string]: CanonicalValue}>, field: string, path: string): readonly Sha256Digest[] {
	const output = arrayField("Gate outcome", record, field, path, 256).map((entry, index) => {
		const decoded = decodeSha256Digest(entry);
		if (!decoded.ok) rejectContract("invalid_field", "Gate outcome", `${path}.${field}[${index}]`, decoded.error.message);
		return decoded.value;
	});
	assertOutcomeOrder(output, `${path}.${field}`);
	return Object.freeze(output);
}

function outcomeTextArray(record: Readonly<{[key: string]: CanonicalValue}>, field: string, path: string): readonly string[] {
	const output = arrayField("Gate outcome", record, field, path, 1_024).map((entry, index) =>
		textValue("Gate outcome", entry, `${path}.${field}[${index}]`, {maximumBytes: 4_096}));
	assertOutcomeOrder(output, `${path}.${field}`);
	return Object.freeze(output);
}

function assertOutcomeOrder(values: readonly string[], path: string): void {
	for (let index = 1; index < values.length; index += 1) {
		if ((values[index - 1] ?? "") >= (values[index] ?? "")) rejectContract("non_canonical_order", "Gate outcome", path, "Values must be strictly sorted and unique.");
	}
}

function sameSubject(left: GateSubject, right: GateSubject): boolean {
	return left.subjectDigest === right.subjectDigest &&
		sameGitOid(left.projectCommit, right.projectCommit) &&
		sameGitOid(left.projectTree, right.projectTree) &&
		sameGitOid(left.changeTip, right.changeTip) &&
		optionalOidEqual(left.artifactCommit, right.artifactCommit) &&
		optionalOidEqual(left.artifactTree, right.artifactTree);
}

function optionalOidEqual(left: GateSubject["artifactCommit"], right: GateSubject["artifactCommit"]): boolean {
	return left === null ? right === null : right !== null && sameGitOid(left, right);
}

function sameInputs(left: CheckRun["inputs"], right: Gate["inputs"]): boolean {
	return left.length === right.length && left.every((value, index) => {
		const expected = right[index];
		return expected !== undefined && value.source === expected.source && value.ref === expected.ref && value.digest === expected.digest;
	});
}

function issue(code: GateReductionIssue["code"], path: string, message: string): GateReductionIssue {
	return Object.freeze({code, path, message});
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
