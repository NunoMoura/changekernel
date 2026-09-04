import {readExactWikiHistory} from "../../adapters/git/wiki.ts";
import type {WikiReadInput} from "../../api/contracts/read.ts";
import {decodeCanonicalValue, isCanonicalObject, type CanonicalValue} from "../../kernel/canonical/json.ts";
import {failure, success, type Outcome} from "../../kernel/canonical/outcome.ts";
import {LEGACY_ATTRIBUTE_PREFIX} from "../../kernel/wiki/attributes.ts";
import {decodeWikiInlineLinks} from "../../kernel/wiki/links.ts";
import {validateWikiTransaction} from "../../kernel/wiki/transaction.ts";
import {
	createDictionaryView,
	createWikiAttributionView,
	createWikiGetView,
	createWikiGraphView,
	createWikiHistoryView,
	createWikiListView,
	createWikiSearchView,
	createWikiSemanticDiffView,
	type WikiView,
	type WikiViewAuthorization,
	type WikiViewIssue,
} from "../../kernel/wiki/views.ts";
import type {WikiMaterialization} from "../../kernel/wiki/tree.ts";
import type {ProjectStorePort} from "../../ports/project-store.ts";
import {productError, type ProductError} from "../../api/transport/envelope.ts";
import type {AuthorizedProjectActor} from "../authorization/policy.ts";
import {
	loadWikiSource,
	type ProjectReadConfiguration,
	type ProjectSourceIssue,
} from "./source.ts";

export async function executeWikiRead(
	store: ProjectStorePort,
	configuration: ProjectReadConfiguration,
	actor: AuthorizedProjectActor,
	input: WikiReadInput,
): Promise<Outcome<unknown, ProductError>> {
	const loaded = await loadWikiSource(store, configuration, input.source);
	if (!loaded.ok) return failure(sourceError(loaded.error));
	const authorization = wikiAuthorization(loaded.value.wiki, actor);
	if (!authorization.ok) return authorization;
	if (input.view === "list") {
		return normalResult(input.view, createWikiListView(loaded.value.wiki, {...input, authorization: authorization.value}));
	}
	if (input.view === "get") {
		return normalResult(input.view, createWikiGetView(loaded.value.wiki, {...input, authorization: authorization.value}));
	}
	if (input.view === "dictionary") {
		return normalResult(input.view, createDictionaryView(loaded.value.wiki, {...input, authorization: authorization.value}));
	}
	if (input.view === "search") {
		return normalResult(input.view, createWikiSearchView(loaded.value.wiki, {...input, authorization: authorization.value}));
	}
	if (input.view === "graph") {
		return normalResult(input.view, createWikiGraphView(loaded.value.wiki, {...input, authorization: authorization.value}));
	}
	if (input.view === "attribution") {
		return normalResult(input.view, createWikiAttributionView(loaded.value.wiki, {...input, authorization: authorization.value}));
	}
	if (input.view === "history") {
		const history = await readExactWikiHistory(store, {
			repositoryId: configuration.repositoryId,
			objectFormat: configuration.objectFormat,
			selector: Object.freeze({kind: "oid", oid: loaded.value.snapshot.commit}),
			kernelBuildDigest: configuration.kernelBuildDigest,
			retiredItemIds: configuration.retiredWikiItemIds,
			limits: {
				maximumItems: configuration.limits.maximumWikiItems,
				maximumFileBytes: configuration.limits.maximumWikiFileBytes,
				maximumTotalBytes: configuration.limits.maximumWikiTotalBytes,
			},
			itemId: input.itemId,
			maximumCommits: configuration.limits.maximumHistoryCommits,
			maximumHistoryBytes: configuration.limits.maximumHistoryBytes,
		});
		if (!history.ok) return failure(productError(
			history.error.code === "limit_exceeded" ? "limit_exceeded" : "invalid_project_state",
			"Wiki history could not be read safely.",
			"Narrow the history request or ask a maintainer to inspect the Project.",
			false,
		));
		return normalResult(input.view, createWikiHistoryView(loaded.value.wiki, history.value, {...input, authorization: authorization.value}));
	}
	const baseline = await loadWikiSource(store, configuration, input.baselineSource);
	if (!baseline.ok) return failure(sourceError(baseline.error));
	const transaction = validateWikiTransaction({before: baseline.value.wiki, after: loaded.value.wiki});
	if (!transaction.ok) return failure(productError(
		"invalid_project_state",
		"The requested Wiki comparison is not a valid Project transition.",
		"Choose compatible Project sources or ask a maintainer to inspect the Change.",
		false,
	));
	const sharedAuthorization = sharedWikiAuthorization(baseline.value.wiki, loaded.value.wiki, actor);
	if (!sharedAuthorization.ok) return sharedAuthorization;
	return normalResult(input.view, createWikiSemanticDiffView(transaction.value, {...input, authorization: sharedAuthorization.value}));
}

