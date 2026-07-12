# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- CLI `--strict` validation for bundles missing runtime weights
- Smart `export` command that scans bundle directories
- Page-based Q&A synthesis for `localizer train --pages --auto-qa`
- Expanded test coverage for core API, cache, auto-init, widget, and CLI commands
- CI lint step, CONTRIBUTING guide, PR template, and Dependabot config
- npm publish workflow, API docs, and CDN IIFE bundle build
- Demo capability panel, NLP playground, and Playwright E2E tests
- Premium tier differentiation with Gemma 3 1B model
- Widget theming (`accentColor`, `locale`) and accessibility improvements

## [0.1.0] - 2026-07-12

### Added
- Initial release of browser-first local AI library
- Tiered model loading (micro, standard, premium)
- Chat streaming, summarize, classify, and rewrite APIs
- Self-hosted model pull CLI and demo
- Declarative HTML actions and drop-in chat widget

[Unreleased]: https://github.com/wtiwana/Localizer/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/wtiwana/Localizer/releases/tag/v0.1.0
