# Main UI Screens — Design Overview

This document describes the main screens of LexAI as implemented (ChatGPT-style UI, dashboard-like home, and onboarding), aligned with the POC scope.

---

## 1. ChatGPT-style Chat

**Routes:** `/chat`, `/chat/[id]`

- **Layout**: Left sidebar (collapsible on mobile) with app title, **Chat** and **Tax Filings** nav, “New chat” action, and conversation history. Main area is the conversation thread with messages and a fixed input at the bottom.
- **Behaviour**: Users can start a new chat or open an existing conversation. Messages stream in real time. Model selector in the input bar. Empty state shows “Welcome to LexAI” and a short tagline.
- **Tailoring**: Answers are grounded in ingested CA books and user memory; tone and citations are tuned for Indian tax and legal guidance.

---

## 2. Dashboard-like Home

**Routes:** `/` (redirects), `/chat` (primary post-login home)

- **Concept**: The “dashboard” is the **Chat** view: the first place users land after login (or after onboarding). The sidebar provides:
  - **Chat** — switch to conversation list and current chat.
  - **Tax Filings** — go to the filings list to start or continue an ITR.
- **No separate dashboard route**: The chat page plus sidebar acts as the main hub; Tax Filings is one click away. A dedicated dashboard route (e.g. tiles for “New chat”, “Start filing”, “Recent”) can be added later if needed.

---

## 3. Onboarding

**Route:** `/onboarding`

- **When**: Shown only to **new users** who have not completed onboarding (tracked by `onboardingCompletedAt` on the user). After login, such users are redirected from `/chat` (or `/filings`) to `/onboarding`.
- **Flow**: Multi-step screen (no sidebar):
  1. **Welcome** — What LexAI is (Legal & Tax Assistant for India, backed by CA material).
  2. **Chat** — Ask tax questions and get guidance from chat.
  3. **Tax Filings** — Use the Tax Filings section to file ITR step-by-step.
- **Completion**: “Get started” marks onboarding complete via `POST /api/auth/onboarding-complete` and redirects to `/chat`. Returning users skip onboarding.

---

## 4. Tax Filings

**Routes:** `/filings`, `/filings/new`, `/filings/[id]`, `/filings/[id]/edit`

- **List** (`/filings`): Lists the user’s filings (draft/submitted, AY, reference). “Start new filing” goes to `/filings/new`.
- **New** (`/filings/new`): Choose assessment year (e.g. AY 2025-26), then create a draft and go to edit.
- **Edit** (`/filings/[id]/edit`): Multi-step ITR-1-style form (personal details → income & deductions → tax summary → review & submit). Drafts can be saved and continued.
- **Detail** (`/filings/[id]`): Read-only view for a submitted filing (summary and reference number).

Same sidebar as chat (Chat + Tax Filings) so users can switch between chat and filings without losing context.

---

## 5. Login and OAuth

**Routes:** `/login`, `/oauth-callback`

- **Login**: Centred card with Google sign-in; error message shown when present (e.g. OAuth error).
- **Callback**: Handles redirect from Google, stores token, then redirects to `/chat` (from there, un-onboarded users are sent to `/onboarding`).

---

## Sketches / Wireframes

The above describes the **implemented** screens. For formal wireframes or mockups:

- **Chat**: Sidebar (logo, Chat | Tax Filings, New chat, conversation list) + main area (message list + input bar). Similar to ChatGPT layout.
- **Onboarding**: Full-screen card with step indicator dots, title, short copy, and Back / Next or “Get started”.
- **Filings list**: Page title, “Start new filing” button, list of cards (form type, AY, status, date).
- **Filing form**: Stepper (Personal → Income & deductions → Tax summary → Review & submit), form fields per step, Next/Back and Submit.

These can be drawn in Figma, Mural, or on paper and linked here for future reference.
