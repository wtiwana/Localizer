/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./localizer', () => ({
  Localizer: {
    create: vi.fn(async () => ({
      chat: {
        stream: vi.fn(async function* () {
          yield 'Widget reply';
        }),
      },
    })),
  },
}));

describe('widget', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.resetModules();
  });

  it('creates a themed widget with accessible controls', async () => {
    const { createWidget } = await import('./index');

    createWidget({
      title: 'Help Bot',
      theme: 'dark',
      position: 'bottom-left',
      accentColor: '#7c3aed',
    });

    const container = document.querySelector('#localizer-widget') as HTMLElement | null;
    expect(container).toBeTruthy();
    expect(container!.getAttribute('role')).toBe('complementary');
    expect(container!.getAttribute('aria-label')).toBe('Help Bot');

    const toggle = container!.lastElementChild as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.style.background).toContain('124, 58, 237');
    expect(container!.style.left).toBe('20px');
  });
});
