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

/** iPhone / iPad / iPod Safari (and iPadOS desktop UA). */
function isAppleMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const appleMobile = isAppleMobile();

  if (appleMobile && en.length > 0) {
    const enhanced = en.find((v) => /enhanced|premium|improved/i.test(v.name));
    if (enhanced) return enhanced;

    const natural = en.find((v) =>
      /samantha|allison|aaron|nicky|jamie|ellie|daniel|melina|flo|fred|shelley|susan/i.test(
        v.name,
      ),
    );
    if (natural) return natural;

    const notCompact = en.find((v) => !/compact|speech\s*synthesis|robo/i.test(v.name));
    if (notCompact) return notCompact;
  }

  const preferred = voices.find(
    (v) => v.lang.startsWith('en') && /female|samantha|zira|karen|moira/i.test(v.name),
  );
  if (preferred) return preferred;

  return voices.find((v) => v.lang.startsWith('en')) ?? voices[0];
}

function defaultBrowserRate(explicit?: number): number {
  if (explicit !== undefined) return explicit;
  // iOS often uses a harsher default engine; slower rate reads more naturally for kids.
  return isAppleMobile() ? 0.66 : 0.85;
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

async function speakWithBrowser(text: string, opts: { rate?: number }): Promise<void> {
  if (!('speechSynthesis' in window)) return;

  await warmUpVoices();

  await new Promise<void>((resolve) => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = pickVoice();
    utterance.rate = defaultBrowserRate(opts.rate);
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

    // Safari (especially iOS) often returns an empty list until getVoices() runs once or `voiceschanged` fires.
    void window.speechSynthesis.getVoices();
    if (window.speechSynthesis.getVoices().length > 0) return resolve();

    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done);
      resolve();
    };
    window.speechSynthesis.addEventListener('voiceschanged', done);

    const maxWait = isAppleMobile() ? 1800 : 1000;
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', done);
      void window.speechSynthesis.getVoices();
      resolve();
    }, maxWait);
  });
}
