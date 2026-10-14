import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { IntentHost } from '../../../../src/adapters/pi/referenced-intent/host.ts';
import { root, configuration, request, fact, lease, nonTui, withSimulatedTui, drive } from './helpers.mjs';

const binary=process.env.CK_NATIVE_TEST_BINARY;
test('real native btrfs Friday/Saturday, exit/new owner/reopen, Sunday, original Saturday retrieval (SIMULATED UI)', {skip:!binary}, async () => {
  const dir=await root(), config=configuration(dir,binary), host=new IntentHost();
  assert.equal(await host.connect(config),undefined);
  const pids=[host.childPid];
  let saturday;
  const retain=async (h,text) => {
    const r=await h.execute('retain_text',request('retain_text',{text}),nonTui);
    assert.equal(r.kind,'retained',JSON.stringify(r));return r.material;
  };
  try {
    assert.equal((await host.execute('read_context',request('read_context',{at:null}),nonTui)).at,null);
    const friday=await retain(host,'Organize dinner Friday');
    const open=request('open_intent',{key:'friday-1',instruction:friday,replacement:{what:friday,why:null}});
    assert.equal((await host.execute('open_intent',open,nonTui)).code,'unavailable');
    await withSimulatedTui(async (ctx,reviews)=>{
      const opened=await host.execute('open_intent',open,ctx);assert.equal(opened.kind,'accepted',JSON.stringify(opened));assert.equal(opened.result.fact.seq,1);
      const instruction=await retain(host,'Move dinner to Saturday');const what=await retain(host,'Organize dinner Saturday');
      saturday=request('revise_intent',{key:'saturday-1',expected:fact(1),instruction,replacement:{what,why:null}});
      // Sender retains exact original request outside custody before dispatch.
      await writeFile(join(dir,'saturday-request.json'),JSON.stringify(saturday)+'\n');
      const r=await host.execute('revise_intent',saturday,ctx);assert.equal(r.kind,'accepted',JSON.stringify(r));assert.equal(r.result.fact.seq,2);assert.equal(reviews(),2);
      host.setAuthorization({...lease,mutate:'deny'});
      const retry=await host.execute('revise_intent',saturday,ctx);assert.deepEqual(retry,r);assert.equal(reviews(),2);
    });
  } finally {assert(await host.disconnect());assert(host.exitObserved);}
  const reopened=new IntentHost();assert.equal(await reopened.connect({...config,mode:'reopen'}),undefined);pids.push(reopened.childPid);
  try {
    const history=await reopened.execute('read_history',request('read_history',{through:null,after:0,limit:8}),nonTui);
    assert.equal(history.kind,'history',JSON.stringify(history));assert.equal(history.records.length,2);assert.equal(history.next_after,null);
    for(const record of history.records) {
      const receipt=await reopened.execute('resolve_text',request('resolve_text',{material:record.approval}),nonTui);assert.equal(receipt.kind,'resolved');
      const grounds=JSON.parse(receipt.text);
      const review=await reopened.execute('resolve_text',request('resolve_text',{material:grounds.presentation}),nonTui);assert.equal(review.kind,'resolved');assert.equal(JSON.parse(review.text).input.key,record.input.key);
    }
    await withSimulatedTui(async(ctx,reviews)=>{
      const instruction=await retain(reopened,'Move dinner to Sunday'), what=await retain(reopened,'Organize dinner Sunday');
      const sunday=request('revise_intent',{key:'sunday-1',expected:fact(2),instruction,replacement:{what,why:null}});
      const r=await reopened.execute('revise_intent',sunday,ctx);assert.equal(r.kind,'accepted',JSON.stringify(r));assert.equal(r.result.fact.seq,3);
      const empty=await retain(reopened,'');
      assert.equal((await reopened.execute('revise_intent',{...saturday,replacement:{...saturday.replacement,why:empty}},ctx)).code,'conflict');
      assert.equal((await reopened.execute('revise_intent',{...sunday,key:'stale',expected:fact(1)},ctx)).code,'conflict');
      assert.equal(reviews(),1);
      const before=await readFile(join(dir,'slot','trace.jsonl'));
      reopened.setAuthorization({...lease,mutate:'deny'});
      const original=await reopened.execute('inspect_operation',request('inspect_operation',{key:'saturday-1'}),nonTui);
      assert.equal(original.status,'accepted');assert.equal(original.result.fact.seq,2);assert.equal(original.result.previous.seq,1);assert.equal(original.result.actor,'person-1');
      assert.equal((await reopened.execute('revise_intent',saturday,ctx)).result.fact.seq,2);assert.equal(reviews(),1);
      const current=await reopened.execute('read_context',request('read_context',{at:null}),nonTui);assert.equal(current.at.seq,3);
      assert.deepEqual(await readFile(join(dir,'slot','trace.jsonl')),before);
    });
  } finally {assert(await reopened.disconnect());assert(reopened.exitObserved);}
  await writeFile(join(dir,'process-evidence.json'),JSON.stringify({pids,exitsObserved:true,approval:'SIMULATED, not human adoption',binary},null,2));
  console.log(`native evidence ${dir}; child pids ${pids.join(',')}; both exits observed`);
});

test('native cancelled review and lease change discard; input frozen through simulated adoption', {skip:!binary}, async()=>{
  const dir=await root(),host=new IntentHost();assert.equal(await host.connect(configuration(dir,binary)),undefined);
  try {
    const retained=await host.execute('retain_text',request('retain_text',{text:'Friday \u0001 é😀'}),nonTui);assert.equal(retained.kind,'retained');
    const open=request('open_intent',{key:'friday',instruction:retained.material,replacement:{what:retained.material,why:null}});
    await withSimulatedTui(async ctx=>{
      assert.equal((await host.execute('open_intent',open,ctx)).code,'unavailable');
    },screen=>screen.handleInput('\x1b'));
    assert.equal((await host.execute('inspect_operation',request('inspect_operation',{key:'friday'}),nonTui)).status,'not_found_now');
    await withSimulatedTui(async ctx=>{
      assert.equal((await host.execute('open_intent',open,ctx)).code,'denied');
    }, (screen,terminal)=>{ host.setAuthorization({...lease,mutate:'deny'}); drive(screen,terminal); });
    assert.equal((await host.execute('inspect_operation',request('inspect_operation',{key:'friday'}),nonTui)).status,'not_found_now');
    host.setAuthorization(lease);
    await withSimulatedTui(async ctx=>{
      const result=await host.execute('open_intent',open,ctx);
      assert.equal(result.kind,'accepted',JSON.stringify(result));assert.equal(result.result.key,'friday');
    }, (screen,terminal)=>{ open.key='changed-after-prepare'; drive(screen,terminal); });
    assert.equal((await host.execute('inspect_operation',request('inspect_operation',{key:'friday'}),nonTui)).status,'accepted');
  } finally {assert(await host.disconnect());}
});
