/**
 * Client-safe catalog of media generation providers.
 *
 * This file is the single place to describe a provider for the UI: label,
 * credential fields, default base URL, and the preset models it offers.
 * Requests leave the browser only for keyless providers; everything else goes
 * through `/api/providers/generate` so keys stay server-side when possible.
 */
import type { AIProvider } from '../types';

export type MediaKind = 'image' | 'video';

export type MediaProviderId = Extract<
  AIProvider,
  | 'pollinations'
  | 'huggingface'
  | 'leonardo'
  | 'replicate'
  | 'byteplus'
  | 'cloudflare'
  | 'openai'
  | 'custom'
>;

export interface ProviderCredentialField {
  /** Stored in `settings.providerKeys` as `${providerId}.${key}`. */
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
}

export interface ProviderModelPreset {
  id: string;
  label: string;
  type: MediaKind | 'both';
  note?: string;
}

export interface MediaProviderDefinition {
  id: MediaProviderId;
  label: string;
  blurb: string;
  supports: MediaKind[];
  /** No credential needed at all. */
  keyless?: boolean;
  /** Which env var the server reads when no key is pasted in Settings. */
  envVar?: string;
  keyLabel?: string;
  docsUrl?: string;
  /** Default API root. Shown in Settings so it can be overridden. */
  defaultBaseUrl?: string;
  editableBaseUrl?: boolean;
  credentialFields?: ProviderCredentialField[];
  models: ProviderModelPreset[];
}

