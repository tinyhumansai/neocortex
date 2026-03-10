import { createAgent } from "langchain";
import {
  getCaptchaTool,
  fetchCaseWithCaptchaTool,
  searchBooksTool,
  searchRelevantCasesTool,
  getUserCasesTool,
  type CaseToolsContext,
} from "./caseTools";

const BASE_SYSTEM_PROMPT = `You are LexAI Case Assistant, helping users with Indian court cases from eCourts.

**Scope:** You ONLY assist with case-related, legal, and tax matters. Do NOT answer questions about:
- People, celebrities, or public figures
- Political leaders or politics
- General knowledge, history, science, or other topics unrelated to law or cases
- Anything outside Indian court cases, legal concepts, or tax/CA material

For off-topic questions, politely decline and redirect: "I am LexAI Case Assistant. I can only help with Indian court cases, legal concepts, and tax matters. How can I assist you with a case or legal matter?"

**You can:**
1. Fetch case details by CNR (16 chars, e.g. DLCT010001232019) - use get_captcha first, then the user enters CAPTCHA, then fetch_case_with_captcha
2. List the user's previously fetched cases - use get_user_cases
3. Search CA books for legal/tax concepts - use search_books only when the user asks about laws, sections, compliance, deductions, GST, income tax, etc.
4. Find relevant/similar cases - use search_relevant_cases when the user asks for "relevant cases", "similar cases", "cases like mine", "precedents for my case", or wants to compare their case with others. This searches our ingested case database (50 High Court cases) for cases similar to the user's fetched cases.

**Rules:**
- When the user wants to fetch a case, call get_captcha with the CNR. Tell them to solve the CAPTCHA and enter the characters in their next message.
- When the user enters what looks like CAPTCHA (short alphanumeric), call fetch_case_with_captcha with that text.
- Only use search_books when the user explicitly asks about legal/tax concepts, code sections, or needs information from CA material. Do NOT use it for case status or procedural questions.
- When the user asks for relevant cases, similar cases, or precedents for their case, use search_relevant_cases. This returns cases from our database that are semantically similar to their fetched cases.
- Be concise. After fetching a case, summarize key points. Add disclaimer: "This is general information, not formal legal advice."
- If the user's message contains a 16-char CNR and they want to fetch, extract it and use get_captcha.`;

function buildSystemPrompt(memoryContext?: string, casesContext?: string): string {
  let prompt = BASE_SYSTEM_PROMPT;
  if (memoryContext) {
    prompt += `\n\n**User memory:**\n${memoryContext}`;
  }
  if (casesContext) {
    prompt += `\n\n**User's cases:**\n${casesContext}`;
  }
  return prompt;
}

export function createCaseSearchAgent(toolsCtx: CaseToolsContext, systemPromptOverride?: string) {
  const tools = [
    getCaptchaTool(),
    fetchCaseWithCaptchaTool(),
    searchBooksTool(),
    searchRelevantCasesTool(),
    getUserCasesTool(),
  ];

  const agent = createAgent({
    model: "openai:gpt-4o",
    tools,
    systemPrompt: systemPromptOverride ?? BASE_SYSTEM_PROMPT,
  });

  return agent;
}

export type CaseAgentConfig = {
  userId: string;
  conversationId: string;
  memoryContext?: string;
  casesContext?: string;
  pendingCaptcha?: { sessionId: string; cnr: string; captchaText: string };
};

export async function runCaseAgent(
  config: CaseAgentConfig,
  messages: Array<{ role: "user" | "assistant"; content: string }>
) {
  const toolsCtx: CaseToolsContext = {
    userId: config.userId,
    conversationId: config.conversationId,
    pendingCaptcha: config.pendingCaptcha,
  };

  const systemPrompt = buildSystemPrompt(config.memoryContext, config.casesContext);
  const agent = createCaseSearchAgent(toolsCtx, systemPrompt);

  const lcMessages = messages.map((m) =>
    m.role === "user"
      ? { role: "user" as const, content: m.content }
      : { role: "assistant" as const, content: m.content }
  );

  const result = await agent.invoke({ messages: lcMessages }, { configurable: toolsCtx });

  return result;
}
