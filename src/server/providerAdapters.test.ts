import assert from 'node:assert/strict';
import test from 'node:test';
import { generateWithProvider, ProviderError } from './providerAdapters';

type Recorded = { url: string; init: RequestInit };

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });

async function withFetch(
  handler: (url: string, init: RequestInit) => Promise<Response>,
  run: () => Promise<void>
): Promise<Recorded[]> {
  const original = globalThis.fetch;
  const calls: Recorded[] = [];

  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = typeof input === 'string' ? input : String(input?.url || '');
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }

  return calls;
}

const headersOf = (init: RequestInit): Record<string, string> =>
  (init.headers || {}) as Record<string, string>;

test('leonardo submits a job then polls the v1 generation until COMPLETE', async () => {
  delete process.env.LEONARDO_API_KEY;

  const calls = await withFetch(
    async (url) => {
      if (url.endsWith('/v2/generations')) {
        return jsonResponse({ generate: { generationId: 'gen-1' } });
      }
      return jsonResponse({
        generations_by_pk: {
          status: 'COMPLETE',
          generated_images: [{ url: 'https://cdn.test/leonardo.png' }],
        },
      });
    },
    async () => {
      const result = await generateWithProvider({
        provider: 'leonardo',
        kind: 'image',
        prompt: 'a neon alley',
        model: 'flux-schnell',
        width: 1024,
        height: 1024,
        credentials: { key: 'leo-key' },
      });

      assert.deepEqual(result.mediaUrls, ['https://cdn.test/leonardo.png']);
      assert.equal(result.provider, 'leonardo');
      assert.equal(result.kind, 'image');
    }
  );

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://cloud.leonardo.ai/api/rest/v2/generations');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(headersOf(calls[0].init).Authorization, 'Bearer leo-key');

  const submitted = JSON.parse(String(calls[0].init.body));
  assert.equal(submitted.model, 'flux-schnell');
  assert.equal(submitted.public, false);
  assert.equal(submitted.parameters.prompt, 'a neon alley');

  assert.equal(calls[1].url, 'https://cloud.leonardo.ai/api/rest/v1/generations/gen-1');
  assert.equal(headersOf(calls[1].init).Authorization, 'Bearer leo-key');
});

test('leonardo honours a base URL override', async () => {
  const calls = await withFetch(
    async (url) => {
      if (url.endsWith('/v2/generations')) {
        return jsonResponse({ generate: { generationId: 'gen-2' } });
      }
      return jsonResponse({
        generations_by_pk: {
          status: 'COMPLETE',
          generated_images: [{ url: 'https://cdn.test/proxy.png' }],
        },
      });
    },
    async () => {
      const result = await generateWithProvider({
        provider: 'leonardo',
        kind: 'image',
        prompt: 'test',
        credentials: { key: 'k', baseUrl: 'https://proxy.test/leonardo/' },
      });
      assert.deepEqual(result.mediaUrls, ['https://cdn.test/proxy.png']);
    }
  );

  assert.equal(calls[0].url, 'https://proxy.test/leonardo/v2/generations');
});

test('replicate returns a synchronous output without polling', async () => {
  const calls = await withFetch(
    async () =>
      jsonResponse({ status: 'succeeded', output: ['https://cdn.test/replicate.png'] }),
    async () => {
      const result = await generateWithProvider({
        provider: 'replicate',
        kind: 'image',
        prompt: 'a lighthouse',
        model: 'black-forest-labs/flux-schnell',
        width: 1344,
        height: 768,
        credentials: { key: 'rep-key' },
      });

      assert.deepEqual(result.mediaUrls, ['https://cdn.test/replicate.png']);
    }
  );

  assert.equal(
    calls[0].url,
    'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions'
  );
  assert.equal(headersOf(calls[0].init).Prefer, 'wait=60');

  const payload = JSON.parse(String(calls[0].init.body));
  assert.equal(payload.input.aspect_ratio, '16:9');
  assert.equal(payload.input.prompt, 'a lighthouse');
});

test('byteplus polls a Seedance video task and returns the video URL', async () => {
  const calls = await withFetch(
    async (url) => {
      if (url.endsWith('/contents/generations/tasks')) return jsonResponse({ id: 'task-9' });
      return jsonResponse({
        status: 'succeeded',
        content: { video_url: 'https://cdn.test/seedance.mp4' },
      });
    },
    async () => {
      const result = await generateWithProvider({
        provider: 'byteplus',
        kind: 'video',
        prompt: 'a slow dolly through a rain-soaked city',
        model: 'seedance-1-0-pro-250528',
        aspectRatio: '16:9',
        credentials: { key: 'bp-key' },
      });

      assert.deepEqual(result.mediaUrls, ['https://cdn.test/seedance.mp4']);
      assert.equal(result.kind, 'video');
    }
  );

  assert.equal(
    calls[0].url,
    'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks'
  );
  const payload = JSON.parse(String(calls[0].init.body));
  assert.match(payload.content[0].text, /--ratio 16:9/);

  assert.equal(
    calls[1].url,
    'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/task-9'
  );
});

