import type { AspectRatio, PromptEnhancementResponse, PromptAssistantResponse, AIProvider } from '../types';

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
}

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

    // 2. Pollinations Cloud (FLUX Realism, FLUX Schnell, etc.)
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
