"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelSelector } from "./ModelSelector";
import { cn } from "@/lib/utils";

const MAX_HEIGHT = 200;

export function MessageInput({
  onSend,
  onStop,
  isStreaming,
  model,
  onModelChange,
  disabled,
  placeholder,
  hideModelSelector,
}: {
  onSend: (content: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  model: string;
  onModelChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  hideModelSelector?: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="shrink-0 border-t border-border/50 bg-background/95 p-3 backdrop-blur sm:p-4">
      {!hideModelSelector && (
        <div className="mb-3">
          <ModelSelector value={model} onChange={onModelChange} />
        </div>
      )}
      <div className="flex gap-2 rounded-2xl border border-input bg-muted/30 p-2.5 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Ask about income tax, GST, deductions, or compliance..."}
          rows={1}
          className={cn(
            "max-h-[200px] min-h-[44px] flex-1 resize-none rounded-xl bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
          )}
          disabled={disabled}
        />
        {isStreaming ? (
          <Button variant="outline" size="icon" onClick={onStop} className="shrink-0">
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!value.trim() || disabled}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
