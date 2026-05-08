/** OpenAI-backed voice (Whisper + TTS) via /api/* — see .env.example */
export function isOpenAiVoiceEnabled(): boolean {
  const v = import.meta.env.VITE_USE_OPENAI_VOICE;
  return v === 'true' || v === '1';
}

/** Optional absolute origin if the API is hosted separately (must allow CORS for this app). */
export function voiceApiOrigin(): string {
  return (import.meta.env.VITE_VOICE_API_URL ?? '').replace(/\/$/, '');
}

export function transcribeEndpoint(): string {
  const o = voiceApiOrigin();
  return o ? `${o}/api/transcribe` : '/api/transcribe';
}

export function ttsEndpoint(): string {
  const o = voiceApiOrigin();
  return o ? `${o}/api/tts` : '/api/tts';
}
