import {
	decodeCanonicalValue,
	isCanonicalObject,
	type CanonicalIssue,
	type CanonicalValue,
} from "../canonical/json.ts";
import {failure, success, type Outcome} from "../canonical/outcome.ts";

export const LEGACY_ATTRIBUTE_PREFIX = "codewiki.legacy:";

export type WikiAttributeIssueCode =
	| "invalid_attribute_key"
	| "invalid_attribute_map"
	| "invalid_attribute_value";

export interface WikiAttributeIssue {
	readonly code: WikiAttributeIssueCode;
	readonly path: string;
	readonly message: string;
	readonly cause?: CanonicalIssue;
}

export interface PartitionedWikiAttributes {
	readonly semantic: Readonly<{[key: string]: CanonicalValue}>;
	readonly provenance: Readonly<{[key: string]: CanonicalValue}>;
}

export function partitionWikiAttributes(
	input: unknown,
): Outcome<PartitionedWikiAttributes, WikiAttributeIssue> {
	const decoded = decodeCanonicalValue(input);
	if (!decoded.ok) {
		return failure(attributeIssue(
			"invalid_attribute_value",
			"attributes",
			"Wiki attributes must be canonical values.",
			decoded.error,
		));
	}
	if (!isCanonicalObject(decoded.value)) {
		return failure(attributeIssue(
			"invalid_attribute_map",
			"attributes",
			"Wiki attributes must be an object.",
		));
	}
	const semantic: {[key: string]: CanonicalValue} = Object.create(null) as {
		[key: string]: CanonicalValue;
	};
	const provenance: {[key: string]: CanonicalValue} = Object.create(null) as {
		[key: string]: CanonicalValue;
	};
	for (const [key, value] of Object.entries(decoded.value)) {
		if (!isNamespacedAttributeKey(key)) {
			return failure(attributeIssue(
				"invalid_attribute_key",
				`attributes[${JSON.stringify(key)}]`,
				"Wiki attribute keys must use a canonical namespace.",
			));
		}
		if (key.startsWith(LEGACY_ATTRIBUTE_PREFIX)) provenance[key] = value;
		else semantic[key] = value;
	}
	return success(Object.freeze({
		semantic: Object.freeze(semantic),
		provenance: Object.freeze(provenance),
	}));
}

export function semanticWikiAttributes(
	input: unknown,
): Outcome<Readonly<{[key: string]: CanonicalValue}>, WikiAttributeIssue> {
	const partitioned = partitionWikiAttributes(input);
	return partitioned.ok ? success(partitioned.value.semantic) : partitioned;
}

function isNamespacedAttributeKey(value: string): boolean {
	return /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*:[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/.test(value);
}

function attributeIssue(
	code: WikiAttributeIssueCode,
	path: string,
	message: string,
	cause?: CanonicalIssue,
): WikiAttributeIssue {
	return cause === undefined
		? Object.freeze({code, path, message})
		: Object.freeze({code, path, message, cause});
}
