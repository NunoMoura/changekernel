import {
	assertCheckPackSnapshot,
	type CheckPackSnapshot,
} from "../../checks/packs/contracts.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";
import {
	assertWorkUnitCandidate,
	type WorkUnitCandidate,
} from "./work-unit-candidate.ts";

export const IMPLEMENTATION_STAGE_POLICY_PROTOCOL = "1.0.0" as const;
export const IMPLEMENTATION_GATE_PACKAGE_PROTOCOL = "1.0.0" as const;

export interface ImplementationStagePolicy {
	readonly schemaVersion: typeof IMPLEMENTATION_STAGE_POLICY_PROTOCOL;
	readonly policyDigest: Sha256Digest;
	readonly packSnapshot: CheckPackSnapshot;
}

export interface ImplementationGateEvaluationPackage {
	readonly protocol: typeof IMPLEMENTATION_GATE_PACKAGE_PROTOCOL;
	readonly packageDigest: Sha256Digest;
	readonly candidateId: string;
	readonly candidateDigest: Sha256Digest;
	readonly workUnitId: string;
	readonly policyDigest: Sha256Digest;
	readonly checkPackDigest: Sha256Digest;
	readonly evidenceRecordIds: readonly string[];
}

export function createImplementationStagePolicy(
	packSnapshot: CheckPackSnapshot,
): ImplementationStagePolicy {
	assertCheckPackSnapshot(packSnapshot, "implementation");
	const body = {
		schemaVersion: IMPLEMENTATION_STAGE_POLICY_PROTOCOL,
		packSnapshot,
	} as const;
	return Object.freeze({
		...body,
		policyDigest: canonicalJsonDigest(body),
	});
}

export function assertImplementationStagePolicy(
	policy: ImplementationStagePolicy,
): void {
	if (policy.schemaVersion !== IMPLEMENTATION_STAGE_POLICY_PROTOCOL) {
		throw new Error("Implementation stage policy protocol is unsupported.");
	}
	const expected = createImplementationStagePolicy(policy.packSnapshot);
	if (canonicalJson(policy) !== canonicalJson(expected)) {
		throw new Error("Implementation stage policy identity is invalid.");
	}
}

export function createImplementationGateEvaluationPackage(input: {
	readonly candidate: WorkUnitCandidate;
	readonly policy: ImplementationStagePolicy;
	readonly evidenceRecordIds?: readonly string[];
}): ImplementationGateEvaluationPackage {
	assertWorkUnitCandidate(input.candidate);
	assertImplementationStagePolicy(input.policy);
	const evidenceRecordIds = [...(input.evidenceRecordIds ?? [])].sort(compareText);
	if (new Set(evidenceRecordIds).size !== evidenceRecordIds.length) {
		throw new Error("Implementation Gate Evidence identities must be unique.");
	}
	const body = {
		protocol: IMPLEMENTATION_GATE_PACKAGE_PROTOCOL,
		candidateId: input.candidate.id,
		candidateDigest: input.candidate.digest,
		workUnitId: input.candidate.content.workUnitId,
		policyDigest: input.policy.policyDigest,
		checkPackDigest: input.policy.packSnapshot.checkPackDigest,
		evidenceRecordIds,
	} as const;
	return Object.freeze({
		...body,
		packageDigest: canonicalJsonDigest(body),
	});
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
