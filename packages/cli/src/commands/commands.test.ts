import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { exportManifest } from './export.js';
import { trainModel } from './train.js';
import { validateBundle } from './validate.js';

describe('trainModel', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('writes training-data.json and manifest.json from FAQ data', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'localizer-train-'));
    const dataFile = path.join(tempDir, 'faq.json');
    const outputDir = path.join(tempDir, 'assistant');

    await writeFile(dataFile, JSON.stringify([
      { question: 'What is Localizer?', answer: 'A browser local AI library.' },
    ]));

    await trainModel({ data: dataFile, output: outputDir, base: 'HuggingFaceTB/SmolLM2-135M-Instruct' });

    const trainingData = JSON.parse(await readFile(path.join(outputDir, 'training-data.json'), 'utf8'));
    const manifest = JSON.parse(await readFile(path.join(outputDir, 'manifest.json'), 'utf8'));

    expect(trainingData.pairs).toHaveLength(1);
    expect(manifest.trainingPairs).toBe(1);
    expect(manifest.files).toContain('training-data.json');
  });

  it('synthesizes Q&A pairs from HTML pages', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'localizer-train-pages-'));
    const docsDir = path.join(tempDir, 'docs');
    const outputDir = path.join(tempDir, 'assistant');
    await mkdir(docsDir, { recursive: true });
    await writeFile(path.join(docsDir, 'guide.html'), '<html><body><h1>Getting Started</h1><p>Install Localizer and enable chat on your site.</p></body></html>');

    await trainModel({
      pages: path.join(docsDir, '*.html'),
      output: outputDir,
      base: 'HuggingFaceTB/SmolLM2-135M-Instruct',
      autoQa: true,
      qaCount: '2',
    });

    const trainingData = JSON.parse(await readFile(path.join(outputDir, 'training-data.json'), 'utf8'));
    expect(trainingData.pairs.length).toBeGreaterThan(0);
    expect(trainingData.pairs[0].question).toContain('Getting Started');
  });
});

describe('validateBundle', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('passes when manifest files exist', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'localizer-validate-'));
    await writeFile(path.join(tempDir, 'manifest.json'), JSON.stringify({
      version: '1',
      id: 'assistant',
      engine: 'transformers',
      files: ['config.json'],
    }));
    await writeFile(path.join(tempDir, 'config.json'), '{}');

    const result = await validateBundle(tempDir);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('fails in strict mode when runtime weights are missing', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'localizer-validate-strict-'));
    await writeFile(path.join(tempDir, 'manifest.json'), JSON.stringify({
      version: '1',
      id: 'assistant',
      engine: 'transformers',
      files: ['config.json'],
    }));
    await writeFile(path.join(tempDir, 'config.json'), '{}');

    const result = await validateBundle(tempDir, { strict: true });
    expect(result.valid).toBe(false);
    expect(result.hasRuntimeWeights).toBe(false);
  });

  it('passes in strict mode when onnx weights exist', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'localizer-validate-onnx-'));
    await writeFile(path.join(tempDir, 'manifest.json'), JSON.stringify({
      version: '1',
      id: 'assistant',
      engine: 'transformers',
      files: ['model.onnx', 'config.json'],
    }));
    await writeFile(path.join(tempDir, 'config.json'), '{}');
    await writeFile(path.join(tempDir, 'model.onnx'), 'onnx');

    const result = await validateBundle(tempDir, { strict: true });
    expect(result.valid).toBe(true);
    expect(result.hasRuntimeWeights).toBe(true);
  });
});

describe('exportManifest', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('scans directory and writes a manifest with discovered files', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'localizer-export-'));
    await writeFile(path.join(tempDir, 'config.json'), '{"model":true}');
    await writeFile(path.join(tempDir, 'model.onnx'), 'onnx-bytes');

    await exportManifest(tempDir, 'custom-assistant');

    const manifest = JSON.parse(await readFile(path.join(tempDir, 'manifest.json'), 'utf8'));
    expect(manifest.id).toBe('custom-assistant');
    expect(manifest.engine).toBe('transformers');
    expect(manifest.files).toContain('config.json');
    expect(manifest.files).toContain('model.onnx');
    expect(manifest.sizeMB).toBeGreaterThan(0);
  });
});
