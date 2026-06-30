import { Localizer } from '../localizer';

type WidgetOptions = {
  title?: string;
  theme?: 'light' | 'dark' | 'auto';
  customModel?: string;
  position?: 'bottom-right' | 'bottom-left';
};

function createWidget(options: WidgetOptions = {}): void {
  if (typeof document === 'undefined') return;

  const container = document.createElement('div');
  container.id = 'localizer-widget';
  container.style.cssText = `
    position: fixed;
    ${options.position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;'}
    bottom: 20px;
    z-index: 99999;
    font-family: system-ui, sans-serif;
  `;

  const toggle = document.createElement('button');
  toggle.textContent = 'AI';
  toggle.style.cssText = `
    width: 56px;
    height: 56px;
    border-radius: 999px;
    border: none;
    background: #2563eb;
    color: white;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35);
  `;

  const panel = document.createElement('div');
  panel.hidden = true;
  panel.style.cssText = `
    position: absolute;
    bottom: 70px;
    ${options.position === 'bottom-left' ? 'left: 0;' : 'right: 0;'}
    width: 320px;
    max-height: 420px;
    background: ${options.theme === 'dark' ? '#111827' : '#ffffff'};
    color: ${options.theme === 'dark' ? '#f9fafb' : '#111827'};
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;

  const header = document.createElement('div');
  header.textContent = options.title ?? 'Local AI';
  header.style.cssText = 'padding: 12px 16px; font-weight: 600; border-bottom: 1px solid #e5e7eb;';

  const messages = document.createElement('div');
  messages.style.cssText = 'padding: 12px 16px; overflow-y: auto; flex: 1; font-size: 14px; min-height: 220px;';

  const form = document.createElement('form');
  form.style.cssText = 'display: flex; gap: 8px; padding: 12px; border-top: 1px solid #e5e7eb;';

  const input = document.createElement('input');
  input.placeholder = 'Ask anything...';
  input.style.cssText = 'flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid #d1d5db;';

  const send = document.createElement('button');
  send.type = 'submit';
  send.textContent = 'Send';
  send.style.cssText = 'padding: 8px 12px; border: none; border-radius: 8px; background: #2563eb; color: white; cursor: pointer;';

  form.append(input, send);
  panel.append(header, messages, form);
  container.append(panel, toggle);
  document.body.append(container);

  let ai: Localizer | null = null;
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
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
