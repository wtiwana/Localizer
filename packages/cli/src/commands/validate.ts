import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { scanBundleDir } from '../utils/bundle-scan.js';

const REQUIRED_FILES = ['manifest.json'];

export interface ValidateOptions {
  strict?: boolean;
}

export interface ValidateResult {
  valid: boolean;
  missing: string[];
  hasRuntimeWeights: boolean;
}

export async function validateBundle(dir: string, options: ValidateOptions = {}): Promise<ValidateResult> {
  for (const file of REQUIRED_FILES) {
    await access(path.join(dir, file));
  }

  const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8')) as {
    engine: string;
    files: string[];
    id?: string;
  };

  const scanned = await scanBundleDir(dir);
  const missing: string[] = [];
  for (const file of manifest.files) {
    try {
      await access(path.join(dir, file));
    } catch {
      missing.push(file);
    }
  }

  const hasRuntimeWeights = scanned.hasRuntimeWeights;
  const valid = missing.length === 0 && (!options.strict || hasRuntimeWeights);

  if (missing.length > 0) {
    console.warn(`Bundle ${dir} is partially ready. Missing files:`);
    for (const file of missing) console.warn(`  - ${file}`);
    if (missing.some((file) => file.endsWith('.onnx'))) {
      console.warn('ONNX weights are not present yet. Training/export is still required for runtime inference.');
    }
  } else if (options.strict && !hasRuntimeWeights) {
    console.warn(`Bundle ${dir} is missing runtime weights (.onnx or .bin files).`);
  } else {
    console.log(`Bundle ${dir} is valid.`);
  }

  console.log(`Engine: ${manifest.engine}`);
  console.log(`Model id: ${manifest.id ?? 'unknown'}`);
  console.log(`Files on disk: ${scanned.files.length}`);
  console.log(`Approx size: ${scanned.sizeMB} MB`);

  return { valid, missing, hasRuntimeWeights };
}
