import {
	decodeContract,
	exactRecord,
	integerField,
	isNamespacedIdentifier,
	literalField,
	nullableValue,
	rejectContract,
	requiredField,
	textField,
	textValue,
	type CanonicalRecord,
	type ContractIssue,
} from "../../kernel/data-contracts/validation.ts";
import type {CanonicalValue} from "../../kernel/data-contracts/canonical-json.ts";
import type {Outcome} from "../../kernel/data-contracts/outcome.ts";
import {decodeGitOidValue, type GitOid} from "../../kernel/identity/git.ts";

export const PRODUCT_READ_OPERATIONS = Object.freeze([
	"project.discover",
	"project.capabilities",
	"project.status",
	"wiki.read",
	"changes.read",
	"checks.read",
	"work.read",
	"review.read",
	"alignment.read",
	"audit.read",
] as const);

export type ProductReadOperation = (typeof PRODUCT_READ_OPERATIONS)[number];
export type ProjectSourceSelector =
	| Readonly<{kind: "canonical"}>
	| Readonly<{kind: "change"; changeId: string}>
	| Readonly<{kind: "commit"; commit: GitOid}>;

export interface PageInput {
	readonly limit: number;
	readonly cursor: string | null;
}

export type WikiReadInput =
	| Readonly<{source: ProjectSourceSelector; view: "list"} & PageInput>
	| Readonly<{source: ProjectSourceSelector; view: "get"; itemId: string}>
	| Readonly<{source: ProjectSourceSelector; view: "dictionary"; term: string} & PageInput>
	| Readonly<{source: ProjectSourceSelector; view: "search"; query: string} & PageInput>
	| Readonly<{source: ProjectSourceSelector; view: "graph"; itemId: string; direction: "inbound" | "outbound" | "both"} & PageInput>
	| Readonly<{source: ProjectSourceSelector; view: "history"; itemId: string} & PageInput>
	| Readonly<{source: ProjectSourceSelector; view: "attribution"; itemId: string}>
	| Readonly<{source: ProjectSourceSelector; view: "diff"; baselineSource: ProjectSourceSelector} & PageInput>;

export type ChangesReadInput =
	| Readonly<{source: ProjectSourceSelector; view: "list"} & PageInput>
	| Readonly<{source: ProjectSourceSelector; view: "get"; changeId: string}>
	| Readonly<{source: ProjectSourceSelector; view: "decisions"; changeId: string | null} & PageInput>;

export interface ChecksReadInput extends PageInput {
	readonly source: ProjectSourceSelector;
	readonly view: "gates" | "results";
	readonly changeId: string | null;
}

export interface WorkReadInput extends PageInput {
	readonly source: ProjectSourceSelector;
	readonly changeId: string | null;
}

export interface ReviewReadInput {
	readonly source: ProjectSourceSelector;
	readonly changeId: string;
}

export interface AlignmentReadInput extends PageInput {
	readonly source: ProjectSourceSelector;
	readonly changeId: string | null;
}

export type AuditReadInput =
	| Readonly<{source: ProjectSourceSelector; view: "source"}>
	| Readonly<{source: ProjectSourceSelector; view: "wiki-provenance"; itemId: string}>
	| Readonly<{source: ProjectSourceSelector; view: "change"; changeId: string}>;

export type ProductReadInput =
	| Readonly<Record<string, never>>
	| Readonly<{source: ProjectSourceSelector}>
	| WikiReadInput
	| ChangesReadInput
	| ChecksReadInput
	| WorkReadInput
	| ReviewReadInput
	| AlignmentReadInput
	| AuditReadInput;

const CONTRACT = "codewiki.product-read-input@1.0.0";
const CHANGE_ID = /^CHG-[A-Za-z0-9][A-Za-z0-9._-]{0,195}$/u;

export function decodeProductReadInput(
	operation: ProductReadOperation,
	input: unknown,
): Outcome<ProductReadInput, ContractIssue> {
	return decodeContract(CONTRACT, input, (value) => {
		switch (operation) {
			case "project.discover":
			case "project.capabilities":
				return decodeEmpty(value);
			case "project.status":
				return decodeSourceOnly(value);
			case "wiki.read":
				return decodeWikiRead(value);
			case "changes.read":
				return decodeChangesRead(value);
			case "checks.read":
				return decodeChecksRead(value);
			case "work.read":
				return decodeWorkRead(value);
			case "review.read":
				return decodeReviewRead(value);
			case "alignment.read":
				return decodeAlignmentRead(value);
			case "audit.read":
				return decodeAuditRead(value);
			default:
				rejectContract("invalid_field", CONTRACT, "$.operation", "Product read operation is unsupported.");
		}
	});
}

