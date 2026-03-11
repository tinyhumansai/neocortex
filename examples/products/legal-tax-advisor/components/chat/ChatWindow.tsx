"use client";

import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { StreamingMessage } from "./StreamingMessage";
import type { Message } from "@/types";

export function ChatWindow({
  messages,
  isStreaming,
  streamingContent,
}: {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [messages, isStreaming, streamingContent]);

  const completedMessages = messages.filter(
    (m, i) => !(isStreaming && i === messages.length - 1 && m.role === "assistant")
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Welcome to LexAI</h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Your AI-powered Legal & Tax Assistant for India. Ask about income tax, GST,
              deductions, or compliance—answers are grounded in CA material and official sources.
            </p>
          </div>
        )}

        {completedMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isStreaming &&
          (streamingContent ? (
            <StreamingMessage content={streamingContent} />
          ) : (
            <div className="flex gap-3 px-4 py-4">
              <div className="h-8 w-8 shrink-0 rounded-full bg-muted animate-pulse" />
              <div className="flex gap-1 rounded-2xl bg-muted px-4 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            </div>
          ))}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
