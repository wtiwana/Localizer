import type {
  ChatMessage,
  ChatOptions,
  ClassifyOptions,
  ClassifyResult,
  LocalizerOptions,
  ModelTier,
  RewriteOptions,
  SummarizeOptions,
} from './types';
import { UnsupportedBrowserError } from './errors';
import { createWorkerClient, WorkerClient } from './worker-client';

class ChatAPI {
  constructor(private readonly client: WorkerClient) {}

  async invoke(input: string | ChatMessage[], options?: ChatOptions): Promise<string> {
    const messages = normalizeMessages(input);
    return this.client.chat(messages, options);
  }

  stream(input: string | ChatMessage[], options?: ChatOptions): AsyncGenerator<string, void> {
    const messages = normalizeMessages(input);
    return this.client.chatStream(messages, options);
  }
}

function normalizeMessages(input: string | ChatMessage[]): ChatMessage[] {
  if (typeof input === 'string') {
    return [{ role: 'user', content: input }];
  }
  return input;
}

export class Localizer {
  readonly chat: ChatAPI;
  readonly tier: ModelTier;

  private constructor(
    private readonly client: WorkerClient,
    tier: ModelTier,
  ) {
    this.chat = new ChatAPI(client);
    this.tier = tier;
  }

  static async create(options: LocalizerOptions = {}): Promise<Localizer> {
    if (typeof window === 'undefined' && typeof Worker === 'undefined') {
      throw new UnsupportedBrowserError('Localizer requires a browser environment with Web Worker support.');
    }

    const run = async () => {
      const client = await createWorkerClient(options);
      return new Localizer(client, client.tierManager.activeTier);
    };

    if (options.deferMicroLoad && typeof requestIdleCallback !== 'undefined') {
      return new Promise((resolve, reject) => {
        requestIdleCallback(() => {
          run().then(resolve).catch(reject);
        });
      });
    }

    return run();
  }

  get activeTier(): ModelTier {
    return this.client.tierManager.activeTier;
  }

  async prefetchTier(tier: ModelTier): Promise<void> {
    await this.client.prefetchTier(tier);
  }

  summarize(text: string, options?: SummarizeOptions): Promise<string> {
    return this.client.summarize(text, options);
  }

  classify(text: string, options?: ClassifyOptions): Promise<ClassifyResult> {
    return this.client.classify(text, options);
  }

  rewrite(text: string, options?: RewriteOptions): Promise<string> {
    return this.client.rewrite(text, options);
  }

  dispose(): void {
    this.client.dispose();
  }
}

export { Localizer as default };
