// CLI preflight boundary tests (R1-2 slice D1).
//
// STUB-BASED EVIDENCE: these tests copy the actual bin/changekernel.mjs into a
// disposable external directory and pair it with a clearly labelled stub
// dist/index.js. They observe argument validation, runtime import/composition
// timing, root selection, and output dispatch at the CLI boundary. They are NOT
// real Project Server, extension, or execution qualification, and they never
// touch the checkout's shared dist/.
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";

const sourceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const sourceBin = join(sourceRoot, "bin", "changekernel.mjs");

// Test stub runtime — NOT the real Project Server. Records composition and
// dispatch through CHANGEKERNEL_CLI_STUB_LOG; CHANGEKERNEL_CLI_STUB_FAIL selects a
// failure mode for error-path coverage.
const STUB_INDEX = `// ChangeKernel CLI command test stub — NOT the real Project Server or Kernel.
import {appendFileSync} from "node:fs";

const log = (entry) => {
	appendFileSync(process.env.CHANGEKERNEL_CLI_STUB_LOG, JSON.stringify(entry) + "\\n");
};

// Top-level import marker: proves the runtime module was actually loaded.
log({kind: "import"});

const failMode = () => process.env.CHANGEKERNEL_CLI_STUB_FAIL ?? "";
const fail = () => ({ok: false, error: {code: failMode(), message: \`stub \${failMode()}\`, hint: \`stub hint for \${failMode()}\`}});

export async function createLocalProjectServer({projectRoot, projectName}) {
	log({kind: "compose", projectRoot, projectName});
	if (failMode() === "compose") return {ok: false, error: {message: "stub composition failure"}};
	return {ok: true, value: {repositoryId: "cw:repository:stub", server: {handle: () => ({ok: true, value: null})}, projectName}};
}

export function createChangeKernelClient(init) {
	log({kind: "client", clientKind: init.client.kind, identityRef: init.authentication.identityRef});
	return {ok: true, value: {
		status: async () => {
			log({kind: "status"});
			return failMode() ? fail() : {ok: true, value: {status: "ready"}};
		},
		changes: async (request) => {
			log({kind: "changes", view: request.view, changeId: request.changeId ?? null});
			if (failMode()) return fail();
			if (request.view === "get") return {ok: true, value: {userActionRequired: false, state: "accepted"}};
			return {ok: true, value: {items: []}};
		},
		checks: async (request) => {
			log({kind: "checks", view: request.view});
			if (failMode()) return fail();
			return {ok: true, value: {items: [{userActionRequired: false}]}};
		},
		audit: async (request) => {
			log({kind: "audit", view: request.view, changeId: request.changeId});
			if (failMode()) return fail();
			return {ok: true, value: {reduced: {state: "accepted", latestEventDigest: "stub-latest-digest", traceDigest: "stub-trace-digest"}, path: ".changekernel/changes/stub-change"}};
		},
	}};
}

export function renderConsole(view) {
	return \`[stub-render:\${view}]\`;
}

// Test stand-in for the runtime's terminal sanitizer — NOT the real one.
// Strips non-printable ASCII characters for this dispatch fixture only.
// It does not remove complete OSC/CSI sequences or qualify terminal safety.
const stubChar = String.fromCharCode.bind(String);
const NON_PRINTABLE = new RegExp("[^" + stubChar(9) + stubChar(10) + " -~]", "gu");
export function sanitizeTerminalText(input) {
	return input.replace(NON_PRINTABLE, "");
}
`;

async function makeHarness(label) {
	const dir = await mkdtemp(join(tmpdir(), `changekernel-cli-${label}-`));
	await mkdir(join(dir, "bin"), {recursive: true});
	await mkdir(join(dir, "dist"), {recursive: true});
	await copyFile(sourceBin, join(dir, "bin", "changekernel.mjs"));
	await writeFile(join(dir, "dist", "index.js"), STUB_INDEX);
	const logFile = join(dir, "stub.log");
	await writeFile(logFile, "");
	return {dir, bin: join(dir, "bin", "changekernel.mjs"), logFile};
}

