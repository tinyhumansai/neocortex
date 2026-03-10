import debug from "debug";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { Redis } from "ioredis";
import { connectDb } from "@/lib/server/db/mongo";
import { Conversation, Message, Case } from "@/lib/server/models";
import { runCaseAgent } from "@/lib/server/agents/caseAgent";
import { buildMemoryContext } from "@/lib/server/services/memory.service";
import { requireAuth } from "@/lib/server/auth";
import { getConfig } from "@/lib/server/config";

const log = debug("app:cases:api");
const PENDING_CAPTCHA_PREFIX = "cases:pending_captcha:";

const sendMessageSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(10000),
  conversationType: z.enum(["chat", "case_search"]).optional(),
});

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) _redis = new Redis(getConfig().REDIS_URL);
  return _redis;
}

function looksLikeCaptcha(text: string): boolean {
  const t = text.trim().replace(/[^a-zA-Z0-9]/g, "");
  return t.length >= 4 && t.length <= 10 && /^[a-zA-Z0-9]+$/.test(t);
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const body = await req.json().catch(() => ({}));
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { message, conversationId: convId, conversationType } = parsed.data;
  const newConvType = conversationType ?? "chat";
  log("API called", {
    convId: convId ?? "new",
    msgLen: message.length,
    message: message.slice(0, 100),
  });
  await connectDb();

  let conversation;
  if (!convId) {
    conversation = await Conversation.create({
      userId: new mongoose.Types.ObjectId(user.id),
      model: "gpt-4o",
      type: newConvType,
      title: message.slice(0, 60) + (message.length > 60 ? "..." : ""),
    });
  } else {
    conversation = await Conversation.findOne({
      _id: convId,
      userId: new mongoose.Types.ObjectId(user.id),
      type: { $in: ["chat", "case_search"] },
    });
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
  }

  const conversationId = conversation._id.toString();

  await Message.create({
    conversationId: conversation._id,
    role: "user",
    content: message,
  });

  const history = await Message.find({ conversationId: conversation._id })
    .sort({ createdAt: 1 })
    .limit(20)
    .lean();

  const historyList = history as unknown as Array<{ role: string; content: string }>;
  const recentText = historyList
    .slice(-6)
    .map((m) => m.content)
    .filter(Boolean);

  let pendingCaptcha: { sessionId: string; cnr: string; captchaText: string } | undefined;
  if (looksLikeCaptcha(message)) {
    const key = PENDING_CAPTCHA_PREFIX + conversationId;
    const raw = await getRedis().get(key);
    if (raw) {
      try {
        const { sessionId, cnr } = JSON.parse(raw) as { sessionId: string; cnr: string };
        pendingCaptcha = { sessionId, cnr, captchaText: message.trim() };
      } catch {
        // ignore
      }
    }
  }

  const [memoryContext, casesList] = await Promise.all([
    buildMemoryContext(user.id, message, recentText),
    Case.find({ userId: new mongoose.Types.ObjectId(user.id) })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const casesContext =
    casesList.length > 0
      ? casesList
          .map(
            (c) =>
              `- CNR ${c.cnr} (fetched ${c.caseDetails?.fetchedAt ?? "unknown"}): ${(c.caseDetails?.text ?? "").slice(0, 150)}...`
          )
          .join("\n")
      : "";

  log("Context passed to agent", {
    hasMemoryContext: !!memoryContext,
    memoryContextLen: memoryContext?.length ?? 0,
    hasCasesContext: !!casesContext,
    casesCount: casesList.length,
    hasPendingCaptcha: !!pendingCaptcha,
    bookContextPreInjected: false,
  });

  const messagesForAgent = historyList.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const AGENT_TIMEOUT_MS = 90_000; // 90 seconds

  try {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("Case chat timed out. The agent took too long. Please try again.")),
        AGENT_TIMEOUT_MS
      );
    });
    const result = await Promise.race([
      runCaseAgent(
        {
          userId: user.id,
          conversationId,
          memoryContext: memoryContext || undefined,
          casesContext: casesContext || undefined,
          pendingCaptcha,
        },
        messagesForAgent
      ).finally(() => clearTimeout(timeoutId!)),
      timeoutPromise,
    ]);

    const messages = result?.messages ?? [];
    log("Agent completed", { messageCount: messages.length });
    let assistantContent = "";
    let captchaEvent: { sessionId: string; captchaImage: string } | null = null;

    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && typeof m === "object" && "content" in m && Array.isArray(m.content)) {
        const content = m.content as Array<{ type?: string; text?: string }>;
        for (const block of content) {
          if (block?.type === "text" && typeof block.text === "string") {
            assistantContent = block.text;
            break;
          }
        }
        if (assistantContent) break;
      }
      if (
        m &&
        typeof m === "object" &&
        "content" in m &&
        typeof (m as { content?: unknown }).content === "string"
      ) {
        assistantContent = (m as { content: string }).content;
        break;
      }
    }

    if (!assistantContent && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && typeof lastMsg === "object" && "content" in lastMsg) {
        const c = (lastMsg as { content?: unknown }).content;
        if (typeof c === "string") assistantContent = c;
      }
    }

    for (const m of messages) {
      if (m && typeof m === "object" && "content" in m) {
        const c = (m as { content?: unknown }).content;
        if (typeof c === "string") {
          try {
            const parsed = JSON.parse(c) as {
              message?: string;
              sessionId?: string;
              captchaImage?: string;
            };
            if (parsed.message === "CAPTCHA_NEEDED" && parsed.sessionId && parsed.captchaImage) {
              captchaEvent = { sessionId: parsed.sessionId, captchaImage: parsed.captchaImage };
              break;
            }
          } catch {
            // not json
          }
        }
      }
    }

    await Message.create({
      conversationId: conversation._id,
      role: "assistant",
      content: assistantContent || "(No response)",
    });

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };
        if (captchaEvent) {
          send({ captcha: captchaEvent });
        }
        if (assistantContent) {
          send({ delta: assistantContent });
        }
        send({ done: true, conversationId });
        controller.close();
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
  } catch (err) {
    console.error("[Cases Chat]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Case chat failed" },
      { status: 500 }
    );
  }
}
