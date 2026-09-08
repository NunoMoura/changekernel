import assert from "node:assert/strict";
import test from "node:test";

import {canonicalJson} from "../../../src/kernel/data-contracts/canonical-json.ts";
import {validateWikiTransaction} from "../../../src/kernel/wiki/transaction.ts";
import {
	createDictionaryView,
	createWikiAttributionView,
	createWikiGetView,
	createWikiGraphView,
	createWikiHistoryView,
	createWikiListView,
	createWikiSearchView,
	createWikiSemanticDiffView,
	inspectExactWikiProvenance,
} from "../../../src/kernel/wiki/views.ts";
import {markdownEntry, materialize, oid} from "./fixtures.mjs";

const ALL = Object.freeze({authorizationId: "cw:authorization:all", visibility: "all"});
const FILTERED = Object.freeze({
	authorizationId: "cw:authorization:filtered",
	visibility: "allowlist",
	itemIds: Object.freeze(["cw:item:claim", "cw:item:def-one", "cw:item:def-two", "cw:item:legacy"]),
});

function wikiFixture() {
	const claimRelationships = canonicalRecords([
		{predicate: "codewiki.legacy:source-link", targetItemId: "cw:item:hidden", attributes: {"codewiki.legacy:note": "legacy-secret"}},
		{predicate: "codewiki.wiki:depends-on", targetItemId: "cw:item:def-one", attributes: {"codewiki.wiki:rationale": "runtime"}},
		{predicate: "codewiki.wiki:depends-on", targetItemId: "cw:item:hidden", attributes: {}},
	]);
	const provenance = canonicalRecords([
		{kind: "codewiki.legacy:knowledge-source", subjectId: "cw:source:legacy", attributes: {"codewiki.legacy:secret": "legacy-secret"}},
		{kind: "codewiki.provenance:change-committer", subjectId: "cw:actor:grace", attributes: {"codewiki.provenance:role": "accountable"}},
		{kind: "codewiki.provenance:contributor", subjectId: "cw:actor:ada", attributes: {"codewiki.legacy:path": "old", "codewiki.provenance:role": "author"}},
	]);
	return materialize([
		markdownEntry({
			path: ".codewiki/wiki/items/claims/use-cache.md",
			blob: 10,
			itemId: "cw:item:claim",
			title: "Use Cache",
			body: "Lookup the stored result through [Memo](codewiki://item/cw%3Aitem%3Adef-two).\n",
			attributes: {"codewiki.legacy:secret": "legacy-secret", "codewiki.wiki:status": "accepted"},
			relationships: claimRelationships,
			provenance,
		}),
		markdownEntry({
			path: ".codewiki/wiki/items/definitions/cache-primary.md",
			blob: 11,
			itemId: "cw:item:def-one",
			itemType: "codewiki.wiki:definition",
			title: "Cache",
			aliases: ["Memo"],
			body: "A stored result for reuse.\n",
		}),
		markdownEntry({
			path: ".codewiki/wiki/items/definitions/cache-secondary.md",
			blob: 12,
			itemId: "cw:item:def-two",
			itemType: "codewiki.wiki:definition",
			title: "Cache",
			body: "A local build artifact.\n",
			relationships: [{predicate: "codewiki.wiki:supports", targetItemId: "cw:item:claim", attributes: {}}],
		}),
		markdownEntry({
			path: ".codewiki/wiki/items/private/hidden.md",
			blob: 13,
			itemId: "cw:item:hidden",
			title: "Hidden Search Token",
			body: "private needle\n",
		}),
		markdownEntry({
			path: ".codewiki/wiki/items/claims/legacy.md",
			blob: 14,
			itemId: "cw:item:legacy",
			title: "Legacy Metadata",
			attributes: {"codewiki.legacy:secret": "legacy-only-needle"},
		}),
	], {commit: 100, tree: 101});
}

