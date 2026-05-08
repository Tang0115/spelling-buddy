import type { Connect } from 'vite';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { transcribeAudioBuffer, synthesizeSpeechToBuffer } from '../server/openai-voice-core';

function readBody(req: Connect.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Dev-only: handles POST /api/transcribe and /api/tts using OPENAI_API_KEY from .env.local */
export function openaiVoiceDevPlugin(): Plugin {
  return {
    name: 'openai-voice-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathOnly = req.url?.split('?')[0] ?? '';
        if (pathOnly !== '/api/transcribe' && pathOnly !== '/api/tts') {
          next();
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const env = loadEnv(server.config.mode, process.cwd(), '');
        const apiKey = env.OPENAI_API_KEY;
        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error:
                'OPENAI_API_KEY is missing. Add it to .env.local (no VITE_ prefix) for local voice.',
            }),
          );
          return;
        }

        try {
          if (pathOnly === '/api/transcribe') {
            const raw = await readBody(req);
            const body = JSON.parse(raw.toString('utf8')) as { audioBase64?: string; mimeType?: string };
            if (!body.audioBase64) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing audioBase64' }));
              return;
            }
            const buffer = Buffer.from(body.audioBase64, 'base64');
            const text = await transcribeAudioBuffer(buffer, body.mimeType ?? 'audio/webm', apiKey);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ text }));
            return;
          }

          const raw = await readBody(req);
          const body = JSON.parse(raw.toString('utf8')) as { text?: string };
          if (!body.text?.trim()) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing text' }));
            return;
          }
          const audio = await synthesizeSpeechToBuffer(body.text, apiKey);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Cache-Control', 'no-store');
          res.end(audio);
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Request failed';
          console.warn(`[openai-voice-dev] ${pathOnly}: ${message}`);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}
