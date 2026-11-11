# On-Device WebLLM Roleplay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional WebLLM roleplay provider that runs replies and memory summaries in iPhone Safari using on-device WebGPU.

**Architecture:** Add a lazy client-side WebLLM service with an explicit model lifecycle, then route roleplay reply, memory, and scene operations to it only when the user selects WebLLM. Share prompt construction with the existing server engine; preserve all other provider paths and reject browser-only WebLLM requests at the server boundary.

**Tech Stack:** React 19, TypeScript, Vite, `@mlc-ai/web-llm`, Node's built-in `node:test` run through the existing `tsx` dependency.

**Spec:** `docs/superpowers/specs/2026-11-11-webllm-iphone-roleplay-design.md`

## Global Constraints

- Target iOS 26+ Safari, but detect WebGPU by feature and adapter checks rather than an iOS version string.
- The initial WebLLM model IDs are `Qwen3-0.6B-q4f16_1-MLC` and `Llama-3.2-1B-Instruct-q4f16_1-MLC`.
- Model downloads are explicit; chat must not start a large download automatically.
- Browser model storage is best-effort; do not promise permanent cache retention or whole-app offline operation.
- With WebLLM selected, replies, memory summaries, and scene prompts must not call `/api/chat/*` or silently use a network provider.
- Preserve existing providers, conversation persistence/export, mature-mode boundaries, and image/video generation behavior.
- The working tree already contains uncommitted roleplay changes. Read and integrate those current files; stage only files created or changed for this feature.
- Do not create implementation commits while those pre-existing changes remain in the target files; keep all user changes intact and leave the final feature diff for user review.

---

### Task 1: Share roleplay prompts and memory normalization

**Files:**
- Modify: `src/utils/roleplayPrompt.ts`
- Modify: `src/server/roleplayEngine.ts`
- Test: `src/utils/roleplayPrompt.test.ts`

**Interfaces:**
- Produces `RoleplayPromptInput`, containing `persona`, `messages`, optional `memory`, `avoidPhrases`, `userMessage`, `nsfw`, and `replyLength`.
- Produces `RoleplayPromptMessage`, with `role: 'system' | 'user' | 'assistant'` and `content: string`.
- Produces `buildRoleplaySystemInstruction(input): string`, `buildRoleplayMessages(input): RoleplayPromptMessage[]`, `buildMemorySummaryMessages(input): RoleplayPromptMessage[]`, and `parseMemorySummary(raw, input): PersonaMemory`.
- `MemorySummaryInput` contains `persona`, `memory`, and `messages`; `parseMemorySummary` returns the existing memory unchanged when JSON is malformed.
- The server roleplay engine consumes these helpers so server and browser use identical prompt rules and normalization.

- [ ] **Step 1: Write tests for the existing prompt contract**

Create `src/utils/roleplayPrompt.test.ts` using Node's built-in test API:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRoleplayMessages,
  buildRoleplaySystemInstruction,
  parseMemorySummary,
  type RoleplayPromptInput,
} from './roleplayPrompt';

const input: RoleplayPromptInput = {
  persona: {
    id: 'mira',
    name: 'Mira',
    tagline: 'A starship navigator',
    avatar: '/mira.png',
    category: 'Sci-Fi',
    systemPrompt: 'Patient, observant, and wry.',
    greeting: 'The stars slide past the viewport.',
    scenario: 'A ship crossing the outer rim.',
  },
  messages: [
    { id: 'greeting', role: 'assistant', content: 'The stars slide past the viewport.', timestamp: 1 },
    { id: 'turn', role: 'user', content: 'Open the airlock.', timestamp: 2 },
  ],
  memory: {
    summary: 'Mira and the user escaped a patrol.',
    relationship: 'Trust is growing.',
    facts: [],
    updatedAt: 1,
  },
  avoidPhrases: ['She watches the stars'],
  userMessage: 'Open the airlock.',
  nsfw: true,
  replyLength: 'short',
};

test('roleplay instructions preserve identity, continuity, dialogue, and mature boundaries', () => {
  const prompt = buildRoleplaySystemInstruction(input);
  assert.match(prompt, /You are Mira/);
  assert.match(prompt, /Mira and the user escaped a patrol/);
  assert.match(prompt, /She watches the stars/);
  assert.match(prompt, /all characters are adults/i);
  assert.match(prompt, /no minors/i);
});

