"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Conversation } from "@/types";

export function useConversations(pathname?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch (err) {
      console.error("[Conversations] Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations, pathname]);

  const deleteConversation = useCallback(async (id: string) => {
    await api.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const renameConversation = useCallback(async (id: string, title: string) => {
    await api.renameConversation(id, title);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }, []);

  const addConversation = useCallback((conv: Conversation) => {
    setConversations((prev) => [conv, ...prev]);
  }, []);

  return {
    conversations,
    loading,
    fetchConversations,
    deleteConversation,
    renameConversation,
    addConversation,
  };
}
