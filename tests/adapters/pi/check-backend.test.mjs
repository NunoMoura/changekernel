import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, mkdir, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {createPiCheckBackend} from '../../../src/adapters/pi/check-backend.ts';
import {initializeCheckExecutionLog} from '../../../src/adapters/checks/check-execution-log.ts';
import {fixture, ok, digest, limits} from '../../kernel/gates/check-fixtures.mjs';
import {localServer, answer} from './http-fixtures.mjs';

const hash = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const budgets = {...limits, milliseconds: 5000, memoryBytes: 128 * 1024 * 1024, modelCalls: 1, modelInputTokens: 8192, modelOutputTokens: 256};
function configuration(root, baseUrl, authorize = () => true) {
  return {...root, authorize, backendIdentityDigest: digest('a'), credentialBindingDigest: digest('b'),
    provider: {providerId: 'fixture-provider', modelId: 'fixture-model', baseUrl, apiKey: 'fixture-not-a-credential',
      maximumResponseBytes: 4096, maximumOutputTokens: 256, contextWindow: 32768, timeoutMs: 2000, temperature: 0}};
}
function request(host, label, patch = {}) {
  const artifact = `export default async function check({input}, api) {
    /* ${label} */
    if (process.env.CHANGEKERNEL_BACKEND_TEST_SECRET) throw Error('Credential environment leaked');
    const judgment = await api.model(JSON.stringify(input.slots), {passed:'boolean', reason:'string'});
    return {passed: judgment.passed, failureKind: judgment.passed ? null : 'insufficient-support',
      feedback: {summary: 'Assess recorded intent.', where: 'Supplied intent', reason: judgment.reason,
        resolution: judgment.passed ? null : 'Clarify the missing support.', preserve: ['Keep the recorded scope.']},
      evidenceDigests: input.slots.flatMap(slot => slot.evidenceDigests), limitations: []};
  }`;
  const f = fixture({definition: {limits: budgets, implementation: {runtime: 'javascript', artifactDigest: hash(artifact), dependenciesDigest: host.dependenciesDigest}},
    selected: {model: host.modelBinding}, ...patch});
  return {selection: f.selection, checkId: f.definition.checkId, artifact};
}
async function directory(t) {
  const root = await mkdtemp(join(tmpdir(), 'changekernel-pi-backend-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  return {custodyRoot: root, stateIdentity: await initializeCheckExecutionLog(root)};
}
async function backend(t, config) {
  const host = ok(await createPiCheckBackend(config));
  t.after(() => host.dispose());
  return host;
}

test('Configured Pi backend executes adopted Checks through the isolated Linux host', {timeout: 60000}, async t => {
  const root = await directory(t);
  let allowed = true, observed, mode = 'pass', waiting;
  const server = await localServer(t, (_request, response) => {
    if (mode === 'idle') {response.once('close', waiting.closed.resolve); waiting.seen.resolve(); return;}
    if (mode === 'error') {response.writeHead(500); response.end('Fixture failure'); return;}
    if (mode === 'oversize') {response.writeHead(200, {'content-type': 'text/event-stream'}); response.end(': ' + 'x'.repeat(8192) + '\n\n'); return;}
    answer(response, {text: JSON.stringify({passed: mode === 'pass', reason: 'Fixture assessment.'})});
  });
  const host = await backend(t, configuration(root, server.baseUrl, binding => {observed = binding; return allowed;}));
  assert.equal(server.requests.length, 0, 'Construction neither authorizes nor starts inference');
  assert.equal(JSON.stringify(host).includes('fixture-not-a-credential'), false);
  process.env.CHANGEKERNEL_BACKEND_TEST_SECRET = 'fixture-not-a-credential';
  t.after(() => {delete process.env.CHANGEKERNEL_BACKEND_TEST_SECRET;});

  await t.test('a real Pi response becomes an exact Check result without exposing credentials to the worker', async () => {
    const input = request(host, 'pass');
    const value = ok(await host.run(input));
    assert.equal(value.result.passed, true); assert.equal(value.modelCalls, 1);
    assert.equal(value.result.inputDigest, input.selection.inputs[0].digest);
    assert.equal(value.result.executionDigest, input.selection.inputs[0].executionDigest);
    assert.equal(observed.inputDigest, value.result.inputDigest);
    assert.equal(observed.permissionDigest, input.selection.adoption.checks[0].permissionDigest);
    assert.equal(server.requests.length, 1);
    assert.equal(server.requests[0].headers.authorization, 'Bearer fixture-not-a-credential');
    assert.equal(server.requests[0].body.model, 'fixture-model');
    assert.equal(server.requests[0].body.temperature, 0);
    assert.equal(server.requests[0].body.max_tokens, 256);
    assert.equal(JSON.stringify(server.requests[0].body).includes('fixture-not-a-credential'), false);
    const retained = ok(await host.run(input));
    assert.equal(retained.reused, true); assert.equal(retained.modelCalls, 0);
    assert.deepEqual(retained.result, value.result);
    assert.equal(server.requests.length, 1);
  });
  await t.test('denied authority, missing inputs and a different adopted route never call the provider', async () => {
    allowed = false;
    assert.equal((await host.run(request(host, 'denied'))).error.code, 'denied'); allowed = true;
    const missing = request(host, 'missing', {input: {slots: [{name: 'cw:input:intent', status: 'missing', value: null, sources: [], evidenceDigests: [], omissions: ['Missing intent.']}]}});
    assert.equal((await host.run(missing)).error.code, 'not-ready');
    const wrongRoute = request(host, 'wrong-route', {selected: {model: {...host.modelBinding, routeDigest: digest('f')}}});
    assert.equal((await host.run(wrongRoute)).error.code, 'denied');
    assert.equal(server.requests.length, 1);
  });
  await t.test('a completed false assessment retains actionable feedback', async () => {
    mode = 'false';
    const value = ok(await host.run(request(host, 'false')));
    assert.equal(value.result.passed, false); assert.equal(value.result.status, 'completed');
    assert.equal(value.result.failureKind, 'insufficient-support');
    assert.equal(value.result.feedback.reason, 'Fixture assessment.');
    assert.equal(value.result.feedback.resolution, 'Clarify the missing support.');
    assert.equal(server.requests.length, 2);
  });
  await t.test('provider failure is operational inability, with no retry or false verdict', async () => {
    mode = 'error'; const input = request(host, 'error');
    assert.equal((await host.run(input)).error.code, 'operational-error');
    assert.equal((await host.run(input)).error.code, 'already-attempted');
    assert.equal(server.requests.length, 3);
  });
  await t.test('the configured body limit rejects framing before it can become a Check verdict', async () => {
    mode = 'oversize';
    assert.equal((await host.run(request(host, 'body-limit'))).error.code, 'operational-error');
    assert.equal(server.requests.length, 4);
  });
  await t.test('active cancellation closes the provider before another Check can run', async () => {
    mode = 'idle'; waiting = {seen: Promise.withResolvers(), closed: Promise.withResolvers()};
    const controller = new AbortController();
    const running = host.run(request(host, 'cancel'), controller.signal);
    await Promise.race([waiting.seen.promise, running.then(value => {throw new Error(`Check ended before contacting the fixture provider: ${JSON.stringify(value)}`);})]);
    controller.abort();
    assert.equal((await running).error.code, 'operational-error');
    await waiting.closed.promise;
    mode = 'pass'; assert.equal(ok(await host.run(request(host, 'after-cancel'))).result.passed, true);
    assert.equal(server.requests.length, 6);
  });
});

test('Backend configuration is snapshotted and its complete public identity changes the adopted route', {timeout: 60000}, async t => {
  const root = await directory(t), server = await localServer(t);
  const original = configuration(root, server.baseUrl), input = {...original, provider: {...original.provider}};
  const pending = createPiCheckBackend(input);
  input.backendIdentityDigest = digest('f'); input.credentialBindingDigest = digest('f'); input.authorize = () => false;
  input.provider.apiKey = 'changed'; input.provider.baseUrl = 'https://example.invalid'; input.provider.temperature = 1;
  const first = ok(await pending); t.after(() => first.dispose());
  const same = await backend(t, original);
  assert.deepEqual(first.modelBinding, same.modelBinding);
  const publicChanges = {baseUrl: `${server.baseUrl}/other`, providerId: 'other-provider', modelId: 'other-model',
    maximumResponseBytes: 2048, maximumOutputTokens: 128, contextWindow: 16384, timeoutMs: 1000, temperature: 1};
  for (const [key, value] of Object.entries(publicChanges)) {
    const other = await backend(t, {...original, provider: {...original.provider, [key]: value}});
    assert.notEqual(first.modelBinding.routeDigest, other.modelBinding.routeDigest, key);
    assert.notEqual(first.modelBinding.settingsDigest, other.modelBinding.settingsDigest, key);
  }
  for (const key of ['backendIdentityDigest', 'credentialBindingDigest']) {
    const other = await backend(t, {...original, [key]: digest('c')});
    assert.notEqual(first.modelBinding.routeDigest, other.modelBinding.routeDigest, key);
  }
  assert.equal(server.requests.length, 0);
  assert.equal(ok(await first.run(request(first, 'snapshot'))).result.passed, true);
  assert.equal(server.requests[0].headers.authorization, 'Bearer fixture-not-a-credential');
});

test('Fresh backend processes deliver retained true/false results only with current authority', {timeout: 60000}, async t => {
  const root = await directory(t); let passed = true;
  const server = await localServer(t, (_request, response) => answer(response, {text: JSON.stringify({passed, reason: 'Retained assessment.'})}));
  const config = configuration(root, server.baseUrl), host = await backend(t, config), runs = [];
  for (const verdict of [true, false]) {
    passed = verdict; const input = request(host, `restart-${verdict}`), completed = ok(await host.run(input));
    assert.equal(completed.reused, false); runs.push({input, completed});
  }
  const changedInput = request(host, 'restart-true', {input: {slots: runs[0].input.selection.inputs[0].slots.map(slot => ({...slot, value: 'Revised fixture intent.'}))}});
  passed = true;
  await host.dispose(); assert.equal(server.requests.length, 2);
  const module = new URL('../../../src/adapters/pi/check-backend.ts', import.meta.url).href;
  async function reopened(input, authority = true) {
    const script = `import {createPiCheckBackend} from ${JSON.stringify(module)};
      let checks=0;
      const created=await createPiCheckBackend({...${JSON.stringify(config)},authorize:()=>${JSON.stringify(authority)}==='drift' ? ++checks===1 : ${JSON.stringify(authority)}});
      if(!created.ok) console.log(JSON.stringify(created));
      else try {console.log(JSON.stringify(await created.value.run(${JSON.stringify(input)})));} finally {await created.value.dispose();}`;
    return JSON.parse((await promisify(execFile)(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {timeout:15000})).stdout);
  }
  for (const {input, completed} of runs) {
    const delivered = ok(await reopened(input));
    assert.equal(delivered.reused, true); assert.equal(delivered.modelCalls, 0); assert.deepEqual(delivered.result, completed.result);
    assert.equal((await reopened(input, false)).error.code, 'denied');
    assert.equal((await reopened(input, 'drift')).error.code, 'denied');
  }
  assert.equal(server.requests.length, 2, 'Restart and denied retrieval never make another model call');
  const original = runs[0].input;
  const newSelection = {...original, selection:{...original.selection, current:{...original.selection.current, permissionDigests:[digest('d'),digest('f')]}}};
  assert.equal(ok(await reopened(newSelection)).reused, true);
  assert.equal((await reopened(newSelection, false)).error.code, 'denied');
  assert.equal(server.requests.length, 2, 'A newly authorized selection of unchanged exact inputs does not repeat inference');
  assert.equal(ok(await reopened(changedInput)).reused, false);
  assert.equal(ok(await reopened(changedInput)).reused, true);
  assert.equal(server.requests.length, 3, 'Changed exact inputs require a new authorized evaluation');
  await rm(join(root.custodyRoot, 'check-state-v1'), {recursive:true});
  assert.equal((await reopened(runs[0].input)).error.code, 'unsupported');
  assert.equal(server.requests.length, 3, 'Missing state is not silently initialized');
});

test('Revoked result-delivery authority does not erase a completed execution or cause another model call', {timeout:30000}, async t => {
  const root = await directory(t); let allowed = true;
  const server = await localServer(t, (_request, response) => {allowed = false; answer(response);});
  const host = await backend(t, configuration(root, server.baseUrl, () => allowed)), input = request(host, 'delivery-revoked');
  assert.equal((await host.run(input)).error.code, 'denied');
  assert.equal((await host.run(input)).error.code, 'denied');
  allowed = true;
  const retained = ok(await host.run(input)); assert.equal(retained.reused, true); assert.equal(retained.modelCalls, 0);
  assert.equal(server.requests.length, 1);
});

test('Failure to persist completion blocks acknowledgement and a reopened backend', {timeout:30000}, async t => {
  const root = await directory(t);
  const server = await localServer(t, async (_request, response) => {
    // Reservation must already exist before the first model request.
    const claim = JSON.parse(await readFile(join(root.custodyRoot, 'check-state-v1/000/claim.json'), 'utf8'));
    assert.equal(claim.inputDigest, input.selection.inputs[0].digest);
    await mkdir(join(root.custodyRoot, 'check-state-v1/000/terminal.json'), {mode:0o700});
    answer(response);
  });
  const config = configuration(root, server.baseUrl), host = await backend(t, config), input = request(host, 'storage-failure');
  assert.equal((await host.run(input)).error.code, 'operational-error');
  assert.equal((await host.run(input)).error.code, 'unsupported');
  await host.dispose();
  const reopened = await backend(t, config);
  assert.equal((await reopened.run(input)).error.code, 'operational-error');
  assert.equal(server.requests.length, 1);
});

test('Unsupported destinations, missing identities and invalid bounds fail without inference or fallback', async t => {
  const root = await directory(t), server = await localServer(t), original = configuration(root, server.baseUrl);
  for (const baseUrl of ['https://example.invalid/v1', 'http://localhost/v1', 'http://0.0.0.0/v1', 'file:///tmp/model', 'not a URL', `${server.baseUrl}?key=secret`]) {
    const result = await createPiCheckBackend({...original, provider: {...original.provider, baseUrl}});
    assert.equal(result.ok, false); assert.equal(result.error.code, 'invalid-options');
    assert.equal(JSON.stringify(result).includes('secret'), false);
  }
  for (const patch of [{backendIdentityDigest: 'unknown'}, {credentialBindingDigest: null}, {provider: {...original.provider, apiKey: ''}},
    {provider: {...original.provider, maximumResponseBytes: 0}}, {provider: {...original.provider, temperature: NaN}}]) {
    assert.equal((await createPiCheckBackend({...original, ...patch})).error.code, 'invalid-options');
  }
  assert.equal(server.requests.length, 0);
});
