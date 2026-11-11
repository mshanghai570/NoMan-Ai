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
