/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;

  /** Set to `"false"` to use only browser Speech Synthesis + Web Speech API (no Puter). */
  readonly VITE_USE_PUTER_AI?: string;

  /** Set to `"true"` to use Puter cloud STT (Whisper) instead of the browser Web Speech API. */
  readonly VITE_STT_PUTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
