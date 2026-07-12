# Localizer

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Repository:** [github.com/wtiwana/Localizer](https://github.com/wtiwana/Localizer)

**Local AI for the web — no API keys, no inference bills, no server round-trips.**

Localizer is a browser-first AI library that runs language models directly on your visitors' devices. Add a single npm package or script tag, and chat, summarization, classification, and rewriting all happen locally using Web Workers, Transformers.js, and WebLLM. Models are downloaded once, cached in the browser, and never sent to a third-party API.

Built for web developers who want AI features without the operational cost, privacy risk, or latency of cloud inference.

## Why Localizer?

| | Cloud APIs | Localizer |
|---|-----------|-----------|
| **Inference cost** | Per-token billing | Free after initial download |
| **Privacy** | Data sent to provider | Stays on-device |
| **Latency** | Network round-trip | Local generation |
| **Setup** | API keys, backends | `npm install localizer` |
| **Offline** | Requires connection | Works after first load (cached) |

## Features

- **Tiered model loading** — Start with a ~78 MB micro model for instant chat, then background-upgrade to standard/premium tiers on capable devices
- **Dual inference engines** — Transformers.js (ONNX) for micro + NLP tasks; WebLLM (WebGPU) for larger chat models
- **NLP utilities** — `summarize()`, `classify()`, and `rewrite()` out of the box
- **Zero-config registry** — Embedded model manifest with Hugging Face and jsDelivr mirror URLs; no HF account required
- **Self-hosted models** — Pull weights with the CLI, host them on your own CDN or static server, and load entirely offline at runtime
- **Custom page models** — Prepare FAQ/training bundles with the CLI for page-specific assistants
- **Declarative HTML actions** — Add `data-localizer-action` attributes for summarize/classify/rewrite without writing JavaScript
- **Drop-in chat widget** — One script tag for a floating chat UI
- **Progressive enhancement** — WebGPU when available, WASM fallback; respects `navigator.connection.saveData`
- **IndexedDB caching** — Model weights cached across return visits

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
  process.stdout.write(chunk);
}

const summary = await ai.summarize('Long article text...');
```

## Self-hosted models

Host model weights on your own infrastructure for full control, offline support, and zero runtime dependency on Hugging Face.

### 1. Pull model weights

```bash
# Download weights + manifests (default)
npx @localizer/cli pull --tier micro,standard,nlp --output ./public/localizer-models

# Metadata only — skip weight downloads
npx @localizer/cli pull --tier micro --output ./public/localizer-models --metadata-only

# Re-download files that already exist
npx @localizer/cli pull --tier micro --output ./public/localizer-models --force
```

The pull command downloads all registry-listed files, preserves nested paths (e.g. `onnx/model.onnx`), falls back to jsDelivr mirrors on failure, and skips existing files by default.

### 2. Serve from static hosting

```
public/localizer-models/
  registry.json
  micro/
  standard/
  nlp/summarize/
  nlp/classify/
  nlp/rewrite/
```

### 3. Load in the browser

```typescript
const ai = await Localizer.create({
  models: 'self-hosted',
  modelBaseUrl: '/localizer-models/',
  loadMicroAtStart: true,
});
```

At runtime, Localizer loads weights from your `modelBaseUrl` — not from Hugging Face.

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

## Declarative HTML actions

Add AI features with data attributes — no JavaScript required:

```html
<button
  data-localizer-action="summarize"
  data-target="#article"
  data-output="#summary"
>
  Summarize
</button>

<script type="module">
  import { autoInit } from 'localizer';
  autoInit();
</script>
```

Supported actions: `summarize`, `classify`, `rewrite`, `chat`.

## Custom FAQ model

Prepare a page-specific assistant bundle from FAQ data:

```bash
npx @localizer/cli train --data ./faq.json --output ./public/models/assistant
npx @localizer/cli validate ./public/models/assistant
```

```typescript
const ai = await Localizer.create({
  customModel: '/models/assistant',
  upgradePolicy: 'never',
});
```

> **Note:** `cli train` prepares training metadata and manifests. Fine-tuning and ONNX export are manual next steps — see the CLI output for guidance.

## CLI reference

| Command | Description |
|---------|-------------|
| `localizer pull` | Download model bundles for self-hosting |
| `localizer train` | Prepare a custom model bundle from FAQ/training data |
| `localizer validate` | Check a model bundle directory for required files |
| `localizer validate --strict` | Fail when runtime weights (.onnx or .bin) are missing |
| `localizer export` | Generate `manifest.json` for an existing bundle |

### `pull` options

| Flag | Description |
|------|-------------|
| `-o, --output <dir>` | Output directory (required) |
| `-t, --tier <tiers>` | Comma-separated: `micro`, `standard`, `premium`, `nlp` |
| `--metadata-only` | Write manifests only, skip weight downloads |
| `--force` | Re-download files even if they already exist |

## Model tiers

| Tier | Model | Size | Engine | Use case |
|------|-------|------|--------|----------|
| **micro** | SmolLM2-135M ONNX | ~78 MB | Transformers.js | Instant chat at page load |
| **standard** | Gemma 270M | ~270 MB | WebLLM | Higher-quality chat (WebGPU) |
| **premium** | Gemma 3 1B | ~550 MB | WebLLM | Max preset on high-capability devices |
| **nlp** | DistilBERT, DistilBART, Flan-T5 | ~70–120 MB each | Transformers.js | Summarize, classify, rewrite |

Background upgrade to standard tier triggers automatically when the device capability score is ≥ 40 (WebGPU, memory, network speed). Premium upgrades at ≥ 70 with the `max` preset.

## Monorepo packages

| Package | Description |
|---------|-------------|
| `localizer` | Browser library (chat, NLP, widget, worker) |
| `@localizer/cli` | Train, pull, validate, and export model bundles |
| `@localizer/demo` | Interactive demo app with registry and self-hosted modes |

## Development

```bash
git clone https://github.com/wtiwana/Localizer.git
cd Localizer
npm install
npm run build
npm test
npm run dev
```

### Demo: self-hosted mode

Try the full pull → host → load workflow:

```bash
# Download micro model weights (~78 MB)
npm run prepare:demo-self-hosted

# Start the demo
npm run dev:self-hosted
# Open http://localhost:5173/?mode=self-hosted
```

The demo also supports registry mode (default) at `http://localhost:5173/`.

### CI

GitHub Actions runs on every push and PR to `main`:

- **build-and-test** — Build all packages and run the test suite
- **smoke-self-hosted** — Verify self-hosted bundle layout and build the demo

```bash
npm run smoke:self-hosted   # Run the layout smoke test locally
```

## Browser requirements

- Modern Chromium, Firefox, or Safari
- WebGPU recommended for standard/premium tiers (WASM fallback for micro + NLP)
- ~300 MB RAM for micro tier; ~600 MB if standard tier upgrades

## Cost model

| Who | Pays |
|-----|------|
| Developer | Nothing for inference |
| Visitor | One-time model download (~50–270 MB), cached locally |

## Documentation

- [README](https://github.com/wtiwana/Localizer/blob/main/README.md) — Project overview (this file)
- [INTEGRATION.md](./INTEGRATION.md) — Full integration patterns and loading behavior
- [docs/API.md](./docs/API.md) — API reference
- [models-registry/README.md](./models-registry/README.md) — Registry metadata and tier details

## License

MIT