export const MEDIA_PROVIDERS: MediaProviderDefinition[] = [
  {
    id: 'pollinations',
    label: 'Pollinations',
    blurb: 'Keyless FLUX / SDXL endpoints. Unlimited, no account.',
    supports: ['image'],
    keyless: true,
    models: [
      { id: 'flux', label: 'FLUX Schnell', type: 'image' },
      { id: 'flux-realism', label: 'FLUX Realism', type: 'image' },
      { id: 'flux-anime', label: 'FLUX Anime', type: 'image' },
      { id: 'turbo', label: 'SDXL Turbo', type: 'image' },
      { id: 'deliberate', label: 'Deliberate v2', type: 'image' },
    ],
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    blurb: 'Inference API for open weights. Uses the Hugging Face token below.',
    supports: ['image'],
    envVar: 'HUGGINGFACE_API_KEY',
    keyLabel: 'Hugging Face token',
    docsUrl: 'https://huggingface.co/settings/tokens',
    models: [
      { id: 'black-forest-labs/FLUX.1-schnell', label: 'FLUX.1 Schnell', type: 'image' },
      { id: 'black-forest-labs/FLUX.1-dev', label: 'FLUX.1 Dev', type: 'image' },
      { id: 'stabilityai/stable-diffusion-xl-base-1.0', label: 'SDXL 1.0', type: 'image' },
      { id: 'cagliostrolab/animagine-xl-3.1', label: 'Animagine XL 3.1', type: 'image' },
    ],
  },
  {
    id: 'leonardo',
    label: 'Leonardo.Ai',
    blurb: 'One key for FLUX, Seedream, Nano Banana and Seedance video.',
    supports: ['image', 'video'],
    envVar: 'LEONARDO_API_KEY',
    keyLabel: 'Leonardo API key',
    docsUrl: 'https://docs.leonardo.ai',
    defaultBaseUrl: 'https://cloud.leonardo.ai/api/rest',
    editableBaseUrl: true,
    models: [
      { id: 'flux-schnell', label: 'FLUX Schnell', type: 'image' },
      { id: 'flux-dev', label: 'FLUX Dev', type: 'image' },
      { id: 'seedream-4.0', label: 'Seedream 4.0', type: 'image', note: 'ByteDance' },
      { id: 'seedream-4.5', label: 'Seedream 4.5', type: 'image', note: 'ByteDance' },
      { id: 'gemini-2.5-flash-image', label: 'Nano Banana', type: 'image' },
      {
        id: 'bytedance/seedance-2.5',
        label: 'Seedance 2.5',
        type: 'video',
        note: 'ByteDance video',
      },
    ],
  },
  {
    id: 'replicate',
    label: 'Replicate',
    blurb: 'Hosted open models by owner/model slug or version hash.',
    supports: ['image', 'video'],
    envVar: 'REPLICATE_API_TOKEN',
    keyLabel: 'Replicate API token',
    docsUrl: 'https://replicate.com/account/api-tokens',
    defaultBaseUrl: 'https://api.replicate.com/v1',
    editableBaseUrl: true,
    models: [
      { id: 'black-forest-labs/flux-schnell', label: 'FLUX Schnell', type: 'image' },
      { id: 'black-forest-labs/flux-dev', label: 'FLUX Dev', type: 'image' },
      { id: 'black-forest-labs/flux-1.1-pro', label: 'FLUX 1.1 Pro', type: 'image' },
      { id: 'bytedance/seedream-4', label: 'Seedream 4', type: 'image' },
    ],
  },
  {
    id: 'byteplus',
    label: 'BytePlus ModelArk',
    blurb: 'Direct Seedream / Seedance API. Cheapest route to ByteDance models.',
    supports: ['image', 'video'],
    envVar: 'BYTEPLUS_API_KEY',
    keyLabel: 'ModelArk API key',
    docsUrl: 'https://docs.byteplus.com/en/docs/ModelArk',
    defaultBaseUrl: 'https://ark.ap-southeast.bytepluses.com',
    editableBaseUrl: true,
    models: [
      { id: 'seedream-4-0-250828', label: 'Seedream 4.0', type: 'image' },
      { id: 'seedream-3-0-t2i-250415', label: 'Seedream 3.0', type: 'image' },
      { id: 'seedance-1-0-pro-250528', label: 'Seedance 1.0 Pro', type: 'video' },
      { id: 'seedance-1-0-lite-t2v-250428', label: 'Seedance 1.0 Lite', type: 'video' },
    ],
  },
  {
    id: 'cloudflare',
    label: 'Cloudflare Workers AI',
    blurb: 'Cheap hourly-billed inference on the edge. Needs account ID + token.',
    supports: ['image'],
    envVar: 'CLOUDFLARE_API_TOKEN',
    keyLabel: 'API token',
    docsUrl: 'https://developers.cloudflare.com/workers-ai/models/',
    defaultBaseUrl: 'https://api.cloudflare.com/client/v4',
    editableBaseUrl: false,
    credentialFields: [
      {
        key: 'accountId',
        label: 'Account ID',
        placeholder: 'Cloudflare account ID',
      },
    ],
    models: [
      { id: '@cf/black-forest-labs/flux-1-schnell', label: 'FLUX.1 Schnell', type: 'image' },
      { id: '@cf/leonardo/lucid-origin', label: 'Lucid Origin', type: 'image' },
      { id: '@cf/leonardo/phoenix-1.0', label: 'Phoenix 1.0', type: 'image' },
      {
        id: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
        label: 'SDXL Base 1.0',
        type: 'image',
      },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI-compatible images',
    blurb: 'Any /images/generations relay — Fal, Together, a Perchance bridge, your own Worker.',
    supports: ['image'],
    envVar: 'OPENAI_IMAGE_API_KEY',
    keyLabel: 'API key',
    docsUrl: 'https://platform.openai.com/docs/api-reference/images',
    defaultBaseUrl: 'https://api.openai.com/v1',
    editableBaseUrl: true,
    models: [
      { id: 'gpt-image-1', label: 'GPT Image 1', type: 'image' },
      { id: 'dall-e-3', label: 'DALL·E 3', type: 'image' },
    ],
  },
  {
    id: 'custom',
    label: 'Custom JSON endpoint',
    blurb: 'Your own request body, headers and result path. Works with ComfyUI workflows, relays and self-hosted APIs.',
    supports: ['image', 'video'],
    editableBaseUrl: true,
    models: [],
  },
];

export const MEDIA_PROVIDER_MAP: Record<string, MediaProviderDefinition> = Object.fromEntries(
  MEDIA_PROVIDERS.map((provider) => [provider.id, provider])
);

export const getMediaProvider = (id: string): MediaProviderDefinition | undefined =>
  MEDIA_PROVIDER_MAP[id];

/** Providers whose HTTP calls must run on the server (CORS + secret keys). */
export const SERVER_PROXY_PROVIDERS: MediaProviderId[] = [
  'leonardo',
  'replicate',
  'byteplus',
  'cloudflare',
  'openai',
  'custom',
];

export const isServerProxyProvider = (id: string): boolean =>
  (SERVER_PROXY_PROVIDERS as string[]).includes(id);

/** `cloudflare.accountId` style key used in `settings.providerKeys`. */
export const providerKeySlot = (providerId: string, field?: string): string =>
  field ? `${providerId}.${field}` : providerId;

export const createPresetModels = (provider: MediaProviderDefinition) =>
  provider.models.map((model) => ({
    id: model.id,
    name: `${provider.label} · ${model.label}`,
    description: model.note
      ? `${model.label} via ${provider.label}. ${model.note}.`
      : `${model.label} via ${provider.label}.`,
    provider: provider.id as AIProvider,
    type: model.type,
    isCustom: false,
  }));
