"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNewChat } from "@/lib/new-chat-context";

export function NewChatButton() {
  const { startNewChat } = useNewChat();

  return (
    <Button
      variant="outline"
      className="w-full justify-start gap-2 rounded-xl font-medium"
      onClick={startNewChat}
    >
      <Plus className="h-4 w-4 shrink-0" />
      New Chat
    </Button>
  );
}
