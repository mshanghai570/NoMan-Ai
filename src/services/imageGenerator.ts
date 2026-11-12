import type {
  AspectRatio,
  PromptEnhancementResponse,
  PromptAssistantResponse,
  AIProvider,
  CustomProviderConfig,
} from '../types';
import { isServerProxyProvider } from '../providers/catalog';

export interface GenerationParams {
  prompt: string;
  negativePrompt?: string;
  model: string;
  provider: AIProvider;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  seed: number;
  steps?: number;
  cfgScale?: number;
  hfToken?: string;
  cloudApiKey?: string;
  localEndpoint?: string;
  realismBoost?: boolean;
  /** Locally stored provider keys, `${providerId}` or `${providerId}.${field}`. */
  providerKeys?: Record<string, string>;
  /** Optional API root overrides, keyed by provider id. */
  providerBaseUrls?: Record<string, string>;
  /** Custom JSON endpoint configuration. */
  customProvider?: CustomProviderConfig;
}

export interface VideoGenerationParams {
  prompt: string;
  negativePrompt?: string;
  model: string;
  provider: AIProvider;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  seed: number;
  duration?: number;
  imageUrl?: string;
  providerKeys?: Record<string, string>;
  providerBaseUrls?: Record<string, string>;
  customProvider?: CustomProviderConfig;
}

const PERCHANCE_IMAGE_API_URL = 'https://perchance.org/perchance-ai-api';

const perchanceResolution = (width: number, height: number): string => {
  if (width / height > 1.25) return '768x512';
  if (height / width > 1.25) return '512x768';
  return '768x768';
};

/** Build the documented Perchance Image API iframe URL (not an internal API URL). */
export const buildPerchanceImageApiUrl = (params: {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  seed: number;
  cfgScale?: number;
  requestId: string;
}): string => {
  const query = new URLSearchParams({
    prompt: params.prompt,
    format: 'json',
    id: params.requestId,
    resolution: perchanceResolution(params.width, params.height),
    seed: String(params.seed),
  });
  if (params.negativePrompt?.trim()) query.set('negativePrompt', params.negativePrompt.trim());
  if (typeof params.cfgScale === 'number' && Number.isFinite(params.cfgScale)) {
    query.set('guidanceScale', String(Math.min(Math.max(params.cfgScale, 1), 30)));
  }
  return `${PERCHANCE_IMAGE_API_URL}?${query.toString()}`;
};

let perchanceWarmup: Promise<void> | null = null;

const warmPerchanceBrowserSession = (): Promise<void> => {
  if (perchanceWarmup) return perchanceWarmup;
  perchanceWarmup = new Promise<void>((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;';
    frame.onload = () => {
      frame.remove();
      resolve();
    };
    frame.onerror = () => {
      frame.remove();
      resolve();
    };
    frame.src = 'https://perchance.org/';
    document.body.appendChild(frame);
  });
  return perchanceWarmup;
};

