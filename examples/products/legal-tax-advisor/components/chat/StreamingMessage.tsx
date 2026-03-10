"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Scale } from "lucide-react";

import "highlight.js/styles/github-dark.min.css";

export const StreamingMessage = memo(function StreamingMessage({ content }: { content: string }) {
  return (
    <div className="flex gap-3 px-4 py-4">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary">
          <Scale className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="max-w-[85%] min-w-0 rounded-2xl bg-muted px-4 py-2.5 break-words">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {content || "..."}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
});
