import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  ChatMessage,
  PersonaMemory,
  RoleplayEngineConfig,
  RoleplayPersona,
} from '../types';
import { buildLocalScenePrompt } from '../utils/roleplayPrompt';
import {
  MEMORY_KEEP_TURNS,
  requestScenePrompt,
  streamRoleplayReply,
  summarizeMemory,
} from './chatEngine';
import {
  webLlmService,
  type WebLlmGenerationOptions,
  type WebLlmMessage,
} from './webLlmService';

const persona: RoleplayPersona = {
  id: 'mira',
  name: 'Mira',
  tagline: 'A starship navigator',
  avatar: '/mira.png',
  category: 'Sci-Fi',
  systemPrompt: 'Patient and observant.',
  greeting: 'The stars slide past.',
  appearance: 'silver-haired navigator',
  outfit: 'a navy flight suit',
  scenario: 'aboard the Wayfarer',
  worldStyle: 'cinematic sci-fi',
};

const memory: PersonaMemory = {
  summary: 'Mira found a damaged map.',
  relationship: 'Trusting.',
  facts: [],
  updatedAt: 1,
};

const config: RoleplayEngineConfig = {
  provider: 'webllm',
  model: 'Qwen3-0.6B-q4f16_1-MLC',
  endpoint: '',
  apiKey: '',
  temperature: 0.8,
  replyLength: 'medium',
};

const messages: ChatMessage[] = [
  { id: 'u1', role: 'user', content: 'Hello.', timestamp: 1 },
];

test('WebLLM replies stream local prompt deltas without a network request', async (t) => {
  let fetchCalls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    fetchCalls += 1;
    throw new Error('WebLLM must not call fetch');
  });
  let prompt: Parameters<typeof webLlmService.stream>[0] | undefined;
  let generationOptions: Parameters<typeof webLlmService.stream>[1] | undefined;
  t.mock.method(webLlmService, 'stream', async function* (
    receivedPrompt: WebLlmMessage[],
    options: WebLlmGenerationOptions
  ) {
    prompt = receivedPrompt;
    generationOptions = options;
    yield 'A local ';
    yield 'reply.';
  });
  t.mock.method(webLlmService, 'complete', async () => {
    throw new Error('WebLLM reply generation must stream');
  });

  const deltas: string[] = [];
  const reply = await streamRoleplayReply({
    persona,
    messages,
    memory,
    config,
    nsfw: false,
    onDelta: (delta) => deltas.push(delta),
  });

  assert.equal(reply, 'A local reply.');
  assert.deepEqual(deltas, ['A local ', 'reply.']);
  assert.equal(prompt?.[0]?.role, 'system');
  assert.match(prompt?.[0]?.content || '', /You are Mira/);
  assert.deepEqual(prompt?.slice(1), [{ role: 'user', content: 'Hello.' }]);
  assert.deepEqual(generationOptions, { temperature: 0.8, maxTokens: 256, signal: undefined });
  assert.equal(fetchCalls, 0);
});

test('WebLLM reply cancellation preserves emitted text and stops later deltas', async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('WebLLM must not call fetch');
  });
  t.mock.method(webLlmService, 'stream', async function* (
    _prompt: WebLlmMessage[],
    options: WebLlmGenerationOptions
  ) {
    assert.equal(options.signal, controller.signal);
    yield 'Partial reply.';
    controller.abort();
    yield 'This delta must be ignored.';
  });

  const deltas: string[] = [];
  await assert.rejects(
    streamRoleplayReply({
      persona,
      messages,
      memory,
      config,
      nsfw: false,
      signal: controller.signal,
      onDelta: (delta) => deltas.push(delta),
    }),
    { name: 'AbortError' }
  );
  assert.deepEqual(deltas, ['Partial reply.']);
});

test('WebLLM memory summaries use the keep window and parse local output', async (t) => {
  let fetchCalls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    fetchCalls += 1;
    throw new Error('WebLLM must not call fetch');
  });
  t.mock.method(webLlmService, 'stream', async function* () {
    throw new Error('Memory summarization must not stream');
  });

  const rawSummary =
    '{"summary":"Mira found a map.","relationship":"Trusting.","facts":[{"text":"The map is damaged.","importance":"high"}]}';
  let prompt: Parameters<typeof webLlmService.complete>[0] | undefined;
  let generationOptions: Parameters<typeof webLlmService.complete>[1] | undefined;
  t.mock.method(webLlmService, 'complete', async (
    receivedPrompt: WebLlmMessage[],
    options: WebLlmGenerationOptions
  ) => {
    prompt = receivedPrompt;
    generationOptions = options;
    return rawSummary;
  });

  const transcript = Array.from({ length: 8 }, (_, index): ChatMessage => ({
    id: `m${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `Turn ${index}.`,
    timestamp: index + 1,
  }));
  const controller = new AbortController();
  const nextMemory = await summarizeMemory({
    persona,
    messages: transcript,
    memory,
    config,
    signal: controller.signal,
  });

  assert.equal(nextMemory?.summary, 'Mira found a map.');
  assert.equal(nextMemory?.relationship, 'Trusting.');
  assert.deepEqual(nextMemory?.facts.map(({ text, importance }) => ({ text, importance })), [
    { text: 'The map is damaged.', importance: 'high' },
  ]);
  assert.equal(nextMemory?.lastSummarizedMessageId, `m${7 - MEMORY_KEEP_TURNS}`);
  assert.equal(prompt?.length, 2);
  assert.equal(prompt?.[0]?.role, 'system');
  assert.match(prompt?.[0]?.content || '', /long-term continuity memory/i);
  assert.equal(prompt?.[1]?.role, 'user');
  assert.match(prompt?.[1]?.content || '', /User: Turn 0\./);
  assert.match(prompt?.[1]?.content || '', /Mira: Turn 1\./);
  assert.doesNotMatch(prompt?.[1]?.content || '', /Turn 2\./);
  assert.deepEqual(generationOptions, {
    temperature: 0.3,
    maxTokens: 512,
    signal: controller.signal,
  });
  assert.equal(fetchCalls, 0);
});

test('WebLLM scene prompts are built locally before any fetch or model call', async (t) => {
  let fetchCalls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    fetchCalls += 1;
    throw new Error('WebLLM must not call fetch');
  });
  t.mock.method(webLlmService, 'stream', async function* () {
    throw new Error('Scene prompts must not stream');
  });
  t.mock.method(webLlmService, 'complete', async () => {
    throw new Error('Scene prompts must not call the model');
  });

  const sceneMessages: ChatMessage[] = [
    { id: 'u1', role: 'user', content: 'I point at the map.', timestamp: 1 },
    { id: 'a1', role: 'assistant', content: '*Mira studies the map.*', timestamp: 2 },
  ];
  const scene = await requestScenePrompt({
    persona,
    messages: sceneMessages,
    memory,
    config,
    nsfw: false,
  });

  assert.equal(scene.imagePrompt, buildLocalScenePrompt(persona, memory, sceneMessages));
  assert.equal(
    scene.imagePrompt,
    'cinematic sci-fi, Mira (silver-haired navigator), wearing a navy flight suit, location: aboard the Wayfarer, action: Mira studies the map., moment: I point at the map., emotional tone: Trusting., cinematic composition, 35mm lens, dramatic volumetric lighting, ultra-detailed, 8k'
  );
  assert.equal(
    scene.negativePrompt,
    'text, watermark, logo, signature, extra limbs, deformed hands, low quality, blurry, duplicate character, inconsistent face'
  );
  assert.equal(fetchCalls, 0);
});
