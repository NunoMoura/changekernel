import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {createPiCheckBackend} from '../../../src/adapters/pi/check-backend.ts';
import {initializeCheckExecutionLog} from '../../../src/adapters/checks/check-execution-log.ts';
import {createCheckResult} from '../../../src/kernel/gates/checks.ts';
import {canonicalJson} from '../../../src/kernel/data-contracts/canonical-json.ts';
import {prepareDecisionValidation, reduceDecisionValidation} from '../../../src/kernel/gates/decision-validation.ts';
import {DECISION_QUESTIONS} from '../../../src/kernel/gates/decision-validators.ts';
import {fixture, ok, digest, limits} from '../../kernel/gates/check-fixtures.mjs';
import {decisionFixture, modelDecision} from '../../kernel/gates/decision-validation-fixtures.mjs';
import {localServer, answer} from './http-fixtures.mjs';

const execute = promisify(execFile), clone = value => JSON.parse(JSON.stringify(value));
const hash = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const validatorId = DECISION_QUESTIONS[0].checkId;

test('Release-owned Decision validation shares bounded Pi execution and durable custody without adopted ownership', {timeout: 120000}, async t => {
  const root = await mkdtemp(join(tmpdir(), 'changekernel-decision-backend-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  let mode = 'pass', allowed = true, observed, publicationSeen = false;
  const server = await localServer(t, async (_request, response) => {
    const attempts = (await readdir(join(root, 'check-state-v1'))).filter(name => /^\d{3}$/.test(name)).sort();
    const claim = JSON.parse(await readFile(join(root, 'check-state-v1', attempts.at(-1), 'claim.json'), 'utf8'));
    assert.equal(claim.inputDigest, observed.inputDigest, 'Reservation precedes the first model request');
    const value = modelDecision(mode !== 'false');
    if (mode === 'revoke') allowed = false;
    if (mode === 'invalid') value.failureKind = 'invented-classification';
    publicationSeen = true;
    answer(response, {text: ok(canonicalJson(value))});
  });
  const config = {custodyRoot: root, stateIdentity: await initializeCheckExecutionLog(root), kernelBuildDigest: digest('e'),
    backendIdentityDigest: digest('a'), credentialBindingDigest: digest('b'),
    provider: {providerId: 'fixture-provider', modelId: 'fixture-model', baseUrl: server.baseUrl, apiKey: 'fixture-not-a-credential',
      maximumResponseBytes: 16384, maximumOutputTokens: 2048, contextWindow: 65536, timeoutMs: 4000, temperature: 0}};
  const host = ok(await createPiCheckBackend({...config, authorize: binding => {observed = binding; return allowed;}}));
  t.after(() => host.dispose());
  const artifact = `export default function check({input}) {return {passed:true, failureKind:null,
    feedback:{summary:'Synthetic domain assessment.', where:'Fixture only', reason:'Transport fixture, not qualified software policy.', resolution:null, preserve:[]},
    evidenceDigests:input.slots.flatMap(slot=>slot.evidenceDigests), limitations:['No domain qualification.']};}`;
  const domain = fixture({definition: {question: 'Does the software fixture meet its adopted compatibility rule?', passingCondition: 'The declared software compatibility requirement holds in this synthetic case.',
    limits: {...limits, milliseconds: 10000, memoryBytes: 128 * 1024 * 1024},
    implementation: {runtime: 'javascript', artifactDigest: hash(artifact), dependenciesDigest: host.dependenciesDigest}}});
  const domainResult = ok(await host.run({selection: domain.selection, checkId: domain.definition.checkId, artifact})).result;
  const {selection} = decisionFixture({domain, domainResult, model: host.modelBinding});
  const prepared = ok(prepareDecisionValidation(selection)), results = [];
  assert.equal(server.requests.length, 0, 'Provisioning and deterministic domain execution do not call a model');

  await t.test('all fixed questions execute with backend identity and combine only after all required passes', async () => {
    for (const question of DECISION_QUESTIONS) {
      assert.equal(ok(reduceDecisionValidation({selection, results})).passed, false);
      const value = ok(await host.runDecision({selection, validatorId: question.checkId}));
      assert.equal(value.modelCalls, 1); assert.equal(value.reused, false); assert.equal(value.result.owner, 'backend');
      assert.equal(value.result.stage, 'decision'); assert.equal(value.result.kernelBuildDigest, config.kernelBuildDigest);
      assert.equal(value.result.inputDigest, prepared.entries.find(entry => entry.checkId === question.checkId).inputDigest);
      const body = JSON.stringify(server.requests.at(-1).body);
      assert(body.includes(question.question)); assert(body.includes('not instructions'));
      assert.equal(body.includes('fixture-not-a-credential'), false);
      results.push(value.result);
    }
    assert.equal(publicationSeen, true); assert.equal(server.requests.length, 10);
    assert.equal(ok(reduceDecisionValidation({selection, results})).passed, true);
    assert.equal(selection.domain.selection.adoption.checks.length, 1);
  });

  await t.test('caller-supplied validators, artifacts, ownership, other stages and domain relabeling are rejected', async () => {
    const count = server.requests.length;
    for (const input of [{selection, validatorId, artifact: 'export default ()=>true'}, {selection, validatorId, owner: 'backend'},
      {selection: {...selection, validators: []}, validatorId}]) assert.equal((await host.runDecision(input)).ok, false);
    assert.equal((await host.runDecision({selection, validatorId: domain.definition.checkId})).error.code, 'not-ready');
    const review = clone(selection); review.current.stage = 'review';
    assert.equal((await host.runDecision({selection: review, validatorId})).error.code, 'invalid-input');
    assert.equal((await host.run({selection, checkId: validatorId, artifact})).error.code, 'invalid-input');
    const relabeled = clone(selection); relabeled.domain.results = [results[0]];
    assert.equal((await host.runDecision({selection: relabeled, validatorId})).error.code, 'invalid-input');
    assert.equal(server.requests.length, count);
  });

  await t.test('missing grounds, domain failure, unavailable routing and current denial stop before dispatch', async () => {
    const count = server.requests.length, missing = clone(selection);
    Object.assign(missing.slots[2], {status: 'missing', value: null, omissions: ['Source unavailable.']});
    assert.equal((await host.runDecision({selection: missing, validatorId})).error.code, 'not-ready');
    const absentDomain = clone(selection); absentDomain.domain.results = [];
    assert.equal((await host.runDecision({selection: absentDomain, validatorId})).error.code, 'not-ready');
    const route = clone(selection); route.configuration.model.routeDigest = digest('0');
    assert.equal((await host.runDecision({selection: route, validatorId})).error.code, 'denied');
    const tiny = clone(selection); tiny.configuration.limits.modelInputTokens = 1;
    assert.equal((await host.runDecision({selection: tiny, validatorId})).error.code, 'invalid-input');
    allowed = false;
    assert.equal((await host.runDecision({selection, validatorId})).error.code, 'denied');
    allowed = true;
    const controller = new AbortController(); controller.abort();
    assert.equal((await host.runDecision({selection, validatorId}, controller.signal)).error.code, 'operational-error');
    assert.equal(server.requests.length, count);
  });

  await t.test('new surrounding permission selection reuses exact retained evaluation under current authority', async () => {
    const count = server.requests.length, updated = clone(selection); updated.current.permissionDigests.unshift(digest('0'));
    const value = ok(await host.runDecision({selection: updated, validatorId}));
    assert.equal(value.reused, true); assert.equal(value.modelCalls, 0); assert.deepEqual(value.result, results[0]);
    assert.notEqual(observed.selectionDigest, prepared.digest); assert.equal(server.requests.length, count);
  });

  const negative = clone(selection); negative.slots[2].value.push({role: 'counterevidence', body: 'Negative synthetic case.'});
  let falseResult;
  await t.test('changed evidence is assessed once; false feedback survives without resampling', async () => {
    const count = server.requests.length; mode = 'false';
    const value = ok(await host.runDecision({selection: negative, validatorId})); falseResult = value.result;
    assert.equal(value.result.passed, false); assert.equal(value.modelCalls, 1); assert.equal(value.reused, false);
    assert.equal(value.result.feedback.resolution, 'Supply the missing grounds.');
    const reused = ok(await host.runDecision({selection: negative, validatorId}));
    assert.equal(reused.reused, true); assert.equal(reused.modelCalls, 0); assert.deepEqual(reused.result, falseResult);
    assert.equal(server.requests.length, count + 1);
  });

  await t.test('fresh process delivers both true and false records without inference', async () => {
    const count = server.requests.length;
    const script = `import {createPiCheckBackend} from ${JSON.stringify(new URL('../../../src/adapters/pi/check-backend.ts', import.meta.url).href)};
      const host = await createPiCheckBackend({...${JSON.stringify(config)}, authorize:()=>true}); if(!host.ok) throw Error(JSON.stringify(host));
      const results=[]; for(const selection of ${JSON.stringify([selection, negative])}) results.push(await host.value.runDecision({selection,validatorId:${JSON.stringify(validatorId)}}));
      await host.value.dispose(); process.stdout.write(JSON.stringify(results));`;
    const {stdout} = await execute(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {maxBuffer: 65536, timeout: 30000});
    const retained = JSON.parse(stdout).map(ok);
    assert.deepEqual(retained.map(value => [value.result.passed, value.reused, value.modelCalls]), [[true, true, 0], [false, true, 0]]);
    assert.deepEqual(retained[0].result, results[0]); assert.deepEqual(retained[1].result, falseResult);
    assert.equal(server.requests.length, count);
  });

  await t.test('revoked delivery preserves completion, then current authorization permits retained delivery', async () => {
    const updated = clone(selection); updated.slots[2].value.push({role: 'observation', body: 'Revocation case.'});
    const count = server.requests.length; mode = 'revoke';
    assert.equal((await host.runDecision({selection: updated, validatorId})).error.code, 'denied');
    allowed = true; mode = 'pass';
    const retained = ok(await host.runDecision({selection: updated, validatorId}));
    assert.equal(retained.reused, true); assert.equal(retained.modelCalls, 0); assert.equal(server.requests.length, count + 1);
  });

  await t.test('malformed judgment is an operational failure, retained as stopped rather than false or silently retried', async () => {
    const updated = clone(selection); updated.slots[2].value.push({role: 'observation', body: 'Malformed model response case.'});
    const count = server.requests.length; mode = 'invalid';
    assert.equal((await host.runDecision({selection: updated, validatorId})).error.code, 'operational-error');
    mode = 'pass'; assert.equal((await host.runDecision({selection: updated, validatorId})).error.code, 'already-attempted');
    assert.equal(server.requests.length, count + 1);
  });

  await t.test('a host without a verified build or with another build cannot borrow retained backend identity', async () => {
    for (const kernelBuildDigest of [undefined, digest('0')]) {
      const other = ok(await createPiCheckBackend({...config, kernelBuildDigest, authorize: () => true}));
      try {
        const denied = await other.runDecision({selection, validatorId});
        assert.equal(denied.error.code, kernelBuildDigest ? 'denied' : 'unsupported');
      } finally {await other.dispose();}
    }
  });

  await t.test('even a re-encoded domain record with matching input hashes cannot supply backend custody', async () => {
    const path = join(root, 'check-state-v1', '001', 'terminal.json'), terminal = JSON.parse(await readFile(path, 'utf8'));
    const {protocol: _protocol, digest: _digest, owner: _owner, stage: _stage, kernelVersion: _version,
      kernelBuildDigest: _build, definitionDigest: _definition, ...body} = terminal.result;
    terminal.result = ok(createCheckResult(body));
    await writeFile(path, ok(canonicalJson(terminal)));
    const count = server.requests.length;
    assert.equal((await host.runDecision({selection, validatorId})).error.code, 'operational-error');
    assert.equal((await host.runDecision({selection, validatorId})).error.code, 'unsupported');
    assert.equal(server.requests.length, count);
  });
});
