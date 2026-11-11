/**
 * Client-side roleplay engine: SSE streaming, bounded context, background
 * memory summarization, and character-consistent scene prompts.
 */
import type {
  ChatMessage,
  ChatReplyLength,
  PersonaMemory,
  RoleplayEngineConfig,
  RoleplayPersona,
  UserSettings,
} from '../types';
import {
  buildMemorySummaryMessages,
  buildRoleplayMessages,
  buildCharacterPortraitPrompt,
  buildLocalScenePrompt,
  deriveAvoidPhrases,
  messagesAfterMarker,
  parseMemorySummary,
  toChatTurns,
} from '../utils/roleplayPrompt';
import { webLlmService } from './webLlmService';

/** Recent turns sent verbatim. Everything older must already live in memory. */
export const RECENT_TURN_WINDOW = 14;

/** Keep this many latest turns out of each summarization pass. */
export const MEMORY_KEEP_TURNS = 6;

/** Summarize once this many unsummarized turns accumulate. */
export const MEMORY_TRIGGER_TURNS = 12;

const SCENE_NEGATIVE_PROMPT =
  'text, watermark, logo, signature, extra limbs, deformed hands, low quality, blurry, duplicate character, inconsistent face';

const LOCAL_REPLY_MAX_TOKENS: Record<ChatReplyLength, number> = {
  short: 160,
  medium: 256,
  long: 384,
};

export const buildEngineConfig = (settings: UserSettings): RoleplayEngineConfig => ({
  provider: settings.chatProvider || 'gemini',
  model: settings.chatModel || 'gemini-3.8-flash',
  endpoint: settings.chatEndpoint || '',
  apiKey: settings.chatApiKey || '',
  temperature:
    typeof settings.chatTemperature === 'number' ? settings.chatTemperature : 0.9,
  replyLength: settings.chatReplyLength || 'medium',
  fallback: {
    enabled: settings.chatFallbackEnabled === true,
    endpoint: settings.chatFallbackEndpoint || 'http://localhost:11434',
    model: settings.chatFallbackModel || 'llama3.2',
  },
});

export const getUnsummarizedMessages = (
  messages: ChatMessage[],
  memory: PersonaMemory
): ChatMessage[] => messagesAfterMarker(messages, memory.lastSummarizedMessageId);

export const shouldSummarizeMemory = (
  messages: ChatMessage[],
  memory: PersonaMemory
): boolean =>
  getUnsummarizedMessages(messages, memory).length >= MEMORY_TRIGGER_TURNS;

interface StreamReplyOptions {
  persona: RoleplayPersona;
  messages: ChatMessage[];
  memory: PersonaMemory;
  config: RoleplayEngineConfig;
  nsfw: boolean;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
  /** Called when the server silently retried on the fallback (local) model. */
  onFallback?: (info: { model: string }) => void;
}

interface StreamEvent {
  type: 'delta' | 'done' | 'error' | 'fallback';
  text?: string;
  error?: string;
  model?: string;
}