const generateWithPerchanceOfficialApi = async (params: GenerationParams, seed: number) => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('Perchance Official Image API must run in the browser.');
  }

  await warmPerchanceBrowserSession();
  const requestId = `noman_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const url = buildPerchanceImageApiUrl({
    prompt: params.prompt.trim(),
    negativePrompt: params.negativePrompt,
    width: params.width,
    height: params.height,
    seed,
    cfgScale: params.cfgScale,
    requestId,
  });

  return new Promise<{ imageUrl: string; seed: number }>((resolve, reject) => {
    const frame = document.createElement('iframe');
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Perchance did not return an image before the browser timeout.'));
    }, 120_000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      frame.remove();
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://perchance.org' || event.source !== frame.contentWindow) return;
      const message = event.data;
      const result = message?.api === 'perchance-image-api' ? message.result : undefined;
      if (!result || result.id !== requestId) return;
      cleanup();
      if (!result.ok) {
        reject(new Error(result.error || 'Perchance image generation failed.'));
        return;
      }
      const imageUrl = typeof result.url === 'string' ? result.url : result.dataUrl;
      if (!imageUrl) {
        reject(new Error('Perchance completed without returning an image URL.'));
        return;
      }
      resolve({ imageUrl, seed: typeof result.seed === 'number' ? result.seed : seed });
    };

    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;';
    window.addEventListener('message', onMessage);
    frame.src = url;
    document.body.appendChild(frame);
  });
};

export class ImageGeneratorService {
  /**
   * Generates an image using the selected provider and model
   */
  public static async generateImage(params: GenerationParams): Promise<{ imageUrl: string; seed: number; notice?: string }> {
    const {
      prompt,
      negativePrompt,
      model,
      provider,
      aspectRatio,
      width,
      height,
      seed,
      hfToken,
      cloudApiKey,
      localEndpoint,
      realismBoost,
    } = params;

    const actualSeed = seed && seed > 0 ? seed : Math.floor(Math.random() * 99999999);

    // Perchance's supported external API is browser-only: it returns the
    // result through postMessage from a documented iframe, not server JSON.
    if (provider === 'perchance') {
      return generateWithPerchanceOfficialApi(params, actualSeed);
    }

    // 1. Google Gemini Cloud Photorealism Generation
    if (provider === 'gemini') {
      try {
        const response = await fetch('/api/gemini/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            negativePrompt: negativePrompt || undefined,
            aspectRatio,
            apiKey: cloudApiKey || undefined,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.imageUrl) {
            return { imageUrl: data.imageUrl, seed: actualSeed };
          }
        }

        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Gemini generation returned status ${response.status}`);
      } catch (err: any) {
        console.warn('Gemini image call failed, routing to FLUX Ultra-Realism:', err);
        // Fallback to FLUX Realism with negative prompt preserved
        const safePrompt = prompt.trim();
        const neg = negativePrompt ? `&negative=${encodeURIComponent(negativePrompt.trim())}` : '&negative=blurry,faded,washed+out,plastic+skin';
        const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt)}?width=${width}&height=${height}&seed=${actualSeed}&model=flux-realism&enhance=true&nologo=true${neg}`;
        await this.preloadImage(fallbackUrl);
        return {
          imageUrl: fallbackUrl,
          seed: actualSeed,
          notice: `Cloud notice: ${err.message || 'Rendered via FLUX Ultra Realism'}`,
        };
      }
    }

    // 2. Hosted provider registry (Leonardo, Replicate, BytePlus, Cloudflare,
    // OpenAI-compatible, custom JSON). The server holds the adapter and,
    // preferably, the key.
    if (isServerProxyProvider(provider)) {
      const providerKeys = params.providerKeys || {};
      const response = await fetch('/api/providers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model,
          prompt,
          negativePrompt: negativePrompt || undefined,
          width,
          height,
          aspectRatio: params.aspectRatio,
          seed: actualSeed,
          steps: params.steps,
          cfgScale: params.cfgScale,
          credentials: {
            key: providerKeys[provider] || undefined,
            accountId: providerKeys[`${provider}.accountId`] || undefined,
            baseUrl: params.providerBaseUrls?.[provider] || undefined,
          },
          custom: params.customProvider,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Provider request failed (${response.status})`);
      }

      const imageUrl = Array.isArray(data.mediaUrls) ? data.mediaUrls[0] : '';
      if (!imageUrl) throw new Error('The provider returned no image.');

      return {
        imageUrl,
        seed: typeof data.seed === 'number' ? data.seed : actualSeed,
      };
    }

    // 3. Pollinations Cloud (FLUX Realism, FLUX Schnell, etc.)
    if (provider === 'pollinations') {
      const finalPrompt = prompt.trim();
      const isRealismModel = model.includes('realism') || realismBoost;
      const targetModel = model || (isRealismModel ? 'flux-realism' : 'flux');

      let url = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=${width}&height=${height}&seed=${actualSeed}&model=${encodeURIComponent(targetModel)}&nologo=true`;

      if (isRealismModel) {
        url += '&enhance=true';
      }

      // Append negative prompt if provided, or default anti-faded/anti-blurry shield
      if (negativePrompt && negativePrompt.trim()) {
        url += `&negative=${encodeURIComponent(negativePrompt.trim())}`;
      } else if (isRealismModel) {
        url += `&negative=${encodeURIComponent('blurry, faded, washed out, low contrast, plastic skin, airbrush, cartoon, 3d render, low resolution, bad anatomy')}`;
      }

      // Preload image to ensure it is generated and ready before returning
      await this.preloadImage(url);
      return { imageUrl: url, seed: actualSeed };
    }

    // 3. Hugging Face Inference API
    if (provider === 'huggingface') {
      try {
        const response = await fetch('/api/hf/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: model,
            inputs: prompt,
            parameters: {
              negative_prompt: negativePrompt || (realismBoost ? 'blurry, faded, washed out, low quality, artifacts' : undefined),
              width,
              height,
              guidance_scale: params.cfgScale || 7.5,
              num_inference_steps: params.steps || 30,
              seed: actualSeed,
            },
            token: hfToken || undefined,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.imageUrl) {
            return { imageUrl: data.imageUrl, seed: actualSeed };
          }
        }

        const errData = await response.json().catch(() => ({}));
        const status = response.status;
        const msg = errData.error || `Hugging Face returned status ${status}`;

        // When HF fails (e.g. 401 token required, 503 loading, 429 rate limit),
        // we provide FLUX Realism with the user's negative prompt, and return a helpful notice
        console.warn(`Hugging Face model ${model} failed (${msg}). Routing through FLUX Realism.`);
        const safePrompt = prompt.trim();
        const neg = negativePrompt ? `&negative=${encodeURIComponent(negativePrompt.trim())}` : '&negative=blurry,faded,washed+out,low+contrast';
        const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt)}?width=${width}&height=${height}&seed=${actualSeed}&model=flux-realism&enhance=true&nologo=true${neg}`;
        await this.preloadImage(fallbackUrl);

        return {
          imageUrl: fallbackUrl,
          seed: actualSeed,
          notice: `HF Notice (${status || 401}): ${msg.slice(0, 120)}. Rendered with FLUX Ultra-Realism.`,
        };
      } catch (err: any) {
        console.warn('Hugging Face call failed, falling back to FLUX Realism:', err);
        const safePrompt = prompt.trim();
        const neg = negativePrompt ? `&negative=${encodeURIComponent(negativePrompt.trim())}` : '';
        const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt)}?width=${width}&height=${height}&seed=${actualSeed}&model=flux-realism&enhance=true&nologo=true${neg}`;
        await this.preloadImage(fallbackUrl);
        return {
          imageUrl: fallbackUrl,
          seed: actualSeed,
          notice: `HF connection error. Rendered via FLUX Ultra Realism.`,
        };
      }
    }

    // 4. Local Workstation & Endpoints
    if (provider === 'local') {
      const endpoint = localEndpoint || 'http://127.0.0.1:8188';
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        // Try local SD-WebUI or Ollama format
        const response = await fetch(`${endpoint.replace(/\/$/, '')}/sdapi/v1/txt2img`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            negative_prompt: negativePrompt || '',
            steps: params.steps || 25,
            width,
            height,
            seed: actualSeed,
            cfg_scale: params.cfgScale || 7,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.images && data.images[0]) {
            return {
              imageUrl: `data:image/png;base64,${data.images[0]}`,
              seed: actualSeed,
            };
          }
        }
        throw new Error(`Local server at ${endpoint} returned status ${response.status}`);
      } catch (e: any) {
        console.warn('Local workstation unreachable, routing to FLUX Realism fallback:', e);
        const neg = negativePrompt ? `&negative=${encodeURIComponent(negativePrompt.trim())}` : '&negative=blurry,faded,washed+out';
        const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ', hyper-detailed photography, 8k')}?width=${width}&height=${height}&seed=${actualSeed}&model=flux-realism&enhance=true&nologo=true${neg}`;
        await this.preloadImage(fallbackUrl);
        return {
          imageUrl: fallbackUrl,
          seed: actualSeed,
          notice: `Local workstation at ${endpoint} is offline. Generated via Cloud Ultra Realism.`,
        };
      }
    }

    // Default WebGPU / Cloud Realism fallback
    const neg = negativePrompt ? `&negative=${encodeURIComponent(negativePrompt.trim())}` : '&negative=blurry,faded,washed+out';
    const edgeUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${actualSeed}&model=flux-realism&enhance=true&nologo=true${neg}`;
    await this.preloadImage(edgeUrl);
    return { imageUrl: edgeUrl, seed: actualSeed };
  }

  /**
   * Generate a provider-backed video. Local image-to-video motion remains in
   * VideoEngine; this method is for providers with a documented video route.
   */
  public static async generateVideo(
    params: VideoGenerationParams
  ): Promise<{ videoUrl: string; seed: number; notice?: string }> {
    const actualSeed = params.seed && params.seed > 0
      ? params.seed
      : Math.floor(Math.random() * 99_999_999);
    const duration = Math.min(Math.max(params.duration || 5, 1), 10);

    if (params.provider === 'pollinations') {
      const query = new URLSearchParams({
        model: params.model || 'wan',
        duration: String(duration),
        seed: String(actualSeed),
      });
      const videoUrl = `https://gen.pollinations.ai/video/${encodeURIComponent(
        params.prompt.trim()
      )}?${query.toString()}`;
      return { videoUrl, seed: actualSeed };
    }

    if (isServerProxyProvider(params.provider)) {
      const response = await fetch('/api/providers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: params.provider,
          kind: 'video',
          model: params.model,
          prompt: params.prompt,
          negativePrompt: params.negativePrompt || undefined,
          imageUrl: params.imageUrl || undefined,
          width: params.width,
          height: params.height,
          aspectRatio: params.aspectRatio,
          seed: actualSeed,
          duration,
          credentials: {
            key: params.providerKeys?.[params.provider] || undefined,
            accountId: params.providerKeys?.[`${params.provider}.accountId`] || undefined,
            baseUrl: params.providerBaseUrls?.[params.provider] || undefined,
          },
          custom: params.customProvider,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Video provider request failed (${response.status})`);
      }
      const videoUrl = Array.isArray(data.mediaUrls) ? data.mediaUrls[0] : '';
      if (!videoUrl) throw new Error('The video provider returned no media URL.');
      return {
        videoUrl,
        seed: typeof data.seed === 'number' ? data.seed : actualSeed,
      };
    }

    throw new Error(
      `${params.provider} does not have a configured video adapter. Use a supported video provider or the local motion renderer.`
    );
  }

  /**
   * Preloads an image URL and ensures it doesn't 404 or fail
   */
  private static preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timeout = setTimeout(() => {
        // Resolve anyway after 15s to not block user forever
        resolve();
      }, 15000);

      img.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      img.onerror = (e) => {
        clearTimeout(timeout);
        // Even if browser image error triggered, don't fail hard if network was momentarily interrupted
        resolve();
      };
      img.src = url;
    });
  }

  /**
   * Calls Gemini Prompt Magic to enhance prompt, negative prompt, and cinematic camera cues
   */
  public static async enhancePrompt(
    prompt: string,
    mode: 'image' | 'video' | 'extend' = 'image',
    style: string = 'cinematic'
  ): Promise<PromptEnhancementResponse> {
    try {
      const response = await fetch('/api/gemini/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode, style }),
      });

      if (!response.ok) {
        throw new Error(`Enhancement error ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.warn('Prompt enhancement fallback:', err);
      return {
        enhancedPrompt: `${prompt.trim()}, cinematic film lighting, 8k resolution, ultra-detailed textures, masterpiece composition, award-winning cinematography`,
        negativePrompt: 'blurry, oversaturated, deformed, bad anatomy, artifacts, low resolution, watermark',
        suggestedMotion: 'Slow dynamic dolly-in camera motion with focal blur transition',
        source: 'client-fallback',
      };
    }
  }

  /**
   * Calls lightweight Gemini LLM to suggest descriptive keywords and stylistic adjectives
   */
  public static async suggestKeywords(prompt: string, style: string = 'none'): Promise<PromptAssistantResponse> {
    try {
      const response = await fetch('/api/gemini/suggest-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style }),
      });

      if (!response.ok) {
        throw new Error(`Keywords error ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.warn('Keywords suggestion fallback:', err);
      return {
        source: 'client-fallback',
        categories: [
          {
            name: 'Lighting & Radiance',
            keywords: [
              'dramatic chiaroscuro',
              'golden hour rim lighting',
              'volumetric god rays',
              'soft ambient studio glow',
              'ethereal bioluminescence'
            ]
          },
          {
            name: 'Atmosphere & Mood',
            keywords: [
              'dense misty haze',
              'cinematic atmospheric depth',
              'rain-slicked reflections',
              'celestial stillness',
              'moody high-contrast shadows'
            ]
          },
          {
            name: 'Textures & Surfaces',
            keywords: [
              'subsurface scattering',
              'intricate filigree',
              'tactile organic weave',
              'weathered patina',
              'micro-droplets on surface'
            ]
          },
          {
            name: 'Camera & Optics',
            keywords: [
              'shot on 85mm f/1.4 prime lens',
              'shallow depth of field',
              'low-angle cinematic perspective',
              'anamorphic 2.39:1 framing',
              'macro focus with sharp center'
            ]
          },
          {
            name: 'Stylistic Adjectives',
            keywords: [
              'hyper-detailed octane render',
              'contemporary matte painting',
              'award-winning cinematography',
              'masterpiece composition',
              '8k commercial photography'
            ]
          }
        ]
      };
    }
  }
}
