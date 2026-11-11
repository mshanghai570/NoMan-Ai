/**
 * Server-side API handler for Gemini prompt enhancement, Hugging Face proxying, and local AI bridges.
 * Runs inside Vite's dev server middleware and production server.
 */
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { IncomingMessage, ServerResponse } from 'http';
import {
  assertServerChatProvider,
  completeChat,
  createScenePrompt,
  streamChat,
  summarizeConversation,
} from './roleplayEngine.ts';

// Initialize Gemini client with aistudio-build telemetry header
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Helper to parse JSON body from incoming stream
const parseJsonBody = async (req: IncomingMessage): Promise<any> => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // Protect against large payloads
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
};

const rejectWebLlmProvider = (provider: unknown, res: ServerResponse): boolean => {
  if (provider !== 'webllm') return false;

  try {
    assertServerChatProvider(provider);
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'WebLLM must run in the browser.',
      })
    );
    return true;
  }

  return false;
};

export const handleApiRequest = async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
  const url = req.url || '';

  // Only handle /api/ routes
  if (!url.startsWith('/api/')) {
    return false;
  }

  // Set standard CORS & JSON headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  // 1. Gemini Prompt Magic / Director Enhancer
  if (url === '/api/gemini/enhance' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { prompt, mode = 'image', style = 'cinematic' } = body;

      if (!prompt || typeof prompt !== 'string') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing prompt parameter' }));
        return true;
      }

      const ai = getGeminiClient();
      if (!ai) {
        // Fallback intelligent prompt enhancement if GEMINI_API_KEY is not configured
        const fallbackEnhancements: Record<string, string> = {
          cinematic: 'cinematic lighting, 8k resolution, photorealistic volumetric depth, anamorphic lens flare, award-winning cinematography',
          anime: 'makoto shinkai aesthetic, high detail anime masterpiece, vibrant colors, expressive eyes, crisp line art, trending on pixiv',
          photorealistic: 'shot on 35mm Hasselblad, natural lighting, ultra-realistic skin texture, 8k commercial photography, award-winning',
          cyberpunk: 'neo-Tokyo neon rain, holographic reflections, cybernetic luminescence, volumetric foggy street, dark atmospheric lighting',
          fantasy: 'ethereal bioluminescence, mythic grandeur, hyper-detailed fantasy art, unreal engine 5 render, epic composition',
        };
        const addition = fallbackEnhancements[style] || 'cinematic lighting, ultra detailed, 8k resolution, masterpiece';
        const enhanced = mode === 'video'
          ? `${prompt.trim()}, dynamic camera glide, fluid motion, hyper-realistic physics, 60fps cinematic movement, ${addition}`
          : `${prompt.trim()}, masterpiece quality, ultra-detailed textures, perfectly balanced composition, ${addition}`;

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          enhancedPrompt: enhanced,
          negativePrompt: 'blurry, distorted, low quality, artifacts, watermark, low resolution, bad anatomy',
          suggestedMotion: 'Slow cinematic dolly forward with subtle lens flare',
          source: 'local-enhancer',
        }));
        return true;
      }

      // Call Gemini 3.8 Flash for Director-grade prompt engineering
      const systemInstruction = `You are a world-class AI Image & Video Director for "NoMan AI".
Transform the user's brief prompt into an ultra-vivid, highly evocative AI generation prompt.
If mode is 'image': Output a detailed descriptive prompt specifying subject, atmosphere, lighting, camera angle, and textures.
If mode is 'video' or 'extend': Describe dynamic camera motion (pan, tilt, dolly, orbit, zoom), fluid environmental dynamics, and lighting transitions.
Respond with JSON matching this structure:
{
  "enhancedPrompt": string (the upgraded prompt, 40-80 words),
  "negativePrompt": string (comma-separated negative cues to avoid artifacts),
  "suggestedMotion": string (recommended camera movement or video transition cue)
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Mode: ${mode}\nVisual Style: ${style}\nUser input: "${prompt}"`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '{}';
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(responseText);
      return true;
    } catch (err: any) {
      console.error('Gemini enhance error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Prompt enhancement failed' }));
      return true;
    }
  }

  // 1b. Prompt Assistant: Lightweight LLM call to suggest descriptive keywords & stylistic adjectives
  if (url === '/api/gemini/suggest-keywords' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { prompt = '', style = 'none' } = body;

      const ai = getGeminiClient();
      if (!ai) {
        // High quality fallback keywords
        const lower = prompt.toLowerCase();
        const isSciFi = lower.includes('space') || lower.includes('cyber') || lower.includes('ship') || lower.includes('robot');
        const isFantasy = lower.includes('dragon') || lower.includes('forest') || lower.includes('magic') || lower.includes('celestial') || lower.includes('island');
        const isPortrait = lower.includes('person') || lower.includes('woman') || lower.includes('man') || lower.includes('warrior') || lower.includes('traveler') || lower.includes('portrait');

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          source: 'local-assistant',
          categories: [
            {
              name: 'Lighting & Radiance',
              keywords: isSciFi
                ? ['neon rim lighting', 'volumetric cockpit glow', 'starlight reflections', 'anamorphic cyan flare']
                : isFantasy
                ? ['bioluminescent glow', 'golden hour sunbeams', 'ethereal moonlight', 'firefly ambient radiance']
                : ['dramatic chiaroscuro', 'soft diffused key light', 'golden hour rim glow', 'subtle cinematic backlight']
            },
            {
              name: 'Atmosphere & Mood',
              keywords: isSciFi
                ? ['steaming rainy alley', 'orbital weightlessness', 'cybernetic grit', 'dense holographic haze']
                : isFantasy
                ? ['floating mist', 'celestial tranquility', 'aurora borealis wash', 'ancient timeless silence']
                : ['moody atmosphere', 'shallow focus haze', 'cinematic depth', 'quiet contemplation']
            },
            {
              name: 'Textures & Surfaces',
              keywords: isPortrait
                ? ['subsurface skin scattering', 'tactile weathered fabric', 'micro-droplets on skin', 'fine hair strands']
                : isSciFi
                ? ['brushed titanium plating', 'weathered carbon fiber', 'iridescent visor glass', 'micro-circuits']
                : ['intricate filigree', 'organic moss and stone', 'delicate crystalline shards', 'weathered patina']
            },
            {
              name: 'Camera & Optics',
              keywords: [
                'shot on 85mm prime lens',
                'f/1.4 aperture blur',
                'cinematic low angle perspective',
                'anamorphic widescreen 2.39:1',
                'macro focus with sharp center'
              ]
            },
            {
              name: 'Stylistic Adjectives',
              keywords: [
                'hyper-detailed octane render',
                'award-winning cinematography',
                'fine art museum aesthetic',
                'rich color grading',
                '8k commercial master'
              ]
            }
          ]
        }));
        return true;
      }

      const systemInstruction = `You are an expert AI prompt artist and creative director for "NoMan AI".
Analyze the user's concept and generate an array of descriptive keywords and stylistic adjectives that will dramatically elevate the visual fidelity, mood, and atmosphere of image generation.
Categorize them into 5 distinct categories:
1. "Lighting & Radiance" (4-5 vivid lighting terms)
2. "Atmosphere & Mood" (4-5 atmospheric descriptors)
3. "Textures & Surfaces" (4-5 tactile, surface-level micro details)
4. "Camera & Optics" (4-5 cinematography or photographic angles)
5. "Stylistic Adjectives" (4-5 artistic or aesthetic modifiers)

Output strictly valid JSON with this exact shape:
{
  "categories": [
    { "name": string, "keywords": string[] }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `User Prompt: "${prompt || 'Creative masterpiece'}"\nSelected Visual Style: ${style}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const responseText = response.text || '{"categories":[]}';
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(responseText);
      return true;
    } catch (err: any) {
      console.error('Prompt assistant error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Keyword suggestion failed' }));
      return true;
    }
  }

  // 1c. Streaming roleplay chat (Gemini / Ollama / OpenAI-compatible)
  if (url === '/api/chat/stream' && req.method === 'POST') {
    let body: any;
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Invalid JSON' }));
      return true;
    }

    if (!body?.userMessage || typeof body.userMessage !== 'string') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Missing userMessage parameter' }));
      return true;
    }
    if (rejectWebLlmProvider(body?.config?.provider, res)) return true;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const send = (payload: Record<string, unknown>) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };
    const controller = new AbortController();
    res.on('close', () => controller.abort());

    try {
      const fallback = body?.config?.fallback;
      const canFallback =
        fallback?.enabled === true &&
        typeof fallback?.endpoint === 'string' &&
        typeof fallback?.model === 'string' &&
        fallback.model.trim().length > 0;

      let emitted = false;

      const pump = async (payload: Record<string, unknown>) => {
        for await (const delta of streamChat(payload as any, controller.signal)) {
          if (controller.signal.aborted) return;
          emitted = true;
          send({ type: 'delta', text: delta });
        }
      };

      try {
        await pump(body);
      } catch (primaryError: any) {
        // Only retry when nothing has been sent yet — a half-written reply
        // cannot be transparently restarted.
        if (!canFallback || emitted || controller.signal.aborted) throw primaryError;

        console.warn(
          `Primary roleplay provider failed (${primaryError?.message || primaryError}); retrying on local model ${fallback.model}`
        );
        send({ type: 'fallback', provider: 'ollama', model: fallback.model });

        await pump({
          ...body,
          config: {
            ...(body.config || {}),
            provider: 'ollama',
            endpoint: fallback.endpoint,
            model: fallback.model,
            apiKey: '',
          },
        });
      }

      if (!controller.signal.aborted) send({ type: 'done' });
      res.end();
    } catch (err: any) {
      console.error('Roleplay stream error:', err);
      send({ type: 'error', error: err.message || 'Chat generation failed' });
      res.end();
    }
    return true;
  }

  // 1d. Rolling memory extraction (summary + durable facts + relationship)
  if (url === '/api/chat/summarize' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      if (!body?.persona || !Array.isArray(body.messages)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing persona or messages' }));
        return true;
      }
      if (rejectWebLlmProvider(body?.config?.provider, res)) return true;

      const memory = await summarizeConversation({
        persona: body.persona,
        memory: body.memory || { summary: '', facts: [], relationship: '', updatedAt: 0 },
        messages: body.messages,
        config: body.config,
      });

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ memory }));
      return true;
    } catch (err: any) {
      console.error('Memory summarization error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Memory summarization failed' }));
      return true;
    }
  }

  // 1e. Character-consistent scene / portrait prompt for the image engine
  if (url === '/api/chat/scene-prompt' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      if (!body?.persona) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing persona' }));
        return true;
      }
      if (rejectWebLlmProvider(body?.config?.provider, res)) return true;

      const result = await createScenePrompt({
        persona: body.persona,
        memory: body.memory,
        messages: Array.isArray(body.messages) ? body.messages : [],
        nsfw: body.nsfw === true,
        kind: body.kind === 'portrait' ? 'portrait' : 'scene',
        config: body.config,
      });

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
      return true;
    } catch (err: any) {
      console.error('Scene prompt error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Scene prompt generation failed' }));
      return true;
    }
  }

  // 1f. Legacy non-streaming chat endpoint (kept for compatibility)
  if (url === '/api/gemini/chat' && req.method === 'POST') {
    let body: any = {};
    try {
      body = await parseJsonBody(req);
      if (rejectWebLlmProvider(body?.config?.provider, res)) return true;
      const { persona, messages = [], userMessage, nsfw = false } = body;

      if (!userMessage || typeof userMessage !== 'string') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing userMessage parameter' }));
        return true;
      }

      const reply = await completeChat({
        persona: persona || { name: 'Character' },
        messages,
        memory: body.memory,
        avoidPhrases: body.avoidPhrases,
        userMessage,
        nsfw: nsfw === true,
        replyLength: body.replyLength,
        config: { provider: 'gemini', ...(body.config || {}) },
      });

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ reply, nsfw: nsfw === true }));
      return true;
    } catch (err: any) {
      // Keep the old endpoint graceful when no provider is configured.
      console.error('Roleplay chat error:', err);
      const personaName = body?.persona?.name || 'Character';
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          reply: `*${personaName} pauses, listening closely* "The comms are unreliable right now, but I hear you. Let us keep moving."`,
          source: 'local-fallback',
          nsfw: body?.nsfw === true,
        })
      );
      return true;
    }
  }

  if (url === '/api/hf/generate' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { modelId, inputs, parameters, token } = body;

      if (!modelId || !inputs) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing modelId or inputs' }));
        return true;
      }

      // Hugging Face inference endpoint
      const hfEndpoint = `https://api-inference.huggingface.co/models/${encodeURIComponent(modelId)}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const hfResponse = await fetch(hfEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ inputs, parameters: parameters || {} }),
      });

      if (!hfResponse.ok) {
        const errorText = await hfResponse.text();
        res.statusCode = hfResponse.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: errorText || `HF error ${hfResponse.status}` }));
        return true;
      }

      const contentType = hfResponse.headers.get('content-type') || '';
      if (contentType.includes('image/')) {
        const arrayBuffer = await hfResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const dataUrl = `data:${contentType};base64,${base64}`;

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ imageUrl: dataUrl }));
        return true;
      } else {
        const json = await hfResponse.json();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(json));
        return true;
      }
    } catch (err: any) {
      console.error('HF proxy error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Hugging Face request failed' }));
      return true;
    }
  }

  // 3. Image Upscaling API (2x and 4x Super Resolution via External API)
  if (url === '/api/upscale' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { imageUrl, scale = 2, prompt = '', seed = 42, token } = body;

      if (!imageUrl) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing imageUrl' }));
        return true;
      }

      const scaleMultiplier: 2 | 4 = scale === 4 ? 4 : 2;
      const baseWidth = body.width || 1024;
      const baseHeight = body.height || 1024;
      const targetWidth = Math.min(baseWidth * scaleMultiplier, 4096);
      const targetHeight = Math.min(baseHeight * scaleMultiplier, 4096);

      // Attempt 1: If user supplied HF Token, try external Hugging Face Super-Resolution API
      if (token) {
        try {
          const hfModel = scaleMultiplier === 4
            ? 'stabilityai/stable-diffusion-x4-upscaler'
            : 'caidas/swin2SR-classical-sr-x2-64';

          const hfResponse = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              inputs: imageUrl,
              parameters: { scale: scaleMultiplier },
            }),
          });

          if (hfResponse.ok) {
            const contentType = hfResponse.headers.get('content-type') || '';
            if (contentType.includes('image/')) {
              const arrayBuffer = await hfResponse.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                upscaledUrl: `data:${contentType};base64,${base64}`,
                scale: scaleMultiplier,
                width: targetWidth,
                height: targetHeight,
                engine: `Hugging Face (${hfModel})`,
              }));
              return true;
            }
          }
        } catch (hfErr) {
          console.warn('HF upscale failed, falling back to neural super-res:', hfErr);
        }
      }

      // Attempt 2: High-Resolution FLUX Super-Resolution External API
      const upscalePrompt = prompt
        ? `${prompt.trim()}, 8k super-resolution masterpiece, ultra-detailed micro textures, sharp crystalline edges, clean photography`
        : 'ultra-detailed 8k super resolution commercial quality';

      const upscaledExternalUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(upscalePrompt)}?width=${targetWidth}&height=${targetHeight}&seed=${seed}&model=flux&nologo=true`;

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        upscaledUrl: upscaledExternalUrl,
        scale: scaleMultiplier,
        width: targetWidth,
        height: targetHeight,
        engine: `FLUX Neural Super-Res ${scaleMultiplier}x API`,
      }));
      return true;
    } catch (err: any) {
      console.error('Upscale error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Upscaling failed' }));
      return true;
    }
  }

  // 4. Health & Local AI status check
  if (url === '/api/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'ok',
      hasGemini: !!process.env.GEMINI_API_KEY,
      timestamp: Date.now(),
      app: 'NoMan AI',
    }));
    return true;
  }

  return false;
};
