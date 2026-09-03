const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

export function base32Lowercase(bytes: Uint8Array): string {
	let buffer = 0;
	let bits = 0;
	let output = "";
	for (const byte of bytes) {
		buffer = (buffer << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			bits -= 5;
			output += BASE32_ALPHABET[(buffer >>> bits) & 31] ?? "";
			buffer &= (1 << bits) - 1;
		}
	}
	if (bits > 0) output += BASE32_ALPHABET[(buffer << (5 - bits)) & 31] ?? "";
	return output;
}
