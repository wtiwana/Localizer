import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_FILES = ['manifest.json'];

export async function validateBundle(dir: string): Promise<void> {
  for (const file of REQUIRED_FILES) {
    await access(path.join(dir, file));
  }

  const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8')) as {
    engine: string;
    files: string[];
    id?: string;
  };

  const missing: string[] = [];
  for (const file of manifest.files) {
    try {
      await access(path.join(dir, file));
    } catch {
      missing.push(file);
    }
  }

  if (missing.length > 0) {
    console.warn(`Bundle ${dir} is partially ready. Missing files:`);
    for (const file of missing) console.warn(`  - ${file}`);
    if (missing.some((file) => file.endsWith('.onnx'))) {
      console.warn('ONNX weights are not present yet. Training/export is still required for runtime inference.');
    }
  } else {
    console.log(`Bundle ${dir} is valid.`);
  }

  console.log(`Engine: ${manifest.engine}`);
  console.log(`Model id: ${manifest.id ?? 'unknown'}`);
}
