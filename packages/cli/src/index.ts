#!/usr/bin/env node
import { Command } from 'commander';
import { pullModels } from './commands/pull.js';
import { trainModel } from './commands/train.js';
import { validateBundle } from './commands/validate.js';
import { exportManifest } from './commands/export.js';

const program = new Command();

program
  .name('localizer')
  .description('Train, pull, validate, and export Localizer browser models')
  .version('0.1.0');

program
  .command('pull')
  .description('Download registry model bundles for self-hosting')
  .requiredOption('-o, --output <dir>', 'Output directory')
  .option('-t, --tier <tiers>', 'Comma-separated tiers: micro,standard,premium,nlp', 'micro,standard')
  .option('--metadata-only', 'Write manifests only, skip weight downloads', false)
  .option('--force', 'Re-download files even if they already exist', false)
  .action(async (options: { output: string; tier: string; metadataOnly?: boolean; force?: boolean }) => {
    await pullModels(
      options.output,
      options.tier.split(',').map((value) => value.trim()),
      { metadataOnly: options.metadataOnly, force: options.force },
    );
  });

program
  .command('train')
  .description('Prepare a custom micro model bundle from FAQ/training data')
  .option('-d, --data <file>', 'FAQ JSON file with question/answer pairs')
  .option('-p, --pages <glob>', 'Documentation pages to include')
  .option('-o, --output <dir>', 'Output directory', './public/models/assistant')
  .option('--base <model>', 'Base model id', 'HuggingFaceTB/SmolLM2-135M-Instruct')
  .option('--auto-qa', 'Synthesize Q&A pairs from pages', false)
  .option('--qa-count <count>', 'Number of synthetic Q&A pairs', '100')
  .action(async (options) => {
    await trainModel(options);
  });

program
  .command('validate')
  .description('Validate a model bundle directory')
  .argument('<dir>', 'Model bundle directory')
  .action(async (dir: string) => {
    await validateBundle(dir);
  });

program
  .command('export')
  .description('Generate manifest.json for an existing model bundle directory')
  .requiredOption('-o, --output <dir>', 'Model bundle directory')
  .option('--id <id>', 'Model id', 'custom-assistant')
  .action(async (options: { output: string; id: string }) => {
    await exportManifest(options.output, options.id);
  });

program.parseAsync(process.argv).catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
