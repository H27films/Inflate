import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/analyze-tyre-photo', async (req: Request, res: Response) => {
    const ai = getGenAIClient();
    if (!ai) {
      res.status(500).json({
        error: 'GEMINI_API_KEY is not configured. Add it in Settings > Secrets to enable photo recognition.',
      });
      return;
    }

    const { imageBase64, mimeType, carName, recommendedFrontPsi, recommendedRearPsi } = req.body as {
      imageBase64?: string;
      mimeType?: string;
      carName?: string;
      recommendedFrontPsi?: number;
      recommendedRearPsi?: number;
    };

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Missing imageBase64 payload.' });
      return;
    }

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const safeMime = typeof mimeType === 'string' && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

    const prompt = [
      `You are analyzing a mobile photo taken by a driver using Inflate, a tyre pressure tracking app.`,
      `Active vehicle: ${carName || 'Car'} (target ${recommendedFrontPsi ?? 32} PSI front / ${recommendedRearPsi ?? 35} PSI rear).`,
      `Determine whether this photo shows a tyre pressure top-up context (e.g. a digital or analog tyre pressure gauge, service station air inflator display, car tyre valve/wheel, or dashboard TPMS screen).`,
      `Extract the numeric PSI reading if visible (convert kPa or bar to PSI if the display clearly shows kPa or bar, e.g. 220 kPa -> 32 PSI, 2.2 bar -> 32 PSI).`,
      `If multiple wheels or a general inflator/tyre check is shown without a specific wheel label, set cornerHint to "ALL".`,
      `Provide a concise, plain-language 1-sentence summary of what you recognized.`,
    ].join('\n');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: safeMime,
                data: cleanBase64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isTyrePressureContext: {
                type: Type.BOOLEAN,
                description: 'True if the photo shows a tyre, air pump, pressure gauge, inflator display, or TPMS screen.',
              },
              detectedPsi: {
                type: Type.NUMBER,
                nullable: true,
                description: 'The detected pressure in PSI (rounded to nearest integer), or null if no number is readable.',
              },
              unitDetected: {
                type: Type.STRING,
                description: 'Original pressure unit seen in the image, e.g. PSI, kPa, bar, or unknown.',
              },
              cornerHint: {
                type: Type.STRING,
                description: 'One of FL, FR, RL, RR, or ALL.',
              },
              confidence: {
                type: Type.STRING,
                description: 'high, medium, or low.',
              },
              summary: {
                type: Type.STRING,
                description: 'Short 1-sentence summary of what was recognized in the photo.',
              },
            },
            required: ['isTyrePressureContext', 'unitDetected', 'cornerHint', 'confidence', 'summary'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to analyze tyre pressure photo.';
      console.error('Gemini analyze-tyre-photo error:', err);
      res.status(502).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Inflate server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start Inflate server:', err);
  process.exit(1);
});
