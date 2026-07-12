import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      worker: 'src/worker/index.ts',
      widget: 'src/widget/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
    external: ['@huggingface/transformers', '@mlc-ai/web-llm'],
    cjsInterop: true,
    esbuildOptions(options) {
      options.banner = {
        js: '',
      };
    },
  },
  {
    entry: {
      'localizer.cdn': 'src/index.ts',
    },
    format: ['iife'],
    globalName: 'Localizer',
    outDir: 'dist/cdn',
    sourcemap: true,
    treeshake: true,
    external: ['@huggingface/transformers', '@mlc-ai/web-llm'],
    esbuildOptions(options) {
      options.banner = {
        js: '/* Localizer CDN bundle — use with type="module" or import maps for dependencies */',
      };
    },
  },
]);
