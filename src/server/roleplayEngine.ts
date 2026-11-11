/**
 * Provider-agnostic roleplay engine.
 *
 * Responsibilities:
 * - Build a stable "character bible" so a persona never drifts.
 * - Fold long-term memory into a bounded prompt instead of resending history.
 * - Stream replies from Gemini, Ollama, or any OpenAI-compatible endpoint.
 * - Extract rolling memory summaries and character-consistent image prompts.
 */
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type {
  ChatMessage,
  ChatProvider,
  ChatReplyLength,
  PersonaMemory,
  RoleplayEngineConfig,
  RoleplayPersona,
} from '../types';
import {
  buildCharacterPortraitPrompt,
  buildLocalScenePrompt,
  buildMemorySummaryMessages,
  buildRoleplayMessages,
  buildRoleplaySystemInstruction,
  parseJsonLoose,
  parseMemorySummary,
  type MemorySummaryInput,
  type RoleplayPromptMessage,
} from '../utils/roleplayPrompt.ts';

type EngineConfig = RoleplayEngineConfig;
type ServerChatProvider = Exclude<ChatProvider, 'webllm'>;

export function assertServerChatProvider(
  provider: ChatProvider
): asserts provider is ServerChatProvider {
  if (provider === 'webllm') {
    throw new Error('WebLLM must run in the browser.');
  }
}

export interface RoleplayRequest {
  persona: RoleplayPersona;
  messages: ChatMessage[];
  memory?: PersonaMemory;
  avoidPhrases?: string[];
  userMessage: string;
  nsfw?: boolean;
  replyLength?: ChatReplyLength;
  config?: Partial<EngineConfig>;
}

const DEFAULT_MODELS: Record<ServerChatProvider, string> = {
  gemini: 'gemini-3.8-flash',
  ollama: 'llama3.2',
  openai: 'openai/gpt-4o-mini',
};

const DEFAULT_ENDPOINTS: Record<ServerChatProvider, string> = {
  gemini: '',
  ollama: 'http://localhost:11434',
  openai: 'https://openrouter.ai/api/v1',
};

const MATURE_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

const DEFAULT_NEGATIVE_PROMPT =
  'text, watermark, logo, signature, extra limbs, deformed hands, low quality, blurry, duplicate character, inconsistent face';

const getGeminiClient = (apiKey?: string) => {
  const key = apiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
};

const resolveConfig = (input?: Partial<EngineConfig>): EngineConfig => {
  if (input?.provider) assertServerChatProvider(input.provider);
  const provider: ServerChatProvider =
    input?.provider === 'ollama' || input?.provider === 'openai' ? input.provider : 'gemini';
  return {
    provider,
    model: input?.model?.trim() || DEFAULT_MODELS[provider],
    endpoint: input?.endpoint?.trim() || DEFAULT_ENDPOINTS[provider],
    apiKey: input?.apiKey || '',
    temperature:
      typeof input?.temperature === 'number'
        ? Math.min(1.3, Math.max(0.2, input.temperature))
        : 0.9,
    replyLength: input?.replyLength || 'medium',
  };
};

const normalizeEndpoint = (endpoint: string) => endpoint.replace(/\/+$/, '');

/** Accept either `http://host:11434` or `http://host:11434/api`. */
const ollamaChatUrl = (endpoint?: string) => {
  const base = normalizeEndpoint(endpoint || DEFAULT_ENDPOINTS.ollama).replace(/\/api$/, '');
  return `${base}/api/chat`;
};

export const buildSystemInstruction = (req: RoleplayRequest): string =>
  buildRoleplaySystemInstruction(req);

const buildProviderMessages = (req: RoleplayRequest): RoleplayPromptMessage[] =>
  buildRoleplayMessages(req);

const toGeminiContents = (messages: RoleplayPromptMessage[]) => {
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') continue;
    const role: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user';
    const previous = contents[contents.length - 1];
    if (previous && previous.role === role) {
      previous.parts[0].text += `\n\n${msg.content}`;
    } else {
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }

  // Gemini expects the conversation to begin with a user turn.
  while (contents.length > 0 && contents[0].role === 'model') contents.shift();
  return contents;
};

