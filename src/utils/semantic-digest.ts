import {createHash} from "node:crypto";
import {
	canonicalJson,
	parseCanonicalJson,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "./canonical-json.ts";

const MAX_MAP_ENTRIES = 128;
const MAX_ARRAY_ENTRIES = 256;
const MAX_STRING_BYTES = 16_384;

export function canonicalSemanticJson(value: unknown): string {
	assertSemanticJsonValue(value);
	const text = canonicalJson(value);
	assertSemanticJsonValue(parseCanonicalJson(text));
	return text;
}

export function parseCanonicalSemanticJson(text: string): CanonicalJsonValue {
	const value = parseCanonicalJson(text);
	assertSemanticJsonValue(value);
	return value;
}

export function semanticDigest(protocol: string, value: unknown): Sha256Digest {
	assertNfcString(protocol, "protocol", 1, 256);
	const hash = createHash("sha256");
	hash.update(protocol, "utf8");
	hash.update(Buffer.from([0]));
	hash.update(canonicalSemanticJson(value), "utf8");
	return `sha256:${hash.digest("hex")}`;
}

export function assertSemanticJsonValue(
	value: unknown,
	path = "$",
): asserts value is CanonicalJsonValue {
	if (value === null || typeof value === "boolean") return;
	if (typeof value === "string") {
		assertNfcString(value, path, 0, MAX_STRING_BYTES);
		return;
	}
	if (typeof value === "number") {
		if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
			throw new Error(`${path} must be a safe integer.`);
		}
		return;
	}
	if (Array.isArray(value)) {
		if (value.length > MAX_ARRAY_ENTRIES) {
			throw new Error(`${path} exceeds ${MAX_ARRAY_ENTRIES} entries.`);
		}
		value.forEach((entry, index) =>
			assertSemanticJsonValue(entry, `${path}[${index}]`),
		);
		return;
	}
	if (typeof value !== "object") {
		throw new Error(`${path} must be a JSON value.`);
	}
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) {
		throw new Error(`${path} must be a plain object.`);
	}
	const entries = Object.entries(value);
	if (entries.length > MAX_MAP_ENTRIES) {
		throw new Error(`${path} exceeds ${MAX_MAP_ENTRIES} entries.`);
	}
	for (const [key, entry] of entries) {
		assertNfcString(key, `${path} key`, 1, 256);
		assertSemanticJsonValue(entry, `${path}.${key}`);
	}
}

export function assertNfcString(
	value: unknown,
	field: string,
	minimumBytes: number,
	maximumBytes: number,
): asserts value is string {
	if (typeof value !== "string") {
		throw new Error(`${field} must be a string.`);
	}
	if (value.normalize("NFC") !== value) {
		throw new Error(`${field} must use NFC.`);
	}
	const bytes = Buffer.byteLength(value, "utf8");
	if (bytes < minimumBytes || bytes > maximumBytes) {
		throw new Error(
			`${field} must contain ${minimumBytes}..${maximumBytes} UTF-8 bytes.`,
		);
	}
}
