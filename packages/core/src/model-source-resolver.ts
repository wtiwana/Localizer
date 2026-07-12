import type {
  CustomModelManifest,
  LocalizerOptions,
  ModelBundleManifest,
  ModelSourceConfig,
  RegistryManifest,
  ResolvedModelSources,
} from './types';
import { getRegistryManifest } from './registry';

function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function resolveBundle(
  bundle: ModelBundleManifest,
  overrideUrl?: string,
  localOnly = false,
): ModelSourceConfig {
  const baseUrl = normalizeBaseUrl(overrideUrl ?? bundle.url ?? bundle.mirrors?.[0] ?? '');
  return {
    baseUrl,
    manifest: bundle,
    engine: bundle.engine,
    localOnly,
  };
}

function resolveSelfHostedNlp(
  registryManifest: RegistryManifest,
  basePrefix: string,
): ResolvedModelSources['nlp'] {
  const resolveNlp = (name: keyof RegistryManifest['nlp']) => {
    const bundle = registryManifest.nlp[name];
    const url = `${basePrefix}nlp/${name}/`;
    return resolveBundle({ ...bundle, url }, url, true);
  };

  return {
    summarize: resolveNlp('summarize'),
    classify: resolveNlp('classify'),
    rewrite: resolveNlp('rewrite'),
  };
}

async function fetchCustomManifest(customModelPath: string): Promise<CustomModelManifest> {
  const base = normalizeBaseUrl(
    customModelPath.startsWith('http')
      ? customModelPath
      : `${typeof location !== 'undefined' ? location.origin : ''}${customModelPath.startsWith('/') ? '' : '/'}${customModelPath}`,
  );
  const response = await fetch(`${base}manifest.json`);
  if (!response.ok) {
    throw new Error(`Failed to load custom model manifest from ${base}manifest.json`);
  }
  return response.json() as Promise<CustomModelManifest>;
}

export async function resolveModelSources(options: LocalizerOptions): Promise<{
  registryManifest: RegistryManifest;
  resolved: ResolvedModelSources;
}> {
  const registryManifest = getRegistryManifest(options.registry ?? 'latest');

  if (options.customModel) {
    const custom = await fetchCustomManifest(options.customModel);
    const customBase = normalizeBaseUrl(
      options.customModel.startsWith('http')
        ? options.customModel
        : `${typeof location !== 'undefined' ? location.origin : ''}${options.customModel.startsWith('/') ? '' : '/'}${options.customModel}`,
    );
    const customBundle: ModelBundleManifest = {
      version: custom.version,
      id: custom.id,
      engine: custom.engine,
      files: custom.files,
      sizeMB: custom.sizeMB,
      url: customBase,
    };
    const micro = resolveBundle(customBundle, customBase, true);
    return {
      registryManifest,
      resolved: {
        micro,
        standard: resolveBundle(registryManifest.tiers.standard, options.tiers?.standard?.url),
        premium: resolveBundle(registryManifest.tiers.premium, options.tiers?.premium?.url),
        nlp: {
          summarize: resolveBundle(registryManifest.nlp.summarize),
          classify: resolveBundle(registryManifest.nlp.classify),
          rewrite: resolveBundle(registryManifest.nlp.rewrite),
        },
      },
    };
  }

  const basePrefix =
    options.models === 'self-hosted' && options.modelBaseUrl
      ? normalizeBaseUrl(options.modelBaseUrl)
      : undefined;

  const resolveTier = (tier: keyof RegistryManifest['tiers'], override?: string) => {
    if (basePrefix) {
      const url = `${basePrefix}${tier}/`;
      const bundle = { ...registryManifest.tiers[tier], url };
      return resolveBundle(bundle, url, true);
    }
    if (override) {
      return resolveBundle(registryManifest.tiers[tier], override, true);
    }
    return resolveBundle(registryManifest.tiers[tier]);
  };

  return {
    registryManifest,
    resolved: {
      micro: resolveTier('micro', options.tiers?.micro?.url),
      standard: resolveTier('standard', options.tiers?.standard?.url),
      premium: resolveTier('premium', options.tiers?.premium?.url),
      nlp: basePrefix
        ? resolveSelfHostedNlp(registryManifest, basePrefix)
        : {
            summarize: resolveBundle(registryManifest.nlp.summarize),
            classify: resolveBundle(registryManifest.nlp.classify),
            rewrite: resolveBundle(registryManifest.nlp.rewrite),
          },
    },
  };
}

export { getRegistryManifest };
