import { pipeline, TextStreamer } from '@huggingface/transformers';
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
import {
  configureTransformersEnv,
  resolveTransformersModelRef,
  type TransformersModelRef,
} from './transformers-config';

type SummarizationPipeline = Awaited<ReturnType<typeof pipeline<'summarization'>>>;
type ClassificationPipeline = Awaited<ReturnType<typeof pipeline<'text-classification'>>>;
type TranslationPipeline = Awaited<ReturnType<typeof pipeline<'translation'>>>;

type PipelineLoadOptions = {
  device: 'webgpu' | 'wasm';
  local_files_only?: boolean;
  subfolder?: string;
  progress_callback: (progress: { progress?: number; status?: string }) => void;
};

export class TransformersProvider {
  private chatPipeline: TextGenerationPipeline | null = null;
  private summarizePipeline: SummarizationPipeline | null = null;
  private classifyPipeline: ClassificationPipeline | null = null;
  private rewritePipeline: TranslationPipeline | null = null;
  private nlpModels: Partial<Record<'summarize' | 'classify' | 'rewrite', ModelSourceConfig>> = {};
  cacheEnabled: boolean;

  constructor(cacheEnabled: boolean) {
    this.cacheEnabled = cacheEnabled;
    configureTransformersEnv({ cacheEnabled, hasLocalSources: false });
  }

  configureModelSources(hasLocalSources: boolean): void {
    configureTransformersEnv({ cacheEnabled: this.cacheEnabled, hasLocalSources });
  }

  setNlpModels(models: Partial<Record<'summarize' | 'classify' | 'rewrite', ModelSourceConfig>>): void {
    this.nlpModels = models;
  }

  private nlpModelRef(capability: 'summarize' | 'classify' | 'rewrite', fallback: string): TransformersModelRef {
    return resolveTransformersModelRef(this.nlpModels[capability], fallback);
  }

  private async getDevice(): Promise<'webgpu' | 'wasm'> {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (typeof navigator !== 'undefined' && gpu) {
      try {
        const adapter = await gpu.requestAdapter();
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

  private pipelineLoadOptions(
    modelRef: TransformersModelRef,
    onProgress?: (event: ProgressEvent) => void,
    tier: ModelTierLabel = 'micro',
    capability?: string,
  ): PipelineLoadOptions {
    return {
      device: 'wasm',
      local_files_only: modelRef.localOnly || undefined,
      subfolder: modelRef.subfolder,
      progress_callback: (progress: { progress?: number; status?: string }) => {
        this.emit(onProgress, {
          tier,
          capability,
          percent: Math.round((progress.progress ?? 0) * 100),
          status: progress.status ?? 'Loading model',
        });
      },
    };
  }

  hasChatPipeline(): boolean {
    return this.chatPipeline !== null;
  }

  async loadChat(source: ModelSourceConfig, onProgress?: (event: ProgressEvent) => void): Promise<void> {
    if (this.chatPipeline) return;
    const modelRef = resolveTransformersModelRef(source, source.baseUrl);
    this.emit(onProgress, { tier: 'micro', percent: 0, status: `Loading chat model ${modelRef.path}` });
    const device = await this.getDevice();
    const loadOptions = this.pipelineLoadOptions(modelRef, onProgress);
    loadOptions.device = device;

    this.chatPipeline = (await pipeline(
      'text-generation',
      modelRef.path,
      loadOptions,
    )) as unknown as TextGenerationPipeline;
    this.emit(onProgress, { tier: 'micro', percent: 100, status: 'Micro chat model ready' });
  }

  async loadSummarize(onProgress?: (event: ProgressEvent) => void): Promise<void> {
    if (this.summarizePipeline) return;
    const modelRef = this.nlpModelRef('summarize', 'Xenova/distilbart-cnn-6-6');
    this.emit(onProgress, { tier: 'nlp', capability: 'summarize', percent: 0, status: 'Loading summarizer' });
    const device = await this.getDevice();
    const loadOptions = this.pipelineLoadOptions(modelRef, onProgress, 'nlp', 'summarize');
    loadOptions.device = device;
    this.summarizePipeline = (await pipeline(
      'summarization',
      modelRef.path,
      loadOptions,
    )) as unknown as typeof this.summarizePipeline;
  }

  async loadClassify(onProgress?: (event: ProgressEvent) => void): Promise<void> {
    if (this.classifyPipeline) return;
    const modelRef = this.nlpModelRef('classify', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
    this.emit(onProgress, { tier: 'nlp', capability: 'classify', percent: 0, status: 'Loading classifier' });
    const device = await this.getDevice();
    const loadOptions = this.pipelineLoadOptions(modelRef, onProgress, 'nlp', 'classify');
    loadOptions.device = device;
    this.classifyPipeline = (await pipeline(
      'text-classification',
      modelRef.path,
      loadOptions,
    )) as unknown as typeof this.classifyPipeline;
  }

  async loadRewrite(onProgress?: (event: ProgressEvent) => void): Promise<void> {
    if (this.rewritePipeline) return;
    const modelRef = this.nlpModelRef('rewrite', 'Xenova/flan-t5-small');
    this.emit(onProgress, { tier: 'nlp', capability: 'rewrite', percent: 0, status: 'Loading rewriter' });
    const device = await this.getDevice();
    const loadOptions = this.pipelineLoadOptions(modelRef, onProgress, 'nlp', 'rewrite');
    loadOptions.device = device;
    this.rewritePipeline = (await pipeline(
      'translation',
      modelRef.path,
      loadOptions,
    )) as unknown as typeof this.rewritePipeline;
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
    const generated = extractGeneratedText(result);
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
        const generated = extractGeneratedText(result);
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
      min_length: Math.min(30, Math.max(8, Math.floor(text.length / 4))),
    } as never);
    const first = (Array.isArray(output) ? output[0] : output) as { summary_text?: string };
    return first.summary_text ?? '';
  }

  async classify(text: string, options?: ClassifyOptions): Promise<ClassifyResult> {
    await this.loadClassify();
    if (!this.classifyPipeline) throw new Error('Classifier not loaded');
    const output = await this.classifyPipeline(text, { top_k: options?.labels?.length ?? 2 } as never);
    const labels = (Array.isArray(output) ? output : [output]).map((item) => {
      const entry = item as { label?: string; score?: number };
      return {
        label: String(entry.label),
        score: Number(entry.score),
      };
    });
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
    const first = (Array.isArray(output) ? output[0] : output) as { translation_text?: string };
    return first.translation_text ?? '';
  }
}

type ModelTierLabel = ProgressEvent['tier'];

function extractGeneratedText(result: unknown): string | undefined {
  if (Array.isArray(result)) {
    return (result[0] as { generated_text?: string } | undefined)?.generated_text;
  }
  return (result as { generated_text?: string }).generated_text;
}
