import assert from "node:assert/strict";
import test from "node:test";
import {
	decodeGitOid,
	decodeGitRef,
	gitOidText,
	isManagedProjectRef,
	sameGitOid,
} from "../../../src/kernel/identity/git.ts";

const SHA1 = "a".repeat(40);
const SHA256 = "b".repeat(64);

test("Git OID contract binds explicit object format", () => {
	const sha1 = decodeGitOid({algorithm: "sha1", hex: SHA1});
	const sha256 = decodeGitOid({algorithm: "sha256", hex: SHA256});
	assert.equal(sha1.ok, true);
	assert.equal(sha256.ok, true);
	assert.equal(gitOidText(sha1.value), `sha1:${SHA1}`);
	assert.equal(sameGitOid(sha1.value, {...sha1.value}), true);
	assert.equal(sameGitOid(sha1.value, sha256.value), false);
});

test("Git OID decoder rejects mixed length, uppercase, and unknown fields", () => {
	for (const input of [
		{algorithm: "sha1", hex: SHA256},
		{algorithm: "sha256", hex: SHA1},
		{algorithm: "sha1", hex: "A".repeat(40)},
		{algorithm: "sha1", hex: "0".repeat(40)},
		{algorithm: "sha512", hex: SHA256},
		{algorithm: "sha1", hex: SHA1, path: "/tmp/repo"},
	]) assert.equal(decodeGitOid(input).ok, false);
});

test("Git refs are fully-qualified and Project Store writes only managed refs", () => {
	for (const value of ["refs/heads/main", "refs/codewiki/changes/CHG-one"]) {
		const decoded = decodeGitRef(value);
		assert.equal(decoded.ok, true);
		assert.equal(isManagedProjectRef(decoded.value), true);
	}
	const readOnly = decodeGitRef("refs/tags/v1");
	assert.equal(readOnly.ok, true);
	assert.equal(isManagedProjectRef(readOnly.value), false);
	for (const value of ["main", "refs/heads/../main", "refs//heads/main", "refs/heads/.hidden", "refs/heads/main.lock", "refs/heads/main@{1}"]) {
		assert.equal(decodeGitRef(value).ok, false);
	}
});
