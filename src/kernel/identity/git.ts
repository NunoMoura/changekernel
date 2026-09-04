import {
	decodeContract,
	exactRecord,
	literalField,
	rejectContract,
	requiredField,
	textField,
	textValue,
	type ContractIssue,
} from "../canonical/contract.ts";
import type {CanonicalValue} from "../canonical/json.ts";
import type {Outcome} from "../canonical/outcome.ts";

export type GitObjectFormat = "sha1" | "sha256";

export interface GitOid {
	readonly algorithm: GitObjectFormat;
	readonly hex: string;
}

export type GitRef = string & {readonly __gitRef: unique symbol};

const GIT_OID_CONTRACT = "Git OID";
const GIT_REF_CONTRACT = "Git ref";

export function decodeGitOid(input: unknown): Outcome<GitOid, ContractIssue> {
	return decodeContract(GIT_OID_CONTRACT, input, decodeGitOidValue);
}

export function decodeGitOidValue(value: CanonicalValue, path = "$"): GitOid {
	const record = exactRecord(GIT_OID_CONTRACT, value, path, ["algorithm", "hex"]);
	const algorithm = literalField(GIT_OID_CONTRACT, record, "algorithm", ["sha1", "sha256"] as const, path);
	const hex = textField(GIT_OID_CONTRACT, record, "hex", path, {
		minimumBytes: algorithm === "sha1" ? 40 : 64,
		maximumBytes: algorithm === "sha1" ? 40 : 64,
		pattern: algorithm === "sha1" ? /^[0-9a-f]{40}$/u : /^[0-9a-f]{64}$/u,
	});
	if (/^0+$/u.test(hex)) rejectContract("invalid_field", GIT_OID_CONTRACT, `${path}.hex`, "Git OID cannot be the null sentinel.");
	return Object.freeze({algorithm, hex});
}

export function gitOid(algorithm: GitObjectFormat, hex: string): Outcome<GitOid, ContractIssue> {
	return decodeGitOid({algorithm, hex});
}

export function sameGitOid(left: GitOid, right: GitOid): boolean {
	return left.algorithm === right.algorithm && left.hex === right.hex;
}

export function gitOidText(oid: GitOid): string {
	return `${oid.algorithm}:${oid.hex}`;
}

export function decodeGitRef(input: unknown): Outcome<GitRef, ContractIssue> {
	return decodeContract(GIT_REF_CONTRACT, input, (value) => decodeGitRefValue(value));
}

export function decodeGitRefValue(value: CanonicalValue, path = "$"): GitRef {
	const ref = textValue(GIT_REF_CONTRACT, value, path, {maximumBytes: 512});
	if (!isCanonicalGitRef(ref)) rejectContract("invalid_field", GIT_REF_CONTRACT, path, "Git ref is not canonical or fully qualified.");
	return ref as GitRef;
}

export function isCanonicalGitRef(ref: string): boolean {
	if (
		!ref.startsWith("refs/") ||
		ref.endsWith("/") ||
		ref.endsWith(".") ||
		ref.includes("..") ||
		ref.includes("@{") ||
		ref.includes("\\") ||
		ref.includes("//") ||
		/[\u0000-\u0020~^:?*[\]]/u.test(ref)
	) return false;
	return ref.split("/").every((segment) =>
		segment.length > 0 && segment !== "." && segment !== ".." && !segment.startsWith(".") && !segment.endsWith(".lock"),
	);
}

export function isManagedProjectRef(ref: GitRef): boolean {
	return ref === "refs/heads/main" || /^refs\/codewiki\/changes\/CHG-[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/u.test(ref);
}

export function nullableGitOidField(
	contract: string,
	record: Readonly<{[key: string]: CanonicalValue}>,
	field: string,
	path = "$",
): GitOid | null {
	const value = requiredField(contract, record, field, path);
	if (value === null) return null;
	return decodeGitOidValue(value, `${path}.${field}`);
}
