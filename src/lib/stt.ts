type SpeechRecognitionEventLike = {
  results: SpeechRecognitionResultList;
};

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRec;

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

const SpeechRecognitionImpl =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined;

export const sttSupported = !!SpeechRecognitionImpl;

let primePromise: Promise<boolean> | null = null;

/**
 * Primes the mic and speech-recognition stack so the browser prompts once on load
 * instead of during the first “hold to spell”.
 */
export function primeMicrophoneForSpelling(): Promise<boolean> {
  primePromise ??= runMicrophonePrime();
  return primePromise;
}

export function retryMicrophonePrime(): Promise<boolean> {
  primePromise = runMicrophonePrime();
  return primePromise;
}

async function runMicrophonePrime(): Promise<boolean> {
  if (!sttSupported || !SpeechRecognitionImpl) return false;

  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      /* SR may still show its own prompt; spelling will fail if both are denied. */
    }
  }

  return await new Promise<boolean>((resolve) => {
    const rec = new SpeechRecognitionImpl();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      try {
        rec.stop();
      } catch {
        /* noop */
      }
      resolve(ok);
    };

    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      const code = e.error ?? '';
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        finish(false);
        return;
      }
      finish(true);
    };

    rec.onend = () => {
      if (!settled) finish(true);
    };

    rec.onstart = () => {
      queueMicrotask(() => finish(true));
    };

    try {
      rec.start();
    } catch {
      finish(false);
    }
  });
}

export interface SpellingListener {
  onLetter: (letter: string) => void;
  onEnd: (allLetters: string[]) => void;
  onError?: (msg: string) => void;
}

export function startListening(_expectedWord: string, listener: SpellingListener): () => void {
  if (!sttSupported || !SpeechRecognitionImpl) {
    listener.onError?.('Speech recognition not supported in this browser');
    return () => {};
  }

  const recognition = new SpeechRecognitionImpl();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;

  const heard: string[] = [];

  recognition.onresult = (event: SpeechRecognitionEventLike) => {
    let combined = '';
    for (let i = 0; i < event.results.length; i++) {
      combined += event.results[i][0].transcript + ' ';
    }

    const letters = parseLetters(combined);

    for (let i = heard.length; i < letters.length; i++) {
      heard.push(letters[i]);
      listener.onLetter(letters[i]);
    }
  };

  recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
    listener.onError?.(e.error ?? 'unknown error');
  };

  recognition.onend = () => {
    listener.onEnd(heard);
  };

  recognition.start();

  return () => {
    try {
      recognition.stop();
    } catch {
      // already stopped
    }
  };
}

function parseLetters(transcript: string): string[] {
  const tokens = transcript
    .toUpperCase()
    .replace(/[.,!?]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const letters: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t === 'DOUBLE' && tokens[i + 1]?.length === 1) {
      letters.push(tokens[i + 1], tokens[i + 1]);
      i++;
      continue;
    }

    if (t.length === 1 && /[A-Z]/.test(t)) {
      letters.push(t);
    }
  }

  return letters;
}
