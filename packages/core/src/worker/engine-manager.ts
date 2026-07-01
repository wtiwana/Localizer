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

type ChatBackend = 'transformers' | 'webllm';

export class EngineManager {
  private initOptions: SerializedInitOptions | null = null;
  private readonly transformers: TransformersProvider;
  private readonly webllm = new WebLLMProvider();
  private activeTier: ModelTier = 'micro';
  private loadedTiers = new Set<ModelTier>();
  private tierBackends = new Map<ModelTier, ChatBackend>();

  constructor() {
    this.transformers = new TransformersProvider(true);
  }

  async init(options: SerializedInitOptions, onProgress?: (event: ProgressEvent) => void): Promise<void> {
    this.initOptions = options;
    this.transformers.cacheEnabled = options.cache === 'indexeddb';
    this.transformers.setNlpModels({
      summarize: options.resolvedSources.nlp.summarize,
      classify: options.resolvedSources.nlp.classify,
      rewrite: options.resolvedSources.nlp.rewrite,
    });

    if (options.loadMicroAtStart) {
      await this.transformers.loadChat(options.resolvedSources.micro, onProgress);
      this.loadedTiers.add('micro');
      this.tierBackends.set('micro', 'transformers');
      this.activeTier = 'micro';
    }
  }

  async prefetchTier(tier: ModelTier, onProgress?: (event: ProgressEvent) => void): Promise<void> {
    if (!this.initOptions) throw new Error('Engine not initialized');
    if (this.loadedTiers.has(tier)) return;

    if (tier !== 'standard' && tier !== 'premium') return;

    const source = tier === 'premium'
      ? this.initOptions.resolvedSources.premium
      : this.initOptions.resolvedSources.standard;

    if (source.engine === 'webllm') {
      if (!this.initOptions.capability.webgpu) {
        throw new Error(`${tier} tier requires WebGPU, which is not available`);
      }
      await this.webllm.load(source, onProgress);
      this.loadedTiers.add(tier);
      this.tierBackends.set(tier, 'webllm');
      this.activeTier = tier;
      return;
    }

    await this.transformers.loadChat(source, onProgress);
    this.loadedTiers.add(tier);
    this.tierBackends.set(tier, 'transformers');
    this.activeTier = tier;
  }

  private resolveTier(options?: ChatOptions): ModelTier {
    const requested = options?.tier;
    if (requested && requested !== 'auto' && this.loadedTiers.has(requested)) {
      return this.canChatOnTier(requested) ? requested : this.fallbackChatTier();
    }
    return this.canChatOnTier(this.activeTier) ? this.activeTier : this.fallbackChatTier();
  }

  private canChatOnTier(tier: ModelTier): boolean {
    if (!this.loadedTiers.has(tier)) return false;
    const backend = this.tierBackends.get(tier);
    if (backend === 'webllm') return this.webllm.isLoaded();
    return this.transformers.hasChatPipeline();
  }

  private fallbackChatTier(): ModelTier {
    if (this.loadedTiers.has('micro') && this.transformers.hasChatPipeline()) {
      return 'micro';
    }
    for (const tier of ['premium', 'standard', 'micro'] as const) {
      if (this.canChatOnTier(tier)) return tier;
    }
    return this.activeTier;
  }

  private shouldUseWebLLM(tier: ModelTier): boolean {
    return this.tierBackends.get(tier) === 'webllm' && this.webllm.isLoaded();
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const tier = this.resolveTier(options);
    if (this.shouldUseWebLLM(tier)) {
      return this.webllm.chat(messages, options);
    }
    return this.transformers.chat(messages, options);
  }

  async *chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<string> {
    const tier = this.resolveTier(options);
    if (this.shouldUseWebLLM(tier)) {
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
    this.tierBackends.clear();
    this.initOptions = null;
  }
}
