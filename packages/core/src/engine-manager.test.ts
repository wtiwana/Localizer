import { describe, expect, it, vi } from 'vitest';
import { EngineManager } from '../src/worker/engine-manager';
import { TransformersProvider } from '../src/worker/transformers-provider';
import { WebLLMProvider } from '../src/worker/webllm-provider';
import type { SerializedInitOptions } from '../src/types';

function baseOptions(): SerializedInitOptions {
  return {
    registryManifest: {} as SerializedInitOptions['registryManifest'],
    resolvedSources: {
      micro: {
        baseUrl: 'https://example.com/micro/',
        engine: 'transformers',
        manifest: { engine: 'transformers', hfModelId: 'micro-model' } as SerializedInitOptions['resolvedSources']['micro']['manifest'],
      },
      standard: {
        baseUrl: 'https://example.com/standard/',
        engine: 'webllm',
        manifest: { engine: 'webllm', hfModelId: 'standard-model' } as SerializedInitOptions['resolvedSources']['standard']['manifest'],
      },
      premium: {
        baseUrl: 'https://example.com/premium/',
        engine: 'webllm',
        manifest: { engine: 'webllm', hfModelId: 'premium-model' } as SerializedInitOptions['resolvedSources']['premium']['manifest'],
      },
      nlp: {},
    },
    features: ['chat'],
    cache: 'indexeddb',
    upgradePolicy: 'auto',
    loadMicroAtStart: true,
    capability: {
      score: 55,
      tier: 'standard',
      webgpu: true,
      deviceMemoryGB: 8,
      connection: 'fast',
      saveData: false,
    },
  };
}

describe('EngineManager tier routing', () => {
  it('enables local transformers loading for self-hosted sources', async () => {
    const manager = new EngineManager();
    const transformers = (manager as unknown as { transformers: TransformersProvider }).transformers;
    const configureSpy = vi.spyOn(transformers, 'configureModelSources');
    vi.spyOn(transformers, 'loadChat').mockResolvedValue(undefined);

    const options = baseOptions();
    options.resolvedSources.micro.localOnly = true;

    await manager.init(options);

    expect(configureSpy).toHaveBeenCalledWith(true);
  });

  it('falls back to micro transformers chat when standard webllm is not loaded', async () => {
    const manager = new EngineManager();
    const transformers = (manager as unknown as { transformers: TransformersProvider }).transformers;
    const webllm = (manager as unknown as { webllm: WebLLMProvider }).webllm;

    vi.spyOn(transformers, 'loadChat').mockResolvedValue(undefined);
    vi.spyOn(transformers, 'hasChatPipeline').mockReturnValue(true);
    vi.spyOn(transformers, 'chat').mockResolvedValue('hello from micro');
    vi.spyOn(webllm, 'isLoaded').mockReturnValue(false);

    const options = baseOptions();
    await manager.init(options);

  const internal = manager as unknown as {
    loadedTiers: Set<string>;
    tierBackends: Map<string, string>;
    activeTier: string;
  };
    internal.loadedTiers.add('standard');
    internal.tierBackends.set('standard', 'webllm');
    internal.activeTier = 'standard';

    const response = await manager.chat([{ role: 'user', content: 'Hello' }], { tier: 'standard' });
    expect(response).toBe('hello from micro');
    expect(transformers.chat).toHaveBeenCalled();
  });

  it('does not mark standard ready when webllm-only prefetch fails', async () => {
    const manager = new EngineManager();
    const webllm = (manager as unknown as { webllm: WebLLMProvider }).webllm;

    vi.spyOn((manager as unknown as { transformers: TransformersProvider }).transformers, 'loadChat').mockResolvedValue(undefined);

    await manager.init(baseOptions());

    vi.spyOn(webllm, 'load').mockRejectedValue(new Error('WebLLM init failed'));

    await expect(manager.prefetchTier('standard')).rejects.toThrow('WebLLM init failed');

    const internal = manager as unknown as { loadedTiers: Set<string> };
    expect(internal.loadedTiers.has('standard')).toBe(false);
  });
});
