// Text-to-speech: Puter.js (consistent neural voice) with fallback to browser Speech Synthesis.

import { isPuterAiEnabled } from './puter-config';

export const ttsSupported =
  typeof window !== 'undefined' &&
  ('speechSynthesis' in window || isPuterAiEnabled());

let puterAudio: HTMLAudioElement | null = null;

const PUTER_TTS_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const preferred = voices.find(
    (v) => v.lang.startsWith('en') && /female|samantha|zira|karen|moira/i.test(v.name),
  );
  if (preferred) return preferred;

  return voices.find((v) => v.lang.startsWith('en')) ?? voices[0];
}

async function speakWithPuter(text: string): Promise<void> {
  const { puter } = await import('@heyputer/puter.js');
  puterAudio?.pause();
  const audio = await puter.ai.txt2speech(text.trim(), {
    voice: 'Joanna',
    engine: 'neural',
    language: 'en-US',
  });
  puterAudio = audio;
  await new Promise<void>((resolve) => {
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    void audio.play().catch(() => resolve());
    setTimeout(resolve, 120_000);
  });
  if (puterAudio === audio) {
    puterAudio = null;
  }
}

function speakWithBrowser(text: string, opts: { rate?: number }): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = pickVoice();
    utterance.rate = opts.rate ?? 0.85;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}

export function speak(text: string, opts: { rate?: number } = {}): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return Promise.resolve();

  if (isPuterAiEnabled()) {
    return withTimeout(speakWithPuter(trimmed), PUTER_TTS_MS, 'Puter TTS')
      .catch(() => speakWithBrowser(trimmed, opts));
  }

  return speakWithBrowser(trimmed, opts);
}

export function warmUpVoices(): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();

    if (window.speechSynthesis.getVoices().length > 0) return resolve();

    const onReady = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onReady);
      resolve();
    };
    window.speechSynthesis.addEventListener('voiceschanged', onReady);

    setTimeout(resolve, 1000);
  });
}
