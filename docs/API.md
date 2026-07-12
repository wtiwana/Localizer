# Localizer API Reference

Public exports from the `localizer` package.

## `Localizer`

Main entry point for browser-based local AI.

### `Localizer.create(options?)`

Creates and initializes a Localizer instance.

```typescript
const ai = await Localizer.create({
  preset: 'basic',
  loadMicroAtStart: true,
  upgradePolicy: 'auto',
  onProgress: ({ percent, status }) => console.log(percent, status),
  onTierChange: ({ from, to }) => console.log(`${from} -> ${to}`),
});
```

**Options**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `preset` | `'basic' \| 'chat-only' \| 'nlp-only' \| 'max'` | `'basic'` | Feature bundle |
| `loadMicroAtStart` | `boolean` | `true` | Load micro chat model at startup |
| `upgradePolicy` | `'auto' \| 'never'` | `'auto'` | Background tier upgrades |
| `models` | `'registry' \| 'self-hosted'` | `'registry'` | Model source |
| `modelBaseUrl` | `string` | — | Base URL for self-hosted bundles |
| `customModel` | `string` | — | Path to a custom trained bundle |
| `cache` | `'indexeddb' \| 'none'` | `'indexeddb'` | Model file caching |
| `onProgress` | `(event) => void` | — | Loading progress callback |
| `onTierChange` | `(event) => void` | — | Tier upgrade callback |

### `ai.chat.stream(input, options?)`

Streams chat tokens from the active model tier.

```typescript
for await (const chunk of ai.chat.stream('Hello!')) {
  process.stdout.write(chunk);
}
```

### `ai.summarize(text, options?)`

Returns a summary string.

### `ai.classify(text, options?)`

Returns `{ label: string; score: number }`.

### `ai.rewrite(text, options?)`

Rewrites text with an optional `tone` (`formal`, `casual`, `concise`).

### `ai.prefetchTier(tier)`

Background-loads `standard` or `premium` tiers.

### `ai.dispose()`

Terminates the worker and releases resources.

## Declarative HTML

```html
<button data-localizer-action="summarize" data-target="#article" data-output="#summary">
  Summarize
</button>
<script type="module">
  import { autoInit } from 'localizer';
  autoInit();
</script>
```

Supported actions: `summarize`, `classify`, `rewrite`, `chat`.

## Widget

```html
<script
  type="module"
  src="https://cdn.example.com/localizer/widget.js"
  data-title="Help"
  data-theme="auto"
  data-accent-color="#2563eb"
  data-position="bottom-right"
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

## Utility exports

| Export | Description |
|--------|-------------|
| `getRegistryManifest()` | Embedded model registry |
| `computeCapabilityProfile()` | Device capability scoring |
| `resolveModelSources()` | Resolve model URLs |
| `clearModelCache()` | Clear IndexedDB model cache |
| `setWorkerUrl()` | Set worker script URL for CDN usage |

## Model tiers

| Tier | Model | Size | Engine |
|------|-------|------|--------|
| micro | SmolLM2-135M ONNX | ~78 MB | Transformers.js |
| standard | Gemma 3 270M | ~270 MB | WebLLM |
| premium | Gemma 3 1B | ~550 MB | WebLLM |

## CLI (`@localizer/cli`)

| Command | Description |
|---------|-------------|
| `localizer pull` | Download registry bundles for self-hosting |
| `localizer train` | Prepare custom model training bundle |
| `localizer validate [--strict]` | Validate bundle layout and weights |
| `localizer export` | Generate manifest from existing files |
