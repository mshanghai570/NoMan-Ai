import type { CustomModel, AspectRatio, MotionStyle } from '../types';
import { MEDIA_PROVIDERS, createPresetModels } from '../providers/catalog';

/** Providers that live behind an API key; their presets are generated from the catalog. */
const KEYED_PROVIDER_IDS = ['leonardo', 'replicate', 'byteplus', 'cloudflare', 'openai'];

const KEYED_PROVIDER_MODELS: CustomModel[] = MEDIA_PROVIDERS.filter((provider) =>
  KEYED_PROVIDER_IDS.includes(provider.id)
).flatMap((provider) => createPresetModels(provider));

export const DEFAULT_PRESET_MODELS: CustomModel[] = [
  // Flagship Cloud Photorealism Models (Closest to reality)
  {
    id: 'gemini-imagen-realism',
    name: 'Gemini Photorealism (Google Cloud)',
    description: 'Ultra-crisp commercial photography, authentic skin pores, and natural lighting via Google GenAI.',
    provider: 'gemini',
    type: 'image',
    isCustom: false,
  },
  {
    id: 'flux-realism',
    name: 'FLUX Ultra Realism Studio (Raw Photography)',
    description: 'Fine-tuned specifically for commercial raw photography, natural depth of field, and eliminates plastic look.',
    provider: 'pollinations',
    type: 'image',
    isCustom: false,
  },
  {
    id: 'flux',
    name: 'FLUX.1 Schnell (Pollinations Cloud)',
    description: 'Ultra-fast, state-of-the-art text-to-image with incredible prompt accuracy and lighting.',
    provider: 'pollinations',
    type: 'image',
    isCustom: false,
  },
  {
    id: 'flux-anime',
    name: 'FLUX Anime Dream',
    description: 'Japanese animation and modern digital illustration style with vivid colors.',
    provider: 'pollinations',
    type: 'image',
    isCustom: false,
  },
  {
    id: 'flux-3d',
    name: 'FLUX 3D Octane Cinema',
    description: '3D CGI render aesthetic, Pixar/Blender character style, and volumetric lighting.',
    provider: 'pollinations',
    type: 'image',
    isCustom: false,
  },
  {
    id: 'turbo',
    name: 'SDXL Turbo Lightning',
    description: 'Ultra-low latency generation for fast prototyping and instant inspiration.',
    provider: 'pollinations',
    type: 'image',
    isCustom: false,
  },
  {
    id: 'deliberate',
    name: 'Deliberate v2 Arts',
    description: 'Versatile concept art, matte painting, and atmospheric fantasy scenes.',
    provider: 'pollinations',
    type: 'image',
    isCustom: false,
  },

  // Hugging Face Models
  {
    id: 'black-forest-labs/FLUX.1-schnell',
    name: 'HF · FLUX.1 Schnell',
    description: 'Official 12B parameter FLUX model hosted on Hugging Face Inference API.',
    provider: 'huggingface',
    type: 'image',
    isCustom: false,
  },
  {
    id: 'black-forest-labs/FLUX.1-dev',
    name: 'HF · FLUX.1 Dev',
    description: 'Flagship open weights model for extreme detail and typographic capability.',
    provider: 'huggingface',
    type: 'image',
    isCustom: false,
  },
  {
    id: 'stabilityai/stable-diffusion-xl-base-1.0',
    name: 'HF · SDXL 1.0 Base',
    description: 'Stability AI native 1024x1024 high fidelity diffusion model.',
    provider: 'huggingface',
    type: 'image',
    isCustom: false,
  },
  {
    id: 'cagliostrolab/animagine-xl-3.1',
    name: 'HF · Animagine XL 3.1',
    description: 'Top-tier open-source anime and illustration generation model.',
    provider: 'huggingface',
    type: 'image',
    isCustom: false,
  },
  {
    id: 'SG161222/Realistic_Vision_V5.1_noVAE',
    name: 'HF · Realistic Vision V5.1',
    description: 'Popular community model engineered for photorealistic human portraits.',
    provider: 'huggingface',
    type: 'image',
    isCustom: false,
  },
  {
    id: 'Lykon/dreamshaper-xl-v2-turbo',
    name: 'HF · DreamShaper XL Turbo',
    description: 'Versatile model spanning realistic, 2.5D, and fantasy concept art.',
    provider: 'huggingface',
    type: 'image',
    isCustom: false,
  },

  // Hosted API providers (keys in Settings → Generation Providers)
  ...KEYED_PROVIDER_MODELS,

  // Video Models
  {
    id: 'noman-motion-engine',
    name: 'NoMan Cinematic Motion v2.4',
    description: 'Specialized video animation engine supporting camera glide, orbits, and timeline extension.',
    provider: 'pollinations',
    type: 'video',
    isCustom: false,
  },
  {
    id: 'stable-video-diffusion',
    name: 'Stable Video Diffusion XT',
    description: 'Image-to-video motion dynamics for fluid cinematic shots.',
    provider: 'huggingface',
    type: 'video',
    isCustom: false,
  },
  {
    id: 'webgpu-neural-motion',
    name: 'WebGPU On-Device Motion Synthesizer',
    description: '100% in-browser GPU accelerated parallax, fluid morphing, and video rendering.',
    provider: 'webgpu',
    type: 'video',
    isCustom: false,
  },

  // Local & Edge Models
  {
    id: 'local-comfyui',
    name: 'Local ComfyUI / SD-WebUI',
    description: 'Connect directly to your local workstation running on localhost:8188 or 7860.',
    provider: 'local',
    type: 'both',
    endpointUrl: 'http://127.0.0.1:8188',
    isCustom: false,
  },
  {
    id: 'local-ollama',
    name: 'Local Ollama Vision',
    description: 'Local multi-modal model running via Ollama at localhost:11434.',
    provider: 'local',
    type: 'both',
    endpointUrl: 'http://localhost:11434',
    isCustom: false,
  },
];

