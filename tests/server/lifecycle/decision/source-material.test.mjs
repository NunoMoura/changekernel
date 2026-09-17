import assert from 'node:assert/strict';
import test from 'node:test';
import {rm} from 'node:fs/promises';
import {readDecisionSourceMaterial} from '../../../../src/server/lifecycle/decision/source-material.ts';
import {failure, success} from '../../../../src/kernel/data-contracts/outcome.ts';
import {productError} from '../../../../src/api/transport/envelope.ts';
import {fixture, server, accepted, decisionConfiguration, decisionInput, stableState, writes, git, REF} from '../../commands/profile-fixtures.mjs';

async function setup(t, algorithm = 'sha1', options = {}) {
  const subject = await fixture(algorithm, {'notes/e\u0301.markdown':'\ufeff# Source e\u0301\r\n', 'asset.bin':'uninterpreted'});
  t.after(() => rm(subject.root, {recursive:true,force:true}));
  accepted(await server(subject).call('changes.propose-profile', subject.input));
  const instance = server(subject, {capabilities:['decision.evaluate'], ...options});
  return {subject, instance, input:decisionInput(subject), configuration:decisionConfiguration(instance)};
}

for (const algorithm of ['sha1','sha256']) test(`Decision source assembly ${algorithm}: exact stored proposal and full bodies, no effects or invented readiness`, async t => {
  const {subject,instance,input,configuration} = await setup(t, algorithm);
  const before = await stableState(subject.root); let authorizations = 0;
  const result = await readDecisionSourceMaterial(instance.store, configuration, request => {
    authorizations++; assert.deepEqual(request,input); assert(Object.isFrozen(request)); return success(instance.actor);
  }, input);
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(authorizations,3);
  assert.deepEqual(result.value.containing.commit,input.expectedChangeTip);
  assert.deepEqual(result.value.project.commit,input.expectedProjectHead);
  assert.deepEqual(result.value.after.snapshot.commit,subject.afterCommit);
  assert.equal(result.value.reduced.change.changeId,input.changeId);
  for (const side of ['before','after']) {
    assert.equal(result.value[side].corpus.documents.find(d=>d.path==='notes/e\u0301.markdown').text,'\ufeff# Source e\u0301\r\n');
    assert(result.value[side].corpus.exclusions.some(d=>d.path==='asset.bin'));
  }
  assert.equal('passed' in result.value,false); assert.equal('effectsComplete' in result.value,false);
  assert.equal('domain' in result.value,false);
  assert.deepEqual(writes(instance),[]); assert.deepEqual(await stableState(subject.root),before);
});

for (const stage of [1,2,3]) test(`Decision source assembly rejects revoked authority at boundary ${stage}`, async t => {
  const {instance,input,configuration} = await setup(t); let calls = 0;
  const denied = productError('authorization_denied','Revoked.','Refresh access.',true);
  const result = await readDecisionSourceMaterial(instance.store,configuration,()=>++calls===stage?failure(denied):success(instance.actor),input);
  assert.equal(result.ok,false); assert.equal(result.error.code,'authorization_denied'); assert.equal(calls,stage);
  if(stage===1) assert.deepEqual(instance.calls,[]);
  assert.deepEqual(writes(instance),[]);
});

for (const ref of ['refs/heads/main',REF]) test(`Decision source assembly detects ${ref} changing while immutable sources are read`, async t => {
  const initial = await setup(t); let changed = false;
  const instance = server(initial.subject, {capabilities:['decision.evaluate'], intercept:async(method,_request,next)=>{
    const result = await next();
    if(method==='readBlob'&&!changed){changed=true;git(initial.subject.root,['update-ref',ref,initial.subject.afterCommit.hex]);}
    return result;
  }});
  const result = await readDecisionSourceMaterial(instance.store,initial.configuration,()=>success(instance.actor),initial.input);
  assert(changed); assert.equal(result.ok,false); assert.equal(result.error.code,'source_stale');
  assert.deepEqual(writes(instance),[]);
});

test('Decision source assembly rejects supplied bodies and incorrect heads without partial output', async t => {
  const {instance,input,configuration,subject} = await setup(t);
  const forged = await readDecisionSourceMaterial(instance.store,configuration,()=>success(instance.actor),{...input,grounds:[]});
  assert.equal(forged.error.code,'invalid_request'); assert.deepEqual(instance.calls,[]);
  const stale = await readDecisionSourceMaterial(instance.store,configuration,()=>success(instance.actor),{...input,expectedProjectHead:subject.afterCommit});
  assert.equal(stale.error.code,'source_stale'); assert.equal('value' in stale,false);
});

test('Decision source assembly snapshots request/configuration and rejects changed actor identity', async t => {
  const {instance,input,configuration} = await setup(t); const expected = structuredClone(input);
  let calls = 0;
  const result = await readDecisionSourceMaterial(instance.store,configuration,request=>{
    calls++; assert.deepEqual(request,expected);
    configuration.repositoryId='cw:repository:wrong'; configuration.limits.maximumWikiItems=1; input.changeId='CHG-wrong';
    return success(instance.actor);
  },input);
  assert.equal(result.ok,true,JSON.stringify(result)); assert.equal(calls,3);
  const config = decisionConfiguration(instance); calls=0;
  const changed = await readDecisionSourceMaterial(instance.store,config,()=>success(++calls===1?instance.actor:{...instance.actor,actorId:'cw:actor:different'}),expected);
  assert.equal(changed.error.code,'authorization_denied');
});

test('Decision source assembly fails closed on unavailable authorization and source reads', async t => {
  const {instance,input,configuration,subject} = await setup(t);
  const result = await readDecisionSourceMaterial(instance.store,configuration,()=>{throw Error('Policy unavailable');},input);
  assert.equal(result.error.code,'authorization_denied'); assert.deepEqual(instance.calls,[]);
  const broken = server(subject,{intercept:()=>{throw Error('Storage unavailable');}});
  const unavailable = await readDecisionSourceMaterial(broken.store,configuration,()=>success(broken.actor),input);
  assert.equal(unavailable.error.code,'unavailable'); assert.equal('value' in unavailable,false);
});

for (const patch of [{capabilities:[]},{wikiItemIds:['cw:item:limited']},{changeIds:[]}]) test(`Decision source assembly rejects insufficient scope ${JSON.stringify(patch)}`, async t => {
  const {instance,input,configuration} = await setup(t);
  const result = await readDecisionSourceMaterial(instance.store,configuration,()=>success({...instance.actor,...patch}),input);
  assert.equal(result.error.code,'authorization_denied'); assert.deepEqual(instance.calls,[]);
});

for (const response of ['missing','malformed']) test(`Decision source assembly rejects ${response} final source observation`, async t => {
  const initial = await setup(t); let projectReads = 0;
  const instance = server(initial.subject, {intercept:async(method,request,next)=>{
    const result = await next();
    if(method==='readSnapshot'&&request.selector.kind==='ref'&&request.selector.ref==='refs/heads/main'&&++projectReads===2){
      return response==='missing'?failure({code:'not_found',operation:'read_snapshot',message:'Unavailable'}):success({...result.value,complete:false});
    }
    return result;
  }});
  const result = await readDecisionSourceMaterial(instance.store,initial.configuration,()=>success(instance.actor),initial.input);
  assert.equal(projectReads,2); assert.equal(result.error.code,'source_stale'); assert.equal('value' in result,false);
  assert.deepEqual(writes(instance),[]);
});
