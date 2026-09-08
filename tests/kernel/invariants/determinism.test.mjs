import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const script = `
import {canonicalJson} from ${JSON.stringify(new URL("../../../src/kernel/data-contracts/canonical-json.ts", import.meta.url).href)};
import {semanticDigest} from ${JSON.stringify(new URL("../../../src/kernel/identity/semantic-digest.ts", import.meta.url).href)};
import {CODEWIKI_PRODUCT_POLICY_DIGEST} from ${JSON.stringify(new URL("../../../src/product.ts", import.meta.url).href)};
const value={omega:[3,2,1],alpha:{z:false,a:"stable"}};
console.log(JSON.stringify({json:canonicalJson(value).value,digest:semanticDigest("codewiki.determinism@1.0.0",value).value,product:CODEWIKI_PRODUCT_POLICY_DIGEST}));
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
import {decodeChange} from "../../../src/kernel/changes/contracts.ts";
import {decodeChangeEvent} from "../../../src/kernel/changes/events.ts";
import {decodeChangeTrace, encodeChangeTrace} from "../../../src/kernel/changes/trace.ts";
import {decodeGate, decodeResult} from "../../../src/kernel/gates/contracts.ts";
import {reduceGate} from "../../../src/kernel/gates/reducer.ts";
import {decodeWork} from "../../../src/kernel/work/contracts.ts";
import {changeFixture} from "../changes/contracts.test.mjs";
import {EVENT_OWNERS, eventFixture} from "../changes/events.test.mjs";
import {validTrace} from "../changes/reducer.test.mjs";
import {completedRunFixture, gateFixture, registrationFixture} from "../gates/contracts.test.mjs";
import {workFixture} from "../work/contracts.test.mjs";

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
	const fixtures = [
		[decodeChange, changeFixture()],
		[(value) => decodeChangeEvent(value, EVENT_OWNERS), eventFixture()],
		[decodeWork, workFixture()],
		[decodeGate, gateFixture()],
	];
	for (let seed = 0; seed < 256; seed += 1) {
		for (const [decode, fixture] of fixtures) {
			const decoded = decode(reordered(fixture, seed));
			assert.equal(decoded.ok, true, `${seed}: ${decoded.ok ? "" : decoded.error.message}`);
			const digestKey = Object.keys(fixture).find((key) => key.endsWith("Digest"));
			assert.equal(decoded.value[digestKey], fixture[digestKey]);
		}
	}
});

test("exact decoders reject bounded unknown-field fuzz without throwing", () => {
	const fixtures = [
		[decodeChange, changeFixture()],
		[(value) => decodeChangeEvent(value, EVENT_OWNERS), eventFixture()],
		[decodeWork, workFixture()],
		[decodeGate, gateFixture()],
	];
	for (let index = 0; index < 512; index += 1) {
		const [decode, fixture] = fixtures[index % fixtures.length];
		const input = {...fixture, [`fuzz${index}`]: index};
		assert.doesNotThrow(() => decode(input));
		assert.equal(decode(input).ok, false);
	}
});

test("Gate reduction is permutation-invariant for independent active Checks", () => {
	const first = registrationFixture();
	const second = registrationFixture({packId: "z-pack", definition: {...first.definition, id: "z_check"}, enforcement: "advisory"});
	const checks = [first, second].sort((left, right) => `${left.stage}/${left.packId}/${left.definition.id}`.localeCompare(`${right.stage}/${right.packId}/${right.definition.id}`));
	const gate = gateFixture({activeChecks: checks});
	const a = completedRunFixture(gate, first);
	const b = completedRunFixture(gate, second);
	const baseline = reduceGate({gate, currentSubject: gate.subject, currentKernelBuildDigest: gate.kernelBuildDigest, kernelValidation: "passed", runs: [a.run, b.run], results: [a.result, b.result]});
	assert.equal(baseline.ok, true);
	for (const [runs, results] of [
		[[b.run, a.run], [a.result, b.result]],
		[[a.run, b.run], [b.result, a.result]],
		[[b.run, a.run], [b.result, a.result]],
	]) {
		const result = reduceGate({gate, currentSubject: gate.subject, currentKernelBuildDigest: gate.kernelBuildDigest, kernelValidation: "passed", runs, results});
		assert.equal(result.ok, true);
		assert.equal(result.value.outcomeDigest, baseline.value.outcomeDigest);
	}
});

test("Trace parser rejects deterministic truncation and line mutation corpus", () => {
	const encoded = encodeChangeTrace(validTrace().trace, EVENT_OWNERS).value;
	for (let index = 0; index < encoded.length; index += Math.max(1, Math.floor(encoded.length / 128))) {
		assert.equal(decodeChangeTrace(encoded.slice(0, index), EVENT_OWNERS).ok, false);
	}
	const lines = encoded.trimEnd().split("\n");
	for (let index = 0; index < lines.length; index += 1) {
		const mutated = [...lines];
		mutated[index] = `${mutated[index]} `;
		assert.equal(decodeChangeTrace(`${mutated.join("\n")}\n`, EVENT_OWNERS).ok, false);
	}
});

test("Result digest detects every protected top-level mutation", () => {
	const result = completedRunFixture().result;
	for (const [key, value] of Object.entries(result)) {
		if (key === "resultDigest") continue;
		const replacement = value === null ? {} : typeof value === "string" ? `${value}x` : typeof value === "number" ? value + 1 : typeof value === "boolean" ? !value : null;
		const mutated = {...result, [key]: replacement};
		assert.equal(decodeResult(mutated).ok, false, key);
	}
});
