import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { WorkerClient } from '../src/worker-client';
import type { WorkerResponse } from '../src/types';

function attachWorker(client: WorkerClient, worker: MockWorker): void {
  const internal = client as unknown as {
    worker: MockWorker;
    handleMessage: (message: WorkerResponse) => void;
  };
  internal.worker = worker;
  worker.onmessage = (event) => internal.handleMessage(event.data);
}

class MockWorker {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  postMessage = vi.fn();

  emit(message: WorkerResponse): void {
    this.onmessage?.({ data: message } as MessageEvent<WorkerResponse>);
  }
}

describe('WorkerClient chatStream', () => {
  let mockWorker: MockWorker;

  beforeEach(() => {
    mockWorker = new MockWorker();
    vi.stubGlobal('Worker', vi.fn(() => mockWorker));
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-request-id',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('completes when the worker sends done without tokens', async () => {
    const client = new WorkerClient(
      { loadMicroAtStart: false },
      {
        score: 30,
        tier: 'micro',
        webgpu: false,
        deviceMemoryGB: 4,
        connection: 'fast',
        saveData: false,
      },
    );

    attachWorker(client, mockWorker);

    const stream = client.chatStream([{ role: 'user', content: 'hello' }]);
    const read = stream.next();

    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'chat', stream: true }),
    );

    mockWorker.emit({ type: 'done', id: 'test-request-id', result: null });

    const result = await read;
    expect(result.done).toBe(true);
    expect(result.value).toBeUndefined();
  });

  it('yields streamed tokens and then completes', async () => {
    const client = new WorkerClient(
      { loadMicroAtStart: false },
      {
        score: 30,
        tier: 'micro',
        webgpu: false,
        deviceMemoryGB: 4,
        connection: 'fast',
        saveData: false,
      },
    );

    attachWorker(client, mockWorker);

    const stream = client.chatStream([{ role: 'user', content: 'hello' }]);
    const first = stream.next();
    const second = stream.next();

    mockWorker.emit({ type: 'token', id: 'test-request-id', delta: 'Hi' });
    mockWorker.emit({ type: 'done', id: 'test-request-id', result: null });

    await expect(first).resolves.toEqual({ value: 'Hi', done: false });
    await expect(second).resolves.toEqual({ value: undefined, done: true });
  });

  it('does not duplicate streamed tokens', async () => {
    const client = new WorkerClient(
      { loadMicroAtStart: false },
      {
        score: 30,
        tier: 'micro',
        webgpu: false,
        deviceMemoryGB: 4,
        connection: 'fast',
        saveData: false,
      },
    );

    attachWorker(client, mockWorker);

    const stream = client.chatStream([{ role: 'user', content: 'hello' }]);
    const consume = (async () => {
      const collected: string[] = [];
      for await (const chunk of stream) {
        collected.push(chunk);
      }
      return collected;
    })();

    await Promise.resolve();
    mockWorker.emit({ type: 'token', id: 'test-request-id', delta: 'Hi' });
    mockWorker.emit({ type: 'token', id: 'test-request-id', delta: ' there' });
    mockWorker.emit({ type: 'done', id: 'test-request-id', result: null });

    await expect(consume).resolves.toEqual(['Hi', ' there']);
  });
});
