import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, rm, readFile, writeFile, mkdir, symlink, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import {initializeCheckExecutionLog, openCheckExecutionLog} from '../../../src/adapters/checks/check-execution-log.ts';
import {createCheckResult} from '../../../src/kernel/gates/checks.ts';
import {canonicalJson} from '../../../src/kernel/data-contracts/canonical-json.ts';
import {ok, digest} from '../../kernel/gates/check-fixtures.mjs';
const execute = promisify(execFile);
const binding = {selectionDigest: digest('1'), inputDigest: digest('2'), executionDigest: digest('3'), permissionDigest: digest('4')};
const another = {...binding, inputDigest: digest('5')};
const value = passed => ({result: ok(createCheckResult({checkId: 'cw:check:execution-log', inputDigest: binding.inputDigest, executionDigest: binding.executionDigest,
  producerId: 'changekernel:producer:linux-check-host', status: 'completed', passed, failureKind: passed ? null : 'insufficient-support',
  feedback: {summary: 'Fixture assessment.', where: 'Supplied input', reason: 'Fixture support.', resolution: passed ? null : 'Add missing support.', preserve: ['Retain intent.']}, evidenceDigests: [digest('6')], limitations: []})), dependenciesDigest: digest('7'), modelCalls: 1});
async function directory(t) {const root = await mkdtemp(join(tmpdir(), 'changekernel-execution-log-')); t.after(() => rm(root, {recursive:true, force:true})); return root;}
async function setup(t) {const root = await directory(t), identity = await initializeCheckExecutionLog(root); return {root, identity, executionLog: await openCheckExecutionLog(root, identity)};}
async function freshProcess(root, identity, requested, operation = 'begin') {
  const module = new URL('../../../src/adapters/checks/check-execution-log.ts', import.meta.url).href;
  const script = `import {openCheckExecutionLog} from ${JSON.stringify(module)};
    try {const executionLog = await openCheckExecutionLog(${JSON.stringify(root)}, ${JSON.stringify(identity)});
      const attempt = await executionLog[${JSON.stringify(operation)}](${JSON.stringify(requested)});
      console.log(JSON.stringify({kind:attempt.kind, value:attempt.value}));
    } catch {console.log(JSON.stringify({kind:'blocked'}));}`;
  return JSON.parse((await execute(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {timeout: 10000})).stdout);
}

test('Missing lookups never reserve work, including concurrent fresh-process readers', async t => {
  const {root, identity, executionLog} = await setup(t);
  assert.deepEqual(await executionLog.lookup(binding), {kind:'missing'});
  assert.deepEqual(await Promise.all([freshProcess(root, identity, binding, 'lookup'), freshProcess(root, identity, another, 'lookup')]), [{kind:'missing'},{kind:'missing'}]);
  assert.deepEqual(await readdir(join(root,'check-state-v1')), ['identity.json']);
  const attempt = await executionLog.begin(binding);
  await assert.rejects(executionLog.lookup(binding), /unresolved/);
  await assert.rejects(executionLog.lookup(another), /unresolved/);
  await attempt.finish(value(true));
  const changed = {...binding}, pending = executionLog.lookup(changed);
  changed.permissionDigest = digest('f');
  assert.equal((await pending).kind, 'retained', 'Snapshot lookup bindings before asynchronous inspection');
  await assert.rejects(executionLog.lookup(changed), /Conflicting/);
  assert.equal((await executionLog.lookup({...binding, selectionDigest:digest('f')})).kind, 'retained');
});

