import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { settingsStore } from './settings-store';
import type { TranscriptSegment } from '../../shared/types';

let audioBuffer: Buffer[] = [];
let isRecording = false;
let flushTimer: NodeJS.Timeout | null = null;
let onTranscriptCallback: ((segment: TranscriptSegment) => void) | null = null;
let segmentCounter = 0;

// Accumulate PCM chunks sent from renderer (mic audio)
export function appendAudioChunk(chunk: Buffer): void {
    if (!isRecording) return;
    console.log(`[Transcription] Received audio chunk of size: ${chunk.length} bytes`);
    audioBuffer.push(chunk);
}

export function setTranscriptCallback(cb: (segment: TranscriptSegment) => void): void {
    onTranscriptCallback = cb;
}

export function startTranscription(): void {
    isRecording = true;
    audioBuffer = [];
    scheduleFlush();
    console.log('[Transcription] Started');
}

export function stopTranscription(): void {
    isRecording = false;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    // Flush remaining
    void flushToWhisper();
    console.log('[Transcription] Stopped');
}

function scheduleFlush(): void {
    flushTimer = setTimeout(async () => {
        if (!isRecording) return;
        await flushToWhisper();
        if (isRecording) scheduleFlush();
    }, 5000); // 5-second chunks
}

async function flushToWhisper(): Promise<void> {
    if (audioBuffer.length === 0) return;

    const settings = settingsStore.get();
    const apiKey = settings.openaiApiKey;
    if (!apiKey) {
        console.warn('[Transcription] No OpenAI API key configured');
        return;
    }

    const combined = Buffer.concat(audioBuffer);
    audioBuffer = [];

    if (combined.length < 1000) return; // Too small, likely silence

    const client = new OpenAI({ apiKey });
    const tmpPath = path.join(os.tmpdir(), `va-audio-${Date.now()}.webm`);

    try {
        fs.writeFileSync(tmpPath, combined);

        const transcription = await client.audio.transcriptions.create({
            file: fs.createReadStream(tmpPath),
            model: settings.whisperModel || 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularities: ['word'],
        });

        if (transcription.text && onTranscriptCallback) {
            const segment: TranscriptSegment = {
                id: `seg-${++segmentCounter}`,
                speaker: 'unknown',
                text: transcription.text.trim(),
                timestamp: Date.now(),
                isFinal: true,
            };
            onTranscriptCallback(segment);
        }
    } catch (err) {
        console.error('[Transcription] Whisper error:', err);
    } finally {
        try { fs.unlinkSync(tmpPath); } catch { }
    }
}
