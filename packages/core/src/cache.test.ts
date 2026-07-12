import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheKey, clearModelCache, fetchWithCache, getCachedBlob, setCachedBlob } from './cache';

const store = new Map<string, Blob>();

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: Blob) => {
    store.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    store.delete(key);
  }),
  keys: vi.fn(async () => [...store.keys()]),
}));

describe('cache', () => {
  beforeEach(() => {
    store.clear();
  });

  it('builds stable cache keys', () => {
    expect(cacheKey('https://example.com/', 'model.onnx')).toBe('https://example.com/model.onnx');
  });

  it('stores and retrieves cached blobs', async () => {
    const blob = new Blob(['cached'], { type: 'text/plain' });
    await setCachedBlob('test-key', blob);
    const cached = await getCachedBlob('test-key');
    expect(cached).toBe(blob);
  });

  it('fetches and caches responses when enabled', async () => {
    const fetchFn = vi.fn(async () => new Response('fresh', { status: 200 }));
    vi.stubGlobal('fetch', fetchFn);

    const first = await fetchWithCache('https://example.com/model.onnx', true);
    const second = await fetchWithCache('https://example.com/model.onnx', true);

    expect(await first.text()).toBe('fresh');
    expect(await second.text()).toBe('fresh');
    expect(fetchFn).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('clears only localizer cache keys', async () => {
    await setCachedBlob('model-a', new Blob(['a']));
    store.set('other-key', new Blob(['other']));
    await clearModelCache();
    expect(await getCachedBlob('model-a')).toBeUndefined();
    expect(store.has('other-key')).toBe(true);
  });
});
