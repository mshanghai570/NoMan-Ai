# Generation Providers

How image/video backends plug into NoMan AI, and how the roleplay stack compares
to SpicyChat.

## The registry

Two files. No new routes, no client branches.

| File | Responsibility |
| --- | --- |
| `src/providers/catalog.ts` | UI metadata: label, credential fields, env var, default base URL, preset models |
| `src/server/providerAdapters.ts` | Server-side HTTP adapter: auth, submit, poll, extract media URLs |
| `src/server/apiHandler.ts` | `POST /api/providers/generate`, `GET /api/providers` |
| `src/services/imageGenerator.ts` | Forwards proxied providers to the API; keeps Pollinations/HF/local in the browser |

### Add a provider in two steps

1. **Describe it** in `MEDIA_PROVIDERS`:

```ts
{
  id: 'myprovider',
  label: 'My Provider',
  blurb: 'What it is good for.',
  supports: ['image'],
  envVar: 'MYPROVIDER_API_KEY',
  keyLabel: 'API key',
  docsUrl: 'https://…',
  defaultBaseUrl: 'https://api.myprovider.com/v1',
  editableBaseUrl: true,
  models: [{ id: 'model-a', label: 'Model A', type: 'image' }],
}
```

Add the id to `AIProvider` in `src/types/index.ts` and to
`SERVER_PROXY_PROVIDERS` if it needs a key or CORS bypass.

2. **Implement the adapter** in `providerAdapters`:

```ts
const generateMine: Adapter = async (input, signal) => {
  const key = requireKey(input.credentials?.key, 'myprovider', 'My Provider');
  const base = resolveBase(input, 'https://api.myprovider.com/v1');

  const submit = await fetchJson(`${base}/generate`, {
    method: 'POST',
    headers: authHeaders(key),
    body: JSON.stringify({ prompt: input.prompt, width: input.width, height: input.height }),
  }, signal);

  // Synchronous response:
  return { mediaUrls: [submit.url], seed: input.seed || 1, provider: 'myprovider', model: input.model || 'model-a', kind: input.kind };
};

export const providerAdapters = { …, myprovider: generateMine };
```

For submit-then-poll APIs use `pollJson` (Leonardo, BytePlus and Replicate show
the pattern). `POLL_INTERVAL_MS` is 2.5s and the ceiling is 240s.

Preset models appear in Image Studio automatically. Models already stored in
`localStorage` are merged with new presets on load, so shipping a provider does
not require the user to reset settings.

## Credentials

Resolution order: key pasted in **Settings → Generation Providers** → env var.

Server env vars (see `.env.example`):

| Provider | Env | Notes |
| --- | --- | --- |
| Leonardo.Ai | `LEONARDO_API_KEY` | Also serves Seedream and Seedance models |
| Replicate | `REPLICATE_API_TOKEN` | owner/model slug or a 64-char version hash |
| BytePlus ModelArk | `BYTEPLUS_API_KEY` | Direct Seedream / Seedance |
| Cloudflare Workers AI | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | Binary image responses are returned as data URLs |
| Hugging Face | `HUGGINGFACE_API_KEY` | Existing token field also works |
| OpenAI-compatible | `OPENAI_IMAGE_API_KEY` | Any `/images/generations` relay |

Keys pasted in Settings live in `localStorage` and are sent per request, like the
existing Hugging Face token. Prefer env vars for anything shared.

## Provider notes

- **Leonardo** — `POST /api/rest/v2/generations` then poll
  `/api/rest/v1/generations/{id}` until `generations_by_pk.status === "COMPLETE"`.
  Image URLs live in `generated_images[].url`, video in `motionMP4URL`. One key
  covers FLUX, Seedream 4.0/4.5, Nano Banana and Seedance.
- **Replicate** — sends only `prompt` and `aspect_ratio`, because Replicate
  validates each model's input schema and rejects unknown fields. For
  model-specific knobs (steps, guidance, LoRAs) use the **custom JSON endpoint**
  with that model's exact schema, or extend the adapter.
