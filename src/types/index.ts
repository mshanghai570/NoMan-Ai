export type GenerationType = 'image' | 'video';

export type AIProvider = 'pollinations' | 'huggingface' | 'local' | 'webgpu';

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
  defaultProvider: AIProvider;
  defaultModel: string;
  hfToken: string;
  customModels: CustomModel[];
  localEndpoint: string;
  localModelName: string;
  webGpuAcceleration: boolean;
  hapticFeedback: boolean;
  theme: 'oled' | 'slate' | 'navy';
  autoSave: boolean;
  defaultAspectRatio: AspectRatio;
  defaultSteps: number;
  defaultCfgScale: number;
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
  isCustom?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface PersonaConversation {
  personaId: string;
  messages: ChatMessage[];
  updatedAt: number;
}

