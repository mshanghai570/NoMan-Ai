# NSFW Roleplay Chat Mode

Per-character mature mode for the Roleplay Chat tab, modeled on SpicyChat's
per-bot NSFW toggle.

## What was added

| Layer | File | Behavior |
| --- | --- | --- |
| Types | `src/types/index.ts` | `ChatNsfwMode`, `UserSettings.chatNsfwMode`, `UserSettings.chatAgeVerified`, `ChatMessage.isNsfw` |
| Storage | `src/services/storage.ts` | Global default + `noman_chat_nsfw_overrides` map (per character), included in JSON export/import |
| UX | `src/components/ChatView.tsx` | Flame toggle in the chat header, 18+ badge, mature-mode banner, `nsfw` flag sent to the API |
| UX | `src/components/AgeGateModal.tsx` | One-time 18+ self-attestation gate |
| UX | `src/components/SettingsView.tsx` | Master default toggle + verification status |
| API | `src/server/apiHandler.ts` | Mature system-prompt contract, `BLOCK_NONE` safety settings, trailing-turn dedupe |

## How the toggle works

1. First enable asks for 18+ confirmation. The result is stored locally
   (`chatAgeVerified`) and is **not** uploaded.
2. Each character gets its own override in `noman_chat_nsfw_overrides`, so one
   chat can be SFW while another is mature.
3. The global preference in **Settings → Roleplay Chat Maturity** sets the
   default for chats without an override. Turning it off clears all overrides.
4. Setting **Content Filter → Safe Mode** hard-blocks mature chat regardless of
   any per-character toggle.
5. Requests send `nsfw: true`, which switches the server-side system prompt and
   relaxes Gemini safety thresholds for that request only.

## Hard limits enforced server-side

Every mature prompt states that all characters are adults and forbids minors,
incest, bestiality, sexual violence, coercion, and real identifiable people.
Declines stay in character.

## Important provider limitation

The roleplay engine supports three providers (see
[`ROLEPLAY_ENGINE.md`](./ROLEPLAY_ENGINE.md)): Google Gemini, Ollama, and any
OpenAI-compatible endpoint. Gemini applies its own policy layer on top of
`safetySettings`, so it can still refuse explicit sexual content even with
`BLOCK_NONE`. The UI says so in the mature banner.

To match SpicyChat's actual content latitude you need a provider that permits
adult fiction:

- a local Ollama model (e.g. an uncensored community model), or
- an OpenRouter / self-hosted OpenAI-compatible endpoint.

Select it under **Settings → Roleplay Engine**. The same `systemInstruction` +
`nsfw` flag is routed to whichever provider is configured, so the prompt
contract, memory, and toggle behave identically.

## Before shipping publicly

- Age gate is self-attestation, not real age assurance.
- Add server-side rate limiting and abuse logging.
- Publish Terms of Service and an Acceptable Use policy (18+, fictional adults).
- Keep a moderation/report path for generated content.
- Follow payment-processor and app-store policies for adult content.
