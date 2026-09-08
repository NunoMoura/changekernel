import {
	arrayField,
	decodeContract,
	exactRecord,
	isNamespacedIdentifier,
	rejectContract,
	requiredField,
	textField,
	textValue,
	type ContractIssue,
} from "../data-contracts/validation.ts";
import {isCanonicalObject, type CanonicalValue} from "../data-contracts/canonical-json.ts";
import {failure, type Outcome} from "../data-contracts/outcome.ts";
import {semanticDigest, type SemanticIdentityIssue} from "../identity/semantic-digest.ts";
import type {Sha256Digest} from "../identity/sha256.ts";
import {LEGACY_ATTRIBUTE_PREFIX, partitionWikiAttributes} from "./attributes.ts";

export const WIKI_ITEM_PROTOCOL = "codewiki.wiki-item@1.0.0";

export interface WikiRelationship {
	readonly predicate: string;
	readonly targetItemId: string;
	readonly attributes: Readonly<{[key: string]: CanonicalValue}>;
}

export interface WikiProvenance {
	readonly kind: string;
	readonly subjectId: string;
	readonly attributes: Readonly<{[key: string]: CanonicalValue}>;
}

export interface WikiItemEnvelope {
	readonly protocol: typeof WIKI_ITEM_PROTOCOL;
	readonly itemId: string;
	readonly itemType: string;
	readonly title: string;
	readonly aliases: readonly string[];
	readonly attributes: Readonly<{[key: string]: CanonicalValue}>;
	readonly relationships: readonly WikiRelationship[];
	readonly provenance: readonly WikiProvenance[];
}

export interface WikiItem extends WikiItemEnvelope {
	readonly body: string;
	readonly semanticDigest: Sha256Digest;
}

export type WikiItemIssue = ContractIssue | SemanticIdentityIssue;

export function decodeWikiItem(input: unknown, body: unknown): Outcome<WikiItem, WikiItemIssue> {
	const envelope = decodeWikiItemEnvelope(input);
	if (!envelope.ok) return envelope;
	const decodedBody = decodeContract("Wiki Item body", body, (value) =>
		textValue("Wiki Item body", value, "$", {minimumBytes: 0, maximumBytes: 4 * 1024 * 1024}));
	if (!decodedBody.ok) return decodedBody;
	const semantic = semanticProjection(envelope.value, decodedBody.value);
	const digest = semanticDigest(WIKI_ITEM_PROTOCOL, semantic);
	if (!digest.ok) return failure(digest.error);
	return {
		ok: true,
		value: Object.freeze({...envelope.value, body: decodedBody.value, semanticDigest: digest.value}),
	};
}

export function decodeWikiItemEnvelope(input: unknown): Outcome<WikiItemEnvelope, ContractIssue> {
	return decodeContract("Wiki Item", input, (value) => {
		const record = exactRecord("Wiki Item", value, "$", [
			"aliases",
			"attributes",
			"itemId",
			"itemType",
			"protocol",
			"provenance",
			"relationships",
			"title",
		]);
		const protocol = textField("Wiki Item", record, "protocol", "$", {maximumBytes: 64});
		if (protocol !== WIKI_ITEM_PROTOCOL) rejectContract("invalid_protocol", "Wiki Item", "$.protocol", `Expected ${WIKI_ITEM_PROTOCOL}.`);
		const itemId = namespacedField(record, "itemId", "$", "Wiki Item");
		const itemType = namespacedField(record, "itemType", "$", "Wiki Item");
		const aliases = normalizeTextSet(
			arrayField("Wiki Item", record, "aliases", "$", 256),
			"$.aliases",
			1_024,
		);
		const attributes = decodeAttributeMap(requiredField("Wiki Item", record, "attributes"), "$.attributes");
		const relationships = decodeRelationships(arrayField("Wiki Item", record, "relationships", "$", 4_096));
		const provenance = decodeProvenance(arrayField("Wiki Item", record, "provenance", "$", 1_024));
		return Object.freeze({
			protocol: WIKI_ITEM_PROTOCOL,
			itemId,
			itemType,
			title: textField("Wiki Item", record, "title", "$", {maximumBytes: 1_024}),
			aliases,
			attributes,
			relationships,
			provenance,
		});
	});
}

export function wikiItemSemanticProjection(item: WikiItemEnvelope, body: string): CanonicalValue {
	return semanticProjection(item, body);
}

