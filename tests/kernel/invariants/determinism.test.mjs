import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const script = `
import {canonicalJson} from ${JSON.stringify(new URL("../../../src/kernel/canonical/json.ts", import.meta.url).href)};
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
