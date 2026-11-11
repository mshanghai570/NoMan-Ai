export type GenerationType = 'image' | 'video';

export type AIProvider = 'pollinations' | 'huggingface' | 'local' | 'webgpu' | 'gemini' | 'custom';

export type ExecutionMethod = 'cloud' | 'local';
export type ImageCloudProvider = 'gemini' | 'huggingface' | 'pollinations';
export type ImageLocalProvider = 'comfyui' | 'sd-webui' | 'ollama' | 'webgpu';
export type VideoCloudProvider = 'gemini' | 'huggingface' | 'pollinations';
export type VideoLocalProvider = 'webgpu' | 'comfyui' | 'sd-webui';

export type AspectRatio = '1:1' | '9:16' | '16:9' | '4:3' | '3:4';

export type MotionStyle = 
  | 'zoom-in' 
  | 'pan-left' 
  | 'pan-right' 
  | 'orbit-360' 
  | 'dolly-forward' 
  | 'pulse-morph' 
  | 'parallax-drift';

export type NsfwMode = 'safe' | 'warn' | 'unrestricted';

/** Per-conversation maturity setting for roleplay chat. */
export type ChatNsfwMode = 'sfw' | 'nsfw';

/** Provider used for roleplay chat and memory/scene extraction. */
export type ChatProvider = 'gemini' | 'kilo' | 'ollama' | 'openai' | 'webllm';

export type AgentMode = 'character' | 'narrator' | 'dual' | 'game-master' | 'custom';

export type ChatReplyLength = 'short' | 'medium' | 'long';

export interface RoleplayEngineConfig {
  provider: ChatProvider;
  model: string;
  endpoint: string;
  apiKey: string;
  temperature: number;
  replyLength: ChatReplyLength;
  agentMode?: AgentMode;
  customAgentPrompt?: string;
  /** Local model to retry with when the primary provider fails. */
  fallback?: {
    enabled: boolean;
    endpoint: string;
    model: string;
  };
}

export interface MemoryFact {
  id: string;
  text: string;
  importance: 'low' | 'normal' | 'high';
  createdAt: number;
}

export interface PersonaMemory {
  /** Rolling prose summary of events that fell out of the recent window. */
  summary: string;
  /** Durable facts: promises, injuries, items, relationship beats. */
  facts: MemoryFact[];
  /** Current emotional stance / relationship toward the user. */
  relationship: string;
  /** ID of the last message already folded into the summary. */
  lastSummarizedMessageId?: string;
  updatedAt: number;
}

export interface VideoMetadata {
  duration: number; // in seconds
  fps: number;
  motionStyle: MotionStyle;
  isExtended?: boolean;
  parentMediaId?: string;
  sourceImageUrl?: string;
  extensionCount?: number;
  timelineSegments?: Array<{
    id: string;
    prompt: string;
    duration: number;
    motionStyle: MotionStyle;
  }>;
}

export interface GenerationItem {
  id: string;
  userId: string;
  type: GenerationType;
  prompt: string;
  negativePrompt?: string;
  model: string;
  modelLabel: string;
  provider: AIProvider;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  mediaUrl: string;
  thumbnailUrl?: string;
  seed: number;
  steps: number;
  cfgScale: number;
  createdAt: number;
  isFavorite: boolean;
  tags: string[];
  isNsfw?: boolean;
  videoMetadata?: VideoMetadata;
  isUpscaled?: boolean;
  upscaleFactor?: 2 | 4;
  originalMediaId?: string;
}

export interface UpscaleOptions {
  imageUrl: string;
  scale: 2 | 4;
  prompt?: string;
  seed?: number;
  width?: number;
  height?: number;
  hfToken?: string;
}

export interface UpscaleResult {
  upscaledUrl: string;
  scale: 2 | 4;
  width: number;
  height: number;
  engine: string;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  email?: string;
  createdAt: number;
}

export interface CustomModel {
  id: string;
  name: string;
  description: string;
  provider: AIProvider;
  type: 'image' | 'video' | 'both';
  endpointUrl?: string;
  isCustom?: boolean;
}

