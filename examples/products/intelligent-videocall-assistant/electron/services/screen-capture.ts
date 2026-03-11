import { desktopCapturer } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';


export async function captureScreen(): Promise<string> {
    const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
    });

    if (sources.length === 0) return '';

    const primary = sources[0];
    const thumbnail = primary.thumbnail;
    const dataUrl = thumbnail.toDataURL();
    return dataUrl; // base64 PNG
}

export async function captureScreenToFile(): Promise<string> {
    const dataUrl = await captureScreen();
    if (!dataUrl) return '';

    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const tmpPath = path.join(os.tmpdir(), `va-screen-${Date.now()}.png`);
    fs.writeFileSync(tmpPath, Buffer.from(base64, 'base64'));
    return tmpPath;
}

// Simple OCR-lite: use Gemini Vision or GPT-4o Vision to extract text from screenshot
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { settingsStore } from './settings-store';

export async function extractTextFromScreen(): Promise<string> {
    const settings = settingsStore.get();
    if (!settings.enableOcr) return '';

    try {
        const dataUrl = await captureScreen();
        if (!dataUrl) return '';

        const base64Image = dataUrl.replace(/^data:image\/png;base64,/, '');

        if (settings.aiProvider === 'gemini' && settings.geminiApiKey) {
            const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent([
                'Extract all visible text from this screenshot. Return only the raw text, no formatting.',
                { inlineData: { mimeType: 'image/png', data: base64Image } },
            ]);
            return result.response.text();
        } else if (settings.openaiApiKey) {
            const client = new OpenAI({ apiKey: settings.openaiApiKey });
            const response = await client.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Extract all visible text from this screenshot. Return only the raw text.' },
                            { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
                        ],
                    },
                ],
                max_tokens: 500,
            });
            return response.choices[0].message.content || '';
        }
    } catch (err) {
        console.error('[ScreenCapture] OCR error:', err);
    }

    return '';
}