function decodeEmpty(value: CanonicalValue): Readonly<Record<string, never>> {
	exactRecord(CONTRACT, value, "$", []);
	return Object.freeze({});
}

function decodeSourceOnly(value: CanonicalValue): Readonly<{source: ProjectSourceSelector}> {
	const record = exactRecord(CONTRACT, value, "$", ["source"]);
	return Object.freeze({source: decodeSource(requiredField(CONTRACT, record, "source"), "$.source")});
}

function decodeWikiRead(value: CanonicalValue): WikiReadInput {
	const base = exactRecord(CONTRACT, value, "$", ["source", "view"], [
		"baselineSource", "cursor", "direction", "itemId", "limit", "query", "term",
	]);
	const source = decodeSource(requiredField(CONTRACT, base, "source"), "$.source");
	const view = literalField(CONTRACT, base, "view", [
		"list", "get", "dictionary", "search", "graph", "history", "attribution", "diff",
	] as const);
	switch (view) {
		case "list": {
			const record = exactRecord(CONTRACT, value, "$", ["source", "view", "limit", "cursor"]);
			return Object.freeze({source, view, ...decodePage(record)});
		}
		case "get":
		case "attribution": {
			const record = exactRecord(CONTRACT, value, "$", ["source", "view", "itemId"]);
			return Object.freeze({source, view, itemId: itemIdField(record)});
		}
		case "dictionary": {
			const record = exactRecord(CONTRACT, value, "$", ["source", "view", "term", "limit", "cursor"]);
			return Object.freeze({source, view, term: queryField(record, "term"), ...decodePage(record)});
		}
		case "search": {
			const record = exactRecord(CONTRACT, value, "$", ["source", "view", "query", "limit", "cursor"]);
			return Object.freeze({source, view, query: queryField(record, "query"), ...decodePage(record)});
		}
		case "graph": {
			const record = exactRecord(CONTRACT, value, "$", ["source", "view", "itemId", "direction", "limit", "cursor"]);
			return Object.freeze({
				source,
				view,
				itemId: itemIdField(record),
				direction: literalField(CONTRACT, record, "direction", ["inbound", "outbound", "both"] as const),
				...decodePage(record),
			});
		}
		case "history": {
			const record = exactRecord(CONTRACT, value, "$", ["source", "view", "itemId", "limit", "cursor"]);
			return Object.freeze({source, view, itemId: itemIdField(record), ...decodePage(record)});
		}
		case "diff": {
			const record = exactRecord(CONTRACT, value, "$", ["source", "view", "baselineSource", "limit", "cursor"]);
			return Object.freeze({
				source,
				view,
				baselineSource: decodeSource(requiredField(CONTRACT, record, "baselineSource"), "$.baselineSource"),
				...decodePage(record),
			});
		}
		default:
			rejectContract("invalid_field", CONTRACT, "$.view", "Wiki read View is unsupported.");
	}
}

function decodeChangesRead(value: CanonicalValue): ChangesReadInput {
	const base = exactRecord(CONTRACT, value, "$", ["source", "view"], ["changeId", "limit", "cursor"]);
	const source = sourceField(base);
	const view = literalField(CONTRACT, base, "view", ["list", "get", "decisions"] as const);
	if (view === "get") {
		const record = exactRecord(CONTRACT, value, "$", ["source", "view", "changeId"]);
		return Object.freeze({source, view, changeId: changeIdField(record, "changeId")});
	}
	if (view === "list") {
		const record = exactRecord(CONTRACT, value, "$", ["source", "view", "limit", "cursor"]);
		return Object.freeze({source, view, ...decodePage(record)});
	}
	const record = exactRecord(CONTRACT, value, "$", ["source", "view", "changeId", "limit", "cursor"]);
	return Object.freeze({source, view, changeId: nullableChangeId(record), ...decodePage(record)});
}

