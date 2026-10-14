import test from 'node:test';
import assert from 'node:assert/strict';
import { Bridge } from '../../../../src/adapters/pi/referenced-intent/bridge.ts';
import { root, fakeChild, configuration, VERSION } from './helpers.mjs';

const connectBody = dir => { const c=configuration(dir,'/unused'); return {kind:'connect',mode:c.mode,grant:c.grant,authorization:c.authorization}; };

test('framing failures close without retry, including malformed, duplicate, oversized, partial and wrong identities', async () => {
  for (const [label,behavior,reason] of [
    ['wrong-id','connected.id++;send(connected);','protocol'],
    ['wrong-version',"connected.version='other';send(connected);",'protocol'],
    ['duplicate',`frame('{"bridge":"ck-intent-bridge","id":1,"id":1,"kind":"connected","version":"${VERSION}"}\\n');`,'protocol'],
    ['trailing',`frame(JSON.stringify(connected)+'{}');`,'protocol'],
    ['utf8',"process.stdout.write(Buffer.from([0,0,0,1,255]));",'protocol'],
    ['oversized',"process.stdout.write(Buffer.from([0,4,0,1]));",'protocol'],
    ['empty',"process.stdout.write(Buffer.alloc(4));",'protocol'],
    ['partial',"process.stdout.write(Buffer.from([0,0,0,8,123]));process.exit(0);",'closed'],
    ['extra-field',"connected.extra=true;send(connected);",'protocol'],
    ['two-frames',"const p=Buffer.from(JSON.stringify(connected)+'\\n');const h=Buffer.alloc(4);h.writeUInt32BE(p.length);process.stdout.write(Buffer.concat([h,p,h,p]));",'protocol'],
  ]) {
    const dir=await root(), exe=await fakeChild(dir,behavior), bridge=new Bridge(); bridge.start(exe);
    try { await assert.rejects(bridge.exchange(connectBody(dir)),e=>e.reason===reason,label); assert.equal(bridge.isUsable,false); }
    finally { assert.equal(await bridge.disconnect(),true,label); assert(bridge.exitObserved); }
  }
});

test('split header/payload is supported, stderr is bounded and counted', async () => {
  const dir=await root(); const exe=await fakeChild(dir, `if(r.kind==='close'){send({bridge:'ck-intent-bridge',id:r.id,kind:'closed'});process.exit(0);} else {process.stderr.write(Buffer.alloc(200000,120));const p=Buffer.from(JSON.stringify(connected)+'\\n'),h=Buffer.alloc(4);h.writeUInt32BE(p.length);const all=Buffer.concat([h,p]); let i=0;const t=setInterval(()=>{process.stdout.write(all.subarray(i,i+1));if(++i===all.length)clearInterval(t);},1);}`);
  const bridge=new Bridge(); bridge.start(exe);
  try { assert.equal((await bridge.exchange(connectBody(dir))).kind,'connected'); assert(bridge.stderrDropped>=200000-65536); }
  finally { assert(await bridge.disconnect()); }
});

test('pre-dispatch cancellation sends nothing; post-dispatch timeout/cancellation is unknown, no successor before exit', async () => {
  const dir=await root(); const exe=await fakeChild(dir,'/* deliberately no reply */');
  const bridge=new Bridge(); bridge.start(exe);
  const pre=new AbortController();pre.abort();
  await assert.rejects(bridge.exchange(connectBody(dir),pre.signal),e=>e.reason==='cancelled');
  assert(bridge.isUsable);
  const successor=new Bridge();assert.throws(()=>successor.start(exe),e=>e.reason==='cleanup_unconfirmed');
  await assert.rejects(bridge.exchange(connectBody(dir),undefined,20),e=>e.reason==='timeout');
  assert(!bridge.isUsable);assert(await bridge.disconnect());
  successor.start(exe);
  const post=new AbortController();const pending=successor.exchange(connectBody(dir),post.signal);post.abort();
  await assert.rejects(pending,e=>e.reason==='cancelled');assert(await successor.disconnect());
});

test('shutdown escalates to observed SIGKILL, not successful signal delivery', async () => {
  const dir=await root(); const exe=await fakeChild(dir, `if(r.kind==='connect'){process.removeAllListeners('SIGTERM');process.on('SIGTERM',()=>{});process.stdin.removeAllListeners('end');process.stdin.on('end',()=>{});setInterval(()=>{},1000);send(connected);} /* ignore Close */`);
  const bridge=new Bridge();bridge.start(exe);await bridge.exchange(connectBody(dir));const pid=bridge.pid;
  assert(pid>0);assert.equal(await bridge.disconnect(),true);assert(bridge.exitObserved);
  assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
});

test('simulated unconfirmed signal delivery retains owner exclusion until actual exit',async()=>{
  const dir=await root(),exe=await fakeChild(dir,`if(r.kind==='connect'){process.stdin.removeAllListeners('end');process.stdin.on('end',()=>{});setInterval(()=>{},1000);send(connected);}`);
  const bridge=new Bridge();bridge.start(exe);await bridge.exchange(connectBody(dir));const pid=bridge.pid;
  // Test-only syscall boundary substitution: successful kill() return without observed exit.
  bridge.child.kill=()=>true;
  try{
    assert.equal(await bridge.disconnect(),false);assert.equal(bridge.exitObserved,false);
    assert.throws(()=>new Bridge().start(exe),e=>e.reason==='cleanup_unconfirmed');
  }finally{
    process.kill(pid,'SIGKILL');
    const deadline=Date.now()+2000;
    while(!bridge.exitObserved&&Date.now()<deadline)await new Promise(r=>setTimeout(r,5));
    assert(bridge.exitObserved);
  }
});
