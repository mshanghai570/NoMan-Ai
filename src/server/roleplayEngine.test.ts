import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatMessage, PersonaMemory, RoleplayPersona } from '../types';
import { assertServerChatProvider, streamChat } from './roleplayEngine';

const persona: RoleplayPersona = {
  id: 'mira',
  name: 'Mira',
  tagline: 'A starship navigator',
  avatar: '/mira.png',
  category: 'Sci-Fi',
  systemPrompt: 'Patient and observant.',
  greeting: 'The stars slide past.',
};

const messages: ChatMessage[] = [
  { id: 'u1', role: 'user', content: 'Hello.', timestamp: 1 },
];

const memory: PersonaMemory = {
  summary: '',
  relationship: '',
  facts: [],
  updatedAt: 1,
};

test('server roleplay engine rejects WebLLM instead of resolving it to Gemini', async (t) => {
  let fetchCalls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    fetchCalls += 1;
    throw new Error('WebLLM must not use a server provider');
  });

  assert.throws(
    () => assertServerChatProvider('webllm'),
    /WebLLM must run in the browser/
  );

  await assert.rejects(
    async () => {
      for await (const _delta of streamChat({
        persona,
        messages,
        memory,
        userMessage: 'Hello.',
        config: { provider: 'webllm' },
      })) {
        // A server-side provider must never produce a WebLLM response.
      }
    },
    /WebLLM must run in the browser/
  );
  assert.equal(fetchCalls, 0);
});

test('server roleplay engine routes Kilo provider to Kilo Gateway with free model', async (t) => {
  let requestedUrl = '';
  let requestedHeaders: Record<string, string> = {};
  let requestedBody: any = null;

  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    requestedUrl = String(url);
    requestedHeaders = (init?.headers as Record<string, string>) || {};
    requestedBody = init?.body ? JSON.parse(String(init.body)) : null;

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"choices":[{"delta":{"content":"*Mira nods* The stars shine brightly."}}]}\n\ndata: [DONE]\n\n'
          )
        );
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  });

  let streamed = '';
  for await (const delta of streamChat({
    persona,
    messages,
    memory,
    userMessage: 'What is our route?',
    config: {
      provider: 'kilo',
      model: 'kilo-auto/free',
      agentMode: 'narrator',
    },
  })) {
    streamed += delta;
  }

  assert.equal(requestedUrl, 'https://ai-gateway.kilo.ai/api/v1/chat/completions');
  assert.equal(requestedBody.model, 'kilo-auto/free');
  assert.equal(streamed, '*Mira nods* The stars shine brightly.');
  assert.ok(requestedBody.messages[0].content.includes('AGENT MODE: MASTER NARRATOR'));
});