test('Renamed execution log opens the existing storage format without rewriting records', async t => {
  const root = await directory(t), identity = digest('a'), state = join(root, 'check-state-v1');
  await mkdir(state, {mode:0o700}); await mkdir(join(state,'000'), {mode:0o700});
  const records = {
    'identity.json': ok(canonicalJson({protocol:'changekernel.check-journal@1.0.0',identity})),
    '000/claim.json': ok(canonicalJson(binding)),
    '000/terminal.json': ok(canonicalJson(value(false))),
  };
  for (const [path,text] of Object.entries(records)) await writeFile(join(state,path), text, {mode:0o600});
  const executionLog = await openCheckExecutionLog(root, identity);
  assert.deepEqual(await executionLog.lookup(binding), {kind:'retained',value:value(false)});
  for (const [path,text] of Object.entries(records)) assert.equal(await readFile(join(state,path),'utf8'),text);
  assert.deepEqual(await readdir(root), ['check-state-v1']);
});

test('Check execution log provisioning is explicit, exclusive and identity-pinned', async t => {
  const root = await directory(t);
  await assert.rejects(openCheckExecutionLog(root, digest('a')));
  const identity = await initializeCheckExecutionLog(root);
  await assert.rejects(initializeCheckExecutionLog(root));
  await assert.rejects(openCheckExecutionLog(root, digest('a')));
  await openCheckExecutionLog(root, identity);
  await rm(join(root, 'check-state-v1'), {recursive:true});
  await assert.rejects(openCheckExecutionLog(root, identity));
});

for (const passed of [true, false]) test(`Fresh processes retain completed ${passed} outcomes without another reservation`, async t => {
  const {root, identity, executionLog} = await setup(t);
  const attempt = await executionLog.begin(binding); assert.equal(attempt.kind, 'claimed');
  assert.deepEqual(JSON.parse(await readFile(join(root, 'check-state-v1/000/claim.json'), 'utf8')), binding);
  const result = value(passed); await attempt.finish(result);
  await assert.rejects(attempt.finish(result));
  const reopened = await freshProcess(root, identity, binding);
  assert.equal(reopened.kind, 'retained'); assert.deepEqual(reopened.value, result);
  assert.deepEqual(await freshProcess(root, identity, binding, 'lookup'), reopened);
  assert.deepEqual(await executionLog.lookup(another), {kind:'missing'});
  assert.deepEqual((await readdir(join(root,'check-state-v1'))).sort(), ['000','identity.json']);
  assert.equal((await executionLog.begin(another)).kind, 'claimed');
});

test('Stopped operational failures remain failures, never cached false judgments or retries', async t => {
  const {root, identity, executionLog} = await setup(t);
  await (await executionLog.begin(binding)).finish(null);
  assert.deepEqual(await freshProcess(root, identity, binding), {kind:'retained', value:null});
  assert.deepEqual(await executionLog.lookup(binding), {kind:'retained', value:null});
  assert.equal((await executionLog.begin(another)).kind, 'claimed');
});

test('A process exiting after reservation blocks both replay and unrelated launches', async t => {
  const {root, identity} = await setup(t);
  assert.equal((await freshProcess(root, identity, binding)).kind, 'claimed');
  assert.equal((await freshProcess(root, identity, binding)).kind, 'blocked');
  assert.equal((await freshProcess(root, identity, another)).kind, 'blocked');
});

test('Independent competing processes can reserve only one next execution', async t => {
  const {root, identity} = await setup(t);
  const outcomes = await Promise.all([freshProcess(root, identity, binding), freshProcess(root, identity, another)]);
  assert.deepEqual(outcomes.map(value => value.kind).sort(), ['blocked', 'claimed']);
});

test('Retained evaluations allow newly authorized selections, not different execution or permission bindings', async t => {
  const {root, identity, executionLog} = await setup(t);
  await (await executionLog.begin(binding)).finish(value(true));
  assert.equal((await freshProcess(root, identity, {...binding, selectionDigest:digest('f')})).kind, 'retained');
  assert.deepEqual(JSON.parse(await readFile(join(root,'check-state-v1/000/claim.json'),'utf8')),binding, 'Original authorization provenance is unchanged');
  for (const key of ['executionDigest', 'permissionDigest']) {
    assert.equal((await freshProcess(root, identity, {...binding, [key]:digest('f')})).kind, 'blocked');
  }
});

