import { createHash } from "node:crypto";
import type { Sha256Digest } from "../utils/canonical-json.ts";
import type { Change } from "./types.ts";

export function changeContentDigest(change: Change): Sha256Digest {
	return `sha256:${createHash("sha256")
		.update(stableJson(changeContent(change)))
		.digest("hex")}`;
}

function changeContent(change: Change): Record<string, unknown> {
	return {
		schemaVersion: change.schemaVersion,
		id: change.id,
		revision: change.revision,
		intent: change.intent,
		classification: change.classification,
		impact: change.impact,
		evidence: change.evidence,
		safety: change.safety,
		estimates: change.estimates,
		provenance: {
			origin: change.provenance.origin,
			createdBy: change.provenance.createdBy,
			createdAt: change.provenance.createdAt,
			discoveredWhile: change.provenance.discoveredWhile,
		},
	};
}

type JsonStringifyValue =
	| null
	| boolean
	| number
	| string
	| undefined
	| readonly JsonStringifyValue[]
	| {readonly [key: string]: JsonStringifyValue};

export function stableJson(value: unknown): string {
	const serialized = JSON.stringify(sortValue(value));
	if (serialized === undefined) {
		throw new Error("Stable JSON value is not serializable.");
	}
	return serialized;
}

function sortValue(value: unknown): JsonStringifyValue {
	if (Array.isArray(value)) return value.map(sortValue);
	if (isRecord(value)) {
		return Object.fromEntries(
			Object.entries(value)
				.filter(([, entry]) => entry !== undefined)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, sortValue(entry)]),
		);
	}
	if (
		value === null ||
		value === undefined ||
		typeof value === "boolean" ||
		typeof value === "number" ||
		typeof value === "string"
	) {
		return value;
	}
	if (typeof value === "bigint") {
		throw new TypeError("Stable JSON cannot serialize bigint values.");
	}
	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
