import {
	decodeCanonicalValue,
	isCanonicalObject,
	type CanonicalIssue,
	type CanonicalLimits,
	type CanonicalValue,
} from "./canonical-json.ts";
import {failure, success, type Outcome} from "./outcome.ts";

export interface ProtocolIdentity {
	readonly id: string;
	readonly version: string;
}

export type ContractIssueCode =
	| "invalid_contract"
	| "invalid_field"
	| "invalid_protocol"
	| "limit_exceeded"
	| "missing_field"
	| "non_canonical_order"
	| "unknown_field";

export interface ContractIssue {
	readonly code: ContractIssueCode;
	readonly contract: string;
	readonly path: string;
	readonly message: string;
	readonly cause?: CanonicalIssue;
}

class ContractFailure extends Error {
	readonly issue: ContractIssue;

	constructor(issue: ContractIssue) {
		super(issue.message);
		this.name = "ContractFailure";
		this.issue = issue;
	}
}

export type CanonicalRecord = Readonly<{[key: string]: CanonicalValue}>;

export function protocolIdentity(id: string, version: string): ProtocolIdentity {
	if (!/^[a-z][a-z0-9.-]{0,255}$/u.test(id) || !isVersion(version)) {
		throw new Error("Protocol identity constants must be canonical.");
	}
	return Object.freeze({id, version});
}

export function decodeContract<Value>(
	contract: string,
	input: unknown,
	decode: (value: CanonicalValue) => Value,
	limits?: CanonicalLimits,
): Outcome<Value, ContractIssue> {
	const canonical = decodeCanonicalValue(input, limits);
	if (!canonical.ok) {
		return failure(contractIssue(
			"invalid_contract",
			contract,
			"$",
			`${contract} must be a bounded canonical value.`,
			canonical.error,
		));
	}
	try {
		return success(decode(canonical.value));
	} catch (error) {
		if (error instanceof ContractFailure) return failure(error.issue);
		return failure(contractIssue(
			"invalid_contract",
			contract,
			"$",
			`${contract} could not be decoded safely.`,
		));
	}
}

export function exactRecord(
	contract: string,
	value: CanonicalValue,
	path: string,
	required: readonly string[],
	optional: readonly string[] = [],
): CanonicalRecord {
	if (!isCanonicalObject(value)) rejectContract("invalid_field", contract, path, "Value must be an object.");
	const permitted = new Set([...required, ...optional]);
	for (const field of required) {
		if (!(field in value)) rejectContract("missing_field", contract, `${path}.${field}`, "Required field is absent.");
	}
	for (const field of Object.keys(value)) {
		if (!permitted.has(field)) rejectContract("unknown_field", contract, `${path}.${field}`, "Field is not supported.");
	}
	return value;
}

export function protocolField(
	contract: string,
	record: CanonicalRecord,
	path: string,
	expected: ProtocolIdentity,
): ProtocolIdentity {
	const raw = exactRecord(contract, requiredField(contract, record, "protocol", path), `${path}.protocol`, ["id", "version"]);
	const id = textField(contract, raw, "id", `${path}.protocol`, {maximumBytes: 256, pattern: /^[a-z][a-z0-9.-]*$/u});
	const version = textField(contract, raw, "version", `${path}.protocol`, {maximumBytes: 64, pattern: /^\d+\.\d+\.\d+$/u});
	if (id !== expected.id || version !== expected.version) {
		rejectContract("invalid_protocol", contract, `${path}.protocol`, `Expected ${expected.id}@${expected.version}.`);
	}
	return expected;
}

export function requiredField(
	contract: string,
	record: CanonicalRecord,
	field: string,
	path = "$",
): CanonicalValue {
	const value = record[field];
	if (value === undefined) rejectContract("missing_field", contract, `${path}.${field}`, "Required field is absent.");
	return value;
}

export function textValue(
	contract: string,
	value: CanonicalValue,
	path: string,
	options: Readonly<{
		minimumBytes?: number;
		maximumBytes?: number;
		pattern?: RegExp;
	}> = {},
): string {
	if (typeof value !== "string") rejectContract("invalid_field", contract, path, "Value must be text.");
	const bytes = new TextEncoder().encode(value).byteLength;
	const minimum = options.minimumBytes ?? 1;
	const maximum = options.maximumBytes ?? 65_536;
	if (bytes < minimum || bytes > maximum) rejectContract("limit_exceeded", contract, path, `Text must contain ${minimum}..${maximum} UTF-8 bytes.`);
	if (value.normalize("NFC") !== value) rejectContract("invalid_field", contract, path, "Text must be NFC-normalized.");
	if (value.includes("\0")) rejectContract("invalid_field", contract, path, "Text cannot contain NUL.");
	if (options.pattern && !options.pattern.test(value)) rejectContract("invalid_field", contract, path, "Text has invalid syntax.");
	return value;
}

export function textField(
	contract: string,
	record: CanonicalRecord,
	field: string,
	path = "$",
	options?: Parameters<typeof textValue>[3],
): string {
	return textValue(contract, requiredField(contract, record, field, path), `${path}.${field}`, options);
}

