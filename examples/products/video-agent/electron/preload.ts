import { contextBridge, ipcRenderer } from 'electron';
import type {
    AppSettings,
    TranscriptSegment,
    AnalysisResult,
    KBDocument,
    Session,
    InterviewReport,
    StreamToken,
} from '../shared/types';
import { IPC_CHANNELS } from '../shared/types';

// ─── Types for the exposed API ────────────────────────────────────────────────

export interface VideoAgentAPI {
    // Audio / Recording
    startRecording: () => void;
    stopRecording: () => void;
    sendAudioChunk: (chunk: ArrayBuffer) => void;
    onTranscriptChunk: (cb: (segment: TranscriptSegment) => void) => () => void;

    // AI
    analyzeNow: () => void;
    onAnalysisResult: (cb: (result: AnalysisResult) => void) => () => void;
    onAnalysisStream: (cb: (token: StreamToken) => void) => () => void;
    askQuestion: (question: string) => void;
    onQuestionStream: (cb: (token: StreamToken) => void) => () => void;
    onTriggerAnalyze: (cb: () => void) => () => void;
    onMeetingStatus: (cb: (status: { active: boolean; title: string }) => void) => () => void;

    // Knowledge Base
    uploadDocument: (filePath: string, fileName: string) => Promise<KBDocument>;
    listDocuments: () => Promise<KBDocument[]>;
    deleteDocument: (id: string) => Promise<void>;

    // Interview
    startInterview: (jobDescription: string, rubric: Array<{ competency: string; description: string; weight: number }>) => Promise<string>;
    getInterviewReport: (sessionId: string) => Promise<InterviewReport>;

    // Settings
    getSettings: () => Promise<AppSettings>;
    saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;

    // App
    toggleOverlay: () => void;
    openMainWindow: () => void;
    getSessions: () => Promise<Session[]>;
    getSession: (id: string) => Promise<Session | null>;

    // Screen
    takeScreenshot: () => Promise<string>; // base64 image
}

// ─── Helper: create a subscribable listener that returns an unsubscribe fn ───

function createListener<T>(channel: string, cb: (data: T) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, data: T) => cb(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
}

// ─── Expose API to renderer ───────────────────────────────────────────────────

contextBridge.exposeInMainWorld('videoAgent', {
    // Audio
    startRecording: () => ipcRenderer.send(IPC_CHANNELS.START_RECORDING),
    stopRecording: () => ipcRenderer.send(IPC_CHANNELS.STOP_RECORDING),
    sendAudioChunk: (chunk: ArrayBuffer) => ipcRenderer.send(IPC_CHANNELS.AUDIO_CHUNK, Buffer.from(chunk)),
    onTranscriptChunk: (cb: (s: TranscriptSegment) => void) =>
        createListener(IPC_CHANNELS.TRANSCRIPT_CHUNK, cb),

    // AI
    analyzeNow: () => ipcRenderer.send(IPC_CHANNELS.ANALYZE_NOW),
    onAnalysisResult: (cb: (r: AnalysisResult) => void) =>
        createListener(IPC_CHANNELS.ANALYSIS_RESULT, cb),
    onAnalysisStream: (cb: (t: StreamToken) => void) =>
        createListener(IPC_CHANNELS.ANALYSIS_STREAM, cb),
    askQuestion: (q: string) => ipcRenderer.send(IPC_CHANNELS.ASK_QUESTION, q),
    onQuestionStream: (cb: (t: StreamToken) => void) =>
        createListener(IPC_CHANNELS.QUESTION_STREAM, cb),
    onTriggerAnalyze: (cb: () => void) =>
        createListener(IPC_CHANNELS.ANALYZE_NOW, cb),
    onMeetingStatus: (cb: (status: { active: boolean; title: string }) => void) =>
        createListener('meeting:status', cb),

    // KB
    uploadDocument: (filePath: string, fileName: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.KB_UPLOAD, { filePath, fileName }),
    listDocuments: () => ipcRenderer.invoke(IPC_CHANNELS.KB_LIST),
    deleteDocument: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.KB_DELETE, id),

    // Interview
    startInterview: (jobDescription: string, rubric: unknown) =>
        ipcRenderer.invoke(IPC_CHANNELS.INTERVIEW_START, { jobDescription, rubric }),
    getInterviewReport: (sessionId: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.INTERVIEW_REPORT, sessionId),

    // Settings
    getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
    saveSettings: (s: Partial<AppSettings>) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, s),

    // App
    toggleOverlay: () => ipcRenderer.send(IPC_CHANNELS.TOGGLE_OVERLAY),
    openMainWindow: () => ipcRenderer.send(IPC_CHANNELS.OPEN_MAIN_WINDOW),
    getSessions: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SESSIONS),
    getSession: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_SESSION, id),

    // Screen
    takeScreenshot: () => ipcRenderer.invoke(IPC_CHANNELS.TAKE_SCREENSHOT),
} satisfies VideoAgentAPI);
