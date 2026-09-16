import assert from 'node:assert/strict';
import test from 'node:test';
import {gzipSync} from 'node:zlib';
import {createPiCheckModel} from '../../../src/adapters/pi/check-model.ts';
import {boundedPiFetch, createPiOpenAIProvider} from '../../../src/adapters/pi/provider.ts';
import {answer, completion, localServer, resultText} from './http-fixtures.mjs';

const options = {timeout: 10000};
const request = {prompt: 'LOOPBACK_ONLY_SENTINEL', shape: {passed: 'boolean', reason: 'string'}, maximumInputTokens: 4096, maximumOutputTokens: 64, maximumResponseBytes: 4096};
function bridge(baseUrl, configuration = {}) {
  const result = createPiCheckModel({providerId: 'fixture', modelId: 'fixture-model', locality: 'local', providerConfigurationDigest: `sha256:${'a'.repeat(64)}`, temperature: 0, reasoningEffort: null},
    binding => ({...binding, ...createPiOpenAIProvider({providerId: binding.providerId, modelId: binding.modelId,
      baseUrl, apiKey: 'fixture-not-a-credential', maximumRequests: 1, maximumResponseBytes: 20480,
      contextWindow: 32768, maximumOutputTokens: 64, timeoutMs: 2000, temperature: binding.temperature, ...configuration})}));
  assert.equal(result.ok, true); return result.value;
}
const call = (port, signal = new AbortController().signal) => port.call(request, signal);

test('Pinned Pi HTTP provider carries exact settings, structured output and cached/reasoning usage', options, async t => {
  const server = await localServer(t);
  const result = await call(bridge(server.baseUrl));
  assert.deepEqual({...result.value}, JSON.parse(resultText));
  assert.equal(result.inputTokens, 120); assert.equal(result.outputTokens, 30);
  assert.equal(server.requests.length, 1);
  const {body, headers} = server.requests[0];
  assert.equal(headers.authorization, 'Bearer fixture-not-a-credential');
  assert.equal(body.model, 'fixture-model'); assert.equal(body.max_tokens, 64); assert.equal(body.temperature, 0);
  assert.equal(body.tools, undefined); assert.equal(body.messages.length, 2);
  assert.equal(body.messages[1].content, request.prompt);
});

for (const status of [301, 302, 303, 307, 308]) test(`Pi rejects HTTP ${status} before another origin receives content`, options, async t => {
  const target = await localServer(t);
  const server = await localServer(t, (_request, response) => {response.writeHead(status, {location: target.endpoint}); response.end();});
  await assert.rejects(call(bridge(server.baseUrl)));
  assert.equal(server.requests.length, 1); assert.equal(target.requests.length, 0);
});

test('Pi rejects same-origin redirect and does not retry a failed request', options, async t => {
  const server = await localServer(t, (_request, response) => {response.writeHead(307, {location: '/other'}); response.end();});
  await assert.rejects(call(bridge(server.baseUrl))); assert.equal(server.requests.length, 1);
  const failed = await localServer(t, (_request, response) => {response.writeHead(500); response.end('{"error":{"message":"Fixture failure"}}');});
  await assert.rejects(call(bridge(failed.baseUrl))); assert.equal(failed.requests.length, 1);
});

for (const kind of ['comments', 'error', 'compressed']) test(`Pi bounds ${kind} before model parsing`, options, async t => {
  const body = ':' + 'x'.repeat(131072) + '\n\n' + completion();
  const server = await localServer(t, (_request, response) => {
    response.writeHead(kind === 'error' ? 500 : 200, {'content-type': 'text/event-stream', ...(kind === 'compressed' ? {'content-encoding': 'gzip'} : {})});
    response.end(kind === 'compressed' ? gzipSync(body) : body);
  });
  await assert.rejects(call(bridge(server.baseUrl))); assert.equal(server.requests.length, 1);
});

