import type { VercelRequest, VercelResponse } from '@vercel/node';
import { transcribeAudioBuffer } from '../server/openai-voice-core';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
    return;
  }

  try {
    const body = req.body as { audioBase64?: string; mimeType?: string };
    if (!body?.audioBase64) {
      res.status(400).json({ error: 'Missing audioBase64' });
      return;
    }
    const buffer = Buffer.from(body.audioBase64, 'base64');
    const text = await transcribeAudioBuffer(buffer, body.mimeType ?? 'audio/webm', apiKey);
    res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Transcription failed' });
  }
}
