import {createServer} from 'node:http';
import {once} from 'node:events';

export const resultText = '{"passed":true,"reason":"Fixture."}';
export const usage = {prompt_tokens: 120, completion_tokens: 30, total_tokens: 150,
  prompt_tokens_details: {cached_tokens: 20}, completion_tokens_details: {reasoning_tokens: 7}};

export function completion({text = resultText, finish = 'stop', tokens = usage, tool} = {}) {
  const chunks = [];
  const delta = tool
    ? {role: 'assistant', tool_calls: [{index: 0, id: 'call_fixture', type: 'function', function: {name: tool.name, arguments: JSON.stringify(tool.arguments)}}]}
    : {role: 'assistant', content: text};
  chunks.push({id: 'response_fixture', object: 'chat.completion.chunk', choices: [{index: 0, delta, finish_reason: null}]});
  chunks.push({id: 'response_fixture', object: 'chat.completion.chunk', choices: [{index: 0, delta: {}, finish_reason: tool ? 'tool_calls' : finish}]});
  if (tokens) chunks.push({choices: [], usage: tokens});
  return chunks.map(value => `data: ${JSON.stringify(value)}\n\n`).join('') + 'data: [DONE]\n\n';
}

export function answer(response, options) {
  response.writeHead(200, {'content-type': 'text/event-stream'});
  response.end(completion(options));
}

export async function localServer(t, handler = (_request, response) => answer(response)) {
  const requests = [];
  const seen = Promise.withResolvers();
  const closed = Promise.withResolvers();
  const sockets = new Set();
  const failures = [];
  const server = createServer(async (request, response) => {
    response.on('close', () => closed.resolve());
    try {
      let body = '';
      for await (const chunk of request) body += chunk;
      requests.push({path: request.url, headers: request.headers, body: body ? JSON.parse(body) : null});
      seen.resolve();
      await handler(request, response, requests);
    } catch (error) {
      failures.push(error);
      response.destroy(error);
    }
  });
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (failures.length) throw new AggregateError(failures, 'Fixture server failed.');
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
  return {baseUrl, endpoint: `${baseUrl}/chat/completions`, requests, seen: seen.promise, closed: closed.promise};
}
