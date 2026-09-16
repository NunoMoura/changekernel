import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const script = `
import {canonicalJson} from ${JSON.stringify(new URL("../../../src/kernel/data-contracts/canonical-json.ts", import.meta.url).href)};
import {semanticDigest} from ${JSON.stringify(new URL("../../../src/kernel/identity/semantic-digest.ts", import.meta.url).href)};
import {CHANGEKERNEL_PRODUCT_POLICY_DIGEST} from ${JSON.stringify(new URL("../../../src/product.ts", import.meta.url).href)};
const value={omega:[3,2,1],alpha:{z:false,a:"stable"}};
console.log(JSON.stringify({json:canonicalJson(value).value,digest:semanticDigest("codewiki.determinism@1.0.0",value).value,product:CHANGEKERNEL_PRODUCT_POLICY_DIGEST}));
`;

function observe() {
	return execFileSync(
		process.execPath,
		["--experimental-strip-types", "--input-type=module", "--eval", script],
		{cwd: repoRoot, encoding: "utf8", env: {}},
	).trim();
}

test("canonical and Product identities are byte-identical across isolated processes", () => {
	const first = observe();
	const second = observe();
	assert.equal(first, second);
	const parsed = JSON.parse(first);
	assert.equal(parsed.json, '{"alpha":{"a":"stable","z":false},"omega":[3,2,1]}');
	assert.match(parsed.digest, /^sha256:[0-9a-f]{64}$/);
	assert.match(parsed.product, /^sha256:[0-9a-f]{64}$/);
});
import {decodeProfileChange} from "../../../src/kernel/changes/contracts.ts";
import {decodeProfileChangeEvent} from "../../../src/kernel/changes/events.ts";
import {decodeProfileChangeTrace, encodeProfileChangeTrace} from "../../../src/kernel/changes/trace.ts";
import {decodeCheckDefinition, decodeCheckResult} from "../../../src/kernel/gates/checks.ts";
import {admitted, profileRecord} from "../wiki/profile-fixtures.mjs";
import {fixture, result} from "../gates/check-fixtures.mjs";

function currentFixtures() {
	const {change, event} = profileRecord();
	const selected = fixture();
	return [[decodeProfileChange, change], [decodeProfileChangeEvent, event], [decodeCheckDefinition, selected.definition], [decodeCheckResult, result(selected)]];
}

function reordered(value, seed) {
	const entries = Object.entries(value);
	entries.sort(([left], [right]) => ((score(left, seed) - score(right, seed)) || left.localeCompare(right)));
	return Object.fromEntries(entries);
}

function score(text, seed) {
	let value = seed >>> 0;
	for (const character of text) value = (Math.imul(value ^ character.codePointAt(0), 16_777_619)) >>> 0;
	return value;
}

test("contract digests ignore object insertion order across deterministic corpus", () => {
	const fixtures = currentFixtures();
	for (let seed = 0; seed < 256; seed += 1) {
		for (const [decode, fixture] of fixtures) {
			const decoded = decode(reordered(fixture, seed));
			assert.equal(decoded.ok, true, `${seed}: ${decoded.ok ? "" : decoded.error.message}`);
			const digestKey = Object.keys(fixture).find((key) => key === "digest" || key.endsWith("Digest"));
			assert.equal(decoded.value[digestKey], fixture[digestKey]);
		}
	}
});

test("exact decoders reject bounded unknown-field fuzz without throwing", () => {
	const fixtures = currentFixtures();
	for (let index = 0; index < 512; index += 1) {
		const [decode, fixture] = fixtures[index % fixtures.length];
		const input = {...fixture, [`fuzz${index}`]: index};
		assert.doesNotThrow(() => decode(input));
		assert.equal(decode(input).ok, false);
	}
});

test("Trace parser rejects deterministic truncation and line mutation corpus", () => {
	const encoded = admitted(encodeProfileChangeTrace(profileRecord().trace));
	for (let index = 0; index < encoded.length; index += Math.max(1, Math.floor(encoded.length / 128))) {
		assert.equal(decodeProfileChangeTrace(encoded.slice(0, index)).ok, false);
	}
	const lines = encoded.trimEnd().split("\n");
	for (let index = 0; index < lines.length; index += 1) {
		const mutated = [...lines];
		mutated[index] = `${mutated[index]} `;
		assert.equal(decodeProfileChangeTrace(`${mutated.join("\n")}\n`).ok, false);
	}
});

test("Check result digest detects every protected top-level mutation", () => {
	const retained = result(fixture());
	for (const [key, value] of Object.entries(retained)) {
		if (key === "digest") continue;
		const replacement = value === null ? {} : typeof value === "string" ? `${value}x` : typeof value === "number" ? value + 1 : typeof value === "boolean" ? !value : null;
		const mutated = {...retained, [key]: replacement};
		assert.equal(decodeCheckResult(mutated).ok, false, key);
	}
});
