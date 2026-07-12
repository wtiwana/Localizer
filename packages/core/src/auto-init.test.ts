/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { autoInit, registerLocalizer } from './auto-init';
import type { Localizer } from './localizer';

function createMockLocalizer(): Localizer {
  return {
    summarize: vi.fn(async () => 'Short summary.'),
    classify: vi.fn(async () => ({ label: 'positive', score: 0.88 })),
    rewrite: vi.fn(async () => 'Rewritten copy.'),
    chat: {
      stream: vi.fn(async function* () {
        yield 'Hello from Localizer';
      }),
      invoke: vi.fn(async () => 'Hello from Localizer'),
    },
    activeTier: 'micro',
    tier: 'micro',
    prefetchTier: vi.fn(),
    dispose: vi.fn(),
  } as unknown as Localizer;
}

describe('autoInit', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    registerLocalizer(createMockLocalizer());
  });

  it('wires summarize actions to output elements', async () => {
    document.body.innerHTML = `
      <textarea id="article">Long article text</textarea>
      <button data-localizer-action="summarize" data-target="#article" data-output="#summary"></button>
      <p id="summary"></p>
    `;

    autoInit();
    const button = document.querySelector('button')!;
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('#summary')!.textContent).toBe('Short summary.');
  });

  it('shows a helpful message when target text is empty', async () => {
    document.body.innerHTML = `
      <textarea id="article"></textarea>
      <button data-localizer-action="summarize" data-target="#article" data-output="#summary"></button>
      <p id="summary"></p>
    `;

    autoInit();
    document.querySelector('button')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('#summary')!.textContent).toBe('Add some text first.');
  });

  it('wires classify actions', async () => {
    document.body.innerHTML = `
      <p id="text">Great product</p>
      <button data-localizer-action="classify" data-target="#text" data-output="#result"></button>
      <p id="result"></p>
    `;

    autoInit();
    document.querySelector('button')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('#result')!.textContent).toBe('positive (88%)');
  });
});
