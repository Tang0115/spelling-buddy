/** Shared OpenAI Audio API calls (Whisper + TTS). Used by Vercel routes and the Vite dev middleware. */

function formatOpenAiAudioError(status: number, bodyText: string): string {
  try {
    const j = JSON.parse(bodyText) as {
      error?: { message?: string; code?: string; type?: string };
    };
    const code = j.error?.code ?? j.error?.type;
    const msg = j.error?.message;
    if (status === 429 && (code === 'insufficient_quota' || /quota|billing/i.test(msg ?? ''))) {
      return (
        'OpenAI quota or billing issue (429). Add a payment method or check limits: ' +
        'https://platform.openai.com/account/billing'
      );
    }
    if (msg) return `OpenAI audio API (${status}): ${msg}`;
  } catch {
    /* body not JSON */
  }
  if (bodyText.length > 200) return `OpenAI audio API (${status}): ${bodyText.slice(0, 200)}…`;
  return `OpenAI audio API (${status}): ${bodyText || String(status)}`;
}

const SPELLING_PROMPT =
  'The speaker is a child spelling an English word. They may say single letters (like "C" "A" "T"), the full word, or phonetic letter names. Transcribe exactly what was spoken.';

function pickExtension(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  return 'webm';
}

export async function transcribeAudioBuffer(
  audioBuffer: Buffer,
  mimeType: string,
  apiKey: string,
): Promise<string> {
  const form = new FormData();
  const u8 = new Uint8Array(audioBuffer);
  const blob = new Blob([u8], { type: mimeType || 'audio/webm' });
  form.append('file', blob, `recording.${pickExtension(mimeType)}`);
  form.append('model', 'whisper-1');
  form.append('language', 'en');
  form.append('prompt', SPELLING_PROMPT);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(formatOpenAiAudioError(response.status, err));
  }

  const data = (await response.json()) as { text?: string };
  return (data.text ?? '').trim();
}

export async function synthesizeSpeechToBuffer(text: string, apiKey: string): Promise<Buffer> {
  const trimmed = text.trim().slice(0, 4096);
  if (!trimmed) return Buffer.alloc(0);

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice: 'alloy',
      input: trimmed,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(formatOpenAiAudioError(response.status, err));
  }

  return Buffer.from(await response.arrayBuffer());
}
