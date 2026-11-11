import type { GenerationItem, PersonaMemory, User, UserSettings } from '../types';
import { DEFAULT_PRESET_MODELS } from '../constants/models';

const STORAGE_KEYS = {
  USER: 'noman_user_profile',
  SETTINGS: 'noman_user_settings',
  GENERATIONS: 'noman_saved_generations',
  CHAT_CONVERSATIONS: 'noman_chat_conversations',
  CUSTOM_PERSONAS: 'noman_custom_personas',
  CHAT_NSFW_OVERRIDES: 'noman_chat_nsfw_overrides',
  CHAT_MEMORIES: 'noman_chat_memories',
};

// Default initial settings
export const DEFAULT_SETTINGS: UserSettings = {
  nsfwMode: 'warn', // 'safe' | 'warn' | 'unrestricted'
  chatNsfwMode: 'sfw',
  chatAgeVerified: false,
  chatProvider: 'gemini',
  chatModel: 'gemini-3.8-flash',
  chatEndpoint: '',
  chatApiKey: '',
  chatTemperature: 0.9,
  chatReplyLength: 'medium',
  chatFallbackEnabled: false,
  chatFallbackEndpoint: 'http://localhost:11434',
  chatFallbackModel: 'llama3.2',
  defaultProvider: 'pollinations',
  defaultModel: 'flux',
  hfToken: '',
  customModels: [...DEFAULT_PRESET_MODELS],
  localEndpoint: 'http://localhost:11434',
  localModelName: 'llama3.2-vision',
  webGpuAcceleration: true,
  hapticFeedback: true,
  theme: 'oled',
  fontFamily: 'Plus Jakarta Sans',
  fontHeading: 'Plus Jakarta Sans',
  fontMono: 'JetBrains Mono',
  fontSizeScale: 'normal',
  customThemes: [],
  themeApiKey: '',
  autoSave: true,
  defaultAspectRatio: '1:1',
  defaultSteps: 28,
  defaultCfgScale: 7.5,
};

// Default starter user
export const DEFAULT_USER: User = {
  id: 'usr_creator_01',
  username: 'nomad_creator',
  displayName: 'Nomad Creator',
  avatar: '/src/assets/images/noman_app_icon_1794392784917.jpg',
  email: 'creator@noman.ai',
  createdAt: Date.now() - 86400000 * 7,
};

// Initial showcase items so user starts with great content in their gallery
export const INITIAL_SHOWCASE_ITEMS: GenerationItem[] = [
  {
    id: 'gen_cyber_wanderer',
    userId: 'usr_creator_01',
    type: 'image',
    prompt: 'Cinematic character portrait of a stylish nomad cyberpunk traveler with illuminated visor and translucent rain jacket in a neon-lit futuristic street, rain droplets, atmospheric volumetric lighting, 8k commercial quality',
    negativePrompt: 'blurry, low quality, artifacts, watermark, cartoonish, low resolution',
    model: 'flux-realism',
    modelLabel: 'FLUX Realism Studio',
    provider: 'pollinations',
    aspectRatio: '3:4',
    width: 768,
    height: 1024,
    mediaUrl: '/src/assets/images/sample_cyber_portrait_1794392786213.jpg',
    thumbnailUrl: '/src/assets/images/sample_cyber_portrait_1794392786213.jpg',
    seed: 489201,
    steps: 32,
    cfgScale: 7.5,
    createdAt: Date.now() - 1000 * 60 * 45,
    isFavorite: true,
    tags: ['Cyberpunk', 'Portrait', 'Neo-Tokyo'],
    isNsfw: false,
  },
  {
    id: 'gen_mythic_islands',
    userId: 'usr_creator_01',
    type: 'video',
    prompt: 'Surreal floating crystalline islands over a glowing violet aurora ocean, bioluminescent flora, epic scale, cinematic depth of field, slow panoramic flight',
    negativePrompt: 'blurry, stuttering, artifacting',
    model: 'noman-motion-engine',
    modelLabel: 'NoMan Cinematic Motion v2.4',
    provider: 'pollinations',
    aspectRatio: '16:9',
    width: 1344,
    height: 768,
    mediaUrl: '/src/assets/images/sample_mythic_landscape_1794392786868.jpg',
    thumbnailUrl: '/src/assets/images/sample_mythic_landscape_1794392786868.jpg',
    seed: 893120,
    steps: 28,
    cfgScale: 7.0,
    createdAt: Date.now() - 1000 * 60 * 120,
    isFavorite: true,
    tags: ['Landscape', 'Celestial', 'Video'],
    isNsfw: false,
    videoMetadata: {
      duration: 5,
      fps: 30,
      motionStyle: 'orbit-360',
      isExtended: true,
      extensionCount: 1,
      timelineSegments: [
        { id: 'seg_1', prompt: 'Floating crystalline islands aurora flight', duration: 3, motionStyle: 'orbit-360' },
        { id: 'seg_2', prompt: 'Camera descends past glowing waterfall into nebula', duration: 2, motionStyle: 'dolly-forward' }
      ]
    }
  },
  {
    id: 'gen_deep_space_ship',
    userId: 'usr_creator_01',
    type: 'image',
    prompt: 'Cinematic shot of a sleek interstellar exploration vessel gliding through gold and amber planetary dust rings near a gas giant, realistic reflections, photorealistic scifi',
    negativePrompt: 'blurry, noise, low resolution',
    model: 'black-forest-labs/FLUX.1-schnell',
    modelLabel: 'HF · FLUX.1 Schnell',
    provider: 'huggingface',
    aspectRatio: '16:9',
    width: 1344,
    height: 768,
    mediaUrl: '/src/assets/images/sample_sci_fi_mech_1794392786588.jpg',
    thumbnailUrl: '/src/assets/images/sample_sci_fi_mech_1794392786588.jpg',
    seed: 120491,
    steps: 30,
    cfgScale: 8.0,
    createdAt: Date.now() - 1000 * 60 * 240,
    isFavorite: false,
    tags: ['Sci-Fi', 'Space', 'Cinema'],
    isNsfw: false,
  }
];

