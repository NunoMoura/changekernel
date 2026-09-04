import {
	assertDigestMatch,
	booleanField,
	decodeContract,
	exactRecord,
	isNamespacedIdentifier,
	literalField,
	protocolField,
	protocolIdentity,
	rejectContract,
	requiredField,
	textField,
	type CanonicalRecord,
	type ContractIssue,
} from "../../kernel/canonical/contract.ts";
import {decodeCanonicalValue, type CanonicalIssue, type CanonicalValue} from "../../kernel/canonical/json.ts";
import {failure, success, type Outcome} from "../../kernel/canonical/outcome.ts";
import {semanticDigest, type SemanticIdentityIssue} from "../../kernel/identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {
	PRODUCT_READ_OPERATIONS,
	decodeProductReadInput,
	type ProductReadInput,
	type ProductReadOperation,
} from "../contracts/read.ts";

export const PRODUCT_TRANSPORT_REQUEST_PROTOCOL = protocolIdentity("codewiki.product-request", "1.0.0");
export const PRODUCT_TRANSPORT_RESPONSE_PROTOCOL = protocolIdentity("codewiki.product-response", "1.0.0");
export const PRODUCT_CLIENT_KINDS = Object.freeze(["app", "cli", "agent", "mcp", "sdk", "other"] as const);
export const PRODUCT_ERROR_CODES = Object.freeze([
	"authentication_required",
	"authorization_denied",
	"expired_request",
	"idempotency_conflict",
	"internal_failure",
	"invalid_project_state",
	"invalid_request",
	"limit_exceeded",
	"not_found",
	"source_not_found",
	"source_stale",
	"transport_unavailable",
	"unavailable",
] as const);

export type ProductClientKind = (typeof PRODUCT_CLIENT_KINDS)[number];
export type ProductErrorCode = (typeof PRODUCT_ERROR_CODES)[number];

export interface ProductClientIdentity {
	readonly kind: ProductClientKind;
	readonly instanceId: string;
}

export interface ProductAuthentication {
	readonly identityRef: string;
	readonly proof: string;
}

export interface ProductTransportRequestBody {
	readonly protocol: typeof PRODUCT_TRANSPORT_REQUEST_PROTOCOL;
	readonly requestId: string;
	readonly repositoryId: string;
	readonly client: ProductClientIdentity;
	readonly authentication: ProductAuthentication;
	readonly expiresAt: string;
	readonly operation: ProductReadOperation;
	readonly input: CanonicalValue;
}

export interface ProductTransportRequest extends ProductTransportRequestBody {
	readonly requestDigest: Sha256Digest;
}

export interface ProductError {
	readonly code: ProductErrorCode;
	readonly message: string;
	readonly nextAction: string;
	readonly userActionRequired: boolean;
}

export interface ProductTransportResponseBody {
	readonly protocol: typeof PRODUCT_TRANSPORT_RESPONSE_PROTOCOL;
	readonly requestId: string;
	readonly requestDigest: Sha256Digest;
	readonly operation: ProductReadOperation;
	readonly status: "ok" | "error";
	readonly data: CanonicalValue | null;
	readonly binding: CanonicalValue | null;
	readonly error: ProductError | null;
}

export interface ProductTransportResponse extends ProductTransportResponseBody {
	readonly responseDigest: Sha256Digest;
}

export type TransportEnvelopeIssue = CanonicalIssue | ContractIssue | SemanticIdentityIssue;

const REQUEST_CONTRACT = "codewiki.product-request@1.0.0";
const RESPONSE_CONTRACT = "codewiki.product-response@1.0.0";
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;

export function createProductTransportRequest(input: Readonly<{
	requestId: string;
	repositoryId: string;
	client: ProductClientIdentity;
	authentication: ProductAuthentication;
	expiresAt: string;
	operation: ProductReadOperation;
	input: ProductReadInput;
}>): Outcome<ProductTransportRequest, TransportEnvelopeIssue> {
	const canonicalInput = decodeProductReadInput(input.operation, input.input);
	if (!canonicalInput.ok) return canonicalInput;
	const body = Object.freeze({
		protocol: PRODUCT_TRANSPORT_REQUEST_PROTOCOL,
		requestId: input.requestId,
		repositoryId: input.repositoryId,
		client: input.client,
		authentication: input.authentication,
		expiresAt: input.expiresAt,
		operation: input.operation,
		input: canonicalInput.value,
	});
	const digest = semanticDigest(`${REQUEST_CONTRACT}/request`, body);
	if (!digest.ok) return failure(digest.error);
	return decodeProductTransportRequest({...body, requestDigest: digest.value});
}

