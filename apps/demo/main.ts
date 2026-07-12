import {
  Localizer,
  autoInit,
  registerLocalizerBoot,
  computeCapabilityProfile,
  detectBackend,
  type LocalizerOptions,
} from 'localizer';
import { createWidget } from 'localizer/widget';

const SELF_HOSTED_BASE_URL = '/localizer-models/';
const CHAT_SYSTEM = 'You are Localizer, a helpful AI assistant that runs locally in the browser. Answer briefly and clearly in 1-3 sentences.';

type DemoMode = 'registry' | 'self-hosted';

type DemoElements = {
  statusTextEl: HTMLSpanElement;
  statusEl: HTMLDivElement;
  tierBadgeEl: HTMLDivElement;
  modeBadgeEl: HTMLDivElement;
  chatLogEl: HTMLDivElement;
  chatFormEl: HTMLFormElement;
  chatInputEl: HTMLInputElement;
  chatSubmitEl: HTMLButtonElement;
  codeExampleEl: HTMLPreElement;
  setupCardEl: HTMLElement;
  modeLinks: NodeListOf<HTMLAnchorElement>;
  capabilityPanelEl: HTMLElement;
  capabilityScoreEl: HTMLSpanElement;
  capabilityBackendEl: HTMLSpanElement;
  capabilityMemoryEl: HTMLSpanElement;
  progressBarEl: HTMLDivElement;
  progressFillEl: HTMLDivElement;
  widgetToggleEl: HTMLButtonElement;
};

function getElements(): DemoElements {
  return {
    statusTextEl: document.querySelector('#status-text')!,
    statusEl: document.querySelector('#status')!,
    tierBadgeEl: document.querySelector('#tier-badge')!,
    modeBadgeEl: document.querySelector('#mode-badge')!,
    chatLogEl: document.querySelector('#chat-log')!,
    chatFormEl: document.querySelector('#chat-form')!,
    chatInputEl: document.querySelector('#chat-input')!,
    chatSubmitEl: document.querySelector('#chat-submit')!,
    codeExampleEl: document.querySelector('#code-example')!,
    setupCardEl: document.querySelector('#self-hosted-setup')!,
    modeLinks: document.querySelectorAll('[data-demo-mode]'),
    capabilityPanelEl: document.querySelector('#capability-panel')!,
    capabilityScoreEl: document.querySelector('#capability-score')!,
    capabilityBackendEl: document.querySelector('#capability-backend')!,
    capabilityMemoryEl: document.querySelector('#capability-memory')!,
    progressBarEl: document.querySelector('#progress-bar')!,
    progressFillEl: document.querySelector('#progress-fill')!,
    widgetToggleEl: document.querySelector('#widget-toggle')!,
  };
}

let placeholderRemoved = false;

function getDemoMode(): DemoMode {
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') === 'self-hosted' ? 'self-hosted' : 'registry';
}

function setStatus(elements: DemoElements, text: string, ready = false): void {
  elements.statusTextEl.textContent = text;
  elements.statusEl.dataset.status = text;
  elements.statusEl.classList.toggle('ready', ready);
  elements.statusEl.classList.remove('error');
}

function setErrorStatus(elements: DemoElements, text: string): void {
  elements.statusTextEl.textContent = text;
  elements.statusEl.classList.add('error');
  elements.statusEl.classList.remove('ready');
}

function updateProgress(elements: DemoElements, percent: number): void {
  elements.progressBarEl.classList.remove('hidden');
  elements.progressBarEl.setAttribute('aria-valuenow', String(percent));
  elements.progressFillEl.style.width = `${percent}%`;
}

function enableChat(elements: DemoElements): void {
  elements.chatInputEl.disabled = false;
  elements.chatSubmitEl.disabled = false;
  elements.chatInputEl.focus();
}

async function showCapabilityPanel(elements: DemoElements): Promise<void> {
  const [profile, backend] = await Promise.all([
    computeCapabilityProfile(),
    detectBackend(),
  ]);

  elements.capabilityPanelEl.classList.remove('hidden');
  elements.capabilityScoreEl.textContent = String(profile.score);
  elements.capabilityBackendEl.textContent = backend;
  elements.capabilityMemoryEl.textContent = `${profile.deviceMemoryGB} GB`;
}

function appendMessage(elements: DemoElements, role: 'you' | 'assistant', text: string): HTMLParagraphElement {
  if (!placeholderRemoved) {
    elements.chatLogEl.innerHTML = '';
    placeholderRemoved = true;
  }

  const line = document.createElement('p');
  line.className = `chat-line chat-line--${role}`;
  line.innerHTML = `<strong>${role === 'you' ? 'You' : 'Localizer'}:</strong> <span class="chat-text"></span>`;
  line.querySelector('.chat-text')!.textContent = text;
  elements.chatLogEl.appendChild(line);
  elements.chatLogEl.scrollTop = elements.chatLogEl.scrollHeight;
  return line;
}

