import {
	assertDigestMatch,
	arrayField,
	decodeContract,
	exactRecord,
	literalField,
	protocolField,
	protocolIdentity,
	rejectContract,
	requiredField,
	textField,
	type CanonicalRecord,
	type ContractIssue,
	type ProtocolIdentity,
} from "../data-contracts/validation.ts";
import type {CanonicalValue} from "../data-contracts/canonical-json.ts";
import {failure, type Outcome} from "../data-contracts/outcome.ts";
import {semanticDigest, type SemanticIdentityIssue} from "./semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "./sha256.ts";
import {decodeGitOidValue, type GitObjectFormat, type GitOid} from "./git.ts";

export const PRODUCT_BUILD_PROTOCOL = protocolIdentity("codewiki.product-build", "1.0.0");
export const KERNEL_BUILD_PROTOCOL = protocolIdentity("codewiki.kernel-build", "1.0.0");
export const CANONICALIZATION_PROTOCOL = protocolIdentity("codewiki.canonical-json", "1.0.0");
export const SEMANTIC_IDENTITY_PROTOCOL = protocolIdentity("codewiki.semantic-identity", "1.0.0");

export interface ProductBuildBody {
	readonly protocol: typeof PRODUCT_BUILD_PROTOCOL;
	readonly packageName: string;
	readonly packageVersion: string;
	readonly sourceCommit: GitOid;
	readonly sourceTree: GitOid;
	readonly productPolicyDigest: Sha256Digest;
	readonly artifactDigest: Sha256Digest;
}

export interface ProductBuild extends ProductBuildBody {
	readonly buildDigest: Sha256Digest;
}

export interface KernelGitBuildIdentity {
	readonly implementation: string;
	readonly version: string;
	readonly objectFormat: GitObjectFormat;
}

export interface KernelBuildBody {
	readonly protocol: typeof KERNEL_BUILD_PROTOCOL;
	readonly productBuildDigest: Sha256Digest;
	readonly contracts: readonly ProtocolIdentity[];
	readonly canonicalization: typeof CANONICALIZATION_PROTOCOL;
	readonly identity: typeof SEMANTIC_IDENTITY_PROTOCOL;
	readonly git: KernelGitBuildIdentity;
}

export interface KernelBuild extends KernelBuildBody {
	readonly buildDigest: Sha256Digest;
}

export function createProductBuild(
	body: Omit<ProductBuildBody, "protocol">,
): Outcome<ProductBuild, ContractIssue | SemanticIdentityIssue> {
	const value = {...body, protocol: PRODUCT_BUILD_PROTOCOL};
	const digest = semanticDigest(protocolLabel(PRODUCT_BUILD_PROTOCOL), value);
	if (!digest.ok) return failure(digest.error);
	return decodeProductBuild({...value, buildDigest: digest.value});
}

export function decodeProductBuild(input: unknown): Outcome<ProductBuild, ContractIssue> {
	return decodeContract("Product Build", input, (value) => {
		const record = exactRecord("Product Build", value, "$", [
			"artifactDigest",
			"buildDigest",
			"packageName",
			"packageVersion",
			"productPolicyDigest",
			"protocol",
			"sourceCommit",
			"sourceTree",
		]);
		protocolField("Product Build", record, "$", PRODUCT_BUILD_PROTOCOL);
		const result = Object.freeze({
			protocol: PRODUCT_BUILD_PROTOCOL,
			packageName: textField("Product Build", record, "packageName", "$", {
				maximumBytes: 214,
				pattern: /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u,
			}),
			packageVersion: textField("Product Build", record, "packageVersion", "$", {
				maximumBytes: 128,
				pattern: /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u,
			}),
			sourceCommit: decodeGitOidValue(requiredField("Product Build", record, "sourceCommit"), "$.sourceCommit"),
			sourceTree: decodeGitOidValue(requiredField("Product Build", record, "sourceTree"), "$.sourceTree"),
			productPolicyDigest: digestField("Product Build", record, "productPolicyDigest"),
			artifactDigest: digestField("Product Build", record, "artifactDigest"),
			buildDigest: digestField("Product Build", record, "buildDigest"),
		});
		if (result.sourceCommit.algorithm !== result.sourceTree.algorithm) {
			rejectContract("invalid_field", "Product Build", "$.sourceTree.algorithm", "Source commit and tree must use the same object format.");
		}
		const expected = requiredSemanticDigest("Product Build", PRODUCT_BUILD_PROTOCOL, withoutDigest(result));
		assertDigestMatch("Product Build", "$.buildDigest", result.buildDigest, expected);
		return result;
	});
}

export function createKernelBuild(
	body: Omit<KernelBuildBody, "protocol" | "canonicalization" | "identity">,
): Outcome<KernelBuild, ContractIssue | SemanticIdentityIssue> {
	const value = {...body, protocol: KERNEL_BUILD_PROTOCOL, canonicalization: CANONICALIZATION_PROTOCOL, identity: SEMANTIC_IDENTITY_PROTOCOL};
	const digest = semanticDigest(protocolLabel(KERNEL_BUILD_PROTOCOL), value);
	if (!digest.ok) return failure(digest.error);
	return decodeKernelBuild({...value, buildDigest: digest.value});
}

