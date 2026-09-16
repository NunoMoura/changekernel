import assert from 'node:assert/strict';
import {createAssistantMessageEventStream, createProvider} from '@earendil-works/pi-ai';

export function message(text = '{"passed":true}', patch = {}) {
  return {role: 'assistant', content: [{type: 'text', text}], api: 'openai-completions', provider: 'cw:provider:scripted', model: 'cw:model:scripted',
    usage: {input: 10, output: 5, cacheRead: 0, cacheWrite: 0, totalTokens: 15, cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0}},
    stopReason: 'stop', timestamp: 0, ...patch};
}
export function events(text, patch) {
  const result = message(text, patch);
  return [{type: 'start', partial: result}, {type: 'text_delta', contentIndex: 0, delta: result.content[0]?.text ?? '', partial: result},
    {type: 'done', reason: result.stopReason, message: result}];
}
export function scriptedInstaller(authorization) {
  let calls = 0;
  const lease = scriptedPiLease(async (stream, {context}) => {
    calls++;
    assert.deepEqual(context.tools, []);
    for (const event of events('Pi vertical slice complete.')) stream.push(event);
  });
  assert.equal(lease.model.provider, authorization.route.providerId);
  assert.equal(lease.model.id, authorization.route.modelId);
  return {...lease, assertComplete: () => assert.equal(calls, 1)};
}

export function scriptedPiLease(run = async stream => {for (const event of events()) stream.push(event);}, {dispose = async () => {}} = {}) {
  const model = {id: 'cw:model:scripted', name: 'Scripted model', api: 'openai-completions', provider: 'cw:provider:scripted', baseUrl: 'http://127.0.0.1:1',
    reasoning: false, input: ['text'], cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0}, contextWindow: 32768, maxTokens: 256};
  const stream = (selected, context, options) => {
    const target = createAssistantMessageEventStream();
    void (async () => {
      try {await run(target, {model: selected, context, options});}
      catch (error) {const failure = message('', {stopReason: options?.signal?.aborted ? 'aborted' : 'error', errorMessage: String(error)}); target.push({type: 'error', reason: failure.stopReason, error: failure});}
      finally {target.end(message('', {stopReason: 'error'}));}
    })();
    return target;
  };
  const provider = createProvider({id: model.provider, models: [model], auth: {apiKey: {name: 'Synthetic credentials', resolve: async () => ({auth: {apiKey: 'fixture-not-a-credential'}})}}, api: {stream, streamSimple: stream}});
  return {model, provider, dispose, providerReceiptDigest: null};
}
