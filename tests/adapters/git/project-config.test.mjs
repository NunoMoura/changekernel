import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import test from "node:test";
import {
	decodeProjectConfig,
	parseProjectConfigJson,
	serializeBootstrapProjectConfig,
} from "../../../src/adapters/git/project-config.ts";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

test("reader accepts the activated Domain-free repository configuration", async () => {
	const text = await readFile(`${repoRoot}/.codewiki/config.json`, "utf8");
	const result = parseProjectConfigJson(text);
	assert.equal(result.ok, true);
	assert.equal(result.value.protocol.id, "codewiki.project-config");
	assert.equal(result.value.protocol.version, "2.0.0");
	assert.equal(result.value.project, "codewiki");
	assert.equal("domain" in result.value.value, false);
});

test("bootstrap configuration is complete, canonical, versioned, and Domain-free", () => {
	const result = serializeBootstrapProjectConfig("example-project");
	assert.equal(result.ok, true);
	assert.equal(result.value.endsWith("\n"), true);
	const value = JSON.parse(result.value);
	assert.deepEqual(Object.keys(value), [
		"hosts",
		"preview",
		"project",
		"protocol",
		"quality",
		"retention",
		"runtime",
		"triagePreferences",
		"userStandards",
	]);
	assert.equal(value.project, "example-project");
	assert.deepEqual(value.protocol, {id: "codewiki.project-config", version: "2.0.0"});
	assert.equal("domain" in value, false);
	assert.equal(value.hosts.pi.enabled, false);
	assert.equal(value.hosts.mcp.enabled, false);
	assert.equal(value.runtime.modelRouting.roleRoutes.harness, null);
	assert.equal(
		createHash("sha256").update(result.value).digest("hex"),
		"34dc2f31eaa678c7b02da8de27823fcac9470092c6ab3b3a58e3f2229ce9f083",
	);
	assert.equal(parseProjectConfigJson(result.value).ok, true);
});

test("reader rejects Domain fallback, unknown fields, protocol drift, and invalid project identity", () => {
	for (const [value, code] of [
		[{protocol: {id: "codewiki.project-config", version: "2.0.0"}, project: "x", domain: {}}, "unknown_field"],
		[{protocol: {id: "codewiki.project-config", version: "3.0.0"}, project: "x"}, "invalid_protocol"],
		[{protocol: {id: "codewiki.project-config", version: "2.0.0"}, project: "../x"}, "invalid_project"],
		[{protocol: {id: "codewiki.project-config", version: "2.0.0"}, project: ""}, "invalid_project"],
	]) {
		const result = decodeProjectConfig(value);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, code);
	}
	assert.equal(parseProjectConfigJson("not-json").error.code, "invalid_json");
	assert.equal(parseProjectConfigJson(`{"padding":"${"x".repeat(1_048_576)}"}`).error.code, "invalid_value");
});
