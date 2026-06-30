import { writeFile, access } from 'node:fs/promises';
import path from 'node:path';

export async function exportManifest(outputDir: string, id: string): Promise<void> {
  await access(outputDir);
  const manifest = {
    version: '1',
    id,
    engine: 'transformers',
    files: ['model.onnx', 'tokenizer.json', 'config.json'],
    sizeMB: 78,
  };
  await writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Wrote manifest.json to ${outputDir}`);
}
