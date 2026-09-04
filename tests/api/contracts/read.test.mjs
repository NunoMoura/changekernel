import assert from "node:assert/strict";
import test from "node:test";
import {decodeProductReadInput} from "../../../src/api/contracts/read.ts";

const CANONICAL = {kind: "canonical"};
const PAGE = {limit: 10, cursor: null};

test("Product reads accept strict semantic operations without transport versions", () => {
	const cases = [
		["project.discover", {}],
		["project.capabilities", {}],
		["project.status", {source: CANONICAL}],
		["wiki.read", {source: CANONICAL, view: "list", ...PAGE}],
		["wiki.read", {source: CANONICAL, view: "get", itemId: "cw:item:one"}],
		["wiki.read", {source: CANONICAL, view: "dictionary", term: "Change", ...PAGE}],
		["wiki.read", {source: CANONICAL, view: "search", query: "next action", ...PAGE}],
		["wiki.read", {source: CANONICAL, view: "graph", itemId: "cw:item:one", direction: "both", ...PAGE}],
		["wiki.read", {source: CANONICAL, view: "history", itemId: "cw:item:one", ...PAGE}],
		["wiki.read", {source: CANONICAL, view: "attribution", itemId: "cw:item:one"}],
		["wiki.read", {source: CANONICAL, view: "diff", baselineSource: {kind: "commit", commit: {algorithm: "sha1", hex: "1".repeat(40)}}, ...PAGE}],
		["changes.read", {source: CANONICAL, view: "list", ...PAGE}],
		["changes.read", {source: CANONICAL, view: "get", changeId: "CHG-one"}],
		["changes.read", {source: CANONICAL, view: "decisions", changeId: null, ...PAGE}],
		["checks.read", {source: CANONICAL, view: "gates", changeId: null, ...PAGE}],
		["work.read", {source: CANONICAL, changeId: null, ...PAGE}],
		["review.read", {source: CANONICAL, changeId: "CHG-one"}],
		["alignment.read", {source: CANONICAL, changeId: null, ...PAGE}],
		["audit.read", {source: CANONICAL, view: "source"}],
	];
	for (const [operation, input] of cases) {
		const decoded = decodeProductReadInput(operation, input);
		assert.equal(decoded.ok, true, `${operation}: ${decoded.ok ? "" : decoded.error.message}`);
		assert.equal(Object.isFrozen(decoded.value), true);
		assert.equal("protocol" in decoded.value, false);
	}
});

test("Product read contracts reject ambiguity, unknown fields, invalid bounds, and technical selectors", () => {
	const invalid = [
		["project.discover", {source: CANONICAL}],
		["project.status", {source: {kind: "ref", ref: "refs/heads/main"}}],
		["wiki.read", {source: CANONICAL, view: "get", itemId: "plain"}],
		["wiki.read", {source: CANONICAL, view: "list", limit: 0, cursor: null}],
		["wiki.read", {source: CANONICAL, view: "get", itemId: "cw:item:one", query: "extra"}],
		["changes.read", {source: CANONICAL, view: "get", changeId: null, ...PAGE}],
		["changes.read", {source: CANONICAL, view: "list", changeId: "CHG-one", ...PAGE}],
		["audit.read", {source: CANONICAL, view: "source", itemId: "cw:item:one"}],
	];
	for (const [operation, input] of invalid) assert.equal(decodeProductReadInput(operation, input).ok, false, operation);
	assert.equal(decodeProductReadInput("wiki.read", null).ok, false);
});
