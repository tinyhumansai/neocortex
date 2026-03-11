// Safe wrapper for window.videoAgent — gracefully handles running outside Electron (e.g., browser dev)

const isElectron =
    typeof window !== 'undefined' && typeof window.videoAgent !== 'undefined';

export function getIPC() {
    if (!isElectron) {
        console.warn('[IPC] Not running in Electron — IPC calls will be no-ops');
        return null;
    }
    return window.videoAgent;
}

export function ipc() {
    return window.videoAgent;
}