function runBin(harness, args, {cwd, fail = "", bin} = {}) {
	return new Promise((resolvePromise) => {
		execFile(
			process.execPath,
			[bin ?? harness.bin, ...args],
			{cwd: cwd ?? harness.dir, env: {...process.env, CHANGEKERNEL_CLI_STUB_LOG: harness.logFile, CHANGEKERNEL_CLI_STUB_FAIL: fail}},
			(error, stdout, stderr) => {
				resolvePromise({code: error?.code ?? (error ? 1 : 0), stdout, stderr});
			},
		);
	});
}

async function readLog(harness) {
	const raw = await readFile(harness.logFile, "utf8");
	return raw.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

const kinds = (entries) => entries.map((entry) => entry.kind);

test("no arguments prints help, exits 0, and never imports the runtime", async () => {
	const harness = await makeHarness("help-none");
	try {
		const out = await runBin(harness, []);
		assert.equal(out.code, 0);
		assert.match(out.stdout, /Usage:/u);
		assert.deepEqual(await readLog(harness), []);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("--help alone prints help, exits 0, and never imports the runtime", async () => {
	const harness = await makeHarness("help-long");
	try {
		const out = await runBin(harness, ["--help"]);
		assert.equal(out.code, 0);
		assert.match(out.stdout, /Usage:/u);
		assert.deepEqual(await readLog(harness), []);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("-h alone prints help, exits 0, and never imports the runtime", async () => {
	const harness = await makeHarness("help-short");
	try {
		const out = await runBin(harness, ["-h"]);
		assert.equal(out.code, 0);
		assert.match(out.stdout, /Usage:/u);
		assert.deepEqual(await readLog(harness), []);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("unknown verbs fail bounded on stderr with usage, exit 2, before runtime import", async () => {
	const harness = await makeHarness("unknown-verb");
	try {
		const out = await runBin(harness, ["frobnicate", harness.dir]);
		assert.equal(out.code, 2);
		assert.match(out.stderr, /unknown verb/u);
		assert.match(out.stderr, /Usage:/u);
		assert.deepEqual(await readLog(harness), []);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("help flags are not accepted after a verb or with extra operands", async () => {
	const harness = await makeHarness("help-misplaced");
	try {
		const afterVerb = await runBin(harness, ["status", "--help"]);
		assert.equal(afterVerb.code, 2);
		assert.match(afterVerb.stderr, /unknown option/u);
		const leading = await runBin(harness, ["--help", "status"]);
		assert.equal(leading.code, 2);
		assert.match(leading.stderr, /unknown verb/u);
		assert.deepEqual(await readLog(harness), []);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("unknown options fail bounded before runtime import", async () => {
	const harness = await makeHarness("unknown-option");
	try {
		const out = await runBin(harness, ["status", "--bogus"]);
		assert.equal(out.code, 2);
		assert.match(out.stderr, /unknown option/u);
		assert.match(out.stderr, /Usage:/u);
		assert.deepEqual(await readLog(harness), []);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("--json is rejected outside trace, before runtime import", async () => {
	const harness = await makeHarness("json-verb");
	try {
		for (const args of [["status", "--json"], ["changes", "--json"], ["checks", "--json"], ["change", "--json", "cw:change:stub"]]) {
			const out = await runBin(harness, args);
			assert.equal(out.code, 2, `expected exit 2 for: ${args.join(" ")}`);
			assert.match(out.stderr, /--json is only supported for trace/u);
		}
		assert.deepEqual(await readLog(harness), []);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("trace rejects repeated and misplaced --json before runtime import", async () => {
	const harness = await makeHarness("json-trace");
	try {
		const repeated = await runBin(harness, ["trace", "--json", "--json", "cw:change:stub"]);
		assert.equal(repeated.code, 2);
		assert.match(repeated.stderr, /at most once/u);

		const afterId = await runBin(harness, ["trace", "cw:change:stub", "--json"]);
		assert.equal(afterId.code, 2);
		assert.match(afterId.stderr, /must precede/u);

		const afterRoot = await runBin(harness, ["trace", "--json", "cw:change:stub", harness.dir, "--json"]);
		assert.equal(afterRoot.code, 2);
		assert.match(afterRoot.stderr, /--json/u);
		assert.deepEqual(await readLog(harness), []);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("change and trace require a Change ID before runtime import", async () => {
	const harness = await makeHarness("missing-id");
	try {
		const changeOut = await runBin(harness, ["change"]);
		assert.equal(changeOut.code, 2);
		assert.match(changeOut.stderr, /change requires a Change ID/u);

		const traceOut = await runBin(harness, ["trace"]);
		assert.equal(traceOut.code, 2);
		assert.match(traceOut.stderr, /trace requires a Change ID/u);

		const jsonOut = await runBin(harness, ["trace", "--json"]);
		assert.equal(jsonOut.code, 2);
		assert.match(jsonOut.stderr, /trace requires a Change ID/u);
		assert.deepEqual(await readLog(harness), []);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("excess positionals fail bounded before runtime import", async () => {
	const harness = await makeHarness("excess");
	try {
		for (const args of [
			["status", "a", "b"],
			["changes", "a", "b"],
			["checks", "a", "b"],
			["change", "id", "a", "b"],
			["trace", "id", "a", "b"],
			["trace", "--json", "id", "a", "b"],
		]) {
			const out = await runBin(harness, args);
			assert.equal(out.code, 2, `expected exit 2 for: ${args.join(" ")}`);
			assert.match(out.stderr, /too many arguments/u);
		}
		assert.deepEqual(await readLog(harness), []);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("explicitly empty positional operands are rejected before runtime import", async () => {
	const harness = await makeHarness("empty-operand");
	try {
		for (const args of [
			["change", ""],
			["trace", ""],
			["trace", "--json", ""],
			["status", ""],
			["change", "cw:change:stub", ""],
			["trace", "cw:change:stub", ""],
		]) {
			const out = await runBin(harness, args);
			assert.equal(out.code, 2, `expected exit 2 for: ${JSON.stringify(args)}`);
			assert.equal(out.stdout, "", `expected empty stdout for: ${JSON.stringify(args)}`);
			assert.match(out.stderr, /arguments must not be empty/u);
		}
		assert.deepEqual(await readLog(harness), []);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("preflight stderr stays bounded at 2048 UTF-8 bytes and never echoes arguments", async () => {
	const harness = await makeHarness("bounded-stderr");
	const long = "x".repeat(20000);
	const stderrBound = (out) => Buffer.byteLength(out.stderr, "utf8");
	try {
		const cases = [
			{args: [long], message: /unknown verb/u, payload: long},
			{args: ["status", `--${long}`], message: /unknown option/u, payload: long},
			{args: [`stat\x1b]0;pwned\x07tus`], message: /unknown verb/u, payload: "pwned"},
			{args: ["status", `--x\x1b[31myz`], message: /unknown option/u, payload: "31myz"},
		];
		for (const invocation of cases) {
			const out = await runBin(harness, invocation.args);
			assert.equal(out.code, 2, `expected exit 2 for a rejected invocation`);
			assert.equal(out.stdout, "", "usage errors must not write to stdout");
			assert.ok(stderrBound(out) <= 2048, `stderr must stay within 2048 UTF-8 bytes, got ${stderrBound(out)}`);
			assert.match(out.stderr, invocation.message);
			assert.ok(!out.stderr.includes(invocation.payload), "argument bytes must not be echoed");
			assert.ok(!out.stderr.includes(String.fromCharCode(27)), "stderr must not carry a raw ESC byte");
		}
		assert.deepEqual(await readLog(harness), []);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("successful invocations record runtime import before composition and dispatch", async () => {
	const harness = await makeHarness("import-order");
	try {
		const out = await runBin(harness, ["status"]);
		assert.equal(out.code, 0);
		const entries = await readLog(harness);
		assert.equal(entries[0].kind, "import", "the import event must be recorded first");
		assert.ok(entries.findIndex((entry) => entry.kind === "compose") > 0, "composition must follow the import");
		assert.ok(entries.findIndex((entry) => entry.kind === "status") > 1, "dispatch must follow import and composition");
		assert.deepEqual(kinds(entries), ["import", "compose", "client", "status"]);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("negative control: an early-import mutation in a disposable bin copy is detected", async () => {
	const harness = await makeHarness("early-import");
	const pristine = await makeHarness("early-import-control");
	try {
		// Mutate only the disposable harness copy — never the checkout bin.
		const original = await readFile(sourceBin, "utf8");
		const mutated = original.replace(
			'import {basename, resolve} from "node:path";',
			'import {basename, resolve} from "node:path";\n\nawait import("../dist/index.js"); // negative-control mutation: import before preflight',
		);
		assert.notEqual(mutated, original, "the early-import mutation must apply to the disposable copy");
		await writeFile(harness.bin, mutated);

		const mutatedOut = await runBin(harness, ["frobnicate"]);
		assert.equal(mutatedOut.code, 2, "the usage error itself must still fail closed");
		const mutatedEvents = await readLog(harness);
		assert.ok(mutatedEvents.some((entry) => entry.kind === "import"), "the mutation imports the runtime before validation");
		assert.throws(() => assert.deepEqual(mutatedEvents, []), {code: "ERR_ASSERTION"}, "the no-import assertion must reject the mutant");

		// The same invalid invocation against the pristine bin records no events at all.
		const pristineOut = await runBin(pristine, ["frobnicate"]);
		assert.equal(pristineOut.code, 2);
		assert.deepEqual(await readLog(pristine), []);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
		await rm(pristine.dir, {recursive: true, force: true});
	}
});

test("omitted root composes the current working directory", async () => {
	const harness = await makeHarness("root-cwd");
	const cwd = join(harness.dir, "work");
	try {
		await mkdir(cwd);
		const out = await runBin(harness, ["status"], {cwd});
		assert.equal(out.code, 0);
		const entries = await readLog(harness);
		const composed = entries.find((entry) => entry.kind === "compose");
		assert.equal(composed.projectRoot, cwd);
		assert.equal(composed.projectName, "work");
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("bare and dotted relative roots resolve positionally against the cwd", async () => {
	const harness = await makeHarness("root-relative");
	const cwd = join(harness.dir, "work");
	try {
		await mkdir(join(cwd, "proj"), {recursive: true});

		const bare = await runBin(harness, ["status", "proj"], {cwd});
		assert.equal(bare.code, 0);
		let composes = (await readLog(harness)).filter((entry) => entry.kind === "compose");
		assert.equal(composes.length, 1);
		assert.equal(composes[0].projectRoot, join(cwd, "proj"));

		const dotted = await runBin(harness, ["status", "./proj"], {cwd});
		assert.equal(dotted.code, 0);
		composes = (await readLog(harness)).filter((entry) => entry.kind === "compose");
		assert.equal(composes.length, 2);
		assert.equal(composes[1].projectRoot, join(cwd, "proj"));

		const dot = await runBin(harness, ["status", "."], {cwd});
		assert.equal(dot.code, 0);
		composes = (await readLog(harness)).filter((entry) => entry.kind === "compose");
		assert.equal(composes.length, 3);
		assert.equal(composes[2].projectRoot, cwd);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("absolute roots are used verbatim as positional operands", async () => {
	const harness = await makeHarness("root-absolute");
	const target = join(harness.dir, "proj");
	try {
		await mkdir(target);

		const statusOut = await runBin(harness, ["status", target]);
		assert.equal(statusOut.code, 0);
		let composes = (await readLog(harness)).filter((entry) => entry.kind === "compose");
		assert.equal(composes.length, 1);
		assert.equal(composes[0].projectRoot, target);

		const changeOut = await runBin(harness, ["change", "cw:change:stub", target]);
		assert.equal(changeOut.code, 0);
		composes = (await readLog(harness)).filter((entry) => entry.kind === "compose");
		assert.equal(composes.length, 2);
		assert.equal(composes[1].projectRoot, target);

		const traceOut = await runBin(harness, ["trace", "--json", "cw:change:stub", target]);
		assert.equal(traceOut.code, 0);
		composes = (await readLog(harness)).filter((entry) => entry.kind === "compose");
		assert.equal(composes.length, 3);
		assert.equal(composes[2].projectRoot, target);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("operands containing slashes are IDs or roots by position, never by inference", async () => {
	const harness = await makeHarness("slash-id");
	const cwd = join(harness.dir, "work");
	try {
		await mkdir(cwd);
		const out = await runBin(harness, ["change", "cw/change/stub"], {cwd});
		assert.equal(out.code, 0);
		const entries = await readLog(harness);
		assert.equal(entries.find((entry) => entry.kind === "compose").projectRoot, cwd);
		const requested = entries.find((entry) => entry.kind === "changes");
		assert.equal(requested.view, "get");
		assert.equal(requested.changeId, "cw/change/stub");
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("status dispatch renders output with the read-only notice and exit 0", async () => {
	const harness = await makeHarness("dispatch-status");
	try {
		const out = await runBin(harness, ["status"]);
		assert.equal(out.code, 0);
		assert.match(out.stdout, /\[stub-render:status\]/u);
		assert.match(out.stdout, /read-only/u);
		assert.deepEqual(kinds(await readLog(harness)), ["import", "compose", "client", "status"]);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("changes dispatch keeps the empty-list message and exit 1 semantics", async () => {
	const harness = await makeHarness("dispatch-changes");
	try {
		const out = await runBin(harness, ["changes"]);
		assert.equal(out.code, 1);
		assert.match(out.stdout, /No Changes in changekernel-cli-dispatch-changes-\S* yet\./u);
		assert.match(out.stdout, /Propose one through the Project Server to begin\./u);
		assert.deepEqual(kinds(await readLog(harness)), ["import", "compose", "client", "changes"]);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("change dispatch requests the exact ID by view get and renders it", async () => {
	const harness = await makeHarness("dispatch-change");
	try {
		const out = await runBin(harness, ["change", "cw:change:stub"]);
		assert.equal(out.code, 0);
		assert.match(out.stdout, /\[stub-render:change\]/u);
		const requested = (await readLog(harness)).find((entry) => entry.kind === "changes");
		assert.equal(requested.view, "get");
		assert.equal(requested.changeId, "cw:change:stub");
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("checks dispatch renders gates and exits 0 when nothing needs the user", async () => {
	const harness = await makeHarness("dispatch-checks");
	try {
		const out = await runBin(harness, ["checks"]);
		assert.equal(out.code, 0);
		assert.match(out.stdout, /\[stub-render:checks\]/u);
		assert.match(out.stdout, /read-only/u);
		assert.deepEqual(kinds(await readLog(harness)), ["import", "compose", "client", "checks"]);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("trace --json emits the bounded audit JSON with exit 0", async () => {
	const harness = await makeHarness("dispatch-trace-json");
	try {
		const out = await runBin(harness, ["trace", "--json", "cw:change:stub"]);
		assert.equal(out.code, 0);
		const parsed = JSON.parse(out.stdout);
		assert.deepEqual(Object.keys(parsed).sort(), ["changeId", "latestEventDigest", "state", "traceDigest", "tracePath"]);
		assert.equal(parsed.changeId, "cw:change:stub");
		assert.equal(parsed.state, "accepted");
		assert.equal(parsed.tracePath, ".changekernel/changes/stub-change");
		assert.deepEqual(kinds(await readLog(harness)), ["import", "compose", "client", "audit"]);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("trace without --json renders plain output instead of JSON", async () => {
	const harness = await makeHarness("dispatch-trace-plain");
	try {
		const out = await runBin(harness, ["trace", "cw:change:stub"]);
		assert.equal(out.code, 0);
		assert.match(out.stdout, /\[stub-render:trace\]/u);
		assert.throws(() => JSON.parse(out.stdout));
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("invalid_project_state asks for diagnosis without re-bootstrap advice", async () => {
	const harness = await makeHarness("invalid-state");
	try {
		const out = await runBin(harness, ["status"], {fail: "invalid_project_state"});
		assert.equal(out.code, 2);
		assert.match(out.stderr, /needs diagnosis/u);
		assert.match(out.stderr, /verified procedure/u);
		assert.doesNotMatch(out.stderr, /re-bootstrap/u);
		assert.doesNotMatch(out.stderr, /predates/u);
		assert.doesNotMatch(out.stderr, /kernel generation/u);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});

test("other failures print the sanitized hint, and composition failures fail closed", async () => {
	const harness = await makeHarness("generic-fail");
	try {
		const hinted = await runBin(harness, ["status"], {fail: "stub_error"});
		assert.equal(hinted.code, 2);
		assert.match(hinted.stderr, /changekernel: status: stub hint for stub_error/u);

		const composed = await runBin(harness, ["status"], {fail: "compose"});
		assert.equal(composed.code, 2);
		assert.match(composed.stderr, /stub composition failure/u);
		assert.deepEqual(kinds(await readLog(harness)), ["import", "compose", "client", "status", "import", "compose"]);
	} finally {
		await rm(harness.dir, {recursive: true, force: true});
	}
});
