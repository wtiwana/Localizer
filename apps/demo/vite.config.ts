import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers', '@mlc-ai/web-llm'],
  },
  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es',
  },
});
