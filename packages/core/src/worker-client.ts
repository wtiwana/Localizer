import type {
  CapabilityProfile,
  ChatMessage,
  ChatOptions,
  ClassifyOptions,
  ClassifyResult,
  LocalizerOptions,
  ModelTier,
  ProgressEvent,
  RewriteOptions,
  SerializedInitOptions,
  SummarizeOptions,
  WorkerRequest,
  WorkerResponse,
} from './types';
import { WorkerError } from './errors';
import { computeCapabilityProfile } from './capability';
import { resolveModelSources } from './model-source-resolver';
import { ModelTierManager } from './tier-manager';
import { PRESET_FEATURES } from './registry';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  stream?: (delta: string) => void;
};

let workerUrl: URL | string | undefined;

export function setWorkerUrl(url: URL | string): void {
  workerUrl = url;
}

function getWorkerConstructorUrl(): URL | string {
  if (workerUrl) return workerUrl;
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    return new URL('./worker.js', import.meta.url);
  }
  throw new WorkerError('Unable to resolve worker URL. Call setWorkerUrl() in non-bundler environments.');
}

function resolveFeatures(options: LocalizerOptions): string[] {
  if (options.features?.length) return options.features;
  if (options.preset && options.preset in PRESET_FEATURES) {
    return [...PRESET_FEATURES[options.preset as keyof typeof PRESET_FEATURES]];
  }
  return [...PRESET_FEATURES.basic];
}

export class WorkerClient {
  private worker: Worker | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly progressHandlers = new Set<(event: ProgressEvent) => void>();
  private readonly tierChangeHandlers = new Set<(event: { from: ModelTier; to: ModelTier }) => void>();
  private initPromise: Promise<void> | null = null;
  readonly tierManager: ModelTierManager;

  constructor(
    private readonly options: LocalizerOptions,
    private readonly capability: CapabilityProfile,
  ) {
    this.tierManager = new ModelTierManager(
      options.upgradePolicy ?? 'auto',
      capability,
      (event) => {
        this.options.onTierChange?.(event);
        for (const handler of this.tierChangeHandlers) handler(event);
      },
    );
  }

  onProgress(handler: (event: ProgressEvent) => void): () => void {
    this.progressHandlers.add(handler);
    return () => this.progressHandlers.delete(handler);
  }

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    const { registryManifest, resolved } = await resolveModelSources(this.options);
    const features = resolveFeatures(this.options);
    const payload: SerializedInitOptions = {
      registryManifest,
      resolvedSources: resolved,
      features,
      cache: this.options.cache ?? 'indexeddb',
      upgradePolicy: this.options.upgradePolicy ?? 'auto',
      loadMicroAtStart: this.options.loadMicroAtStart ?? true,
      capability: this.capability,
    };

    this.worker = new Worker(getWorkerConstructorUrl(), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handleMessage(event.data);
    this.worker.onerror = (event) => {
      for (const [, pending] of this.pending) {
        pending.reject(new WorkerError(event.message));
      }
      this.pending.clear();
    };

    await this.send('init', { options: payload }, 'init');
    this.tierManager.markTierReady('micro');

    if (this.tierManager.shouldPrefetchStandard()) {
      this.schedulePrefetch('standard');
    }
    if (this.options.preset === 'max' && this.tierManager.shouldPrefetchPremium()) {
      this.schedulePrefetch('premium');
    }
  }

  private schedulePrefetch(tier: ModelTier): void {
    const run = () => {
      void this.prefetchTier(tier).catch(() => {
        // Background prefetch failures are non-fatal.
      });
    };

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(run, { timeout: 5000 });
    } else {
      setTimeout(run, 1000);
    }
  }

  async prefetchTier(tier: ModelTier): Promise<void> {
    if (this.tierManager.isTierLoaded(tier)) return;
    await this.send('prefetch', { tier }, `prefetch-${tier}`);
    this.tierManager.markTierReady(tier);
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    let result = '';
    for await (const chunk of this.chatStream(messages, options)) {
      result += chunk;
    }
    return result;
  }

  async *chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<string, void> {
    const chunks: string[] = [];
    let resolveNext: ((value: IteratorResult<string>) => void) | null = null;
    let done = false;
    let error: Error | null = null;

    const requestId = crypto.randomUUID();
    this.pending.set(requestId, {
      resolve: () => {},
      reject: (reason) => {
        error = reason;
        resolveNext?.({ value: undefined as unknown as string, done: true });
      },
      stream: (delta) => {
        chunks.push(delta);
        resolveNext?.({ value: delta, done: false });
        resolveNext = null;
      },
    });

    const tier = this.tierManager.resolveChatTier(options?.tier);
    this.worker?.postMessage({
      type: 'chat',
      id: requestId,
      messages,
      stream: true,
      options: { ...options, tier },
    } satisfies WorkerRequest);

    while (!done) {
      if (error) throw error;
      if (chunks.length > 0) {
        yield chunks.shift()!;
        continue;
      }

      const next = await new Promise<IteratorResult<string>>((resolve) => {
        resolveNext = resolve;
        setTimeout(() => {
          if (!done && chunks.length === 0) {
            // noop wait
          }
        }, 30000);
      });

      if (next.done) {
        done = true;
        break;
      }
      yield next.value;
    }
  }

  summarize(text: string, options?: SummarizeOptions): Promise<string> {
    return this.send('summarize', { text, options }, crypto.randomUUID()) as Promise<string>;
  }

  classify(text: string, options?: ClassifyOptions): Promise<ClassifyResult> {
    return this.send('classify', { text, options }, crypto.randomUUID()) as Promise<ClassifyResult>;
  }

  rewrite(text: string, options?: RewriteOptions): Promise<string> {
    return this.send('rewrite', { text, options }, crypto.randomUUID()) as Promise<string>;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }

  private send(type: string, payload: unknown, id: string): Promise<unknown> {
    if (!this.worker) {
      return Promise.reject(new WorkerError('Worker is not initialized'));
    }

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ type, id, ...(payload as object) });
    });
  }

  private handleMessage(message: WorkerResponse): void {
    if (message.type === 'progress') {
      const event = message.event;
      this.options.onProgress?.(event);
      for (const handler of this.progressHandlers) handler(event);
      return;
    }

    if (message.type === 'tierReady') {
      this.tierManager.markTierReady(message.tier);
      return;
    }

    if (message.type === 'tierChange') {
      this.options.onTierChange?.({ from: message.from, to: message.to });
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) return;

    if (message.type === 'token') {
      pending.stream?.(message.delta);
      return;
    }

    if (message.type === 'ready' || message.type === 'done') {
      this.pending.delete(message.id);
      pending.resolve(message.type === 'done' ? message.result : true);
      return;
    }

    if (message.type === 'error') {
      this.pending.delete(message.id);
      pending.reject(new WorkerError(message.message));
    }
  }
}

export async function createWorkerClient(options: LocalizerOptions): Promise<WorkerClient> {
  const capability = await computeCapabilityProfile();
  const client = new WorkerClient(options, capability);
  await client.init();
  return client;
}
