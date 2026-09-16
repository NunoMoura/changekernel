import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {LlmAdapter} from "@deepseek-ai/dsh-llm";
import {createDshCheckModel} from "../../../src/adapters/dsh/check-model.ts";
import {createLinuxCheckHost} from "../../../src/adapters/checks/linux-host.ts";
import {UncertainCheckModelCustody, checkModelJson, decodeCheckModelRequest} from "../../../src/ports/check-model.ts";
import {fixture, ok, digest, limits} from "../../kernel/gates/check-fixtures.mjs";

const configuration = {providerId: "cw:provider:scripted", modelId: "cw:model:scripted", locality: "local", providerConfigurationDigest: digest("2"), temperature: 0, reasoningEffort: null};
const request = {prompt: "Evaluate this exact supplied case.", shape: {passed: "boolean", reason: "string"}, maximumInputTokens: 8192, maximumOutputTokens: 512, maximumResponseBytes: 4096};
const answer = {passed: true, reason: "Supplied fixture supports this condition."};
function chunks(text = checkModelJson(answer), usage = {inputTokens: 10, outputTokens: 20}, finish = {kind: "stop"}) {
	return [{type: "block-start", index: 0, blockType: "text"}, {type: "text-delta", index: 0, text},
		{type: "block-end", index: 0, block: {type: "text", text}}, {type: "usage", usage}, {type: "finish", reason: finish}];
}
function setup({events = chunks(), config = configuration, stream, cleanup, installed, metadata, install} = {}) {
	const observed = {calls: 0, installs: 0, disposed: 0};
	class Scripted extends LlmAdapter {
		async resolveModel(provider, model) {return metadata ?? {provider, id: model, name: model};}
		async *stream(options) {
			observed.calls++; observed.options = options;
			if (stream) yield* stream(options);
			else yield* events;
		}
	}
	const port = ok(createDshCheckModel(config, async (context, binding, signal) => {
		observed.installs++; observed.binding = binding; observed.signal = signal; observed.context = context;
		if (install) await install(context, binding, signal);
		const unregister = context.llm.registerAdapter([binding.providerId], new Scripted());
		return {routeDigest: binding.routeDigest, settingsDigest: binding.settingsDigest, ...installed,
			async dispose() {observed.disposed++; unregister(); await cleanup?.();}};
	}));
	return {port, observed};
}

test("Check model primitive dispatches one tool-free, history-free request through actual DSH", async () => {
	const {port, observed} = setup();
	const result = await port.call(request, new AbortController().signal);
	assert.deepEqual({...result.value}, answer); assert.equal(result.inputTokens, 10); assert.equal(result.outputTokens, 20);
	assert.equal(observed.calls, 1); assert.equal(observed.installs, 1); assert.equal(observed.disposed, 1);
	assert.equal(observed.options.provider, configuration.providerId); assert.equal(observed.options.model, configuration.modelId);
	assert.equal(observed.options.maxTokens, 512); assert.equal(observed.options.temperature, 0);
	assert.equal(observed.options.messages.length, 1); assert.equal(observed.options.messages[0].content[0].text, request.prompt);
	assert.deepEqual(observed.options.tools, []); assert.equal(observed.options.sessionId, undefined);
	assert.equal(observed.context.agents, undefined); assert.equal(observed.context.tools, undefined);
	assert.ok(Object.isFrozen(observed.options)); assert.ok(Object.isFrozen(observed.binding)); assert.ok(Object.isFrozen(result.value));
	assert.equal(observed.signal.aborted, true);
});

test("exact provider configuration, route, locality and sampling determine identities", () => {
	const baseline = setup().port;
	for (const patch of [{providerId: "cw:provider:other"}, {modelId: "cw:model:other"}, {locality: "private"}, {providerConfigurationDigest: digest("3")}]) {
		const port = setup({config: {...configuration, ...patch}}).port;
		assert.notEqual(port.routeDigest, baseline.routeDigest); assert.notEqual(port.settingsDigest, baseline.settingsDigest);
	}
	for (const patch of [{temperature: 1}, {reasoningEffort: "low"}]) {
		const port = setup({config: {...configuration, ...patch}}).port;
		assert.equal(port.routeDigest, baseline.routeDigest); assert.notEqual(port.settingsDigest, baseline.settingsDigest);
	}
	for (const patch of [{locality: "remote"}, {temperature: -1}, {temperature: 3}, {providerId: " "}, {providerConfigurationDigest: "bad"}, {apiKey: "forbidden"}]) {
		assert.equal(createDshCheckModel({...configuration, ...patch}, () => {}).ok, false);
	}
});

