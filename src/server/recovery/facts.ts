import {arrayField, decodeContract, exactRecord, protocolField, protocolIdentity, rejectContract, requiredField, textField, type ContractIssue} from "../../kernel/canonical/contract.ts";
import type {CanonicalValue} from "../../kernel/canonical/json.ts";
import {failure, success, type Outcome} from "../../kernel/canonical/outcome.ts";
import {
	decodeCheckRunValue,
	decodeGateValue,
	decodeResultValue,
	type CheckRun,
	type Gate,
	type Result,
} from "../../kernel/gates/contracts.ts";
import {decodeGateOutcomeValue, reduceGate, type GateOutcome} from "../../kernel/gates/reducer.ts";
import {semanticDigest, type SemanticIdentityIssue} from "../../kernel/identity/semantic-digest.ts";
import {decodeSha256Digest, type Sha256Digest} from "../../kernel/identity/sha256.ts";

export const PROJECT_SERVER_FACTS_PROTOCOL = protocolIdentity("codewiki.project-server-facts", "1.0.0");
export const GATE_BUNDLE_PROTOCOL = protocolIdentity("codewiki.gate-bundle", "1.0.0");

export interface GateBundleBody {
	readonly protocol: typeof GATE_BUNDLE_PROTOCOL;
	readonly gate: Gate;
	readonly runs: readonly CheckRun[];
	readonly results: readonly Result[];
	readonly outcome: GateOutcome;
}

export interface GateBundle extends GateBundleBody {
	readonly bundleDigest: Sha256Digest;
}

export interface GateBundleReadRequest {
	readonly repositoryId: string;
	readonly gateDigest: Sha256Digest;
}

export interface GateBundleWriteRequest {
	readonly repositoryId: string;
	readonly gateDigest: Sha256Digest;
	readonly bundle: GateBundle;
	readonly requestDigest: Sha256Digest;
}

export interface GateBundleWriteReceipt {
	readonly repositoryId: string;
	readonly gateDigest: Sha256Digest;
	readonly bundleDigest: Sha256Digest;
	readonly requestDigest: Sha256Digest;
	readonly status: "present" | "written";
}

export interface ProjectServerFactsIssue {
	readonly code: "conflict" | "invalid_fact" | "not_found" | "storage_failed" | "timeout";
	readonly operation: "read_gate" | "write_gate";
	readonly message: string;
}

/** Owner-private immutable Gate facts. Implementations must reconcile writes by request digest. */
export interface ProjectServerFactsPort {
	readonly protocol: typeof PROJECT_SERVER_FACTS_PROTOCOL;
	readGateBundle(request: GateBundleReadRequest): Promise<Outcome<GateBundle, ProjectServerFactsIssue>>;
	writeGateBundle(request: GateBundleWriteRequest): Promise<Outcome<GateBundleWriteReceipt, ProjectServerFactsIssue>>;
}

/** Creates a bounded owner-private facts store for one Project Server process. */
export function createMemoryProjectServerFacts(maximumBundles = 4_096): Outcome<ProjectServerFactsPort, ProjectServerFactsIssue> {
	if (!Number.isSafeInteger(maximumBundles) || maximumBundles < 1 || maximumBundles > 65_536) {
		return failure(factsIssue("invalid_fact", "write_gate", "Gate facts bound must be an integer from 1 to 65536."));
	}
	const bundles = new Map<string, GateBundle>();
	const requests = new Map<string, Sha256Digest>();
	return success(Object.freeze({
		protocol: PROJECT_SERVER_FACTS_PROTOCOL,
		async readGateBundle(request: GateBundleReadRequest): Promise<Outcome<GateBundle, ProjectServerFactsIssue>> {
			const key = factsKey(request.repositoryId, request.gateDigest);
			const bundle = bundles.get(key);
			return bundle
				? success(bundle)
				: failure(factsIssue("not_found", "read_gate", "Gate facts are not present."));
		},
		async writeGateBundle(request: GateBundleWriteRequest): Promise<Outcome<GateBundleWriteReceipt, ProjectServerFactsIssue>> {
			const expected = gateBundleWriteRequestDigest(request);
			if (!expected.ok || expected.value !== request.requestDigest || request.gateDigest !== request.bundle.gate.gateDigest) {
				return failure(factsIssue("invalid_fact", "write_gate", "Gate facts write is malformed."));
			}
			const decoded = decodeGateBundle(request.bundle);
			if (!decoded.ok) return failure(factsIssue("invalid_fact", "write_gate", "Gate bundle is not canonical."));
			const key = factsKey(request.repositoryId, request.gateDigest);
			const existing = bundles.get(key);
			if (existing) {
				if (existing.bundleDigest !== decoded.value.bundleDigest || requests.get(key) !== request.requestDigest) {
					return failure(factsIssue("conflict", "write_gate", "Gate identity already names different immutable facts."));
				}
				return success(factsReceipt(request, "present"));
			}
			if (bundles.size >= maximumBundles) return failure(factsIssue("storage_failed", "write_gate", "Gate facts bound is exhausted."));
			bundles.set(key, decoded.value);
			requests.set(key, request.requestDigest);
			return success(factsReceipt(request, "written"));
		},
	}));
}

