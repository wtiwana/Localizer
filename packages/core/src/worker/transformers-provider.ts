import { env, pipeline, TextStreamer } from '@huggingface/transformers';
import type { TextGenerationPipeline } from '@huggingface/transformers';
import type {
  ChatMessage,
  ChatOptions,
  ClassifyOptions,
  ClassifyResult,
  ModelSourceConfig,
  ProgressEvent,
  RewriteOptions,
  SummarizeOptions,
} from '../types';

type SummarizationPipeline = Awaited<ReturnType<typeof pipeline<'summarization'>>>;
type ClassificationPipeline = Awaited<ReturnType<typeof pipeline<'text-classification'>>>;
type TranslationPipeline = Awaited<ReturnType<typeof pipeline<'translation'>>>;

export class TransformersProvider {
  private chatPipeline: TextGenerationPipeline | null = null;
  private summarizePipeline: SummarizationPipeline | null = null;
  private classifyPipeline: ClassificationPipeline | null = null;
  private rewritePipeline: TranslationPipeline | null = null;
  cacheEnabled: boolean;

  constructor(cacheEnabled: boolean) {
    this.cacheEnabled = cacheEnabled;
    env.allowLocalModels = false;
    env.useBrowserCache = cacheEnabled;
  }

  private async getDevice(): Promise<'webgpu' | 'wasm'> {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator && navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) return 'webgpu';
      } catch {
        // fall through
      }
    }
    return 'wasm';
  }

  private emit(onProgress: ((event: ProgressEvent) => void) | undefined, event: ProgressEvent): void {
    onProgress?.(event);
  }

  hasChatPipeline(): boolean {
    return this.chatPipeline !== null;
  }

  async loadChat(source: ModelSourceConfig, onProgress?: (event: ProgressEvent) => void): Promise<void> {
    if (this.chatPipeline) return;
    const modelId = source.manifest.hfModelId ?? source.baseUrl;
    this.emit(onProgress, { tier: 'micro', percent: 0, status: `Loading chat model ${modelId}` });
    const device = await this.getDevice();
    this.chatPipeline = (await pipeline('text-generation', modelId, {
      device,
      progress_callback: (progress: { progress?: number; status?: string }) => {
        this.emit(onProgress, {
          tier: 'micro',
          percent: Math.round((progress.progress ?? 0) * 100),
          status: progress.status ?? 'Loading model',
        });
      },
    })) as TextGenerationPipeline;
    this.emit(onProgress, { tier: 'micro', percent: 100, status: 'Micro chat model ready' });
  }

  async loadSummarize(onProgress?: (event: ProgressEvent) => void): Promise<void> {
    if (this.summarizePipeline) return;
    this.emit(onProgress, { tier: 'nlp', capability: 'summarize', percent: 0, status: 'Loading summarizer' });
    const device = await this.getDevice();
    this.summarizePipeline = await pipeline('summarization', 'Xenova/bart-small-cnn', {
      device,
      progress_callback: (progress: { progress?: number; status?: string }) => {
        this.emit(onProgress, {
          tier: 'nlp',
          capability: 'summarize',
          percent: Math.round((progress.progress ?? 0) * 100),
          status: progress.status ?? 'Loading summarizer',
        });
      },
    });
  }

  async loadClassify(onProgress?: (event: ProgressEvent) => void): Promise<void> {
    if (this.classifyPipeline) return;
    this.emit(onProgress, { tier: 'nlp', capability: 'classify', percent: 0, status: 'Loading classifier' });
    const device = await this.getDevice();
    this.classifyPipeline = await pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', {
      device,
      progress_callback: (progress: { progress?: number; status?: string }) => {
        this.emit(onProgress, {
          tier: 'nlp',
          capability: 'classify',
          percent: Math.round((progress.progress ?? 0) * 100),
          status: progress.status ?? 'Loading classifier',
        });
      },
    });
  }

  async loadRewrite(onProgress?: (event: ProgressEvent) => void): Promise<void> {
    if (this.rewritePipeline) return;
    this.emit(onProgress, { tier: 'nlp', capability: 'rewrite', percent: 0, status: 'Loading rewriter' });
    const device = await this.getDevice();
    this.rewritePipeline = await pipeline('translation', 'Xenova/flan-t5-small', {
      device,
      progress_callback: (progress: { progress?: number; status?: string }) => {
        this.emit(onProgress, {
          tier: 'nlp',
          capability: 'rewrite',
          percent: Math.round((progress.progress ?? 0) * 100),
          status: progress.status ?? 'Loading rewriter',
        });
      },
    });
  }

  private formatPrompt(messages: ChatMessage[], system?: string): string {
    const chatMessages: Array<{ role: string; content: string }> = [];
    if (system) {
      chatMessages.push({ role: 'system', content: system });
    }
    for (const message of messages) {
      chatMessages.push({ role: message.role, content: message.content });
    }

    const tokenizer = this.chatPipeline?.tokenizer as {
      apply_chat_template?: (
        conversation: Array<{ role: string; content: string }>,
        options?: { tokenize?: boolean; add_generation_prompt?: boolean },
      ) => string;
    } | undefined;

    if (tokenizer?.apply_chat_template) {
      return tokenizer.apply_chat_template(chatMessages, {
        tokenize: false,
        add_generation_prompt: true,
      });
    }

    const parts: string[] = [];
    if (system) {
      parts.push(`System: ${system}`);
    }
    for (const message of messages) {
      parts.push(`${message.role === 'assistant' ? 'Assistant' : message.role === 'system' ? 'System' : 'User'}: ${message.content}`);
    }
    parts.push('Assistant:');
    return parts.join('\n');
  }

  private generationOptions(options?: ChatOptions) {
    return {
      max_new_tokens: options?.maxTokens ?? 128,
      temperature: options?.temperature ?? 0.3,
      do_sample: true,
      return_full_text: false,
    };
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    if (!this.chatPipeline) throw new Error('Chat pipeline not loaded');
    const prompt = this.formatPrompt(messages, options?.system);
    const result = await this.chatPipeline(prompt, this.generationOptions(options));
    const generated = Array.isArray(result) ? result[0]?.generated_text : (result as { generated_text?: string }).generated_text;
    return (generated ?? '').trim();
  }

  async *chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<string> {
    if (!this.chatPipeline) throw new Error('Chat pipeline not loaded');
    const prompt = this.formatPrompt(messages, options?.system);
    const queue: string[] = [];
    let resolveNext: ((value: IteratorResult<string>) => void) | null = null;
    let finished = false;
    let streamedAny = false;

    const streamer = new TextStreamer(this.chatPipeline.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        streamedAny = true;
        queue.push(text);
        resolveNext?.({ value: text, done: false });
        resolveNext = null;
      },
    });

    const generation = this.chatPipeline(prompt, {
      ...this.generationOptions(options),
      streamer,
    }).then((result) => {
      if (!streamedAny) {
        const generated = Array.isArray(result)
          ? result[0]?.generated_text
          : (result as { generated_text?: string }).generated_text;
        const text = (generated ?? '').trim();
        if (text) {
          queue.push(text);
          resolveNext?.({ value: text, done: false });
          resolveNext = null;
        }
      }
      return result;
    }).finally(() => {
      finished = true;
      resolveNext?.({ value: undefined as unknown as string, done: true });
    });

    while (!finished || queue.length > 0) {
      if (queue.length > 0) {
        yield queue.shift()!;
        continue;
      }
      await new Promise<IteratorResult<string>>((resolve) => {
        resolveNext = resolve;
      });
    }

    await generation;
  }

  async summarize(text: string, options?: SummarizeOptions): Promise<string> {
    await this.loadSummarize();
    if (!this.summarizePipeline) throw new Error('Summarizer not loaded');
    const output = await this.summarizePipeline(text, {
      max_length: options?.maxLength ?? 130,
      min_length: 30,
    });
    const first = Array.isArray(output) ? output[0] : output;
    return first.summary_text;
  }

  async classify(text: string, options?: ClassifyOptions): Promise<ClassifyResult> {
    await this.loadClassify();
    if (!this.classifyPipeline) throw new Error('Classifier not loaded');
    const output = await this.classifyPipeline(text, { topk: options?.labels?.length ?? 2 });
    const labels = (Array.isArray(output) ? output : [output]).map((item) => ({
      label: String(item.label),
      score: Number(item.score),
    }));
    return {
      label: labels[0]?.label ?? 'unknown',
      score: labels[0]?.score ?? 0,
      labels,
    };
  }

  async rewrite(text: string, options?: RewriteOptions): Promise<string> {
    await this.loadRewrite();
    if (!this.rewritePipeline) throw new Error('Rewriter not loaded');
    const tone = options?.tone ?? 'formal';
    const prompt = tone === 'formal'
      ? `rewrite formally: ${text}`
      : tone === 'casual'
        ? `rewrite casually: ${text}`
        : `rewrite concisely: ${text}`;
    const output = await this.rewritePipeline(prompt);
    const first = Array.isArray(output) ? output[0] : output;
    return first.translation_text;
  }
}