test("list/get Views bind source, derivation, authorization, coverage, pagination, and citations", () => {
	const wiki = wikiFixture();
	const first = createWikiListView(wiki, {authorization: FILTERED, limit: 2, cursor: null});
	assert.equal(first.ok, true);
	assert.deepEqual(first.value.data.items.map((item) => item.itemId), ["cw:item:claim", "cw:item:def-one"]);
	assert.equal(first.value.metadata.source.commit.hex, oid(100).hex);
	assert.equal(first.value.metadata.source.kernelBuildDigest, wiki.source.kernelBuildDigest);
	assert.deepEqual(first.value.metadata.derivation, {id: "codewiki.view:wiki-list", version: "1.0.0"});
	assert.deepEqual(first.value.metadata.authorization, {authorizationId: "cw:authorization:filtered", redaction: "filtered"});
	assert.deepEqual(first.value.metadata.coverage, {scope: "authorized-source", examined: 4, matched: 4, returned: 2, complete: false});
	assert.equal(first.value.metadata.truncation.truncated, true);
	assert.equal(first.value.metadata.citations.length, 2);
	assert.deepEqual(first.value.metadata.channels, {exact: true, approximate: false});
	assert.match(first.value.viewDigest, /^sha256:[0-9a-f]{64}$/u);

	const second = createWikiListView(wiki, {authorization: FILTERED, limit: 2, cursor: first.value.metadata.truncation.nextCursor});
	assert.equal(second.ok, true);
	assert.deepEqual(second.value.data.items.map((item) => item.itemId), ["cw:item:def-two", "cw:item:legacy"]);
	assert.equal(second.value.metadata.coverage.complete, true);

	const get = createWikiGetView(wiki, {authorization: ALL, itemId: "cw:item:claim"});
	assert.equal(get.ok, true);
	assert.doesNotMatch(JSON.stringify(get.value.data), /legacy-secret/u);
	assert.equal(createWikiGetView(wiki, {authorization: FILTERED, itemId: "cw:item:hidden"}).error.code, "not_found");
});

test("dictionary and lexical search are deterministic, bounded, exact, and legacy-blind", () => {
	const wiki = wikiFixture();
	const dictionary = createDictionaryView(wiki, {authorization: ALL, term: "Cache", limit: 10, cursor: null});
	assert.equal(dictionary.ok, true);
	assert.equal(dictionary.value.data.ambiguous, true);
	assert.deepEqual(dictionary.value.data.senses.map((sense) => sense.itemId), ["cw:item:def-one", "cw:item:def-two"]);

	const search = createWikiSearchView(wiki, {authorization: FILTERED, query: "stored result", limit: 10, cursor: null});
	assert.equal(search.ok, true);
	assert.deepEqual(search.value.data.results.map((result) => result.item.itemId), ["cw:item:claim", "cw:item:def-one"]);
	assert.equal(search.value.metadata.ordering, "score-descending,item-id-ascending");
	assert.equal(search.value.metadata.freshness, "exact");

	const legacy = createWikiSearchView(wiki, {authorization: ALL, query: "legacy-only-needle", limit: 10, cursor: null});
	assert.equal(legacy.ok, true);
	assert.equal(legacy.value.data.results.length, 0);
	const hidden = createWikiSearchView(wiki, {authorization: FILTERED, query: "private needle", limit: 10, cursor: null});
	assert.equal(hidden.ok, true);
	assert.equal(hidden.value.data.results.length, 0);
});

test("graph/backlink View filters unauthorized and legacy edges before deriving results", () => {
	const wiki = wikiFixture();
	const graph = createWikiGraphView(wiki, {
		authorization: FILTERED,
		itemId: "cw:item:claim",
		direction: "both",
		limit: 10,
		cursor: null,
	});
	assert.equal(graph.ok, true);
	assert.deepEqual(graph.value.data.edges, [
		{sourceItemId: "cw:item:claim", predicate: "codewiki.wiki:depends-on", targetItemId: "cw:item:def-one"},
		{sourceItemId: "cw:item:claim", predicate: "codewiki.wiki:inline-link", targetItemId: "cw:item:def-two"},
		{sourceItemId: "cw:item:def-two", predicate: "codewiki.wiki:supports", targetItemId: "cw:item:claim"},
	]);
	assert.deepEqual(graph.value.data.nodes.map((node) => node.itemId), ["cw:item:claim", "cw:item:def-one", "cw:item:def-two"]);
	assert.doesNotMatch(JSON.stringify(graph.value), /hidden|legacy:source-link/u);
});

test("normal attribution excludes legacy metadata while explicit exact provenance inspection retains it", () => {
	const wiki = wikiFixture();
	const attribution = createWikiAttributionView(wiki, {authorization: ALL, itemId: "cw:item:claim"});
	assert.equal(attribution.ok, true);
	assert.match(JSON.stringify(attribution.value.data), /codewiki\.provenance:change-committer/u);
	assert.match(JSON.stringify(attribution.value.data), /codewiki\.provenance:contributor/u);
	assert.doesNotMatch(JSON.stringify(attribution.value.data), /codewiki\.legacy/u);

	const exact = inspectExactWikiProvenance(wiki, {authorization: ALL, itemId: "cw:item:claim"});
	assert.equal(exact.ok, true);
	assert.match(JSON.stringify(exact.value.data), /codewiki\.legacy/u);
	assert.equal(exact.value.metadata.kind, "wiki-provenance-inspection");
});