export interface UserSettings {
  nsfwMode: NsfwMode;
  /** Default maturity for new roleplay chats. */
  chatNsfwMode: ChatNsfwMode;
  /** Set once the user confirms they are 18+ (persisted locally). */
  chatAgeVerified: boolean;
  /** Roleplay engine configuration (provider-agnostic). */
  chatProvider: ChatProvider;
  chatModel: string;
  chatEndpoint: string;
  chatApiKey: string;
  chatTemperature: number;
  chatReplyLength: ChatReplyLength;
  /** Kilo-style Agent Mode: character, narrator, dual, game-master, custom */
  agentMode?: AgentMode;
  customAgentPrompt?: string;
  kiloApiKey?: string;
  /**
   * Fallback target used when the primary provider fails before producing any
   * text (no key, no credits, rate limit, endpoint down). Keeps the app usable
   * on a free local model while a paid provider is configured.
   */
  chatFallbackEnabled: boolean;
  chatFallbackEndpoint: string;
  chatFallbackModel: string;
  defaultProvider: AIProvider;
  defaultModel: string;
  imageExecutionMethod: ExecutionMethod;
  videoExecutionMethod: ExecutionMethod;
  imageCloudProvider: ImageCloudProvider;
  imageLocalProvider: ImageLocalProvider;
  imageLocalEndpoint: string;
  videoCloudProvider: VideoCloudProvider;
  videoLocalProvider: VideoLocalProvider;
  videoLocalEndpoint: string;
  cloudApiKey?: string;
  realismBoost: boolean;
  hfToken: string;
  customModels: CustomModel[];
  localEndpoint: string;
  localModelName: string;
  webGpuAcceleration: boolean;
  hapticFeedback: boolean;
  theme: string;
  fontFamily?: string;
  fontHeading?: string;
  fontMono?: string;
  fontSizeScale?: FontSizeScale;
  activeCustomTheme?: CustomTheme;
  customThemes?: CustomTheme[];
  themeApiKey?: string;
  autoSave: boolean;
  defaultAspectRatio: AspectRatio;
  defaultSteps: number;
  defaultCfgScale: number;
}

export type FontSizeScale = 'compact' | 'normal' | 'relaxed';

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  border: string;
  primaryAccent: string;
  secondaryAccent: string;
  glow: string;
  textPrimary: string;
  textMuted: string;
}

export interface ThemeTypography {
  fontFamily: string;
  headingFont?: string;
  monoFont?: string;
  googleFontFamilies?: string[];
}

export interface CustomTheme {
  id: string;
  name: string;
  description: string;
  vibe: string;
  createdAt: number;
  isAiGenerated?: boolean;
  prompt?: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export interface PromptEnhancementResponse {
  enhancedPrompt: string;
  negativePrompt?: string;
  suggestedMotion?: string;
  source?: string;
}

export interface KeywordCategory {
  name: string;
  keywords: string[];
}

export interface PromptAssistantResponse {
  categories: KeywordCategory[];
  recommendedCombinations?: string[];
  source?: string;
}

export interface RoleplayPersona {
  id: string;
  name: string;
  tagline: string;
  avatar: string;
  category: 'Sci-Fi' | 'Fantasy' | 'Cyberpunk' | 'Anime' | 'Creative' | 'Custom';
  systemPrompt: string;
  greeting: string;
  scenario?: string;
  suggestedVisualPrompt?: string;
  /** Stable physical description used for character-consistent image prompts. */
  appearance?: string;
  /** Signature wardrobe / equipment, kept consistent across scenes. */
  outfit?: string;
  /** How the character talks: rhythm, vocabulary, verbal tics. */
  voiceStyle?: string;
  /** Visual world/genre style used by the image engine. */
  worldStyle?: string;
  agentMode?: AgentMode;
  customAgentPrompt?: string;
  isCustom?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** True when this turn was generated while mature mode was active. */
  isNsfw?: boolean;
  /** Cached character-specific image prompt generated for this turn. */
  scenePrompt?: string;
}

export interface PersonaConversation {
  personaId: string;
  messages: ChatMessage[];
  updatedAt: number;
}

