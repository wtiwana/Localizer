import { describe, expect, it, vi } from 'vitest';
import { computeCapabilityProfile } from '../src/capability';
import { getRegistryManifest, PRESET_FEATURES, UPGRADE_THRESHOLDS } from '../src/registry';
import { resolveModelSources } from '../src/model-source-resolver';
import { ModelTierManager } from '../src/tier-manager';

describe('registry', () => {
  it('loads v1 manifest with tiers and nlp models', () => {
    const manifest = getRegistryManifest('v1');
    expect(manifest.tiers.micro.engine).toBe('transformers');
    expect(manifest.tiers.standard.engine).toBe('webllm');
    expect(manifest.nlp.summarize.hfModelId).toContain('distilbart-cnn');
  });

  it('exposes preset features', () => {
    expect(PRESET_FEATURES.basic).toContain('chat');
    expect(UPGRADE_THRESHOLDS.standard).toBe(40);
  });

  it('uses a larger model for premium tier', async () => {
    const { MODEL_TIERS } = await import('../src/registry');
    expect(MODEL_TIERS.premium.model).toContain('1b');
    expect(MODEL_TIERS.premium.sizeMB).toBeGreaterThan(MODEL_TIERS.standard.sizeMB);
  });
});

describe('ModelTierManager', () => {
  it('prefetches standard tier when score qualifies', () => {
    const manager = new ModelTierManager('auto', {
      score: 55,
      tier: 'standard',
      webgpu: true,
      deviceMemoryGB: 8,
      connection: 'fast',
      saveData: false,
    });
    expect(manager.shouldPrefetchStandard()).toBe(true);
    expect(manager.shouldPrefetchPremium()).toBe(false);
  });

  it('prefetches premium tier when score qualifies', () => {
    const manager = new ModelTierManager('auto', {
      score: 85,
      tier: 'premium',
      webgpu: true,
      deviceMemoryGB: 8,
      connection: 'fast',
      saveData: false,
    });
    expect(manager.shouldPrefetchPremium()).toBe(true);
  });

  it('hot-swaps to standard when ready', () => {
    const changes: Array<{ from: string; to: string }> = [];
    const manager = new ModelTierManager('auto', {
      score: 55,
      tier: 'standard',
      webgpu: true,
      deviceMemoryGB: 8,
      connection: 'fast',
      saveData: false,
    }, (event) => changes.push(event));

    manager.markTierReady('standard');
    expect(manager.activeTier).toBe('standard');
    expect(changes).toEqual([{ from: 'micro', to: 'standard' }]);
  });
});

describe('resolveModelSources', () => {
  it('resolves registry sources by default', async () => {
    const { resolved } = await resolveModelSources({});
    expect(resolved.micro.baseUrl).toContain('SmolLM2-135M');
    expect(resolved.standard.engine).toBe('webllm');
  });

  it('uses self-hosted base url when configured', async () => {
    const { resolved } = await resolveModelSources({
      models: 'self-hosted',
      modelBaseUrl: '/localizer-models/',
    });
    expect(resolved.micro.baseUrl).toBe('/localizer-models/micro/');
    expect(resolved.micro.localOnly).toBe(true);
    expect(resolved.standard.baseUrl).toBe('/localizer-models/standard/');
    expect(resolved.standard.localOnly).toBe(true);
    expect(resolved.nlp.summarize.baseUrl).toBe('/localizer-models/nlp/summarize/');
    expect(resolved.nlp.summarize.localOnly).toBe(true);
    expect(resolved.nlp.classify.baseUrl).toBe('/localizer-models/nlp/classify/');
    expect(resolved.nlp.rewrite.baseUrl).toBe('/localizer-models/nlp/rewrite/');
  });

  it('marks custom models as local-only', async () => {
    const manifest = {
      version: '1',
      id: 'assistant',
      engine: 'transformers' as const,
      files: ['model.onnx', 'tokenizer.json'],
    };

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => manifest,
    })));

    const { resolved } = await resolveModelSources({ customModel: '/models/assistant' });
    expect(resolved.micro.baseUrl).toContain('/models/assistant/');
    expect(resolved.micro.localOnly).toBe(true);

    vi.unstubAllGlobals();
  });
});

describe('computeCapabilityProfile', () => {
  it('returns a bounded score', async () => {
    const profile = await computeCapabilityProfile();
    expect(profile.score).toBeGreaterThanOrEqual(0);
    expect(profile.score).toBeLessThanOrEqual(100);
  });
});
