import {
	arrayField,
	booleanField,
	decodeContract,
	exactRecord,
	integerField,
	literalField,
	rejectContract,
	requiredField,
	textField,
	textValue,
	type ContractIssue,
} from "../data-contracts/validation.ts";
import type {CanonicalValue} from "../data-contracts/canonical-json.ts";
import type {Outcome} from "../data-contracts/outcome.ts";
import {semanticDigest} from "../identity/semantic-digest.ts";
import type {Sha256Digest} from "../identity/sha256.ts";

export const CHECK_DEFINITION_SCHEMA_VERSION = "1.0.0" as const;
export const CHECK_DEFINITION_DIGEST_PROTOCOL = "codewiki.check-definition@1.0.0";

export type CheckImplementationKind = "code" | "model";
export type CheckInputSource = "evidence" | "knowledge" | "provider_receipts" | "repository" | "subject";

export interface CheckInputSelector {
	readonly source: CheckInputSource;
	readonly refs: readonly string[];
	readonly required: boolean;
	readonly maximumBytes: number;
}

export interface CodeCheckImplementation {
	readonly kind: "code";
	readonly profile: string;
}

export interface ModelCheckImplementation {
	readonly kind: "model";
	readonly route: string;
	readonly profile: string;
	readonly maximumTokens: number;
}

export type CheckImplementation = CodeCheckImplementation | ModelCheckImplementation;

export type CheckMeasurementSpec =
	| Readonly<{kind: "binary"}>
	| Readonly<{kind: "quantitative"; minimum: number | null; maximum: number | null}>;

export interface CheckFailureContract {
	readonly code: string;
	readonly message: string;
	readonly remediation: readonly string[];
}

export interface CheckExecutionLimits {
	readonly timeoutMs: number;
	readonly maximumAttempts: number;
	readonly maximumInputBytes: number;
	readonly maximumOutputBytes: number;
}

export interface CheckDefinition {
	readonly schemaVersion: typeof CHECK_DEFINITION_SCHEMA_VERSION;
	readonly id: string;
	readonly version: string;
	readonly description: string;
	readonly requirement: string;
	readonly implementation: CheckImplementation;
	readonly inputs: readonly CheckInputSelector[];
	readonly measurement: CheckMeasurementSpec;
	readonly failure: CheckFailureContract;
	readonly limits: CheckExecutionLimits;
}

export function decodeCheckDefinition(input: unknown): Outcome<CheckDefinition, ContractIssue> {
	return decodeContract("Check Definition", input, (value) => {
		const record = exactRecord("Check Definition", value, "$", [
			"description",
			"failure",
			"id",
			"implementation",
			"inputs",
			"limits",
			"measurement",
			"requirement",
			"schemaVersion",
			"version",
		]);
		const schemaVersion = textField("Check Definition", record, "schemaVersion", "$", {maximumBytes: 32});
		if (schemaVersion !== CHECK_DEFINITION_SCHEMA_VERSION) {
			rejectContract("invalid_protocol", "Check Definition", "$.schemaVersion", `Expected ${CHECK_DEFINITION_SCHEMA_VERSION}.`);
		}
		return Object.freeze({
			schemaVersion: CHECK_DEFINITION_SCHEMA_VERSION,
			id: identifierField(record, "id", "$"),
			version: textField("Check Definition", record, "version", "$", {
				maximumBytes: 128,
				pattern: /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/u,
			}),
			description: textField("Check Definition", record, "description", "$", {maximumBytes: 4_096}),
			requirement: textField("Check Definition", record, "requirement", "$", {maximumBytes: 4_096}),
			implementation: decodeImplementation(requiredField("Check Definition", record, "implementation")),
			inputs: decodeInputs(arrayField("Check Definition", record, "inputs", "$", 32)),
			measurement: decodeMeasurement(requiredField("Check Definition", record, "measurement")),
			failure: decodeFailure(requiredField("Check Definition", record, "failure")),
			limits: decodeLimits(requiredField("Check Definition", record, "limits")),
		});
	});
}

export function checkDefinitionDigest(definition: CheckDefinition): Sha256Digest {
	const digest = semanticDigest(CHECK_DEFINITION_DIGEST_PROTOCOL, definition);
	if (!digest.ok) throw new Error(digest.error.message);
	return digest.value;
}

