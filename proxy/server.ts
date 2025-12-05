import express, { Request, Response } from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const openai = apiKey ? new OpenAI({ apiKey }) : null;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

if (!apiKey) {
  console.warn('Warning: OPENAI_API_KEY (or AI_API_KEY) is not set. Proxy will return 500.');
}

app.post('/chat', async (req: Request, res: Response) => {
  try {
    if (!apiKey) {
      return res.status(500).json({ error: 'API key missing on proxy.' });
    }

    const { messages, temperature = 0.4, response_format } = req.body ?? {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature,
        messages,
        response_format: response_format ?? { type: 'text' }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text || 'Upstream error' });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({ error: 'Upstream response missing content' });
    }

    return res.json({ content });
  } catch (err) {
    console.error('Proxy /chat error', err);
    return res.status(500).json({ error: 'Proxy error', detail: (err as Error).message });
  }
});

app.post('/transcribe', async (req: Request, res: Response) => {
  try {
    if (!apiKey || !openai) {
      return res.status(500).json({ error: 'API key missing on proxy.' });
    }

    const { audioBase64, mimeType } = req.body ?? {};
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'audioBase64 required' });
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const rawType = typeof mimeType === 'string' && mimeType.length ? mimeType : 'audio/webm';
    const cleanType = rawType.split(';')[0].trim().toLowerCase();
    const allowedTypes = new Set([
      'audio/webm',
      'audio/ogg',
      'audio/wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/m4a',
      'audio/flac'
    ]);
    const fileType = allowedTypes.has(cleanType) ? cleanType : 'audio/webm';
    const extension = fileType.split('/')[1] || 'webm';

    const file = await toFile(audioBuffer, `audio.${extension}`, { type: fileType });
    const response = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1'
    });

    if (!response?.text) {
      return res.status(502).json({ error: 'Upstream transcription missing text' });
    }

    return res.json({ text: response.text });
  } catch (err) {
    console.error('Proxy /transcribe error', err);
    return res.status(500).json({ error: 'Proxy error', detail: (err as Error).message });
  }
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, model });
});

app.listen(port, () => {
  console.log(`AI proxy listening on http://localhost:${port}`);
});
