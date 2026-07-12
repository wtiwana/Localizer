# Localizer Model Registry v1

Static model registry metadata for Localizer browser bundles.

This directory contains versioned manifests and references for the embedded registry used by the `localizer` npm package at runtime.

## Tiers

| Tier | Model | Size | Engine | Notes |
|------|-------|------|--------|-------|
| `micro/` | [SmolLM2-135M ONNX](https://huggingface.co/onnx-community/SmolLM2-135M-Instruct-ONNX-GQA) | ~78 MB | Transformers.js | Default chat model loaded at page start |
| `standard/` | [Gemma 3 270M](https://huggingface.co/mlc-ai/gemma-3-270m-it-q4f16_1-MLC) | ~270 MB | WebLLM | Background upgrade on capable devices (score ≥ 40) |
| `premium/` | [Gemma 3 1B](https://huggingface.co/mlc-ai/gemma-3-1b-it-q4f16_1-MLC) | ~550 MB | WebLLM | Max preset on high-capability devices (score ≥ 70) |
| `nlp/` | DistilBERT, DistilBART, Flan-T5 | ~70–120 MB each | Transformers.js | Summarize, classify, rewrite pipelines |

### NLP models

| Capability | Model | Directory |
|------------|-------|-----------|
| Summarize | Xenova/distilbart-cnn-6-6 | `nlp/distilbart-cnn-6-6/` |
| Classify | Xenova/distilbert-base-uncased-finetuned-sst-2-english | `nlp/distilbert-sst2/` |
| Rewrite | Xenova/flan-t5-small | `nlp/flan-t5-small/` |

## Directory layout

```
models-registry/
  README.md          # This file
  v1/
    manifest.json    # Registry metadata (tiers + NLP models)
```

The canonical embedded manifest lives at `packages/core/src/model-registry/v1.json` and is bundled into the `localizer` package at build time.

## How it works at runtime

1. `Localizer.create()` loads the embedded v1 manifest by default.
2. Model URLs resolve to Hugging Face with jsDelivr mirror fallbacks.
3. The device capability score determines whether standard/premium tiers are prefetched in the background.
4. Downloaded weights are cached in IndexedDB for return visits.

## Self-hosted deployments

Copy registry bundles to your static hosting directory with the CLI:

```bash
# Download all tiers + NLP models
npx @localizer/cli pull --tier micro,standard,premium,nlp --output ./public/localizer-models

# Metadata only (for CI or layout checks)
npx @localizer/cli pull --tier micro,nlp --output ./public/localizer-models --metadata-only
```

Expected output layout:

```
public/localizer-models/
  registry.json
  micro/
    manifest.json
    onnx/model.onnx
    tokenizer.json
    ...
  standard/
  premium/
  nlp/summarize/
  nlp/classify/
  nlp/rewrite/
```

Load self-hosted models in the browser:

```typescript
const ai = await Localizer.create({
  models: 'self-hosted',
  modelBaseUrl: '/localizer-models/',
});
```

## Custom model bundles

For page-specific assistants, use the CLI to prepare training data and validate bundles:

```bash
npx @localizer/cli train --data ./faq.json --output ./public/models/assistant
npx @localizer/cli validate ./public/models/assistant --strict
```

After fine-tuning and exporting ONNX weights:

```bash
npx @localizer/cli export --output ./public/models/assistant --id assistant
npx @localizer/cli validate ./public/models/assistant --strict
```

## Manifest format

Each bundle directory contains a `manifest.json`:

```json
{
  "version": "1",
  "id": "micro",
  "engine": "transformers",
  "files": ["onnx/model.onnx", "tokenizer.json", "config.json"],
  "sizeMB": 78
}
```

- `engine` — `transformers` (ONNX) or `webllm` (`.bin` shards)
- `files` — Relative paths to all required bundle files
- `sizeMB` — Approximate total download size

The `export` command scans an existing directory and regenerates this manifest automatically.

## Related docs

- [README](../README.md) — Project overview
- [INTEGRATION.md](../INTEGRATION.md) — Integration patterns
- [docs/API.md](../docs/API.md) — API reference
