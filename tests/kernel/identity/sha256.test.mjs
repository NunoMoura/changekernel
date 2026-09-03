import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import test from "node:test";
import {
	decodeSha256Digest,
	sha256Bytes,
	sha256Digest,
	sha256Hex,
} from "../../../src/kernel/identity/sha256.ts";

const vectors = [
	["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
	["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
	["abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"],
	["The quick brown fox jumps over the lazy dog", "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592"],
];

for (const [input, expected] of vectors) {
	test(`pure SHA-256 matches standard vector ${JSON.stringify(input.slice(0, 16))}`, () => {
		assert.equal(sha256Hex(input), expected);
		assert.equal(sha256Digest(input), `sha256:${expected}`);
	});
}

test("pure SHA-256 matches the million-a standard vector", () => {
	assert.equal(
		sha256Hex("a".repeat(1_000_000)),
		"cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
	);
});

test("pure SHA-256 matches independent Node crypto over deterministic binary lengths", () => {
	let state = 0x1234_5678;
	for (const length of [0, 1, 7, 31, 55, 56, 57, 63, 64, 65, 127, 128, 129, 1_024, 65_537]) {
		const input = new Uint8Array(length);
		for (let index = 0; index < input.length; index += 1) {
			state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
			input[index] = state & 0xff;
		}
		const before = input.slice();
		const expected = createHash("sha256").update(input).digest("hex");
		assert.equal(sha256Hex(input), expected, `length ${length}`);
		assert.deepEqual(input, before, `input mutation at length ${length}`);
		assert.equal(sha256Bytes(input).byteLength, 32);
	}
});

test("digest decoder accepts only exact lowercase SHA-256 identities", () => {
	const valid = sha256Digest("bound");
	assert.deepEqual(decodeSha256Digest(valid), {ok: true, value: valid});
	for (const value of [valid.toUpperCase(), "sha256:abc", `sha512:${"0".repeat(64)}`, null]) {
		const result = decodeSha256Digest(value);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "invalid_digest");
	}
});
