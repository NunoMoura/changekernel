import assert from "node:assert/strict";
import {execFile, execFileSync} from "node:child_process";
import {readFileSync, realpathSync} from "node:fs";
import {test} from "node:test";
import {promisify} from "node:util";

import {
	BUBBLEWRAP_SANDBOX_SCHEMA_VERSION,
	createBubblewrapLaunchCommand,
	verifyBubblewrapSandboxProfile,
} from "../../../src/runtime/sandbox/bubblewrap.ts";
import {sha256Digest} from "../../../src/utils/canonical-json.ts";

const execute = promisify(execFile);

function liveProfile(overrides = {}) {
	const bubblewrap = realpathSync("/usr/bin/bwrap");
	const prlimit = realpathSync("/usr/bin/prlimit");
	return {
		schemaVersion: BUBBLEWRAP_SANDBOX_SCHEMA_VERSION,
		bubblewrap: {
			path: bubblewrap,
			version: execFileSync(bubblewrap, ["--version"], {encoding: "utf8", env: {}}).trim(),
			digest: sha256Digest(readFileSync(bubblewrap)),
		},
		prlimit: {
			path: prlimit,
			version: execFileSync(prlimit, ["--version"], {encoding: "utf8", env: {}}).split("\n", 1)[0].trim(),
			digest: sha256Digest(readFileSync(prlimit)),
		},
		systemReadOnlyPaths: ["/usr", "/lib", "/lib64"],
		limits: {
			addressSpaceBytes: 8 * 1024 * 1024 * 1024,
			cpuSeconds: 2,
			openFiles: 128,
			processes: 512,
			fileBytes: 1024 * 1024,
		},
		...overrides,
	};
}

function nodeMount() {
	const executable = realpathSync(process.execPath);
	return {
		executable,
		mounts: executable.startsWith("/usr/") ? [] : [{
			source: executable,
			destination: executable,
			access: "read-only",
		}],
	};
}

test("pinned Bubblewrap profile denies ambient files, environment, writes, child process, and network", async () => {
	const profile = liveProfile();
	const node = nodeMount();
	const script = String.raw`
		const {spawnSync} = await import('node:child_process');
		const {existsSync, writeFileSync} = await import('node:fs');
		const observed = {env: Object.keys(process.env)};
		try { observed.passwd = existsSync('/etc/passwd') ? 'visible' : 'absent'; }
		catch (error) { observed.passwd = error.code || error.name; }
		try { writeFileSync('/escape', 'x'); observed.write = 'allowed'; }
		catch (error) { observed.write = error.code || error.name; }
		try { spawnSync('/usr/bin/true'); observed.child = 'allowed'; }
		catch (error) { observed.child = error.code || error.name; }
		try { await fetch('https://example.com'); observed.network = 'allowed'; }
		catch (error) { observed.network = error.cause?.code || error.code || error.name; }
		console.log(JSON.stringify(observed));
	`;
	const command = createBubblewrapLaunchCommand(profile, {
		executable: node.executable,
		args: ["--permission", "--no-warnings", "--max-old-space-size=128", "-e", script],
		cwd: "/",
		mounts: node.mounts,
		disableNestedUserNamespaces: true,
	});
	const result = await execute(command.executable, command.args, {
		cwd: command.cwd,
		env: {},
		timeout: 10_000,
	});
	const observed = JSON.parse(result.stdout.trim());
	assert.deepEqual(observed.env, ["PWD"]);
	assert.notEqual(observed.passwd, "visible");
	assert.notEqual(observed.write, "allowed");
	assert.notEqual(observed.child, "allowed");
	assert.notEqual(observed.network, "allowed");
	assert.match(command.profileDigest, /^sha256:[0-9a-f]{64}$/);
});

test("Bubblewrap applies the process limit inside its fresh user namespace", async () => {
	const base = liveProfile();
	const profile = liveProfile({limits: {...base.limits, processes: 32}});
	const node = nodeMount();
	const script = String.raw`
		const {spawnSync} = require("node:child_process");
		const limit = spawnSync("/usr/bin/prlimit", [
			"--pid", String(process.pid), "--nproc", "--noheadings", "--output", "SOFT,HARD"
		], {encoding: "utf8"});
		if (limit.status !== 0) throw new Error(limit.stderr);
		console.log(limit.stdout.trim().replace(/\s+/g, " "));
	`;
	const command = createBubblewrapLaunchCommand(profile, {
		executable: node.executable,
		args: ["-e", script],
		cwd: "/",
		mounts: node.mounts,
		disableNestedUserNamespaces: true,
	});
	const prlimitIndex = command.args.lastIndexOf(profile.prlimit.path);
	assert.equal(command.executable, profile.bubblewrap.path);
	assert.ok(prlimitIndex > command.args.indexOf("--unshare-user"));
	assert.equal(command.args[prlimitIndex - 1], "--");
	assert.ok(command.args.indexOf("--nproc=32") > prlimitIndex);
	const result = await execute(command.executable, command.args, {
		cwd: command.cwd,
		env: {},
		timeout: 10_000,
	});
	assert.equal(result.stdout.trim(), "32 32");
});

test("Bubblewrap profile enforces operating-system CPU limits", async () => {
	const base = liveProfile();
	const profile = liveProfile({limits: {...base.limits, cpuSeconds: 1}});
	const node = nodeMount();
	const command = createBubblewrapLaunchCommand(profile, {
		executable: node.executable,
		args: ["-e", "while (true) {}"],
		cwd: "/",
		mounts: node.mounts,
		disableNestedUserNamespaces: true,
	});
	await assert.rejects(
		execute(command.executable, command.args, {
			cwd: command.cwd,
			env: {},
			timeout: 5_000,
		}),
		(error) => error.code === 137 || error.signal === "SIGKILL" || error.signal === "SIGXCPU",
	);
});

test("Bubblewrap profile fails closed on executable identity drift", () => {
	const profile = liveProfile();
	const tampered = {
		...profile,
		bubblewrap: {...profile.bubblewrap, digest: `sha256:${"0".repeat(64)}`},
	};
	assert.throws(
		() => verifyBubblewrapSandboxProfile(tampered),
		/Bubblewrap sandbox bubblewrap executable digest changed/,
	);
});

test("Bubblewrap profile disables nested user namespaces for hostile children", async () => {
	const profile = liveProfile();
	const node = nodeMount();
	const script = String.raw`
		const {spawnSync} = require('node:child_process');
		const result = spawnSync('/usr/bin/bwrap', [
			'--unshare-user', '--ro-bind', '/usr', '/usr', '/usr/bin/true'
		], {encoding: 'utf8'});
		console.log(JSON.stringify({
			status: result.status,
			failure: result.stderr || result.error?.message || ''
		}));
	`;
	const command = createBubblewrapLaunchCommand(profile, {
		executable: node.executable,
		args: ["--max-old-space-size=128", "-e", script],
		cwd: "/",
		mounts: node.mounts,
		disableNestedUserNamespaces: true,
	});
	const result = await execute(command.executable, command.args, {
		cwd: command.cwd,
		env: {},
		timeout: 10_000,
	});
	const observed = JSON.parse(result.stdout.trim());
	assert.notEqual(observed.status, 0);
	assert.match(observed.failure, /namespace|Operation not permitted|Permission denied/i);
});