for (const [label, scenario] of [
  ['missing usage', {tokens: null}], ['invalid output', {text: 'not JSON'}],
  ['missing finish reason', {finish: null}], ['truncation', {finish: 'length'}],
  ['unexpected tool', {tool: {name: 'not_admitted', arguments: {}}}],
]) test(`Pi HTTP Check rejects ${label}`, options, async t => {
  const server = await localServer(t, (_request, response) => answer(response, scenario));
  await assert.rejects(call(bridge(server.baseUrl))); assert.equal(server.requests.length, 1);
});

test('Transport enforces exact endpoint, method, request count and disposal', options, async t => {
  const server = await localServer(t); const transport = boundedPiFetch(server.endpoint, 20480, 1);
  t.after(() => transport.dispose());
  await assert.rejects(transport.fetch(server.baseUrl, {method: 'POST'}), /Unapproved/);
  await assert.rejects(transport.fetch(server.endpoint), /Unapproved/);
  await (await transport.fetch(server.endpoint, {method: 'POST'})).text();
  await assert.rejects(transport.fetch(server.endpoint, {method: 'POST'}), /request count/);
  await transport.dispose();
  await assert.rejects(transport.fetch(server.endpoint, {method: 'POST'}));
  assert.equal(server.requests.length, 1);
});

for (const size of [512, 513]) test(`Transport decoded-byte limit: ${size} bytes`, options, async t => {
  const server = await localServer(t, (_request, response) => response.end('x'.repeat(size)));
  const transport = boundedPiFetch(server.endpoint, 512, 1); t.after(() => transport.dispose());
  const response = await transport.fetch(server.endpoint, {method: 'POST'});
  if (size === 512) assert.equal((await response.text()).length, 512);
  else await assert.rejects(response.text(), /body limit/);
});

test('Cumulative stream comments stop before a complete model event', options, async t => {
  const server = await localServer(t, (_request, response) => {
    response.writeHead(200, {'content-type': 'text/event-stream'});
    const timer = setInterval(() => response.write(':' + 'x'.repeat(125) + '\n\n'), 2);
    response.on('close', () => clearInterval(timer));
  });
  await assert.rejects(call(bridge(server.baseUrl, {maximumResponseBytes: 512})));
  await server.closed; assert.equal(server.requests.length, 1);
});

for (const headers of [false, true]) test(`Pi cancellation closes the observed response ${headers ? 'during body' : 'before headers'}`, options, async t => {
  const server = await localServer(t, (_request, response) => {
    if (headers) {response.writeHead(200, {'content-type': 'text/event-stream'}); response.write(': waiting\n\n');}
  });
  const controller = new AbortController();
  const rejected = assert.rejects(call(bridge(server.baseUrl), controller.signal));
  await server.seen; controller.abort(); await rejected; await server.closed;
  assert.equal(server.requests.length, 1);
});

test('Pi provider timeout closes an idle request without retry', options, async t => {
  const server = await localServer(t, () => {});
  await assert.rejects(call(bridge(server.baseUrl, {timeoutMs: 150})));
  await server.closed; assert.equal(server.requests.length, 1);
});

for (const headers of [false, true]) test(`Transport disposal settles ${headers ? 'an unread body' : 'a request awaiting headers'}`, options, async t => {
  const server = await localServer(t, (_request, response) => {
    if (headers) {response.writeHead(200, {'content-type': 'text/event-stream'}); response.write(': waiting\n\n');}
  });
  const transport = boundedPiFetch(server.endpoint, 20480, 1);
  const pending = transport.fetch(server.endpoint, {method: 'POST'});
  const completion = headers ? pending : assert.rejects(pending);
  await server.seen;
  if (headers) await completion;
  await transport.dispose(); await completion; await server.closed;
  assert.equal(server.requests.length, 1);
});

test('Transport counts Unicode bytes, not characters', options, async t => {
  const server = await localServer(t, (_request, response) => response.end('é'.repeat(257)));
  const transport = boundedPiFetch(server.endpoint, 512, 1); t.after(() => transport.dispose());
  const response = await transport.fetch(server.endpoint, {method: 'POST'});
  await assert.rejects(response.text(), /body limit/);
});
