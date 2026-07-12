import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const SKIP_FILES = new Set(['manifest.json', 'training-data.json', '.DS_Store']);

export type BundleEngine = 'transformers' | 'webllm';

export interface ScannedBundle {
  files: string[];
  engine: BundleEngine;
  sizeMB: number;
  hasOnnx: boolean;
  hasRuntimeWeights: boolean;
}

async function walkDir(dir: string, baseDir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkDir(fullPath, baseDir));
      continue;
    }
    if (entry.isFile() && !SKIP_FILES.has(entry.name)) {
      files.push(path.relative(baseDir, fullPath).split(path.sep).join('/'));
    }
  }

  return files.sort();
}

function detectEngine(files: string[]): BundleEngine {
  if (files.some((file) => file.includes('mlc-chat-config') || file.endsWith('.bin'))) {
    return 'webllm';
  }
  return 'transformers';
}

export async function scanBundleDir(dir: string): Promise<ScannedBundle> {
  const files = await walkDir(dir, dir);
  const engine = detectEngine(files);
  let totalBytes = 0;

  for (const file of files) {
    const fileStat = await stat(path.join(dir, file));
    totalBytes += fileStat.size;
  }

  const hasOnnx = files.some((file) => file.endsWith('.onnx'));
  const hasRuntimeWeights = hasOnnx || files.some((file) => file.endsWith('.bin'));

  return {
    files,
    engine,
    sizeMB: Math.max(1, Math.round(totalBytes / (1024 * 1024))),
    hasOnnx,
    hasRuntimeWeights,
  };
}
