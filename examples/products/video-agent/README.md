# VideoAgent

> A Cluely-like AI co-pilot for Mac & Windows — listens to your meetings, analyzes conversations using your company knowledge base, and streams real-time insights in an always-on-top glass overlay.

![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue) ![Electron](https://img.shields.io/badge/Electron-31-47848F) ![Next.js](https://img.shields.io/badge/Next.js-14-black)

---

## Features

| Feature | Description |
|---|---|
| 🪟 **Always-on-top overlay** | Transparent glass panel, invisible during screen share |
| 🎙️ **Real-time transcription** | OpenAI Whisper processes audio in 5-second chunks |
| 🤖 **Dual AI provider** | GPT-4o or Gemini 1.5 Flash — switch anytime in settings |
| 📚 **Knowledge base (RAG)** | Upload PDFs/DOCX, injected as context into every AI prompt |
| 👁️ **Screen OCR** | Vision API reads visible text for deeper context |
| 🎯 **Interview Mode** | Competency scoring, bias detection, full session report |
| ⌨️ **Global hotkeys** | Toggle overlay and trigger AI from any app |
| 📦 **Mac + Windows** | `.dmg` (Apple Silicon + Intel) and `.exe` targets |

---

## Prerequisites

- **Node.js** 20+
- **OpenAI API key** (required — for Whisper + GPT-4o)
- **Google Gemini API key** (optional — alternative analysis provider)
- **macOS 12.3+** or **Windows 10+**

### macOS: System Audio Capture

To capture audio from Zoom/Meet/Teams (not just your mic), install **BlackHole** (free):

```bash
brew install blackhole-2ch
```

Then in **System Settings → Sound**, set the output to BlackHole and create a Multi-Output Device to hear audio yourself. The app will guide you through this on first launch.

---

## Quick Start

```bash
# 1. Clone and enter the project
cd video-agent

# 2. Copy and fill in your API keys
cp .env.example .env
# Edit .env with your OPENAI_API_KEY and optionally GEMINI_API_KEY

# 3. Install all dependencies
npm install
cd renderer && npm install && cd ..

# 4. Run in development mode
npm run dev
```

This starts:
- Next.js dev server on `http://localhost:3000`
- Electron loading from that server

The overlay appears with `Cmd+Shift+Space` (Mac) or `Ctrl+Shift+Space` (Windows).

---

## Usage

### Overlay window
| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+Shift+Space` | Show/hide the overlay |
| `Cmd/Ctrl+Shift+A` | Trigger instant AI analysis |

### Recording
1. Click **Record** in the overlay control bar
2. Grant microphone permission when prompted
3. Speak — transcript appears within ~5 seconds
4. Click **Ask AI** to get analysis at any time

### Knowledge Base
1. Open **Dashboard → Knowledge Base** in the main window
2. Drag and drop PDFs, Word docs, or text files
3. Wait for embedding to complete (status turns green)
4. The KB is now automatically injected into every AI analysis

### Interview Mode
1. Open **Interview** in the sidebar
2. Paste the job description
3. Adjust the competency rubric weights
4. Click **Start Interview Session**
5. After the interview, click **End & Generate Report** for a full evaluation

---

## Build & Package

```bash
# Build for your current OS
npm run package

# Build for Mac specifically (outputs to release/)
npm run package:mac

# Build for Windows specifically
npm run package:win
```

The packaged app is fully self-contained — no Node.js required on the end machine.

---

## Project Structure

```
video-agent/
├── electron/           # Main process (Node.js + TypeScript)
│   ├── main.ts         # Window management, hotkeys, tray
│   ├── preload.ts      # Typed IPC bridge (contextBridge)
│   ├── ipc/            # IPC handler modules
│   └── services/       # Transcription, AI, KB, screen capture
├── renderer/           # Next.js 14 App Router
│   ├── app/
│   │   ├── overlay/    # The always-on-top glass panel
│   │   ├── dashboard/  # Main app dashboard
│   │   ├── knowledge-base/
│   │   ├── interview/
│   │   └── settings/
│   └── components/
├── shared/             # Shared TypeScript types + IPC channels
└── package.json
```

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | Required. Used for Whisper + GPT-4o |
| `GEMINI_API_KEY` | — | Optional. Used for Gemini analysis |
| `AI_PROVIDER` | `openai` | `openai` or `gemini` |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model for analysis |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Gemini model for analysis |
| `WHISPER_MODEL` | `whisper-1` | Whisper model for transcription |

---

## Privacy

- All audio processing happens locally — audio chunks are sent to the Whisper API and immediately deleted
- Knowledge base documents are stored locally in `~/.config/VideoAgent/kb/`
- No data is sent to any server except your configured AI provider APIs
- Screen capture can be disabled in Settings