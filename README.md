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
- **Drop-in chat widget** — One script tag for a floating chat UI with theme, accent color, and accessibility support
- **Progressive enhancement** — WebGPU when available, WASM fallback; respects `navigator.connection.saveData`
- **IndexedDB caching** — Model weights cached across return visits
- **CDN bundle** — IIFE build available for script-tag usage without a bundler

## Live demo

The interactive demo (`apps/demo`) deploys to production on every push to `main` via GitHub Actions and Vercel. It runs in **registry mode** by default — models load from the embedded Hugging Face/jsDelivr registry and cache in the visitor's browser.

**Production URL:** `https://<your-vercel-project>.vercel.app` (assigned when you link the Vercel project)

### One-time setup

1. Create a [Vercel](https://vercel.com) project linked to this repository (root directory = repo root; Vercel reads [`vercel.json`](./vercel.json)).
2. Set **Output Directory** to `dist` in Vercel project settings. If a previous deploy failed, remove any stale **Production Overrides** for Output Directory.
3. Add these GitHub repository secrets (**Settings → Secrets and variables → Actions**):
   - `VERCEL_TOKEN` — from [Vercel account tokens](https://vercel.com/account/tokens)
   - `VERCEL_ORG_ID` — from `.vercel/project.json` after linking, or the Vercel project settings
   - `VERCEL_PROJECT_ID` — from `.vercel/project.json` after linking, or the Vercel project settings
4. Push to `main` — the [deploy-demo workflow](.github/workflows/deploy-demo.yml) builds and deploys automatically.

Self-hosted mode is available at `/?mode=self-hosted` once model weights are pulled into `apps/demo/public/localizer-models/` and included in the deploy artifact.

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
  premium/
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

### ES module (recommended)

```html
<script type="module">
  import { Localizer } from 'https://cdn.jsdelivr.net/npm/localizer@0.1/+esm';
  const ai = await Localizer.create({ loadMicroAtStart: true });
</script>
```

### IIFE bundle

For environments without a bundler or import maps:

```html
<script src="https://cdn.jsdelivr.net/npm/localizer@0.1/dist/cdn/localizer.cdn.global.js"></script>
<script>
  Localizer.create({ loadMicroAtStart: true }).then((ai) => {
    console.log('Localizer ready on', ai.activeTier, 'tier');
  });
</script>
```

## Drop-in widget

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/localizer@0.1/dist/widget.js"
  data-title="Help"
  data-theme="auto"
  data-accent-color="#2563eb"
  data-position="bottom-right"
  data-locale="en"
  data-custom-model="/models/assistant"
></script>
```

Or programmatically:

```typescript
import { createWidget } from 'localizer/widget';

createWidget({
  title: 'Help Bot',
  theme: 'dark',
  accentColor: '#7c3aed',
  position: 'bottom-left',
  locale: 'en',
});
```

Widget options: `title`, `theme` (`light` | `dark` | `auto`), `accentColor`, `position` (`bottom-right` | `bottom-left`), `locale`, `customModel`.

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

Use `data-tone` (`formal`, `casual`, `concise`) on rewrite actions.

## Custom FAQ model

Prepare a page-specific assistant bundle from FAQ data or documentation pages:

```bash
# From FAQ JSON
npx @localizer/cli train --data ./faq.json --output ./public/models/assistant

# Synthesize Q&A from HTML documentation
npx @localizer/cli train \
  --pages "./docs/**/*.html" \
  --auto-qa \
  --qa-count 50 \
  --output ./public/models/assistant

# Validate before deployment
npx @localizer/cli validate ./public/models/assistant --strict
```

```typescript
const ai = await Localizer.create({
  customModel: '/models/assistant',
  upgradePolicy: 'never',
});
```

> **Note:** `cli train` prepares training metadata and manifests. Fine-tuning and ONNX export are manual next steps — see the CLI output for guidance. After exporting ONNX weights, run `localizer export` to regenerate `manifest.json` from the bundle directory.

## CLI reference

| Command | Description |
|---------|-------------|
| `localizer pull` | Download model bundles for self-hosting |
| `localizer train` | Prepare a custom model bundle from FAQ/training data or pages |
| `localizer validate` | Check a model bundle directory for required files |
| `localizer validate --strict` | Fail when runtime weights (`.onnx` or `.bin`) are missing |
| `localizer export` | Scan a bundle directory and generate `manifest.json` |

### `pull` options

| Flag | Description |
|------|-------------|
| `-o, --output <dir>` | Output directory (required) |
| `-t, --tier <tiers>` | Comma-separated: `micro`, `standard`, `premium`, `nlp` |
| `--metadata-only` | Write manifests only, skip weight downloads |
| `--force` | Re-download files even if they already exist |

### `train` options

| Flag | Description |
|------|-------------|
| `-d, --data <file>` | FAQ JSON file with `question`/`answer` pairs |
| `-p, --pages <glob>` | Documentation pages to include (e.g. `./docs/**/*.html`) |
| `-o, --output <dir>` | Output directory (default: `./public/models/assistant`) |
| `--base <model>` | Base model id (default: `HuggingFaceTB/SmolLM2-135M-Instruct`) |
| `--auto-qa` | Synthesize Q&A pairs from `--pages` |
| `--qa-count <count>` | Number of synthetic Q&A pairs (default: `100`) |

### `export` options

| Flag | Description |
|------|-------------|
| `-o, --output <dir>` | Model bundle directory (required) |
| `--id <id>` | Model id written to manifest (default: `custom-assistant`) |

The export command scans the directory, detects the engine (`transformers` or `webllm`), lists all files, and computes approximate size in MB.

## Model tiers

| Tier | Model | Size | Engine | Use case |
|------|-------|------|--------|----------|
| **micro** | SmolLM2-135M ONNX | ~78 MB | Transformers.js | Instant chat at page load |
| **standard** | Gemma 3 270M | ~270 MB | WebLLM | Higher-quality chat (WebGPU) |
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
npm run lint
npm test
npm run dev
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full contributor guide.

### Demo

The demo app includes a chat playground, NLP action buttons, a capability panel, and a widget preview.

```bash
# Registry mode (default)
npm run dev
# http://localhost:5173/

# Self-hosted mode
npm run prepare:demo-self-hosted
npm run dev:self-hosted
# http://localhost:5173/?mode=self-hosted
```

### Testing

```bash
npm test                  # Unit tests (CLI + core)
npm run test:e2e          # Playwright E2E for demo app
npm run smoke:self-hosted # Self-hosted bundle layout smoke test
```

### CI

GitHub Actions runs on every push and PR to `main`:

- **build-and-test** — Build all packages, lint, and run unit tests
- **e2e** — Playwright tests against the demo app
- **smoke-self-hosted** — Verify self-hosted bundle layout and build the demo
- **deploy-demo** — Build and deploy the demo app to Vercel (push to `main` only)

## Browser requirements

- Modern Chromium, Firefox, or Safari
- WebGPU recommended for standard/premium tiers (WASM fallback for micro + NLP)
- ~300 MB RAM for micro tier; ~600 MB for standard; ~1 GB for premium

## Cost model

| Who | Pays |
|-----|------|
| Developer | Nothing for inference |
| Visitor | One-time model download (~78–550 MB depending on tier), cached locally |

## Documentation

- [README](https://github.com/wtiwana/Localizer/blob/main/README.md) — Project overview (this file)
- [INTEGRATION.md](./INTEGRATION.md) — Full integration patterns and loading behavior
- [docs/API.md](./docs/API.md) — API reference
- [models-registry/README.md](./models-registry/README.md) — Registry metadata and tier details
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Development setup and contribution guide
- [CHANGELOG.md](./CHANGELOG.md) — Release history

## License

MIT
