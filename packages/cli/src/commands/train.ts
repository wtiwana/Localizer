import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { scanBundleDir } from '../utils/bundle-scan.js';
import { synthesizeQaFromPages, type QAItem } from '../utils/page-qa.js';

interface TrainOptions {
  data?: string;
  pages?: string;
  output: string;
  base: string;
  autoQa?: boolean;
  qaCount?: string;
}

export async function trainModel(options: TrainOptions): Promise<void> {
  const qaPairs = await collectTrainingData(options);
  if (qaPairs.length === 0) {
    throw new Error('No training data found. Provide --data or --pages with --auto-qa.');
  }

  await mkdir(options.output, { recursive: true });

  const trainingFile = {
    baseModel: options.base,
    pairs: qaPairs,
    instructions: [
      'This bundle was prepared by @localizer/cli.',
      'For production, fine-tune the base model with LoRA and export ONNX weights into this directory.',
      'Place model.onnx, tokenizer.json, and config.json alongside manifest.json.',
    ],
  };

  await writeFile(path.join(options.output, 'training-data.json'), JSON.stringify(trainingFile, null, 2));

  const scanned = await scanBundleDir(options.output);
  const manifest = {
    version: '1',
    id: path.basename(options.output),
    engine: 'transformers' as const,
    files: [...new Set([...scanned.files, 'model.onnx', 'tokenizer.json', 'config.json', 'training-data.json'])],
    sizeMB: scanned.hasRuntimeWeights ? scanned.sizeMB : 78,
    baseModel: options.base,
    trainingPairs: qaPairs.length,
  };

  await writeFile(path.join(options.output, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`Prepared custom model bundle at ${options.output}`);
  console.log(`Training pairs: ${qaPairs.length}`);
  console.log('Next steps:');
  console.log('  1. Fine-tune the base model with LoRA using training-data.json');
  console.log('  2. Export ONNX weights to this directory');
  console.log('  3. Run: localizer validate ./public/models/assistant --strict');
}

async function collectTrainingData(options: TrainOptions): Promise<QAItem[]> {
  const pairs: QAItem[] = [];

  if (options.data) {
    const raw = await readFile(options.data, 'utf8');
    const parsed = JSON.parse(raw) as QAItem[];
    pairs.push(...parsed);
  }

  if (options.pages && options.autoQa) {
    const count = Number(options.qaCount ?? '100');
    pairs.push(...await synthesizeQaFromPages(options.pages, count));
  }

  return pairs;
}
