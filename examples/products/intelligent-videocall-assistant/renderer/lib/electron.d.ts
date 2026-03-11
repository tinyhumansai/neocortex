// Type declarations for the window.videoAgent IPC bridge
// This mirrors electron/preload.ts so TypeScript knows the shape in the renderer.

import type {
    AppSettings,
    TranscriptSegment,
    AnalysisResult,
    KBDocument,
    Session,
    InterviewReport,
    StreamToken,
    RubricItem,
} from '@shared/types';

interface VideoAgentAPI {
    // Audio / Recording
    startRecording: () => void;
    stopRecording: () => void;
    sendAudioChunk: (chunk: ArrayBuffer) => void;
    onTranscriptChunk: (cb: (segment: TranscriptSegment) => void) => () => void;

    analyzeNow: () => void;
    onAnalysisResult: (cb: (result: AnalysisResult) => void) => () => void;
    onAnalysisStream: (cb: (token: StreamToken) => void) => () => void;
    askQuestion: (question: string) => void;
    onQuestionStream: (cb: (token: StreamToken) => void) => () => void;
    onTriggerAnalyze: (cb: () => void) => () => void;
    onMeetingStatus: (cb: (status: { active: boolean; title: string }) => void) => () => void;

    uploadDocument: (filePath: string, fileName: string) => Promise<KBDocument>;
    listDocuments: () => Promise<KBDocument[]>;
    deleteDocument: (id: string) => Promise<void>;

    startInterview: (jobDescription: string, rubric: RubricItem[]) => Promise<string>;
    getInterviewReport: (sessionId: string) => Promise<InterviewReport>;

    getSettings: () => Promise<AppSettings>;
    saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;

    toggleOverlay: () => void;
    openMainWindow: () => void;
    getSessions: () => Promise<Session[]>;
    getSession: (id: string) => Promise<Session | null>;

    takeScreenshot: () => Promise<string>;
}

declare global {
    interface Window {
        videoAgent: VideoAgentAPI;
    }
}

export { };
