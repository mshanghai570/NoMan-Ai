import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';
import { handleApiRequest } from './apiHandler';

interface FakeRequest extends EventEmitter {
  url: string;
  method: string;
}

interface FakeResponse extends EventEmitter {
  statusCode: number;
  writableEnded: boolean;
  headers: Map<string, string>;
  output: string;
  setHeader(name: string, value: string): void;
  write(chunk: string): void;
  end(chunk?: string): void;
}

function createRequest(url: string): FakeRequest {
  const request = new EventEmitter() as FakeRequest;
  request.url = url;
  request.method = 'POST';
  return request;
}

function createResponse(): FakeResponse {
  const response = new EventEmitter() as FakeResponse;
  response.statusCode = 200;
  response.writableEnded = false;
  response.headers = new Map();
  response.output = '';
  response.setHeader = (name, value) => response.headers.set(name.toLowerCase(), value);
  response.write = (chunk) => {
    response.output += chunk;
  };
  response.end = (chunk = '') => {
    response.output += chunk;
    response.writableEnded = true;
  };
  return response;
}

async function postJson(url: string, body: unknown): Promise<FakeResponse> {
  const request = createRequest(url);
  const response = createResponse();
  const handling = handleApiRequest(
    request as IncomingMessage,
    response as unknown as ServerResponse
  );
  request.emit('data', JSON.stringify(body));
  request.emit('end');
  assert.equal(await handling, true);
  return response;
}

test('roleplay APIs reject browser-only WebLLM before provider or fallback execution', async (t) => {
  let fetchCalls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    fetchCalls += 1;
    throw new Error('A rejected WebLLM request must not reach a provider or fallback');
  });

  const routes = [
    {
      url: '/api/chat/stream',
      body: {
        userMessage: 'Hello.',
        config: {
          provider: 'webllm',
          fallback: {
            enabled: true,
            endpoint: 'http://localhost:11434',
            model: 'llama3.2',
          },
        },
      },
    },
    {
      url: '/api/chat/summarize',
      body: {
        persona: { name: 'Mira' },
        messages: [{ id: 'u1', role: 'user', content: 'Hello.', timestamp: 1 }],
        config: { provider: 'webllm' },
      },
    },
    {
      url: '/api/chat/scene-prompt',
      body: {
        persona: { name: 'Mira' },
        config: { provider: 'webllm' },
      },
    },
    {
      url: '/api/gemini/chat',
      body: {
        userMessage: 'Hello.',
        config: { provider: 'webllm' },
      },
    },
  ];

  for (const { url, body } of routes) {
    const response = await postJson(url, body);
    assert.equal(response.statusCode, 400, `${url} should return HTTP 400`);
    assert.match(response.headers.get('content-type') || '', /application\/json/);
    assert.deepEqual(JSON.parse(response.output), {
      error: 'WebLLM must run in the browser.',
    });
    if (url === '/api/chat/stream') {
      assert.doesNotMatch(response.headers.get('content-type') || '', /text\/event-stream/);
    }
  }

  assert.equal(fetchCalls, 0);
});

test('non-WebLLM chat keeps streaming and the configured Ollama retry', async (t) => {
  const requestedUrls: string[] = [];
  t.mock.method(console, 'warn', () => undefined);
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    requestedUrls.push(url);
    if (url === 'https://provider.example/v1/chat/completions') {
      return new Response('Primary provider unavailable', { status: 503 });
    }
    return new Response('{"message":{"content":"Local reply."}}\n', { status: 200 });
  });

  const response = await postJson('/api/chat/stream', {
    persona: {
      id: 'mira',
      name: 'Mira',
      tagline: 'A starship navigator',
      avatar: '/mira.png',
      category: 'Sci-Fi',
      systemPrompt: 'Patient and observant.',
      greeting: 'The stars slide past.',
    },
    messages: [{ id: 'u1', role: 'user', content: 'Hello.', timestamp: 1 }],
    userMessage: 'Hello.',
    config: {
      provider: 'openai',
      model: 'test-model',
      endpoint: 'https://provider.example/v1',
      apiKey: '',
      temperature: 0.8,
      replyLength: 'short',
      fallback: {
        enabled: true,
        endpoint: 'http://localhost:11434',
        model: 'llama3.2',
      },
    },
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers.get('content-type') || '', /text\/event-stream/);
  assert.match(response.output, /"type":"fallback"/);
  assert.match(response.output, /"type":"delta","text":"Local reply\."/);
  assert.match(response.output, /"type":"done"/);
  assert.deepEqual(requestedUrls, [
    'https://provider.example/v1/chat/completions',
    'http://localhost:11434/api/chat',
  ]);
});
