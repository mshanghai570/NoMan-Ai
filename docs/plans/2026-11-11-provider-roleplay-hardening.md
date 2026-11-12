# Provider and Roleplay Hardening Plan

## Goal

Make NoMan AI easier to extend with hosted image/video providers and reliable for Kilo-style roleplay agent modes, while keeping provider policy, credential handling, and asynchronous generation behavior explicit.

## Scope

1. Repair the dependency graph so the repository installs reproducibly with the current Vite 8 peer requirements.
2. Make the media catalog the source of truth for provider capabilities, credentials, server-side status, and model presets.
3. Harden the server provider boundary:
   - validate provider, kind, model, prompt, dimensions, and URLs;
   - prevent unsafe arbitrary server fetches by default;
   - expose dynamic provider readiness instead of a hard-coded list;
   - preserve provider-specific async polling while returning a normalized result.
4. Add a normalized video-generation client path and connect cloud text-to-video to the existing provider registry; keep local canvas rendering for image-to-video/extension workflows unless a provider-specific image-input contract is available.
5. Make Kilo roleplay behavior accurate and resilient:
   - preserve `kiloApiKey` as the canonical Kilo credential;
   - keep custom agent modes in the shared prompt path;
   - label free routing as rate-limited/policy-bound rather than “uncensored”;
   - fall back to local Ollama only when configured and no output has streamed.
6. Add regression tests for catalog capability discovery, provider status, custom endpoint validation, normalized video requests, and Kilo prompt/key routing.
7. Update provider and roleplay docs with the durable job/adapter model and the current integration limits: SpicyChat is not a supported backend, Kilo is chat-only, and media providers remain policy-bound.

## Implementation order

- Update `package.json`, install dependencies, and capture the lockfile.
- Extend types/catalog metadata and provider status helpers.
- Harden `providerAdapters.ts` and `apiHandler.ts` without changing existing public routes.
- Add `ImageGeneratorService.generateVideo` and wire cloud text-to-video in `VideoStudioView.tsx`.
- Correct Kilo/settings copy and roleplay config handling.
- Add/adjust tests and documentation.
- Run `npm run lint`, the server test suite through the supported TypeScript runner, and `npm run build`; inspect the final diff and working tree before reporting completion.

## Non-goals

- Do not scrape or automate SpicyChat.
- Do not claim Kilo free models are unrestricted or guaranteed to allow adult content.
- Do not add provider-specific model schemas for every Replicate community model; keep custom JSON workflows as the escape hatch.
- Do not silently bypass provider safety systems or terms.
