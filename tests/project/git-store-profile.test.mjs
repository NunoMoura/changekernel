import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
	GIT_STORE_PROFILE_PROTOCOL,
	assertCanonicalRef,
	assertGitOid,
	createGitBoundWikiIdentity,
	createGitStoreProfile,
} from "../../src/project/git-store-profile.ts";

describe("mandatory Git store profile", () => {
	it("binds stable repository identity, frozen object format, and canonical ref", () => {
		const profile = createGitStoreProfile({
			repositoryId: "cw:project:demo",
			objectFormat: "sha256",
			canonicalRef: "refs/heads/main",
		});
		assert.deepEqual(profile, {
			protocol: GIT_STORE_PROFILE_PROTOCOL,
			repositoryId: "cw:project:demo",
			objectFormat: "sha256",
			canonicalRef: "refs/heads/main",
		});
		assert.equal(Object.isFrozen(profile), true);

		const identity = createGitBoundWikiIdentity({
			profile,
			commit: {algorithm: "sha256", hex: "a".repeat(64)},
			kernelBuildId: "kernel-build:demo",
		});
		assert.equal(identity.repositoryId, profile.repositoryId);
		assert.equal(identity.commit.hex, "a".repeat(64));
		assert.equal(identity.kernelBuildId, "kernel-build:demo");
	});

	it("rejects object-format drift and malformed native OIDs", () => {
		const profile = createGitStoreProfile({
			repositoryId: "cw:project:demo",
			objectFormat: "sha1",
			canonicalRef: "refs/codewiki/canonical/main",
		});
		assert.doesNotThrow(() =>
			assertGitOid({algorithm: "sha1", hex: "0".repeat(40)}),
		);
		for (const oid of [
			{algorithm: "sha1", hex: "A".repeat(40)},
			{algorithm: "sha1", hex: "0".repeat(64)},
			{algorithm: "md5", hex: "0".repeat(32)},
		]) {
			assert.throws(() => assertGitOid(oid), /Git object format|lowercase hex/u);
		}
		assert.throws(
			() =>
				createGitBoundWikiIdentity({
					profile,
					commit: {algorithm: "sha256", hex: "0".repeat(64)},
				}),
			/must use sha1/u,
		);
	});

	it("applies full-ref portability and safety rules", () => {
		for (const ref of [
			"main",
			"refs/heads/a..b",
			"refs/heads/.hidden",
			"refs/heads/topic.lock",
			"refs/heads/a b",
			"refs/heads/a\\b",
			"refs/heads/a@{b",
		]) {
			assert.throws(() => assertCanonicalRef(ref), /canonicalRef/u);
		}
		assert.doesNotThrow(() => assertCanonicalRef("refs/heads/release/v1"));
	});
});