async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) yield line;
    }
    buffer += decoder.decode();
    if (buffer.trim()) yield buffer;
  } finally {
    reader.releaseLock();
  }
}

async function* streamGemini(
  req: RoleplayRequest,
  config: EngineConfig,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const ai = getGeminiClient(config.apiKey);
  if (!ai) {
    throw new Error(
      'No Gemini API key configured. Add GEMINI_API_KEY on the server, or switch the roleplay engine to Ollama / OpenAI-compatible in Settings.'
    );
  }

  const contents = toGeminiContents(buildProviderMessages(req));
  if (contents.length === 0) throw new Error('No messages to send');

  const stream = await ai.models.generateContentStream({
    model: config.model,
    contents,
    config: {
      systemInstruction: buildSystemInstruction(req),
      temperature: config.temperature,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      ...(req.nsfw ? { safetySettings: MATURE_SAFETY_SETTINGS as any } : {}),
    },
  });

  for await (const chunk of stream) {
    if (signal?.aborted) return;
    if (chunk.text) yield chunk.text;
  }
}

async function* streamOllama(
  req: RoleplayRequest,
  config: EngineConfig,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const response = await fetch(ollamaChatUrl(config.endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: buildProviderMessages(req),
      stream: true,
      options: { temperature: config.temperature, num_ctx: 8192 },
    }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Ollama error ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
  }
  if (!response.body) throw new Error('Ollama returned an empty stream');

  for await (const line of readLines(response.body)) {
    if (signal?.aborted) return;
    if (!line.trim()) continue;

    let data: any;
    try {
      data = JSON.parse(line);
    } catch {
      continue;
    }
    if (data.error) throw new Error(String(data.error));

    const piece = data?.message?.content || data?.response || '';
    if (piece) yield piece;
  }
}

async function* streamOpenAI(
  req: RoleplayRequest,
  config: EngineConfig,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const base = normalizeEndpoint(config.endpoint || DEFAULT_ENDPOINTS.openai);
  const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  headers['HTTP-Referer'] = process.env.APP_URL || 'http://localhost:3000';
  headers['X-Title'] = 'NoMan AI';

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: buildProviderMessages(req),
      stream: true,
      temperature: config.temperature,
    }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Chat provider error ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`
    );
  }
  if (!response.body) throw new Error('Chat provider returned an empty stream');

  for await (const line of readLines(response.body)) {
    if (signal?.aborted) return;
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;

    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;

    let data: any;
    try {
      data = JSON.parse(payload);
    } catch {
      continue;
    }
    if (data.error) {
      throw new Error(typeof data.error === 'string' ? data.error : data.error.message || 'Provider error');
    }

    const piece =
      data?.choices?.[0]?.delta?.content ??
      data?.choices?.[0]?.message?.content ??
      '';
    if (piece) yield piece;
  }
}

export async function* streamChat(
  req: RoleplayRequest,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const config = resolveConfig({ ...req.config, replyLength: req.replyLength || req.config?.replyLength });

  if (config.provider === 'ollama') {
    yield* streamOllama(req, config, signal);
    return;
  }
  if (config.provider === 'openai') {
    yield* streamOpenAI(req, config, signal);
    return;
  }
  yield* streamGemini(req, config, signal);
}

/** Non-streaming helper used by the legacy chat endpoint. */
export async function completeChat(req: RoleplayRequest, signal?: AbortSignal): Promise<string> {
  let output = '';
  for await (const delta of streamChat(req, signal)) output += delta;
  return output.trim();
}

/** Shared JSON completion path for memory extraction and scene prompts. */
async function completeJson(
  instruction: string,
  userPrompt: string,
  configInput?: Partial<EngineConfig>,
  signal?: AbortSignal
): Promise<string> {
  const config = resolveConfig(configInput);

  if (config.provider === 'ollama') {
    const response = await fetch(ollamaChatUrl(config.endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: instruction },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        format: 'json',
        options: { temperature: 0.3, num_ctx: 8192 },
      }),
      signal,
    });
    if (!response.ok) throw new Error(`Ollama error ${response.status}`);
    const data = await response.json();
    return data?.message?.content || data?.response || '';
  }

  if (config.provider === 'openai') {
    const base = normalizeEndpoint(config.endpoint || DEFAULT_ENDPOINTS.openai);
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: instruction },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal,
    });
    if (!response.ok) throw new Error(`Chat provider error ${response.status}`);
    const data = await response.json();
    return data?.choices?.[0]?.message?.content || '';
  }

  const ai = getGeminiClient(config.apiKey);
  if (!ai) throw new Error('No Gemini API key configured for memory extraction.');

  const response = await ai.models.generateContent({
    model: config.model,
    contents: userPrompt,
    config: {
      systemInstruction: instruction,
      responseMimeType: 'application/json',
      temperature: 0.3,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });
  return response.text || '';
}

export interface SummarizeInput extends MemorySummaryInput {
  config?: Partial<EngineConfig>;
}

/** Fold older turns into a compact summary + durable facts + relationship state. */
export async function summarizeConversation(
  input: SummarizeInput,
  signal?: AbortSignal
): Promise<PersonaMemory> {
  if (input.messages.length === 0) return input.memory;

  const messages = buildMemorySummaryMessages(input);
  const raw = await completeJson(messages[0].content, messages[1].content, input.config, signal);
  return parseMemorySummary(raw, input);
}

export interface ScenePromptInput {
  persona: RoleplayPersona;
  memory?: PersonaMemory;
  messages: ChatMessage[];
  nsfw?: boolean;
  kind?: 'scene' | 'portrait';
  config?: Partial<EngineConfig>;
}

/** Character-consistent image prompt for a specific beat in the conversation. */
export async function createScenePrompt(
  input: ScenePromptInput,
  signal?: AbortSignal
): Promise<{ imagePrompt: string; negativePrompt: string }> {
  if (input.kind === 'portrait') {
    return {
      imagePrompt: buildCharacterPortraitPrompt(input.persona),
      negativePrompt: DEFAULT_NEGATIVE_PROMPT,
    };
  }

  const { persona, memory, nsfw } = input;
  const transcript = input.messages
    .slice(-8)
    .map((msg) => `${msg.role === 'user' ? 'User' : persona.name}: ${msg.content}`)
    .join('\n');

  const instruction = `You are a film-still photographer writing ONE image-generation prompt for a roleplay scene.

