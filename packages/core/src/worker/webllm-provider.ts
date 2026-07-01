import type { ChatMessage, ChatOptions, ModelSourceConfig, ProgressEvent } from '../types';

type WebLLMModule = typeof import('@mlc-ai/web-llm');
type MLCEngine = import('@mlc-ai/web-llm').MLCEngineInterface;

export class WebLLMProvider {
  private engine: MLCEngine | null = null;
  private loadedModelId: string | null = null;
  private webllm: WebLLMModule | null = null;

  isLoaded(): boolean {
    return this.engine !== null;
  }

  private async getModule(): Promise<WebLLMModule> {
    this.webllm ??= await import('@mlc-ai/web-llm');
    return this.webllm;
  }

  async load(source: ModelSourceConfig, onProgress?: (event: ProgressEvent) => void): Promise<void> {
    const webllm = await this.getModule();
    const modelId = source.manifest.hfModelId ?? 'gemma-3-270m-it-q4f16_1-MLC';
    if (this.engine && this.loadedModelId === modelId) return;

    onProgress?.({ tier: 'standard', percent: 0, status: 'Loading WebLLM engine' });

    const appConfig: import('@mlc-ai/web-llm').AppConfig = {
      model_list: [
        {
          model: source.baseUrl.replace(/\/$/, ''),
          model_id: modelId,
        },
      ],
    };

    this.engine = await webllm.CreateMLCEngine(modelId, {
      appConfig,
      initProgressCallback: (report) => {
        onProgress?.({
          tier: 'standard',
          percent: Math.round(report.progress * 100),
          status: report.text,
        });
      },
    });

    this.loadedModelId = modelId;
    onProgress?.({ tier: 'standard', percent: 100, status: 'Standard chat model ready' });
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    if (!this.engine) throw new Error('WebLLM engine not loaded');
    const payload = buildMessages(messages, options?.system);
    const response = await this.engine.chat.completions.create({
      messages: payload,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 256,
      stream: false,
    });
    return response.choices[0]?.message?.content ?? '';
  }

  async *chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<string> {
    if (!this.engine) throw new Error('WebLLM engine not loaded');
    const payload = buildMessages(messages, options?.system);
    const stream = await this.engine.chat.completions.create({
      messages: payload,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 256,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}

function buildMessages(messages: ChatMessage[], system?: string): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const result: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (system) {
    result.push({ role: 'system', content: system });
  }
  for (const message of messages) {
    if (message.role === 'system') {
      result.push({ role: 'system', content: message.content });
    } else {
      result.push({ role: message.role, content: message.content });
    }
  }
  return result;
}
