import { config, getBackendHeaders } from "./config";

const BASE = config.BACKEND_URL || "";
const TOKEN_KEY = "lexai_token";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function getAuthHeader(): HeadersInit {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  return { ...getBackendHeaders(), Authorization: `Bearer ${token}` };
}

export const api = {
  async getConversations() {
    const headers = getAuthHeader();
    const res = await fetch(`${BASE}/api/conversations`, { headers });
    if (!res.ok) throw new Error("Failed to load conversations");
    return res.json();
  },

  async getConversation(id: string) {
    const headers = getAuthHeader();
    const res = await fetch(`${BASE}/api/conversations/${id}`, { headers });
    if (!res.ok) throw new Error("Not found");
    return res.json();
  },

  async deleteConversation(id: string) {
    const headers = getAuthHeader();
    await fetch(`${BASE}/api/conversations/${id}`, {
      method: "DELETE",
      headers,
    });
  },

  async renameConversation(id: string, title: string) {
    const headers = getAuthHeader();
    await fetch(`${BASE}/api/conversations/${id}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  },

  async getModels() {
    const headers = getAuthHeader();
    const res = await fetch(`${BASE}/api/models`, { headers });
    return res.json();
  },

  async sendMessage(message: string, model: string, conversationId?: string): Promise<Response> {
    const headers = getAuthHeader();
    return fetch(`${BASE}/api/chat/message`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ message, model, conversationId }),
    });
  },

  // Tax filings
  async getFilings() {
    const headers = getAuthHeader();
    const res = await fetch(`${BASE}/api/filings`, { headers });
    if (!res.ok) throw new Error("Failed to load filings");
    return res.json();
  },

  async getFiling(id: string) {
    const headers = getAuthHeader();
    const res = await fetch(`${BASE}/api/filings/${id}`, { headers });
    if (!res.ok) throw new Error("Failed to load filing");
    return res.json();
  },

  async createFiling(data: { type: "ITR"; assessmentYear: string; formType?: string }) {
    const headers = getAuthHeader();
    const res = await fetch(`${BASE}/api/filings`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to create filing");
    }
    return res.json();
  },

  async updateFiling(id: string, payload: Record<string, unknown>) {
    const headers = getAuthHeader();
    const res = await fetch(`${BASE}/api/filings/${id}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
    });
    if (!res.ok) throw new Error("Failed to update filing");
    return res.json();
  },

  async submitFiling(id: string) {
    const headers = getAuthHeader();
    const res = await fetch(`${BASE}/api/filings/${id}/submit`, {
      method: "POST",
      headers,
    });
    if (!res.ok) throw new Error("Failed to submit filing");
    return res.json();
  },

  async completeOnboarding() {
    const headers = getAuthHeader();
    const res = await fetch(`${BASE}/api/auth/onboarding-complete`, {
      method: "POST",
      headers,
    });
    if (!res.ok) throw new Error("Failed to complete onboarding");
    return res.json();
  },

  // eCourts case lookup (manual CAPTCHA)
  async getEcourtsCaptcha() {
    const headers = getAuthHeader();
    const res = await fetch(`${BASE}/api/ecourts/captcha`, { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Failed to load CAPTCHA");
    return data as { sessionId: string; captchaImage: string };
  },

  async fetchEcourtsCase(params: { sessionId: string; cnr: string; captchaText: string }) {
    const headers = getAuthHeader();
    const res = await fetch(`${BASE}/api/ecourts/cnr`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Failed to fetch case details");
    return data;
  },

  async analyzeEcourtsCase(data: {
    cnr: string;
    question?: string;
    model?: string;
    caseDetails?: { text: string; fields?: Record<string, string>; fetchedAt?: string };
  }) {
    const headers = getAuthHeader();
    const res = await fetch(`${BASE}/api/ecourts/analyze`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error ?? "Failed to analyze case");
    return out;
  },

  // Case Search chat (LangChain agent) — used for both /chat and /cases
  async sendCaseMessage(
    message: string,
    conversationId?: string,
    conversationType?: "chat" | "case_search"
  ): Promise<Response> {
    const headers = getAuthHeader();
    return fetch(`${BASE}/api/cases/chat/message`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ message, conversationId, conversationType }),
    });
  },
};
