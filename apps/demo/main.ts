import { Localizer, autoInit } from 'localizer';

const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const tierBadgeEl = document.querySelector<HTMLDivElement>('#tier-badge')!;
const chatLogEl = document.querySelector<HTMLDivElement>('#chat-log')!;
const chatFormEl = document.querySelector<HTMLFormElement>('#chat-form')!;
const chatInputEl = document.querySelector<HTMLInputElement>('#chat-input')!;

async function boot(): Promise<void> {
  const ai = await Localizer.create({
    preset: 'basic',
    loadMicroAtStart: true,
    upgradePolicy: 'auto',
    onProgress: (event) => {
      statusEl.textContent = `[${event.tier ?? 'app'}] ${event.status} (${event.percent}%)`;
    },
    onTierChange: ({ from, to }) => {
      tierBadgeEl.classList.remove('hidden');
      tierBadgeEl.textContent = `Enhanced AI ready: ${from} → ${to}`;
    },
  });

  statusEl.textContent = `Ready on ${ai.activeTier} tier.`;

  chatFormEl.addEventListener('submit', (event) => {
    event.preventDefault();
    const prompt = chatInputEl.value.trim();
    if (!prompt) return;
    chatInputEl.value = '';
    void runChat(ai, prompt);
  });
}

async function runChat(ai: Localizer, prompt: string): Promise<void> {
  chatLogEl.textContent += `\nYou: ${prompt}\nAssistant: `;
  try {
    for await (const chunk of ai.chat.stream(prompt)) {
      chatLogEl.textContent += chunk;
    }
  } catch (error) {
    chatLogEl.textContent += error instanceof Error ? error.message : 'Chat failed';
  }
  chatLogEl.textContent += '\n';
}

void boot();
autoInit();