test('provider messages deduplicate the canonical trailing user turn', () => {
  const messages = buildRoleplayMessages(input);
  assert.equal(messages[0].role, 'system');
  assert.equal(messages.filter((message) => message.role === 'user').length, 1);
  assert.equal(messages.at(-1)?.content, 'Open the airlock.');
});

test('malformed memory JSON preserves existing memory and marker', () => {
  const result = parseMemorySummary('{', {
    persona: input.persona,
    memory: { ...input.memory, lastSummarizedMessageId: 'old-marker' },
    messages: input.messages,
  });
  assert.equal(result.summary, input.memory.summary);
  assert.equal(result.lastSummarizedMessageId, 'old-marker');
});
```

- [ ] **Step 2: Run the tests and confirm they fail before implementation**

Run: `npx tsx --test src/utils/roleplayPrompt.test.ts`

Expected: FAIL because the shared roleplay prompt helpers are not exported yet.

- [ ] **Step 3: Extract prompt construction and memory helpers**

Move the existing character-bible, memory-block, dialogue-craft, mature/SFW boundary, trailing-user deduplication, and memory-summary prompt/normalization logic from `src/server/roleplayEngine.ts` into `src/utils/roleplayPrompt.ts`. Keep the server engine's exported `buildSystemInstruction` API as a thin adapter if existing callers need it:

```ts
export const buildSystemInstruction = (req: RoleplayRequest): string =>
  buildRoleplaySystemInstruction(req);
```

Have the server's `buildProviderMessages` and `summarizeConversation` call the shared helpers. Preserve the current server provider's message order and memory marker behavior.

- [ ] **Step 4: Run focused tests and type checking**

Run: `npx tsx --test src/utils/roleplayPrompt.test.ts && npm run lint`

Expected: PASS with no TypeScript errors; existing server generation still uses the shared prompt builder.

- [ ] **Step 5: Review the prompt-sharing diff**

Run: `git diff -- src/utils/roleplayPrompt.ts src/server/roleplayEngine.ts && git status --short`

Expected: shared helpers preserve the server prompt behavior, and no unrelated user work is staged or reverted.

### Task 2: Add the lazy WebLLM runtime and model lifecycle

**Files:**
- Modify: `package.json`
- Modify: `src/services/localAiService.ts`
- Create: `src/services/webLlmService.ts`
- Test: `src/services/webLlmService.test.ts`

**Interfaces:**
- `WebLlmModelId` is the union of the two model IDs in the spec.
- `WEBLLM_MODELS` contains those IDs and their display labels.
- `WebLlmSnapshot` reports `phase: 'idle' | 'loading' | 'ready' | 'error'`, active `modelId`, numeric `progress`, progress text, and an error string.
- `WebLlmEngine` exposes `stream(messages, options): AsyncGenerator<string>`, `complete(messages, options): Promise<string>`, `interrupt(): void`, and `unload(): Promise<void>`.
- `WebLlmRuntimeAdapter` exposes `checkWebGpu`, `createEngine(modelId, onProgress)`, `hasModelInCache(modelId)`, and `deleteModelCache(modelId)`.
- `WebLlmService` exposes `checkWebGpu(): Promise<WebGpuDiagnostics>`, `getSnapshot(): WebLlmSnapshot`, `subscribe(listener): () => void`, `isCached(modelId): Promise<boolean>`, `loadModel(modelId): Promise<void>`, `stream(messages, options): AsyncGenerator<string>`, `complete(messages, options): Promise<string>`, `interrupt(): void`, `unload(): Promise<void>`, and `deleteCachedModel(modelId): Promise<void>`.
- `createWebLlmService(loadRuntime)` accepts a runtime loader so lifecycle behavior can be tested with a fake runtime; the production singleton uses a loader that dynamically imports `@mlc-ai/web-llm`.
- `stream` and `complete` accept `WebLlmMessage[]` plus `{ temperature: number; maxTokens: number; signal?: AbortSignal }`; `WebLlmMessage` has a system/user/assistant role and string content.

- [ ] **Step 1: Add WebLLM using npm without introducing a lockfile**

Run: `npm install --save --no-package-lock @mlc-ai/web-llm`

Expected: `package.json` gains the runtime dependency; no package lock is created because the repository currently has none.

- [ ] **Step 2: Write lifecycle tests against a fake runtime**

Create tests for lazy initialization, load progress, a ready model, failed loads, interrupting a stream, and cache removal. Use a fake runtime whose `createEngine` records calls and reports progress:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createWebLlmService } from './webLlmService';

test('engine creation is lazy and load progress reaches the snapshot', async () => {
  const calls: string[] = [];
  const fakeEngine = {
    stream: async function* () { yield 'test'; },
    complete: async () => 'test',
    interrupt: () => { calls.push('interrupt'); },
    unload: async () => { calls.push('unload'); },
  };
  const service = createWebLlmService(async () => ({
    checkWebGpu: async () => ({ isSupported: true, description: 'test adapter' }),
    createEngine: async (modelId, onProgress) => {
      calls.push(`load:${modelId}`);
      onProgress({ progress: 0.5, text: 'Loading test model' });
      return fakeEngine;
    },
    hasModelInCache: async () => false,
    deleteModelCache: async (modelId) => {
      calls.push(`delete:${modelId}`);
    },
  }));
  assert.deepEqual(calls, []);
  await service.loadModel('Qwen3-0.6B-q4f16_1-MLC');
  assert.equal(service.getSnapshot().phase, 'ready');
  assert.deepEqual(calls, ['load:Qwen3-0.6B-q4f16_1-MLC']);
});
```