export function decodeProductTransportRequest(
	input: unknown,
): Outcome<ProductTransportRequest, TransportEnvelopeIssue> {
	return decodeContract(REQUEST_CONTRACT, input, (value) => {
		const record = exactRecord(REQUEST_CONTRACT, value, "$", [
			"protocol", "requestId", "repositoryId", "client", "authentication", "expiresAt", "operation", "input", "requestDigest",
		]);
		protocolField(REQUEST_CONTRACT, record, "$", PRODUCT_TRANSPORT_REQUEST_PROTOCOL);
		const body = Object.freeze({
			protocol: PRODUCT_TRANSPORT_REQUEST_PROTOCOL,
			requestId: namespacedField(record, "requestId"),
			repositoryId: namespacedField(record, "repositoryId"),
			client: decodeClient(requiredField(REQUEST_CONTRACT, record, "client")),
			authentication: decodeAuthentication(requiredField(REQUEST_CONTRACT, record, "authentication")),
			expiresAt: timestampField(record, "expiresAt"),
			operation: literalField(REQUEST_CONTRACT, record, "operation", PRODUCT_READ_OPERATIONS),
			input: requiredField(REQUEST_CONTRACT, record, "input"),
		});
		const requestDigest = digestField(record, "requestDigest");
		const expected = semanticDigest(`${REQUEST_CONTRACT}/request`, body);
		if (!expected.ok) rejectContract("invalid_contract", REQUEST_CONTRACT, "$", expected.error.message);
		assertDigestMatch(REQUEST_CONTRACT, "$.requestDigest", requestDigest, expected.value);
		return Object.freeze({...body, requestDigest});
	});
}

export function createProductTransportResponse(
	request: Pick<ProductTransportRequest, "requestId" | "requestDigest" | "operation">,
	outcome: Outcome<unknown, ProductError>,
	binding: unknown | null = null,
): Outcome<ProductTransportResponse, TransportEnvelopeIssue> {
	const normalized = normalizeResponseOutcome(outcome);
	if (!normalized.ok) return normalized;
	const normalizedBinding = binding === null ? success(null) : decodeCanonicalValue(binding);
	if (!normalizedBinding.ok) return failure(normalizedBinding.error);
	const body: ProductTransportResponseBody = Object.freeze({
		protocol: PRODUCT_TRANSPORT_RESPONSE_PROTOCOL,
		requestId: request.requestId,
		requestDigest: request.requestDigest,
		operation: request.operation,
		status: normalized.value.ok ? "ok" : "error",
		data: normalized.value.ok ? normalized.value.value : null,
		binding: normalizedBinding.value,
		error: normalized.value.ok ? null : normalized.value.error,
	});
	const digest = semanticDigest(`${RESPONSE_CONTRACT}/response`, body);
	if (!digest.ok) return failure(digest.error);
	return decodeProductTransportResponse({...body, responseDigest: digest.value});
}

export function decodeProductTransportResponse(
	input: unknown,
): Outcome<ProductTransportResponse, TransportEnvelopeIssue> {
	return decodeContract(RESPONSE_CONTRACT, input, (value) => {
		const record = exactRecord(RESPONSE_CONTRACT, value, "$", [
			"protocol", "requestId", "requestDigest", "operation", "status", "data", "binding", "error", "responseDigest",
		]);
		protocolField(RESPONSE_CONTRACT, record, "$", PRODUCT_TRANSPORT_RESPONSE_PROTOCOL);
		const status = literalField(RESPONSE_CONTRACT, record, "status", ["ok", "error"] as const);
		const data = requiredField(RESPONSE_CONTRACT, record, "data");
		const binding = requiredField(RESPONSE_CONTRACT, record, "binding");
		const rawError = requiredField(RESPONSE_CONTRACT, record, "error");
		if (status === "ok" && (data === null || rawError !== null)) {
			rejectContract("invalid_field", RESPONSE_CONTRACT, "$.status", "Successful response requires data and no error.");
		}
		if (status === "error" && (data !== null || rawError === null)) {
			rejectContract("invalid_field", RESPONSE_CONTRACT, "$.status", "Failed response requires an error and no data.");
		}
		const body: ProductTransportResponseBody = Object.freeze({
			protocol: PRODUCT_TRANSPORT_RESPONSE_PROTOCOL,
			requestId: namespacedField(record, "requestId", RESPONSE_CONTRACT),
			requestDigest: digestField(record, "requestDigest", RESPONSE_CONTRACT),
			operation: literalField(RESPONSE_CONTRACT, record, "operation", PRODUCT_READ_OPERATIONS),
			status,
			data,
			binding,
			error: rawError === null ? null : decodeProductError(rawError),
		});
		const responseDigest = digestField(record, "responseDigest", RESPONSE_CONTRACT);
		const expected = semanticDigest(`${RESPONSE_CONTRACT}/response`, body);
		if (!expected.ok) rejectContract("invalid_contract", RESPONSE_CONTRACT, "$", expected.error.message);
		assertDigestMatch(RESPONSE_CONTRACT, "$.responseDigest", responseDigest, expected.value);
		return Object.freeze({...body, responseDigest});
	});
}

