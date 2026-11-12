# Generation Providers

How image/video backends plug into NoMan AI, and how the roleplay stack compares
to SpicyChat.

## The registry

Server providers use two files and no new routes. Browser-only providers may
also need one client adapter, as Perchance does.

| File | Responsibility |
| --- | --- |
| `src/providers/catalog.ts` | UI metadata: label, credential fields, env var, default base URL, preset models |
| `src/server/providerAdapters.ts` | Server-side HTTP adapter: auth, submit, poll, extract media URLs |
| `src/server/apiHandler.ts` | `POST /api/providers/generate`, `GET /api/providers` |
| `src/services/imageGenerator.ts` | Forwards proxied providers to the API and owns browser-only workflows such as Pollinations, Perchance, and HF |

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
| Leonardo.Ai | `LEONARDO_API_KEY` | Image generation; image-to-video needs a separate documented upload/task workflow |
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
  Image URLs live in `generated_images[].url`. The registry currently exposes
  Leonardo as image-only because its image-to-video flow requires uploading an
  init image and using a separate task contract; use BytePlus, Replicate, or a
  custom workflow for video until that flow is implemented.
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
- **Pollinations** — direct image/video routes are supported by the client for
  compatible models. Keyless availability, authentication, model behavior, and
  provider safety can change; the app does not promise unlimited access.
- **Perchance** — the official Image API is supported in Image Studio through a
  hidden browser iframe and `postMessage`; this is intentionally not routed
  through the server because the published API is browser-oriented. The official
  Perchance video and roleplay pages currently document browser experiences but
  not stable external API contracts. Do not scrape their internal calls. Use
  Custom JSON only with an explicitly permitted Perchance bridge or relay.
- **Hugging Face** — the existing `/api/hf/generate` path is untouched and still
  falls back to Pollinations if the call fails.

## Custom JSON endpoint (the "workflow" escape hatch)

Settings → Generation Providers → Custom JSON endpoint. Fields:

The direct Perchance Image API is not configured here: its supported external
contract is an iframe that returns through `postMessage`, so Image Studio has a
dedicated **Perchance Official Image API** provider. Use this form only for a
Perchance generator or bridge that explicitly documents a normal JSON endpoint
and permits your application to call it.

- **Body template** — JSON with `{{prompt}}`, `{{negative}}`,
  `{{width}}`, `{{height}}`, `{{duration}}`, `{{seed}}`, `{{model}}`,
  `{{aspect_ratio}}`.
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

`POST /api/providers/generate` accepts `kind: "video"` for the BytePlus,
Replicate, and Custom JSON adapters. Pollinations text-to-video uses its direct
client URL path. Video Studio routes text-to-video through the selected cloud
adapter; image-to-video and timeline extension remain local canvas workflows
unless a provider-specific image-input contract is configured.

## Roleplay: Kilo

Two different things share the Kilo name:

- **Kilo's desktop/IDE custom modes** are prompt bundles inside that app. They
  cannot be imported or called by NoMan AI, and NoMan AI already builds a
  stronger character prompt (character bible, identity lock, memory block,
  anti-repetition list) per request. A Kilo mode's system prompt text can be
  pasted into a custom persona's `systemPrompt` if you want its flavour.
- **The Kilo AI Gateway** is a real API:
  `https://ai-gateway.kilo.ai/api/v1`, OpenAI-compatible, `Authorization: Bearer
  <KILO_API_KEY>`. Free routes may work without a key but are rate-limited and
  remain subject to the upstream provider's policy; they are not an uncensored
  guarantee. It ships as a chat provider preset (**Settings → Roleplay Engine →
  Kilo Gateway**) with free model ids in `KILO_FREE_MODELS` and the Character /
  Narrator / DM agent-mode prompts, so the gateway can drive roleplay, memory
  summaries, and scene prompts.

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
