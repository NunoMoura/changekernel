import {failure, success, type Outcome} from "./outcome.ts";

export type CanonicalPrimitive = null | boolean | number | string;
export type CanonicalValue =
	| CanonicalPrimitive
	| readonly CanonicalValue[]
	| Readonly<{[key: string]: CanonicalValue}>;

export type CanonicalIssueCode =
	| "access_failed"
	| "accessor_property"
	| "cyclic_value"
	| "invalid_key"
	| "invalid_limit"
	| "invalid_number"
	| "invalid_type"
	| "non_canonical_text"
	| "non_enumerable_property"
	| "non_plain_object"
	| "sparse_array"
	| "symbol_property"
	| "too_deep"
	| "too_many_entries"
	| "too_many_nodes"
	| "too_much_text";

export interface CanonicalIssue {
	readonly code: CanonicalIssueCode;
	readonly path: string;
	readonly message: string;
}

export interface CanonicalLimits {
	readonly maximumDepth: number;
	readonly maximumEntriesPerContainer: number;
	readonly maximumNodes: number;
	readonly maximumTextBytes: number;
}

export const DEFAULT_CANONICAL_LIMITS: CanonicalLimits = Object.freeze({
	maximumDepth: 64,
	maximumEntriesPerContainer: 4_096,
	maximumNodes: 100_000,
	maximumTextBytes: 4 * 1_024 * 1_024,
});

class DecodeFailure {
	readonly issue: CanonicalIssue;

	constructor(issue: CanonicalIssue) {
		this.issue = issue;
	}
}

interface DecodeState {
	readonly limits: CanonicalLimits;
	readonly ancestors: Set<object>;
	nodes: number;
	textBytes: number;
}

interface InspectableObject {
	readonly [key: string]: unknown;
	readonly [key: symbol]: unknown;
}

const UTF8 = new TextEncoder();

export function decodeCanonicalValue(
	input: unknown,
	limits: CanonicalLimits = DEFAULT_CANONICAL_LIMITS,
): Outcome<CanonicalValue, CanonicalIssue> {
	const limitsIssue = validateLimits(limits);
	if (limitsIssue) return failure(limitsIssue);
	const state: DecodeState = {
		limits,
		ancestors: new Set<object>(),
		nodes: 0,
		textBytes: 0,
	};
	try {
		return success(decode(input, "$", 0, state));
	} catch (error) {
		if (error instanceof DecodeFailure) return failure(error.issue);
		return failure(issue("access_failed", "$", "Value could not be inspected safely."));
	}
}

export function canonicalJson(
	input: unknown,
	limits: CanonicalLimits = DEFAULT_CANONICAL_LIMITS,
): Outcome<string, CanonicalIssue> {
	const decoded = decodeCanonicalValue(input, limits);
	return decoded.ok ? success(encodeCanonicalValue(decoded.value)) : decoded;
}

export function encodeCanonicalValue(value: CanonicalValue): string {
	return JSON.stringify(value);
}

export function parseCanonicalJson(
	text: string,
	options: Readonly<{
		limits?: CanonicalLimits;
		requireCanonicalBytes?: boolean;
	}> = {},
): Outcome<CanonicalValue, CanonicalIssue> {
	const limits = options.limits ?? DEFAULT_CANONICAL_LIMITS;
	const limitsIssue = validateLimits(limits);
	if (limitsIssue) return failure(limitsIssue);
	if (text.normalize("NFC") !== text) {
		return failure(issue("non_canonical_text", "$", "JSON text must use NFC normalization."));
	}
	if (UTF8.encode(text).byteLength > limits.maximumTextBytes) {
		return failure(issue("too_much_text", "$", "JSON text exceeds the UTF-8 byte limit."));
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return failure(issue("invalid_type", "$", "Value must be valid JSON."));
	}
	const decoded = decodeCanonicalValue(parsed, limits);
	if (!decoded.ok) return decoded;
	if (options.requireCanonicalBytes && encodeCanonicalValue(decoded.value) !== text) {
		return failure(issue("non_canonical_text", "$", "JSON bytes are not canonical."));
	}
	return decoded;
}

export function isCanonicalObject(
	value: CanonicalValue,
): value is Readonly<{[key: string]: CanonicalValue}> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function decode(
	input: unknown,
	path: string,
	depth: number,
	state: DecodeState,
): CanonicalValue {
	state.nodes += 1;
	if (state.nodes > state.limits.maximumNodes) {
		reject("too_many_nodes", path, "Value exceeds the node limit.");
	}
	if (depth > state.limits.maximumDepth) {
		reject("too_deep", path, "Value exceeds the depth limit.");
	}
	if (input === null || typeof input === "boolean") return input;
	if (typeof input === "string") {
		consumeText(input, path, state);
		return input;
	}
	if (typeof input === "number") {
		if (!Number.isFinite(input)) {
			reject("invalid_number", path, "Number must be finite.");
		}
		return Object.is(input, -0) ? 0 : input;
	}
	if (typeof input !== "object") {
		reject("invalid_type", path, `${typeof input} is not a canonical value.`);
	}
	if (state.ancestors.has(input)) {
		reject("cyclic_value", path, "Value contains a cycle.");
	}
	state.ancestors.add(input);
	try {
		return Array.isArray(input)
			? decodeArray(input, path, depth, state)
			// SAFETY: input is a non-null object; decodeObject validates its prototype, keys, and descriptors.
			: decodeObject(input as InspectableObject, path, depth, state);
	} finally {
		state.ancestors.delete(input);
	}
}

