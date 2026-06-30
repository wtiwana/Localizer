import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REGISTRY = {
  micro: {
    files: [
      'manifest.json',
    ],
    registryPath: '../../../core/src/model-registry/v1.json',
  },
};

export async function pullModels(outputDir: string, tiers: string[]): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const registry = await loadEmbeddedRegistry();

  const registryCopy = {
    version: registry.version,
    pulledAt: new Date().toISOString(),
    tiers: {} as Record<string, unknown>,
    nlp: {} as Record<string, unknown>,
  };

  for (const tier of tiers) {
    if (tier === 'nlp') {
      for (const [name, bundle] of Object.entries(registry.nlp)) {
        const target = path.join(outputDir, 'nlp', name);
        await mkdir(target, { recursive: true });
        await writeFile(path.join(target, 'manifest.json'), JSON.stringify(bundle, null, 2));
        registryCopy.nlp[name] = { ...bundle, url: `./nlp/${name}/` };
        console.log(`Prepared NLP bundle metadata: ${name}`);
      }
      continue;
    }

    if (!(tier in registry.tiers)) {
      throw new Error(`Unknown tier: ${tier}`);
    }

    const bundle = registry.tiers[tier as keyof typeof registry.tiers];
    const target = path.join(outputDir, tier);
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, 'manifest.json'), JSON.stringify(bundle, null, 2));
    registryCopy.tiers[tier] = { ...bundle, url: `./${tier}/` };
    console.log(`Prepared tier metadata: ${tier}`);
    console.log(`  Source: ${bundle.url}`);
    console.log(`  HF model: ${bundle.hfModelId ?? 'n/a'}`);
    console.log('  Note: run with browser caching or download HF weights in CI for full offline hosting.');
  }

  await writeFile(path.join(outputDir, 'registry.json'), JSON.stringify(registryCopy, null, 2));
  console.log(`Registry written to ${path.join(outputDir, 'registry.json')}`);
}

async function loadEmbeddedRegistry(): Promise<{
  version: string;
  tiers: Record<string, { url: string; hfModelId?: string; files: string[]; engine: string; sizeMB?: number }>;
  nlp: Record<string, { url: string; hfModelId?: string; files: string[]; engine: string; sizeMB?: number }>;
}> {
  const registryPath = fileURLToPath(new URL(REGISTRY.micro.registryPath, import.meta.url));
  return JSON.parse(await readFile(registryPath, 'utf8')) as {
    version: string;
    tiers: Record<string, { url: string; hfModelId?: string; files: string[]; engine: string; sizeMB?: number }>;
    nlp: Record<string, { url: string; hfModelId?: string; files: string[]; engine: string; sizeMB?: number }>;
  };
}

export { loadEmbeddedRegistry };
