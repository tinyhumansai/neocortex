"use client";

import { useEffect, useRef } from "react";
import { Gavel } from "lucide-react";
import { useCaseChat } from "@/lib/hooks/useCaseChat";
import { CaseMessageBubble } from "@/components/cases/CaseMessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { StreamingMessage } from "@/components/chat/StreamingMessage";

export default function CasesPage() {
  const { messages, isStreaming, sendMessage } = useCaseChat(undefined, "case_search");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleCaptchaSubmit = (text: string) => {
    sendMessage(text);
  };

  const completedMessages = messages.filter(
    (m, i) => !(isStreaming && i === messages.length - 1 && m.role === "assistant")
  );

  const streamingContent =
    isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === "assistant"
      ? messages[messages.length - 1]!.content
      : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Gavel className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Case Search (eCourts)</h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Ask about a case (e.g. &quot;fetch case DLCT010001232019&quot;) or your previous
                cases. You can also ask about tax, legal concepts, or sections from CA books.
              </p>
            </div>
          )}

          {completedMessages.map((msg) => (
            <CaseMessageBubble key={msg.id} message={msg} onCaptchaSubmit={handleCaptchaSubmit} />
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
        placeholder="Ask about a case, fetch by CNR, or search CA books..."
        hideModelSelector
      />
    </div>
  );
}
