import type {
  ChatMessage,
  ChatOptions,
  ModelTier,
  ProgressEvent,
  WorkerRequest,
  WorkerResponse,
} from '../types';
import { EngineManager } from './engine-manager';

const engine = new EngineManager();

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

function postProgress(event: ProgressEvent, id?: string): void {
  post({ type: 'progress', id, event });
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  try {
    switch (message.type) {
      case 'init':
        await engine.init(message.options, (event) => postProgress(event, message.id));
        post({ type: 'ready', id: message.id });
        break;
      case 'prefetch':
        await engine.prefetchTier(message.tier, (event) => postProgress(event, message.id));
        post({ type: 'tierReady', tier: message.tier });
        post({ type: 'done', id: message.id, result: true });
        break;
      case 'chat':
        await handleChat(message.id, message.messages, message.options, message.stream);
        break;
      case 'summarize':
        post({
          type: 'done',
          id: message.id,
          result: await engine.summarize(message.text, message.options),
        });
        break;
      case 'classify':
        post({
          type: 'done',
          id: message.id,
          result: await engine.classify(message.text, message.options),
        });
        break;
      case 'rewrite':
        post({
          type: 'done',
          id: message.id,
          result: await engine.rewrite(message.text, message.options),
        });
        break;
      case 'dispose':
        await engine.dispose();
        post({ type: 'done', id: message.id, result: true });
        break;
      default:
        post({ type: 'error', id: (message as { id: string }).id, message: 'Unknown worker message' });
    }
  } catch (error) {
    post({
      type: 'error',
      id: message.id,
      message: error instanceof Error ? error.message : 'Unknown worker error',
    });
  }
};

async function handleChat(
  id: string,
  messages: ChatMessage[],
  options: ChatOptions | undefined,
  stream: boolean,
): Promise<void> {
  if (stream) {
    for await (const delta of engine.chatStream(messages, options)) {
      post({ type: 'token', id, delta });
    }
    post({ type: 'done', id, result: null });
    return;
  }

  const result = await engine.chat(messages, options);
  post({ type: 'done', id, result });
}

export type { ModelTier };
