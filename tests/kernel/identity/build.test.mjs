import assert from "node:assert/strict";
import test from "node:test";
import {
	CANONICALIZATION_PROTOCOL,
	SEMANTIC_IDENTITY_PROTOCOL,
	createKernelBuild,
	createProductBuild,
	decodeKernelBuild,
	decodeProductBuild,
} from "../../../src/kernel/identity/build.ts";

const digest = (character) => `sha256:${character.repeat(64)}`;
const oid = (hex) => ({algorithm: "sha1", hex: hex.repeat(40)});

export function productBuildFixture() {
	const result = createProductBuild({
		packageName: "@nunomoura/codewiki",
		packageVersion: "0.4.0-sk3e.1",
		sourceCommit: oid("1"),
		sourceTree: oid("2"),
		productPolicyDigest: digest("a"),
		artifactDigest: digest("b"),
	});
	assert.equal(result.ok, true);
	return result.value;
}

test("Product Build identity binds package, source, policy, and artifact without path/time", () => {
	const left = productBuildFixture();
	const right = productBuildFixture();
	assert.equal(left.buildDigest, right.buildDigest);
	assert.deepEqual(Object.keys(left).sort(), [
		"artifactDigest", "buildDigest", "packageName", "packageVersion", "productPolicyDigest", "protocol", "sourceCommit", "sourceTree",
	]);
	assert.equal(decodeProductBuild({...left, buildPath: "/tmp/build"}).ok, false);
	assert.equal(decodeProductBuild({...left, builtAt: "now"}).ok, false);
});

test("Kernel Build identity freezes contract catalog, canonicalization, and Git build", () => {
	const product = productBuildFixture();
	const result = createKernelBuild({
		productBuildDigest: product.buildDigest,
		contracts: [
			{id: "codewiki.change", version: "1.0.0"},
			{id: "codewiki.change-trace", version: "14.0.0"},
		],
		git: {implementation: "git", version: "2.51.0", objectFormat: "sha1"},
	});
	assert.equal(result.ok, true);
	assert.deepEqual(result.value.canonicalization, CANONICALIZATION_PROTOCOL);
	assert.deepEqual(result.value.identity, SEMANTIC_IDENTITY_PROTOCOL);
	assert.equal(decodeKernelBuild(result.value).ok, true);
	assert.equal(decodeKernelBuild({...result.value, git: {...result.value.git, version: "2.52.0"}}).ok, false);
	assert.equal(decodeKernelBuild({...result.value, identity: {...result.value.identity, version: "2.0.0"}}).ok, false);
});

test("Kernel Build rejects ambiguous contract order and forged digests", () => {
	const product = productBuildFixture();
	const made = createKernelBuild({
		productBuildDigest: product.buildDigest,
		contracts: [{id: "codewiki.change", version: "1.0.0"}],
		git: {implementation: "git", version: "2.51.0", objectFormat: "sha1"},
	});
	assert.equal(made.ok, true);
	assert.equal(decodeKernelBuild({...made.value, contracts: [
		{id: "codewiki.z", version: "1.0.0"},
		{id: "codewiki.a", version: "1.0.0"},
	]}).ok, false);
	assert.equal(decodeKernelBuild({...made.value, buildDigest: digest("f")}).ok, false);
});
