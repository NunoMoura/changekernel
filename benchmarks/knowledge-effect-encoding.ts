import {performance} from "node:perf_hooks";
import {measureByteNovelty} from "../src/runtime/efficiency-metrics.ts";
import {
	canonicalJson,
	canonicalJsonDigest,
	type CanonicalJsonValue,
	type Sha256Digest,
} from "../src/utils/canonical-json.ts";

export type KnowledgeEncodingMethod =
	| "full_document"
	| "unified_diff"
	| "byte_splice"
	| "structural_section"
	| "semantic_effect";

export interface KnowledgeEncodingBenchmarkCase {
	readonly id: string;
	readonly baseDocument: string;
	readonly targetDocument: string;
	readonly targetId: string;
	readonly priorDigest: Sha256Digest;
	readonly newSemanticFragment: string | null;
	readonly sectionLocator?: string;
}

export interface KnowledgeEncodingBenchmarkResult {
	readonly method: KnowledgeEncodingMethod;
	readonly encodedBytes: number;
	readonly repeatedBytes: number;
	readonly newBytes: number;
	readonly repeatedByteRatio: number;
	readonly newFragmentCopies: number;
	readonly durationMs: number;
	readonly payloadDigest: Sha256Digest;
}

export interface KnowledgeEncodingBenchmarkReport {
	readonly schemaVersion: "1.0.0";
	readonly cases: readonly {
		readonly id: string;
		readonly results: readonly KnowledgeEncodingBenchmarkResult[];
	}[];
	readonly digest: Sha256Digest;
}

const METHODS: readonly KnowledgeEncodingMethod[] = Object.freeze([
	"full_document",
	"unified_diff",
	"byte_splice",
	"structural_section",
	"semantic_effect",
]);

export function runKnowledgeEncodingBenchmark(
	cases: readonly KnowledgeEncodingBenchmarkCase[],
): KnowledgeEncodingBenchmarkReport {
	if (cases.length === 0 || new Set(cases.map((entry) => entry.id)).size !== cases.length) {
		throw new Error("Knowledge encoding benchmark requires unique representative cases.");
	}
	const results = cases.map((entry) => ({
		id: entry.id,
		results: METHODS.map((method) => runMethod(entry, method)),
	}));
	const body = {schemaVersion: "1.0.0" as const, cases: results};
	return Object.freeze({...body, digest: canonicalJsonDigest(body)});
}

function runMethod(
	entry: KnowledgeEncodingBenchmarkCase,
	method: KnowledgeEncodingMethod,
): KnowledgeEncodingBenchmarkResult {
	assertCase(entry);
	const startedAt = performance.now();
	const payload = encodedPayload(entry, method);
	const durationMs = performance.now() - startedAt;
	const novelty = measureByteNovelty([entry.baseDocument], payload);
	return Object.freeze({
		method,
		encodedBytes: Buffer.byteLength(payload),
		repeatedBytes: novelty.repeatedBytes,
		newBytes: novelty.newBytes,
		repeatedByteRatio:
			novelty.totalBytes === 0
				? 0
				: Math.round((novelty.repeatedBytes / novelty.totalBytes) * 1_000_000) /
					1_000_000,
		newFragmentCopies: countOccurrences(payload, entry.newSemanticFragment),
		durationMs,
		payloadDigest: canonicalJsonDigest({payload}),
	});
}

function encodedPayload(
	entry: KnowledgeEncodingBenchmarkCase,
	method: KnowledgeEncodingMethod,
): string {
	switch (method) {
		case "full_document":
			return entry.targetDocument;
		case "unified_diff":
			return unifiedDiff(entry.baseDocument, entry.targetDocument);
		case "byte_splice":
			return canonicalJson(byteSplice(entry.baseDocument, entry.targetDocument));
		case "structural_section":
			return canonicalJson({
				locator: entry.sectionLocator ?? entry.targetId,
				replacement: entry.newSemanticFragment,
			});
		case "semantic_effect":
			return semanticEffect(entry);
		default: {
			const exhaustive: never = method;
			throw new Error(`Unsupported Knowledge encoding method ${String(exhaustive)}.`);
		}
	}
}

function semanticEffect(entry: KnowledgeEncodingBenchmarkCase): string {
	if (entry.newSemanticFragment === null) {
		return canonicalJson({
			kind: "unchanged",
			refs: [entry.targetId],
			priorDigest: entry.priorDigest,
		});
	}
	return canonicalJson({
		kind: "effects",
		effects: [
			{
				action: "set",
				target: entry.targetId,
				expected: entry.priorDigest,
				postState: entry.newSemanticFragment,
			},
		],
	});
}

function byteSplice(base: string, target: string): CanonicalJsonValue {
	let prefix = 0;
	while (prefix < base.length && prefix < target.length && base[prefix] === target[prefix]) {
		prefix += 1;
	}
	let suffix = 0;
	while (
		suffix < base.length - prefix &&
		suffix < target.length - prefix &&
		base[base.length - suffix - 1] === target[target.length - suffix - 1]
	) {
		suffix += 1;
	}
	return {
		start: Buffer.byteLength(base.slice(0, prefix)),
		deleteBytes: Buffer.byteLength(base.slice(prefix, base.length - suffix)),
		insert: target.slice(prefix, target.length - suffix),
	};
}

function unifiedDiff(base: string, target: string): string {
	if (base === target) return "";
	const removed = base.split("\n").map((line) => `-${line}`);
	const added = target.split("\n").map((line) => `+${line}`);
	return ["--- current", "+++ desired", ...removed, ...added].join("\n");
}

function countOccurrences(value: string, fragment: string | null): number {
	if (!fragment) return 0;
	let count = 0;
	let offset = 0;
	while (offset <= value.length - fragment.length) {
		const found = value.indexOf(fragment, offset);
		if (found < 0) break;
		count += 1;
		offset = found + fragment.length;
	}
	return count;
}

function assertCase(entry: KnowledgeEncodingBenchmarkCase): void {
	if (!entry.id || !entry.targetId || !/^sha256:[0-9a-f]{64}$/u.test(entry.priorDigest)) {
		throw new Error("Knowledge encoding benchmark case identity is invalid.");
	}
	if (entry.newSemanticFragment === null && entry.baseDocument !== entry.targetDocument) {
		throw new Error("No-effect benchmark case cannot change target document bytes.");
	}
}
