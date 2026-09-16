import assert from 'node:assert/strict';
import test from 'node:test';
import {createPiCheckModel} from '../../../src/adapters/pi/check-model.ts';
import {UncertainCheckModelCustody} from '../../../src/ports/check-model.ts';
import {events, message, scriptedPiLease} from './fixtures.mjs';

const config = {providerId: 'cw:provider:scripted', modelId: 'cw:model:scripted', locality: 'local', providerConfigurationDigest: `sha256:${'a'.repeat(64)}`, temperature: 0, reasoningEffort: null};
const request = {prompt: 'Inspect the frozen input.', shape: {passed: 'boolean'}, maximumInputTokens: 4096, maximumOutputTokens: 100, maximumResponseBytes: 4096};
const admitted = result => {assert.equal(result.ok, true, JSON.stringify(result)); return result.value;};
function fixture(run, options = {}) {
  let installs = 0, disposals = 0;
  const port = admitted(createPiCheckModel(config, async binding => {
    installs++;
    return {...binding, ...scriptedPiLease(run, {dispose: async () => {disposals++; await options.dispose?.();}}), ...options.lease};
  }));
  return {port, get installs() {return installs;}, get disposals() {return disposals;}};
}
const call = (port, patch = {}, signal = new AbortController().signal) => port.call({...request, ...patch}, signal);

test('Pi Check call is tool-free, explicit, fresh and carries usage without double-counting reasoning', async () => {
  let calls = 0;
  const f = fixture(async (stream, {context, options}) => {
    calls++;
    assert.equal(context.messages.length, 1); assert.deepEqual(context.tools, []);
    assert.equal(context.messages[0].content, request.prompt); assert.match(context.systemPrompt, /canonical JSON/);
    assert.equal(options.temperature, 0); assert.equal(options.maxTokens, 100); assert.equal(options.maxRetries, 0);
    assert.equal(options.toolChoice, 'none'); assert.equal(options.transport, 'sse');
    for (const event of events('{"passed":true}', {usage: {...message().usage, input: 10, cacheRead: 3, cacheWrite: 2, reasoning: 2, totalTokens: 20}})) stream.push(event);
  });
  const result = await call(f.port);
  assert.deepEqual({...result, value: {...result.value}}, {value: {passed: true}, inputTokens: 15, outputTokens: 5});
  await call(f.port);
  assert.equal(calls, 2); assert.equal(f.installs, 2); assert.equal(f.disposals, 2);
});

test('Pi retains completed false judgments', async () => {
  const f = fixture(async stream => {for (const event of events('{"passed":false}')) stream.push(event);});
  assert.equal((await call(f.port)).value.passed, false);
});

for (const [label, sequence] of [
  ['missing completion', events().slice(0, 2)],
  ['truncated output', events(undefined, {stopReason: 'length'})],
  ['tool request', [{type: 'toolcall_start'}, ...events()]],
  ['invalid JSON', events('not json')],
  ['extra field', events('{"extra":true,"passed":true}')],
  ['wrong type', events('{"passed":"yes"}')],
  ['wrong model', events(undefined, {model: 'other'})],
  ['tool content', events(undefined, {content: [{type: 'toolCall', id: 'bad', name: 'bad', arguments: {}}]})],
  ['missing usage', events(undefined, {usage: {...message().usage, input: 0, output: 0, totalTokens: 0}})],
  ['inconsistent usage', events(undefined, {usage: {...message().usage, totalTokens: 100}})],
  ['invalid reasoning subset', events(undefined, {usage: {...message().usage, reasoning: 8}})],
  ['negative usage', events(undefined, {usage: {...message().usage, input: -1}})],
  ['excess output tokens', events(undefined, {usage: {...message().usage, output: 101, totalTokens: 111}})],
  ['excess input tokens', events(undefined, {usage: {...message().usage, input: 4097, totalTokens: 4102}})],
  ['oversized deltas', [{type: 'thinking_delta', delta: 'x'.repeat(21000)}, ...events()]],
  ['oversized final content', events('x'.repeat(21000))],
  ['too many events', [...Array.from({length: 4097}, () => ({type: 'thinking_start'})), ...events()]],
]) test(`Pi Check rejects ${label} without retry`, async () => {
  const f = fixture(async stream => {for (const event of sequence) stream.push(event);});
  await assert.rejects(call(f.port)); assert.equal(f.installs, 1); assert.equal(f.disposals, 1);
});

