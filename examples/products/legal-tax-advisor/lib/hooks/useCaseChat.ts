"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Message } from "@/types";

export type CaseMessage = Message & {
  captcha?: { sessionId: string; captchaImage: string };
};

const STREAM_THROTTLE_MS = 80;

export function useCaseChat(
  initialConversationId?: string,
  defaultConversationType: "chat" | "case_search" = "chat"
) {
  const { signOut } = useAuth();
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [loading, setLoading] = useState(!!initialConversationId);

  useEffect(() => {
    if (!initialConversationId) {
      setLoading(false);
      return;
    }
    api
      .getConversation(initialConversationId)
      .then((conv) => {
        const msgs = (conv.messages ?? []).map(
          (m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          })
        );
        setMessages(msgs);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [initialConversationId]);
  const streamBufferRef = useRef("");
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushStream = useCallback((assistantId: string) => {
    const delta = streamBufferRef.current;
    streamBufferRef.current = "";
    streamTimeoutRef.current = null;
    if (!delta) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m))
    );
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: CaseMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
      };
      setMessages((prev) => [...prev, userMsg]);

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);
      setIsStreaming(true);
      streamBufferRef.current = "";
      streamTimeoutRef.current = null;

      try {
        const convType = conversationId ? undefined : defaultConversationType;
        const response = await api.sendCaseMessage(content, conversationId, convType);
        const newConvId = response.headers.get("X-Conversation-Id");
        if (newConvId && !conversationId) setConversationId(newConvId);

        if (!response.ok) {
          if (response.status === 401) {
            signOut();
            throw new Error("Please sign in to continue");
          }
          const errBody = await response.json().catch(() => ({}));
          const errMsg =
            (errBody as { error?: string })?.error ?? "Failed to get response. Please try again.";
          throw new Error(errMsg);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let captchaEvent: { sessionId: string; captchaImage: string } | null = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6);
            try {
              const event = JSON.parse(json);
              if (event.captcha) {
                captchaEvent = event.captcha;
              }
              if (event.delta) {
                streamBufferRef.current += event.delta;
                if (!streamTimeoutRef.current) {
                  streamTimeoutRef.current = setTimeout(
                    () => flushStream(assistantId),
                    STREAM_THROTTLE_MS
                  );
                }
              }
              if (event.done) {
                if (event.conversationId && !conversationId) {
                  setConversationId(event.conversationId);
                }
              }
            } catch {
              // ignore parse errors
            }
          }
        }

        if (streamTimeoutRef.current) {
          clearTimeout(streamTimeoutRef.current);
          streamTimeoutRef.current = null;
        }
        flushStream(assistantId);

        if (captchaEvent) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, captcha: captchaEvent ?? undefined } : m
            )
          );
        }
      } catch (err) {
        console.error("[Case Chat] Stream error:", err);
        const errMsg =
          err instanceof Error ? err.message : "Failed to get response. Please try again.";
        if (errMsg.includes("sign in") || errMsg.includes("Not authenticated")) {
          signOut();
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: errMsg } : m))
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [conversationId, defaultConversationType, flushStream]
  );

  return {
    messages,
    setMessages,
    isStreaming,
    conversationId,
    sendMessage,
    loading,
  };
}
