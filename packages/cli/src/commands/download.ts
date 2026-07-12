import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface RegistryBundle {
  engine: string;
  url: string;
  hfModelId?: string;
  files: string[];
  mirrors?: string[];
  sizeMB?: number;
}

export interface DownloadBundleOptions {
  metadataOnly?: boolean;
  force?: boolean;
  fetchFn?: typeof fetch;
  onFile?: (event: { file: string; status: 'downloading' | 'skipped' | 'done' | 'failed'; source?: string }) => void;
}

export interface DownloadBundleResult {
  downloaded: number;
  skipped: number;
  failed: string[];
}

export function buildSourceUrls(bundle: RegistryBundle): string[] {
  const sources = [bundle.url, ...(bundle.mirrors ?? [])];
  return [...new Set(sources.map((url) => (url.endsWith('/') ? url : `${url}/`)))];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function downloadBundleFiles(
  bundle: RegistryBundle,
  targetDir: string,
  options: DownloadBundleOptions = {},
): Promise<DownloadBundleResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const result: DownloadBundleResult = { downloaded: 0, skipped: 0, failed: [] };
  const sourceUrls = buildSourceUrls(bundle);

  if (options.metadataOnly) {
    return result;
  }

  for (const file of bundle.files) {
    const destPath = path.join(targetDir, file);

    if (!options.force && await fileExists(destPath)) {
      result.skipped += 1;
      options.onFile?.({ file, status: 'skipped' });
      continue;
    }

    options.onFile?.({ file, status: 'downloading' });

    try {
      const source = await downloadFile(sourceUrls, file, destPath, fetchFn);
      result.downloaded += 1;
      options.onFile?.({ file, status: 'done', source });
    } catch (error) {
      result.failed.push(file);
      options.onFile?.({
        file,
        status: 'failed',
        source: error instanceof Error ? error.message : 'Unknown download error',
      });
    }
  }

  return result;
}

async function downloadFile(
  sourceUrls: string[],
  file: string,
  destPath: string,
  fetchFn: typeof fetch,
): Promise<string> {
  let lastError: Error | null = null;

  for (const baseUrl of sourceUrls) {
    const url = `${baseUrl}${file}`;
    try {
      const response = await fetchFn(url);
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} for ${url}`);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await mkdir(path.dirname(destPath), { recursive: true });
      await writeFile(destPath, buffer);
      return url;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error(`Failed to download ${file}`);
}
