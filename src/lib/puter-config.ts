/** Cloud Puter AI (TTS + optional STT) is opt-in so production works without Puter (see VITE_USE_PUTER_AI). */
export function isPuterAiEnabled(): boolean {
  return import.meta.env.VITE_USE_PUTER_AI === 'true';
}
