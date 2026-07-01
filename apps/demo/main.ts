import { Localizer, autoInit } from 'localizer';

const statusTextEl = document.querySelector<HTMLSpanElement>('#status-text')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const tierBadgeEl = document.querySelector<HTMLDivElement>('#tier-badge')!;
const chatLogEl = document.querySelector<HTMLDivElement>('#chat-log')!;
const chatFormEl = document.querySelector<HTMLFormElement>('#chat-form')!;
const chatInputEl = document.querySelector<HTMLInputElement>('#chat-input')!;
const chatSubmitEl = document.querySelector<HTMLButtonElement>('#chat-submit')!;

let placeholderRemoved = false;

function setStatus(text: string, ready = false): void {
  statusTextEl.textContent = text;
  statusEl.classList.toggle('ready', ready);
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

async function boot(): Promise<void> {
  setStatus('Starting local AI…');

  try {
    const ai = await Localizer.create({
      preset: 'basic',
      loadMicroAtStart: true,
      upgradePolicy: 'auto',
      onProgress: (event) => {
        setStatus(`Loading ${event.tier ?? 'model'}… ${event.percent}%`);
      },
      onTierChange: ({ from, to }) => {
        tierBadgeEl.classList.remove('hidden');
        tierBadgeEl.textContent = `Enhanced AI ready (${from} → ${to})`;
      },
    });

    setStatus(`Ready — running on ${ai.activeTier} tier`, true);
    enableChat();

    chatFormEl.addEventListener('submit', (event) => {
      event.preventDefault();
      const prompt = chatInputEl.value.trim();
      if (!prompt) return;
      chatInputEl.value = '';
      void runChat(ai, prompt);
    });
  } catch (error) {
    statusEl.classList.add('error');
    setStatus(error instanceof Error ? error.message : 'Failed to start local AI');
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
    for await (const chunk of ai.chat.stream(prompt)) {
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
autoInit();
