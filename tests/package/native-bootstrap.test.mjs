import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = path => readFile(`${root}/${path}`, "utf8");

test("native intake metadata binds package version and only approved direct dependencies", async () => {
	const js = JSON.parse(await read("package.json"));
	const manifest = await read("Cargo.toml");
	const lock = await read("Cargo.lock");
	const toolchain = await read("rust-toolchain.toml");

	assert.match(manifest, /^name = "changekernel"$/mu);
	assert.ok(manifest.includes(`version = "${js.version}"`));
	assert.match(manifest, /^publish = false$/mu);
	assert.match(manifest, /^path = "src\/lib.rs"$/mu);
	assert.match(manifest, /^path = "src\/main.rs"$/mu);
	assert.match(manifest, /^path = "tests\/package\/native_bootstrap.rs"$/mu);
	assert.match(manifest, /^path = "tests\/kernel\/containers\/native_intake.rs"$/mu);
	assert.match(manifest, /^path = "tests\/adapters\/sqlite\/native_intake.rs"$/mu);
	const runtime = manifest.split("[dependencies]\n")[1].split("\n[dev-dependencies]")[0].trim();
	assert.deepEqual(runtime.split("\n").sort(), [
		'rusqlite = { version = "=0.37.0", features = ["bundled"] }',
		'sha2 = "=0.10.9"',
	]);
	assert.equal(manifest.split("[dev-dependencies]\n")[1].trim(), 'serde_json = "=1.0.145"');
	assert.match(lock, /^version = 4$/mu);
	const locked = new Map([...lock.matchAll(/^\[\[package\]\]\nname = "([^"]+)"\nversion = "([^"]+)"/gmu)].map(([, name, version]) => [name, version]));
	for (const [name, version] of [["changekernel", js.version], ["rusqlite", "0.37.0"], ["sha2", "0.10.9"], ["serde_json", "1.0.145"]]) {
		assert.equal(locked.get(name), version);
	}
	assert.match(toolchain, /^channel = "1\.88\.0"$/mu);
	assert.match(toolchain, /^components = \["clippy", "rustfmt"\]$/mu);
});
