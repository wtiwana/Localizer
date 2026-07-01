import { Localizer } from './localizer';
import type { LocalizerOptions } from './types';

export { Localizer };
export * from './types';
export * from './errors';
export { getRegistryManifest, MODEL_TIERS, UPGRADE_THRESHOLDS, PRESET_FEATURES } from './registry';
export { computeCapabilityProfile, detectBackend, detectWebGPU } from './capability';
export { resolveModelSources } from './model-source-resolver';
export { setWorkerUrl } from './worker-client';
export { clearModelCache } from './cache';
export { autoInit, registerLocalizer, registerLocalizerBoot, getRegisteredLocalizer } from './auto-init';

export default Localizer;

export type CreateOptions = LocalizerOptions;