Add separate tests that assert a rejected `createEngine` moves the snapshot to `error`, `service.interrupt()` calls the active fake engine's interrupt method, and `deleteCachedModel()` unloads the active engine before recording the cache deletion.

- [ ] **Step 3: Run the service tests and confirm the missing service fails**

Run: `npx tsx --test src/services/webLlmService.test.ts`

Expected: FAIL because `createWebLlmService` and the runtime lifecycle do not exist yet.

- [ ] **Step 4: Implement the lazy adapter and singleton**

Use the WebLLM prebuilt model configuration and supported cache helpers. Reuse `LocalAiService.testWebGpu()` for capability diagnostics so WebLLM and the existing Local Models diagnostics agree, and replace its obsolete iOS 17 experimental-settings message with an accurate feature/adapter/secure-context explanation for iOS 26+ Safari. Load the WebLLM module only when Local Models needs cache information or the user explicitly starts a load; do not create an engine or fetch model weights until `loadModel`. Stream OpenAI-style completion deltas, connect abort/interrupt to WebLLM's `interruptGenerate`, unload GPU resources before changing/removing a model, and publish snapshot updates to subscribers.

```ts
export const WEBLLM_MODELS = [
  { id: 'Qwen3-0.6B-q4f16_1-MLC', label: 'Qwen3 0.6B · lightweight' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B' },
] as const;
```

- [ ] **Step 5: Run lifecycle tests and type checking**

Run: `npx tsx --test src/services/webLlmService.test.ts && npm run lint`

Expected: PASS; module creation remains lazy, ready/error state is accurate, and abort/cache operations reach the fake runtime.

- [ ] **Step 6: Review the runtime diff**

Run: `git diff -- package.json src/services/localAiService.ts src/services/webLlmService.ts && git status --short`

Expected: the WebLLM dependency, lazy runtime, and corrected WebGPU diagnostic copy are the only intended changes in this task.