export function productError(
	code: ProductErrorCode,
	message: string,
	nextAction: string,
	userActionRequired: boolean,
): ProductError {
	return Object.freeze({code, message, nextAction, userActionRequired});
}

export function isCanonicalRequestTimestamp(value: string): boolean {
	if (!TIMESTAMP.test(value)) return false;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) && new Date(parsed).toISOString().replace(".000Z", "Z") === value;
}

function normalizeResponseOutcome(
	outcome: Outcome<unknown, ProductError>,
): Outcome<Outcome<CanonicalValue, ProductError>, TransportEnvelopeIssue> {
	if (!outcome.ok) {
		const decoded = decodeCanonicalValue(outcome.error);
		if (!decoded.ok) return failure(decoded.error);
		return success(failure(decodeProductError(decoded.value)));
	}
	const decoded = decodeCanonicalValue(outcome.value);
	if (!decoded.ok) return failure(decoded.error);
	return success(success(decoded.value));
}

function decodeClient(value: CanonicalValue): ProductClientIdentity {
	const record = exactRecord(REQUEST_CONTRACT, value, "$.client", ["kind", "instanceId"]);
	return Object.freeze({
		kind: literalField(REQUEST_CONTRACT, record, "kind", PRODUCT_CLIENT_KINDS, "$.client"),
		instanceId: namespacedField(record, "instanceId", REQUEST_CONTRACT, "$.client"),
	});
}

function decodeAuthentication(value: CanonicalValue): ProductAuthentication {
	const record = exactRecord(REQUEST_CONTRACT, value, "$.authentication", ["identityRef", "proof"]);
	return Object.freeze({
		identityRef: namespacedField(record, "identityRef", REQUEST_CONTRACT, "$.authentication"),
		proof: textField(REQUEST_CONTRACT, record, "proof", "$.authentication", {minimumBytes: 1, maximumBytes: 4_096}),
	});
}

function decodeProductError(value: CanonicalValue): ProductError {
	const record = exactRecord(RESPONSE_CONTRACT, value, "$.error", ["code", "message", "nextAction", "userActionRequired"]);
	return Object.freeze({
		code: literalField(RESPONSE_CONTRACT, record, "code", PRODUCT_ERROR_CODES, "$.error"),
		message: textField(RESPONSE_CONTRACT, record, "message", "$.error", {minimumBytes: 1, maximumBytes: 1_024}),
		nextAction: textField(RESPONSE_CONTRACT, record, "nextAction", "$.error", {minimumBytes: 1, maximumBytes: 1_024}),
		userActionRequired: booleanField(RESPONSE_CONTRACT, record, "userActionRequired", "$.error"),
	});
}

function namespacedField(
	record: CanonicalRecord,
	field: string,
	contract = REQUEST_CONTRACT,
	path = "$",
): string {
	const value = textField(contract, record, field, path, {maximumBytes: 512});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", contract, `${path}.${field}`, "Value must be namespaced.");
	return value;
}

function timestampField(record: CanonicalRecord, field: string): string {
	const value = textField(REQUEST_CONTRACT, record, field, "$", {maximumBytes: 20, pattern: TIMESTAMP});
	if (!isCanonicalRequestTimestamp(value)) rejectContract("invalid_field", REQUEST_CONTRACT, `$.${field}`, "Timestamp is invalid.");
	return value;
}

function digestField(record: CanonicalRecord, field: string, contract = REQUEST_CONTRACT): Sha256Digest {
	const value = textField(contract, record, field);
	const decoded = decodeSha256Digest(value);
	if (!decoded.ok) rejectContract("invalid_field", contract, `$.${field}`, decoded.error.message);
	return decoded.value;
}
