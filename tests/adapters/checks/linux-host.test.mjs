import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {mkdtemp, readFile, readdir, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createServer} from "node:http";
import test from "node:test";
import {CHECK_MODEL_PORT_PROTOCOL} from "../../../src/ports/check-model.ts";
import {createLinuxCheckHost} from "../../../src/adapters/checks/linux-host.ts";
import {initializeCheckExecutionLog} from "../../../src/adapters/checks/check-execution-log.ts";
import {fixture, ok, digest, limits, body} from "../../kernel/gates/check-fixtures.mjs";
const hash = value => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const successful = {passed: true, failureKind: null, feedback: {summary: "Condition holds.", where: "Supplied case", reason: "Exact source supports this condition.", resolution: null, preserve: ["Keep accepted intent."]}, evidenceDigests: [digest("1")], limitations: []};
const artifact = (code = "", returned = successful) => `export default async function check({input, parameters}, api) {${code}\nreturn ${JSON.stringify(returned)};}`;
const adoptedLimits = {...limits, milliseconds: 5000, memoryBytes: 128 * 1024 * 1024};
function request(host, source = artifact(), patch = {}) {
	const f = fixture({definition: {limits: adoptedLimits, implementation: {runtime: "javascript", artifactDigest: hash(source), dependenciesDigest: host.dependenciesDigest}}, ...patch});
	return {selection: f.selection, checkId: f.definition.checkId, artifact: source};
}

function modelRequest(host, source, budgets = {}) {
	return request(host, source, {definition: {limits: {...adoptedLimits, modelCalls: 1, modelInputTokens: 8192, modelOutputTokens: 512, ...budgets},
		implementation: {runtime: "javascript", artifactDigest: hash(source), dependenciesDigest: host.dependenciesDigest}},
		selected: {model: {routeDigest: digest("2"), settingsDigest: digest("3")}}});
}