function decodeChecksRead(value: CanonicalValue): ChecksReadInput {
	const record = exactRecord(CONTRACT, value, "$", ["source", "view", "changeId", "limit", "cursor"]);
	return Object.freeze({
		source: sourceField(record),
		view: literalField(CONTRACT, record, "view", ["gates", "results"] as const),
		changeId: nullableChangeId(record),
		...decodePage(record),
	});
}

function decodeWorkRead(value: CanonicalValue): WorkReadInput {
	const record = exactRecord(CONTRACT, value, "$", ["source", "changeId", "limit", "cursor"]);
	return Object.freeze({source: sourceField(record), changeId: nullableChangeId(record), ...decodePage(record)});
}

function decodeReviewRead(value: CanonicalValue): ReviewReadInput {
	const record = exactRecord(CONTRACT, value, "$", ["source", "changeId"]);
	return Object.freeze({source: sourceField(record), changeId: changeIdField(record, "changeId")});
}

function decodeAlignmentRead(value: CanonicalValue): AlignmentReadInput {
	const record = exactRecord(CONTRACT, value, "$", ["source", "changeId", "limit", "cursor"]);
	return Object.freeze({source: sourceField(record), changeId: nullableChangeId(record), ...decodePage(record)});
}

function decodeAuditRead(value: CanonicalValue): AuditReadInput {
	const base = exactRecord(CONTRACT, value, "$", ["source", "view"], ["changeId", "itemId"]);
	const source = sourceField(base);
	const view = literalField(CONTRACT, base, "view", ["source", "wiki-provenance", "change"] as const);
	if (view === "source") {
		exactRecord(CONTRACT, value, "$", ["source", "view"]);
		return Object.freeze({source, view});
	}
	if (view === "wiki-provenance") {
		const record = exactRecord(CONTRACT, value, "$", ["source", "view", "itemId"]);
		return Object.freeze({source, view, itemId: itemIdField(record)});
	}
	const record = exactRecord(CONTRACT, value, "$", ["source", "view", "changeId"]);
	return Object.freeze({source, view, changeId: changeIdField(record, "changeId")});
}

function decodeSource(value: CanonicalValue, path: string): ProjectSourceSelector {
	const record = exactRecord(CONTRACT, value, path, ["kind"], ["changeId", "commit"]);
	const kind = literalField(CONTRACT, record, "kind", ["canonical", "change", "commit"] as const, path);
	if (kind === "canonical") {
		exactRecord(CONTRACT, value, path, ["kind"]);
		return Object.freeze({kind});
	}
	if (kind === "change") {
		exactRecord(CONTRACT, value, path, ["kind", "changeId"]);
		return Object.freeze({kind, changeId: changeIdField(record, "changeId", path)});
	}
	exactRecord(CONTRACT, value, path, ["kind", "commit"]);
	return Object.freeze({kind, commit: decodeGitOidValue(requiredField(CONTRACT, record, "commit", path), `${path}.commit`)});
}

function decodePage(record: CanonicalRecord): PageInput {
	return Object.freeze({
		limit: integerField(CONTRACT, record, "limit", "$", 1, 100),
		cursor: nullableValue(requiredField(CONTRACT, record, "cursor"), (value) => textValue(CONTRACT, value, "$.cursor", {
			minimumBytes: 1,
			maximumBytes: 1_024,
		})),
	});
}

function sourceField(record: CanonicalRecord): ProjectSourceSelector {
	return decodeSource(requiredField(CONTRACT, record, "source"), "$.source");
}

function itemIdField(record: CanonicalRecord): string {
	const itemId = textField(CONTRACT, record, "itemId", "$", {maximumBytes: 512});
	if (!isNamespacedIdentifier(itemId)) rejectContract("invalid_field", CONTRACT, "$.itemId", "Wiki Item ID must be namespaced.");
	return itemId;
}

function changeIdField(record: CanonicalRecord, field: string, path = "$"): string {
	return textField(CONTRACT, record, field, path, {maximumBytes: 200, pattern: CHANGE_ID});
}

function nullableChangeId(record: CanonicalRecord): string | null {
	return nullableValue(requiredField(CONTRACT, record, "changeId"), (value) =>
		textValue(CONTRACT, value, "$.changeId", {maximumBytes: 200, pattern: CHANGE_ID}));
}

function queryField(record: CanonicalRecord, field: "query" | "term"): string {
	return textField(CONTRACT, record, field, "$", {minimumBytes: 1, maximumBytes: 4_096});
}
