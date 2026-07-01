import { Localizer } from './localizer';
import type { LocalizerOptions } from './types';

type ActionName = 'summarize' | 'classify' | 'rewrite' | 'chat';

const ACTION_FEATURES: Record<ActionName, LocalizerOptions['features']> = {
  summarize: ['summarize'],
  classify: ['classify'],
  rewrite: ['rewrite'],
  chat: ['chat'],
};

let sharedInstance: Localizer | null = null;

async function getInstance(options: LocalizerOptions = {}): Promise<Localizer> {
  sharedInstance ??= await Localizer.create(options);
  return sharedInstance;
}

function readElementText(element: Element | null): string {
  if (!element) return '';
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return element.value.trim();
  }
  return element.textContent?.trim() ?? '';
}

function readScriptOptions(script: HTMLScriptElement): LocalizerOptions {
  const options: LocalizerOptions = {};
  if (script.dataset.preset) options.preset = script.dataset.preset as LocalizerOptions['preset'];
  if (script.dataset.customModel) options.customModel = script.dataset.customModel;
  if (script.dataset.registry) options.registry = script.dataset.registry;
  if (script.dataset.upgradePolicy) options.upgradePolicy = script.dataset.upgradePolicy as LocalizerOptions['upgradePolicy'];
  if (script.dataset.modelBaseUrl) {
    options.modelBaseUrl = script.dataset.modelBaseUrl;
    options.models = 'self-hosted';
  }
  return options;
}

async function handleAction(element: HTMLElement, action: ActionName): Promise<void> {
  const targetSelector = element.dataset.target;
  const outputSelector = element.dataset.output;
  const ai = await getInstance({
    features: ACTION_FEATURES[action],
    loadMicroAtStart: action === 'chat',
  });

  const target = targetSelector ? document.querySelector(targetSelector) : null;
  const output = outputSelector ? document.querySelector(outputSelector) : null;
  const text = readElementText(target);

  if (action === 'summarize') {
    const summary = await ai.summarize(text);
    if (output) output.textContent = summary;
    return;
  }

  if (action === 'classify') {
    const result = await ai.classify(text);
    if (output) output.textContent = `${result.label} (${Math.round(result.score * 100)}%)`;
    return;
  }

  if (action === 'rewrite') {
    const tone = (element.dataset.tone as 'formal' | 'casual' | 'concise' | undefined) ?? 'formal';
    const rewritten = await ai.rewrite(text, { tone });
    if (output instanceof HTMLTextAreaElement || output instanceof HTMLInputElement) {
      output.value = rewritten;
    } else if (output) {
      output.textContent = rewritten;
    }
    return;
  }

  if (action === 'chat') {
    const prompt = element.dataset.prompt ?? window.prompt('Ask Localizer:') ?? '';
    if (!prompt) return;
    let response = '';
    for await (const chunk of ai.chat.stream(prompt)) {
      response += chunk;
    }
    if (output) output.textContent = response;
  }
}

export function autoInit(root: ParentNode = document): void {
  const script = root instanceof Document
    ? root.currentScript as HTMLScriptElement | null
    : null;

  const globalOptions = script ? readScriptOptions(script) : {};

  root.querySelectorAll<HTMLElement>('[data-localizer-action]').forEach((element) => {
    const action = element.dataset.localizerAction as ActionName;
    element.addEventListener('click', () => {
      void handleAction(element, action).catch((error) => {
        console.error('[Localizer]', error);
        alert(error instanceof Error ? error.message : 'Localizer action failed');
      });
    });
  });

  if (script?.dataset.localizer === 'chat') {
    void getInstance({ ...globalOptions, features: ['chat'], loadMicroAtStart: true });
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('[data-localizer-action], script[data-localizer]')) {
      autoInit();
    }
  });
}
