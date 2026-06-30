import type { CapabilityProfile, ModelTier, TierChangeEvent, UpgradePolicy } from './types';
import { UPGRADE_THRESHOLDS } from './registry';

export class ModelTierManager {
  activeTier: ModelTier = 'micro';
  private loadedTiers = new Set<ModelTier>(['micro']);
  private inflightTier: ModelTier | null = null;

  constructor(
    private readonly upgradePolicy: UpgradePolicy,
    private readonly capability: CapabilityProfile,
    private readonly onTierChange?: (event: TierChangeEvent) => void,
  ) {}

  shouldPrefetchStandard(): boolean {
    if (this.upgradePolicy === 'never') return false;
    if (this.capability.saveData) return false;
    if (this.loadedTiers.has('standard')) return false;
    return this.capability.score >= UPGRADE_THRESHOLDS.standard;
  }

  shouldPrefetchPremium(): boolean {
    if (this.upgradePolicy !== 'auto') return false;
    if (this.capability.saveData) return false;
    if (this.loadedTiers.has('premium')) return false;
    return this.capability.score >= UPGRADE_THRESHOLDS.premium;
  }

  markTierReady(tier: ModelTier): void {
    const previous = this.activeTier;
    this.loadedTiers.add(tier);

    if (tier === 'standard' && this.activeTier === 'micro') {
      this.activeTier = 'standard';
    } else if (tier === 'premium') {
      this.activeTier = 'premium';
    }

    if (previous !== this.activeTier) {
      this.onTierChange?.({ from: previous, to: this.activeTier });
    }
  }

  resolveChatTier(requested?: ModelTier | 'auto'): ModelTier {
    if (requested && requested !== 'auto') {
      if (this.loadedTiers.has(requested)) return requested;
      return this.activeTier;
    }
    return this.activeTier;
  }

  setInflight(tier: ModelTier | null): void {
    this.inflightTier = tier;
  }

  getInflight(): ModelTier | null {
    return this.inflightTier;
  }

  isTierLoaded(tier: ModelTier): boolean {
    return this.loadedTiers.has(tier);
  }
}
