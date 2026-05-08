// Thin wrapper around the browser's built-in speech synthesis.

export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !ttsSupported) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const preferred = voices.find(
    (v) => v.lang.startsWith('en') && /female|samantha|zira|karen|moira/i.test(v.name)
  );
  if (preferred) return preferred;

  return voices.find((v) => v.lang.startsWith('en')) ?? voices[0];
}

export function speak(text: string, opts: { rate?: number } = {}): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsSupported) return resolve();

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

export function warmUpVoices(): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsSupported) return resolve();

    if (window.speechSynthesis.getVoices().length > 0) return resolve();

    const onReady = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onReady);
      resolve();
    };
    window.speechSynthesis.addEventListener('voiceschanged', onReady);

    setTimeout(resolve, 1000);
  });
}
