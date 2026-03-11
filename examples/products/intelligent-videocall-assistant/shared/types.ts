// Shared types between Electron main process and Next.js renderer

export interface TranscriptSegment {
    id: string;
    speaker: 'user' | 'other' | 'unknown';
    text: string;
    timestamp: number;
    isFinal: boolean;
}

export interface AnalysisResult {
    sessionId: string;
    insights: string;
    topics: string[];
    sentiment: 'positive' | 'neutral' | 'negative';
    sentimentScore: number; // -1 to 1
    actionItems: string[];
    suggestedResponses: string[];
    kbReferences: KBReference[];
    timestamp: number;
}

export interface KBReference {
    documentId: string;
    documentName: string;
    excerpt: string;
    relevanceScore: number;
}

export interface KBDocument {
    id: string;
    name: string;
    type: 'pdf' | 'docx' | 'txt';
    size: number;
    chunkCount: number;
    uploadedAt: number;
    status: 'processing' | 'ready' | 'error';
}

export interface Session {
    id: string;
    title: string;
    mode: 'meeting' | 'interview' | 'sales';
    startedAt: number;
    endedAt?: number;
    transcript: TranscriptSegment[];
    analyses: AnalysisResult[];
    interviewReport?: InterviewReport;
}

export interface InterviewReport {
    sessionId: string;
    jobDescription: string;
    rubric: RubricItem[];
    scores: CompetencyScore[];
    biasFlags: BiasFlag[];
    overallScore: number; // 0-100
    recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no';
    summary: string;
}

export interface RubricItem {
    competency: string;
    description: string;
    weight: number; // 0-1
}

export interface CompetencyScore {
    competency: string;
    score: number; // 0-10
    evidence: string;
    questionDiversity: number; // 0-1, how varied questions were
}

export interface BiasFlag {
    type: 'gender' | 'age' | 'nationality' | 'disability' | 'appearance' | 'other';
    description: string;
    utterance: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: number;
}

export interface AppSettings {
    openaiApiKey: string;
    geminiApiKey: string;
    aiProvider: 'openai' | 'gemini';
    openaiModel: string;
    geminiModel: string;
    whisperModel: string;
    audioInputDeviceId?: string;
    enableScreenCapture: boolean;
    enableOcr: boolean;
    overlayShortcut: string;
    askAiShortcut: string;
    overlayPosition: { x: number; y: number };
    overlayWidth: number;
    theme: 'dark' | 'light' | 'system';
    activeKbId?: string;
}

// IPC Channel names
export const IPC_CHANNELS = {
    // Audio
    START_RECORDING: 'audio:start',
    STOP_RECORDING: 'audio:stop',
    AUDIO_CHUNK: 'audio:chunk',
    TRANSCRIPT_CHUNK: 'transcript:chunk',

    // AI
    ANALYZE_NOW: 'ai:analyze',
    ANALYSIS_RESULT: 'ai:result',
    ANALYSIS_STREAM: 'ai:stream',
    ASK_QUESTION: 'ai:ask',
    QUESTION_STREAM: 'ai:question-stream',

    // Knowledge Base
    KB_UPLOAD: 'kb:upload',
    KB_LIST: 'kb:list',
    KB_DELETE: 'kb:delete',
    KB_STATUS: 'kb:status',

    // Interview
    INTERVIEW_START: 'interview:start',
    INTERVIEW_SCORE: 'interview:score',
    INTERVIEW_REPORT: 'interview:report',

    // App
    GET_SETTINGS: 'app:get-settings',
    SAVE_SETTINGS: 'app:save-settings',
    TOGGLE_OVERLAY: 'app:toggle-overlay',
    GET_SESSIONS: 'app:get-sessions',
    GET_SESSION: 'app:get-session',
    OPEN_MAIN_WINDOW: 'app:open-main',

    // Screen
    TAKE_SCREENSHOT: 'screen:capture',
    SCREENSHOT_RESULT: 'screen:result',
} as const;

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export interface AudioChunk {
    data: Buffer;
    timestamp: number;
    source: 'mic' | 'system';
}

export interface StreamToken {
    token: string;
    isDone: boolean;
}
