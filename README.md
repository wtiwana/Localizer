# Localizer

Browser-based local AI for web developers — zero API keys, zero inference bills, runs entirely in the visitor's browser.

## Features

- **Micro model at page load** (~50–80 MB) for instant basic chat
- **Background tier upgrade** on capable devices (standard/premium models)
- **NLP utilities**: summarize, classify, rewrite
- **Custom page-specific models** via `@localizer/cli train`
- **Zero-config model registry** — no Hugging Face setup required
- **Progressive enhancement**: WebGPU when available, WASM fallback

## Quick start

```bash
npm install localizer
```

```typescript
import { Localizer } from 'localizer';

const ai = await Localizer.create({
  preset: 'basic',
  loadMicroAtStart: true,
  onProgress: ({ percent, status }) => console.log(percent, status),
});

for await (const chunk of ai.chat.stream('Explain local AI in one sentence')) {
  process.stdout?.write?.(chunk);
}

const summary = await ai.summarize('Long article text...');
```

## CDN usage

```html
<script type="module">
  import { Localizer } from 'https://cdn.jsdelivr.net/npm/localizer@0.1/+esm';
  const ai = await Localizer.create({ loadMicroAtStart: true });
</script>
```

## Drop-in widget

```html
<script
  src="https://cdn.jsdelivr.net/npm/localizer@0.1/dist/widget.js"
  data-localizer="chat"
  data-custom-model="/models/assistant"
></script>
```

## Custom FAQ model

```bash
npx @localizer/cli train --data ./faq.json --output ./public/models/assistant
```

```typescript
const ai = await Localizer.create({
  customModel: '/models/assistant',
  upgradePolicy: 'never',
});
```

## Self-hosted models

```bash
npx @localizer/cli pull --tier micro,standard --output ./public/localizer-models
```

```typescript
const ai = await Localizer.create({
  models: 'self-hosted',
  modelBaseUrl: '/localizer-models/',
});
```

## Monorepo packages

| Package | Description |
|---------|-------------|
| `localizer` | Browser library |
| `@localizer/cli` | Train/pull/validate/export commands |
| `@localizer/demo` | Vite demo app |

## Development

```bash
npm install
npm run build
npm test
npm run dev
```

## Browser requirements

- Modern Chromium, Firefox, or Safari
- WebGPU recommended for best performance
- ~300 MB RAM for micro tier; ~600 MB if standard tier upgrades

## Cost model

| Who | Pays |
|-----|------|
| Developer | Nothing for inference |
| Visitor | One-time model download (~50–270 MB), cached locally |

See [INTEGRATION.md](./INTEGRATION.md) for full integration patterns.

## License

MIT