const CONTRACT = "codewiki.gate-bundle@1.0.0";

export function createGateBundle(
	body: Omit<GateBundleBody, "protocol">,
): Outcome<GateBundle, ContractIssue | SemanticIdentityIssue> {
	const value = {...body, protocol: GATE_BUNDLE_PROTOCOL};
	const digest = semanticDigest(CONTRACT, value);
	if (!digest.ok) return failure(digest.error);
	return decodeGateBundle({...value, bundleDigest: digest.value});
}

export function decodeGateBundle(input: unknown): Outcome<GateBundle, ContractIssue> {
	return decodeContract(CONTRACT, input, (value) => decodeGateBundleValue(value));
}

export function gateBundleWriteRequestDigest(
	request: GateBundleWriteRequest,
): Outcome<Sha256Digest, SemanticIdentityIssue> {
	const {requestDigest: ignored, ...body} = request;
	void ignored;
	return semanticDigest("codewiki.gate-bundle-write-request@1.0.0", body);
}

function factsKey(repositoryId: string, gateDigest: Sha256Digest): string {
	return `${repositoryId}\0${gateDigest}`;
}

function factsReceipt(request: GateBundleWriteRequest, status: GateBundleWriteReceipt["status"]): GateBundleWriteReceipt {
	return Object.freeze({
		repositoryId: request.repositoryId,
		gateDigest: request.gateDigest,
		bundleDigest: request.bundle.bundleDigest,
		requestDigest: request.requestDigest,
		status,
	});
}

function factsIssue(
	code: ProjectServerFactsIssue["code"],
	operation: ProjectServerFactsIssue["operation"],
	message: string,
): ProjectServerFactsIssue {
	return Object.freeze({code, operation, message});
}

function decodeGateBundleValue(value: CanonicalValue): GateBundle {
	const record = exactRecord(CONTRACT, value, "$", ["bundleDigest", "gate", "outcome", "protocol", "results", "runs"]);
	protocolField(CONTRACT, record, "$", GATE_BUNDLE_PROTOCOL);
	const gate = decodeGateValue(requiredField(CONTRACT, record, "gate"), "$.gate");
	const runs = arrayField(CONTRACT, record, "runs", "$", 4_096).map((entry, index) => decodeCheckRunValue(entry, `$.runs[${index}]`));
	const results = arrayField(CONTRACT, record, "results", "$", 4_096).map((entry, index) => decodeResultValue(entry, `$.results[${index}]`));
	const outcome = decodeGateOutcomeValue(requiredField(CONTRACT, record, "outcome"), "$.outcome");
	const bundleDigestValue = textField(CONTRACT, record, "bundleDigest");
	const bundleDigest = decodeSha256Digest(bundleDigestValue);
	if (!bundleDigest.ok) rejectContract("invalid_field", CONTRACT, "$.bundleDigest", bundleDigest.error.message);
	const reduced = reduceGate({
		gate,
		currentSubject: gate.subject,
		currentKernelBuildDigest: gate.kernelBuildDigest,
		kernelValidation: "passed",
		runs,
		results,
	});
	if (!reduced.ok || reduced.value.outcomeDigest !== outcome.outcomeDigest) {
		rejectContract("invalid_field", CONTRACT, "$.outcome", "Gate bundle outcome does not reduce from its immutable facts.");
	}
	const body = Object.freeze({protocol: GATE_BUNDLE_PROTOCOL, gate, runs: Object.freeze(runs), results: Object.freeze(results), outcome});
	const expected = semanticDigest(CONTRACT, body);
	if (!expected.ok || expected.value !== bundleDigest.value) {
		rejectContract("invalid_field", CONTRACT, "$.bundleDigest", "Gate bundle digest does not match canonical facts.");
	}
	return Object.freeze({...body, bundleDigest: bundleDigest.value});
}
