import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync, realpathSync} from "node:fs";
import {test} from "node:test";

import {
	BUBBLEWRAP_SANDBOX_SCHEMA_VERSION,
} from "../../../src/runtime/sandbox/bubblewrap.ts";
import {
	runSecureCodeProgram,
} from "../../../src/runtime/dsh/secure-code-runtime.ts";
import {createSecureCodeCheckSandbox} from "../../../src/runtime/checks/secure-code-sandbox.ts";
import {
	assembleCheckInvocation,
	subjectInputSelection,
} from "../../../src/checks/protocol.ts";
import {sha256Digest} from "../../../src/utils/canonical-json.ts";
import {
	checkSnapshot,
	checkSubject,
	digest,
	packagedCheck,
} from "../../helpers/checks.mjs";

function liveConfig(overrides = {}) {
	const bubblewrap = realpathSync("/usr/bin/bwrap");
	const prlimit = realpathSync("/usr/bin/prlimit");
	const node = realpathSync(process.execPath);
	return {
		sandbox: {
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
				cpuSeconds: 3,
				openFiles: 128,
				processes: 512,
				fileBytes: 1024 * 1024,
			},
		},
		node: {
			path: node,
			version: process.version,
			digest: sha256Digest(readFileSync(node)),
		},
		maxProgramBytes: 64 * 1024,
		maxFrameBytes: 1024 * 1024,
		maxOutputBytes: 64 * 1024,
		maxBindingCalls: 16,
		maxBindingBytes: 64 * 1024,
		maxWallMs: 2_000,
		maxOldGenerationSizeMb: 128,
		...overrides,
	};
}

function tools(functions) {
	return [{
		global: "tools",
		functions,
		errorClass: {name: "ToolCallError", memberNameProperty: "toolName"},
	}];
}

test("secure Code Runtime executes TypeScript against exact async bindings", async () => {
	const observed = [];
	const result = await runSecureCodeProgram(liveConfig(), {
		program: `
			const inputs: number[] = [1, 2, 3];
			const values = await Promise.all(inputs.map(value => tools.double({value})));
			console.log("selected", values.length);
			return {values, total: values.reduce((sum, item) => sum + item.value, 0)};
		`,
		bindings: tools({
			async double(args) {
				observed.push(args);
				return {value: args.value * 2};
			},
		}),
	});
	assert.deepEqual(result, {
		logs: ["selected 3"],
		value: {total: 12, values: [{value: 2}, {value: 4}, {value: 6}]},
	});
	assert.deepEqual(observed, [{value: 1}, {value: 2}, {value: 3}]);
});

test("secure Code Runtime preserves typed binding rejection", async () => {
	const result = await runSecureCodeProgram(liveConfig(), {
		program: `
			try { await tools.denied({}); }
			catch (error) {
				return {
					isTyped: error instanceof ToolCallError,
					name: error.name,
					toolName: error.toolName,
					message: error.message,
				};
			}
		`,
		bindings: tools({
			async denied() { throw new Error("policy denied"); },
		}),
	});
	assert.deepEqual(result.value, {
		isTyped: true,
		message: "policy denied",
		name: "ToolCallError",
		toolName: "denied",
	});
});

test("secure Code Runtime denies ambient filesystem, network, child process, and credentials", async () => {
	const result = await runSecureCodeProgram(liveConfig(), {
		program: `
			const observed = {env: Object.keys(process.env)};
			try {
				const fs = await import("node:fs/promises");
				await fs.readFile("/etc/passwd", "utf8");
				observed.filesystem = "allowed";
			} catch (error) { observed.filesystem = error.code || error.name; }
			try {
				await fetch("https://example.com");
				observed.network = "allowed";
			} catch (error) { observed.network = error.cause?.code || error.code || error.name; }
			try {
				const child = await import("node:child_process");
				child.spawnSync("/usr/bin/true");
				observed.child = "allowed";
			} catch (error) { observed.child = error.code || error.name; }
			return observed;
		`,
		bindings: tools({}),
	});
	assert.deepEqual(result.value.env, ["PWD"]);
	assert.notEqual(result.value.filesystem, "allowed");
	assert.notEqual(result.value.network, "allowed");
	assert.notEqual(result.value.child, "allowed");
});

test("secure Code Runtime denies workers, symlinks, protocol descriptors, and native addons", async () => {
	const result = await runSecureCodeProgram(liveConfig(), {
		program: `
			const observed = {};
			const fs = await import("node:fs");
			try { fs.symlinkSync("/usr", "/tmp/escape"); observed.symlink = "allowed"; }
			catch (error) { observed.symlink = error.code || error.name; }
			try { fs.readFileSync("/proc/self/fd/0"); observed.descriptor = "allowed"; }
			catch (error) { observed.descriptor = error.code || error.name; }
			try {
				const {Worker} = await import("node:worker_threads");
				const worker = new Worker("", {eval: true});
				await worker.terminate();
				observed.worker = "allowed";
			} catch (error) { observed.worker = error.code || error.name; }
			try {
				process.dlopen({exports: {}}, process.execPath);
				observed.addon = "allowed";
			} catch (error) { observed.addon = error.code || error.name; }
			return observed;
		`,
		bindings: tools({}),
	});
	for (const capability of ["symlink", "descriptor", "worker", "addon"]) {
		assert.notEqual(result.value[capability], "allowed", capability);
	}
});