- **BytePlus** — Seedream uses `/api/v3/images/generations`; Seedance creates a
  task on `/api/v3/contents/generations/tasks` and is polled to
  `content.video_url`. Video parameters are passed as text flags
  (`--ratio 16:9 --duration 5`).
- **Cloudflare Workers AI** — `@cf/black-forest-labs/flux-1-schnell` caps steps
  at 8; the adapter clamps them. Other models use `num_steps`.
- **Pollinations** — keyless, called directly from the browser, unchanged.
- **Perchance** — no official public API. It is a browser generator, not an
  inference endpoint. Options are: (a) run it manually and import the file,
  (b) put a small proxy in front of it and register that with the custom JSON
  endpoint, (c) use an OpenAI-compatible relay. The app deliberately does not
  scrape it.
- **Hugging Face** — the existing `/api/hf/generate` path is untouched and still
  falls back to Pollinations if the call fails.

## Custom JSON endpoint (the "workflow" escape hatch)

Settings → Generation Providers → Custom JSON endpoint. Fields:

- **Body template** — JSON with `{{prompt}}`, `{{negative}}`,
  `{{width}}`, `{{height}}`, `{{seed}}`, `{{model}}`, `{{aspect_ratio}}`.
  String values are JSON-escaped before substitution, so quotes and newlines in
  a prompt cannot break the body.
- **Extra headers** — JSON object, e.g. `{"X-API-Key":"…"}`.
- **Result path** — dot/bracket path to the media URL, e.g. `data.0.url`,
  `output[0]`.
- **Poll URL / job id path / done value** — for async APIs: the URL template
  (`https://host/jobs/{{jobId}}`), where the job id appears in the submit
  response, and the status string that means finished (default `succeeded`).

Then register models for it under **Custom Models** with provider `custom`.

Example: a ComfyUI wrapper that returns `{ "images": [{ "url": "…" }] }`

```
baseUrl:   https://my-worker.example.com/generate
body:      {"prompt":"{{prompt}}","width":{{width}},"height":{{height}}}
resultPath: images.0.url
```

## Video

`POST /api/providers/generate` accepts `kind: "video"` and the BytePlus,
Leonardo and Replicate adapters all support it. The Video Studio still renders
its motion clips with the local canvas engine; pointing its text-to-video button
at a cloud model is a UI change, not a new provider. Until that lands, cloud
video is reachable through the API and the custom endpoint.

## Roleplay: Kilo

Two different things share the Kilo name:

- **Kilo's desktop/IDE custom modes** are prompt bundles inside that app. They
  cannot be imported or called by NoMan AI, and NoMan AI already builds a
  stronger character prompt (character bible, identity lock, memory block,
  anti-repetition list) per request. A Kilo mode's system prompt text can be
  pasted into a custom persona's `systemPrompt` if you want its flavour.
- **The Kilo AI Gateway** is a real API:
  `https://ai-gateway.kilo.ai/api/v1`, OpenAI-compatible, `Authorization: Bearer
  <KILO_API_KEY>`. Model ids ending in `:free` work with no key at 200
  requests/hour per IP; a key raises that. It ships as a chat provider
  preset (**Settings → Roleplay Engine → Kilo Gateway**) with the free model ids
  in `KILO_FREE_MODELS` and the Character / Narrator / DM agent-mode prompts, so
  its free models can drive roleplay, memory summaries and scene prompts.

## SpicyChat parity

| SpicyChat feature | NoMan AI today |
| --- | --- |
| Per-bot NSFW toggle | Yes — per character, with 18+ gate |
| Persona/character cards | Yes — built-in presets and custom personas |
| Long-term memory | Yes — rolling summary + durable facts + relationship |
| Character-consistent image prompts | Yes — `/api/chat/scene-prompt` |
| Local/uncensored model | Yes — Ollama, WebLLM, any OpenAI-compatible endpoint |
| Regenerate / swipe / edit replies | Not yet |
| Group ("squad") chats | Not yet |
| Lorebooks / world info | Not yet; scenario + memory are the current mechanism |
| Tavern card import/export | Not yet |

The engine is provider-agnostic: switching to a permissive provider changes
prompt policy only, not memory or the character contract.
