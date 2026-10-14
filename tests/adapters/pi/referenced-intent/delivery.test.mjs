import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { IntentHost } from '../../../../src/adapters/pi/referenced-intent/host.ts';
import { ReviewScreen, POLICY_TEXT } from '../../../../src/adapters/pi/referenced-intent/review.ts';
import { root, fakeChild, configuration, request, lease, nonTui, material, VERSION, canonical } from './helpers.mjs';

const accepted = `{version:'${VERSION}',kind:'accepted',result:{format:'ck-intent-result',version:'${VERSION}',kind:'opened',key:r.request.key,actor:'person-1',fact:{ledger:'ledger-1',change:'change-1',seq:1},previous:null}}`;
const mutation = () => request('open_intent', { key:'friday',instruction:material('Friday'),replacement:{what:material('Friday'),why:null} });
const shutdown = `if(r.kind==='close'){send({bridge:'ck-intent-bridge',id:r.id,kind:'closed'});process.exit(0);}`;

test('fresh disclosure suppresses an actual final accepted frame without rewriting its meaning', async()=>{
  const dir=await root();const exe=await fakeChild(dir,`if(r.kind==='connect')send(connected);else ${shutdown} else setTimeout(()=>send({bridge:'ck-intent-bridge',id:r.id,kind:'reply',value:${accepted}}),100);`);
  const host=new IntentHost();assert.equal(await host.connect(configuration(dir,exe)),undefined);
  try {
    const operation=host.execute('open_intent',mutation(),nonTui);
    host.setAuthorization({...lease,disclose:'deny'});
    const result=await operation;assert.equal(result.kind,'error');assert.equal(result.code,'denied');assert.equal(result.acceptance,'not_established');assert(!('result' in result));
    host.setAuthorization({...lease,mutate:'deny'});
    const retry=await host.execute('open_intent',mutation(),nonTui);assert.equal(retry.kind,'accepted');assert.equal(retry.result.fact.seq,1);
    const wire=(await readFile(join(dir,'wire.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(wire[1].authorization.disclose,'allow');assert.equal(wire[2].authorization.mutate,'deny');assert(wire.slice(1).every(r=>r.kind==='call'));
  } finally {assert(await host.disconnect());}
});

test('post-dispatch abort is transport_unknown; retained final reply is not flattened into rollback',async()=>{
  const dir=await root();const exe=await fakeChild(dir,`if(r.kind==='connect')send(connected);else ${shutdown} else setTimeout(()=>send({bridge:'ck-intent-bridge',id:r.id,kind:'reply',value:${accepted}}),100);`);
  const host=new IntentHost();assert.equal(await host.connect(configuration(dir,exe)),undefined);
  try {
    const c=new AbortController(),operation=host.execute('open_intent',mutation(),nonTui,c.signal);c.abort();
    const result=await operation;assert.deepEqual(result,{version:VERSION,kind:'transport_unknown',reason:'cancelled',acceptance:'not_established'});
    assert.equal((await host.execute('open_intent',mutation(),nonTui)).code,'unavailable');
  } finally {assert(await host.disconnect());}
});

test('unexpected result kind and noncurrent prepared subject fail closed',async()=>{
  for(const value of [
    `{version:'${VERSION}',kind:'retained',material:${JSON.stringify(material('not a result'))}}`,
    `{version:'${VERSION}',kind:'error',code:'unavailable',acceptance:'not_established',extra:true}`,
    accepted.replace('seq:1','seq:2'),
  ]) {
    const dir=await root(),exe=await fakeChild(dir,`if(r.kind==='connect')send(connected);else send({bridge:'ck-intent-bridge',id:r.id,kind:'reply',value:${value}});`),host=new IntentHost();
    assert.equal(await host.connect(configuration(dir,exe)),undefined);
    try { assert.equal((await host.execute('open_intent',mutation(),nonTui)).reason,'protocol'); }
    finally {assert(await host.disconnect());}
  }
  const dir=await root(),exe=await fakeChild(dir,`if(r.kind==='connect')send(connected);else {r.request.key='changed';send({bridge:'ck-intent-bridge',id:r.id,kind:'prepared',input:r.request,presentation:'x'});}`),host=new IntentHost();
  assert.equal(await host.connect(configuration(dir,exe)),undefined);
  try {assert.equal((await host.execute('open_intent',mutation(),{...nonTui,mode:'tui'})).reason,'protocol');}
  finally {assert(await host.disconnect());}
});

test('120 second UI deadline cancels without any affirmative event',t=>{
  t.mock.timers.enable({apis:['setTimeout']});let answer;
  const input=mutation();
  const presentation=canonical({format:'ck-intent-review',input,policy_text:POLICY_TEXT,previous:null,instruction_text:'Friday',what_text:'Friday',why_text:null})+'\n';
  const screen=new ReviewScreen({terminal:{columns:80,rows:20},requestRender(){}},presentation,input,v=>{answer=v});
  screen.render(80);t.mock.timers.tick(119_999);assert.equal(answer,undefined);t.mock.timers.tick(1);assert.equal(answer,false);screen.dispose();
});
