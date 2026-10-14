import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { IntentHost } from '../../../../src/adapters/pi/referenced-intent/host.ts';
import extension from '../../../../src/adapters/pi/referenced-intent/index.ts';
import { checked, requests, outputs, valid } from '../../../../src/adapters/pi/referenced-intent/schema.ts';
import { cloneInput, parseJson, canonical } from '../../../../src/adapters/pi/referenced-intent/codec.ts';
import { ReviewScreen, byteLines, POLICY_TEXT, validatePresentation } from '../../../../src/adapters/pi/referenced-intent/review.ts';
import { root, fakeChild, configuration, request, material, nonTui, drive, lease } from './helpers.mjs';

const normal = `if(r.kind==='connect') send(connected); else if(r.kind==='close') {send({bridge:'ck-intent-bridge',id:r.id,kind:'closed'}); process.exit(0);} else send(error);`;

test('closed ingress, Unicode, canonical JSON and immutable subject', () => {
  const r = request('retain_text', { text: '\u0000é😀\\\"' });
  const frozen = checked(requests.retain_text, r); r.text = 'changed';
  assert.equal(frozen.text, '\u0000é😀\\\"'); assert(Object.isFrozen(frozen));
  assert.equal(canonical(parseJson(Buffer.from(canonical(frozen)))), canonical(frozen));
  for (const bad of ['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '1.0', '-0', '1e2', '{}{}', '[1,]', '"\\ud800"', '\ufeff{}']) assert.throws(() => parseJson(Buffer.from(bad)));
  assert.throws(() => parseJson(Buffer.from([0xff])));
  for (const field of ['actor', 'receipt', 'approval', 'authorization', 'confirmed', 'grant']) assert.throws(() => checked(requests.retain_text, { ...r, [field]: true }));
  assert.throws(() => cloneInput(Object.defineProperty({}, 'text', { enumerable: true, get() { throw new Error('must not invoke getter'); } })));
  assert.throws(() => checked(requests.retain_text, { ...r, text: '\ud800' }));
  assert.throws(() => checked(requests.read_history, request('read_history', { through: null, after: 0, limit: 9 })));
  assert.equal(checked(requests.retain_text, request('retain_text', { text: 'x'.repeat(65_536) })).text.length, 65_536);
});

test('seven typed tools only; factory does not spawn; matching structured error', async () => {
  const tools = [], events = {}, commands = {};
  extension({ registerTool(t) { tools.push(t); }, registerCommand(n,c) { commands[n]=c; }, on(n,h) { events[n]=h; } });
  assert.deepEqual(tools.map(t => t.name).sort(), Object.keys(requests).sort());
  assert.equal(tools.length, 7);
  for (const t of tools) {
    assert.equal(t.parameters, requests[t.name]); assert.equal(t.outputSchema, outputs[t.name]);
    const result = await t.execute('id', {}, undefined, undefined, nonTui);
    assert.equal(result.isError, true); assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    assert.deepEqual(result.details, result.structuredContent); assert(valid(t.outputSchema, result.structuredContent));
  }
  await events.session_shutdown(); await events.session_shutdown();
  assert(!tools.some(t => /prepare|confirm|grant|lease/i.test(t.name)));
});

test('exact byte view never interprets controls and preserves complete tokens', () => {
  const raw = Buffer.from('quote" slash\\\n\u0000\x1b[31m é😀\u202e');
  for (const width of [8, 12, 40, 80]) {
    const lines = byteLines(raw, width);
    assert(lines.every(l => /^[\x20-\x7e]*$/.test(l) && l.length <= width));
    const encoded = lines.map(l => l.slice(2, -2)).join('');
    const decoded = [];
    for (let i=0;i<encoded.length;i++) {
      if (encoded[i] !== '\\') decoded.push(encoded.charCodeAt(i));
      else if (encoded[i+1] === 'x') { decoded.push(parseInt(encoded.slice(i+2,i+4),16)); i+=3; }
      else decoded.push(encoded.charCodeAt(++i));
    }
    assert.deepEqual(Buffer.from(decoded), raw);
  }
});

const input = request('open_intent', { key:'friday', instruction:material('Instruction'), replacement:{what:material('Friday'),why:null} });
const presentation = canonical({ format:'ck-intent-review', input, policy_text:POLICY_TEXT, previous:null, instruction_text:'Instruction', what_text:'Friday', why_text:null })+'\n';

test('production component requires traversal then separate selection, defaults to cancel', () => {
  validatePresentation(presentation, input);
  assert.throws(() => validatePresentation(presentation.replace('Friday', 'Sunday'), input));
  const revise=request('revise_intent',{key:'saturday',expected:{ledger:'ledger-1',change:'change-1',seq:1},instruction:input.instruction,replacement:input.replacement});
  const previous={fact:revise.expected,what_text:'Thursday',why_text:''};
  const revisionReview=canonical({...JSON.parse(presentation),input:revise,previous})+'\n';
  validatePresentation(revisionReview,{...revise,expected:{seq:1,change:'change-1',ledger:'ledger-1'}});
  const terminal={columns:80,rows:20}, tui={terminal, requestRender(){}};
  let answer;
  const screen=new ReviewScreen(tui,presentation,input,v=>{answer=v});
  screen.render(80); screen.handleInput('\x1b[B'); screen.handleInput('\r'); assert.equal(answer,undefined);
  drive(screen,terminal); assert.equal(answer,true); screen.dispose();
  answer=undefined;
  const cancelled=new ReviewScreen(tui,presentation,input,v=>{answer=v});
  drive(cancelled,terminal,'cancel'); assert.equal(answer,false);
});

test('resize, incomplete traversal, abort, narrow layout and close cancel', () => {
  for (const cause of ['resize','incomplete','abort','narrow','dispose']) {
    const terminal={columns:80,rows:20}; const controller=new AbortController(); let answer;
    const screen=new ReviewScreen({terminal,requestRender(){}},presentation,input,v=>{answer=v},controller.signal);
    screen.render(80);
    if(cause==='resize') {terminal.columns=81;screen.render(81);}
    if(cause==='incomplete') screen.handleInput('\x1b');
    if(cause==='abort') controller.abort();
    if(cause==='narrow') screen.render(20);
    if(cause==='dispose') screen.dispose();
    assert.equal(answer,false,cause); screen.dispose();
  }
});

test('busy ingress has no hidden queue; lease changes apply before final disclosure', async () => {
  const dir=await root(); const exe=await fakeChild(dir, `if(r.kind==='connect') send(connected); else if(r.kind==='close'){send({bridge:'ck-intent-bridge',id:r.id,kind:'closed'});process.exit(0);} else setTimeout(()=>send(error),100);`);
  const host=new IntentHost(); assert.equal(await host.connect(configuration(dir,exe)),undefined);
  try {
    const pending=host.execute('inspect_operation',request('inspect_operation',{key:'one'}),nonTui);
    assert.equal((await host.execute('inspect_operation',request('inspect_operation',{key:'two'}),nonTui)).code,'unavailable');
    host.setAuthorization({...lease,disclose:'deny'});
    assert.equal((await pending).code,'denied');
    const lines=(await readFile(join(dir,'wire.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(lines.length,2); assert.equal(lines[1].authorization.disclose,'allow');
    assert.equal((await host.execute('inspect_operation',request('inspect_operation',{key:'three'}),nonTui)).code,'denied');
  } finally { assert.equal(await host.disconnect(),true); assert(host.exitObserved); }
});

test('failed startup never exposes native calls, and explicit predecessor exit precedes reconnect', async () => {
  const dir=await root(); const exe=await fakeChild(dir, 'send(error);');
  const host=new IntentHost(); assert.equal((await host.connect(configuration(dir,exe))).code,'unavailable');
  assert.equal((await host.execute('read_context',request('read_context',{at:null}),nonTui)).code,'unavailable');
  assert.equal((await host.connect(configuration(dir,exe))).reason,'cleanup_unconfirmed');
  const shutdown=host.disconnect(); assert.equal(host.disconnect(),shutdown); assert(await shutdown); assert(host.exitObserved);
  const good=await root(); const second=await fakeChild(good,normal);
  assert.equal(await host.connect(configuration(good,second)),undefined); assert(await host.disconnect());
});