test("semantic diff omits pure moves and provenance-only legacy edits", () => {
	const before = materialize([
		markdownEntry({path: ".codewiki/wiki/items/old/moved.md", blob: 30, itemId: "cw:item:moved", title: "Moved"}),
		markdownEntry({path: ".codewiki/wiki/items/claims/provenance.md", blob: 31, itemId: "cw:item:provenance", title: "Provenance", attributes: {"codewiki.legacy:value": "before"}}),
		markdownEntry({path: ".codewiki/wiki/items/claims/semantic.md", blob: 32, itemId: "cw:item:semantic", title: "Before", body: "Before body.\n"}),
	], {commit: 200, tree: 201});
	const after = materialize([
		markdownEntry({path: ".codewiki/wiki/items/new/moved.md", blob: 30, itemId: "cw:item:moved", title: "Moved"}),
		markdownEntry({path: ".codewiki/wiki/items/claims/provenance.md", blob: 33, itemId: "cw:item:provenance", title: "Provenance", attributes: {"codewiki.legacy:value": "after"}}),
		markdownEntry({path: ".codewiki/wiki/items/claims/semantic.md", blob: 34, itemId: "cw:item:semantic", title: "After", body: "After body.\n"}),
	], {commit: 202, tree: 203, parents: [200]});
	const transaction = validateWikiTransaction({before, after});
	assert.equal(transaction.ok, true);
	const view = createWikiSemanticDiffView(transaction.value, {authorization: ALL, limit: 10, cursor: null});
	assert.equal(view.ok, true);
	assert.deepEqual(view.value.data.changes.map(({itemId, kind}) => [itemId, kind]), [["cw:item:semantic", "edited"]]);
	assert.deepEqual(view.value.data.changes[0].fields.map(({field}) => field), ["body", "title"]);
	assert.doesNotMatch(JSON.stringify(view.value.data), /codewiki\.legacy/u);
	assert.equal(view.value.metadata.citations.length, 2);
	assert.equal(view.value.metadata.coverage.returned, 1);
	const semanticOnly = Object.freeze({
		authorizationId: "cw:authorization:semantic-only",
		visibility: "allowlist",
		itemIds: Object.freeze(["cw:item:semantic"]),
	});
	const redacted = createWikiSemanticDiffView(transaction.value, {authorization: semanticOnly, limit: 10, cursor: null});
	assert.equal(redacted.ok, true);
	assert.deepEqual(redacted.value.metadata.coverage, {scope: "authorized-source", examined: 1, matched: 1, returned: 1, complete: true});
});

test("history View reports explicit bounded unknowns without weakening exact source identity", () => {
	const current = wikiFixture();
	const prior = materialize([
		markdownEntry({path: ".codewiki/wiki/items/claims/use-cache.md", blob: 40, itemId: "cw:item:claim", title: "Use Cache", body: "Earlier.\n"}),
	], {commit: 99, tree: 98});
	const currentFile = current.items.find((file) => file.item.itemId === "cw:item:claim");
	const priorFile = prior.items[0];
	const history = Object.freeze({
		sourceCommit: current.source.snapshot.commit,
		itemId: "cw:item:claim",
		examinedCommits: 2,
		complete: false,
		unknowns: Object.freeze(["history-commit-limit-reached"]),
		revisions: Object.freeze([
			Object.freeze({kind: "edited", commit: current.source.snapshot.commit, current: currentFile, previous: priorFile}),
			Object.freeze({kind: "added", commit: prior.source.snapshot.commit, current: priorFile, previous: null}),
		]),
	});
	const view = createWikiHistoryView(current, history, {authorization: ALL, limit: 1, cursor: null});
	assert.equal(view.ok, true);
	assert.equal(view.value.data.revisions.length, 1);
	assert.equal(view.value.metadata.coverage.complete, false);
	assert.deepEqual(view.value.metadata.unknowns, ["history-commit-limit-reached"]);
	assert.equal(view.value.metadata.truncation.truncated, true);

	const incompatible = {...history, sourceCommit: oid(999)};
	assert.equal(createWikiHistoryView(current, incompatible, {authorization: ALL, limit: 10, cursor: null}).error.code, "incompatible_source");
	const hiddenFile = current.items.find((file) => file.item.itemId === "cw:item:hidden");
	const spoofed = {...history, revisions: [{kind: "edited", commit: current.source.snapshot.commit, current: hiddenFile, previous: priorFile}]};
	assert.equal(createWikiHistoryView(current, spoofed, {authorization: ALL, limit: 10, cursor: null}).error.code, "incompatible_source");
	const unexplained = {...history, unknowns: []};
	assert.equal(createWikiHistoryView(current, unexplained, {authorization: ALL, limit: 10, cursor: null}).error.code, "invalid_request");
});

function canonicalRecords(records) {
	return [...records].sort((left, right) => {
		const leftValue = canonicalJson(left);
		const rightValue = canonicalJson(right);
		if (!leftValue.ok || !rightValue.ok) throw new Error("fixture is not canonical");
		return leftValue.value < rightValue.value ? -1 : leftValue.value > rightValue.value ? 1 : 0;
	});
}
