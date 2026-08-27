import {createHash} from "node:crypto";
import {assertNfcString} from "./semantic-digest.ts";

const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

export function sha256Base32Nfc(value: string, field: string): string {
	assertNfcString(value, field, 1, 16_384);
	return base32Lowercase(createHash("sha256").update(value, "utf8").digest());
}

export function base32Lowercase(bytes: Uint8Array): string {
	let buffer = 0;
	let bits = 0;
	let result = "";
	for (const byte of bytes) {
		buffer = (buffer << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			bits -= 5;
			result += BASE32_ALPHABET[(buffer >>> bits) & 31];
			buffer &= (1 << bits) - 1;
		}
	}
	if (bits > 0) {
		result += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
	}
	return result;
}
