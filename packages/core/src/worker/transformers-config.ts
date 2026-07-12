import { env } from '@huggingface/transformers';
import type { ModelBundleManifest, ModelSourceConfig } from '../types';

export interface TransformersModelRef {
  path: string;
  localOnly: boolean;
  subfolder?: string;
}

export function resolveTransformersModelRef(
  source: ModelSourceConfig | undefined,
  fallbackModelId: string,
): TransformersModelRef {
  if (source?.localOnly) {
    return {
      path: source.baseUrl.replace(/\/$/, ''),
      localOnly: true,
      subfolder: resolveOnnxSubfolder(source.manifest),
    };
  }

  return {
    path: source?.manifest.hfModelId ?? fallbackModelId,
    localOnly: false,
  };
}

export function resolveOnnxSubfolder(manifest: ModelBundleManifest): string | undefined {
  if (manifest.files.some((file) => file.startsWith('onnx/'))) {
    return 'onnx';
  }
  if (manifest.files.some((file) => file === 'model.onnx' || file.endsWith('/model.onnx'))) {
    return '';
  }
  return undefined;
}

export function configureTransformersEnv(options: {
  cacheEnabled: boolean;
  hasLocalSources: boolean;
}): void {
  env.useBrowserCache = options.cacheEnabled;
  env.allowLocalModels = options.hasLocalSources;
}

export function hasLocalModelSources(sources: {
  micro: ModelSourceConfig;
  standard: ModelSourceConfig;
  premium: ModelSourceConfig;
  nlp: Record<string, ModelSourceConfig>;
}): boolean {
  const bundles = [
    sources.micro,
    sources.standard,
    sources.premium,
    ...Object.values(sources.nlp),
  ];
  return bundles.some((source) => source.localOnly);
}
