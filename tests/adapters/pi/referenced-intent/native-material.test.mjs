import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentHost } from '../../../../src/adapters/pi/referenced-intent/host.ts';
import { root, configuration, request, fact, nonTui, withSimulatedTui, canonical } from './helpers.mjs';
const binary=process.env.CK_NATIVE_TEST_BINARY;
test('native larger generated text round-trips exact recovery ingress, without larger source admission (SIMULATED UI)',{skip:!binary},async()=>{
  const dir=await root(),host=new IntentHost();assert.equal(await host.connect(configuration(dir,binary)),undefined);
  try{
    const source=await host.execute('retain_text',request('retain_text',{text:'x'.repeat(4096)}),nonTui);assert.equal(source.kind,'retained');
    await withSimulatedTui(async ctx=>{
      const opened=await host.execute('open_intent',request('open_intent',{key:'large-review',instruction:source.material,replacement:{what:source.material,why:null}}),ctx);assert.equal(opened.kind,'accepted',JSON.stringify(opened));
    });
    const context=await host.execute('read_context',request('read_context',{at:null}),nonTui);assert.equal(context.kind,'context');
    const receipt=await host.execute('resolve_text',request('resolve_text',{material:context.approval}),nonTui);assert.equal(receipt.kind,'resolved');
    const presentation=JSON.parse(receipt.text).presentation;
    const resolved=await host.execute('resolve_text',request('resolve_text',{material:presentation}),nonTui);assert.equal(resolved.kind,'resolved');assert(Buffer.byteLength(resolved.text)>4096);
    const retry=await host.execute('retain_text',request('retain_text',{text:resolved.text}),nonTui);assert.equal(retry.kind,'retained',JSON.stringify(retry));assert.equal(canonical(retry.material),canonical(presentation));
    const absent=JSON.parse(resolved.text);absent.input.key='not-already-retained';
    const newLarge=await host.execute('retain_text',request('retain_text',{text:canonical(absent)+'\n'}),nonTui);assert.equal(newLarge.code,'unsupported',JSON.stringify(newLarge));
    await withSimulatedTui(async(ctx,reviews)=>{
      const oversized=await host.execute('revise_intent',request('revise_intent',{key:'oversized-source',expected:fact(1),instruction:source.material,replacement:{what:presentation,why:null}}),ctx);assert.equal(oversized.code,'unsupported',JSON.stringify(oversized));assert.equal(reviews(),0);
    });
    assert.equal((await host.execute('read_context',request('read_context',{at:null}),nonTui)).at.seq,1);
  }finally{assert(await host.disconnect());}
});
