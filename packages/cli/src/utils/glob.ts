import { readdir } from 'node:fs/promises';
import path from 'node:path';

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

async function walkFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(fullPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function resolveGlob(pattern: string, cwd = process.cwd()): Promise<string[]> {
  const absolutePattern = path.isAbsolute(pattern) ? pattern : path.join(cwd, pattern);
  const root = path.dirname(absolutePattern);
  const matcher = globToRegExp(path.basename(absolutePattern));

  try {
    const files = await walkFiles(root);
    return files
      .filter((file) => matcher.test(path.basename(file)))
      .sort();
  } catch {
    return [];
  }
}
