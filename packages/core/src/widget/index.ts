import { Localizer } from '../localizer';

type WidgetTheme = 'light' | 'dark' | 'auto';

type WidgetOptions = {
  title?: string;
  theme?: WidgetTheme;
  customModel?: string;
  position?: 'bottom-right' | 'bottom-left';
  accentColor?: string;
  locale?: string;
};

function resolveTheme(theme: WidgetTheme = 'auto'): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function hexToRgb(hex: string): string | null {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `${r}, ${g}, ${b}`;
}

function createWidget(options: WidgetOptions = {}): void {
  if (typeof document === 'undefined') return;

  const resolvedTheme = resolveTheme(options.theme);
  const accent = hexToRgb(options.accentColor ?? '#2563eb') ?? '37, 99, 235';
  const title = options.title ?? 'Local AI';

  const container = document.createElement('div');
  container.id = 'localizer-widget';
  container.setAttribute('role', 'complementary');
  container.setAttribute('aria-label', title);
  if (options.locale) container.setAttribute('lang', options.locale);
  container.style.cssText = `
    position: fixed;
    ${options.position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;'}
    bottom: 20px;
    z-index: 99999;
    font-family: system-ui, sans-serif;
  `;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = 'AI';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'localizer-widget-panel');
  toggle.setAttribute('aria-label', `Open ${title}`);
  toggle.style.cssText = `
    width: 56px;
    height: 56px;
    border-radius: 999px;
    border: none;
    background: rgb(${accent});
    color: white;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(${accent}, 0.35);
  `;

  const panel = document.createElement('div');
  panel.id = 'localizer-widget-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', title);
  panel.style.cssText = `
    position: absolute;
    bottom: 70px;
    ${options.position === 'bottom-left' ? 'left: 0;' : 'right: 0;'}
    width: 320px;
    max-height: 420px;
    background: ${resolvedTheme === 'dark' ? '#111827' : '#ffffff'};
    color: ${resolvedTheme === 'dark' ? '#f9fafb' : '#111827'};
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;

  const header = document.createElement('div');
  header.textContent = title;
  header.style.cssText = 'padding: 12px 16px; font-weight: 600; border-bottom: 1px solid #e5e7eb;';

  const messages = document.createElement('div');
  messages.setAttribute('role', 'log');
  messages.setAttribute('aria-live', 'polite');
  messages.style.cssText = 'padding: 12px 16px; overflow-y: auto; flex: 1; font-size: 14px; min-height: 220px;';

  const form = document.createElement('form');
  form.style.cssText = 'display: flex; gap: 8px; padding: 12px; border-top: 1px solid #e5e7eb;';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Ask anything...';
  input.setAttribute('aria-label', 'Chat message');
  input.style.cssText = 'flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid #d1d5db;';

  const send = document.createElement('button');
  send.type = 'submit';
  send.textContent = 'Send';
  send.style.cssText = `padding: 8px 12px; border: none; border-radius: 8px; background: rgb(${accent}); color: white; cursor: pointer;`;

  form.append(input, send);
  panel.append(header, messages, form);
  container.append(panel, toggle);
  document.body.append(container);

  let ai: Localizer | null = null;
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
    if (!panel.hidden) input.focus();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const prompt = input.value.trim();
    if (!prompt) return;
    input.value = '';
    void (async () => {
      ai ??= await Localizer.create({
        features: ['chat'],
        loadMicroAtStart: true,
        customModel: options.customModel,
      });
      const userLine = document.createElement('div');
      userLine.textContent = `You: ${prompt}`;
      userLine.style.marginBottom = '8px';
      messages.append(userLine);
      const assistantLine = document.createElement('div');
      assistantLine.textContent = 'Assistant: ';
      messages.append(assistantLine);
      for await (const chunk of ai.chat.stream(prompt)) {
        assistantLine.textContent += chunk;
        messages.scrollTop = messages.scrollHeight;
      }
    })().catch((error) => {
      messages.textContent = error instanceof Error ? error.message : 'Chat failed';
    });
  });
}

function bootFromScript(): void {
  const script = document.currentScript as HTMLScriptElement | null;
  if (!script) return;
  createWidget({
    title: script.dataset.title,
    theme: (script.dataset.theme as WidgetOptions['theme']) ?? 'auto',
    customModel: script.dataset.customModel,
    position: (script.dataset.position as WidgetOptions['position']) ?? 'bottom-right',
    accentColor: script.dataset.accentColor,
    locale: script.dataset.locale,
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootFromScript);
  } else {
    bootFromScript();
  }
}

export { Localizer, createWidget };
