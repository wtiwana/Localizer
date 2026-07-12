import registryV1 from './model-registry/v1.json';
import type { RegistryManifest } from './types';

const REGISTRIES: Record<string, RegistryManifest> = {
  v1: registryV1 as RegistryManifest,
  latest: registryV1 as RegistryManifest,
};

export function getRegistryManifest(version: string = 'latest'): RegistryManifest {
  const manifest = REGISTRIES[version] ?? REGISTRIES.latest;
  if (!manifest) {
    throw new Error(`Unknown registry version: ${version}`);
  }
  return manifest;
}

export const UPGRADE_THRESHOLDS = {
  standard: 40,
  premium: 70,
} as const;

export const MODEL_TIERS = {
  micro: { model: 'onnx-community/SmolLM2-135M-Instruct-ONNX-GQA', sizeMB: 78, engine: 'transformers' as const },
  standard: { model: 'mlc-ai/gemma-3-270m-it-q4f16_1-MLC', sizeMB: 270, engines: ['webllm', 'transformers'] as const },
  premium: { model: 'mlc-ai/gemma-3-1b-it-q4f16_1-MLC', sizeMB: 550, engines: ['webllm'] as const, minScore: 70 },
};

export const PRESET_FEATURES = {
  basic: ['chat', 'summarize', 'classify', 'rewrite'],
  'chat-only': ['chat'],
  'nlp-only': ['summarize', 'classify', 'rewrite'],
  max: ['chat', 'summarize', 'classify', 'rewrite'],
} as const;
