import {
	arrayValue,
	decodeContract,
	exactRecord,
	isNamespacedIdentifier,
	protocolIdentity,
	rejectContract,
	requiredField,
	sortedUniqueTextArray,
	textField,
	type ContractIssue,
} from "../../kernel/canonical/contract.ts";
import type {CanonicalValue} from "../../kernel/canonical/json.ts";
import {failure, success, type Outcome} from "../../kernel/canonical/outcome.ts";
import {decodeSha256Digest, sha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";
import {PRODUCT_READ_OPERATIONS, type ProductReadOperation} from "../../api/contracts/read.ts";
import {
	isCanonicalRequestTimestamp,
	productError,
	type ProductError,
	type ProductTransportRequest,
} from "../../api/transport/envelope.ts";

export const PROJECT_ACCESS_POLICY_PROTOCOL = protocolIdentity("codewiki.project-access-policy", "1.0.0");

export interface ProjectAccessGrant {
	readonly authorizationId: string;
	readonly identityRef: string;
	readonly actorId: string;
	readonly proofDigest: Sha256Digest;
	readonly expiresAt: string;
	readonly capabilities: readonly ProductReadOperation[];
	readonly wikiItemIds: readonly string[] | null;
	readonly changeIds: readonly string[] | null;
}

export interface AuthorizedProjectActor {
	readonly authorizationId: string;
	readonly identityRef: string;
	readonly actorId: string;
	readonly capabilities: readonly ProductReadOperation[];
	readonly wikiItemIds: readonly string[] | null;
	readonly changeIds: readonly string[] | null;
}

export interface ProjectAccessPolicy {
	readonly protocol: typeof PROJECT_ACCESS_POLICY_PROTOCOL;
	authorize(request: ProductTransportRequest): Outcome<AuthorizedProjectActor, ProductError>;
}

export interface ProjectAccessPolicyInput {
	readonly grants: unknown;
	readonly now: () => string;
}

const CONTRACT = "codewiki.project-access-grants@1.0.0";
const CHANGE_ID = /^CHG-[A-Za-z0-9][A-Za-z0-9._-]{0,195}$/u;

export function projectAccessProofDigest(proof: string): Outcome<Sha256Digest, Readonly<{message: string}>> {
	const byteLength = typeof proof === "string" ? new TextEncoder().encode(proof).byteLength : 0;
	if (typeof proof !== "string" || byteLength < 16 || byteLength > 4_096 || proof.normalize("NFC") !== proof || proof.includes("\0")) {
		return failure(Object.freeze({message: "Authentication proof must be bounded normalized text."}));
	}
	return success(sha256Digest(proof));
}

export function createProjectAccessPolicy(
	input: ProjectAccessPolicyInput,
): Outcome<ProjectAccessPolicy, ContractIssue> {
	if (typeof input !== "object" || input === null ||
		Object.keys(input).some((key) => key !== "grants" && key !== "now") || typeof input.now !== "function") {
		return failure(Object.freeze({
			code: "invalid_field",
			contract: CONTRACT,
			path: "$.now",
			message: "Project access policy requires a server-owned clock.",
		}));
	}
	const grants = decodeProjectAccessGrants(input.grants);
	if (!grants.ok) return grants;
	const now = input.now;
	return success(Object.freeze({
		protocol: PROJECT_ACCESS_POLICY_PROTOCOL,
		authorize(request: ProductTransportRequest): Outcome<AuthorizedProjectActor, ProductError> {
			return authorize(grants.value, now, request);
		},
	}));
}

export function decodeProjectAccessGrants(input: unknown): Outcome<readonly ProjectAccessGrant[], ContractIssue> {
	return decodeContract(CONTRACT, input, (value) => {
		const values = arrayValue(CONTRACT, value, "$", 128);
		if (values.length === 0) rejectContract("invalid_field", CONTRACT, "$", "At least one access grant is required.");
		const grants = values.map(decodeGrant);
		const authorizationIds = new Set<string>();
		const credentials = new Set<string>();
		for (const grant of grants) {
			if (authorizationIds.has(grant.authorizationId)) {
				rejectContract("invalid_field", CONTRACT, "$", "Authorization IDs must be unique.");
			}
			const credential = `${grant.identityRef}\0${grant.proofDigest}`;
			if (credentials.has(credential)) rejectContract("invalid_field", CONTRACT, "$", "Authentication grants must be unique.");
			authorizationIds.add(grant.authorizationId);
			credentials.add(credential);
		}
		return Object.freeze(grants);
	});
}

function authorize(
	grants: readonly ProjectAccessGrant[],
	now: () => string,
	request: ProductTransportRequest,
): Outcome<AuthorizedProjectActor, ProductError> {
	const proofDigest = projectAccessProofDigest(request.authentication.proof);
	if (!proofDigest.ok) return failure(authenticationError());
	let grant: ProjectAccessGrant | null = null;
	for (const entry of grants) {
		const proofMatches = constantTimeText(entry.proofDigest, proofDigest.value);
		if (entry.identityRef === request.authentication.identityRef && proofMatches) grant = entry;
	}
	if (grant === null) return failure(authenticationError());
	let observedAt: string;
	try {
		observedAt = now();
	} catch {
		return failure(productError(
			"internal_failure",
			"Project access could not be checked safely.",
			"Retry after the Project service is healthy.",
			false,
		));
	}
	if (!isCanonicalRequestTimestamp(observedAt)) {
		return failure(productError(
			"internal_failure",
			"Project access could not be checked safely.",
			"Retry after the Project service is healthy.",
			false,
		));
	}
	if (observedAt > request.expiresAt || observedAt > grant.expiresAt) {
		return failure(productError(
			"expired_request",
			"This request or sign-in proof has expired.",
			"Sign in again and retry the action.",
			true,
		));
	}
	if (!grant.capabilities.includes(request.operation)) {
		return failure(productError(
			"authorization_denied",
			"This Actor is not allowed to perform that action.",
			"Choose an allowed read or ask a maintainer for access.",
			true,
		));
	}
	return success(Object.freeze({
		authorizationId: grant.authorizationId,
		identityRef: grant.identityRef,
		actorId: grant.actorId,
		capabilities: grant.capabilities,
		wikiItemIds: grant.wikiItemIds,
		changeIds: grant.changeIds,
	}));
}

function decodeGrant(value: CanonicalValue, index: number): ProjectAccessGrant {
	const path = `$[${index}]`;
	const record = exactRecord(CONTRACT, value, path, [
		"authorizationId", "identityRef", "actorId", "proofDigest", "expiresAt", "capabilities", "wikiItemIds", "changeIds",
	]);
	const proofDigestText = textField(CONTRACT, record, "proofDigest", path);
	const proofDigest = decodeSha256Digest(proofDigestText);
	if (!proofDigest.ok) rejectContract("invalid_field", CONTRACT, `${path}.proofDigest`, proofDigest.error.message);
	const expiresAt = textField(CONTRACT, record, "expiresAt", path, {maximumBytes: 20});
	if (!isCanonicalRequestTimestamp(expiresAt)) rejectContract("invalid_field", CONTRACT, `${path}.expiresAt`, "Expiry timestamp is invalid.");
	const capabilities = sortedUniqueTextArray(CONTRACT, requiredField(CONTRACT, record, "capabilities", path), `${path}.capabilities`, {
		maximumEntries: PRODUCT_READ_OPERATIONS.length,
		maximumBytes: 64,
	});
	if (capabilities.length === 0 || !capabilities.every(isProductReadOperation)) {
		rejectContract("invalid_field", CONTRACT, `${path}.capabilities`, "Access grant capabilities are invalid.");
	}
	return Object.freeze({
		authorizationId: namespacedField(record, "authorizationId", path),
		identityRef: namespacedField(record, "identityRef", path),
		actorId: namespacedField(record, "actorId", path),
		proofDigest: proofDigest.value,
		expiresAt,
		capabilities,
		wikiItemIds: nullableIdentifierSet(requiredField(CONTRACT, record, "wikiItemIds", path), `${path}.wikiItemIds`, false),
		changeIds: nullableIdentifierSet(requiredField(CONTRACT, record, "changeIds", path), `${path}.changeIds`, true),
	});
}

function nullableIdentifierSet(value: CanonicalValue, path: string, changeIds: boolean): readonly string[] | null {
	if (value === null) return null;
	const identifiers = sortedUniqueTextArray(CONTRACT, value, path, {
		maximumEntries: 10_000,
		maximumBytes: changeIds ? 200 : 256,
		pattern: changeIds ? CHANGE_ID : /^[a-z][a-z0-9.-]*(?::[A-Za-z0-9][A-Za-z0-9._:@/-]*)+$/u,
	});
	if (!changeIds && !identifiers.every(isNamespacedIdentifier)) {
		rejectContract("invalid_field", CONTRACT, path, "Wiki visibility contains an invalid Item ID.");
	}
	return identifiers;
}

function namespacedField(record: Readonly<{[key: string]: CanonicalValue}>, field: string, path: string): string {
	const value = textField(CONTRACT, record, field, path, {maximumBytes: 512});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", CONTRACT, `${path}.${field}`, "Value must be namespaced.");
	return value;
}

function isProductReadOperation(value: string): value is ProductReadOperation {
	return (PRODUCT_READ_OPERATIONS as readonly string[]).includes(value);
}

function constantTimeText(left: string, right: string): boolean {
	let difference = left.length ^ right.length;
	const maximum = Math.max(left.length, right.length);
	for (let index = 0; index < maximum; index += 1) {
		difference |= (left.charCodeAt(index % left.length) || 0) ^ (right.charCodeAt(index % right.length) || 0);
	}
	return difference === 0;
}

function authenticationError(): ProductError {
	return productError(
		"authentication_required",
		"Sign-in proof is missing or invalid.",
		"Sign in and retry the action.",
		true,
	);
}
