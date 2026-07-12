import { writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { scanBundleDir } from '../utils/bundle-scan.js';

export async function exportManifest(outputDir: string, id: string): Promise<void> {
  await access(outputDir);
  const scanned = await scanBundleDir(outputDir);

  if (scanned.files.length === 0) {
    throw new Error(`No model files found in ${outputDir}`);
  }

  const manifest = {
    version: '1',
    id,
    engine: scanned.engine,
    files: scanned.files,
    sizeMB: scanned.sizeMB,
  };

  await writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Wrote manifest.json to ${outputDir}`);
  console.log(`Engine: ${scanned.engine}`);
  console.log(`Files: ${scanned.files.length}`);
  console.log(`Approx size: ${scanned.sizeMB} MB`);
}
