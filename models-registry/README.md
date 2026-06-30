# Localizer Model Registry v1

Static model registry metadata for jsDelivr-hosted Localizer bundles.

This directory contains versioned manifests and references for:

- `micro/` — SmolLM2-135M ONNX chat model
- `standard/` — Gemma 270M WebLLM bundle
- `premium/` — High-end optional tier
- `nlp/` — Summarize, classify, rewrite utility models

At runtime, the `localizer` npm package embeds this manifest and resolves Hugging Face / jsDelivr URLs automatically.

Use `@localizer/cli pull` to copy registry metadata into your static hosting directory for self-hosted deployments.
