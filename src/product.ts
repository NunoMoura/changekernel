import {
	PRODUCT_OPERATIONS,
	PRODUCT_TRANSPORT_REQUEST_PROTOCOL,
	PRODUCT_TRANSPORT_RESPONSE_PROTOCOL,
} from "./api/transport/envelope.ts";
import {
	decodeCanonicalValue,
	type CanonicalValue,
} from "./kernel/data-contracts/canonical-json.ts";
import {semanticDigest} from "./kernel/identity/semantic-digest.ts";
import {CHANGEKERNEL_VERSION} from "./kernel/identity/version.ts";
import type {Sha256Digest} from "./kernel/identity/sha256.ts";
import {AGENT_RUNTIME_PORT_PROTOCOL} from "./ports/agent-runtime.ts";
import {PREVIEW_PORT_PROTOCOL} from "./ports/preview.ts";
import {PROJECT_STORE_PORT_PROTOCOL} from "./ports/project-store.ts";
import {PROJECT_ACCESS_POLICY_PROTOCOL} from "./server/authorization/policy.ts";
import {AGENT_ROLE_POLICY_DIGEST, AGENT_ROLE_POLICY_PROTOCOL} from "./server/effects/agent-runs.ts";
import {PROJECT_SERVER_PROTOCOL} from "./server/index.ts";

export interface ChangeKernelProductPolicy {
	readonly protocol: Readonly<{id: "codewiki.product-policy"; version: "1.0.0"}>;
	readonly productId: "changekernel";
	readonly package: Readonly<{name: "@nunomoura/changekernel"; version: typeof CHANGEKERNEL_VERSION}>;
	readonly projectConfiguration: Readonly<{
		protocol: Readonly<{id: "codewiki.project-config"; version: "2.0.0"}>;
		semanticRoots: readonly [".changekernel/wiki", ".changekernel/changes"];
		forbiddenRoots: readonly [
			".changekernel/kb",
			".changekernel/traces",
			".changekernel/runtime",
			".changekernel/views",
		];
	}>;
	readonly lifecycle: Readonly<{
		stages: readonly ["decision", "planning", "implementation", "review"];
		roles: readonly ["decision", "planning", "worker", "review", "model-check"];
		gateAuthority: "facts-only";
		mutationAuthority: "project-server";
		protectedEffects: "separate-capability";
		agentRolePolicy: Readonly<{
			protocol: typeof AGENT_ROLE_POLICY_PROTOCOL;
			digest: Sha256Digest;
		}>;
	}>;
	readonly ports: readonly CanonicalValue[];
	readonly api: Readonly<{
		operations: typeof PRODUCT_OPERATIONS;
		requestProtocol: typeof PRODUCT_TRANSPORT_REQUEST_PROTOCOL;
		responseProtocol: typeof PRODUCT_TRANSPORT_RESPONSE_PROTOCOL;
		serverProtocol: typeof PROJECT_SERVER_PROTOCOL;
		accessPolicyProtocol: typeof PROJECT_ACCESS_POLICY_PROTOCOL;
		normalVocabulary: readonly ["Changes", "status", "Work", "Checks", "Decisions", "next action", "required user action"];
		unavailable: readonly ["Agent Work", "Preview"];
	}>;
	readonly checks: Readonly<{
		selectionAuthority: "backend";
		proposalSelection: "forbidden";
	}>;
}

const POLICY_INPUT = {
	protocol: {id: "codewiki.product-policy", version: "1.0.0"},
	productId: "changekernel",
	package: {name: "@nunomoura/changekernel", version: CHANGEKERNEL_VERSION},
	projectConfiguration: {
		protocol: {id: "codewiki.project-config", version: "2.0.0"},
		semanticRoots: [".changekernel/wiki", ".changekernel/changes"],
		forbiddenRoots: [
			".changekernel/kb",
			".changekernel/traces",
			".changekernel/runtime",
			".changekernel/views",
		],
	},
	lifecycle: {
		stages: ["decision", "planning", "implementation", "review"],
		roles: ["decision", "planning", "worker", "review", "model-check"],
		gateAuthority: "facts-only",
		mutationAuthority: "project-server",
		protectedEffects: "separate-capability",
		agentRolePolicy: Object.freeze({protocol: {...AGENT_ROLE_POLICY_PROTOCOL}, digest: AGENT_ROLE_POLICY_DIGEST}),
	},
	ports: [
		PROJECT_STORE_PORT_PROTOCOL,
		AGENT_RUNTIME_PORT_PROTOCOL,
		PREVIEW_PORT_PROTOCOL,
	],
	api: {
		operations: PRODUCT_OPERATIONS,
		requestProtocol: {...PRODUCT_TRANSPORT_REQUEST_PROTOCOL},
		responseProtocol: {...PRODUCT_TRANSPORT_RESPONSE_PROTOCOL},
		serverProtocol: {...PROJECT_SERVER_PROTOCOL},
		accessPolicyProtocol: {...PROJECT_ACCESS_POLICY_PROTOCOL},
		normalVocabulary: ["Changes", "status", "Work", "Checks", "Decisions", "next action", "required user action"],
		unavailable: ["Agent Work", "Preview"],
	},
	checks: {
		selectionAuthority: "backend",
		proposalSelection: "forbidden",
	},
} as const;

export const CHANGEKERNEL_PRODUCT: ChangeKernelProductPolicy = canonicalPolicy(POLICY_INPUT);
export const CHANGEKERNEL_PRODUCT_POLICY_DIGEST: Sha256Digest = policyDigest(CHANGEKERNEL_PRODUCT);

function canonicalPolicy(input: CanonicalValue): ChangeKernelProductPolicy {
	const decoded = decodeCanonicalValue(input);
	if (!decoded.ok) {
		throw new Error(`Static Product policy is invalid: ${decoded.error.message}`);
	}
	// SAFETY: POLICY_INPUT fixes every field and literal required by ChangeKernelProductPolicy;
	// canonical decoding recursively validates and freezes those exact values.
	return decoded.value as unknown as ChangeKernelProductPolicy;
}

function policyDigest(policy: ChangeKernelProductPolicy): Sha256Digest {
	const digest = semanticDigest("codewiki.product-policy@1.0.0", policy);
	if (!digest.ok) {
		throw new Error(`Static Product policy digest failed: ${digest.error.message}`);
	}
	return digest.value;
}