test('cloudflare returns a binary image as a data URL', async () => {
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;

  const calls = await withFetch(
    async () =>
      new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    async () => {
      const result = await generateWithProvider({
        provider: 'cloudflare',
        kind: 'image',
        prompt: 'a cat',
        model: '@cf/black-forest-labs/flux-1-schnell',
        credentials: { key: 'cf-token', accountId: 'acct-1' },
      });

      assert.equal(result.mediaUrls.length, 1);
      assert.ok(result.mediaUrls[0].startsWith('data:image/png;base64,'));
    }
  );

  assert.equal(
    calls[0].url,
    'https://api.cloudflare.com/client/v4/accounts/acct-1/ai/run/@cf/black-forest-labs/flux-1-schnell'
  );
  const payload = JSON.parse(String(calls[0].init.body));
  // FLUX on Workers AI caps steps at 8.
  assert.ok(payload.steps <= 8);
});

test('custom endpoint substitutes escaped placeholders and reads the result path', async () => {
  let seenBody: any = null;

  await withFetch(
    async (_url, init) => {
      seenBody = JSON.parse(String(init.body));
      return jsonResponse({ data: [{ url: 'https://cdn.test/custom.png' }] });
    },
    async () => {
      const result = await generateWithProvider({
        provider: 'custom',
        kind: 'image',
        prompt: 'a "quoted" cat\nwith a newline',
        width: 768,
        height: 1024,
        seed: 42,
        custom: {
          enabled: true,
          label: 'Relay',
          baseUrl: 'https://relay.test/generate',
          model: 'relay-model',
          apiKey: 'relay-key',
          kind: 'image',
          bodyTemplate: '{"prompt": "{{prompt}}", "width": {{width}}, "model": "{{model}}"}',
          headers: '{"X-Test": "1"}',
          resultPath: 'data.0.url',
        },
      });

      assert.deepEqual(result.mediaUrls, ['https://cdn.test/custom.png']);
    }
  );

  assert.equal(seenBody.prompt, 'a "quoted" cat\nwith a newline');
  assert.equal(seenBody.width, 768);
  assert.equal(seenBody.model, 'relay-model');
});

test('a missing key fails with a 400 instead of calling the provider', async () => {
  delete process.env.LEONARDO_API_KEY;

  let called = false;
  await withFetch(
    async () => {
      called = true;
      return jsonResponse({});
    },
    async () => {
      await assert.rejects(
        generateWithProvider({ provider: 'leonardo', kind: 'image', prompt: 'x' }),
        (error: unknown) => error instanceof ProviderError && error.status === 400
      );
    }
  );

  assert.equal(called, false);
});

test('provider errors surface the upstream message', async () => {
  await withFetch(
    async () => jsonResponse({ error: 'NSFW content blocked by provider' }, 422),
    async () => {
      await assert.rejects(
        generateWithProvider({
          provider: 'replicate',
          kind: 'image',
          prompt: 'x',
          credentials: { key: 'k' },
        }),
        (error: unknown) =>
          error instanceof ProviderError &&
          error.status === 422 &&
          /NSFW content blocked/.test(error.message)
      );
    }
  );
});

test('unsupported media kinds are rejected before an adapter is called', async () => {
  let called = false;
  await withFetch(
    async () => {
      called = true;
      return jsonResponse({});
    },
    async () => {
      await assert.rejects(
        generateWithProvider({
          provider: 'leonardo',
          kind: 'video',
          prompt: 'a cinematic shot',
          credentials: { key: 'k' },
        }),
        (error: unknown) =>
          error instanceof ProviderError &&
          error.status === 400 &&
          /does not advertise video/.test(error.message)
      );
    }
  );
  assert.equal(called, false);
});

test('custom provider cannot target localhost by default', async () => {
  let called = false;
  await withFetch(
    async () => {
      called = true;
      return jsonResponse({});
    },
    async () => {
      await assert.rejects(
        generateWithProvider({
          provider: 'custom',
          kind: 'image',
          prompt: 'a test image',
          custom: {
            enabled: true,
            label: 'Local relay',
            baseUrl: 'http://127.0.0.1:8188/generate',
            model: 'test',
            apiKey: '',
            kind: 'image',
            bodyTemplate: '{"prompt":"{{prompt}}"}',
            headers: '{}',
            resultPath: 'url',
          },
        }),
        (error: unknown) =>
          error instanceof ProviderError &&
          error.status === 400 &&
          /private or loopback/.test(error.message)
      );
    }
  );
  assert.equal(called, false);
});