test('Full custody stops instead of evicting attempts or reopening failed executions', async t => {
  const {root, executionLog} = await setup(t);
  for (let i=0;i<256;i++) {
    const path=join(root,'check-state-v1',String(i).padStart(3,'0')); await mkdir(path,{mode:0o700});
    await writeFile(join(path,'claim.json'),ok(canonicalJson({...binding,inputDigest:`sha256:${i.toString(16).padStart(64,'0')}`})),{mode:0o600});
    await writeFile(join(path,'terminal.json'),'null',{mode:0o600});
  }
  assert.deepEqual(await executionLog.lookup(binding), {kind:'missing'});
  assert.deepEqual(await executionLog.lookup({...binding,inputDigest:`sha256:${'0'.repeat(64)}`}), {kind:'retained',value:null});
  assert.equal((await readdir(join(root,'check-state-v1'))).length,257);
  await assert.rejects(executionLog.begin(binding), /full/);
  assert.deepEqual(await executionLog.begin({...binding,inputDigest:`sha256:${'0'.repeat(64)}`}),{kind:'retained',value:null});
});

test('Completion publication failure preserves the blocking reservation', async t => {
  const {root, identity, executionLog} = await setup(t), attempt = await executionLog.begin(binding);
  await mkdir(join(root, 'check-state-v1/000/terminal.json'), {mode:0o700});
  await assert.rejects(attempt.finish(value(true)));
  assert.equal((await freshProcess(root, identity, binding)).kind, 'blocked');
  assert.equal((await freshProcess(root, identity, another)).kind, 'blocked');
});

for (const damage of ['empty-slot', 'gap', 'partial', 'foreign-claim', 'bad-result', 'oversize', 'symlink', 'invalid-utf8']) test(`Corrupt state (${damage}) cannot authorize recomputation`, async t => {
  const {root, identity, executionLog} = await setup(t), state = join(root, 'check-state-v1');
  if (damage === 'empty-slot' || damage === 'gap') await mkdir(join(state, damage === 'gap' ? '001' : '000'), {mode:0o700});
  else {
    let completion = value(true);
    if (damage === 'invalid-utf8') {
      const {protocol: _protocol, digest: _digest, ...fields} = completion.result;
      completion = {...completion, result:ok(createCheckResult({...fields, feedback:{...fields.feedback, reason:'\uFFFD'}}))};
    }
    await (await executionLog.begin(binding)).finish(completion);
    const terminal = join(state, '000/terminal.json');
    if (damage === 'invalid-utf8') {
      const bytes=await readFile(terminal), position=bytes.indexOf(Buffer.from('\uFFFD'));
      assert.ok(position>=0);
      // Lossy decoding would preserve the semantic digest while concealing corruption.
      await writeFile(terminal, Buffer.concat([bytes.subarray(0,position),Buffer.from([0x80]),bytes.subarray(position+3)]), {mode:0o600});
    }
    if (damage === 'partial') await writeFile(terminal, '{', {mode:0o600});
    if (damage === 'foreign-claim') await writeFile(join(state, '000/claim.json'), ok(canonicalJson(another)), {mode:0o600});
    if (damage === 'bad-result') await writeFile(terminal, ok(canonicalJson({...value(true), result:{...value(true).result, passed:false}})), {mode:0o600});
    if (damage === 'oversize') await writeFile(terminal, 'x'.repeat(131073), {mode:0o600});
    if (damage === 'symlink') {const copy=join(root,'copy'); await writeFile(copy, await readFile(terminal), {mode:0o600}); await rm(terminal); await symlink(copy,terminal);}
  }
  await assert.rejects(executionLog.lookup(binding));
  await assert.rejects(executionLog.lookup(another));
  assert.equal((await freshProcess(root, identity, binding)).kind, 'blocked');
  assert.equal((await freshProcess(root, identity, another)).kind, 'blocked');
});
