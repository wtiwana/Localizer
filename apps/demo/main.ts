import { Localizer, autoInit, registerLocalizerBoot, type LocalizerOptions } from 'localizer';

const statusTextEl = document.querySelector<HTMLSpanElement>('#status-text')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const tierBadgeEl = document.querySelector<HTMLDivElement>('#tier-badge')!;
const modeBadgeEl = document.querySelector<HTMLDivElement>('#mode-badge')!;
const chatLogEl = document.querySelector<HTMLDivElement>('#chat-log')!;
const chatFormEl = document.querySelector<HTMLFormElement>('#chat-form')!;
const chatInputEl = document.querySelector<HTMLInputElement>('#chat-input')!;
const chatSubmitEl = document.querySelector<HTMLButtonElement>('#chat-submit')!;
const codeExampleEl = document.querySelector<HTMLPreElement>('#code-example')!;
const setupCardEl = document.querySelector<HTMLElement>('#self-hosted-setup')!;
const modeLinks = document.querySelectorAll<HTMLAnchorElement>('[data-demo-mode]');

const SELF_HOSTED_BASE_URL = '/localizer-models/';
const CHAT_SYSTEM = 'You are Localizer, a helpful AI assistant that runs locally in the browser. Answer briefly and clearly in 1-3 sentences.';

type DemoMode = 'registry' | 'self-hosted';

let placeholderRemoved = false;

function getDemoMode(): DemoMode {
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') === 'self-hosted' ? 'self-hosted' : 'registry';
}

function setStatus(text: string, ready = false): void {
  statusTextEl.textContent = text;
  statusEl.classList.toggle('ready', ready);
  statusEl.classList.remove('error');
}

function setErrorStatus(text: string): void {
  statusTextEl.textContent = text;
  statusEl.classList.add('error');
  statusEl.classList.remove('ready');
}

function enableChat(): void {
  chatInputEl.disabled = false;
  chatSubmitEl.disabled = false;
  chatInputEl.focus();
}

function appendMessage(role: 'you' | 'assistant', text: string): HTMLParagraphElement {
  if (!placeholderRemoved) {
    chatLogEl.innerHTML = '';
    placeholderRemoved = true;
  }

  const line = document.createElement('p');
  line.className = `chat-line chat-line--${role}`;
  line.innerHTML = `<strong>${role === 'you' ? 'You' : 'Localizer'}:</strong> <span class="chat-text"></span>`;
  line.querySelector('.chat-text')!.textContent = text;
  chatLogEl.appendChild(line);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
  return line;
}

function updateModeUi(mode: DemoMode): void {
  document.body.dataset.demoMode = mode;
  modeBadgeEl.textContent = mode === 'self-hosted' ? 'Self-hosted models' : 'Registry models';
  modeBadgeEl.classList.remove('hidden');
  setupCardEl.classList.toggle('hidden', mode !== 'self-hosted');

  modeLinks.forEach((link) => {
    link.classList.toggle('active', link.dataset.demoMode === mode);
  });

  if (mode === 'self-hosted') {
    codeExampleEl.textContent = `const ai = await Localizer.create({
  models: 'self-hosted',
  modelBaseUrl: '${SELF_HOSTED_BASE_URL}',
  loadMicroAtStart: true,
});

for await (const chunk of ai.chat.stream('Hello!')) {
  console.log(chunk);
}`;
    return;
  }

  codeExampleEl.textContent = `const ai = await Localizer.create({
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

async function boot(): Promise<void> {
  const mode = getDemoMode();
  updateModeUi(mode);

  if (mode === 'self-hosted') {
    setStatus('Checking self-hosted bundle…');
    const bundleReady = await verifySelfHostedBundle();
    if (!bundleReady) {
      setErrorStatus('Self-hosted bundle missing. Run: npm run prepare:demo-self-hosted');
      return;
    }
  }

  setStatus(mode === 'self-hosted' ? 'Loading self-hosted model…' : 'Starting local AI…');

  const bootPromise = Localizer.create({
    ...buildLocalizerOptions(mode),
    onProgress: (event) => {
      const label = mode === 'self-hosted' ? 'self-hosted' : (event.tier ?? 'model');
      setStatus(`Loading ${label}… ${event.percent}%`);
    },
    onTierChange: ({ from, to }) => {
      tierBadgeEl.classList.remove('hidden');
      tierBadgeEl.textContent = `Enhanced AI ready (${from} → ${to})`;
    },
  });
  registerLocalizerBoot(bootPromise);
  autoInit();

  try {
    const ai = await bootPromise;
    const modeLabel = mode === 'self-hosted' ? 'self-hosted micro' : `${ai.activeTier} tier`;
    setStatus(`Ready — running on ${modeLabel}`, true);
    enableChat();

    chatFormEl.addEventListener('submit', (event) => {
      event.preventDefault();
      const prompt = chatInputEl.value.trim();
      if (!prompt) return;
      chatInputEl.value = '';
      void runChat(ai, prompt);
    });
  } catch (error) {
    setErrorStatus(error instanceof Error ? error.message : 'Failed to start local AI');
    console.error('[Localizer demo]', error);
  }
}

async function runChat(ai: Localizer, prompt: string): Promise<void> {
  appendMessage('you', prompt);
  const replyLine = appendMessage('assistant', '');
  const replyText = replyLine.querySelector('.chat-text')!;

  chatInputEl.disabled = true;
  chatSubmitEl.disabled = true;

  try {
    for await (const chunk of ai.chat.stream(prompt, {
      system: CHAT_SYSTEM,
      maxTokens: 128,
      temperature: 0.3,
    })) {
      replyText.textContent += chunk;
      chatLogEl.scrollTop = chatLogEl.scrollHeight;
    }
  } catch (error) {
    replyText.textContent = error instanceof Error ? error.message : 'Something went wrong.';
  } finally {
    chatInputEl.disabled = false;
    chatSubmitEl.disabled = false;
    chatInputEl.focus();
  }
}

void boot();
