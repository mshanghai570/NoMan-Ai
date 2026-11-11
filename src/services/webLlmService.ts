import { LocalAiService, type WebGpuDiagnostics } from './localAiService';

export type WebLlmModelId =
  | 'Qwen3-0.6B-q4f16_1-MLC'
  | 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

export const WEBLLM_MODELS = [
  { id: 'Qwen3-0.6B-q4f16_1-MLC', label: 'Qwen3 0.6B · lightweight' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B' },
] as const satisfies readonly { id: WebLlmModelId; label: string }[];

export interface WebLlmSnapshot {
  phase: 'idle' | 'loading' | 'ready' | 'error';
  modelId: WebLlmModelId | null;
  progress: number;
  message: string;
  error: string | null;
}

export interface WebLlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface WebLlmGenerationOptions {
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
}

export interface WebLlmEngine {
  stream(
    messages: WebLlmMessage[],
    options: WebLlmGenerationOptions,
  ): AsyncGenerator<string>;
  complete(
    messages: WebLlmMessage[],
    options: WebLlmGenerationOptions,
  ): Promise<string>;
  interrupt(): void | Promise<void>;
  unload(): Promise<void>;
}

export interface WebLlmRuntimeAdapter {
  checkWebGpu(): Promise<WebGpuDiagnostics>;
  createEngine(
    modelId: WebLlmModelId,
    onProgress: (progress: { progress: number; text: string }) => void,
  ): Promise<WebLlmEngine>;
  hasModelInCache(modelId: WebLlmModelId): Promise<boolean>;
  deleteModelCache(modelId: WebLlmModelId): Promise<void>;
}

export interface WebLlmService {
  checkWebGpu(): Promise<WebGpuDiagnostics>;
  getSnapshot(): WebLlmSnapshot;
  subscribe(listener: (snapshot: WebLlmSnapshot) => void): () => void;
  isCached(modelId: WebLlmModelId): Promise<boolean>;
  loadModel(modelId: WebLlmModelId): Promise<void>;
  stream(
    messages: WebLlmMessage[],
    options: WebLlmGenerationOptions,
  ): AsyncGenerator<string>;
  complete(
    messages: WebLlmMessage[],
    options: WebLlmGenerationOptions,
  ): Promise<string>;
  interrupt(): void;
  unload(): Promise<void>;
  deleteCachedModel(modelId: WebLlmModelId): Promise<void>;
}

interface WebLlmModule {
  CreateMLCEngine: (
    modelId: string,
    config: {
      initProgressCallback: (progress: { progress: number; text: string }) => void;
    },
  ) => Promise<{
    chat: {
      completions: {
        create: {
          (request: {
            messages: WebLlmMessage[];
            stream: true;
            temperature: number;
            max_tokens: number;
          }): Promise<AsyncIterable<{
            choices: Array<{ delta: { content?: string | null } }>;
          }>>;
          (request: {
            messages: WebLlmMessage[];
            stream: false;
            temperature: number;
            max_tokens: number;
          }): Promise<{
            choices: Array<{ message: { content: string | null | unknown[] } }>;
          }>;
        };
      };
    };
    unload: () => Promise<void>;
    interruptGenerate: () => Promise<void>;
  }>;
  prebuiltAppConfig: {
    model_list: Array<{ model_id: string }>;
  };
  hasModelInCache(modelId: string): Promise<boolean>;
  deleteModelAllInfoInCache(modelId: string): Promise<void>;
}

const INITIAL_SNAPSHOT: WebLlmSnapshot = {
  phase: 'idle',
  modelId: null,
  progress: 0,
  message: '',
  error: null,
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertKnownModel(modelId: string): asserts modelId is WebLlmModelId {
  if (!WEBLLM_MODELS.some((model) => model.id === modelId)) {
    throw new Error(`Unsupported WebLLM model: ${modelId}`);
  }
}

function createProductionRuntime(): Promise<WebLlmRuntimeAdapter> {
  return import('@mlc-ai/web-llm').then((webllm) => {
    const requiredIds = WEBLLM_MODELS.map(({ id }) => id);
    const availableIds = new Set(webllm.prebuiltAppConfig.model_list.map(({ model_id }) => model_id));
    const missingIds = requiredIds.filter((id) => !availableIds.has(id));
    if (missingIds.length > 0) {
      throw new Error(`WebLLM package is missing configured models: ${missingIds.join(', ')}`);
    }

    return {
      checkWebGpu: () => LocalAiService.testWebGpu(),
      async createEngine(modelId, onProgress) {
        const engine = await webllm.CreateMLCEngine(modelId, {
          initProgressCallback: onProgress,
        });

        return {
          async *stream(messages, options) {
            const stream = await engine.chat.completions.create({
              messages,
              stream: true,
              temperature: options.temperature,
              max_tokens: options.maxTokens,
            });
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta.content;
              if (typeof content === 'string' && content.length > 0) {
                yield content;
              }
            }
          },
          async complete(messages, options) {
            const completion = await engine.chat.completions.create({
              messages,
              stream: false,
              temperature: options.temperature,
              max_tokens: options.maxTokens,
            });
            const content = completion.choices[0]?.message.content;
            return typeof content === 'string' ? content : '';
          },
          interrupt: () => engine.interruptGenerate(),
          unload: () => engine.unload(),
        };
      },
      hasModelInCache: (modelId) => webllm.hasModelInCache(modelId),
      deleteModelCache: (modelId) => webllm.deleteModelAllInfoInCache(modelId),
    };
  });
}

export function createWebLlmService(
  loadRuntime: () => Promise<WebLlmRuntimeAdapter>,
): WebLlmService {
  let runtimePromise: Promise<WebLlmRuntimeAdapter> | undefined;
  let lifecycleQueue: Promise<void> = Promise.resolve();
  let engine: WebLlmEngine | undefined;
  let snapshot = { ...INITIAL_SNAPSHOT };
  const listeners = new Set<(snapshot: WebLlmSnapshot) => void>();

  const getRuntime = (): Promise<WebLlmRuntimeAdapter> => {
    if (!runtimePromise) {
      runtimePromise = loadRuntime().catch((error: unknown) => {
        runtimePromise = undefined;
        throw error;
      });
    }
    return runtimePromise;
  };

  const publish = (next: WebLlmSnapshot): void => {
    snapshot = next;
    for (const listener of listeners) {
      listener({ ...snapshot });
    }
  };

  const reportInterruptError = (error: unknown): void => {
    publish({
      ...snapshot,
      phase: 'error',
      message: 'Failed to stop local model generation',
      error: errorMessage(error),
    });
  };

  const enqueueLifecycle = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = lifecycleQueue.then(operation, operation);
    lifecycleQueue = result.then(() => undefined, () => undefined);
    return result;
  };

  const unloadCurrent = async (): Promise<void> => {
    const currentEngine = engine;
    engine = undefined;
    if (currentEngine) {
      await currentEngine.interrupt();
      await currentEngine.unload();
    }
  };

  const requireEngine = (): WebLlmEngine => {
    if (!engine || snapshot.phase !== 'ready') {
      throw new Error('No WebLLM model is loaded. Load a model from Local Models first.');
    }
    return engine;
  };

  const withAbort = <T>(
    activeEngine: WebLlmEngine,
    signal: AbortSignal | undefined,
    operation: () => Promise<T>,
  ): Promise<T> => {
    if (signal?.aborted) {
      activeEngine.interrupt();
      return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
    }
    const onAbort = (): void => {
      void Promise.resolve(activeEngine.interrupt()).catch(reportInterruptError);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    return operation().finally(() => signal?.removeEventListener('abort', onAbort));
  };

  return {
    async checkWebGpu() {
      return (await getRuntime()).checkWebGpu();
    },
    getSnapshot() {
      return { ...snapshot };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async isCached(modelId) {
      assertKnownModel(modelId);
      return (await getRuntime()).hasModelInCache(modelId);
    },
    loadModel(modelId) {
      assertKnownModel(modelId);
      return enqueueLifecycle(async () => {
        if (engine && snapshot.phase === 'ready' && snapshot.modelId === modelId) return;

        publish({
          phase: 'loading',
          modelId,
          progress: 0,
          message: 'Preparing model…',
          error: null,
        });
        try {
          await unloadCurrent();
          const runtime = await getRuntime();
          const loadedEngine = await runtime.createEngine(modelId, (progress) => {
            publish({
              phase: 'loading',
              modelId,
              progress: Math.max(0, Math.min(1, progress.progress)),
              message: progress.text,
              error: null,
            });
          });
          engine = loadedEngine;
          publish({
            phase: 'ready',
            modelId,
            progress: 1,
            message: 'Model ready',
            error: null,
          });
        } catch (error) {
          engine = undefined;
          publish({
            phase: 'error',
            modelId,
            progress: 0,
            message: 'Model failed to load',
            error: errorMessage(error),
          });
          throw error;
        }
      });
    },
    async *stream(messages, options) {
      const activeEngine = requireEngine();
      const interruptActiveEngine = (): void => {
        void Promise.resolve(activeEngine.interrupt()).catch(reportInterruptError);
      };
      if (options.signal?.aborted) {
        interruptActiveEngine();
        throw new DOMException('The operation was aborted.', 'AbortError');
      }

      const onAbort = interruptActiveEngine;
      options.signal?.addEventListener('abort', onAbort, { once: true });
      try {
        for await (const delta of activeEngine.stream(messages, options)) {
          yield delta;
        }
      } finally {
        options.signal?.removeEventListener('abort', onAbort);
      }
    },
    async complete(messages, options) {
      const activeEngine = requireEngine();
      return withAbort(activeEngine, options.signal, () => activeEngine.complete(messages, options));
    },
    interrupt() {
      const activeEngine = engine;
      if (activeEngine) {
        void Promise.resolve(activeEngine.interrupt()).catch(reportInterruptError);
      }
    },
    unload() {
      return enqueueLifecycle(async () => {
        await unloadCurrent();
        publish({ ...INITIAL_SNAPSHOT });
      });
    },
    deleteCachedModel(modelId) {
      assertKnownModel(modelId);
      return enqueueLifecycle(async () => {
        await unloadCurrent();
        publish({ ...INITIAL_SNAPSHOT });
        await (await getRuntime()).deleteModelCache(modelId);
      });
    },
  };
}

export const webLlmService = createWebLlmService(createProductionRuntime);