function decodeArray(
	input: unknown[],
	path: string,
	depth: number,
	state: DecodeState,
): readonly CanonicalValue[] {
	if (Object.getPrototypeOf(input) !== Array.prototype) {
		reject("non_plain_object", path, "Array must use the intrinsic Array prototype.");
	}
	if (input.length > state.limits.maximumEntriesPerContainer) {
		reject("too_many_entries", path, "Array exceeds the entry limit.");
	}
	const keys = Reflect.ownKeys(input);
	for (const key of keys) {
		if (typeof key === "symbol") {
			reject("symbol_property", path, "Array cannot contain symbol properties.");
		}
		if (key === "length") continue;
		if (!isArrayIndex(key, input.length)) {
			reject("invalid_key", propertyPath(path, key), "Array contains a non-index property.");
		}
	}
	const output: CanonicalValue[] = [];
	for (let index = 0; index < input.length; index += 1) {
		const key = String(index);
		const descriptor = Object.getOwnPropertyDescriptor(input, key);
		if (!descriptor) reject("sparse_array", `${path}[${key}]`, "Array cannot be sparse.");
		assertDataDescriptor(descriptor, `${path}[${key}]`);
		output.push(decode(descriptor.value, `${path}[${key}]`, depth + 1, state));
	}
	return Object.freeze(output);
}

function decodeObject(
	input: InspectableObject,
	path: string,
	depth: number,
	state: DecodeState,
): Readonly<{[key: string]: CanonicalValue}> {
	const prototype = Object.getPrototypeOf(input);
	if (prototype !== Object.prototype && prototype !== null) {
		reject("non_plain_object", path, "Object must be plain or have a null prototype.");
	}
	const ownKeys = Reflect.ownKeys(input);
	if (ownKeys.length > state.limits.maximumEntriesPerContainer) {
		reject("too_many_entries", path, "Object exceeds the entry limit.");
	}
	const keys: string[] = [];
	for (const key of ownKeys) {
		if (typeof key === "symbol") {
			reject("symbol_property", path, "Object cannot contain symbol properties.");
		}
		consumeText(key, propertyPath(path, key), state);
		keys.push(key);
	}
	keys.sort(compareText);
	const output: {[key: string]: CanonicalValue} = Object.create(null) as {
		[key: string]: CanonicalValue;
	};
	for (const key of keys) {
		const descriptor = Object.getOwnPropertyDescriptor(input, key);
		if (!descriptor) {
			reject("access_failed", propertyPath(path, key), "Property disappeared during inspection.");
		}
		assertDataDescriptor(descriptor, propertyPath(path, key));
		output[key] = decode(descriptor.value, propertyPath(path, key), depth + 1, state);
	}
	return Object.freeze(output);
}

function assertDataDescriptor(
	descriptor: PropertyDescriptor,
	path: string,
): asserts descriptor is PropertyDescriptor & {value: unknown} {
	if (!("value" in descriptor)) {
		reject("accessor_property", path, "Accessor properties are not canonical data.");
	}
	if (!descriptor.enumerable) {
		reject("non_enumerable_property", path, "Properties must be enumerable.");
	}
}

function consumeText(value: string, path: string, state: DecodeState): void {
	if (value.normalize("NFC") !== value) {
		reject("non_canonical_text", path, "Text must use NFC normalization.");
	}
	state.textBytes += UTF8.encode(value).byteLength;
	if (state.textBytes > state.limits.maximumTextBytes) {
		reject("too_much_text", path, "Value exceeds the UTF-8 text limit.");
	}
}

function validateLimits(limits: CanonicalLimits): CanonicalIssue | null {
	for (const [name, value] of Object.entries(limits)) {
		if (!Number.isSafeInteger(value) || value < 1) {
			return issue("invalid_limit", "$", `${name} must be a positive safe integer.`);
		}
	}
	return null;
}

function isArrayIndex(key: string, length: number): boolean {
	if (!/^(0|[1-9][0-9]*)$/.test(key)) return false;
	const index = Number(key);
	return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

function propertyPath(path: string, key: string): string {
	return `${path}[${JSON.stringify(key)}]`;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function issue(code: CanonicalIssueCode, path: string, message: string): CanonicalIssue {
	return Object.freeze({code, path, message});
}

function reject(code: CanonicalIssueCode, path: string, message: string): never {
	throw new DecodeFailure(issue(code, path, message));
}