test("invalid requests, pre-cancellation, wrong installed binding and unadopted DSH defaults do not dispatch", async () => {
	const {port, observed} = setup();
	for (const patch of [{shape: {nested: {type: "string"}}}, {shape: {passed: ["boolean"]}}, {prompt: " "}, {maximumInputTokens: 1}, {maximumOutputTokens: 0}, {maximumResponseBytes: 65537}, {history: []}]) {
		await assert.rejects(port.call({...request, ...patch}, new AbortController().signal));
	}
	const controller = new AbortController(); controller.abort();
	await assert.rejects(port.call(request, controller.signal)); assert.equal(observed.installs, 0);
	for (const options of [{installed: {settingsDigest: digest("4")}}, {installed: {routeDigest: digest("4")}},
		{metadata: {provider: configuration.providerId, id: configuration.modelId, name: "model", reasoning: {defaultEffort: "low", efforts: [{id: "low", name: "Low"}]}}}]) {
		const instance = setup(options);
		await assert.rejects(instance.port.call(request, new AbortController().signal));
		assert.equal(instance.observed.calls, 0); assert.equal(instance.observed.disposed, 1);
	}
});

for (const [name, events] of [
	["malformed JSON", chunks("not JSON")], ["duplicate JSON fields", chunks('{"passed":true,"passed":false,"reason":"x"}')],
	["wrong structure", chunks('{"passed":"true","reason":"x"}')], ["unknown fields", chunks('{"extra":1,"passed":true,"reason":"x"}')],
	["missing completion", chunks().filter(e => e.type !== "finish")],
	["missing usage", chunks().filter(e => e.type !== "usage")], ["duplicate usage", [...chunks().slice(0, -1), {type: "usage", usage: {inputTokens: 1, outputTokens: 1}}, chunks().at(-1)]],
	["invalid usage", chunks(undefined, {inputTokens: -1, outputTokens: 1})], ["cached input overspend", chunks(undefined, {inputTokens: 1, cacheReadTokens: 8193, outputTokens: 1})],
	["reasoning overspend", chunks(undefined, {inputTokens: 1, outputTokens: 1, reasoningTokens: 512})],
	["truncation", chunks(undefined, undefined, {kind: "max-tokens"})], ["provider failure", chunks(undefined, undefined, {kind: "error", failure: {code: "FIXTURE", message: "Failure"}})],
	["tool request", [{type: "block-start", index: 0, blockType: "tool-call"}, ...chunks()]],
	["excess response", chunks(checkModelJson({passed: true, reason: "x".repeat(5000)}))],
	["excess chunks", [...Array.from({length: 4097}, () => ({type: "text-delta", index: 0, text: ""})), ...chunks()]],
]) test(`${name} is rejected without tools, repair or another DSH call`, async () => {
	const {port, observed} = setup({events});
	await assert.rejects(port.call(request, new AbortController().signal));
	assert.equal(observed.calls, 1); assert.equal(observed.disposed, 1);
});

test("cached input and separately reported reasoning are charged, not hidden", async () => {
	const {port} = setup({events: chunks(undefined, {inputTokens: 10, cacheReadTokens: 20, cacheWriteTokens: 30, outputTokens: 40, reasoningTokens: 50})});
	const result = await port.call(request, new AbortController().signal);
	assert.equal(result.inputTokens, 60); assert.equal(result.outputTokens, 90);
});

