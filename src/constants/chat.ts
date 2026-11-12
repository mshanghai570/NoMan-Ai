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
  kilo: {
    id: 'kilo',
    label: 'Kilo AI Gateway (Free & Open Models)',
    shortLabel: 'Kilo Gateway',
    model: 'kilo-auto/free',
    endpoint: 'https://ai-gateway.kilo.ai/api/v1',
    requiresKey: false,
    hint: 'Kilo Gateway provides free, rate-limited model routes plus custom agent modes (Character, Narrator, DM). Provider policy still applies; use Ollama or another permitted local endpoint when you need full control.',
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
  CHAT_PROVIDER_PRESETS.kilo,
  CHAT_PROVIDER_PRESETS.gemini,
  CHAT_PROVIDER_PRESETS.ollama,
  CHAT_PROVIDER_PRESETS.openai,
  CHAT_PROVIDER_PRESETS.webllm,
];

export const KILO_FREE_MODELS = [
  {
    id: 'kilo-auto/free',
    name: 'Auto Free (Best Free Tier)',
    description: 'Auto-routes requests to the best available free model on Kilo Gateway.',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B Instruct (Free)',
    description: 'Flagship open weights model with rich narrative prose and dialogue.',
  },
  {
    id: 'deepseek/deepseek-chat:free',
    name: 'DeepSeek V3 / Chat (Free)',
    description: 'Exceptional creative writing, character immersion, and reasoning.',
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct:free',
    name: 'Nemotron 70B (Free)',
    description: 'NVIDIA conversational model fine-tuned for nuanced human interaction.',
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct:free',
    name: 'Qwen 2.5 72B (Free)',
    description: 'Vast knowledge base and high context window for deep storytelling.',
  },
];

export const AGENT_MODES: Array<{
  id: import('../types').AgentMode;
  name: string;
  tagline: string;
  description: string;
}> = [
  {
    id: 'character',
    name: 'Character Mode',
    tagline: 'Direct Persona',
    description: 'Speaks and acts strictly as the persona with emotional depth and sensory cues.',
  },
  {
    id: 'narrator',
    name: 'Narrator / Storyteller',
    tagline: 'Literary World Narrator',
    description: 'Acts as an omniscient literary narrator setting scenes, atmospheric detail, and pacing.',
  },
  {
    id: 'dual',
    name: 'Dual Mode',
    tagline: 'Narrator + Character',
    description: 'Blends atmospheric third-person scene narration with direct spoken dialogue from the character.',
  },
  {
    id: 'game-master',
    name: 'Game Master / Director',
    tagline: 'Interactive DM',
    description: 'Directs the narrative, creates tactical choices and dilemmas, and prompts your next move.',
  },
  {
    id: 'custom',
    name: 'Custom Agent Mode',
    tagline: 'Tailored System Directives',
    description: 'Configure your own custom instructions, style rules, and agent behavior.',
  },
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