test("Linux isolated Check execution in a disposable external project", {timeout: 90000}, async t => {
	const root = await mkdtemp(join(tmpdir(), "changekernel-check-runner-"));
	let authorized = true, calls = 0, observed, mode = "valid";
	const provider = {protocol: CHECK_MODEL_PORT_PROTOCOL, routeDigest: digest("2"), settingsDigest: digest("3"), locality: "local", call(request, signal) {
		calls++; observed = {request, signal};
		if (mode === "throw") throw new Error("Provider failed synchronously.");
		if (mode === "reject") return Promise.reject(new Error("Provider failed asynchronously."));
		if (mode === "ignore-cancel") return new Promise(() => {});
		return Promise.resolve({value: mode === "malformed" ? {confidence: 1} : {supported: true, reason: "Fixture support."}, inputTokens: mode === "overspend" ? 999999 : 25, outputTokens: 10});
	}};
	const stateIdentity = await initializeCheckExecutionLog(root);
	const options = {custodyRoot: root, stateIdentity, authorize: () => authorized, model: provider};
	const created = await createLinuxCheckHost(options);
	assert.equal(created.ok, true, JSON.stringify(created));
	const host = created.value;
	try {
		await t.test("computation executes outside the server and returns a bound Boolean result", async () => {
			const input = request(host);
			const run = ok(await host.run(input));
			assert.equal(run.result.passed, true); assert.equal(run.modelCalls, 0);
			assert.equal(run.result.inputDigest, input.selection.inputs[0].digest);
			assert.equal(run.dependenciesDigest, host.dependenciesDigest);
			assert.equal(ok(await host.run(input)).reused, true);
		});
		await t.test("denied, unready and mismatched artifacts never execute", async () => {
			const input = request(host, artifact("/* distinct */"));
			authorized = false;
			assert.equal((await host.run(input)).error.code, "denied"); authorized = true;
			assert.equal((await host.run({...input, artifact: input.artifact + "\n"})).error.code, "invalid-input");
			const missing = request(host, artifact(), {input: {slots: [{name: "cw:input:intent", status: "missing", value: null, sources: [], evidenceDigests: [], omissions: ["Missing source."]}]}});
			assert.equal((await host.run(missing)).error.code, "not-ready");
			assert.equal(calls, 0);
		});
		await t.test("no host files, writes, credentials, subprocesses or external network", async () => {
			const secret = join(root, "host-secret"); await writeFile(secret, "unchanged");
			process.env.CHANGEKERNEL_RUNNER_TEST_SECRET = "private";
			let hits = 0;
			const listener = createServer((_, response) => {hits++; response.end("host-only");});
			await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
			const endpoint = `http://127.0.0.1:${listener.address().port}/`;
			assert.equal(await (await fetch(endpoint)).text(), "host-only");
			const source = artifact(`
const fs = await import('node:fs/promises');
const cp = await import('node:child_process');
if (process.env.CHANGEKERNEL_RUNNER_TEST_SECRET) throw Error('Environment leak');
for (const operation of [() => fs.readFile(${JSON.stringify(secret)}), () => fs.writeFile('/app/check.mjs', 'changed'), () => fs.writeFile(${JSON.stringify(secret)}, 'changed'), () => Promise.resolve(cp.spawn('/runtime/node', ['-e', '0'])), () => fetch(${JSON.stringify(endpoint)})]) {
  let blocked = false; try {await operation();} catch {blocked = true;} if (!blocked) throw Error('Capability leaked');
}`);
			try {
				assert.equal(ok(await host.run(request(host, source))).result.passed, true);
				assert.equal(hits, 1, "Only the host-side positive control reached the listener");
			} finally {delete process.env.CHANGEKERNEL_RUNNER_TEST_SECRET; await new Promise(resolve => listener.close(resolve));}
			assert.equal(await readFile(secret, "utf8"), "unchanged");
		});
		await t.test("model primitive is exact-route authorized, structured and bounded", async () => {
			const source = artifact(`const value = await api.model('Assess the exact supplied case: ' + JSON.stringify(input.slots), {supported:'boolean', reason:'string'}); if (!value.supported) throw Error('Unexpected assessment');`);
			const input = request(host, source, {definition: {limits: {...adoptedLimits, modelCalls: 1, modelInputTokens: 8192, modelOutputTokens: 512}, implementation: {runtime: "javascript", artifactDigest: hash(source), dependenciesDigest: host.dependenciesDigest}}, selected: {model: {routeDigest: digest("2"), settingsDigest: digest("3")}}});
			assert.equal(ok(await host.run(input)).modelCalls, 1); assert.equal(calls, 1);
			assert.equal(observed.request.maximumOutputTokens, 512); assert.deepEqual({...observed.request.shape}, {reason: "string", supported: "boolean"});
			assert.equal(observed.signal.aborted, true);
			const denied = request(host, source, {definition: body(input.selection.definitions[0]), selected: {model: {routeDigest: digest("4"), settingsDigest: digest("3")}}});
			assert.equal((await host.run(denied)).error.code, "denied"); assert.equal(calls, 1);
		});
		await t.test("semantic failure remains a semantic failure", async () => {
			const run = ok(await host.run(request(host, artifact("", {...successful, passed: false, failureKind: "insufficient-support"}))));
			assert.equal(run.result.passed, false); assert.equal(run.result.status, "completed");
		});
		for (const [name, source] of [
			["exception", artifact("throw Error('failure');")], ["malformed result", artifact("", {passed: true})],
			["unadopted model call", artifact("await api.model('judge', {passed:'boolean'});")],
			["stdout flood", artifact("process.stdout.write('x'.repeat(200000));")],
			["stderr flood", artifact("process.stderr.write('x'.repeat(10000));")],
			["duplicate result", artifact("process.stdout.write('{\"type\":\"result\",\"value\":null}\\n');")],
			["memory exhaustion", artifact("const buffers = []; while (true) buffers.push(Buffer.alloc(16*1024*1024, 1));")],
		]) await t.test(`${name} cannot fabricate semantic failure or pass`, async () => {
			const run = await host.run(request(host, source)); assert.equal(run.ok, false); assert.equal(run.error.code, "operational-error");
		});
		await t.test("wall timeout and cancellation terminate execution", async () => {
			const source = artifact("while (true) {}");
			const f = request(host, source, {selected: {limits: {...adoptedLimits, milliseconds: 300}}});
			const started = performance.now(); assert.equal((await host.run(f)).error.code, "operational-error");
			assert.ok(performance.now() - started < 7000);
			const controller = new AbortController(); controller.abort();
			assert.equal((await host.run(request(host, artifact("/* cancelled */")), controller.signal)).error.code, "operational-error");
		});
		await t.test("active cancellation stops the service and prevents overlapping executions", async () => {
			const controller = new AbortController();
			const running = host.run(request(host, artifact("/* active cancel */ while (true) {}")), controller.signal);
			assert.equal((await host.run(request(host, artifact("/* overlapping */")))).error.code, "unsupported");
			setTimeout(() => controller.abort(), 300);
			assert.equal((await running).error.code, "operational-error");
			assert.equal(ok(await host.run(request(host, artifact("/* after cancellation */")))).result.passed, true);
		});
		await t.test("parameters count toward the input bound; authorization must be exact Boolean", async () => {
			const large = request(host, artifact("/* oversized */"), {selected: {parameters: {text: "x".repeat(65536)}}});
			assert.equal((await host.run(large)).error.code, "invalid-input");
			authorized = "yes";
			assert.equal((await host.run(request(host, artifact("/* truthy */")))).error.code, "denied");
			authorized = true;
		});
		for (const failure of ["throw", "reject", "malformed", "overspend"]) await t.test(`provider ${failure} is operational inability`, async () => {
			mode = failure;
			const source = artifact(`/* ${failure} */ await api.model('Assess the supplied condition.', {supported:'boolean', reason:'string'});`);
			const run = await host.run(modelRequest(host, source));
			assert.equal(run.ok, false); assert.equal(run.error.code, "operational-error");
			mode = "valid";
		});
		await t.test("call and token bounds prevent extra provider requests", async () => {
			const before = calls;
			const source = artifact(`await api.model('first', {supported:'boolean', reason:'string'}); await api.model('second', {supported:'boolean', reason:'string'});`);
			assert.equal((await host.run(modelRequest(host, source))).error.code, "operational-error");
			assert.equal(calls, before + 1);
			const tooLarge = artifact(`await api.model('oversized prompt', {supported:'boolean', reason:'string'});`);
			assert.equal((await host.run(modelRequest(host, tooLarge, {modelInputTokens: 1}))).error.code, "operational-error");
			assert.equal(calls, before + 1);
		});
		await t.test("unclosed provider activity blocks the host, not a fabricated verdict or retry", async () => {
			mode = "ignore-cancel";
			const source = artifact(`await api.model('pending', {supported:'boolean', reason:'string'});`);
			const run = await host.run(modelRequest(host, source, {milliseconds: 2000}));
			assert.equal(run.error.code, "operational-error"); assert.match(run.error.message, /custody.*unresolved/u);
			assert.equal(observed.signal.aborted, true);
			assert.equal((await host.run(request(host, artifact("/* after unresolved */")))).error.code, "unsupported");
			const reopened = ok(await createLinuxCheckHost(options)), before = calls;
			try {assert.equal((await reopened.run(request(reopened, artifact("/* reopened unresolved */")))).error.code, "operational-error");}
			finally {await reopened.dispose();}
			assert.equal(calls, before);
			await host.dispose();
			assert.equal((await readdir(root)).some(name => name.startsWith("check-host-")), true, "Uncertain execution material remains available for investigation");
		});
	} finally {await host.dispose(); await rm(root, {recursive: true, force: true});}
});