/** Stream a reply and return the full text once the stream closes. */
export const streamRoleplayReply = async ({
  persona,
  messages,
  memory,
  config,
  nsfw,
  signal,
  onDelta,
  onFallback,
}: StreamReplyOptions): Promise<string> => {
  const recent = messages.slice(-RECENT_TURN_WINDOW);

  if (config.provider === 'webllm') {
    const userMessage = recent[recent.length - 1]?.content || '';
    const prompt = buildRoleplayMessages({
      persona,
      messages: recent,
      memory,
      avoidPhrases: deriveAvoidPhrases(recent),
      userMessage,
      nsfw,
      replyLength: config.replyLength,
    });
    let fullText = '';

    for await (const delta of webLlmService.stream(prompt, {
      temperature: config.temperature,
      maxTokens: LOCAL_REPLY_MAX_TOKENS[config.replyLength],
      signal,
    })) {
      if (signal?.aborted) break;
      fullText += delta;
      onDelta(delta);
    }

    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    if (!fullText.trim()) {
      throw new Error('The local model returned an empty reply.');
    }
    return fullText;
  }

  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      persona,
      messages: toChatTurns(recent),
      memory,
      avoidPhrases: deriveAvoidPhrases(recent),
      userMessage: recent[recent.length - 1]?.content || '',
      nsfw,
      replyLength: config.replyLength,
      config,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Chat request failed (${response.status})`);
  }
  if (!response.body) {
    throw new Error('The chat provider returned no stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let streamError: Error | null = null;

  const handleFrame = (frame: string) => {
    const dataLine = frame
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('data:'));
    if (!dataLine) return;

    let event: StreamEvent;
    try {
      event = JSON.parse(dataLine.slice(5).trim());
    } catch {
      return;
    }

    if (event.type === 'delta' && event.text) {
      fullText += event.text;
      onDelta(event.text);
    } else if (event.type === 'fallback') {
      onFallback?.({ model: event.model || 'local model' });
    } else if (event.type === 'error') {
      streamError = new Error(event.error || 'Chat generation failed');
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';
      for (const frame of frames) handleFrame(frame);
    }

    buffer += decoder.decode();
    if (buffer.trim()) handleFrame(buffer);
  } finally {
    reader.releaseLock();
  }

  if (streamError) throw streamError;
  if (!fullText.trim()) {
    throw new Error('The provider returned an empty reply.');
  }

  return fullText;
};

interface SummarizeOptions {
  persona: RoleplayPersona;
  messages: ChatMessage[];
  memory: PersonaMemory;
  config: RoleplayEngineConfig;
  signal?: AbortSignal;
}

/** Summarize all but the last few turns into the rolling memory. */
export const summarizeMemory = async ({
  persona,
  messages,
  memory,
  config,
  signal,
}: SummarizeOptions): Promise<PersonaMemory | null> => {
  const unsummarized = getUnsummarizedMessages(messages, memory);
  if (unsummarized.length < MEMORY_KEEP_TURNS + 2) return null;

  const toSummarize = unsummarized.slice(0, unsummarized.length - MEMORY_KEEP_TURNS);

  if (config.provider === 'webllm') {
    const summaryInput = { persona, memory, messages: toSummarize };
    const raw = await webLlmService.complete(buildMemorySummaryMessages(summaryInput), {
      temperature: 0.3,
      maxTokens: 512,
      signal,
    });
    return parseMemorySummary(raw, summaryInput);
  }

  const response = await fetch('/api/chat/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      persona,
      messages: toSummarize,
      memory,
      config,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Memory summarization failed (${response.status})`);
  }

  const data = await response.json();
  const next = data?.memory;
  if (!next || typeof next !== 'object') return null;

  return {
    summary: typeof next.summary === 'string' ? next.summary : memory.summary,
    relationship:
      typeof next.relationship === 'string' ? next.relationship : memory.relationship,
    facts: Array.isArray(next.facts) ? next.facts : memory.facts,
    lastSummarizedMessageId:
      next.lastSummarizedMessageId ||
      toSummarize[toSummarize.length - 1]?.id ||
      memory.lastSummarizedMessageId,
    updatedAt: typeof next.updatedAt === 'number' ? next.updatedAt : Date.now(),
  };
};

interface ScenePromptOptions {
  persona: RoleplayPersona;
  messages: ChatMessage[];
  memory: PersonaMemory;
  config: RoleplayEngineConfig;
  nsfw: boolean;
  kind?: 'scene' | 'portrait';
}

/** Ask the configured provider for a character-consistent image prompt. */
export const requestScenePrompt = async ({
  persona,
  messages,
  memory,
  config,
  nsfw,
  kind = 'scene',
}: ScenePromptOptions): Promise<{ imagePrompt: string; negativePrompt: string }> => {
  if (kind === 'portrait') {
    return {
      imagePrompt: buildCharacterPortraitPrompt(persona),
      negativePrompt: SCENE_NEGATIVE_PROMPT,
    };
  }

  if (config.provider === 'webllm') {
    return {
      imagePrompt: buildLocalScenePrompt(persona, memory, messages),
      negativePrompt: SCENE_NEGATIVE_PROMPT,
    };
  }

  try {
    const response = await fetch('/api/chat/scene-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona,
        messages: toChatTurns(messages.slice(-8)),
        memory,
        nsfw,
        kind,
        config,
      }),
    });

    if (!response.ok) throw new Error(`Scene prompt failed (${response.status})`);
    const data = await response.json();
    if (data?.imagePrompt && typeof data.imagePrompt === 'string') {
      return {
        imagePrompt: data.imagePrompt,
        negativePrompt: data.negativePrompt || SCENE_NEGATIVE_PROMPT,
      };
    }
  } catch (err) {
    console.warn('Scene prompt fallback:', err);
  }

  return {
    imagePrompt: buildLocalScenePrompt(persona, memory, messages),
    negativePrompt: SCENE_NEGATIVE_PROMPT,
  };
};
