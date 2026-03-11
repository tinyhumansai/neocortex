import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import {
    startTranscription,
    stopTranscription,
    appendAudioChunk,
    setTranscriptCallback,
} from '../services/transcription';
import { appendTranscript } from './ai.ipc';

export function registerAudioIPC(): void {
    // Set up transcript callback to broadcast to all windows and save to AI memory
    setTranscriptCallback((segment) => {
        appendTranscript(segment);
        BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send(IPC_CHANNELS.TRANSCRIPT_CHUNK, segment);
        });
    });

    ipcMain.on(IPC_CHANNELS.START_RECORDING, () => {
        console.log('[IPC:Audio] Start recording');
        startTranscription();
    });

    ipcMain.on(IPC_CHANNELS.STOP_RECORDING, () => {
        console.log('[IPC:Audio] Stop recording');
        stopTranscription();
    });

    // Receive raw audio chunks from renderer (MediaRecorder API)
    ipcMain.on(IPC_CHANNELS.AUDIO_CHUNK, (_event, chunk: Buffer) => {
        appendAudioChunk(chunk);
    });
}
