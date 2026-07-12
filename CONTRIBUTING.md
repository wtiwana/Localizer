# Contributing to Localizer

Thank you for contributing to Localizer. This guide covers local development, testing, and the custom model workflow.

## Development setup

```bash
git clone https://github.com/wtiwana/Localizer.git
cd Localizer
npm install
npm run build
npm test
npm run lint
```

Run the demo app:

```bash
npm run dev
# Registry mode: http://localhost:5173/
# Self-hosted mode: npm run dev:self-hosted
```

## Monorepo layout

| Package | Path | Purpose |
|---------|------|---------|
| `localizer` | `packages/core` | Browser library |
| `@localizer/cli` | `packages/cli` | Model pull/train/validate/export |
| `@localizer/demo` | `apps/demo` | Interactive demo |

## Testing expectations

- Add or update tests for behavior changes.
- CLI commands should have unit tests in `packages/cli/src`.
- Core library changes should include Vitest coverage where practical.
- Run `npm test` and `npm run lint` before opening a PR.

## Custom model workflow

The CLI prepares training metadata; fine-tuning and ONNX export remain manual:

```bash
npx @localizer/cli train --data ./faq.json --output ./public/models/assistant
npx @localizer/cli validate ./public/models/assistant --strict
```

After exporting ONNX weights into the bundle directory:

```bash
npx @localizer/cli export --output ./public/models/assistant --id assistant
npx @localizer/cli validate ./public/models/assistant --strict
```

## Pull request checklist

- [ ] Tests pass (`npm test`)
- [ ] Typecheck passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] README or INTEGRATION docs updated when behavior changes

## Reporting issues

Use the GitHub issue templates for bugs and feature requests.
