import { describe, expect, it } from 'vitest';
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
  });
});

describe('computeCapabilityProfile', () => {
  it('returns a bounded score', async () => {
    const profile = await computeCapabilityProfile();
    expect(profile.score).toBeGreaterThanOrEqual(0);
    expect(profile.score).toBeLessThanOrEqual(100);
  });
});
