import {
	decodeCanonicalValue,
	type CanonicalValue,
} from "./kernel/canonical/json.ts";
import {semanticDigest} from "./kernel/identity/semantic-digest.ts";
import type {Sha256Digest} from "./kernel/identity/sha256.ts";
import {AGENT_RUNTIME_PORT_PROTOCOL} from "./ports/agent-runtime.ts";
import {CHECK_RUNNER_PORT_PROTOCOL} from "./ports/check-runner.ts";
import {PREVIEW_PORT_PROTOCOL} from "./ports/preview.ts";
import {PROJECT_STORE_PORT_PROTOCOL} from "./ports/project-store.ts";

export interface CodewikiProductPolicy {
	readonly protocol: Readonly<{id: "codewiki.product-policy"; version: "1.0.0"}>;
	readonly productId: "codewiki";
	readonly package: Readonly<{name: "@nunomoura/codewiki"; version: "0.3.0"}>;
	readonly projectConfiguration: Readonly<{
		protocol: Readonly<{id: "codewiki.project-config"; version: "2.0.0"}>;
		semanticRoots: readonly [".codewiki/wiki/items", ".codewiki/changes"];
		forbiddenRoots: readonly [
			".codewiki/kb",
			".codewiki/traces",
			".codewiki/runtime",
			".codewiki/views",
		];
	}>;
	readonly lifecycle: Readonly<{
		stages: readonly ["decision", "planning", "implementation", "review"];
		roles: readonly ["decision", "planning", "worker", "review", "model-check"];
		gateAuthority: "facts-only";
	}>;
	readonly ports: readonly CanonicalValue[];
	readonly checks: Readonly<{
		selectionAuthority: "product-and-project";
		proposalSelection: "forbidden";
		resources: readonly Readonly<{
			stage: "decision" | "planning" | "implementation" | "review";
			packId: "software-development-default";
			path: string;
			treeDigest: Sha256Digest;
		}>[];
	}>;
}

const POLICY_INPUT = {
	protocol: {id: "codewiki.product-policy", version: "1.0.0"},
	productId: "codewiki",
	package: {name: "@nunomoura/codewiki", version: "0.3.0"},
	projectConfiguration: {
		protocol: {id: "codewiki.project-config", version: "2.0.0"},
		semanticRoots: [".codewiki/wiki/items", ".codewiki/changes"],
		forbiddenRoots: [
			".codewiki/kb",
			".codewiki/traces",
			".codewiki/runtime",
			".codewiki/views",
		],
	},
	lifecycle: {
		stages: ["decision", "planning", "implementation", "review"],
		roles: ["decision", "planning", "worker", "review", "model-check"],
		gateAuthority: "facts-only",
	},
	ports: [
		PROJECT_STORE_PORT_PROTOCOL,
		CHECK_RUNNER_PORT_PROTOCOL,
		AGENT_RUNTIME_PORT_PROTOCOL,
		PREVIEW_PORT_PROTOCOL,
	],
	checks: {
		selectionAuthority: "product-and-project",
		proposalSelection: "forbidden",
		resources: [
			{
				stage: "decision",
				packId: "software-development-default",
				path: "check-packs/decision/software-development-default",
				treeDigest: "sha256:4ea217a3d10e7592cff2365934ed98c22c1f5c6f8d8a4ac35d05784e0d1f6975",
			},
			{
				stage: "implementation",
				packId: "software-development-default",
				path: "check-packs/implementation/software-development-default",
				treeDigest: "sha256:f5fa126e8158fd60f541e04c2d4faba5a01772ac090988f5cf2d7ecbf385030c",
			},
			{
				stage: "planning",
				packId: "software-development-default",
				path: "check-packs/planning/software-development-default",
				treeDigest: "sha256:bfcd7daa9aa21d0990cbfa89c40e344df7b878042c1645775cca23643db72bbb",
			},
			{
				stage: "review",
				packId: "software-development-default",
				path: "check-packs/review/software-development-default",
				treeDigest: "sha256:2c666772425459f70d84cf849e60bbe9e574653b13745c697848b43ce3471e95",
			},
		],
	},
} as const;

export const CODEWIKI_PRODUCT: CodewikiProductPolicy = canonicalPolicy(POLICY_INPUT);
export const CODEWIKI_PRODUCT_POLICY_DIGEST: Sha256Digest = policyDigest(CODEWIKI_PRODUCT);

function canonicalPolicy(input: CanonicalValue): CodewikiProductPolicy {
	const decoded = decodeCanonicalValue(input);
	if (!decoded.ok) {
		throw new Error(`Static Product policy is invalid: ${decoded.error.message}`);
	}
	// SAFETY: POLICY_INPUT fixes every field and literal required by CodewikiProductPolicy;
	// canonical decoding recursively validates and freezes those exact values.
	return decoded.value as unknown as CodewikiProductPolicy;
}

function policyDigest(policy: CodewikiProductPolicy): Sha256Digest {
	const digest = semanticDigest("codewiki.product-policy@1.0.0", policy);
	if (!digest.ok) {
		throw new Error(`Static Product policy digest failed: ${digest.error.message}`);
	}
	return digest.value;
}