test("Retained-only domain delivery never launches missing work and rechecks current authority", {timeout: 90000}, async () => {
	const root = await mkdtemp(join(tmpdir(), "changekernel-retained-only-"));
	let calls = 0, authorityCalls = 0, authority = () => true;
	const provider = {protocol: CHECK_MODEL_PORT_PROTOCOL, routeDigest: digest("2"), settingsDigest: digest("3"), locality: "local",
		async call() {calls++; return {value: {supported: true}, inputTokens: 25, outputTokens: 10};}};
	const options = {custodyRoot: root, stateIdentity: await initializeCheckExecutionLog(root), model: provider,
		authorize: () => {authorityCalls++; return authority();}};
	const host = ok(await createLinuxCheckHost(options));
	try {
		const source = artifact("await api.model('Assess supplied data.', {supported:'boolean'});"), input = modelRequest(host, source);
		assert.equal((await host.readRetainedCheck(input)).error.code, "not-ready");
		assert.equal(calls, 0);
		assert.deepEqual(await readdir(join(root, "check-state-v1")), ["identity.json"]);
		assert.equal((await host.readRetainedCheck({...input, result: successful})).error.code, "invalid-input", "Caller results are never accepted");
		const completed = ok(await host.run(input)); assert.equal(calls, 1);
		const retained = ok(await host.readRetainedCheck(input));
		assert.deepEqual(retained.result, completed.result); assert.equal(retained.modelCalls, 0); assert.equal(retained.reused, true);
		const reopened = ok(await createLinuxCheckHost(options));
		try {assert.deepEqual(ok(await reopened.readRetainedCheck(input)), retained);} finally {await reopened.dispose();}
		const missing = modelRequest(host, source + "\n/* different implementation */");
		for (const requested of [input, missing]) {
			authority = () => false;
			assert.equal((await host.readRetainedCheck(requested)).error.code, "denied");
			authorityCalls = 0; authority = () => authorityCalls === 1;
			assert.equal((await host.readRetainedCheck(requested)).error.code, "denied", "Authority is rechecked after custody inspection");
			authority = () => true;
			const controller = new AbortController(); controller.abort();
			assert.equal((await host.readRetainedCheck(requested, controller.signal)).error.code, "operational-error");
		}
		assert.equal((await host.readRetainedCheck(missing)).error.code, "not-ready");
		assert.equal(calls, 1);
		const negative = modelRequest(host, artifact("await api.model('Assess negative case.', {supported:'boolean'});", {...successful, passed: false, failureKind: "insufficient-support"}));
		const failed = ok(await host.run(negative));
		assert.equal(failed.result.passed, false);
		assert.deepEqual(ok(await host.readRetainedCheck(negative)).result, failed.result);
		assert.equal(calls, 2);
		const module = new URL("../../../src/adapters/checks/linux-host.ts", import.meta.url).href;
		const script = `import {createLinuxCheckHost} from ${JSON.stringify(module)};
			let calls = 0;
			const created = await createLinuxCheckHost({custodyRoot:${JSON.stringify(root)}, stateIdentity:${JSON.stringify(options.stateIdentity)},
				authorize:()=>true, model:{protocol:${JSON.stringify(CHECK_MODEL_PORT_PROTOCOL)}, routeDigest:${JSON.stringify(digest("2"))}, settingsDigest:${JSON.stringify(digest("3"))}, locality:'local',
				call(){calls++; throw Error('Lookup must never infer');}}});
			if (!created.ok) throw Error(JSON.stringify(created));
			try {const values=[]; for(const input of ${JSON.stringify([input, negative, missing])}) values.push(await created.value.readRetainedCheck(input));
				console.log(JSON.stringify({values,calls}));} finally {await created.value.dispose();}`;
		const fresh = JSON.parse((await promisify(execFile)(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], {timeout: 15000})).stdout);
		assert.equal(fresh.calls, 0);
		assert.deepEqual(ok(fresh.values[0]), retained);
		assert.deepEqual(ok(fresh.values[1]).result, failed.result);
		assert.equal(fresh.values[2].error.code, "not-ready");
		const stopped = request(host, artifact("throw Error('stopped');"));
		assert.equal((await host.run(stopped)).error.code, "operational-error");
		assert.equal((await host.readRetainedCheck(stopped)).error.code, "already-attempted");
		assert.deepEqual((await readdir(join(root, "check-state-v1"))).sort(), ["000", "001", "002", "identity.json"]);
		await writeFile(join(root, "check-state-v1/000/terminal.json"), "{", {mode: 0o600});
		assert.equal((await host.readRetainedCheck(input)).error.code, "operational-error");
		assert.equal((await host.run(missing)).error.code, "unsupported", "Uncertain custody also blocks later execution");
		assert.equal(calls, 2);
	} finally {await host.dispose(); await rm(root, {recursive: true, force: true});}
});
