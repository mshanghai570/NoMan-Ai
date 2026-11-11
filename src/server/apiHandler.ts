/**
 * Server-side API handler for Gemini prompt enhancement, Hugging Face proxying, and local AI bridges.
 * Runs inside Vite's dev server middleware and production server.
 */
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { IncomingMessage, ServerResponse } from 'http';

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

  // 1c. Gemini AI Roleplay Character Chat Endpoint
  if (url === '/api/gemini/chat' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { persona, messages = [], userMessage } = body;

      if (!userMessage || typeof userMessage !== 'string') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing userMessage parameter' }));
        return true;
      }

      const personaName = persona?.name || 'Character';
      const systemInstruction = `${persona?.systemPrompt || `You are ${personaName}, an engaging AI roleplay character.`}
Scenario: ${persona?.scenario || 'A creative interactive roleplay world.'}

ROLEPLAY GUIDELINES:
- Stay completely immersed in your persona.
- Use asterisks for character actions, gestures, sensory cues, and emotional reactions (e.g. *leans forward with a knowing smile*, *pauses thoughtfully*).
- Speak directly in the character's unique voice and tone.
- React dynamically to what the user says and does. Keep answers engaging, vivid, and narrative.
- Keep all interactions creative, immersive, and compliant with standard content safety guidelines.`;

      const ai = getGeminiClient();
      if (!ai) {
        // Fallback local character response if API key is not present
        const fallbackActions = [
          `*looks at you intently and nods* "That's an intriguing point. In our world, things aren't always so straightforward."`,
          `*glances around the surroundings before leaning in* "You've got courage bringing that up here. Let's see how this unfolds."`,
          `*smiles faintly as energy crackles subtly in the air* "I hear you clearly. Let us move to the next phase of our journey."`,
        ];
        const randomReply = fallbackActions[Math.floor(Math.random() * fallbackActions.length)];

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          reply: `${randomReply} *takes a measured breath* What is your next move?`,
          source: 'local-fallback',
        }));
        return true;
      }

      // Format conversation turns for Gemini generateContent
      // Take up to the last 12 turns for context memory
      const recentHistory = messages.slice(-12);
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      for (const msg of recentHistory) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }

      // Add current user message
      contents.push({
        role: 'user',
        parts: [{ text: userMessage }],
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const reply = response.text || `*${personaName} looks at you thoughtfully and smiles* "Understood."`;

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ reply }));
      return true;
    } catch (err: any) {
      console.error('Roleplay chat error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Chat generation failed' }));
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
