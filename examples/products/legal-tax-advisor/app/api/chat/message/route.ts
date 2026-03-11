import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDb } from "@/lib/server/db/mongo";
import { Conversation, Message } from "@/lib/server/models";
import { openai, AVAILABLE_MODELS } from "@/lib/server/openai";
import { buildSystemPrompt } from "@/lib/server/utils/systemPrompt";
import { buildMemoryContext, processAndStoreMemory } from "@/lib/server/services/memory.service";
import { getRelevantBookChunks } from "@/lib/server/services/bookAbsorption";
import { requireAuth } from "@/lib/server/auth";
import { checkChatRateLimit } from "@/lib/server/rateLimit";

const sendMessageSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(10000),
  model: z.string().default("gpt-4o"),
});

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rate = await checkChatRateLimit(ip);
  if (!rate.ok) {
    return NextResponse.json({ error: rate.message }, { status: 429 });
  }

  const body = await req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { message, model } = parsed.data;
  let conversationId: string;
  const validModel = AVAILABLE_MODELS.find((m: { id: string }) => m.id === model)?.id ?? "gpt-4o";

  await connectDb();

  let conversation;
  if (!parsed.data.conversationId) {
    conversation = await Conversation.create({
      userId: new mongoose.Types.ObjectId(user.id),
      model: validModel,
      title: message.slice(0, 60) + (message.length > 60 ? "..." : ""),
    });
    conversationId = conversation._id.toString();
  } else {
    conversation = await Conversation.findOne({
      _id: parsed.data.conversationId,
      userId: new mongoose.Types.ObjectId(user.id),
    });
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    conversationId = conversation._id.toString();
  }

  await Message.create({
    conversationId: conversation._id,
    role: "user",
    content: message,
  });

  const history = await Message.find({ conversationId: conversation._id })
    .sort({ createdAt: 1 })
    .limit(20)
    .lean();

  type HistoryItem = { role: string; content: string };
  const historyList = history as unknown as HistoryItem[];
  const recentText = historyList
    .slice(-6)
    .map((m) => m.content)
    .filter(Boolean);
  const [memoryContext, bookContext] = await Promise.all([
    buildMemoryContext(user.id, message, recentText),
    getRelevantBookChunks(message, 10),
  ]);

  console.log("memoryContext ------>", memoryContext);
  const systemPrompt = buildSystemPrompt(memoryContext, bookContext || undefined);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...historyList.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let fullAssistantResponse = "";

      try {
        const openaiStream = await openai.chat.completions.create({
          model: validModel,
          messages,
          stream: true,
          max_tokens: 4096,
          temperature: 0.3,
        });

        for await (const chunk of openaiStream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            fullAssistantResponse += delta;
            send({ delta });
          }
          if (chunk.choices[0]?.finish_reason === "stop") {
            send({ done: true, conversationId });
          }
        }

        await Message.create({
          conversationId: conversation._id,
          role: "assistant",
          content: fullAssistantResponse,
        });

        processAndStoreMemory(user.id, conversationId, message, fullAssistantResponse).catch(
          () => {}
        );
      } catch (err) {
        console.error("[Chat] Streaming error:", err);
        send({ error: "Stream failed. Please retry." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Conversation-Id": conversationId,
    },
  });
}
