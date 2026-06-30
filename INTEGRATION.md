# Localizer Integration Guide

## 1. Zero-config (default)

```typescript
import { Localizer } from 'localizer';
const ai = await Localizer.create();
```

Models load from the embedded Localizer registry (Hugging Face mirrors with jsDelivr fallbacks).

## 2. npm in bundled apps

```typescript
import { Localizer } from 'localizer';

const ai = await Localizer.create({
  preset: 'basic',
  loadMicroAtStart: true,
  upgradePolicy: 'auto',
  onTierChange: ({ from, to }) => console.log(`${from} -> ${to}`),
});
```

## 3. Declarative actions

```html
<button data-localizer-action="summarize" data-target="#article" data-output="#summary">
  Summarize
</button>
<script type="module">
  import { autoInit } from 'localizer';
  autoInit();
</script>
```

## 4. Custom trained model

```bash
npx @localizer/cli train --data ./faq.json --output ./public/models/assistant
npx @localizer/cli validate ./public/models/assistant
```

```typescript
const ai = await Localizer.create({ customModel: '/models/assistant' });
```

## 5. Self-hosted registry

```bash
npx @localizer/cli pull --tier micro,standard --output ./public/localizer-models
```

```typescript
const ai = await Localizer.create({
  models: 'self-hosted',
  modelBaseUrl: '/localizer-models/',
});
```

## Loading behavior

1. Micro tier loads at page load (~50–80 MB)
2. Capability probe scores device/network
3. Standard tier prefetches in background if score >= 40
4. Hot-swap on next chat request
5. IndexedDB caches weights for return visits

## Respect for saveData

When `navigator.connection.saveData` is true, background prefetch is skipped automatically.
