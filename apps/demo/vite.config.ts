import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const coreSrc = path.join(repoRoot, 'packages/core/src');

const crossOriginHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

export default defineConfig({
  resolve: {
    alias: [
      { find: 'localizer/worker', replacement: path.join(coreSrc, 'worker/index.ts') },
      { find: 'localizer/widget', replacement: path.join(coreSrc, 'widget/index.ts') },
      { find: 'localizer', replacement: path.join(coreSrc, 'index.ts') },
    ],
  },
  server: {
    port: 5173,
    headers: crossOriginHeaders,
    sourcemapIgnoreList(sourcePath) {
      return sourcePath.includes('node_modules/@mlc-ai/web-llm');
    },
  },
  preview: {
    headers: crossOriginHeaders,
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers', '@mlc-ai/web-llm'],
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  worker: {
    format: 'es',
  },
});
