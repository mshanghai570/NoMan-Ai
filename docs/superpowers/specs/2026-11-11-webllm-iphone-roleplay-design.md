# On-Device WebLLM Roleplay Design

**Status:** Approved in design discussion; awaiting written-spec review

**Date:** 2026-11-11

## Goal

Add an optional WebLLM provider for roleplay chat that runs generation on the
user's device with WebGPU. Preserve Gemini, Ollama, and OpenAI-compatible
providers. Optimize the initial model choices for iPhone Safari rather than
assuming every WebGPU device can load every model.

## Non-goals

- Replace existing chat providers or silently route their traffic to WebLLM.
- Run image or video generation locally.
- Guarantee browser storage survives iOS eviction, or that the whole app works
  offline.
- Treat model-generated content as a reliable safety filter.

## Architecture

WebLLM is a client-side provider, not a server endpoint. Add `webllm` to
`ChatProvider` and branch in the client roleplay engine before any `/api/chat/*`
request. Keep the existing server routes and provider flow unchanged for all
other providers.

A lazily loaded browser service owns one WebLLM engine at a time. It exposes
WebGPU capability checks, model load/download progress, streaming completion,
interrupt, unload, cache detection, and removal of a selected model's cached
artifacts. Lazy-loading the library avoids adding its runtime to users who do
not select on-device chat.

Use the WebLLM prebuilt model IDs:

| Model | Role |
| --- | --- |
| `Qwen3-0.6B-q4f16_1-MLC` | Lightweight default for iPhone |
| `Llama-3.2-1B-Instruct-q4f16_1-MLC` | Alternative with a larger memory footprint |

These are quantized WebLLM model presets, not arbitrary Hugging Face model
names. Keep the catalog limited to presets verified against the installed
WebLLM version. The user can select a preset in Local Models; the existing
`chatModel` setting persists the selection.

## Model lifecycle and UI

Local Models is the explicit control point:

1. Detect WebGPU with feature detection and adapter creation, not only an iOS
   version check.
2. Show when WebGPU is unavailable or no adapter can be created.
3. Let the user select a supported model and explicitly download/load it.
   Show WebLLM's initialization progress and actionable errors.
4. Report whether the selected model is ready or present in the browser cache.
   Allow unloading it from memory and deleting its cached artifacts.
5. If WebLLM is selected in Settings but the model is not ready, chat explains
   that it must be downloaded in Local Models; sending a message does not start
   an unrequested large download.

The model files are fetched on first download and cached using WebLLM's
supported browser cache. Cache availability is best-effort: Safari may evict
site data, so the UI must not promise permanent storage or offline availability.
Changing models may require a new download and will replace the active in-memory
engine.

## Roleplay data flow

For the WebLLM provider:

1. Build the same bounded context, character identity instructions, memory
   block, avoid-phrase list, reply-length guidance, and mature-mode boundaries
   used by the current roleplay path.
2. Stream WebLLM output into the existing chat bubble callbacks.
3. On Stop, interrupt WebLLM generation and preserve any partial reply, matching
   current chat behavior.
4. Summarize older turns with WebLLM using the same memory schema and
   incremental marker. Validate the returned JSON; malformed output must not
   advance the marker or discard existing memory.
5. Use `buildLocalScenePrompt` for scene prompts so no conversation text is sent
   to `/api/chat/scene-prompt` in local mode. Portrait prompts remain
   deterministic as they are today.

Extract shared roleplay instruction/message construction into a browser-safe
utility so the existing server engine and WebLLM path use the same character
bible, dialogue contract, recent context, and content boundaries rather than
maintaining divergent copies.

## Privacy and failure behavior

Selecting WebLLM is an explicit device-only choice for roleplay text. Replies,
memory summaries, and scene-prompt construction must not call `/api/chat/*`,
Gemini, Ollama, or OpenAI-compatible endpoints. Do not use the configured
cloud-to-local fallback or fall back from WebLLM to a network provider. Show
capability, download, model-load, and generation failures to the user.

The initial model download itself requires network access. Once the model is
cached, inference can run without sending roleplay prompts to a provider, but
browser cache eviction and page availability still apply. Conversations and
memory continue to use the app's existing local browser storage. Image Studio
remains separate: if the user sends a generated scene prompt there, its image
provider behavior is unchanged.

The shared mature-mode prompt boundaries and existing age gate remain in force.
They are instructions to the model, not a guarantee of output moderation.

## Expected code touchpoints

- `package.json`: add `@mlc-ai/web-llm`.
- `src/types/index.ts`, `src/constants/chat.ts`, and `src/components/SettingsView.tsx`:
  add the provider and provider settings.
- `src/services/webLlmService.ts` (new): lazy runtime, capability, progress,
  active engine, stream interruption, and model-cache lifecycle.
- `src/services/chatEngine.ts`: route reply, memory, and scene operations to
  WebLLM/local helpers when selected.
- `src/utils/roleplayPrompt.ts` and `src/server/roleplayEngine.ts`: share
  browser-safe roleplay instruction construction.
- `src/components/LocalModelsView.tsx`: WebLLM model selection, readiness,
  download/load progress, errors, unload, and cache removal alongside the
  existing diagnostics and local endpoint tools.
- `src/components/ChatView.tsx`: display the on-device provider/model and
  explain when a model must first be loaded.
- `docs/ROLEPLAY_ENGINE.md`: document provider behavior and local privacy.

Conversation persistence and JSON export/import remain unchanged; model weights
are not added to exported backups.

## Verification

Automated checks:

- TypeScript lint (`npm run lint`).
- Production bundle (`npm run build`), including verification that WebLLM is
  lazy-loaded and the existing providers still build.

iPhone Safari acceptance checks on iOS 26+:

- WebGPU capability and adapter status are detected accurately.
- Explicit model download/load shows progress and the model becomes usable.
- WebLLM roleplay streams, stops with partial text preserved, and reloads a
  cached model.
- Switching back to existing providers preserves their prior behavior.
- With WebLLM selected, reply, memory, and scene-prompt actions produce no
  `/api/chat/*` requests and do not silently use a network provider.
- Clearing the selected model's cache causes the UI to request an explicit
  download again.

WebLLM references:

- [Basic usage and streaming API](https://webllm.mlc.ai/docs/user/basic_usage.html)
- [Prebuilt model configuration](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts)
