/**
 * Server-side media provider adapters.
 *
 * Adding a provider is two edits, no new routes:
 *   1. describe it in `src/providers/catalog.ts` (UI metadata + models)
 *   2. add one entry to `providerAdapters` below
 *
 * Every adapter receives already-validated input and returns media URLs. The
 * shared helpers handle auth headers, error extraction and async job polling,
 * because most hosted APIs are submit-then-poll.
 */
import type { CustomProviderConfig } from '../types';
import type { MediaKind, MediaProviderId } from '../providers/catalog';

const POLL_INTERVAL_MS = 2_500;
const POLL_TIMEOUT_MS = 240_000;

export class ProviderError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
}

export interface ProviderCredentials {
  key?: string;
  accountId?: string;
  baseUrl?: string;
}

export interface ProviderGenerateInput {
  provider: MediaProviderId;
  model?: string;
  kind: MediaKind;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  seed?: number;
  steps?: number;
  cfgScale?: number;
  credentials?: ProviderCredentials;
  custom?: Partial<CustomProviderConfig>;
}

export interface ProviderGenerateResult {
  mediaUrls: string[];
  seed: number;
  provider: MediaProviderId;
  model: string;
  kind: MediaKind;
}

const ENV_KEYS: Partial<Record<MediaProviderId, string>> = {
  huggingface: 'HUGGINGFACE_API_KEY',
  leonardo: 'LEONARDO_API_KEY',
  replicate: 'REPLICATE_API_TOKEN',
  byteplus: 'BYTEPLUS_API_KEY',
  cloudflare: 'CLOUDFLARE_API_TOKEN',
  openai: 'OPENAI_IMAGE_API_KEY',
};

export const providerEnvVar = (provider: MediaProviderId): string | undefined =>
  ENV_KEYS[provider];

export const hasServerKey = (provider: MediaProviderId): boolean => {
  const envVar = ENV_KEYS[provider];
  if (!envVar) return false;
  const value = process.env[envVar];
  return typeof value === 'string' && value.trim().length > 0;
};

const requireKey = (supplied: string | undefined, provider: MediaProviderId, label: string) => {
  const key = supplied?.trim() || process.env[ENV_KEYS[provider] || '']?.trim();
  if (!key) {
    throw new ProviderError(
      `No API key for ${label}. Add ${ENV_KEYS[provider] || 'a key'} to the server environment, or paste a key in Settings → Generation Providers.`,
      400
    );
  }
  return key;
};

const normalizeBase = (value: string) => value.replace(/\/+$/, '');

