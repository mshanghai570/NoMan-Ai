# Roleplay Engine

Provider-agnostic character chat with long-term memory, streaming replies, and
character-consistent image prompts.

## Architecture

| Layer | File | Responsibility |
| --- | --- | --- |
| Types | `src/types/index.ts` | `ChatProvider`, `RoleplayEngineConfig`, `PersonaMemory`, `MemoryFact`, persona visual fields |
| Config presets | `src/constants/chat.ts` | Provider defaults, endpoints, reply-length options |
| Shared prompts | `src/utils/roleplayPrompt.ts` | Character portrait/scene prompt builders, anti-repetition helper, context slicing |
| Server engine | `src/server/roleplayEngine.ts` | Character bible, memory block, provider streaming, summarization, scene prompts |
| API | `src/server/apiHandler.ts` | `/api/chat/stream`, `/api/chat/summarize`, `/api/chat/scene-prompt`, legacy `/api/gemini/chat` |
| Client | `src/services/chatEngine.ts` | SSE parsing, bounded context, memory updates, scene requests |
| On-device model | `src/services/webLlmService.ts` | Lazy WebLLM runtime, explicit model loading, streaming, and browser-cache lifecycle |
| UI | `src/components/ChatView.tsx` | Streaming bubbles, stop button, memory inspector, scene render buttons |
| Storage | `src/services/storage.ts` | Per-character memory and NSFW overrides, included in export/import |

## Character consistency

Every request rebuilds a **character bible** from the persona record:

- identity, tagline, personality/system prompt, scenario
- appearance, signature outfit, voice style, world style
- an **IDENTITY LOCK** block forbidding name/identity drift, speaking for the
  user, breaking character, or becoming a generic assistant

Because the bible is derived from stored persona data (not from the transcript),
the character cannot slowly drift as history scrolls out of the window.

## Conversation memory

Memory is stored per character in `noman_chat_memories`:

```ts
interface PersonaMemory {
  summary: string;          // rolling prose recap, <= ~180 words
  relationship: string;     // how the character currently feels about the user
  facts: MemoryFact[];      // durable promises, injuries, debts, secrets, gifts
  lastSummarizedMessageId?: string;
  updatedAt: number;
}
```

Flow:

1. The client keeps the full thread locally for display.
2. Only the last **14 turns** are sent to the selected engine, plus the memory
   block.
3. After a reply, if **12+** unsummarized turns exist, the older turns are
   summarized while the newest **6 turns** are kept out. Server-backed providers
   use `/api/chat/summarize`; WebLLM summarizes in the browser on-device.
4. The next send awaits any in-flight summarization so context is never stale.
5. `lastSummarizedMessageId` makes summarization incremental — each turn is
   folded in once.

WebLLM memory summaries stay on-device and do not call the server API. Memory
storage remains in the browser as it does for other providers.

Users can inspect and prune memory via the **brain icon** in the chat header
(`PersonaMemoryModal`). Resetting a chat clears both thread and memory.

## Natural dialogue

The system prompt adds a dialogue-craft contract:

- reply in first person, never restate the user's message
- vary openings and sentence length
- at most two `*action*` beats per reply
- ban stock AI phrasing ("a shiver ran down", "the air crackled", "not just X
  but Y", "as an AI")
- don't end every reply with a question

The client also sends `avoidPhrases` — the openings of the last four assistant
replies — so the model does not reuse them.

## Streaming

Server-backed providers use `POST /api/chat/stream`, which returns
Server-Sent Events:

```
data: {"type":"delta","text":"..."}
data: {"type":"done"}
data: {"type":"error","error":"..."}
```

- Gemini uses `generateContentStream`
- Ollama uses NDJSON over `/api/chat`
- OpenAI-compatible endpoints use SSE `/chat/completions`

WebLLM streams directly from the browser runtime. Its replies and memory
summaries do not use `/api/chat/*` or fall back to a network provider if the
local model is unavailable or generation fails.

The client aborts in-progress generation when the user taps stop or switches
characters. Partial text is kept. A reload during a stream does not resurrect an
empty bubble.

## Character-specific image prompts

For Gemini, Ollama, and OpenAI-compatible providers,
`POST /api/chat/scene-prompt` asks the configured provider for one JSON prompt:

- canonical appearance, outfit, world style, and name are injected as canon
- the latest ~8 turns supply what is happening right now
- mature mode is passed through for adult-only framing

If the provider is unavailable, `buildLocalScenePrompt` produces a deterministic
fallback, so the button always works. Prompts are cached on
`ChatMessage.scenePrompt` and handed to Image Studio, which can force NSFW
handling for that generation.

With WebLLM selected, scene prompts are built deterministically in the browser;
they do not call the scene-prompt API or another model. Image Studio image and
video generation remains a separate capability and is not made local by
selecting WebLLM.

## Configuring a provider

**Settings → Roleplay Engine**

| Provider | Needs | Notes |
| --- | --- | --- |
| Gemini | `GEMINI_API_KEY` on the server | Strongest prose; Google policy can still refuse explicit content |
| Ollama | `ollama serve` + a pulled model | Fully local; use an uncensored model for unrestricted adult fiction |
| OpenAI-compatible | Base endpoint + API key (browser only) | OpenRouter, LM Studio, vLLM, etc. |
| WebLLM | A supported browser and a model explicitly downloaded in Local Models | Runs roleplay replies and memory summaries on-device with WebGPU; no network-provider fallback |

For server-backed providers, model name, endpoint, temperature (0.5–1.2), and
reply length (short / medium / long) are configurable. The API key is stored in
`localStorage` and sent per request; it is never committed to the repo. WebLLM
model selection and download controls are in Local Models instead.

### WebLLM on iPhone Safari

iOS 26+ Safari is the target, but support is determined by secure-context,
WebGPU, and compatible-adapter feature detection—not the iOS version alone.
Choose either model in **Local Models** and explicitly select **Download & load
model** before starting a roleplay chat:

- `Qwen3-0.6B-q4f16_1-MLC` — lightweight preset
- `Llama-3.2-1B-Instruct-q4f16_1-MLC`

The first download requires network access. The model is stored in browser
managed cache, which Safari may evict; cached/offline availability is not
guaranteed. Local Models also lets you unload the active model and explicitly
delete the selected model's cached files. If a model is unavailable or local
generation fails, WebLLM does not silently switch to a server provider. Image
Studio generation remains separate and may use its own configured image/video
services.
