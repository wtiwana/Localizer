import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  downloadBundleFiles,
  type DownloadBundleResult,
  type RegistryBundle,
} from './download.js';

const REGISTRY_CANDIDATES = [
  '../../../core/src/model-registry/v1.json',
  '../../core/src/model-registry/v1.json',
];

export interface PullOptions {
  metadataOnly?: boolean;
  force?: boolean;
}

export interface RegistryManifest {
  version: string;
  tiers: Record<string, RegistryBundle>;
  nlp: Record<string, RegistryBundle>;
}

export async function pullModels(
  outputDir: string,
  tiers: string[],
  options: PullOptions = {},
): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const registry = await loadEmbeddedRegistry();

  const registryCopy = {
    version: registry.version,
    pulledAt: new Date().toISOString(),
    tiers: {} as Record<string, unknown>,
    nlp: {} as Record<string, unknown>,
  };

  const totals = { downloaded: 0, skipped: 0, failed: 0 };

  for (const tier of tiers) {
    if (tier === 'nlp') {
      for (const [name, bundle] of Object.entries(registry.nlp)) {
        const target = path.join(outputDir, 'nlp', name);
        const result = await pullBundle(bundle, target, name, options);
        accumulateTotals(totals, result);
        registryCopy.nlp[name] = { ...bundle, url: `./nlp/${name}/` };
      }
      continue;
    }

    if (!(tier in registry.tiers)) {
      throw new Error(`Unknown tier: ${tier}`);
    }

    const bundle = registry.tiers[tier];
    const target = path.join(outputDir, tier);
    const result = await pullBundle(bundle, target, tier, options);
    accumulateTotals(totals, result);
    registryCopy.tiers[tier] = { ...bundle, url: `./${tier}/` };
  }

  await writeFile(path.join(outputDir, 'registry.json'), JSON.stringify(registryCopy, null, 2));
  console.log(`Registry written to ${path.join(outputDir, 'registry.json')}`);

  if (options.metadataOnly) {
    console.log('Metadata only — skipped weight downloads. Re-run without --metadata-only to fetch files.');
    return;
  }

  console.log(`Download summary: ${totals.downloaded} downloaded, ${totals.skipped} skipped, ${totals.failed} failed`);
  if (totals.failed > 0) {
    throw new Error('Some model files failed to download. Re-run with --force to retry.');
  }
}

async function pullBundle(
  bundle: RegistryBundle,
  targetDir: string,
  label: string,
  options: PullOptions,
): Promise<DownloadBundleResult> {
  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, 'manifest.json'), JSON.stringify(bundle, null, 2));

  console.log(`Pulling bundle: ${label}`);
  console.log(`  Source: ${bundle.url}`);
  console.log(`  HF model: ${bundle.hfModelId ?? 'n/a'}`);

  const result = await downloadBundleFiles(bundle, targetDir, {
    metadataOnly: options.metadataOnly,
    force: options.force,
    onFile: ({ file, status, source }) => {
      if (status === 'downloading') {
        console.log(`  ↓ ${file}`);
      } else if (status === 'skipped') {
        console.log(`  = ${file} (already exists)`);
      } else if (status === 'done') {
        console.log(`  ✓ ${file}`);
      } else if (status === 'failed') {
        console.warn(`  ✗ ${file}: ${source}`);
      }
    },
  });

  return result;
}

function accumulateTotals(
  totals: { downloaded: number; skipped: number; failed: number },
  result: DownloadBundleResult,
): void {
  totals.downloaded += result.downloaded;
  totals.skipped += result.skipped;
  totals.failed += result.failed.length;
}

async function loadEmbeddedRegistry(): Promise<RegistryManifest> {
  let lastError: Error | null = null;

  for (const candidate of REGISTRY_CANDIDATES) {
    try {
      const registryPath = fileURLToPath(new URL(candidate, import.meta.url));
      return JSON.parse(await readFile(registryPath, 'utf8')) as RegistryManifest;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error('Unable to locate embedded registry manifest');
}

export { loadEmbeddedRegistry };
