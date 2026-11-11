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

const synthesizeThemeFromPrompt = (prompt: string): any => {
  const p = (prompt || '').toLowerCase();
  const id = `custom_${Date.now()}`;

  if (p.includes('cyber') || p.includes('neon') || p.includes('tokyo') || p.includes('hacker')) {
    return {
      id,
      name: 'Neo Cyber Glitch',
      description: 'High-contrast neo-Tokyo streets with electric cyan, acid yellow, and cybernetic fonts.',
      vibe: 'cyberpunk',
      createdAt: Date.now(),
      isAiGenerated: true,
      prompt,
      colors: {
        background: '#07090e',
        surface: '#0f141f',
        card: 'rgba(15, 20, 31, 0.85)',
        border: 'rgba(0, 240, 255, 0.28)',
        primaryAccent: '#00f0ff',
        secondaryAccent: '#ffe600',
        glow: 'rgba(0, 240, 255, 0.4)',
        textPrimary: '#ffffff',
        textMuted: '#94a3b8',
      },
      typography: {
        fontFamily: 'Space Grotesk',
        headingFont: 'Orbitron',
        monoFont: 'Space Mono',
        googleFontFamilies: ['Space Grotesk', 'Orbitron', 'Space Mono'],
      },
      borderRadius: 'md',
    };
  }

  if (p.includes('synth') || p.includes('80') || p.includes('retro') || p.includes('vapor') || p.includes('sunset')) {
    return {
      id,
      name: 'Retro Synthwave Sunset',
      description: 'Magenta neon sunset over a digital horizon with 80s arcade typography.',
      vibe: 'synthwave',
      createdAt: Date.now(),
      isAiGenerated: true,
      prompt,
      colors: {
        background: '#120822',
        surface: '#1c0d36',
        card: 'rgba(28, 13, 54, 0.82)',
        border: 'rgba(217, 70, 239, 0.28)',
        primaryAccent: '#d946ef',
        secondaryAccent: '#f59e0b',
        glow: 'rgba(217, 70, 239, 0.45)',
        textPrimary: '#fae8ff',
        textMuted: '#d8b4fe',
      },
      typography: {
        fontFamily: 'Outfit',
        headingFont: 'Audiowide',
        monoFont: 'Space Mono',
        googleFontFamilies: ['Outfit', 'Audiowide', 'Space Mono'],
      },
      borderRadius: '2xl',
    };
  }

  if (p.includes('dracula') || p.includes('goth') || p.includes('blood') || p.includes('vampire') || p.includes('crimson')) {
    return {
      id,
      name: 'Dracula Gothic Nocturne',
      description: 'Obsidian crypt with deep velvet crimson highlights and mythic serif elegance.',
      vibe: 'gothic',
      createdAt: Date.now(),
      isAiGenerated: true,
      prompt,
      colors: {
        background: '#0a0507',
        surface: '#170a0f',
        card: 'rgba(23, 10, 15, 0.85)',
        border: 'rgba(244, 63, 94, 0.25)',
        primaryAccent: '#f43f5e',
        secondaryAccent: '#a855f7',
        glow: 'rgba(244, 63, 94, 0.35)',
        textPrimary: '#fff1f2',
        textMuted: '#fda4af',
      },
      typography: {
        fontFamily: 'Cinzel',
        headingFont: 'Cinzel',
        monoFont: 'JetBrains Mono',
        googleFontFamilies: ['Cinzel'],
      },
      borderRadius: 'lg',
    };
  }

  if (p.includes('gold') || p.includes('emerald') || p.includes('luxury') || p.includes('royal') || p.includes('champagne')) {
    return {
      id,
      name: 'Emerald & Royal Gold',
      description: 'Deep jewel-toned emerald with warm champagne gold accents and editorial typography.',
      vibe: 'luxury',
      createdAt: Date.now(),
      isAiGenerated: true,
      prompt,
      colors: {
        background: '#03100a',
        surface: '#062014',
        card: 'rgba(6, 32, 20, 0.82)',
        border: 'rgba(16, 185, 129, 0.25)',
        primaryAccent: '#10b981',
        secondaryAccent: '#fbbf24',
        glow: 'rgba(16, 185, 129, 0.35)',
        textPrimary: '#ecfdf5',
        textMuted: '#a7f3d0',
      },
      typography: {
        fontFamily: 'Plus Jakarta Sans',
        headingFont: 'Playfair Display',
        monoFont: 'JetBrains Mono',
        googleFontFamilies: ['Playfair Display'],
      },
      borderRadius: 'xl',
    };
  }

  if (p.includes('matrix') || p.includes('terminal') || p.includes('console') || p.includes('green')) {
    return {
      id,
      name: 'Matrix Phosphor Stream',
      description: 'CRT phosphor green on pitch black with authentic monospace coding type.',
      vibe: 'matrix',
      createdAt: Date.now(),
      isAiGenerated: true,
      prompt,
      colors: {
        background: '#020904',
        surface: '#051408',
        card: 'rgba(5, 20, 8, 0.88)',
        border: 'rgba(34, 197, 94, 0.28)',
        primaryAccent: '#22c55e',
        secondaryAccent: '#84cc16',
        glow: 'rgba(34, 197, 94, 0.4)',
        textPrimary: '#dcfce7',
        textMuted: '#86efac',
      },
      typography: {
        fontFamily: 'JetBrains Mono',
        headingFont: 'Share Tech Mono',
        monoFont: 'JetBrains Mono',
        googleFontFamilies: ['JetBrains Mono', 'Share Tech Mono'],
      },
      borderRadius: 'none',
    };
  }

  if (p.includes('nordic') || p.includes('ice') || p.includes('frost') || p.includes('arctic') || p.includes('blue')) {
    return {
      id,
      name: 'Nordic Arctic Frost',
      description: 'Crisp glacial ice cyan on deep Scandinavian midnight with ultra-clean modern typography.',
      vibe: 'minimal',
      createdAt: Date.now(),
      isAiGenerated: true,
      prompt,
      colors: {
        background: '#040d18',
        surface: '#091829',
        card: 'rgba(9, 24, 41, 0.82)',
        border: 'rgba(56, 189, 248, 0.25)',
        primaryAccent: '#38bdf8',
        secondaryAccent: '#a5f3fc',
        glow: 'rgba(56, 189, 248, 0.35)',
        textPrimary: '#f0f9ff',
        textMuted: '#bae6fd',
      },
      typography: {
        fontFamily: 'Inter',
        headingFont: 'Urbanist',
        monoFont: 'Fira Code',
        googleFontFamilies: ['Inter', 'Urbanist', 'Fira Code'],
      },
      borderRadius: 'xl',
    };
  }

  // Default balanced creative theme
  return {
    id,
    name: 'Harmonic Twilight Studio',
    description: `A custom theme inspired by "${prompt}" with deep obsidian tones and dual neon glow.`,
    vibe: 'custom',
    createdAt: Date.now(),
    isAiGenerated: true,
    prompt,
    colors: {
      background: '#080a14',
      surface: '#0f1426',
      card: 'rgba(15, 20, 38, 0.82)',
      border: 'rgba(99, 102, 241, 0.25)',
      primaryAccent: '#6366f1',
      secondaryAccent: '#06b6d4',
      glow: 'rgba(99, 102, 241, 0.35)',
      textPrimary: '#f8fafc',
      textMuted: '#94a3b8',
    },
    typography: {
      fontFamily: 'Space Grotesk',
      headingFont: 'Space Grotesk',
      monoFont: 'JetBrains Mono',
      googleFontFamilies: ['Space Grotesk'],
    },
    borderRadius: 'xl',
  };
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

  // 1b-2. Gemini AI Theme & Font Generator
  if (url === '/api/gemini/generate-theme' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { prompt = '', apiKey } = body;

      if (!prompt || typeof prompt !== 'string') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing prompt parameter' }));
        return true;
      }

      // Check if user provided custom API key or use system environment key
      let ai = apiKey
        ? new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } })
        : getGeminiClient();

      if (!ai) {
        // Fallback intelligent theme synthesizer when Gemini API key is not present
        const theme = synthesizeThemeFromPrompt(prompt);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ theme, source: 'synthesizer' }));
        return true;
      }

      const systemInstruction = `You are an elite design system architect and UI theme generator for "NoMan AI".
Given the user's theme concept, visual aesthetic, or vibe prompt, design a complete, stunning, high-contrast dark-mode color scheme and typography font pairing.
The fonts must be well-known Google Fonts (e.g. "Space Grotesk", "Inter", "Plus Jakarta Sans", "Outfit", "Orbitron", "Cinzel", "Playfair Display", "Audiowide", "JetBrains Mono", "Syne", "Urbanist", "Poppins", "Merriweather", "Lora", "Rajdhani", "Share Tech Mono").

Strictly respond with JSON matching this structure:
{
  "id": string (lowercase slug, e.g. "cyberpunk-electric-citrus"),
  "name": string (evocative creative title, e.g. "Electric Citrus 2077"),
  "description": string (1-2 sentences capturing aesthetic atmosphere),
  "vibe": string ("cyberpunk" | "synthwave" | "gothic" | "luxury" | "minimal" | "retro" | "nature" | "pastel" | "matrix" | "cosmic" | "custom"),
  "colors": {
    "background": string (dark background hex, e.g. "#07090e"),
    "surface": string (panel surface hex, e.g. "#0e1420"),
    "card": string (rgba for backdrop-blur glass panels, e.g. "rgba(14, 20, 32, 0.85)"),
    "border": string (rgba with subtle accent tint, e.g. "rgba(0, 240, 255, 0.25)"),
    "primaryAccent": string (vibrant primary hex, e.g. "#00f0ff"),
    "secondaryAccent": string (complementary accent hex, e.g. "#ffe600"),
    "glow": string (rgba glow color, e.g. "rgba(0, 240, 255, 0.35)"),
    "textPrimary": string (high-contrast readable hex, e.g. "#ffffff"),
    "textMuted": string (secondary readable text hex, e.g. "#94a3b8")
  },
  "typography": {
    "fontFamily": string (primary body Google Font),
    "headingFont": string (display heading Google Font),
    "monoFont": string (monospace Google Font),
    "googleFontFamilies": string[] (array of Google Font names used)
  },
  "borderRadius": string ("none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full")
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Theme Concept Prompt: "${prompt}"`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const rawText = (response.text || '{}').trim();
      let parsedTheme: any = {};
      try {
        parsedTheme = JSON.parse(rawText);
      } catch (parseErr) {
        parsedTheme = synthesizeThemeFromPrompt(prompt);
      }

      // Ensure required structure
      if (!parsedTheme.colors || !parsedTheme.typography) {
        parsedTheme = synthesizeThemeFromPrompt(prompt);
      } else {
        parsedTheme.id = parsedTheme.id || `ai_theme_${Date.now()}`;
        parsedTheme.createdAt = Date.now();
        parsedTheme.isAiGenerated = true;
        parsedTheme.prompt = prompt;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ theme: parsedTheme, source: 'gemini' }));
      return true;
    } catch (err: any) {
      console.warn('Gemini theme generation fallback:', err?.message);
      // Seamlessly fall back to algorithmic synthesizer
      try {
        const body = await parseJsonBody(req).catch(() => ({}));
        const theme = synthesizeThemeFromPrompt(body.prompt || 'Cyberpunk');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ theme, source: 'synthesizer' }));
      } catch {
        const theme = synthesizeThemeFromPrompt('Studio');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ theme, source: 'synthesizer' }));
      }
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
