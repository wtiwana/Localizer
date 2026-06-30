import type {
  ChatMessage,
  ChatOptions,
  ClassifyOptions,
  ClassifyResult,
  ModelTier,
  ProgressEvent,
  RewriteOptions,
  SerializedInitOptions,
  SummarizeOptions,
} from '../types';
import { TransformersProvider } from './transformers-provider';
import { WebLLMProvider } from './webllm-provider';

export class EngineManager {
  private initOptions: SerializedInitOptions | null = null;
  private readonly transformers: TransformersProvider;
  private readonly webllm = new WebLLMProvider();
  private activeTier: ModelTier = 'micro';
  private loadedTiers = new Set<ModelTier>();

  constructor() {
    this.transformers = new TransformersProvider(true);
  }

  async init(options: SerializedInitOptions, onProgress?: (event: ProgressEvent) => void): Promise<void> {
    this.initOptions = options;
    this.transformers.cacheEnabled = options.cache === 'indexeddb';

    if (options.loadMicroAtStart) {
      await this.transformers.loadChat(options.resolvedSources.micro, onProgress);
      this.loadedTiers.add('micro');
      this.activeTier = 'micro';
    }
  }

  async prefetchTier(tier: ModelTier, onProgress?: (event: ProgressEvent) => void): Promise<void> {
    if (!this.initOptions) throw new Error('Engine not initialized');
    if (this.loadedTiers.has(tier)) return;

    if (tier === 'standard' || tier === 'premium') {
      if (this.initOptions.capability.webgpu) {
        try {
          const source = tier === 'premium'
            ? this.initOptions.resolvedSources.premium
            : this.initOptions.resolvedSources.standard;
          await this.webllm.load(source, onProgress);
          this.loadedTiers.add(tier);
          this.activeTier = tier;
          return;
        } catch {
          // Fallback to transformers chat below.
        }
      }

      await this.transformers.loadChat(
        tier === 'premium'
          ? this.initOptions.resolvedSources.premium
          : this.initOptions.resolvedSources.standard,
        onProgress,
      );
      this.loadedTiers.add(tier);
      this.activeTier = tier;
    }
  }

  private resolveTier(options?: ChatOptions): ModelTier {
    const requested = options?.tier;
    if (requested && requested !== 'auto' && this.loadedTiers.has(requested)) {
      return requested;
    }
    return this.activeTier;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const tier = this.resolveTier(options);
    if ((tier === 'standard' || tier === 'premium') && this.loadedTiers.has(tier) && this.initOptions?.capability.webgpu) {
      return this.webllm.chat(messages, options);
    }
    return this.transformers.chat(messages, options);
  }

  async *chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<string> {
    const tier = this.resolveTier(options);
    if ((tier === 'standard' || tier === 'premium') && this.loadedTiers.has(tier) && this.initOptions?.capability.webgpu) {
      yield* this.webllm.chatStream(messages, options);
      return;
    }
    yield* this.transformers.chatStream(messages, options);
  }

  summarize(text: string, options?: SummarizeOptions): Promise<string> {
    return this.transformers.summarize(text, options);
  }

  classify(text: string, options?: ClassifyOptions): Promise<ClassifyResult> {
    return this.transformers.classify(text, options);
  }

  rewrite(text: string, options?: RewriteOptions): Promise<string> {
    return this.transformers.rewrite(text, options);
  }

  async dispose(): Promise<void> {
    this.loadedTiers.clear();
    this.initOptions = null;
  }
}
