"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useCaseChat } from "@/lib/hooks/useCaseChat";
import { MessageInput } from "@/components/chat/MessageInput";
import { StreamingMessage } from "@/components/chat/StreamingMessage";
import { CaseMessageBubble } from "@/components/cases/CaseMessageBubble";
import { MessageSquare } from "lucide-react";

export default function ChatConversationPage() {
  const params = useParams();
  const id = params.id as string;
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, isStreaming, sendMessage, loading } = useCaseChat(id, "chat");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const completedMessages = messages.filter(
    (m, i) => !(isStreaming && i === messages.length - 1 && m.role === "assistant")
  );

  const streamingContent =
    isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === "assistant"
      ? messages[messages.length - 1]!.content
      : "";

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Welcome to LexAI</h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Ask about cases, fetch by CNR, search CA books, or find relevant cases.
              </p>
            </div>
          )}

          {completedMessages.map((msg) => (
            <CaseMessageBubble
              key={msg.id}
              message={msg}
              onCaptchaSubmit={(text) => sendMessage(text)}
            />
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

      <MessageInput
        onSend={(content) => sendMessage(content)}
        onStop={() => {}}
        isStreaming={isStreaming}
        model="gpt-4o"
        onModelChange={() => {}}
        placeholder="Ask about cases, fetch by CNR, search CA books, or find relevant cases..."
        hideModelSelector
      />
    </div>
  );
}
