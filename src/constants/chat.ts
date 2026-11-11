import type { ChatProvider, ChatReplyLength } from '../types';
import { WEBLLM_MODELS } from '../services/webLlmService';

export interface ChatProviderPreset {
  id: ChatProvider;
  label: string;
  shortLabel: string;
  model: string;
  endpoint: string;
  requiresKey: boolean;
  hint: string;
}

export const CHAT_PROVIDER_PRESETS: Record<ChatProvider, ChatProviderPreset> = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini (server key)',
    shortLabel: 'Gemini',
    model: 'gemini-3.8-flash',
    endpoint: '',
    requiresKey: false,
    hint: 'Runs through the app server with GEMINI_API_KEY. Strong prose, but Google policy still filters explicit content.',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama / Local model',
    shortLabel: 'Ollama',
    model: 'llama3.2',
    endpoint: 'http://localhost:11434',
    requiresKey: false,
    hint: 'Fully local. Use an uncensored model for unrestricted roleplay. Requires Ollama running on the machine that hosts this app.',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI-compatible API',
    shortLabel: 'OpenAI API',
    model: 'openai/gpt-4o-mini',
    endpoint: 'https://openrouter.ai/api/v1',
    requiresKey: true,
    hint: 'OpenRouter, LM Studio, vLLM, or any /chat/completions endpoint. Key stays in this browser.',
  },
  webllm: {
    id: 'webllm',
    label: 'On-device WebGPU model',
    shortLabel: 'WebLLM',
    model: WEBLLM_MODELS[0].id,
    endpoint: '',
    requiresKey: false,
    hint: 'Runs roleplay inference on this device with WebGPU. Choose and explicitly load a model in Local Models; browser support and storage vary.',
  },
};

export const CHAT_PROVIDERS: ChatProviderPreset[] = [
  CHAT_PROVIDER_PRESETS.gemini,
  CHAT_PROVIDER_PRESETS.ollama,
  CHAT_PROVIDER_PRESETS.openai,
  CHAT_PROVIDER_PRESETS.webllm,
];

export const REPLY_LENGTHS: Array<{
  id: ChatReplyLength;
  label: string;
  hint: string;
}> = [
  { id: 'short', label: 'Short', hint: '2–4 sentences' },
  { id: 'medium', label: 'Medium', hint: '1–2 paragraphs' },
  { id: 'long', label: 'Long', hint: '2–3 paragraphs' },
];
