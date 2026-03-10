"use client";

import { useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import type { Message } from "@/types";

const STREAM_THROTTLE_MS = 80;

export function useChat(initialConversationId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const abortRef = useRef<AbortController | null>(null);
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
    async (content: string, model: string) => {
      const userMsg: Message = {
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

      abortRef.current = new AbortController();

      try {
        const response = await api.sendMessage(content, model, conversationId);
        const newConvId = response.headers.get("X-Conversation-Id");
        if (newConvId && !conversationId) setConversationId(newConvId);

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

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
              if (event.delta) {
                streamBufferRef.current += event.delta;
                if (!streamTimeoutRef.current) {
                  streamTimeoutRef.current = setTimeout(
                    () => flushStream(assistantId),
                    STREAM_THROTTLE_MS
                  );
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
      } catch (err) {
        console.error("[Chat] Stream error:", err);
      } finally {
        setIsStreaming(false);
      }
    },
    [conversationId, flushStream]
  );

  const stopStreaming = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  return {
    messages,
    setMessages,
    isStreaming,
    conversationId,
    sendMessage,
    stopStreaming,
  };
}
