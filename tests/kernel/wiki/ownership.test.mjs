import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {CHANGE_EVENT_KINDS} from "../../../src/kernel/changes/events.ts";
import {
	buildSemanticEventOwnership,
	decodeComponentOwnership,
	ownersForPath,
	ownershipMatchesPath,
} from "../../../src/kernel/wiki/ownership.ts";

const nativeAttributes = {
	"codewiki.component:ownership": {
		sourcePatterns: ["src/kernel/**", "tsconfig*.json"],
		testPatterns: ["tests/kernel/*.test.mjs"],
		traceEvents: ["change.proposed"],
	},
	"codewiki.legacy:metadata": {
		codewiki_source_patterns: ["src/legacy/**"],
	},
};

test("ownership reads only native codewiki.component:ownership", () => {
	const decoded = decodeComponentOwnership("cw:component:kernel", nativeAttributes);
	assert.equal(decoded.ok, true);
	assert.deepEqual(decoded.value.sourcePatterns, ["src/kernel/**", "tsconfig*.json"]);
	assert.deepEqual(decoded.value.traceEvents, ["change.proposed"]);
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

test("native semantic event ownership is total, unique, and separate from source ownership", async () => {
	const names = ["change-intake", "checks", "decision", "implementation", "planning", "project-server", "review"];
	const ownership = [];
	for (const name of names) {
		const markdown = await readFile(`.codewiki/wiki/items/system/components/${name}.md`, "utf8");
		const match = /^---\n([^\n]+)\n---\n/u.exec(markdown);
		assert.ok(match);
		const item = JSON.parse(match[1]);
		const decoded = decodeComponentOwnership(item.itemId, item.attributes);
		assert.equal(decoded.ok, true);
		ownership.push(decoded.value);
	}
	const index = buildSemanticEventOwnership(ownership, CHANGE_EVENT_KINDS);
	assert.equal(index.ok, true);
	assert.equal(Object.keys(index.value).length, 17);
	assert.equal(index.value["gate.recorded"], "cw:component:checks");
	assert.equal(index.value["change.completed"], "cw:component:project-server");
	assert.equal(index.value["work.integrated"], "cw:component:implementation");
});

test("semantic event ownership rejects duplicate, missing, and unknown claims", () => {
	const first = decodeComponentOwnership("cw:component:first", nativeAttributes).value;
	const duplicate = decodeComponentOwnership("cw:component:second", nativeAttributes).value;
	assert.equal(buildSemanticEventOwnership([first, duplicate], ["change.proposed"]).error.code, "duplicate_event_owner");
	assert.equal(buildSemanticEventOwnership([], ["change.proposed"]).error.code, "missing_event_owner");
	assert.equal(buildSemanticEventOwnership([first], ["gate.recorded"]).error.code, "unknown_trace_event");
});

test("ownership patterns, events, and paths fail closed", () => {
	for (const pattern of ["/src/**", "src/../secret", "src/**foo", "src\\file.ts"] ) {
		const decoded = decodeComponentOwnership("cw:component:test", {
			"codewiki.component:ownership": {sourcePatterns: [pattern], testPatterns: []},
		});
		assert.equal(decoded.ok, false, pattern);
		assert.equal(decoded.error.code, "invalid_pattern");
	}
	for (const event of ["Change.Proposed", "change", "change.proposed_legacy", "change..proposed"]) {
		const decoded = decodeComponentOwnership("cw:component:test", {
			"codewiki.component:ownership": {sourcePatterns: [], testPatterns: [], traceEvents: [event]},
		});
		assert.equal(decoded.ok, false, event);
		assert.equal(decoded.error.code, "invalid_trace_event");
	}
	const ownership = decodeComponentOwnership("cw:component:test", nativeAttributes).value;
	assert.equal(ownershipMatchesPath(ownership, "source", "../outside").error.code, "invalid_path");
});