export function optionalTextField(
	contract: string,
	record: CanonicalRecord,
	field: string,
	path = "$",
	options?: Parameters<typeof textValue>[3],
): string | null {
	const value = record[field];
	if (value === undefined || value === null) return null;
	return textValue(contract, value, `${path}.${field}`, options);
}

export function booleanField(contract: string, record: CanonicalRecord, field: string, path = "$"): boolean {
	const value = requiredField(contract, record, field, path);
	if (typeof value !== "boolean") rejectContract("invalid_field", contract, `${path}.${field}`, "Value must be boolean.");
	return value;
}

export function integerValue(
	contract: string,
	value: CanonicalValue,
	path: string,
	minimum = 0,
	maximum = Number.MAX_SAFE_INTEGER,
): number {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
		rejectContract("invalid_field", contract, path, `Value must be an integer from ${minimum} through ${maximum}.`);
	}
	return value;
}

export function integerField(
	contract: string,
	record: CanonicalRecord,
	field: string,
	path = "$",
	minimum = 0,
	maximum = Number.MAX_SAFE_INTEGER,
): number {
	return integerValue(contract, requiredField(contract, record, field, path), `${path}.${field}`, minimum, maximum);
}

export function arrayValue(
	contract: string,
	value: CanonicalValue,
	path: string,
	maximum = 4_096,
): readonly CanonicalValue[] {
	if (!Array.isArray(value)) rejectContract("invalid_field", contract, path, "Value must be an array.");
	if (value.length > maximum) rejectContract("limit_exceeded", contract, path, `Array cannot exceed ${maximum} entries.`);
	return value;
}

export function arrayField(
	contract: string,
	record: CanonicalRecord,
	field: string,
	path = "$",
	maximum = 4_096,
): readonly CanonicalValue[] {
	return arrayValue(contract, requiredField(contract, record, field, path), `${path}.${field}`, maximum);
}

export function sortedUniqueTextArray(
	contract: string,
	value: CanonicalValue,
	path: string,
	options: Readonly<{
		maximumEntries?: number;
		maximumBytes?: number;
		pattern?: RegExp;
	}> = {},
): readonly string[] {
	const input = arrayValue(contract, value, path, options.maximumEntries ?? 4_096);
	const output = input.map((entry, index) => textValue(contract, entry, `${path}[${index}]`, {
		maximumBytes: options.maximumBytes,
		pattern: options.pattern,
	}));
	for (let index = 1; index < output.length; index += 1) {
		if ((output[index - 1] ?? "") >= (output[index] ?? "")) {
			rejectContract("non_canonical_order", contract, path, "Values must be strictly sorted and unique.");
		}
	}
	return Object.freeze(output);
}

export function optionalSortedUniqueTextArray(
	contract: string,
	record: CanonicalRecord,
	field: string,
	path = "$",
	options?: Parameters<typeof sortedUniqueTextArray>[3],
): readonly string[] {
	const value = record[field];
	return value === undefined
		? Object.freeze([])
		: sortedUniqueTextArray(contract, value, `${path}.${field}`, options);
}

export function literalValue<const Value extends string>(
	contract: string,
	value: CanonicalValue,
	path: string,
	allowed: readonly Value[],
): Value {
	if (typeof value !== "string" || !allowed.includes(value as Value)) {
		rejectContract("invalid_field", contract, path, `Value must be one of: ${allowed.join(", ")}.`);
	}
	return value as Value;
}

export function literalField<const Value extends string>(
	contract: string,
	record: CanonicalRecord,
	field: string,
	allowed: readonly Value[],
	path = "$",
): Value {
	return literalValue(contract, requiredField(contract, record, field, path), `${path}.${field}`, allowed);
}

export function nullableValue<Value>(
	value: CanonicalValue,
	decode: (value: CanonicalValue) => Value,
): Value | null {
	return value === null ? null : decode(value);
}

export function assertDigestMatch(
	contract: string,
	path: string,
	actual: string,
	expected: string,
): void {
	if (actual !== expected) rejectContract("invalid_field", contract, path, "Semantic digest does not match canonical content.");
}

export function rejectContract(
	code: ContractIssueCode,
	contract: string,
	path: string,
	message: string,
): never {
	throw new ContractFailure(contractIssue(code, contract, path, message));
}

export function isNamespacedIdentifier(value: string): boolean {
	return value.length <= 256 && value.normalize("NFC") === value && /^[a-z][a-z0-9.-]*(?::[A-Za-z0-9][A-Za-z0-9._:@/-]*)+$/u.test(value);
}

export function isIdentifier(value: string): boolean {
	return value.length <= 256 && value.normalize("NFC") === value && /^[A-Za-z][A-Za-z0-9._:@/-]*$/u.test(value);
}

function isVersion(value: string): boolean {
	return /^\d+\.\d+\.\d+$/u.test(value);
}

function contractIssue(
	code: ContractIssueCode,
	contract: string,
	path: string,
	message: string,
	cause?: CanonicalIssue,
): ContractIssue {
	return cause === undefined
		? Object.freeze({code, contract, path, message})
		: Object.freeze({code, contract, path, message, cause});
}
