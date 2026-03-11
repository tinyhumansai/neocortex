import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import { analyzeConversation, askQuestion } from '../services/ai-engine';
import { extractTextFromScreen, captureScreen } from '../services/screen-capture';
import type { TranscriptSegment } from '../../shared/types';

// In-memory transcript buffer per session
let sessionTranscript: TranscriptSegment[] = [];
let currentSessionId = `session-${Date.now()}`;
let currentMode: 'meeting' | 'interview' | 'sales' = 'meeting';
let latestScreenContext: string = '';

export function getSessionTranscript(): TranscriptSegment[] {
    return sessionTranscript;
}

export function setSessionMode(mode: 'meeting' | 'interview' | 'sales'): void {
    currentMode = mode;
}

export function resetSession(): void {
    currentSessionId = `session-${Date.now()}`;
    sessionTranscript = [];
}

// Append to session buffer directly
export function appendTranscript(segment: TranscriptSegment): void {
    sessionTranscript.push(segment);
    // Keep only last 200 segments to avoid memory growth
    if (sessionTranscript.length > 200) sessionTranscript = sessionTranscript.slice(-200);
}

export function setLatestScreenContext(text: string): void {
    latestScreenContext = text;
}

export async function generateMeetingSummary(): Promise<void> {
    if (sessionTranscript.length === 0) return;
    console.log('[IPC:AI] Generating automatic meeting summary...');
    BrowserWindow.getAllWindows().forEach((win) => {
        // Trigger the frontend to open the question stream UI
        win.webContents.send(IPC_CHANNELS.QUESTION_STREAM, { token: '\n\n**MEETING SUMMARY:**\n', isDone: false });
    });
    await askQuestion("The meeting has just ended. Please generate a concise, structured summary highlighting key takeaways, decisions made, and action items. Factor in the screen context if relevant.", sessionTranscript, (token) => {
        BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send(IPC_CHANNELS.QUESTION_STREAM, token);
        });
    });
}

export function registerAIIPC(): void {
    // Trigger analysis manually
    ipcMain.on(IPC_CHANNELS.ANALYZE_NOW, async () => {
        console.log('[IPC:AI] Analyzing...');

        // If we have cached background OCR, use it instead of blocking
        let screenText = latestScreenContext;
        if (!screenText) {
            screenText = await extractTextFromScreen().catch(() => '');
        }

        const sender = BrowserWindow.getAllWindows()[0];

        const result = await analyzeConversation({
            transcript: sessionTranscript,
            screenText,
            mode: currentMode,
            sessionId: currentSessionId,
            onStream: (token) => {
                BrowserWindow.getAllWindows().forEach((win) => {
                    win.webContents.send(IPC_CHANNELS.ANALYSIS_STREAM, token);
                });
            },
        });

        BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send(IPC_CHANNELS.ANALYSIS_RESULT, result);
        });
    });

    // Ask a freeform question
    ipcMain.on(IPC_CHANNELS.ASK_QUESTION, async (_event, question: string) => {
        console.log('[IPC:AI] Question:', question);
        await askQuestion(question, sessionTranscript, (token) => {
            BrowserWindow.getAllWindows().forEach((win) => {
                win.webContents.send(IPC_CHANNELS.QUESTION_STREAM, token);
            });
        });
    });

    // Take a screenshot and return base64
    ipcMain.handle(IPC_CHANNELS.TAKE_SCREENSHOT, async () => {
        return captureScreen();
    });
}
