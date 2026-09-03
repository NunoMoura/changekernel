import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import test from "node:test";
import {base32Lowercase} from "../../../src/kernel/identity/base32.ts";
import {
	canonicalValueDigest,
	semanticDigest,
	semanticId,
} from "../../../src/kernel/identity/semantic-digest.ts";

test("semantic digest preserves protocol-NUL-canonical framing", () => {
	const protocol = "codewiki.test@1.0.0";
	const value = {z: 2, a: [true, null, "é"]};
	const canonical = '{"a":[true,null,"é"],"z":2}';
	const expected = createHash("sha256")
		.update(protocol, "utf8")
		.update(Buffer.from([0]))
		.update(canonical, "utf8")
		.digest("hex");
	const result = semanticDigest(protocol, value);
	assert.equal(result.ok, true);
	assert.equal(result.value, `sha256:${expected}`);
	assert.equal(semanticDigest(protocol, {a: [true, null, "é"], z: 2}).value, result.value);
});

test("semantic identities use deterministic lowercase unpadded Base32", () => {
	assert.equal(base32Lowercase(Uint8Array.from([0x66, 0x6f, 0x6f])), "mzxw6");
	const left = semanticId("cw:test:item", "codewiki.test-item@1.0.0", {name: "same"});
	const right = semanticId("cw:test:item", "codewiki.test-item@1.0.0", {name: "same"});
	assert.equal(left.ok, true);
	assert.equal(right.value, left.value);
	assert.match(left.value, /^cw:test:item:[a-z2-7]{52}$/);
});

test("identity primitives return typed failures", () => {
	for (const [result, code] of [
		[semanticDigest("", {}), "invalid_protocol"],
		[semanticDigest("bad\0protocol", {}), "invalid_protocol"],
		[semanticDigest("ok", {bad: undefined}), "invalid_value"],
		[semanticId("Bad Namespace", "ok", {}), "invalid_namespace"],
	]) {
		assert.equal(result.ok, false);
		assert.equal(result.error.code, code);
	}
});

test("canonical value digest is key-order invariant and byte-compatible", () => {
	const left = canonicalValueDigest({b: 2, a: 1});
	const right = canonicalValueDigest({a: 1, b: 2});
	assert.equal(left.ok, true);
	assert.equal(left.value, right.value);
	assert.equal(
		left.value,
		`sha256:${createHash("sha256").update('{"a":1,"b":2}').digest("hex")}`,
	);
});
