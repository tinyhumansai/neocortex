# LexAI — Legal & Tax AI Assistant

A Proof of Concept (POC) platform to integrate CA books, scraped court cases, and eCourts lookup—with a ChatGPT-style frontend. **Single Next.js app**: frontend and API run on one server and one endpoint.

## Features

- **Chat** — ChatGPT-style UI for tax, legal, and case Q&A. Answers grounded in ingested CA books, 50 scraped High Court cases, and user memory. Can fetch cases by CNR (eCourts), search books, and find relevant/similar cases.
- **Case Search** — Same agent as Chat: fetch case by CNR (with CAPTCHA), list your cases, search CA books, find relevant cases from the ingested database.
- **Tax Filings** — Multi-step ITR flow (ITR-1): personal details, income & deductions, tax summary, review & submit (submission is a stub).
- **Onboarding** — First-time users see a short onboarding before entering the app.
- **Book absorption** — Ingest PDFs from `books/`; chat uses them for citation-style guidance.
- **Case absorption** — Ingest 50 scraped High Court cases from [scraped-cases](https://github.com/Kalpu71/scraped-cases); chat finds relevant cases for user queries.

## Project Structure

- `app/` — Pages and API routes
- `lib/server/` — Server-only code (config, DB, models, auth, book/case absorption, agents)
- `lib/` — Client-safe config and API client
- `components/` — UI components
- `docs/` — [CA book sources](docs/CA_BOOK_SOURCES.md), [design overview](docs/DESIGN.md), [privacy & compliance](docs/PRIVACY_AND_COMPLIANCE.md)

## Stack

- **Runtime:** Next.js 14 (App Router)
- **Database:** MongoDB + Mongoose
- **Cache:** Redis (OAuth state, chat rate limiting)
- **Vector store:** ChromaDB (books + cases)
- **Auth:** Google OAuth, JWT
- **AI:** OpenAI API + LangChain (agent with tools)

## Quick Start

### 1. Prerequisites

- Node.js 18+
- MongoDB (local or cloud)
- Redis (local or cloud)

### 2. Install

```bash
cd /path/to/Poc
npm install
```

### 3. Environment

```bash
cp .env.local.example .env.local
# Edit .env.local: DATABASE_URL, REDIS_URL, OPENAI_API_KEY, JWT_SECRET, GOOGLE_*
```

### 4. Start Chroma (required before the app)

**Chroma must be running before you start the Next.js server.** Chat, book absorption, and case search depend on it.

```bash
# Terminal 1: start Chroma (persists to ./chroma-data)
npm run chroma
```

Leave this running. Set `CHROMA_URL=http://localhost:8000` in `.env.local`.

### 5. Start MongoDB and Redis

```bash
# macOS (Homebrew):
brew services start mongodb-community
brew services start redis
```

### 6. Run the app

```bash
# Terminal 2: run the app
npm run dev
```

Open http://localhost:3000

### 7. Ingest data (optional)

**Scraped cases (50 High Court cases):**

```bash
# Clone cases repo first
mkdir -p data
git clone https://github.com/Kalpu71/scraped-cases.git data/scraped-cases

# Set in .env.local: SCRAPED_CASES_PATH=/path/to/Poc/data/scraped-cases

# Ingest (Chroma must be running)
npm run cases:ingest
```

**CA books:** Put PDFs in `books/`, then `POST /api/books/absorb` with body `{}` or `{ "filename": "name.pdf" }`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials — see [Google OAuth](#google-oauth--client-id--secret) |
| `NEXT_PUBLIC_APP_URL` or `APP_URL` | Base URL (default: `http://localhost:3000`) |
| `NEXT_PUBLIC_BACKEND_URL` | Optional. Leave empty for same-origin. |
| `CHROMA_URL` | ChromaDB URL (e.g. `http://localhost:8000`). **Required.** Start with `npm run chroma` before the app. |
| `SCRAPED_CASES_PATH` | Path to scraped cases folder (for `npm run cases:ingest`) |
| `CASES_ABSORB_SECRET` | Optional. When set, `X-Cases-Absorb-Secret` header bypasses auth for `POST /api/cases/absorb`. |
| `ECOURTS_BASE_URL` | eCourts portal URL (default: `https://services.ecourts.gov.in/ecourtindia_v6/`) |

## Chroma — Start Before the Server

Chroma is the vector store for books and cases. **It must be running before you run `npm run dev`.**

```bash
# Terminal 1: Chroma first
npm run chroma

# Terminal 2: Then the app
npm run dev
```

Without Chroma: book absorption and case search are disabled; chat has no book/case context.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run chroma` | Start ChromaDB (run before dev) |
| `npm run cases:ingest` | Ingest scraped cases into Chroma |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting (CI) |

## Google OAuth — Client ID & Secret

### 1. Create credentials in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select an existing one
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. If prompted, configure the **OAuth consent screen** (External user type, add your email as test user)
6. Choose **Web application** as the application type
7. Add the following:

**Authorized JavaScript origins:**

```
http://localhost:3000
```

For production, add your production URL (e.g. `https://yourdomain.com`).

**Authorized redirect URIs:**

```
http://localhost:3000/api/auth/google/callback
```

For production, add (e.g. `https://yourdomain.com/api/auth/google/callback`).

8. Click **Create** — you will get a **Client ID** and **Client Secret**

### 2. Add to `.env.local`

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

Replace with the values from the Google Cloud Console.

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| GET | `/api/auth/google` | No | Start Google OAuth |
| GET | `/api/auth/google/callback` | No | OAuth callback |
| GET | `/api/auth/me` | Bearer | Current user profile |
| POST | `/api/auth/onboarding-complete` | Bearer | Mark onboarding completed |
| GET | `/api/models` | Bearer | List AI models |
| GET | `/api/conversations` | Bearer | List conversations |
| GET/PATCH/DELETE | `/api/conversations/[id]` | Bearer | Get, rename, delete conversation |
| POST | `/api/chat/message` | Bearer | Simple chat (legacy) |
| POST | `/api/cases/chat/message` | Bearer | **Main chat** — agent with tools (fetch case, search books, relevant cases) |
| GET/POST | `/api/cases/absorb` | Bearer or secret | List or ingest scraped cases |
| GET | `/api/books/absorb` | No | List PDFs in `books/` |
| POST | `/api/books/absorb` | No | Ingest PDF(s) |
| GET | `/api/books/query` | No | Query Chroma (debug) |
| GET | `/api/ecourts/captcha` | Bearer | Get eCourts CAPTCHA |
| POST | `/api/ecourts/cnr` | Bearer | Fetch case by CNR + CAPTCHA |
| POST | `/api/ecourts/analyze` | Bearer | Analyze case with AI |
| GET/POST | `/api/filings` | Bearer | List or create filing |
| GET/PATCH | `/api/filings/[id]` | Bearer | Get or update filing |
| POST | `/api/filings/[id]/submit` | Bearer | Submit filing (stub) |

## Book & Case Absorption

**Books:** PDFs in `books/` → `POST /api/books/absorb` → Chroma. Chat uses semantic search over ingested chunks.

**Cases:** Clone [scraped-cases](https://github.com/Kalpu71/scraped-cases), set `SCRAPED_CASES_PATH`, run `npm run cases:ingest`. Each case folder (CNR) needs `structured.json` and `summary.json`. Chat can then find relevant cases for user queries.

See [docs/CA_BOOK_SOURCES.md](docs/CA_BOOK_SOURCES.md) for book sources.

## Documentation

| Doc | Description |
|-----|--------------|
| [docs/CA_BOOK_SOURCES.md](docs/CA_BOOK_SOURCES.md) | Sources for CA books and official material |
| [docs/DESIGN.md](docs/DESIGN.md) | UI screens and flows |
| [docs/PRIVACY_AND_COMPLIANCE.md](docs/PRIVACY_AND_COMPLIANCE.md) | Privacy and compliance (India) |
