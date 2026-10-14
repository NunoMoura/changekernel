import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createCodemodeExtension } from '@earendil-works/pi-coding-agent';
import extension from '../../../../src/adapters/pi/referenced-intent/index.ts';
import { CompositionBudget, CompositionLimit, Compositions } from '../../../../src/adapters/pi/referenced-intent/composition.ts';
import { root, fakeChild, configuration, request, material, fact, VERSION, nonTui } from './helpers.mjs';

async function harness(behavior) {
  const tools=new Map(),commands=new Map(),events=new Map();
  const pi={registerTool:t=>tools.set(t.name,t),registerCommand:(n,c)=>commands.set(n,c),on:(n,h)=>{events.set(n,[...(events.get(n)??[]),h]);},getAllTools:()=>[...tools.values()],getSettings:()=>({}),appendEntry(){}};
  extension(pi);createCodemodeExtension({models:false})(pi);
  const emit=async(n,e)=>{for(const h of events.get(n)??[])await h(e,nonTui);};
  const dir=await root(),exe=await fakeChild(dir,behavior),path=join(dir,'config.json');
  await writeFile(path,JSON.stringify(configuration(dir,exe)));
  const notices=[];await commands.get('ck-connect').handler(path,{...nonTui,ui:{notify:m=>notices.push(m)}});
  assert(notices.some(n=>n.includes('connected. No intent adopted.')),JSON.stringify(notices));
  let generation=0;
  return {dir, async script(code){
    const rootId=`opaque/root-${++generation}`;let child=0;
    await emit('tool_call',{toolName:'codemode',toolCallId:rootId,input:{code}});
    try{
      const result=await tools.get('codemode').execute(rootId,{code},undefined,undefined,{
        ...nonTui,tools:[...tools.values()],sessionManager:{getBranch:()=>[]},
        async executeTool(name,args,{signal}){
          const id=`${rootId}/${++child}`;
          await emit('tool_call',{toolName:name,toolCallId:id,parentToolCallId:rootId,input:args});
          try{const result=await tools.get(name).execute(id,args,signal,undefined,nonTui);return {toolCall:{id,name,arguments:args},result,isError:result.isError};}
          finally{await emit('tool_execution_end',{toolName:name,toolCallId:id,parentToolCallId:rootId});}
        },
      });
      assert(!result.isError,JSON.stringify(result));
      return result.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
    }finally{await emit('tool_execution_end',{toolName:'codemode',toolCallId:rootId});}
  }, async close(){await emit('session_shutdown',{});}};
}
const shut=`if(r.kind==='close'){send({bridge:'ck-intent-bridge',id:r.id,kind:'closed'});process.exit(0);}`;

test('actual built-in Codemode sandbox: 65 sequential history calls share one budget; new script resumes exact coverage',async()=>{
  const ref=material('text');
  const h=await harness(`if(r.kind==='connect')send(connected);else ${shut} else {
    const seq=r.request.after+1;const fact=n=>({ledger:'ledger-1',change:'change-1',seq:n});
    const input={version:'${VERSION}',op:seq===1?'open_intent':'revise_intent',ledger:'ledger-1',change:'change-1',key:'key-'+seq,...(seq===1?{}:{expected:fact(seq-1)}),instruction:${JSON.stringify(ref)},replacement:{what:${JSON.stringify(ref)},why:null}};
    send({bridge:'ck-intent-bridge',id:r.id,kind:'reply',value:{version:'${VERSION}',kind:'history',tip:fact(128),through:fact(128),records:[{version:'${VERSION}',custody:'custody-1',seq,prev:seq===1?null:fact(seq-1),input,approval:${JSON.stringify(ref)}}],coverage:{first:seq,last:seq},next_after:seq<128?seq:null,readiness:[]}});
  }`);
  try{
    const page=request('read_history',{through:fact(128),after:0,limit:1});
    const result=await h.script(`let after=0,count=0;for(let i=0;i<65;i++){const r=await tools.read_history({...${JSON.stringify(page)},after});if(r.kind==='error'){text({count,after,code:r.code});return;}count++;after=r.next_after;}throw Error('65th escaped budget');`);
    assert.match(result,/"count":64/);assert.match(result,/"after":64/);assert.match(result,/"code":"unsupported"/);
    let wire=(await readFile(join(h.dir,'wire.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.equal(wire.length,65);
    const next=await h.script(`const r=await tools.read_history(${JSON.stringify({...page,after:64})});text({kind:r.kind,first:r.coverage.first,through:r.through.seq,next:r.next_after});`);
    assert.match(next,/"first":65/);assert.match(next,/"through":128/);assert.match(next,/"next":65/);
    wire=(await readFile(join(h.dir,'wire.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.equal(wire.length,66);assert.equal(wire.at(-1).request.after,64);
  }finally{await h.close();}
});

test('actual Codemode sandbox: aggregate returned encoded bytes stop before 8 MiB, not 64 separately reset limits',async()=>{
  const text='\u0001'.repeat(40_000),ref=material(text);
  const h=await harness(`if(r.kind==='connect')send(connected);else ${shut} else send({bridge:'ck-intent-bridge',id:r.id,kind:'reply',value:{version:'${VERSION}',kind:'resolved',material:${JSON.stringify(ref)},text:${JSON.stringify(text)}}});`);
  try{
    const r=request('resolve_text',{material:ref});
    const result=await h.script(`let count=0;for(let i=0;i<64;i++){const r=await tools.resolve_text(${JSON.stringify(r)});if(r.kind==='error'){text({count,code:r.code});return;}count++;}throw Error('byte budget escaped');`);
    assert.match(result,/"count":34/);assert.match(result,/"code":"unsupported"/);
    const wire=(await readFile(join(h.dir,'wire.jsonl'),'utf8')).trim().split('\n');assert.equal(wire.length,35);
    const next=await h.script(`const r=await tools.resolve_text(${JSON.stringify(r)});text(r.kind);`);assert.match(next,/resolved/);
  }finally{await h.close();}
});

test('shared monotonic native-time budget, conservative byte reservation, and opaque Pi parentage',()=>{
  const registry=new Compositions();registry.begin('root/with/slashes');registry.begin('unrelated-child-id','root/with/slashes');
  const budget=registry.get('root/with/slashes');assert.equal(budget,registry.get('unrelated-child-id'));
  assert.equal(budget.begin(),30_000);budget.finish(29_000,100);assert.equal(budget.begin(),30_000);budget.finish(30_000,100);assert.equal(budget.begin(),1000);budget.finish(1000,100);
  assert.throws(()=>budget.begin(),CompositionLimit);registry.end('unrelated-child-id');registry.end('root/with/slashes');
  registry.begin('continuation');assert.equal(registry.get('continuation').begin(),30_000);
  registry.begin('orphan','absent');assert.equal(registry.get('orphan'),undefined);
  const bytes=new CompositionBudget();bytes.returnedBytes=8_388_608-262_144+1;assert.throws(()=>bytes.begin(),CompositionLimit);
});