export function wikiAuthorization(
	wiki: WikiMaterialization,
	actor: AuthorizedProjectActor,
): Outcome<WikiViewAuthorization, ProductError> {
	if (actor.wikiItemIds === null) return success(Object.freeze({authorizationId: actor.authorizationId, visibility: "all" as const}));
	const visible = new Set(actor.wikiItemIds);
	let changed = true;
	while (changed) {
		changed = false;
		for (const file of wiki.items) {
			if (!visible.has(file.item.itemId)) continue;
			const semanticTargets = file.item.relationships.flatMap((entry) =>
				entry.predicate.startsWith(LEGACY_ATTRIBUTE_PREFIX) ? [] : [entry.targetItemId]);
			const inlineTargets = decodeWikiInlineLinks(file.item.body);
			if (!inlineTargets.ok) return failure(productError(
				"invalid_project_state",
				"Wiki visibility could not be checked safely.",
				"Ask a maintainer to inspect the Wiki source.",
				false,
			));
			if ([...semanticTargets, ...inlineTargets.value].some((target) => !visible.has(target))) {
				visible.delete(file.item.itemId);
				changed = true;
			}
		}
	}
	return success(Object.freeze({
		authorizationId: actor.authorizationId,
		visibility: "allowlist" as const,
		itemIds: Object.freeze([...visible].sort(compareText)),
	}));
}

function sharedWikiAuthorization(
	before: WikiMaterialization,
	after: WikiMaterialization,
	actor: AuthorizedProjectActor,
): Outcome<WikiViewAuthorization, ProductError> {
	const beforeAuthorization = wikiAuthorization(before, actor);
	if (!beforeAuthorization.ok) return beforeAuthorization;
	const afterAuthorization = wikiAuthorization(after, actor);
	if (!afterAuthorization.ok) return afterAuthorization;
	if (beforeAuthorization.value.visibility === "all" && afterAuthorization.value.visibility === "all") {
		return beforeAuthorization;
	}
	const beforeItemIds = new Set(before.items.map((file) => file.item.itemId));
	const afterItemIds = new Set(after.items.map((file) => file.item.itemId));
	const beforeVisible = beforeAuthorization.value.visibility === "all"
		? beforeItemIds
		: new Set(beforeAuthorization.value.itemIds);
	const afterVisible = afterAuthorization.value.visibility === "all"
		? afterItemIds
		: new Set(afterAuthorization.value.itemIds);
	const visible = new Set<string>();
	for (const itemId of beforeVisible) {
		if (!afterItemIds.has(itemId) || afterVisible.has(itemId)) visible.add(itemId);
	}
	for (const itemId of afterVisible) {
		if (!beforeItemIds.has(itemId) || beforeVisible.has(itemId)) visible.add(itemId);
	}
	return success(Object.freeze({
		authorizationId: actor.authorizationId,
		visibility: "allowlist" as const,
		itemIds: Object.freeze([...visible].sort(compareText)),
	}));
}

function normalResult(
	viewName: WikiReadInput["view"],
	result: Outcome<WikiView<unknown>, WikiViewIssue>,
): Outcome<unknown, ProductError> {
	if (!result.ok) return failure(viewError(result.error));
	const canonicalData = decodeCanonicalValue(result.value.data);
	if (!canonicalData.ok) return failure(productError(
		"invalid_project_state",
		"The Wiki View could not be projected safely.",
		"Ask a maintainer to inspect the selected Project state.",
		true,
	));
	return success(Object.freeze({
		presentation: Object.freeze({
			view: viewName,
			data: safeCanonicalText(normalWikiData(viewName, canonicalData.value)),
			coverage: Object.freeze({
				returned: result.value.metadata.coverage.returned,
				complete: result.value.metadata.coverage.complete,
			}),
			nextCursor: result.value.metadata.truncation.nextCursor,
			more: result.value.metadata.truncation.truncated,
			unknowns: result.value.metadata.unknowns.length === 0
				? Object.freeze([])
				: Object.freeze(["More information may exist beyond the safe read bounds."]),
		}),
		technicalEvidence: Object.freeze({metadata: result.value.metadata, viewDigest: result.value.viewDigest}),
	}));
}