test('Pi Check preflight rejects invalid requests, exhausted reserve and pre-cancellation without installing', async () => {
  const f = fixture();
  await assert.rejects(call(f.port, {maximumOutputTokens: 0}));
  await assert.rejects(call(f.port, {maximumInputTokens: 1}));
  await assert.rejects(call(f.port, {}, AbortSignal.abort()));
  assert.equal(f.installs, 0);
  assert.equal(createPiCheckModel({...config, locality: 'remote'}, () => {}).ok, false);
  assert.equal(createPiCheckModel({...config, reasoningEffort: 'invented'}, () => {}).ok, false);
});

test('Pi binding and sampling changes invalidate identities', () => {
  const base = fixture().port;
  const changed = admitted(createPiCheckModel({...config, temperature: 1}, () => {}));
  assert.equal(base.routeDigest, changed.routeDigest); assert.notEqual(base.settingsDigest, changed.settingsDigest);
  assert.notEqual(base.routeDigest, admitted(createPiCheckModel({...config, modelId: 'other'}, () => {})).routeDigest);
});

for (const lease of [{routeDigest: `sha256:${'b'.repeat(64)}`}, {settingsDigest: `sha256:${'b'.repeat(64)}`}]) test('Pi rejects a mismatched backend lease before dispatch', async () => {
  let calls = 0;
  const f = fixture(async () => {calls++;}, {lease});
  await assert.rejects(call(f.port)); assert.equal(calls, 0); assert.equal(f.disposals, 1);
});

for (const patch of [{id: 'wrong'}, {provider: 'wrong'}, {api: 'anthropic-messages'}, {compat: {supportsFinishReason: false}}]) {
  test('Pi rejects unbound model identity, unsupported protocols and missing-completion compatibility', async () => {
    let calls = 0;
    const f = fixture(async () => {calls++;}, {lease: {model: {...scriptedPiLease().model, ...patch}}});
    await assert.rejects(call(f.port)); assert.equal(calls, 0); assert.equal(f.disposals, 1);
  });
}

test('Pi refuses a reasoning setting unsupported by the selected model', async () => {
  let calls = 0;
  const port = admitted(createPiCheckModel({...config, reasoningEffort: 'low'}, async binding => ({...binding, ...scriptedPiLease(async () => {calls++;})})));
  await assert.rejects(call(port), /reasoning setting/); assert.equal(calls, 0);
});

test('Pi cancellation during setup prevents dispatch and releases the lease', async () => {
  const controller = new AbortController(); let disposed = false, dispatched = false;
  const port = admitted(createPiCheckModel(config, async binding => {
    controller.abort();
    return {...binding, ...scriptedPiLease(async () => {dispatched = true;}, {dispose: async () => {disposed = true;}})};
  }));
  await assert.rejects(call(port, {}, controller.signal)); assert.equal(dispatched, false); assert.equal(disposed, true);
});

test('Pi cancellation propagates during a stream and prevents concurrent dispatch', async () => {
  const controller = new AbortController(); const started = Promise.withResolvers();
  const f = fixture(async (stream, {options}) => {
    started.resolve();
    await new Promise(resolve => options.signal.addEventListener('abort', resolve, {once: true}));
    stream.push({type: 'error', reason: 'aborted', error: message('', {stopReason: 'aborted'})});
  });
  const failed = assert.rejects(call(f.port, {}, controller.signal)); await started.promise;
  await assert.rejects(call(f.port), /busy/); controller.abort(); await failed;
  assert.equal(f.installs, 1); assert.equal(f.disposals, 1);
});

test('Cancellation during cleanup invalidates an otherwise completed result', async () => {
  const controller = new AbortController(); const f = fixture(undefined, {dispose: async () => controller.abort()});
  await assert.rejects(call(f.port, {}, controller.signal), /Cancellation/);
});

for (const setup of [false, true]) test(`Pi uncertain ${setup ? 'setup' : 'cleanup'} poisons reuse`, async () => {
  let calls = 0;
  const port = admitted(createPiCheckModel(config, async binding => {
    calls++; if (setup) throw new Error('Uncertain setup');
    return {...binding, ...scriptedPiLease(undefined, {dispose: async () => {throw new Error('Lost cleanup');}})};
  }));
  await assert.rejects(call(port), UncertainCheckModelCustody);
  await assert.rejects(call(port), UncertainCheckModelCustody); assert.equal(calls, 1);
});
