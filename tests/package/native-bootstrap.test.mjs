import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = path => readFile(`${root}/${path}`, "utf8");

test("native bootstrap metadata binds the supporting package version without a dependency", async () => {
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
	assert.equal(manifest.split("[dependencies]").length, 2);
	assert.equal(manifest.split("[dependencies]")[1].trim(), "", "No third-party Rust dependencies in bootstrap");
	assert.match(lock, /^version = 4$/mu);
	assert.deepEqual([...lock.matchAll(/^\[\[package\]\]\nname = "([^"]+)"\nversion = "([^"]+)"/gmu)].map(([, name, version]) => [name, version]), [["changekernel", js.version]]);
	assert.match(toolchain, /^channel = "1\.88\.0"$/mu);
	assert.match(toolchain, /^components = \["clippy", "rustfmt"\]$/mu);
});