export const getStoredUser = (): User => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load user', e);
  }
  return DEFAULT_USER;
};

export const saveStoredUser = (user: User): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  } catch (e) {
    console.error('Failed to save user', e);
  }
};

export const getStoredSettings = (): UserSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with default settings in case new fields were added
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }
  return DEFAULT_SETTINGS;
};

export const saveStoredSettings = (settings: UserSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
};

export const getStoredGenerations = (): GenerationItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GENERATIONS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load generations', e);
  }
  return INITIAL_SHOWCASE_ITEMS;
};

export const saveStoredGenerations = (items: GenerationItem[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.GENERATIONS, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save generations', e);
  }
};

export const deleteStoredGenerations = (idsToDelete: string[]): GenerationItem[] => {
  try {
    const current = getStoredGenerations();
    const toDeleteSet = new Set(idsToDelete);
    const updated = current.filter((item) => !toDeleteSet.has(item.id));
    saveStoredGenerations(updated);
    return updated;
  } catch (e) {
    console.error('Failed to batch delete generations', e);
    return getStoredGenerations();
  }
};

export const clearStoredGenerations = (): void => {
  try {
    saveStoredGenerations([]);
  } catch (e) {
    console.error('Failed to clear generations', e);
  }
};

export const exportUserData = (): string => {
  const data = {
    app: 'NoMan AI',
    exportedAt: new Date().toISOString(),
    user: getStoredUser(),
    settings: getStoredSettings(),
    generations: getStoredGenerations(),
    conversations: getStoredConversations(),
    customPersonas: getStoredCustomPersonas(),
    chatNsfwOverrides: getStoredPersonaNsfwOverrides(),
    chatMemories: getStoredMemories(),
  };
  return JSON.stringify(data, null, 2);
};

export const importUserData = (jsonString: string): boolean => {
  try {
    const data = JSON.parse(jsonString);
    if (data.app === 'NoMan AI' || Array.isArray(data.generations)) {
      if (data.user) saveStoredUser(data.user);
      if (data.settings) saveStoredSettings(data.settings);
      if (Array.isArray(data.generations)) saveStoredGenerations(data.generations);
      if (data.conversations) {
        localStorage.setItem(STORAGE_KEYS.CHAT_CONVERSATIONS, JSON.stringify(data.conversations));
      }
      if (Array.isArray(data.customPersonas)) {
        saveStoredCustomPersonas(data.customPersonas);
      }
      if (data.chatNsfwOverrides && typeof data.chatNsfwOverrides === 'object') {
        localStorage.setItem(
          STORAGE_KEYS.CHAT_NSFW_OVERRIDES,
          JSON.stringify(data.chatNsfwOverrides)
        );
      }
      if (data.chatMemories && typeof data.chatMemories === 'object') {
        localStorage.setItem(STORAGE_KEYS.CHAT_MEMORIES, JSON.stringify(data.chatMemories));
      }
      return true;
    }
  } catch (e) {
    console.error('Failed to import user data', e);
  }
  return false;
};

