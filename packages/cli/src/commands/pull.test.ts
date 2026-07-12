import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSourceUrls, downloadBundleFiles } from './download.js';
import { pullModels } from './pull.js';

const sampleBundle = {
  engine: 'transformers',
  url: 'https://example.com/micro/',
  mirrors: ['https://cdn.example.com/micro/'],
  hfModelId: 'org/model',
  files: ['config.json', 'onnx/model.onnx'],
};

describe('buildSourceUrls', () => {
  it('normalizes trailing slashes and deduplicates sources', () => {
    expect(buildSourceUrls({
      ...sampleBundle,
      url: 'https://example.com/micro',
      mirrors: ['https://example.com/micro/', 'https://cdn.example.com/micro'],
    })).toEqual([
      'https://example.com/micro/',
      'https://cdn.example.com/micro/',
    ]);
  });
});

describe('downloadBundleFiles', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('downloads files and preserves nested directories', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'localizer-pull-'));
    const files: Record<string, string> = {
      'config.json': '{"model":true}',
      'onnx/model.onnx': 'onnx-bytes',
    };

    const fetchFn = async (input: RequestInfo | URL) => {
      const url = String(input);
      const file = url.replace('https://example.com/micro/', '');
      const body = files[file];
      if (!body) {
        return new Response(null, { status: 404 });
      }
      return new Response(body, { status: 200 });
    };

    const result = await downloadBundleFiles(sampleBundle, tempDir, { fetchFn });

    expect(result).toEqual({ downloaded: 2, skipped: 0, failed: [] });
    expect(await readFile(path.join(tempDir, 'config.json'), 'utf8')).toBe('{"model":true}');
    expect(await readFile(path.join(tempDir, 'onnx/model.onnx'), 'utf8')).toBe('onnx-bytes');
  });

  it('falls back to mirror URLs when the primary source fails', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'localizer-pull-'));
    const fetchFn = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://example.com/')) {
        return new Response(null, { status: 404 });
      }
      return new Response('mirror-config', { status: 200 });
    };

    const result = await downloadBundleFiles(
      { ...sampleBundle, files: ['config.json'] },
      tempDir,
      { fetchFn },
    );

    expect(result.failed).toEqual([]);
    expect(await readFile(path.join(tempDir, 'config.json'), 'utf8')).toBe('mirror-config');
  });

  it('skips existing files unless force is enabled', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'localizer-pull-'));
    const fetchFn = async () => new Response('new-content', { status: 200 });

    const first = await downloadBundleFiles(
      { ...sampleBundle, files: ['config.json'] },
      tempDir,
      { fetchFn },
    );
    const second = await downloadBundleFiles(
      { ...sampleBundle, files: ['config.json'] },
      tempDir,
      { fetchFn },
    );

    expect(first.downloaded).toBe(1);
    expect(second.skipped).toBe(1);
    expect(await readFile(path.join(tempDir, 'config.json'), 'utf8')).toBe('new-content');
  });
});

describe('pullModels', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('writes metadata without downloading when metadataOnly is set', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'localizer-pull-meta-'));

    await pullModels(tempDir, ['micro'], { metadataOnly: true });

    await access(path.join(tempDir, 'micro', 'manifest.json'));
    await access(path.join(tempDir, 'registry.json'));
  });
});
