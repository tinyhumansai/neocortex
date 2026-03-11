import { desktopCapturer, BrowserWindow } from 'electron';
import { extractTextFromScreen } from './screen-capture';

let detectionInterval: NodeJS.Timeout | null = null;
let ocrInterval: NodeJS.Timeout | null = null;
let lastKnownMeetingTitle = '';
let isMeetingActive = false;

// We'll emit events to main.ts or ai.ipc.ts
type MeetingStateCallback = (isActive: boolean, title: string) => void;
type OcrCallback = (text: string) => void;

let onMeetingStateChange: MeetingStateCallback | null = null;
let onOcrResult: OcrCallback | null = null;

export function setMeetingListeners(
    stateCb: MeetingStateCallback,
    ocrCb: OcrCallback
) {
    onMeetingStateChange = stateCb;
    onOcrResult = ocrCb;
}

export function startMeetingDetection() {
    if (detectionInterval) return;

    console.log('[MeetingDetector] Starting background detection...');

    // Poll every 5 seconds for meeting windows
    detectionInterval = setInterval(async () => {
        try {
            const sources = await desktopCapturer.getSources({ types: ['window'] });

            // Look for common meeting titles
            // Google Meet: "Meet - abc-defg-hij"
            // Zoom: "Zoom Meeting"
            // Teams: "Microsoft Teams meeting"
            const meetingWindow = sources.find(s => {
                const title = s.name.toLowerCase();
                return title.includes('meet - ') || title.includes('zoom meeting') || title.includes('teams meeting');
            });

            if (meetingWindow) {
                if (!isMeetingActive) {
                    isMeetingActive = true;
                    lastKnownMeetingTitle = meetingWindow.name;
                    console.log(`[MeetingDetector] Detected meeting: ${lastKnownMeetingTitle}`);
                    if (onMeetingStateChange) onMeetingStateChange(true, lastKnownMeetingTitle);
                    startOcrPolling();
                }
            } else {
                if (isMeetingActive) {
                    isMeetingActive = false;
                    lastKnownMeetingTitle = '';
                    console.log('[MeetingDetector] Meeting ended.');
                    if (onMeetingStateChange) onMeetingStateChange(false, '');
                    stopOcrPolling();
                }
            }
        } catch (err) {
            console.error('[MeetingDetector] Error checking windows:', err);
        }
    }, 5000);
}

function startOcrPolling() {
    if (ocrInterval) return;
    console.log('[MeetingDetector] Starting OCR polling...');
    // Poll OCR every 15 seconds during a meeting
    ocrInterval = setInterval(async () => {
        try {
            const text = await extractTextFromScreen();
            if (text && onOcrResult) {
                onOcrResult(text);
            }
        } catch (err) {
            console.error('[MeetingDetector] OCR error:', err);
        }
    }, 15000);
}

function stopOcrPolling() {
    if (ocrInterval) {
        clearInterval(ocrInterval);
        ocrInterval = null;
    }
}