const authHeaders = (key: string): Record<string, string> => ({
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractError = (payload: any): string | null => {
  if (!payload) return null;
  if (typeof payload === 'string') return payload.slice(0, 400);
  const candidates = [
    payload.error,
    payload.message,
    payload.detail,
    payload.errors?.[0]?.message,
    payload.errors?.[0],
    payload.data?.error,
    payload.data?.[0]?.error,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.slice(0, 400);
    if (candidate && typeof candidate === 'object' && typeof candidate.message === 'string') {
      return candidate.message.slice(0, 400);
    }
  }
  return null;
};

async function fetchJson(url: string, init: RequestInit, signal?: AbortSignal): Promise<any> {
  const response = await fetch(url, { ...init, signal });
  const text = await response.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    throw new ProviderError(
      extractError(parsed) || `Provider returned ${response.status} ${response.statusText}`,
      response.status
    );
  }
  if (parsed === null) throw new ProviderError('Provider returned a non-JSON response.');
  return parsed;
}

interface PollOptions {
  urlFor: () => string;
  headers: Record<string, string>;
  isDone: (payload: any) => boolean;
  isFailed?: (payload: any) => boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Shared submit-then-poll loop used by Leonardo, Replicate, BytePlus and custom. */
async function pollJson(options: PollOptions): Promise<any> {
  const deadline = Date.now() + (options.timeoutMs ?? POLL_TIMEOUT_MS);
  let lastPayload: any = null;

  while (Date.now() < deadline) {
    if (options.signal?.aborted) throw new ProviderError('Generation cancelled', 499);
    const payload = await fetchJson(options.urlFor(), { headers: options.headers }, options.signal);
    lastPayload = payload;

    if (options.isFailed?.(payload)) {
      throw new ProviderError(extractError(payload) || 'The provider reported a failed job.');
    }
    if (options.isDone(payload)) return payload;
    await sleep(POLL_INTERVAL_MS);
  }

  throw new ProviderError(
    `The provider did not finish within ${Math.round(
      (options.timeoutMs ?? POLL_TIMEOUT_MS) / 1000
    )}s.`,
    504
  );
}

/** Dot/bracket path lookup: `data.0.url`, `output[0]`, `generations[0].url`. */
const readPath = (value: any, path?: string): any => {
  if (!path) return value;
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((segment) => segment.length > 0)
    .reduce<any>((acc, segment) => (acc == null ? undefined : acc[segment]), value);
};

const isMediaValue = (value: unknown): value is string =>
  typeof value === 'string' &&
  (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:'));

/** Pull media URLs out of loosely shaped provider payloads (Replicate, custom). */
const collectMediaUrls = (value: any, depth = 0): string[] => {
  if (depth > 5 || value == null) return [];
  if (isMediaValue(value)) return [value];
  if (Array.isArray(value)) return value.flatMap((entry) => collectMediaUrls(entry, depth + 1));
  if (typeof value === 'object') {
    const preferredKeys = ['url', 'video_url', 'image_url', 'image', 'images', 'output', 'b64_json'];
    const urls: string[] = [];
    for (const key of preferredKeys) {
      if (key in value) urls.push(...collectMediaUrls((value as any)[key], depth + 1));
    }
    return urls;
  }
  return [];
};

const sizeToAspectRatio = (width?: number, height?: number): string => {
  if (!width || !height) return '1:1';
  const ratio = width / height;
  const known: Array<[string, number]> = [
    ['1:1', 1],
    ['9:16', 9 / 16],
    ['16:9', 16 / 9],
    ['4:3', 4 / 3],
    ['3:4', 3 / 4],
    ['3:2', 3 / 2],
    ['2:3', 2 / 3],
  ];
  let best = known[0];
  for (const entry of known) {
    if (Math.abs(entry[1] - ratio) < Math.abs(best[1] - ratio)) best = entry;
  }
  return best[0];
};

const resolveSeed = (seed?: number) =>
  typeof seed === 'number' && seed > 0 ? seed : Math.floor(Math.random() * 99_999_999);

const resolveBase = (input: ProviderGenerateInput, fallback: string) =>
  normalizeBase(input.credentials?.baseUrl?.trim() || fallback);

const substituteTemplate = (template: string, variables: Record<string, string | number>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = variables[key];
    if (value === undefined || value === null) return '';
    // JSON-escape string values so quotes/newlines cannot break the body.
    return typeof value === 'number' ? String(value) : JSON.stringify(String(value)).slice(1, -1);
  });

/* ------------------------------------------------------------------ */
/* Adapters                                                            */
/* ------------------------------------------------------------------ */

const leonardoRoot = (baseUrl?: string) =>
  normalizeBase(baseUrl?.trim() || 'https://cloud.leonardo.ai/api/rest').replace(/\/v[12]$/, '');

const generateLeonardo: Adapter = async (input, signal) => {
  const key = requireKey(input.credentials?.key, 'leonardo', 'Leonardo.Ai');
  const root = leonardoRoot(input.credentials?.baseUrl);
  const model = input.model?.trim() || 'flux-schnell';
  const seed = resolveSeed(input.seed);
  const isVideo = input.kind === 'video';

  const parameters: Record<string, unknown> = {
    prompt: input.prompt,
    width: input.width ?? 1024,
    height: input.height ?? 1024,
    quantity: 1,
  };
  if (input.negativePrompt?.trim()) parameters.negative_prompt = input.negativePrompt.trim();
  if (isVideo) {
    parameters.duration = 5;
    parameters.motion_has_audio = false;
  } else {
    parameters.seed = seed;
    parameters.prompt_enhance = 'OFF';
    if (input.cfgScale) parameters.guidance_scale = input.cfgScale;
  }

  const submit = await fetchJson(
    `${root}/v2/generations`,
    {
      method: 'POST',
      headers: authHeaders(key),
      body: JSON.stringify({ model, public: false, parameters }),
    },
    signal
  );

  const generationId =
    readPath(submit, 'generate.generationId') ?? readPath(submit, 'sdGenerationJob.generationId');
  if (!generationId) throw new ProviderError('Leonardo.Ai did not return a generation id.');

  const final = await pollJson({
    urlFor: () => `${root}/v1/generations/${generationId}`,
    headers: { Authorization: `Bearer ${key}`, accept: 'application/json' },
    isDone: (payload) => readPath(payload, 'generations_by_pk.status') === 'COMPLETE',
    isFailed: (payload) => readPath(payload, 'generations_by_pk.status') === 'FAILED',
    signal,
  });

  const images: any[] = readPath(final, 'generations_by_pk.generated_images') || [];
  const mediaUrls = images
    .map((image) => image?.motionMP4URL || image?.url || image?.imageUrl)
    .filter(isMediaValue);

  if (mediaUrls.length === 0) {
    throw new ProviderError('Leonardo.Ai finished without returning a media URL.');
  }
  return { mediaUrls, seed, provider: 'leonardo', model, kind: input.kind };
};

const generateReplicate: Adapter = async (input, signal) => {
  const key = requireKey(input.credentials?.key, 'replicate', 'Replicate');
  const base = resolveBase(input, 'https://api.replicate.com/v1');
  const model = input.model?.trim() || 'black-forest-labs/flux-schnell';
  const seed = resolveSeed(input.seed);

  // Replicate validates the input schema per model and rejects unknown fields,
  // so only universally supported keys are sent.
  const payloadInput: Record<string, unknown> = {
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio || sizeToAspectRatio(input.width, input.height),
  };

  const isVersionHash = /^[0-9a-f]{64}$/i.test(model);
  const url = isVersionHash ? `${base}/predictions` : `${base}/models/${model}/predictions`;
  const body = isVersionHash ? { version: model, input: payloadInput } : { input: payloadInput };

  const submit = await fetchJson(
    url,
    {
      method: 'POST',
      headers: { ...authHeaders(key), Prefer: 'wait=60' },
      body: JSON.stringify(body),
    },
    signal
  );

  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  let final = submit;
  if (readPath(submit, 'status') !== 'succeeded') {
    const pollUrl = readPath(submit, 'urls.get');
    if (!pollUrl) throw new ProviderError('Replicate did not return a polling URL.');
    final = await pollJson({
      urlFor: () => pollUrl,
      headers,
      isDone: (payload) => readPath(payload, 'status') === 'succeeded',
      isFailed: (payload) => readPath(payload, 'status') === 'failed',
      signal,
    });
  }

  const mediaUrls = collectMediaUrls(readPath(final, 'output')).filter(
    (url) => input.kind === 'video' || !/\.(mp4|webm|mov)(\?|$)/i.test(url)
  );
  const usable = mediaUrls.length > 0 ? mediaUrls : collectMediaUrls(readPath(final, 'output'));

  if (usable.length === 0) {
    throw new ProviderError(extractError(final) || 'Replicate finished without a media URL.');
  }
  return { mediaUrls: usable, seed, provider: 'replicate', model, kind: input.kind };
};

const generateBytePlus: Adapter = async (input, signal) => {
  const key = requireKey(input.credentials?.key, 'byteplus', 'BytePlus ModelArk');
  const base = resolveBase(input, 'https://ark.ap-southeast.bytepluses.com');
  const model =
    input.model?.trim() ||
    (input.kind === 'video' ? 'seedance-1-0-pro-250528' : 'seedream-4-0-250828');
  const seed = resolveSeed(input.seed);
  const width = input.width ?? 1024;
  const height = input.height ?? 1024;

  if (input.kind === 'image') {
    const payload = await fetchJson(
      `${base}/api/v3/images/generations`,
      {
        method: 'POST',
        headers: authHeaders(key),
        body: JSON.stringify({
          model,
          prompt: input.prompt,
          size: `${width}x${height}`,
          response_format: 'url',
          watermark: false,
        }),
      },
      signal
    );

    const mediaUrls = collectMediaUrls(readPath(payload, 'data'));
    if (mediaUrls.length === 0) {
      throw new ProviderError('BytePlus returned no image URL.');
    }
    return { mediaUrls, seed, provider: 'byteplus', model, kind: 'image' };
  }

  const ratio = input.aspectRatio || sizeToAspectRatio(width, height);
  const text = `${input.prompt} --ratio ${ratio} --duration 5 --watermark false`;
  const submit = await fetchJson(
    `${base}/api/v3/contents/generations/tasks`,
    {
      method: 'POST',
      headers: authHeaders(key),
      body: JSON.stringify({ model, content: [{ type: 'text', text }] }),
    },
    signal
  );

  const taskId = readPath(submit, 'id');
  if (!taskId) throw new ProviderError('BytePlus did not return a task id.');

  const final = await pollJson({
    urlFor: () => `${base}/api/v3/contents/generations/tasks/${taskId}`,
    headers: { Authorization: `Bearer ${key}` },
    isDone: (payload) => readPath(payload, 'status') === 'succeeded',
    isFailed: (payload) => readPath(payload, 'status') === 'failed',
    signal,
  });

  const videoUrl =
    readPath(final, 'content.video_url') || readPath(final, 'content[0].video_url');
  if (!isMediaValue(videoUrl)) {
    throw new ProviderError('BytePlus finished without a video URL.');
  }
  return { mediaUrls: [videoUrl], seed, provider: 'byteplus', model, kind: 'video' };
};

const generateCloudflare: Adapter = async (input, signal) => {
  const key = requireKey(input.credentials?.key, 'cloudflare', 'Cloudflare Workers AI');
  const accountId =
    input.credentials?.accountId?.trim() || process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (!accountId) {
    throw new ProviderError(
      'Cloudflare Workers AI needs an account ID. Paste it in Settings → Generation Providers, or set CLOUDFLARE_ACCOUNT_ID on the server.',
      400
    );
  }

  const base = resolveBase(input, 'https://api.cloudflare.com/client/v4');
  const model = input.model?.trim() || '@cf/black-forest-labs/flux-1-schnell';
  const isFlux = model.includes('flux');

  const body: Record<string, unknown> = { prompt: input.prompt };
  if (isFlux) {
    body.steps = Math.min(Math.max(input.steps ?? 4, 1), 8);
  } else {
    body.num_steps = Math.min(Math.max(input.steps ?? 20, 1), 40);
    body.width = input.width ?? 1024;
    body.height = input.height ?? 1024;
  }

  const response = await fetch(
    `${base}/accounts/${accountId}/ai/run/${model.replace(/^\/+/, '')}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    }
  );

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    throw new ProviderError(
      extractError(parsed) || `Cloudflare Workers AI returned ${response.status}`,
      response.status
    );
  }

  if (contentType.startsWith('image/')) {
    const buffer = Buffer.from(await response.arrayBuffer());
    const mediaUrls = [`data:${contentType};base64,${buffer.toString('base64')}`];
    return {
      mediaUrls,
      seed: resolveSeed(input.seed),
      provider: 'cloudflare',
      model,
      kind: 'image',
    };
  }

  const payload = await response.json();
  const mediaUrls = collectMediaUrls(readPath(payload, 'result'));
  if (mediaUrls.length === 0) {
    throw new ProviderError(extractError(payload) || 'Cloudflare returned no image.');
  }
  return {
    mediaUrls,
    seed: resolveSeed(input.seed),
    provider: 'cloudflare',
    model,
    kind: 'image',
  };
};

const openAiSize = (model: string, width: number, height: number): string => {
  if (model.startsWith('dall-e-3')) {
    const ratio = width / height;
    if (ratio > 1.3) return '1792x1024';
    if (ratio < 0.77) return '1024x1792';
    return '1024x1024';
  }
  if (model.startsWith('gpt-image')) {
    const ratio = width / height;
    if (ratio > 1.2) return '1536x1024';
    if (ratio < 0.83) return '1024x1536';
    return '1024x1024';
  }
  return `${width}x${height}`;
};

const generateOpenAiImage: Adapter = async (input, signal) => {
  const key = requireKey(input.credentials?.key, 'openai', 'the OpenAI-compatible endpoint');
  const base = resolveBase(input, 'https://api.openai.com/v1');
  const model = input.model?.trim() || 'gpt-image-1';
  const width = input.width ?? 1024;
  const height = input.height ?? 1024;

  const body: Record<string, unknown> = {
    model,
    prompt: input.prompt,
    n: 1,
    size: openAiSize(model, width, height),
  };
  // gpt-image-1 always returns b64; older endpoints accept the flag.
  if (!model.startsWith('gpt-image')) body.response_format = 'b64_json';

  const payload = await fetchJson(
    `${base}/images/generations`,
    { method: 'POST', headers: authHeaders(key), body: JSON.stringify(body) },
    signal
  );

  const entry = readPath(payload, 'data.0') || readPath(payload, 'data[0]') || {};
  const b64 = entry?.b64_json;
  const mediaUrls: string[] = [];

  if (typeof b64 === 'string' && b64.length > 0) {
    mediaUrls.push(`data:image/png;base64,${b64}`);
  } else {
    mediaUrls.push(...collectMediaUrls(entry));
  }

  if (mediaUrls.length === 0) {
    throw new ProviderError(extractError(payload) || 'The image endpoint returned no image.');
  }
  return { mediaUrls, seed: resolveSeed(input.seed), provider: 'openai', model, kind: 'image' };
};

const generateCustom: Adapter = async (input, signal) => {
  const config = input.custom;
  if (!config?.baseUrl?.trim()) {
    throw new ProviderError(
      'No custom endpoint configured. Fill in Settings → Generation Providers → Custom JSON endpoint.',
      400
    );
  }

  const model = input.model?.trim() || config.model?.trim() || '';
  const seed = resolveSeed(input.seed);
  const variables: Record<string, string | number> = {
    prompt: input.prompt,
    negative: input.negativePrompt || '',
    negative_prompt: input.negativePrompt || '',
    width: input.width ?? 1024,
    height: input.height ?? 1024,
    aspect_ratio: input.aspectRatio || sizeToAspectRatio(input.width, input.height),
    seed,
    model,
  };

  let extraHeaders: Record<string, string> = {};
  if (config.headers?.trim()) {
    try {
      extraHeaders = JSON.parse(config.headers);
    } catch {
      throw new ProviderError('Custom provider headers must be a JSON object.', 400);
    }
  }

  const key = input.credentials?.key?.trim() || config.apiKey?.trim() || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  };

  const rawBody = substituteTemplate(
    config.bodyTemplate?.trim() || '{"prompt": "{{prompt}}"}',
    variables
  );

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    throw new ProviderError('Custom provider body template is not valid JSON after substitution.', 400);
  }

  let payload = await fetchJson(
    config.baseUrl.trim(),
    { method: 'POST', headers, body: JSON.stringify(parsedBody) },
    signal
  );

  if (config.pollUrl?.trim() && config.jobIdPath?.trim()) {
    const jobId = readPath(payload, config.jobIdPath);
    if (jobId === undefined || jobId === null) {
      throw new ProviderError(
        `Custom provider did not return a job id at "${config.jobIdPath}".`,
        502
      );
    }
    const pollUrl = substituteTemplate(config.pollUrl, { ...variables, jobId: String(jobId) });
    const statusPath = config.statusPath?.trim() || 'status';
    const done = (config.doneValue || 'succeeded').toLowerCase();
    payload = await pollJson({
      urlFor: () => pollUrl,
      headers,
      isDone: (candidate) =>
        String(readPath(candidate, statusPath) ?? '').toLowerCase() === done ||
        (config.resultPath
          ? collectMediaUrls(readPath(candidate, config.resultPath)).length > 0
          : false),
      isFailed: (candidate) => String(readPath(candidate, statusPath) ?? '').toLowerCase() === 'failed',
      signal,
    });
  }

  const mediaUrls = config.resultPath?.trim()
    ? collectMediaUrls(readPath(payload, config.resultPath))
    : collectMediaUrls(payload);

  if (mediaUrls.length === 0) {
    throw new ProviderError(
      `Custom provider returned no media URL${
        config.resultPath ? ` at "${config.resultPath}"` : ''
      }.`,
      502
    );
  }

  return { mediaUrls, seed, provider: 'custom', model: model || 'custom', kind: input.kind };
};

type Adapter = (
  input: ProviderGenerateInput,
  signal?: AbortSignal
) => Promise<ProviderGenerateResult>;

export const providerAdapters: Partial<Record<MediaProviderId, Adapter>> = {
  leonardo: generateLeonardo,
  replicate: generateReplicate,
  byteplus: generateBytePlus,
  cloudflare: generateCloudflare,
  openai: generateOpenAiImage,
  custom: generateCustom,
};

/** Dispatch a generation to the configured provider adapter. */
export async function generateWithProvider(
  input: ProviderGenerateInput,
  signal?: AbortSignal
): Promise<ProviderGenerateResult> {
  const adapter = providerAdapters[input.provider];
  if (!adapter) {
    throw new ProviderError(
      `"${input.provider}" is not a server-side provider. Add an adapter in src/server/providerAdapters.ts.`,
      400
    );
  }
  return adapter(input, signal);
}
