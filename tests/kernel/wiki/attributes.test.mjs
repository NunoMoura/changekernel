import assert from "node:assert/strict";
import test from "node:test";
import {
	partitionWikiAttributes,
	semanticWikiAttributes,
} from "../../../src/kernel/wiki/attributes.ts";

test("legacy attributes are available only through explicit provenance partition", () => {
	const input = {
		"codewiki.component:ownership": {sourcePatterns: ["src/example/**"], testPatterns: []},
		"codewiki.legacy:media-type": "text/markdown",
		"codewiki.legacy:metadata": {codewiki_source_patterns: ["src/legacy/**"]},
	};
	const partitioned = partitionWikiAttributes(input);
	assert.equal(partitioned.ok, true);
	assert.deepEqual(Object.keys(partitioned.value.semantic), ["codewiki.component:ownership"]);
	assert.deepEqual(Object.keys(partitioned.value.provenance), [
		"codewiki.legacy:media-type",
		"codewiki.legacy:metadata",
	]);
	assert.equal(partitioned.value.semantic["codewiki.legacy:metadata"], undefined);
	assert.ok(Object.isFrozen(partitioned.value.semantic));
	assert.ok(Object.isFrozen(partitioned.value.provenance));

	const semantic = semanticWikiAttributes(input);
	assert.equal(semantic.ok, true);
	assert.equal(semantic.value["codewiki.legacy:media-type"], undefined);
});

test("attribute partition rejects non-namespaced and non-canonical values", () => {
	const unnamespaced = partitionWikiAttributes({owner: "component"});
	assert.equal(unnamespaced.ok, false);
	assert.equal(unnamespaced.error.code, "invalid_attribute_key");
	const nonCanonical = partitionWikiAttributes({"codewiki.test:value": undefined});
	assert.equal(nonCanonical.ok, false);
	assert.equal(nonCanonical.error.code, "invalid_attribute_value");
	const array = partitionWikiAttributes([]);
	assert.equal(array.ok, false);
	assert.equal(array.error.code, "invalid_attribute_map");
});