test("cancellation during provider setup prevents dispatch and waits for cleanup", async () => {
	let release; const paused = new Promise(resolve => {release = resolve;});
	let installed; const entered = new Promise(resolve => {installed = resolve;});
	const controller = new AbortController();
	const {port, observed} = setup({install: async () => {installed(); await paused;}});
	const running = port.call(request, controller.signal);
	await entered; controller.abort(); release();
	await assert.rejects(running); assert.equal(observed.calls, 0); assert.equal(observed.disposed, 1);
});

test("cancellation during stream and cleanup cannot return a completed result", async () => {
	const controller = new AbortController();
	const streaming = setup({async *stream(options) {
		controller.abort(); assert.equal(options.signal.aborted, true); yield* chunks();
	}});
	await assert.rejects(streaming.port.call(request, controller.signal)); assert.equal(streaming.observed.disposed, 1);
	const cleanupController = new AbortController();
	const closing = setup({cleanup: () => cleanupController.abort()});
	await assert.rejects(closing.port.call(request, cleanupController.signal)); assert.equal(closing.observed.disposed, 1);
});

test("provider cleanup failure poisons the bridge with explicit uncertain custody", async () => {
	const {port, observed} = setup({cleanup: () => {throw new Error("Cannot establish closure");}});
	await assert.rejects(port.call(request, new AbortController().signal), UncertainCheckModelCustody);
	await assert.rejects(port.call(request, new AbortController().signal), UncertainCheckModelCustody);
	assert.equal(observed.calls, 1);
});

test("request snapshots are detached before provider setup awaits", async () => {
	const mutable = structuredClone(request);
	const {port, observed} = setup({install: () => {mutable.prompt = "substituted"; mutable.shape.passed = "string"; mutable.maximumOutputTokens = 1;}});
	assert.equal((await port.call(mutable, new AbortController().signal)).value.passed, true);
	assert.equal(observed.options.messages[0].content[0].text, request.prompt); assert.equal(observed.options.maxTokens, 512);
	assert.equal(decodeCheckModelRequest({...request, shape: Object.assign(Object.create({inherited: true}), request.shape)}).ok, false);
});

test("isolated JavaScript Check reaches DSH, while cleanup uncertainty blocks its execution host", {timeout: 20000}, async () => {
	const root = await mkdtemp(join(tmpdir(), "changekernel-dsh-check-"));
	const {port, observed} = setup();
	const host = ok(await createLinuxCheckHost({custodyRoot: root, authorize: () => true, model: port}));
	const source = `export default async function({input}, api) {
const assessment = await api.model('Assess only the supplied case.', {passed:'boolean', reason:'string'});
return {passed:assessment.passed, failureKind:assessment.passed ? null : 'insufficient-support', feedback:{summary:assessment.reason,where:'Supplied case',reason:assessment.reason,resolution:null,preserve:[]}, evidenceDigests:input.slots[0].evidenceDigests, limitations:[]};
}`;
	const run = (runtime, bridge, artifact) => {
		const f = fixture({definition: {limits: {...limits, milliseconds: 5000, memoryBytes: 128 * 1024 * 1024, modelCalls: 1, modelInputTokens: 8192, modelOutputTokens: 512},
			implementation: {runtime: "javascript", artifactDigest: `sha256:${createHash("sha256").update(artifact).digest("hex")}`, dependenciesDigest: runtime.dependenciesDigest}},
			selected: {model: {routeDigest: bridge.routeDigest, settingsDigest: bridge.settingsDigest}}});
		return runtime.run({selection: f.selection, checkId: f.definition.checkId, artifact});
	};
	try {
		assert.equal(ok(await run(host, port, source)).result.passed, true); assert.equal(observed.calls, 1); assert.equal(observed.disposed, 1);
		await host.dispose();
		const failed = setup({cleanup: () => {throw new Error("Unclosed provider");}});
		const uncertain = ok(await createLinuxCheckHost({custodyRoot: root, authorize: () => true, model: failed.port}));
		try {
			assert.match((await run(uncertain, failed.port, source)).error.message, /custody is unresolved/u);
			assert.equal((await run(uncertain, failed.port, source + "\n")).error.code, "unsupported");
			assert.equal(failed.observed.calls, 1);
		} finally {await uncertain.dispose();}
	} finally {await host.dispose(); await rm(root, {recursive: true, force: true});}
});