export function decodeKernelBuild(input: unknown): Outcome<KernelBuild, ContractIssue> {
	return decodeContract("Kernel Build", input, (value) => {
		const record = exactRecord("Kernel Build", value, "$", [
			"buildDigest",
			"canonicalization",
			"contracts",
			"git",
			"identity",
			"productBuildDigest",
			"protocol",
		]);
		protocolField("Kernel Build", record, "$", KERNEL_BUILD_PROTOCOL);
		const canonicalization = exactRecord("Kernel Build", requiredField("Kernel Build", record, "canonicalization"), "$.canonicalization", ["id", "version"]);
		const decodedCanonicalization = decodeProtocolValue("Kernel Build", canonicalization, "$.canonicalization");
		if (decodedCanonicalization.id !== CANONICALIZATION_PROTOCOL.id || decodedCanonicalization.version !== CANONICALIZATION_PROTOCOL.version) {
			rejectContract("invalid_protocol", "Kernel Build", "$.canonicalization", "Canonicalization protocol is unsupported.");
		}
		const identity = exactRecord("Kernel Build", requiredField("Kernel Build", record, "identity"), "$.identity", ["id", "version"]);
		const decodedIdentity = decodeProtocolValue("Kernel Build", identity, "$.identity");
		if (decodedIdentity.id !== SEMANTIC_IDENTITY_PROTOCOL.id || decodedIdentity.version !== SEMANTIC_IDENTITY_PROTOCOL.version) {
			rejectContract("invalid_protocol", "Kernel Build", "$.identity", "Semantic identity protocol is unsupported.");
		}
		const gitRecord = exactRecord("Kernel Build", requiredField("Kernel Build", record, "git"), "$.git", ["implementation", "objectFormat", "version"]);
		const contracts = decodeContractCatalog(arrayField("Kernel Build", record, "contracts", "$", 256));
		const result = Object.freeze({
			protocol: KERNEL_BUILD_PROTOCOL,
			productBuildDigest: digestField("Kernel Build", record, "productBuildDigest"),
			contracts,
			canonicalization: CANONICALIZATION_PROTOCOL,
			identity: SEMANTIC_IDENTITY_PROTOCOL,
			git: Object.freeze({
				implementation: textField("Kernel Build", gitRecord, "implementation", "$.git", {maximumBytes: 128}),
				version: textField("Kernel Build", gitRecord, "version", "$.git", {maximumBytes: 128}),
				objectFormat: literalField("Kernel Build", gitRecord, "objectFormat", ["sha1", "sha256"] as const, "$.git"),
			}),
			buildDigest: digestField("Kernel Build", record, "buildDigest"),
		});
		const expected = requiredSemanticDigest("Kernel Build", KERNEL_BUILD_PROTOCOL, withoutDigest(result));
		assertDigestMatch("Kernel Build", "$.buildDigest", result.buildDigest, expected);
		return result;
	});
}

function decodeContractCatalog(input: readonly CanonicalValue[]): readonly ProtocolIdentity[] {
	const output = input.map((value, index) => {
		const record = exactRecord("Kernel Build", value, `$.contracts[${index}]`, ["id", "version"]);
		return decodeProtocolValue("Kernel Build", record, `$.contracts[${index}]`);
	});
	for (let index = 1; index < output.length; index += 1) {
		if (compareProtocols(output[index - 1] as ProtocolIdentity, output[index] as ProtocolIdentity) >= 0) {
			rejectContract("non_canonical_order", "Kernel Build", "$.contracts", "Contract protocols must be strictly sorted and unique.");
		}
	}
	return Object.freeze(output);
}

function decodeProtocolValue(contract: string, record: CanonicalRecord, path: string): ProtocolIdentity {
	const id = textField(contract, record, "id", path, {maximumBytes: 256, pattern: /^[a-z][a-z0-9.-]*$/u});
	const version = textField(contract, record, "version", path, {maximumBytes: 64, pattern: /^\d+\.\d+\.\d+$/u});
	return Object.freeze({id, version});
}

function digestField(contract: string, record: CanonicalRecord, field: string): Sha256Digest {
	const decoded = decodeSha256Digest(record[field]);
	if (!decoded.ok) rejectContract("invalid_field", contract, `$.${field}`, decoded.error.message);
	return decoded.value;
}

function requiredSemanticDigest(contract: string, protocol: ProtocolIdentity, value: unknown): Sha256Digest {
	const digest = semanticDigest(protocolLabel(protocol), value);
	if (!digest.ok) rejectContract("invalid_field", contract, "$.buildDigest", digest.error.message);
	return digest.value;
}

function withoutDigest<Value extends {readonly buildDigest: Sha256Digest}>(value: Value): Omit<Value, "buildDigest"> {
	const {buildDigest: _buildDigest, ...body} = value;
	return body;
}

function protocolLabel(protocol: ProtocolIdentity): string {
	return `${protocol.id}@${protocol.version}`;
}

function compareProtocols(left: ProtocolIdentity, right: ProtocolIdentity): number {
	if (left.id < right.id) return -1;
	if (left.id > right.id) return 1;
	if (left.version < right.version) return -1;
	if (left.version > right.version) return 1;
	return 0;
}
