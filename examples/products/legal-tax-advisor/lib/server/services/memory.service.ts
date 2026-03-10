import mongoose from "mongoose";
import { Memory } from "../models/Memory";
import { openai } from "../openai";

export async function saveMemory(
  userId: string,
  content: string,
  summary: string,
  sourceConvId: string
): Promise<void> {
  await Memory.create({
    userId: new mongoose.Types.ObjectId(userId),
    content,
    summary,
    sourceConvId,
  });
}

export async function recallMemories(
  userId: string,
  _query: string,
  topK: number = 6,
  options?: { recentCount?: number; enrichQuery?: string }
): Promise<string[]> {
  const uid = new mongoose.Types.ObjectId(userId);
  const recentCount = options?.recentCount ?? 2;
  const limit = topK + recentCount;

  const memories = await Memory.find({ userId: uid }).sort({ createdAt: -1 }).limit(limit).lean();

  return memories.map((m) => m.summary);
}

export async function buildMemoryContext(
  userId: string,
  currentMessage: string,
  recentMessages?: string[]
): Promise<string> {
  const enrichQuery = recentMessages?.length ? recentMessages.slice(-4).join(" ") : undefined;
  const memories = await recallMemories(userId, currentMessage, 6, {
    recentCount: 2,
    enrichQuery,
  });
  if (!memories.length) return "";

  return memories.map((m, i) => `- Memory ${i + 1}: ${m}`).join("\n");
}

const MEMORY_EXTRACTION_PROMPT = `You extract factual memories from conversation exchanges. Your goal is to capture anything the user has explicitly shared that would help in future conversations.

Extract memories for:
- Personal info: name, location, profession, company, family situation
- Legal/tax context: jurisdiction, situation, key facts, decisions, questions
- Preferences: how they like to be addressed, communication style
- Past context: "I told you X before", "from my last chat", references to prior info

Rules:
1. Output ONLY the memory as a clear, standalone fact (e.g. "User's name is Sarah", "User is based in California").
2. If the user shared something concrete, extract it. If they only asked a question or made small talk with no shareable info, output exactly: NONE
3. Do NOT output meta-commentary like "User did not specify..." or "User inquired about...". Either extract a real fact or output NONE.
4. One memory per line if multiple facts. Max 2-3 memories per exchange.`;

export async function processAndStoreMemory(
  userId: string,
  conversationId: string,
  userMessage: string,
  assistantMessage: string
): Promise<void> {
  try {
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: MEMORY_EXTRACTION_PROMPT },
        {
          role: "user",
          content: `User: ${userMessage}\nAssistant: ${assistantMessage}`,
        },
      ],
      max_tokens: 200,
    });

    const raw = summaryResponse.choices[0]?.message?.content?.trim() ?? "";
    const summary = raw.toUpperCase() === "NONE" ? "" : raw;
    if (summary) {
      const lines = summary
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 10 && !s.toUpperCase().startsWith("NONE"));
      for (const line of lines) {
        await saveMemory(userId, `${userMessage}\n---\n${assistantMessage}`, line, conversationId);
      }
    }
  } catch (err) {
    console.error("[Memory] Failed to store memory:", err);
  }
}
