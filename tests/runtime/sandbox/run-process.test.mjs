import assert from "node:assert/strict";
import {execFileSync, spawn} from "node:child_process";
import {mkdtemp, readFile, realpath, rm, writeFile} from "node:fs/promises";
import {readFileSync as readBytes} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {once} from "node:events";
import {test} from "node:test";

import {createBubblewrapRunProcessSandbox} from "../../../src/runtime/sandbox/run-process.ts";
import {BUBBLEWRAP_SANDBOX_SCHEMA_VERSION} from "../../../src/runtime/sandbox/bubblewrap.ts";
import {sha256Digest} from "../../../src/utils/canonical-json.ts";

function liveProfile() {
	const bubblewrap = "/usr/bin/bwrap";
	const prlimit = "/usr/bin/prlimit";
	return {
		schemaVersion: BUBBLEWRAP_SANDBOX_SCHEMA_VERSION,
		bubblewrap: {
			path: bubblewrap,
			version: execFileSync(bubblewrap, ["--version"], {encoding: "utf8", env: {}}).trim(),
			digest: sha256Digest(readBytes(bubblewrap)),
		},
		prlimit: {
			path: prlimit,
			version: execFileSync(prlimit, ["--version"], {encoding: "utf8", env: {}}).split("\n", 1)[0].trim(),
			digest: sha256Digest(readBytes(prlimit)),
		},
		systemReadOnlyPaths: ["/usr", "/lib", "/lib64"],
		limits: {
			addressSpaceBytes: 8 * 1024 * 1024 * 1024,
			cpuSeconds: 3,
			openFiles: 128,
			processes: 512,
			fileBytes: 1024 * 1024,
		},
	};
}

test("outer Bubblewrap Run Process preserves private protocol descriptors and denies ambient authority", async () => {
	const directory = await mkdtemp(join(tmpdir(), "codewiki-outer-sandbox-"));
	try {
		const script = join(directory, "process.mjs");
		await writeFile(script, `
			import {readFileSync, writeFileSync, existsSync} from "node:fs";
			import {spawnSync} from "node:child_process";
			const secret = readFileSync(3, "utf8");
			const observed = {secret, env: Object.keys(process.env), passwd: existsSync("/etc/passwd")};
			try { writeFileSync("${directory}/escape", "x"); observed.write = "allowed"; }
			catch (error) { observed.write = error.code || error.name; }
			const nested = spawnSync("/usr/bin/bwrap", ["--unshare-user", "--ro-bind", "/usr", "/usr", "/usr/bin/true"], {encoding: "utf8"});
			observed.nested = nested.status;
			writeFileSync(5, JSON.stringify(observed));
		`);
		const sandbox = createBubblewrapRunProcessSandbox({
			profile: liveProfile(),
			readOnlyPaths: [directory],
			writablePaths: [],
			allowNestedUserNamespaces: false,
		});
		const node = await realpath(process.execPath);
		const artifact = await sandbox.prepare({
			runtimeBuildDigest: `sha256:${"1".repeat(64)}`,
			runProtocolVersion: "test",
			executable: node,
			args: [script],
			cwd: directory,
		});
		const child = spawn(artifact.executable, artifact.args, {
			cwd: artifact.cwd,
			env: {},
			stdio: ["ignore", "ignore", "pipe", "pipe", "pipe", "pipe"],
		});
		const keyWriter = child.stdio[3];
		const eventReader = child.stdio[5];
		const output = [];
		eventReader.on("data", (chunk) => output.push(chunk));
		keyWriter.end("private-key");
		const [code, signal] = await once(child, "exit");
		assert.equal(code, 0, Buffer.concat(output).toString("utf8"));
		assert.equal(signal, null);
		const observed = JSON.parse(Buffer.concat(output).toString("utf8"));
		assert.deepEqual(observed.env, ["PWD"]);
		assert.equal(observed.passwd, false);
		assert.equal(observed.secret, "private-key");
		assert.notEqual(observed.write, "allowed");
		assert.notEqual(observed.nested, 0);
		await assert.rejects(readFile(join(directory, "escape")), /ENOENT/);
	} finally {
		await rm(directory, {recursive: true, force: true});
	}
});
