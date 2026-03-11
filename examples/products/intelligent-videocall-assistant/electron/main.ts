import 'dotenv/config';
import {
    app,
    BrowserWindow,
    globalShortcut,
    ipcMain,
    Tray,
    Menu,
    nativeImage,
    screen,
    systemPreferences,
} from 'electron';
import * as path from 'path';
import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';
import { settingsStore } from './services/settings-store';
import { registerAudioIPC } from './ipc/audio.ipc';
import { registerAIIPC } from './ipc/ai.ipc';
import { registerKBIPC } from './ipc/kb.ipc';
import { IPC_CHANNELS } from '../shared/types';
import { startMeetingDetection, setMeetingListeners } from './services/meeting-detector';
import { extractTextFromScreen } from './services/screen-capture';
import { generateMeetingSummary, setLatestScreenContext } from './ipc/ai.ipc';

const isDev = !app.isPackaged;
const NEXT_PORT = 3000;

let overlayWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// ────────────────────────────────────────────────────────────────
// Next.js server management
// ────────────────────────────────────────────────────────────────

async function waitForNextServer(port: number, timeout = 30000): Promise<void> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const check = () => {
            http
                .get(`http://localhost:${port}`, () => resolve())
                .on('error', () => {
                    if (Date.now() - start > timeout) {
                        reject(new Error('Next.js server timed out'));
                    } else {
                        setTimeout(check, 500);
                    }
                });
        };
        check();
    });
}

function startNextServer(): Promise<void> {
    if (!isDev) return Promise.resolve();

    // In dev, concurrently starts the Next server. We just wait for it to be ready.
    console.log(`[App] Waiting for Next.js to be ready on port ${NEXT_PORT}...`);
    return waitForNextServer(NEXT_PORT);
}

function getRendererUrl(route: string): string {
    if (isDev) {
        return `http://localhost:${NEXT_PORT}${route}`;
    }
    // Production: load static export
    const rendererOut = path.join(process.resourcesPath, 'renderer/out');
    return `file://${path.join(rendererOut, `${route}/index.html`)}`;
}

// ────────────────────────────────────────────────────────────────
// Window creation
// ────────────────────────────────────────────────────────────────

function createOverlayWindow(): BrowserWindow {
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    const settings = settingsStore.get();
    const overlayW = settings.overlayWidth || 420;
    const defaultPos = settings.overlayPosition || { x: sw - overlayW - 20, y: sh - 600 };

    const win = new BrowserWindow({
        width: overlayW,
        height: 580,
        x: defaultPos.x,
        y: defaultPos.y,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true,
        movable: true,
        hasShadow: true,
        skipTaskbar: false,
        visualEffectState: 'active',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    win.setAlwaysOnTop(true, 'screen-saver'); // Highest level — above fullscreen apps
    win.loadURL(getRendererUrl('/overlay'));

    // Save position on move
    win.on('moved', () => {
        const [x, y] = win.getPosition();
        settingsStore.save({ overlayPosition: { x, y } });
    });

    if (isDev) win.webContents.openDevTools({ mode: 'detach' });

    return win;
}

function createMainWindow(): BrowserWindow {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        titleBarStyle: 'hiddenInset',
        vibrancy: 'under-window',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    win.loadURL(getRendererUrl('/dashboard'));
    if (isDev) win.webContents.openDevTools({ mode: 'detach' });
    return win;
}

// ────────────────────────────────────────────────────────────────
// System Tray
// ────────────────────────────────────────────────────────────────

function createTray(): void {
    const iconPath = path.join(__dirname, '../../build/tray-icon.png');
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Toggle Overlay',
            click: () => toggleOverlay(),
        },
        {
            label: 'Open Dashboard',
            click: () => {
                if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createMainWindow();
                mainWindow.show();
                mainWindow.focus();
            },
        },
        { type: 'separator' },
        {
            label: 'Quit VideoAgent',
            click: () => app.quit(),
        },
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip('VideoAgent');
    tray.on('double-click', () => toggleOverlay());
}

// ────────────────────────────────────────────────────────────────
// Hotkeys
// ────────────────────────────────────────────────────────────────

function toggleOverlay(): void {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
        overlayWindow = createOverlayWindow();
        return;
    }
    if (overlayWindow.isVisible()) {
        overlayWindow.hide();
    } else {
        overlayWindow.show();
        overlayWindow.focus();
    }
}

function registerGlobalShortcuts(): void {
    const settings = settingsStore.get();

    globalShortcut.register(settings.overlayShortcut || 'CommandOrControl+Shift+Space', () => {
        toggleOverlay();
    });

    globalShortcut.register(settings.askAiShortcut || 'CommandOrControl+Shift+A', () => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send(IPC_CHANNELS.ANALYZE_NOW);
            overlayWindow.show();
        }
    });
}

// ────────────────────────────────────────────────────────────────
// IPC: App-level handlers
// ────────────────────────────────────────────────────────────────

function registerAppIPC(): void {
    ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => settingsStore.get());

    ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, (_event, newSettings) => {
        settingsStore.save(newSettings);
        return settingsStore.get();
    });

    ipcMain.on(IPC_CHANNELS.TOGGLE_OVERLAY, () => toggleOverlay());

    ipcMain.on(IPC_CHANNELS.OPEN_MAIN_WINDOW, () => {
        if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createMainWindow();
        mainWindow.show();
        mainWindow.focus();
    });
}

// ────────────────────────────────────────────────────────────────
// App lifecycle
// ────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
    console.log('[App] Starting VideoAgent...');

    if (process.platform === 'darwin') {
        try {
            const micAccess = await systemPreferences.askForMediaAccess('microphone');
            console.log('[Permissions] Microphone access:', micAccess);
            // Optionally request screen if we need desktopCapturer explicitly
        } catch (err) {
            console.error('[Permissions] Failed to get mic access:', err);
        }
    }

    try {
        if (isDev) {
            console.log('[App] Starting Next.js dev server...');
            await startNextServer();
            console.log('[App] Next.js ready.');
        }
    } catch (err) {
        console.error('[App] Failed to start Next.js:', err);
    }

    // Register all IPC handlers
    registerAppIPC();
    registerAudioIPC();
    registerAIIPC();
    registerKBIPC();

    // Create windows
    overlayWindow = createOverlayWindow();
    mainWindow = createMainWindow();

    // Tray + shortcuts
    createTray();
    registerGlobalShortcuts();

    // Start background meeting detection
    setMeetingListeners(
        (isActive, title) => {
            if (isActive) {
                console.log(`[App] Auto-showing overlay for meeting: ${title}`);
                if (overlayWindow && !overlayWindow.isVisible()) {
                    overlayWindow.show();
                    overlayWindow.focus();
                }
                // Notify frontend to show meeting UI
                if (overlayWindow) {
                    overlayWindow.webContents.send('meeting:status', { active: true, title });
                }
            } else {
                console.log(`[App] Meeting ended.`);
                if (overlayWindow) {
                    overlayWindow.webContents.send('meeting:status', { active: false, title: '' });
                }
                // Automatically generate a summary of the meeting
                generateMeetingSummary().catch(console.error);
            }
        },
        (text) => {
            // OCR result polled during meeting fed to AI engine cache
            console.log('[App] Background OCR tick (length):', text.length);
            setLatestScreenContext(text);
        }
    );
    startMeetingDetection();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            mainWindow = createMainWindow();
        }
    });
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    // Keep app alive (tray-based) on Mac; quit on Windows/Linux
    if (process.platform !== 'darwin') app.quit();
});