export const ASPECT_RATIOS: Array<{
  id: AspectRatio;
  label: string;
  sublabel: string;
  width: number;
  height: number;
  iconRatio: string;
}> = [
  { id: '1:1', label: '1:1', sublabel: 'Square (Instagram/Avatar)', width: 1024, height: 1024, iconRatio: 'aspect-square' },
  { id: '9:16', label: '9:16', sublabel: 'Stories / TikTok / Reels', width: 768, height: 1344, iconRatio: 'aspect-[9/16]' },
  { id: '16:9', label: '16:9', sublabel: 'Cinematic Widescreen', width: 1344, height: 768, iconRatio: 'aspect-[16/9]' },
  { id: '4:3', label: '4:3', sublabel: 'Standard Photo', width: 1024, height: 768, iconRatio: 'aspect-[4/3]' },
  { id: '3:4', label: '3:4', sublabel: 'Vertical Portrait', width: 768, height: 1024, iconRatio: 'aspect-[3/4]' },
];

export const MOTION_STYLES: Array<{
  id: MotionStyle;
  label: string;
  description: string;
  iconName: string;
}> = [
  { id: 'zoom-in', label: 'Cinematic Dolly In', description: 'Smooth forward camera push with lens depth-of-field shift', iconName: 'ZoomIn' },
  { id: 'pan-left', label: 'Horizontal Pan Left', description: 'Graceful sweeping motion unveiling the left environment', iconName: 'MoveLeft' },
  { id: 'pan-right', label: 'Horizontal Pan Right', description: 'Sweeping scenic glide across the right landscape', iconName: 'MoveRight' },
  { id: 'orbit-360', label: '3D Orbit & Tilt', description: 'Dynamic 3D perspective rotation around the central focal subject', iconName: 'RotateCw' },
  { id: 'parallax-drift', label: 'Parallax Layer Drift', description: 'Multi-plane floating depth simulation with floating particles', iconName: 'Layers' },
  { id: 'pulse-morph', label: 'Neural Wave Morph', description: 'Dreamlike undulating optical pulses with subtle chromatic aberrations', iconName: 'Sparkles' },
];

export const STYLE_PRESETS: Array<{ id: string; label: string; promptSuffix: string }> = [
  { id: 'none', label: 'Raw / Unstyled', promptSuffix: '' },
  { id: 'cinematic', label: 'Cinematic Film', promptSuffix: 'shot on 35mm lens, cinematic film lighting, 8k resolution, color graded, shallow depth of field' },
  { id: 'photorealistic', label: 'Hyper-Realistic', promptSuffix: 'photorealistic documentary style, natural sunlight, highly detailed skin and fabric textures, raw photography' },
  { id: 'anime', label: 'Modern Anime', promptSuffix: 'high quality anime illustration, vivid lighting, crisp line art, Makoto Shinkai aesthetic, trending on pixiv' },
  { id: 'cyberpunk', label: 'Cyberpunk Neon', promptSuffix: 'neo-Tokyo cyberpunk, glowing neon reflections, holographic telemetry, volumetric fog, rainy streets at night' },
  { id: 'fantasy', label: 'Mythic Fantasy', promptSuffix: 'epic fantasy digital art, ethereal bioluminescent glow, majestic composition, Unreal Engine 5 render' },
  { id: '3d-octane', label: '3D Octane Render', promptSuffix: '3D render, Octane render, smooth subsurface scattering, studio rim light, clay and glass materials' },
  { id: 'vintage', label: '1970s Vintage', promptSuffix: 'vintage 1970s film grain, warm nostalgic tones, Polaroid border aesthetic, slight chromatic aberration' },
];
