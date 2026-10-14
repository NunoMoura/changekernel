import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, readlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { root, configuration } from './helpers.mjs';

const executable=process.env.CK_PI_TEST_EXECUTABLE, binary=process.env.CK_NATIVE_TEST_BINARY;
test('installed Pi 1.2 RPC loads only explicit host/Codemode; model-free commands and session shutdown release child', {skip:!executable||!binary,timeout:30_000},async()=>{
  const dir=await root();const settings=join(dir,'settings'),sessions=join(dir,'sessions'),home=join(dir,'home');
  await Promise.all([mkdir(settings),mkdir(sessions),mkdir(home)]);
  const config=configuration(dir,binary), configPath=join(dir,'config.json');await writeFile(configPath,JSON.stringify(config));
  const extension=fileURLToPath(new URL('../../../../src/adapters/pi/referenced-intent/index.ts',import.meta.url));
  const tools='codemode,open_intent,revise_intent,retain_text,read_context,read_history,resolve_text,inspect_operation';
  const args=['--mode','rpc','--offline','--no-approve','--no-extensions','--no-mcp','--no-skills','--no-prompt-templates','--no-themes','--no-context-files','--session-dir',sessions,'-e',extension,'-e','builtin:codemode','--tools',tools];
  const pi=spawn(executable,args,{cwd:dir,env:{HOME:home,PATH:process.env.PATH,PI_CODING_AGENT_DIR:settings,PI_TELEMETRY:'0'},stdio:['pipe','pipe','pipe']});
  const records=[],pending=new Map();let text='',stderr='',sequence=0;
  pi.stdout.setEncoding('utf8');pi.stdout.on('data',chunk=>{
    text+=chunk;let at;
    while((at=text.indexOf('\n'))>=0){const line=text.slice(0,at);text=text.slice(at+1);if(!line)continue;const r=JSON.parse(line);records.push(r);if(r.type==='response'&&pending.has(r.id)){pending.get(r.id)(r);pending.delete(r.id);}}
  });
  pi.stderr.setEncoding('utf8');pi.stderr.on('data',chunk=>{stderr+=chunk;});
  let exit;
  const closed=new Promise(resolve=>pi.once('close',(code,signal)=>{exit={code,signal};resolve(exit);}));
  async function command(type,fields={}){
    const id=String(++sequence);let timer;
    try{return await Promise.race([new Promise(resolve=>{pending.set(id,resolve);pi.stdin.write(JSON.stringify({id,type,...fields})+'\n');}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`RPC timeout ${type}: ${stderr}`)),10_000);})]);}
    finally{clearTimeout(timer);pending.delete(id);}
  }
  async function nativeChildren(){
    const ids=(await readFile(`/proc/${pi.pid}/task/${pi.pid}/children`,'utf8')).trim().split(/\s+/).filter(Boolean);
    const matches=[];
    for(const id of ids){try{if(await readlink(`/proc/${id}/exe`)===binary)matches.push(Number(id));}catch{}}
    return matches;
  }
  const nativePids=[];
  try{
    const commands=await command('get_commands');assert.equal(commands.success,true);
    assert(commands.data.commands.some(c=>c.name==='ck-connect'),stderr);
    const connect=await command('prompt',{message:`/ck-connect ${configPath}`});assert.equal(connect.data.disposition,'handled');
    assert(records.some(r=>r.method==='notify'&&r.message==='ChangeKernel 0.5.0-prototype.1 connected. No intent adopted.'),JSON.stringify(records));
    const children=await nativeChildren();assert.equal(children.length,1);nativePids.push(...children);
    const replace=await command('new_session');assert.equal(replace.success,true);assert.equal(replace.data.cancelled,false);
    assert.throws(()=>process.kill(children[0],0),e=>e.code==='ESRCH');
    await writeFile(configPath,JSON.stringify({...config,mode:'reopen'}));
    const reconnect=await command('prompt',{message:`/ck-connect ${configPath}`});assert.equal(reconnect.data.disposition,'handled');
    const successors=await nativeChildren();assert.equal(successors.length,1);nativePids.push(...successors);
    pi.stdin.end();let timer;
    try{await Promise.race([closed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Pi exit timeout')),10_000);})]);}finally{clearTimeout(timer);}
    assert.equal(exit.code,0,stderr);
    for(const pid of nativePids)assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
    assert(!records.some(r=>['agent_start','message_start','message_update'].includes(r.type)),'No model run permitted');
    console.log(`Pi evidence ${dir}; Pi pid ${pi.pid}; native pids ${nativePids.join(',')}; all exits observed`);
  }finally{
    if(!exit){pi.stdin.end();pi.kill('SIGTERM');await closed;}
    await writeFile(join(dir,'rpc-evidence.json'),JSON.stringify({executable,args,piPid:pi.pid,nativePids,exit,records,stderr},null,2));
  }
});