CHARACTER CANON (never change):
- Name: ${persona.name}
- Identity: ${persona.tagline}
- Appearance: ${persona.appearance || 'consistent with the scenario'}
- Outfit: ${persona.outfit || 'signature outfit'}
- World style: ${persona.worldStyle || 'cinematic'}
- Scenario: ${persona.scenario || 'an open scene'}

Return ONLY JSON: { "imagePrompt": string, "negativePrompt": string }

Rules:
- The image must show ${persona.name}, keeping the canonical face, hair, body, and outfit.
- Describe what is happening right now, where, the mood, shot type, lens, and lighting.
- 60–95 words. Comma-separated descriptive phrases are fine.
- Include ${persona.name}'s name in the prompt.
- No text, logos, watermarks, UI, or speech bubbles.
- ${
    nsfw
      ? 'Mature content is permitted for adult characters only. Describe the scene cinematically rather than clinically. Never depict minors, non-consent, or real people.'
      : 'Keep the image tasteful and non-explicit.'
  }
- negativePrompt: a short comma-separated list of artifacts to avoid.`;

  const prompt = `STORY MEMORY:\n${memory?.summary || '(none)'}\nRELATIONSHIP:\n${
    memory?.relationship || '(none)'
  }\n\nLATEST TRANSCRIPT:\n${transcript}`;

  try {
    const raw = await completeJson(instruction, prompt, input.config, signal);
    const parsed = parseJsonLoose(raw);
    if (parsed && typeof parsed.imagePrompt === 'string' && parsed.imagePrompt.trim()) {
      return {
        imagePrompt: parsed.imagePrompt.trim(),
        negativePrompt:
          typeof parsed.negativePrompt === 'string' && parsed.negativePrompt.trim()
            ? parsed.negativePrompt.trim()
            : DEFAULT_NEGATIVE_PROMPT,
      };
    }
  } catch (err) {
    console.warn('Scene prompt LLM failed, using local builder:', err);
  }

  return {
    imagePrompt: buildLocalScenePrompt(persona, memory || { summary: '', facts: [], relationship: '', updatedAt: 0 }, input.messages),
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  };
}
