import {
	assertCheckPackSnapshot,
	type CheckPackSnapshot,
} from "../../checks/packs/contracts.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	type Sha256Digest,
} from "../../utils/canonical-json.ts";

export const IMPLEMENTATION_STAGE_POLICY_PROTOCOL = "1.0.0" as const;

export interface ImplementationStagePolicy {
	readonly schemaVersion: typeof IMPLEMENTATION_STAGE_POLICY_PROTOCOL;
	readonly policyDigest: Sha256Digest;
	readonly packSnapshot: CheckPackSnapshot;
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
