import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

interface QAItem {
  question: string;
  answer: string;
}

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

  const manifest = {
    version: '1',
    id: path.basename(options.output),
    engine: 'transformers',
    files: ['model.onnx', 'tokenizer.json', 'config.json', 'training-data.json'],
    sizeMB: 78,
    baseModel: options.base,
    trainingPairs: qaPairs.length,
  };

  await writeFile(path.join(options.output, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`Prepared custom model bundle at ${options.output}`);
  console.log(`Training pairs: ${qaPairs.length}`);
  console.log('Next steps:');
  console.log('  1. Fine-tune the base model with LoRA using training-data.json');
  console.log('  2. Export ONNX weights to this directory');
  console.log('  3. Run: localizer validate ./public/models/assistant');
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
    pairs.push(...synthesizeQaFromPages(options.pages, count));
  }

  return pairs;
}

function synthesizeQaFromPages(pagesGlob: string, count: number): QAItem[] {
  const samples = [
    {
      question: `What is covered in ${pagesGlob}?`,
      answer: 'This documentation covers the main features and setup steps for the product.',
    },
    {
      question: 'How do I get started?',
      answer: 'Install the package, initialize Localizer at page load, and enable the features you need.',
    },
  ];

  return samples.slice(0, Math.min(count, samples.length));
}
