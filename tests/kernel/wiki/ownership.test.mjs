import assert from "node:assert/strict";
import test from "node:test";
import {
	decodeComponentOwnership,
	ownersForPath,
	ownershipMatchesPath,
} from "../../../src/kernel/wiki/ownership.ts";

const nativeAttributes = {
	"codewiki.component:ownership": {
		sourcePatterns: ["src/kernel/**", "tsconfig*.json"],
		testPatterns: ["tests/kernel/*.test.mjs"],
	},
	"codewiki.legacy:metadata": {
		codewiki_source_patterns: ["src/legacy/**"],
	},
};

test("ownership reads only native codewiki.component:ownership", () => {
	const decoded = decodeComponentOwnership("cw:component:kernel", nativeAttributes);
	assert.equal(decoded.ok, true);
	assert.deepEqual(decoded.value.sourcePatterns, ["src/kernel/**", "tsconfig*.json"]);
	assert.equal(ownershipMatchesPath(decoded.value, "source", "src/kernel/canonical/json.ts").value, true);
	assert.equal(ownershipMatchesPath(decoded.value, "source", "tsconfig.build.json").value, true);
	assert.equal(ownershipMatchesPath(decoded.value, "source", "src/legacy/domain.ts").value, false);
});

test("legacy-only ownership metadata never becomes semantic ownership", () => {
	const decoded = decodeComponentOwnership("cw:component:legacy", {
		"codewiki.legacy:metadata": {
			codewiki_source_patterns: ["src/legacy/**"],
			codewiki_test_patterns: ["tests/legacy/**"],
		},
	});
	assert.deepEqual(decoded, {ok: true, value: null});
});

test("owner resolution is deterministic and exposes overlap", () => {
	const first = decodeComponentOwnership("cw:component:first", nativeAttributes).value;
	const second = decodeComponentOwnership("cw:component:second", {
		"codewiki.component:ownership": {
			sourcePatterns: ["src/kernel/canonical/**"],
			testPatterns: [],
		},
	}).value;
	assert.deepEqual(
		ownersForPath([second, first], "source", "src/kernel/canonical/json.ts"),
		{ok: true, value: ["cw:component:first", "cw:component:second"]},
	);
});

test("ownership patterns and paths fail closed", () => {
	for (const pattern of ["/src/**", "src/../secret", "src/**foo", "src\\file.ts"] ) {
		const decoded = decodeComponentOwnership("cw:component:test", {
			"codewiki.component:ownership": {sourcePatterns: [pattern], testPatterns: []},
		});
		assert.equal(decoded.ok, false, pattern);
		assert.equal(decoded.error.code, "invalid_pattern");
	}
	const ownership = decodeComponentOwnership("cw:component:test", nativeAttributes).value;
	assert.equal(ownershipMatchesPath(ownership, "source", "../outside").error.code, "invalid_path");
});