### Task 3: Expose WebLLM in provider settings and Local Models

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/constants/chat.ts`
- Modify: `src/components/SettingsView.tsx`
- Modify: `src/components/LocalModelsView.tsx`
- Modify: `src/server/roleplayEngine.ts`

**Interfaces:**
- `ChatProvider` adds `'webllm'`; existing `UserSettings.chatModel` persists the selected WebLLM model ID.
- Settings provider presets include WebLLM and select the lightweight model when the user switches to it.
- Local Models subscribes to `WebLlmService` snapshots and persists model selection through `onUpdateSettings`.
- Server provider maps and config use a server-only provider type and reject WebLLM, rather than resolving it to Gemini.

- [ ] **Step 1: Add `webllm` to the provider type and preset**

Add the provider without changing existing defaults:

```ts
export type ChatProvider = 'gemini' | 'ollama' | 'openai' | 'webllm';
```

Keep `DEFAULT_SETTINGS.chatProvider` as Gemini; use `WEBLLM_MODELS[0].id` only when the user explicitly changes to WebLLM.

Narrow the server roleplay engine's model/endpoint maps to `Exclude<ChatProvider, 'webllm'>` and throw if its resolver receives `webllm`. The API handlers will add explicit HTTP 400 guards before fallback in Task 4.

- [ ] **Step 2: Update Settings provider selection**

Add a fourth provider choice, describe it as on-device WebGPU inference, and make the model field read-only for WebLLM with directions to choose models in Local Models. Do not display a server endpoint or API-key input for WebLLM.

- [ ] **Step 3: Add model controls to Local Models**

Add a WebLLM section with feature-detection status, a two-model selector, explicit Download/Load action, progress text, cached/ready state, unload, and selected-model cache deletion. Use the existing service subscription and show errors in the section. Replace stale iOS 17+/experimental-settings and “works offline/100% private” copy with accurate iOS 26+ WebGPU capability and first-download/cache caveats. Preserve the existing diagnostics and Ollama/local endpoint controls.

- [ ] **Step 4: Verify provider and model lifecycle UI compiles**

Run: `npm run lint && npm run build`

Expected: PASS; WebLLM can be selected, but no model download starts until the user presses Download/Load.

- [ ] **Step 5: Review the settings and model-controls diff**

Run: `git diff -- src/types/index.ts src/constants/chat.ts src/components/SettingsView.tsx src/components/LocalModelsView.tsx && git status --short`

Expected: provider selection and model controls are integrated with the current user edits; no unrelated changes are staged or reverted.

### Task 4: Route local roleplay, memory, and scene prompts

**Files:**
- Modify: `src/services/chatEngine.ts`
- Modify: `src/components/ChatView.tsx`
- Modify: `src/server/roleplayEngine.ts`
- Modify: `src/server/apiHandler.ts`
- Test: `src/services/chatEngine.test.ts`
- Test: `src/server/roleplayEngine.test.ts`

**Interfaces:**
- `streamRoleplayReply` sends the shared roleplay messages to `WebLlmService.stream` for `provider === 'webllm'` and keeps existing SSE behavior otherwise.
- `summarizeMemory` uses `WebLlmService.complete` plus shared memory prompt/parse helpers for WebLLM; other providers continue using `/api/chat/summarize`.
- `requestScenePrompt` returns `buildLocalScenePrompt` before any fetch for WebLLM.
- Server API rejects WebLLM as a browser-only provider before invoking a provider or the configured fallback.

- [ ] **Step 1: Write tests that fail if the local path uses network fetch**

Create `src/services/chatEngine.test.ts` with typed fixtures, mock `globalThis.fetch` to throw, and replace `WebLlmService.stream` and `.complete` with deterministic fake responses. Verify reply streaming, local memory parsing, and local scene prompt generation. Example reply test:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatMessage, PersonaMemory, RoleplayEngineConfig, RoleplayPersona } from '../types';
import { requestScenePrompt, streamRoleplayReply, summarizeMemory } from './chatEngine';
import { webLlmService } from './webLlmService';

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
const config: RoleplayEngineConfig = {
  provider: 'webllm',
  model: 'Qwen3-0.6B-q4f16_1-MLC',
  endpoint: '',
  apiKey: '',
  temperature: 0.8,
  replyLength: 'medium',
};

test('WebLLM replies stream without an API request', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('WebLLM must not call fetch');
  });
  t.mock.method(webLlmService, 'stream', async function* () {
    yield 'A local reply.';
  });
  const deltas: string[] = [];
  const reply = await streamRoleplayReply({
    persona, messages, memory, config,
    nsfw: false,
    onDelta: (delta) => deltas.push(delta),
  });
  assert.equal(reply, 'A local reply.');
  assert.deepEqual(deltas, ['A local reply.']);
});

test('WebLLM memory summaries and scene prompts stay on-device', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('WebLLM must not call fetch');
  });
  t.mock.method(webLlmService, 'complete', async () =>
    JSON.stringify({ summary: 'Mira found a map.', relationship: 'Trusting.', facts: [] })
  );
  const transcript = Array.from({ length: 8 }, (_, index): ChatMessage => ({
    id: `m${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `Turn ${index}.`,
    timestamp: index + 1,
  }));
  const nextMemory = await summarizeMemory({
    persona, messages: transcript, memory, config,
  });
  assert.equal(nextMemory?.summary, 'Mira found a map.');
  assert.equal(nextMemory?.lastSummarizedMessageId, 'm1');
  const scene = await requestScenePrompt({
    persona, messages: transcript, memory, config, nsfw: false,
  });
  assert.match(scene.imagePrompt, /Mira/);
});
```

- [ ] **Step 2: Run the client engine tests and confirm the local route fails**

Run: `npx tsx --test src/services/chatEngine.test.ts`

Expected: FAIL because `streamRoleplayReply` currently posts every provider request to `/api/chat/stream`.

- [ ] **Step 3: Route local reply and memory calls**

Branch on `config.provider === 'webllm'` before `fetch`. Use `buildRoleplayMessages` for replies and forward each streamed delta to `onDelta`. Bound generation with these reply-length limits:

```ts
const LOCAL_REPLY_MAX_TOKENS: Record<ChatReplyLength, number> = {
  short: 160,
  medium: 256,
  long: 384,
};
```

For memory, call `buildMemorySummaryMessages` and `parseMemorySummary` with `temperature: 0.3`, `maxTokens: 512`, and the active `AbortSignal`; preserve the existing threshold, keep-window, marker, and current-memory-on-invalid-output behavior.

- [ ] **Step 4: Route local scene prompts and preserve stop behavior**

Return the deterministic local scene prompt before the server request. Connect `AbortSignal` to WebLLM interrupt so ChatView's existing Stop action retains partial output. If the selected model is not ready or generation fails before any output, remove the empty assistant placeholder, keep the user's message, and show a user-readable error directing the user to Local Models; do not add a canned success-shaped assistant reply or auto-download. Preserve partial output if generation was interrupted after streaming began.

- [ ] **Step 5: Reject WebLLM in server roleplay APIs**

Add `assertServerChatProvider(provider): asserts provider is Exclude<ChatProvider, 'webllm'>` to `src/server/roleplayEngine.ts`; it throws a clear `WebLLM must run in the browser` error for `webllm` and narrows accepted values to Gemini, Ollama, and OpenAI-compatible providers. Call it in `/api/chat/stream`, `/api/chat/summarize`, and `/api/chat/scene-prompt` before provider selection or fallback, then return HTTP 400. Test that WebLLM throws before any provider or fallback is invoked.

- [ ] **Step 6: Run client tests, lint, and build**

Run: `npx tsx --test src/services/chatEngine.test.ts src/server/roleplayEngine.test.ts src/utils/roleplayPrompt.test.ts src/services/webLlmService.test.ts && npm run lint && npm run build`

Expected: PASS; mocked fetch is not called for any WebLLM roleplay operation, and existing provider paths still compile and pass their tests.

- [ ] **Step 7: Review local roleplay routing**

Run: `git diff -- src/services/chatEngine.ts src/components/ChatView.tsx src/server/roleplayEngine.ts src/server/apiHandler.ts && git status --short`

Expected: local roleplay operations bypass network providers, server endpoints reject WebLLM without fallback, and prior user edits remain intact.

### Task 5: Document and verify iPhone Safari behavior

**Files:**
- Modify: `docs/ROLEPLAY_ENGINE.md`
- Verify: `package.json`, `src/services/webLlmService.ts`, Local Models and chat UI

**Interfaces:**
- Documentation lists WebLLM as a selectable provider and distinguishes local roleplay text from external image generation.
- The implementation remains within the approved spec and preserves existing user changes.

- [ ] **Step 1: Update roleplay documentation**

Document explicit model download, the two presets, Safari WebGPU feature detection, cache eviction caveat, local reply/memory/scene routing, and the fact that choosing WebLLM does not make Image Studio local.

- [ ] **Step 2: Run all automated checks**

Run:

```bash
npx tsx --test src/utils/roleplayPrompt.test.ts src/services/webLlmService.test.ts src/services/chatEngine.test.ts src/server/roleplayEngine.test.ts
npm run lint
npm run build
git diff --check
```

Expected: all tests and checks pass. Confirm the production build emits WebLLM in a lazy-loaded chunk rather than the initial app entry.

- [ ] **Step 3: Perform iPhone Safari acceptance checks**

On iOS 26+ Safari over the deployed secure origin, verify WebGPU/adapter status, explicitly download and load each preset, stream a roleplay reply, stop mid-reply, reload a cached model, and switch between WebLLM and each existing provider. In the network inspector confirm local reply, memory, and scene-prompt actions make no `/api/chat/*` requests. Delete the selected model cache and confirm chat directs the user back to Local Models without starting a download.

- [ ] **Step 4: Record device-test limitations and review the final worktree**

If an iOS 26+ device is unavailable, state that the Safari acceptance checks remain unverified; do not infer them from desktop WebGPU. Review the final worktree without staging user-owned files:

```bash
git status --short
git diff --check
```

Expected: report whether iPhone Safari acceptance was completed. Do not stage or commit the pre-existing untracked `docs/ROLEPLAY_ENGINE.md`; leave its original content and the user's other pre-existing changes intact.