function decodeRelationships(input: readonly CanonicalValue[]): readonly WikiRelationship[] {
	const output = input.map((value, index) => {
		const path = `$.relationships[${index}]`;
		const record = exactRecord("Wiki Item", value, path, ["attributes", "predicate", "targetItemId"]);
		return Object.freeze({
			predicate: namespacedField(record, "predicate", path, "Wiki Item"),
			targetItemId: namespacedField(record, "targetItemId", path, "Wiki Item"),
			attributes: decodeAttributeMap(requiredField("Wiki Item", record, "attributes", path), `${path}.attributes`),
		});
	});
	return sortUniqueRecords(output, "$.relationships", (entry) => `${entry.predicate}\0${entry.targetItemId}\0${stableCanonicalKey(entry.attributes)}`);
}

function decodeProvenance(input: readonly CanonicalValue[]): readonly WikiProvenance[] {
	const output = input.map((value, index) => {
		const path = `$.provenance[${index}]`;
		const record = exactRecord("Wiki Item", value, path, ["attributes", "kind", "subjectId"]);
		return Object.freeze({
			kind: namespacedField(record, "kind", path, "Wiki Item"),
			subjectId: namespacedField(record, "subjectId", path, "Wiki Item"),
			attributes: decodeAttributeMap(requiredField("Wiki Item", record, "attributes", path), `${path}.attributes`),
		});
	});
	return sortUniqueRecords(output, "$.provenance", (entry) => `${entry.kind}\0${entry.subjectId}\0${stableCanonicalKey(entry.attributes)}`);
}

function decodeAttributeMap(value: CanonicalValue, path: string): Readonly<{[key: string]: CanonicalValue}> {
	const partitioned = partitionWikiAttributes(value);
	if (!partitioned.ok) rejectContract("invalid_field", "Wiki Item", path, partitioned.error.message);
	if (!isCanonicalObject(value)) rejectContract("invalid_field", "Wiki Item", path, "Attributes must be an object.");
	return value;
}

function namespacedField(
	record: Readonly<{[key: string]: CanonicalValue}>,
	field: string,
	path: string,
	contract: string,
): string {
	const value = textField(contract, record, field, path, {maximumBytes: 256});
	if (!isNamespacedIdentifier(value)) rejectContract("invalid_field", contract, `${path}.${field}`, "Identity must be canonical namespaced text.");
	return value;
}

function semanticProjection(item: WikiItemEnvelope, body: string): CanonicalValue {
	const relationships = item.relationships.flatMap((entry) => entry.predicate.startsWith(LEGACY_ATTRIBUTE_PREFIX) ? [] : [Object.freeze({
		predicate: entry.predicate,
		targetItemId: entry.targetItemId,
		attributes: stripLegacy(entry.attributes),
	})]);
	const provenance = item.provenance.flatMap((entry) => entry.kind.startsWith(LEGACY_ATTRIBUTE_PREFIX) ? [] : [Object.freeze({
		kind: entry.kind,
		subjectId: entry.subjectId,
		attributes: stripLegacy(entry.attributes),
	})]);
	return Object.freeze({
		protocol: item.protocol,
		itemId: item.itemId,
		itemType: item.itemType.startsWith(LEGACY_ATTRIBUTE_PREFIX) ? null : item.itemType,
		title: item.title,
		aliases: item.aliases,
		attributes: stripLegacy(item.attributes),
		relationships: Object.freeze(relationships),
		provenance: Object.freeze(provenance),
		body,
	});
}

function stripLegacy(value: CanonicalValue): CanonicalValue {
	if (Array.isArray(value)) return Object.freeze(value.map(stripLegacy));
	if (!isCanonicalObject(value)) return value;
	const output: {[key: string]: CanonicalValue} = Object.create(null) as {[key: string]: CanonicalValue};
	for (const [key, child] of Object.entries(value)) {
		if (!key.startsWith(LEGACY_ATTRIBUTE_PREFIX)) output[key] = stripLegacy(child);
	}
	return Object.freeze(output);
}

function normalizeTextSet(input: readonly CanonicalValue[], path: string, maximumBytes: number): readonly string[] {
	const output = input.map((entry, index) => textValue("Wiki Item", entry, `${path}[${index}]`, {maximumBytes}));
	output.sort(compareText);
	for (let index = 1; index < output.length; index += 1) {
		if (output[index - 1] === output[index]) rejectContract("invalid_field", "Wiki Item", path, "Values must be unique.");
	}
	return Object.freeze(output);
}

function sortUniqueRecords<Value>(values: Value[], path: string, key: (value: Value) => string): readonly Value[] {
	values.sort((left, right) => compareText(key(left), key(right)));
	for (let index = 1; index < values.length; index += 1) {
		if (key(values[index - 1] as Value) === key(values[index] as Value)) {
			rejectContract("invalid_field", "Wiki Item", path, "Entries must be unique.");
		}
	}
	return Object.freeze(values);
}

function stableCanonicalKey(value: Readonly<{[key: string]: CanonicalValue}>): string {
	return JSON.stringify(value);
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
