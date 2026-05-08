/** Minimal types for the Puter.js global loaded from https://js.puter.com/v2/ */
export type PuterTxt2SpeechOptions = {
  voice?: string;
  engine?: 'standard' | 'neural' | 'generative' | 'long-form';
  language?: string;
  provider?: string;
  model?: string;
  instructions?: string;
};

export type PuterSpeech2TxtOptions = {
  model?: string;
  translate?: boolean;
  language?: string;
  prompt?: string;
  provider?: string;
};

export type PuterSpeech2TxtResult = { text?: string } | string;

export type PuterGlobal = {
  ai: {
    txt2speech: (
      text: string,
      languageOrOpts?: string | PuterTxt2SpeechOptions
    ) => Promise<HTMLAudioElement>;
    speech2txt: (
      file: Blob | File,
      opts?: PuterSpeech2TxtOptions
    ) => Promise<PuterSpeech2TxtResult>;
  };
};

declare global {
  interface Window {
    puter?: PuterGlobal;
  }
}

export {};