function normalWikiData(view: WikiReadInput["view"], value: CanonicalValue): CanonicalValue {
	if (!isCanonicalObject(value)) return null;
	if (view === "get") return getData(value);
	if (view === "list") return Object.freeze({items: summaryArray(value.items)});
	if (view === "dictionary") return Object.freeze({
		term: canonicalOrNull(value.term),
		ambiguous: canonicalOrNull(value.ambiguous),
		senses: summaryArray(value.senses),
	});
	if (view === "search") return Object.freeze({
		query: canonicalOrNull(value.query),
		results: Array.isArray(value.results) ? Object.freeze(value.results.map((entry) => {
			if (!isCanonicalObject(entry)) return null;
			return Object.freeze({item: summary(entry.item), score: canonicalOrNull(entry.score)});
		})) : Object.freeze([]),
	});
	if (view === "graph") return Object.freeze({
		rootItemId: canonicalOrNull(value.rootItemId),
		nodes: summaryArray(value.nodes),
		edges: canonicalOrEmptyArray(value.edges),
	});
	if (view === "attribution") return Object.freeze({
		item: summary(value.item),
		provenance: canonicalOrEmptyArray(value.provenance),
	});
	if (view === "history") return Object.freeze({
		itemId: canonicalOrNull(value.itemId),
		revisions: normalHistoryRevisions(value.revisions),
	});
	if (view === "diff") return Object.freeze({changes: normalDiffChanges(value.changes)});
	return null;
}

function normalHistoryRevisions(value: CanonicalValue | undefined): readonly CanonicalValue[] {
	if (!Array.isArray(value)) return Object.freeze([]);
	return Object.freeze(value.map((entry) => {
		if (!isCanonicalObject(entry)) return null;
		return Object.freeze({kind: canonicalOrNull(entry.kind), state: entry.state === null ? null : summary(entry.state)});
	}));
}

function normalDiffChanges(value: CanonicalValue | undefined): readonly CanonicalValue[] {
	if (!Array.isArray(value)) return Object.freeze([]);
	return Object.freeze(value.map((entry) => {
		if (!isCanonicalObject(entry)) return null;
		return Object.freeze({
			itemId: canonicalOrNull(entry.itemId),
			kind: canonicalOrNull(entry.kind),
			fields: canonicalOrEmptyArray(entry.fields),
		});
	}));
}

function getData(value: Readonly<{[key: string]: CanonicalValue}>): CanonicalValue {
	if (value.item === undefined || !isCanonicalObject(value.item)) return null;
	const {protocol: _protocol, ...item} = value.item;
	return Object.freeze({item: Object.freeze(item)});
}

function summaryArray(value: CanonicalValue | undefined): readonly CanonicalValue[] {
	if (!Array.isArray(value)) return Object.freeze([]);
	return Object.freeze(value.map(summary));
}

function summary(value: CanonicalValue | undefined): CanonicalValue {
	if (value === undefined || !isCanonicalObject(value)) return null;
	return Object.freeze({
		itemId: canonicalOrNull(value.itemId),
		itemType: canonicalOrNull(value.itemType),
		title: canonicalOrNull(value.title),
		aliases: canonicalOrEmptyArray(value.aliases),
	});
}

function canonicalOrEmptyArray(value: CanonicalValue | undefined): readonly CanonicalValue[] {
	return Array.isArray(value) ? value : Object.freeze([]);
}

function canonicalOrNull(value: CanonicalValue | undefined): CanonicalValue {
	return value ?? null;
}

function sourceError(value: ProjectSourceIssue): ProductError {
	if (value.code === "source_not_found") return productError(
		"source_not_found",
		"The requested Project source does not exist.",
		"Choose the current Project or another available Change.",
		false,
	);
	if (value.code === "source_stale") return productError(
		"source_stale",
		"The Project changed before this read completed.",
		"Refresh and retry from the current Project state.",
		false,
	);
	if (value.code === "limit_exceeded") return productError(
		"limit_exceeded",
		"The requested Project information exceeds the safe read bounds.",
		"Narrow the request and retry.",
		false,
	);
	return productError(
		"invalid_project_state",
		"The selected Project state could not be validated.",
		"Ask a maintainer to inspect the Project state.",
		true,
	);
}

function viewError(value: WikiViewIssue): ProductError {
	if (value.code === "not_found") return productError(
		"not_found",
		"The requested Wiki Item was not found.",
		"Check the Item name or choose another result.",
		false,
	);
	if (value.code === "invalid_cursor" || value.code === "invalid_request") return productError(
		"invalid_request",
		"The Wiki read request is invalid.",
		"Refresh the result and retry with valid bounds.",
		false,
	);
	return productError(
		"invalid_project_state",
		"The Wiki View could not be derived safely.",
		"Ask a maintainer to inspect the selected Project state.",
		true,
	);
}

function safeCanonicalText(value: CanonicalValue): CanonicalValue {
	if (typeof value === "string") {
		return value.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, "�");
	}
	if (Array.isArray(value)) return Object.freeze(value.map(safeCanonicalText));
	if (isCanonicalObject(value)) {
		const output: Record<string, CanonicalValue> = Object.create(null) as Record<string, CanonicalValue>;
		for (const [key, entry] of Object.entries(value)) output[key] = safeCanonicalText(entry);
		return Object.freeze(output);
	}
	return value;
}

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}
