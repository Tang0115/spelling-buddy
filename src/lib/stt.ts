// Speech-to-text: Web Speech API by default. Puter Whisper (record → cloud) if VITE_STT_PUTER=true.

import { isPuterAiEnabled } from './puter-config';

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

export const browserSttSupported = !!SpeechRecognitionImpl;

export const puterRecordingSupported =
  typeof window !== 'undefined' &&
  typeof MediaRecorder !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia;

/** True if either browser SR or Puter+recording path is available. */
export const sttSupported =
  browserSttSupported || (isPuterAiEnabled() && puterRecordingSupported);

let primePromise: Promise<boolean> | null = null;

export function primeMicrophoneForSpelling(): Promise<boolean> {
  primePromise ??= runMicrophonePrime();
  return primePromise;
}

export function retryMicrophonePrime(): Promise<boolean> {
  primePromise = runMicrophonePrime();
  return primePromise;
}

async function runMicrophonePrime(): Promise<boolean> {
  if (!sttSupported) return false;

  let micWarmed = false;
  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      micWarmed = true;
    } catch {
      // Browser speech recognition may still work; Puter-recording path needs mic later.
    }
  }

  if (browserSttSupported && SpeechRecognitionImpl) {
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

  return micWarmed;
}

export interface SpellingListener {
  onLetter: (letter: string) => void;
  onEnd: (allLetters: string[]) => void;
  onError?: (msg: string) => void;
}

function pickRecorderMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

function createMediaRecorder(stream: MediaStream): { recorder: MediaRecorder; mime: string } | null {
  const preferred = pickRecorderMime();
  if (preferred) {
    try {
      const recorder = new MediaRecorder(stream, { mimeType: preferred });
      return { recorder, mime: preferred };
    } catch {
      /* fall through */
    }
  }
  try {
    const recorder = new MediaRecorder(stream);
    const mime = recorder.mimeType || 'audio/webm';
    return { recorder, mime };
  } catch {
    return null;
  }
}

export function startListening(expectedWord: string, listener: SpellingListener): () => void {
  const wantCloudStt =
    isPuterAiEnabled() &&
    puterRecordingSupported &&
    import.meta.env.VITE_STT_PUTER === 'true';

  if (wantCloudStt) {
    return startPuterRecording(expectedWord, listener);
  }

  if (browserSttSupported && SpeechRecognitionImpl) {
    return startBrowserRecognition(expectedWord, listener);
  }

  if (isPuterAiEnabled() && puterRecordingSupported) {
    return startPuterRecording(expectedWord, listener);
  }

  listener.onError?.('Speech recognition not supported in this browser');
  return () => {};
}

function startBrowserRecognition(
  _expectedWord: string,
  listener: SpellingListener,
): () => void {
  if (!SpeechRecognitionImpl) {
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

    const letters = parseLettersEnhanced(combined, _expectedWord);

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

function startPuterRecording(expectedWord: string, listener: SpellingListener): () => void {
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  const chunks: BlobPart[] = [];
  let stopRequested = false;
  let mime = '';

  void (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      listener.onError?.('Microphone not available');
      listener.onEnd([]);
      return;
    }

    if (stopRequested) {
      stream.getTracks().forEach((t) => t.stop());
      listener.onEnd([]);
      return;
    }

    const created = createMediaRecorder(stream);
    if (!created) {
      stream.getTracks().forEach((t) => t.stop());
      listener.onError?.('Recording not supported in this browser');
      listener.onEnd([]);
      return;
    }

    recorder = created.recorder;
    mime = created.mime;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      stream?.getTracks().forEach((t) => t.stop());
      void finalizePuterTranscription(chunks, mime, expectedWord, listener);
    };

    try {
      // Timeslice helps browsers emit `dataavailable` reliably before `stop`.
      recorder.start(250);
      if (stopRequested && recorder.state === 'recording') {
        try {
          recorder.requestData?.();
        } catch {
          /* noop */
        }
        recorder.stop();
      }
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      listener.onError?.('Could not start recording');
      listener.onEnd([]);
    }
  })();

  const safeStop = () => {
    if (recorder && recorder.state === 'recording') {
      try {
        recorder.requestData?.();
      } catch {
        /* noop */
      }
      try {
        recorder.stop();
      } catch {
        listener.onEnd([]);
      }
    } else {
      stream?.getTracks().forEach((t) => t.stop());
      if (chunks.length === 0) {
        listener.onEnd([]);
      }
    }
  };

  return () => {
    stopRequested = true;
    try {
      safeStop();
    } catch {
      listener.onEnd([]);
    }
  };
}

async function finalizePuterTranscription(
  chunks: BlobPart[],
  mime: string,
  expectedWord: string,
  listener: SpellingListener,
): Promise<void> {
  if (chunks.length === 0) {
    listener.onEnd([]);
    return;
  }

  const blob = new Blob(chunks, { type: mime });

  try {
    const { puter } = await import('@heyputer/puter.js');
    const raw = await puter.ai.speech2txt(blob, {
      model: 'whisper-1',
      language: 'en',
      response_format: 'text',
      prompt:
        'The speaker is a child spelling an English word. They may say single letters (like "C" "A" "T"), the full word, or phonetic letter names. Transcribe exactly what was spoken.',
    });

    const text =
      typeof raw === 'string' ? raw : (raw as { text?: string }).text ?? String(raw ?? '');

    const letters = parseLettersEnhanced(text, expectedWord);
    for (const L of letters) {
      listener.onLetter(L);
    }
    listener.onEnd(letters);
  } catch (e) {
    console.warn('Puter speech2txt failed, try again or disable Puter:', e);
    listener.onError?.(
      'Could not transcribe in the cloud (Puter). Check mic or try the other browser speech mode.',
    );
    listener.onEnd([]);
  }
}

function parseLetters(transcript: string): string[] {
  const tokens = transcript
    .toUpperCase()
    .replace(/[.,!?;:]/g, ' ')
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

function parseLettersEnhanced(transcript: string, expectedWord: string): string[] {
  const normalized = expectedWord.toLowerCase().trim();
  const fromTokens = parseLetters(transcript);
  if (fromTokens.length > 0) return fromTokens;

  const alphaOnly = transcript.replace(/[^a-z]/gi, '').toUpperCase();
  if (normalized && alphaOnly === normalized.toUpperCase()) {
    return alphaOnly.split('');
  }

  const spaced = transcript.toUpperCase().match(/\b[A-Z]\b/g);
  if (spaced && spaced.length > 0) {
    return spaced;
  }

  const compact = transcript.replace(/[^a-z]/gi, '').toUpperCase();
  if (compact.length >= 2 && compact.length <= 32 && /^[A-Z]+$/.test(compact)) {
    if (!normalized || [...compact].every((c) => normalized.toUpperCase().includes(c))) {
      return compact.split('');
    }
  }

  return [];
}