test("secure Code Runtime hard-terminates hot loops, memory exhaustion, and aborted waits", async () => {
	const timeout = await runSecureCodeProgram(liveConfig({maxWallMs: 150}), {
		program: "while (true) {}",
		bindings: tools({}),
	});
	assert.equal(timeout.error?.kind, "timeout");

	const memory = await runSecureCodeProgram(
		liveConfig({maxOldGenerationSizeMb: 16, maxWallMs: 30_000}),
		{
			program: `
				const retained = [];
				while (true) {
					retained.push(new Array(1000000).fill(retained.length));
				}
			`,
			bindings: tools({}),
		},
	);
	assert.equal(memory.error?.kind, "worker-exit");

	const controller = new AbortController();
	setTimeout(() => controller.abort(), 100);
	const aborted = await runSecureCodeProgram(liveConfig(), {
		program: "await new Promise(() => {});",
		bindings: tools({}),
		signal: controller.signal,
	});
	assert.equal(aborted.error?.kind, "abort");
});

test("secure Code Runtime enforces call, byte, output, and identity bounds", async () => {
	const callBound = await runSecureCodeProgram(liveConfig({maxBindingCalls: 1}), {
		program: `
			await tools.echo({value: 1});
			try { await tools.echo({value: 2}); }
			catch (error) { return {toolName: error.toolName, message: error.message}; }
		`,
		bindings: tools({async echo(args) { return args; }}),
	});
	assert.deepEqual(callBound.value, {
		message: "Binding call budget exhausted.",
		toolName: "echo",
	});

	let byteBoundCalls = 0;
	const byteBound = await runSecureCodeProgram(liveConfig({maxBindingBytes: 16}), {
		program: `
			try { await tools.echo({value: "${"x".repeat(64)}"}); }
			catch (error) { return error.message; }
		`,
		bindings: tools({async echo(args) { byteBoundCalls += 1; return args; }}),
	});
	assert.equal(byteBound.value, "Binding byte budget exhausted.");
	assert.equal(byteBoundCalls, 0);

	const outputBound = await runSecureCodeProgram(liveConfig({maxOutputBytes: 16}), {
		program: `console.log("${"x".repeat(32)}");`,
		bindings: tools({}),
	});
	assert.equal(outputBound.error?.kind, "output-limit");

	const invalidOutput = await runSecureCodeProgram(liveConfig(), {
		program: "return 1n;",
		bindings: tools({}),
	});
	assert.equal(invalidOutput.error?.kind, "invalid-output");

	const config = liveConfig();
	config.node.digest = `sha256:${"0".repeat(64)}`;
	await assert.rejects(
		runSecureCodeProgram(config, {program: "return null;", bindings: tools({})}),
		/Secure Code Runtime Node executable digest changed/,
	);
});

test("secure Code Runtime rejects malformed worker traffic without invoking bindings", async () => {
	let calls = 0;
	const result = await runSecureCodeProgram(liveConfig(), {
		program: `
			process.stdout.write("forged-protocol\\n");
			await tools.effect({});
			return "forged";
		`,
		bindings: tools({
			async effect() { calls += 1; return null; },
		}),
	});
	assert.equal(result.error?.kind, "worker-exit");
	assert.equal(calls, 0);
});

test("secure Code Runtime carries no state between programs", async () => {
	const config = liveConfig();
	const first = await runSecureCodeProgram(config, {
		program: "globalThis.persisted = 42; return globalThis.persisted;",
		bindings: tools({}),
	});
	const second = await runSecureCodeProgram(config, {
		program: "return globalThis.persisted ?? null;",
		bindings: tools({}),
	});
	assert.equal(first.value, 42);
	assert.equal(second.value, null);
});

test("secure Code Check runs self-contained CHECK.mjs with only frozen Invocation binding", async () => {
	const check = packagedCheck();
	const snapshot = checkSnapshot([check]);
	const subject = checkSubject({stage: check.stage});
	const selector = check.definition.inputs[0];
	const invocation = assembleCheckInvocation({
		subject,
		snapshot,
		gatePackageDigest: digest("secure-check-package"),
		check,
		inputs: [subjectInputSelection(subject, selector)],
	});
	const secure = createSecureCodeCheckSandbox(liveConfig());
	const output = await secure.sandbox.execute({
		source: `export default async function check(codewiki) {
			const selection = codewiki.selection("subject", "");
			return codewiki.output(
				{kind: "binary", value: selection.items.length === 1},
				"Read exact frozen subject.",
			);
		}`,
		invocation,
		timeoutMs: 2_000,
		maximumOutputBytes: 16_384,
		signal: new AbortController().signal,
	});
	assert.equal(output.invocationDigest, invocation.invocationDigest);
	assert.equal(output.measurement.value, true);
	assert.equal(secure.sandbox.admission.network, "denied");
	await assert.rejects(
		secure.sandbox.execute({
			source: `export default async function check(codewiki) {
				codewiki.selection("repository", "ambient:tree");
			}`,
			invocation,
			timeoutMs: 2_000,
			maximumOutputBytes: 16_384,
			signal: new AbortController().signal,
		}),
		/Secure Code Check exception.*not declared/,
	);
});
