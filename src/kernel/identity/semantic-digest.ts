import {canonicalJson, type CanonicalIssue} from "../canonical/json.ts";
import {failure, success, type Outcome} from "../canonical/outcome.ts";
import {base32Lowercase} from "./base32.ts";
import {sha256Digest, type Sha256Digest} from "./sha256.ts";

export type SemanticIdentityIssueCode =
	| "invalid_namespace"
	| "invalid_protocol"
	| "invalid_value";

export interface SemanticIdentityIssue {
	readonly code: SemanticIdentityIssueCode;
	readonly message: string;
	readonly cause?: CanonicalIssue;
}

const UTF8 = new TextEncoder();

export function semanticDigest(
	protocol: string,
	value: unknown,
): Outcome<Sha256Digest, SemanticIdentityIssue> {
	const protocolIssue = validateBoundedText(protocol, "protocol", 256);
	if (protocolIssue) return failure(protocolIssue);
	if (protocol.includes("\0")) {
		return failure(identityIssue("invalid_protocol", "Protocol cannot contain NUL."));
	}
	const encoded = canonicalJson(value);
	if (!encoded.ok) {
		return failure(identityIssue("invalid_value", "Semantic value is not canonical.", encoded.error));
	}
	const protocolBytes = UTF8.encode(protocol);
	const valueBytes = UTF8.encode(encoded.value);
	const framed = new Uint8Array(protocolBytes.byteLength + 1 + valueBytes.byteLength);
	framed.set(protocolBytes);
	framed[protocolBytes.byteLength] = 0;
	framed.set(valueBytes, protocolBytes.byteLength + 1);
	return success(sha256Digest(framed));
}

export function semanticId(
	namespace: string,
	protocol: string,
	value: unknown,
): Outcome<string, SemanticIdentityIssue> {
	const namespaceIssue = validateNamespace(namespace);
	if (namespaceIssue) return failure(namespaceIssue);
	const digest = semanticDigest(protocol, value);
	if (!digest.ok) return digest;
	const digestBytes = hexBytes(digest.value.slice("sha256:".length));
	return success(`${namespace}:${base32Lowercase(digestBytes)}`);
}

export function canonicalValueDigest(
	value: unknown,
): Outcome<Sha256Digest, SemanticIdentityIssue> {
	const encoded = canonicalJson(value);
	return encoded.ok
		? success(sha256Digest(encoded.value))
		: failure(identityIssue("invalid_value", "Value is not canonical.", encoded.error));
}

function validateNamespace(namespace: string): SemanticIdentityIssue | null {
	const textIssue = validateBoundedText(namespace, "namespace", 128);
	if (textIssue) return identityIssue("invalid_namespace", textIssue.message);
	if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*(?::[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*)*$/.test(namespace)) {
		return identityIssue("invalid_namespace", "Namespace is not canonical.");
	}
	return null;
}

function validateBoundedText(
	value: string,
	field: "namespace" | "protocol",
	maximumBytes: number,
): SemanticIdentityIssue | null {
	const code = field === "namespace" ? "invalid_namespace" : "invalid_protocol";
	if (typeof value !== "string" || value.normalize("NFC") !== value) {
		return identityIssue(code, `${field} must be NFC text.`);
	}
	const bytes = UTF8.encode(value).byteLength;
	if (bytes < 1 || bytes > maximumBytes) {
		return identityIssue(code, `${field} must contain 1..${maximumBytes} UTF-8 bytes.`);
	}
	return null;
}

function hexBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let index = 0; index < bytes.length; index += 1) {
		bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
	}
	return bytes;
}

function identityIssue(
	code: SemanticIdentityIssueCode,
	message: string,
	cause?: CanonicalIssue,
): SemanticIdentityIssue {
	return cause === undefined
		? Object.freeze({code, message})
		: Object.freeze({code, message, cause});
}
