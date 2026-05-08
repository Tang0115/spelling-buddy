import type { VercelRequest, VercelResponse } from '@vercel/node';
import { synthesizeSpeechToBuffer } from '../server/openai-voice-core';

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
    const body = req.body as { text?: string };
    if (!body?.text?.trim()) {
      res.status(400).json({ error: 'Missing text' });
      return;
    }
    const audio = await synthesizeSpeechToBuffer(body.text, apiKey);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(audio);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'TTS failed' });
  }
}
