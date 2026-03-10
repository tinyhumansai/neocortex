"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CaptchaMessage({
  captchaImage,
  onSubmit,
  disabled,
}: {
  captchaImage: string;
  onSubmit: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className="mt-3 rounded-xl border border-border/80 bg-muted/30 p-4">
      <p className="mb-2 text-sm font-medium text-foreground">
        Enter the characters you see in the image:
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <img
          src={captchaImage}
          alt="CAPTCHA"
          className="h-12 rounded border bg-muted object-contain"
        />
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type characters"
            className="max-w-[140px] font-mono"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            disabled={disabled}
          />
          <Button type="submit" size="sm" disabled={!value.trim() || disabled}>
            Submit
          </Button>
        </form>
      </div>
    </div>
  );
}
