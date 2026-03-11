import Store from 'electron-store';
import type { AppSettings } from '../../shared/types';

const DEFAULT_SETTINGS: AppSettings = {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    aiProvider: (process.env.AI_PROVIDER as 'openai' | 'gemini') || 'openai',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    whisperModel: process.env.WHISPER_MODEL || 'whisper-1',
    enableScreenCapture: true,
    enableOcr: false,
    overlayShortcut: 'CommandOrControl+Shift+Space',
    askAiShortcut: 'CommandOrControl+Shift+A',
    overlayPosition: { x: 0, y: 0 },
    overlayWidth: 420,
    theme: 'system',
};

class SettingsStore {
    private store: Store<AppSettings>;

    constructor() {
        this.store = new Store<AppSettings>({
            name: 'settings',
            defaults: DEFAULT_SETTINGS,
            encryptionKey: 'va-settings-key',
        });
    }

    get(): AppSettings {
        const saved = this.store.store;
        return {
            ...saved,
            // Prefer persisted values, but fall back to env vars when fields are empty.
            openaiApiKey: saved.openaiApiKey || process.env.OPENAI_API_KEY || '',
            geminiApiKey: saved.geminiApiKey || process.env.GEMINI_API_KEY || '',
            aiProvider: saved.aiProvider || ((process.env.AI_PROVIDER as 'openai' | 'gemini') || 'openai'),
            openaiModel: saved.openaiModel || process.env.OPENAI_MODEL || 'gpt-4o',
            geminiModel: saved.geminiModel || process.env.GEMINI_MODEL || 'gemini-1.5-flash',
            whisperModel: saved.whisperModel || process.env.WHISPER_MODEL || 'whisper-1',
        };
    }

    save(partial: Partial<AppSettings>): void {
        Object.entries(partial).forEach(([key, value]) => {
            this.store.set(key as keyof AppSettings, value as never);
        });
    }

    reset(): void {
        this.store.clear();
    }
}

export const settingsStore = new SettingsStore();
