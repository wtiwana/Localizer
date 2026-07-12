import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.resolve(rootDir, process.argv[2] ?? 'apps/demo/public/localizer-models');

const requiredPaths = [
  'registry.json',
  'micro/manifest.json',
  'nlp/summarize/manifest.json',
  'nlp/classify/manifest.json',
  'nlp/rewrite/manifest.json',
];

for (const relativePath of requiredPaths) {
  await access(path.join(outputDir, relativePath));
}

const registry = JSON.parse(await readFile(path.join(outputDir, 'registry.json'), 'utf8'));
const microManifest = JSON.parse(await readFile(path.join(outputDir, 'micro/manifest.json'), 'utf8'));

if (!registry.tiers?.micro?.url) {
  throw new Error('registry.json is missing tiers.micro.url');
}

if (!registry.tiers.micro.url.startsWith('./')) {
  throw new Error(`Expected relative micro URL, got: ${registry.tiers.micro.url}`);
}

if (!Array.isArray(microManifest.files) || microManifest.files.length === 0) {
  throw new Error('micro/manifest.json must list model files');
}

const expectedRuntimePaths = [
  '/localizer-models/micro/',
  '/localizer-models/nlp/summarize/',
  '/localizer-models/nlp/classify/',
  '/localizer-models/nlp/rewrite/',
];

for (const runtimePath of expectedRuntimePaths) {
  const segment = runtimePath.replace('/localizer-models/', '').replace(/\/$/, '');
  await access(path.join(outputDir, segment));
}

console.log('Self-hosted layout verified:', outputDir);
console.log(`  Registry version: ${registry.version}`);
console.log(`  Micro files: ${microManifest.files.length}`);
console.log(`  NLP bundles: ${Object.keys(registry.nlp ?? {}).length}`);
