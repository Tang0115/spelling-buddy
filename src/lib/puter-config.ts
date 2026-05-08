/** When false, only browser Speech Synthesis + SpeechRecognition are used. */
export function isPuterAiEnabled(): boolean {
  return import.meta.env.VITE_USE_PUTER_AI !== 'false';
}