function decodeImplementation(value: CanonicalValue): CheckImplementation {
	const base = exactRecord("Check Definition", value, "$.implementation", ["kind"], ["maximumTokens", "profile", "route"]);
	const kind = literalField("Check Definition", base, "kind", ["code", "model"] as const, "$.implementation");
	if (kind === "code") {
		const record = exactRecord("Check Definition", value, "$.implementation", ["kind", "profile"]);
		return Object.freeze({kind, profile: identifierField(record, "profile", "$.implementation")});
	}
	const record = exactRecord("Check Definition", value, "$.implementation", ["kind", "maximumTokens", "profile", "route"]);
	return Object.freeze({
		kind,
		route: identifierField(record, "route", "$.implementation"),
		profile: identifierField(record, "profile", "$.implementation"),
		maximumTokens: integerField("Check Definition", record, "maximumTokens", "$.implementation", 1, 65_536),
	});
}

function decodeInputs(input: readonly CanonicalValue[]): readonly CheckInputSelector[] {
	const output = input.map((value, index) => {
		const path = `$.inputs[${index}]`;
		const record = exactRecord("Check Definition", value, path, ["maximumBytes", "refs", "required", "source"]);
		const refs = arrayField("Check Definition", record, "refs", path, 64).map((entry, refIndex) =>
			textValue("Check Definition", entry, `${path}.refs[${refIndex}]`, {maximumBytes: 512}));
		if (new Set(refs).size !== refs.length) rejectContract("invalid_field", "Check Definition", `${path}.refs`, "Input refs must be unique.");
		return Object.freeze({
			source: literalField("Check Definition", record, "source", ["evidence", "knowledge", "provider_receipts", "repository", "subject"] as const, path),
			refs: Object.freeze(refs),
			required: booleanField("Check Definition", record, "required", path),
			maximumBytes: integerField("Check Definition", record, "maximumBytes", path, 1, 1_048_576),
		});
	});
	return Object.freeze(output);
}

function decodeMeasurement(value: CanonicalValue): CheckMeasurementSpec {
	const base = exactRecord("Check Definition", value, "$.measurement", ["kind"], ["maximum", "minimum"]);
	const kind = literalField("Check Definition", base, "kind", ["binary", "quantitative"] as const, "$.measurement");
	if (kind === "binary") {
		exactRecord("Check Definition", value, "$.measurement", ["kind"]);
		return Object.freeze({kind});
	}
	const record = exactRecord("Check Definition", value, "$.measurement", ["kind"], ["maximum", "minimum"]);
	const minimum = optionalFiniteNumber(record.minimum, "$.measurement.minimum");
	const maximum = optionalFiniteNumber(record.maximum, "$.measurement.maximum");
	if (minimum === null && maximum === null) rejectContract("missing_field", "Check Definition", "$.measurement", "Quantitative measurement requires a bound.");
	if (minimum !== null && maximum !== null && minimum > maximum) rejectContract("invalid_field", "Check Definition", "$.measurement", "Quantitative minimum cannot exceed maximum.");
	return Object.freeze({kind, minimum, maximum});
}

function decodeFailure(value: CanonicalValue): CheckFailureContract {
	const record = exactRecord("Check Definition", value, "$.failure", ["code", "message", "remediation"]);
	const remediation = arrayField("Check Definition", record, "remediation", "$.failure", 32).map((entry, index) =>
		textValue("Check Definition", entry, `$.failure.remediation[${index}]`, {maximumBytes: 4_096}));
	return Object.freeze({
		code: identifierField(record, "code", "$.failure"),
		message: textField("Check Definition", record, "message", "$.failure", {maximumBytes: 4_096}),
		remediation: Object.freeze(remediation),
	});
}

function decodeLimits(value: CanonicalValue): CheckExecutionLimits {
	const record = exactRecord("Check Definition", value, "$.limits", ["maximumAttempts", "maximumInputBytes", "maximumOutputBytes", "timeoutMs"]);
	return Object.freeze({
		timeoutMs: integerField("Check Definition", record, "timeoutMs", "$.limits", 1, 300_000),
		maximumAttempts: integerField("Check Definition", record, "maximumAttempts", "$.limits", 1, 3),
		maximumInputBytes: integerField("Check Definition", record, "maximumInputBytes", "$.limits", 1, 4_194_304),
		maximumOutputBytes: integerField("Check Definition", record, "maximumOutputBytes", "$.limits", 1, 1_048_576),
	});
}

function identifierField(record: Readonly<{[key: string]: CanonicalValue}>, field: string, path: string): string {
	return textField("Check Definition", record, field, path, {
		maximumBytes: 128,
		pattern: /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u,
	});
}

function optionalFiniteNumber(value: CanonicalValue | undefined, path: string): number | null {
	if (value === undefined) return null;
	if (typeof value !== "number" || !Number.isFinite(value)) rejectContract("invalid_field", "Check Definition", path, "Bound must be finite.");
	return value;
}
