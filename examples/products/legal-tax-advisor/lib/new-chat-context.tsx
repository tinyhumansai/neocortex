"use client";

import { createContext, useContext, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

const NewChatContext = createContext<{
  newChatKey: number;
  startNewChat: () => void;
} | null>(null);

export function NewChatProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [newChatKey, setNewChatKey] = useState(0);

  const startNewChat = useCallback(() => {
    setNewChatKey((k) => k + 1);
    router.push("/chat");
  }, [router]);

  return (
    <NewChatContext.Provider value={{ newChatKey, startNewChat }}>
      {children}
    </NewChatContext.Provider>
  );
}

export function useNewChat() {
  const ctx = useContext(NewChatContext);
  if (!ctx) throw new Error("useNewChat must be used within NewChatProvider");
  return ctx;
}
