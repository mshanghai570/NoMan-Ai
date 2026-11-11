import assert from 'node:assert/strict';
import test from 'node:test';
import { createWebLlmService, type WebLlmEngine, type WebLlmRuntimeAdapter } from './webLlmService';

const modelId = 'Qwen3-0.6B-q4f16_1-MLC';

function createFakeEngine(calls: string[] = []): WebLlmEngine {
  return {
    async *stream() {
      yield 'test';
    },
    async complete() {
      return 'test';
    },
    interrupt() {
      calls.push('interrupt');
    },
    async unload() {
      calls.push('unload');
    },
  };
}

function createFakeRuntime(
  calls: string[],
  overrides: Partial<WebLlmRuntimeAdapter> = {},
): WebLlmRuntimeAdapter {
  return {
    async checkWebGpu() {
      return { isSupported: true, description: 'test adapter' };
    },
    async createEngine(id, onProgress) {
      calls.push(`load:${id}`);
      onProgress({ progress: 0.5, text: 'Loading test model' });
      return createFakeEngine(calls);
    },
    async hasModelInCache() {
      return false;
    },
    async deleteModelCache(id) {
      calls.push(`delete:${id}`);
    },
    ...overrides,
  };
}

test('engine creation is lazy and load progress reaches the snapshot', async () => {
  const calls: string[] = [];
  let runtimeLoads = 0;
  const service = createWebLlmService(async () => {
    runtimeLoads += 1;
    return createFakeRuntime(calls);
  });
  const snapshots: number[] = [];
  service.subscribe((snapshot) => snapshots.push(snapshot.progress));

  assert.deepEqual(calls, []);
  assert.equal(runtimeLoads, 0);
  assert.equal(service.getSnapshot().phase, 'idle');

  await service.loadModel(modelId);

  assert.equal(runtimeLoads, 1);
  assert.equal(service.getSnapshot().phase, 'ready');
  assert.equal(service.getSnapshot().modelId, modelId);
  assert.ok(snapshots.includes(0.5));
  assert.deepEqual(calls, [`load:${modelId}`]);
});

test('a failed model load publishes an error snapshot and rethrows', async () => {
  const failure = new Error('model load failed');
  const service = createWebLlmService(async () =>
    createFakeRuntime([], {
      async createEngine() {
        throw failure;
      },
    }),
  );

  await assert.rejects(service.loadModel(modelId), /model load failed/);
  assert.equal(service.getSnapshot().phase, 'error');
  assert.equal(service.getSnapshot().modelId, modelId);
  assert.equal(service.getSnapshot().error, 'model load failed');
});

test('interrupt stops the active stream and forwards interruption to the engine', async () => {
  const calls: string[] = [];
  let finishStream: (() => void) | undefined;
  let interrupted = false;
  const service = createWebLlmService(async () =>
    createFakeRuntime(calls, {
      async createEngine() {
        return {
          ...createFakeEngine(calls),
          interrupt() {
            calls.push('interrupt');
            interrupted = true;
            finishStream?.();
          },
          async *stream() {
            await new Promise<void>((resolve) => {
              finishStream = resolve;
            });
            if (!interrupted) yield 'test';
          },
        };
      },
    }),
  );
  await service.loadModel(modelId);

  const iterator = service.stream([], { temperature: 0.8, maxTokens: 32 });
  const next = iterator.next();
  await new Promise<void>((resolve) => setImmediate(resolve));
  service.interrupt();
  const result = await next;

  assert.ok(calls.includes('interrupt'));
  assert.equal(result.done, true);
});

test('interrupt failures are surfaced in the model snapshot', async () => {
  const service = createWebLlmService(async () =>
    createFakeRuntime([], {
      async createEngine() {
        return {
          ...createFakeEngine(),
          async interrupt() {
            throw new Error('interrupt failed');
          },
        };
      },
    }),
  );
  await service.loadModel(modelId);

  service.interrupt();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(service.getSnapshot().phase, 'error');
  assert.equal(service.getSnapshot().error, 'interrupt failed');
});

test('deleting the active model unloads it before removing its cache', async () => {
  const calls: string[] = [];
  const service = createWebLlmService(async () => createFakeRuntime(calls));
  await service.loadModel(modelId);

  await service.deleteCachedModel(modelId);

  assert.deepEqual(calls.slice(-2), ['unload', `delete:${modelId}`]);
  assert.equal(service.getSnapshot().phase, 'idle');
});

test('switching models unloads the current engine before creating the next one', async () => {
  const calls: string[] = [];
  const service = createWebLlmService(async () => createFakeRuntime(calls));
  await service.loadModel(modelId);
  await service.loadModel('Llama-3.2-1B-Instruct-q4f16_1-MLC');

  assert.deepEqual(calls, [
    `load:${modelId}`,
    'interrupt',
    'unload',
    'load:Llama-3.2-1B-Instruct-q4f16_1-MLC',
  ]);
});

test('cache checks initialize the runtime without creating an engine', async () => {
  const calls: string[] = [];
  let runtimeLoads = 0;
  const service = createWebLlmService(async () => {
    runtimeLoads += 1;
    return createFakeRuntime(calls);
  });

  assert.equal(await service.isCached(modelId), false);
  assert.equal(runtimeLoads, 1);
  assert.deepEqual(calls, []);
});
