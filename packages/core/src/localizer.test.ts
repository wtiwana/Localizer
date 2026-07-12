import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Localizer } from './localizer';

const mockClient = {
  tierManager: { activeTier: 'micro' as const },
  prefetchTier: vi.fn(),
  summarize: vi.fn(async () => 'summary text'),
  classify: vi.fn(async () => ({ label: 'positive', score: 0.92 })),
  rewrite: vi.fn(async () => 'rewritten text'),
  chatStream: vi.fn(async function* () {
    yield 'hello';
  }),
  chat: vi.fn(async () => 'hello'),
  dispose: vi.fn(),
};

vi.mock('./worker-client', () => ({
  createWorkerClient: vi.fn(async () => mockClient),
}));

describe('Localizer', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', class MockWorker {});
    vi.stubGlobal('window', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('delegates summarize to the worker client', async () => {
    const ai = await Localizer.create();
    const summary = await ai.summarize('Long article text');
    expect(summary).toBe('summary text');
    expect(mockClient.summarize).toHaveBeenCalledWith('Long article text', undefined);
  });

  it('delegates classify to the worker client', async () => {
    const ai = await Localizer.create();
    const result = await ai.classify('I love this product');
    expect(result).toEqual({ label: 'positive', score: 0.92 });
  });

  it('delegates rewrite to the worker client', async () => {
    const ai = await Localizer.create();
    const rewritten = await ai.rewrite('make it formal', { tone: 'formal' });
    expect(rewritten).toBe('rewritten text');
    expect(mockClient.rewrite).toHaveBeenCalledWith('make it formal', { tone: 'formal' });
  });

  it('exposes active tier from the worker client', async () => {
    const ai = await Localizer.create();
    expect(ai.activeTier).toBe('micro');
  });
});