function updateModeUi(elements: DemoElements, mode: DemoMode): void {
  document.body.dataset.demoMode = mode;
  elements.modeBadgeEl.textContent = mode === 'self-hosted' ? 'Self-hosted models' : 'Registry models';
  elements.modeBadgeEl.classList.remove('hidden');
  elements.setupCardEl.classList.toggle('hidden', mode !== 'self-hosted');

  elements.modeLinks.forEach((link) => {
    link.classList.toggle('active', link.dataset.demoMode === mode);
  });

  if (mode === 'self-hosted') {
    elements.codeExampleEl.textContent = `const ai = await Localizer.create({
  models: 'self-hosted',
  modelBaseUrl: '${SELF_HOSTED_BASE_URL}',
  loadMicroAtStart: true,
});

for await (const chunk of ai.chat.stream('Hello!')) {
  console.log(chunk);
}`;
    return;
  }

  elements.codeExampleEl.textContent = `const ai = await Localizer.create({
  loadMicroAtStart: true,
});

for await (const chunk of ai.chat.stream('Hello!')) {
  console.log(chunk);
}`;
}

function buildLocalizerOptions(mode: DemoMode): LocalizerOptions {
  if (mode === 'self-hosted') {
    return {
      models: 'self-hosted',
      modelBaseUrl: SELF_HOSTED_BASE_URL,
      preset: 'basic',
      loadMicroAtStart: true,
      upgradePolicy: 'never',
    };
  }

  return {
    preset: 'basic',
    loadMicroAtStart: true,
    upgradePolicy: 'never',
  };
}

async function verifySelfHostedBundle(): Promise<boolean> {
  try {
    const response = await fetch(`${SELF_HOSTED_BASE_URL}micro/manifest.json`);
    return response.ok;
  } catch {
    return false;
  }
}

function setupWidgetPreview(elements: DemoElements): void {
  elements.widgetToggleEl.addEventListener('click', () => {
    const existing = document.querySelector('#localizer-widget');
    if (existing) {
      existing.remove();
      elements.widgetToggleEl.textContent = 'Toggle widget preview';
      return;
    }

    createWidget({
      title: 'Demo Widget',
      theme: 'dark',
      accentColor: '#7c3aed',
      position: 'bottom-left',
    });
    elements.widgetToggleEl.textContent = 'Hide widget preview';
  });
}

async function runChat(elements: DemoElements, ai: Localizer, prompt: string): Promise<void> {
  appendMessage(elements, 'you', prompt);
  const replyLine = appendMessage(elements, 'assistant', '');
  const replyText = replyLine.querySelector('.chat-text')!;

  elements.chatInputEl.disabled = true;
  elements.chatSubmitEl.disabled = true;

  try {
    for await (const chunk of ai.chat.stream(prompt, {
      system: CHAT_SYSTEM,
      maxTokens: 128,
      temperature: 0.3,
    })) {
      replyText.textContent += chunk;
      elements.chatLogEl.scrollTop = elements.chatLogEl.scrollHeight;
    }
  } catch (error) {
    replyText.textContent = error instanceof Error ? error.message : 'Something went wrong.';
  } finally {
    elements.chatInputEl.disabled = false;
    elements.chatSubmitEl.disabled = false;
    elements.chatInputEl.focus();
  }
}

async function boot(): Promise<void> {
  const elements = getElements();
  const mode = getDemoMode();
  updateModeUi(elements, mode);
  void showCapabilityPanel(elements);
  setupWidgetPreview(elements);

  if (mode === 'self-hosted') {
    setStatus(elements, 'Checking self-hosted bundle…');
    const bundleReady = await verifySelfHostedBundle();
    if (!bundleReady) {
      setErrorStatus(elements, 'Self-hosted bundle missing. Run: npm run prepare:demo-self-hosted');
      return;
    }
  }

  setStatus(elements, mode === 'self-hosted' ? 'Loading self-hosted model…' : 'Starting local AI…');

  const bootPromise = Localizer.create({
    ...buildLocalizerOptions(mode),
    onProgress: (event) => {
      const label = mode === 'self-hosted' ? 'self-hosted' : (event.tier ?? 'model');
      setStatus(elements, `Loading ${label}… ${event.percent}%`);
      updateProgress(elements, event.percent);
    },
    onTierChange: ({ from, to }) => {
      elements.tierBadgeEl.classList.remove('hidden');
      elements.tierBadgeEl.textContent = `Enhanced AI ready (${from} → ${to})`;
    },
  });
  registerLocalizerBoot(bootPromise);
  autoInit();

  try {
    const ai = await bootPromise;
    const modeLabel = mode === 'self-hosted' ? 'self-hosted micro' : `${ai.activeTier} tier`;
    setStatus(elements, `Ready — running on ${modeLabel}`, true);
    elements.progressBarEl.classList.add('hidden');
    enableChat(elements);

    elements.chatFormEl.addEventListener('submit', (event) => {
      event.preventDefault();
      const prompt = elements.chatInputEl.value.trim();
      if (!prompt) return;
      elements.chatInputEl.value = '';
      void runChat(elements, ai, prompt);
    });
  } catch (error) {
    setErrorStatus(elements, error instanceof Error ? error.message : 'Failed to start local AI');
    console.error('[Localizer demo]', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void boot();
  });
} else {
  void boot();
}
