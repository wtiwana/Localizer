import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanBundleDir } from './bundle-scan.js';
import { resolveGlob } from './glob.js';
import { synthesizeQaFromPages } from './page-qa.js';

describe('scanBundleDir', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('detects transformers bundles with onnx files', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'localizer-scan-'));
    await writeFile(path.join(tempDir, 'model.onnx'), 'onnx');
    await writeFile(path.join(tempDir, 'tokenizer.json'), '{}');

    const scanned = await scanBundleDir(tempDir);
    expect(scanned.engine).toBe('transformers');
    expect(scanned.hasOnnx).toBe(true);
    expect(scanned.files).toEqual(['model.onnx', 'tokenizer.json']);
  });

  it('detects webllm bundles with bin shards', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'localizer-scan-webllm-'));
    await writeFile(path.join(tempDir, 'mlc-chat-config.json'), '{}');
    await writeFile(path.join(tempDir, 'params_shard_0.bin'), 'bin');

    const scanned = await scanBundleDir(tempDir);
    expect(scanned.engine).toBe('webllm');
    expect(scanned.hasRuntimeWeights).toBe(true);
  });
});

describe('resolveGlob', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('matches files by glob pattern', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'localizer-glob-'));
    await writeFile(path.join(tempDir, 'a.html'), '<p>A</p>');
    await writeFile(path.join(tempDir, 'b.txt'), 'B');

    const htmlFiles = await resolveGlob(path.join(tempDir, '*.html'));
    expect(htmlFiles).toHaveLength(1);
    expect(path.basename(htmlFiles[0]!)).toBe('a.html');
  });
});

describe('synthesizeQaFromPages', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('extracts text from HTML and builds Q&A pairs', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'localizer-pageqa-'));
    await writeFile(path.join(tempDir, 'intro.html'), '<h1>Intro</h1><p>Localizer runs AI in the browser.</p>');

    const pairs = await synthesizeQaFromPages(path.join(tempDir, '*.html'), 2);
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs[0]?.answer).toContain('Localizer runs AI in the browser');
  });
});
