"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { CaptchaMessage } from "./CaptchaMessage";
import type { CaseMessage } from "@/lib/hooks/useCaseChat";

import "highlight.js/styles/github-dark.min.css";

export const CaseMessageBubble = memo(function CaseMessageBubble({
  message,
  onCaptchaSubmit,
  isStreaming,
}: {
  message: CaseMessage;
  onCaptchaSubmit: (text: string) => void;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 px-4 py-4", isUser && "flex-row-reverse")}>
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary">
            <Scale className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-[85%] min-w-0 rounded-2xl px-4 py-3 break-words shadow-card",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted border border-border/50"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : (
          <>
            {(message.content || message.captcha) && (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-headings:font-semibold">
                {message.content && (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {message.content}
                  </ReactMarkdown>
                )}
                {message.captcha && (
                  <CaptchaMessage
                    captchaImage={message.captcha.captchaImage}
                    onSubmit={onCaptchaSubmit}
                    disabled={isStreaming}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});