// Chat Roleplay Persistence
export const getStoredConversations = (): Record<string, import('../types').ChatMessage[]> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHAT_CONVERSATIONS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load conversations', e);
  }
  return {};
};

export const getStoredConversationForPersona = (
  personaId: string,
  initialGreeting?: string
): import('../types').ChatMessage[] => {
  const all = getStoredConversations();
  const stored = Array.isArray(all[personaId]) ? all[personaId] : [];

  // A reload during an in-flight stream can leave an empty assistant bubble
  // behind. Never show that on remount.
  const usable = stored.filter(
    (msg) => msg && (msg.role === 'user' || (msg.content || '').trim().length > 0)
  );

  if (usable.length > 0) return usable;

  // If no history exists, start with persona greeting if provided
  if (initialGreeting) {
    return [
      {
        id: `msg_init_${Date.now()}`,
        role: 'assistant',
        content: initialGreeting,
        timestamp: Date.now(),
      },
    ];
  }
  return [];
};

export const saveStoredConversation = (
  personaId: string,
  messages: import('../types').ChatMessage[]
): void => {
  try {
    const all = getStoredConversations();
    all[personaId] = messages;
    localStorage.setItem(STORAGE_KEYS.CHAT_CONVERSATIONS, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to save conversation', e);
  }
};

export const clearStoredConversation = (
  personaId: string,
  initialGreeting?: string
): import('../types').ChatMessage[] => {
  try {
    const all = getStoredConversations();
    if (initialGreeting) {
      all[personaId] = [
        {
          id: `msg_init_${Date.now()}`,
          role: 'assistant',
          content: initialGreeting,
          timestamp: Date.now(),
        },
      ];
    } else {
      delete all[personaId];
    }
    localStorage.setItem(STORAGE_KEYS.CHAT_CONVERSATIONS, JSON.stringify(all));
    return all[personaId] || [];
  } catch (e) {
    console.error('Failed to clear conversation', e);
    return [];
  }
};

export const getStoredCustomPersonas = (): import('../types').RoleplayPersona[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_PERSONAS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load custom personas', e);
  }
  return [];
};

export const saveStoredCustomPersonas = (
  personas: import('../types').RoleplayPersona[]
): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_PERSONAS, JSON.stringify(personas));
  } catch (e) {
    console.error('Failed to save custom personas', e);
  }
};

// Per-character mature chat overrides (SpicyChat-style per-chat toggle)
export const getStoredPersonaNsfwOverrides = (): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHAT_NSFW_OVERRIDES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load chat NSFW overrides', e);
  }
  return {};
};

export const saveStoredPersonaNsfwOverride = (personaId: string, enabled: boolean): void => {
  try {
    const all = getStoredPersonaNsfwOverrides();
    all[personaId] = enabled;
    localStorage.setItem(STORAGE_KEYS.CHAT_NSFW_OVERRIDES, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to save chat NSFW override', e);
  }
};

/** Master off switch: resets every per-character override back to SFW. */
export const clearStoredPersonaNsfwOverrides = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CHAT_NSFW_OVERRIDES);
  } catch (e) {
    console.error('Failed to clear chat NSFW overrides', e);
  }
};

// Long-term roleplay memory (rolling summary + durable facts, per character)
export const EMPTY_MEMORY: PersonaMemory = {
  summary: '',
  facts: [],
  relationship: '',
  updatedAt: 0,
};

export const getStoredMemories = (): Record<string, PersonaMemory> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHAT_MEMORIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load chat memories', e);
  }
  return {};
};

export const getStoredMemoryForPersona = (personaId: string): PersonaMemory => {
  const stored = getStoredMemories()[personaId];
  if (!stored) return { ...EMPTY_MEMORY };
  return {
    summary: stored.summary || '',
    facts: Array.isArray(stored.facts) ? stored.facts : [],
    relationship: stored.relationship || '',
    lastSummarizedMessageId: stored.lastSummarizedMessageId,
    updatedAt: stored.updatedAt || 0,
  };
};

export const saveStoredMemoryForPersona = (
  personaId: string,
  memory: PersonaMemory
): void => {
  try {
    const all = getStoredMemories();
    all[personaId] = memory;
    localStorage.setItem(STORAGE_KEYS.CHAT_MEMORIES, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to save chat memory', e);
  }
};

export const clearStoredMemoryForPersona = (personaId: string): void => {
  try {
    const all = getStoredMemories();
    delete all[personaId];
    localStorage.setItem(STORAGE_KEYS.CHAT_MEMORIES, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to clear chat memory', e);
  }
};
