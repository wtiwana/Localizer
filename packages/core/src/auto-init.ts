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
let sharedInstancePromise: Promise<Localizer> | null = null;

/** Reuse an existing Localizer instance for declarative autoInit actions. */
export function registerLocalizer(instance: Localizer): void {
  sharedInstance = instance;
  sharedInstancePromise = Promise.resolve(instance);
}

/** Register an in-flight Localizer.create() promise for autoInit actions. */
export function registerLocalizerBoot(promise: Promise<Localizer>): void {
  sharedInstancePromise = promise.then((instance) => {
    sharedInstance = instance;
    return instance;
  });
}

export function getRegisteredLocalizer(): Localizer | null {
  return sharedInstance;
}

async function getInstance(options: LocalizerOptions = {}): Promise<Localizer> {
  if (sharedInstance) return sharedInstance;
  if (sharedInstancePromise) return sharedInstancePromise;
  sharedInstancePromise = Localizer.create({
    preset: 'basic',
    loadMicroAtStart: true,
    upgradePolicy: 'never',
    ...options,
  }).then((instance) => {
    sharedInstance = instance;
    return instance;
  });
  return sharedInstancePromise;
}

function readElementText(element: Element | null): string {
  if (!element) return '';
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return element.value.trim();
  }
  return element.textContent?.trim() ?? '';
}

function setOutputText(output: Element | null, text: string): void {
  if (!output) return;
  if (output instanceof HTMLTextAreaElement || output instanceof HTMLInputElement) {
    output.value = text;
    return;
  }
  output.textContent = text;
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
  const target = targetSelector ? document.querySelector(targetSelector) : null;
  const output = outputSelector ? document.querySelector(outputSelector) : null;
  const text = readElementText(target);

  if (!text) {
    setOutputText(output, 'Add some text first.');
    return;
  }

  const busyLabel = action === 'summarize'
    ? 'Summarizing…'
    : action === 'classify'
      ? 'Classifying…'
      : action === 'rewrite'
        ? 'Rewriting…'
        : 'Thinking…';
  setOutputText(output, busyLabel);
  const button = element instanceof HTMLButtonElement ? element : null;
  if (button) button.disabled = true;

  try {
    const ai = await getInstance({
      features: ACTION_FEATURES[action],
      loadMicroAtStart: action === 'chat',
    });

    if (action === 'summarize') {
      const summary = await ai.summarize(text);
      setOutputText(output, summary);
      return;
    }

    if (action === 'classify') {
      const result = await ai.classify(text);
      setOutputText(output, `${result.label} (${Math.round(result.score * 100)}%)`);
      return;
    }

    if (action === 'rewrite') {
      const tone = (element.dataset.tone as 'formal' | 'casual' | 'concise' | undefined) ?? 'formal';
      const rewritten = await ai.rewrite(text, { tone });
      setOutputText(output, rewritten);
      return;
    }

    if (action === 'chat') {
      const prompt = element.dataset.prompt ?? window.prompt('Ask Localizer:') ?? '';
      if (!prompt) {
        setOutputText(output, '');
        return;
      }
      let response = '';
      for await (const chunk of ai.chat.stream(prompt)) {
        response += chunk;
      }
      setOutputText(output, response);
    }
  } finally {
    if (button) button.disabled = false;
  }
}

export function autoInit(root: ParentNode = document): void {
  const script = root instanceof Document
    ? root.currentScript as HTMLScriptElement | null
    : null;

  const globalOptions = script ? readScriptOptions(script) : {};

  root.querySelectorAll<HTMLElement>('[data-localizer-action]:not([data-localizer-bound])').forEach((element) => {
    element.dataset.localizerBound = 'true';
    const action = element.dataset.localizerAction as ActionName;
    element.addEventListener('click', () => {
      void handleAction(element, action).catch((error) => {
        console.error('[Localizer]', error);
        const output = element.dataset.output
          ? document.querySelector(element.dataset.output)
          : null;
        setOutputText(
          output,
          error instanceof Error ? error.message : 'Localizer action failed',
        );
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
