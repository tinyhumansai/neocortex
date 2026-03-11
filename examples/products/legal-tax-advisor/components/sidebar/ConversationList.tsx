"use client";

import { usePathname, useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { useConversations } from "@/lib/hooks/useConversations";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";
import { useState } from "react";

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Last 7 Days";
  return "Older";
}

function groupConversations(convs: Conversation[]) {
  const groups: Record<string, Conversation[]> = {};
  for (const c of convs) {
    const key = formatDate(c.updatedAt);
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }
  const order = ["Today", "Yesterday", "Last 7 Days", "Older"];
  return order.filter((k) => groups[k]?.length).map((k) => ({ label: k, items: groups[k]! }));
}

export function ConversationList() {
  const pathname = usePathname();
  const router = useRouter();
  const { conversations, loading, deleteConversation, renameConversation } =
    useConversations(pathname);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const groups = groupConversations(conversations);

  const handleRename = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setEditingId(id);
      setEditTitle(conv.title);
    }
  };

  const submitRename = (id: string) => {
    if (editTitle.trim()) {
      renameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  if (loading) {
    return (
      <div className="space-y-2 p-2">
        <div className="h-8 animate-pulse rounded bg-muted" />
        <div className="h-8 animate-pulse rounded bg-muted" />
        <div className="h-8 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(({ label, items }) => (
        <div key={label}>
          <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">{label}</p>
          <div className="space-y-1">
            {items.map((conv) => {
              const isActive = pathname === `/chat/${conv.id}`;
              const isEditing = editingId === conv.id;

              return (
                <div
                  key={conv.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-lg px-2 py-1.5",
                    isActive && "bg-accent"
                  )}
                >
                  {isEditing ? (
                    <input
                      className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none ring-2 ring-ring/20 focus:ring-2 focus:ring-ring"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => submitRename(conv.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRename(conv.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <>
                      <button
                        className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                        onClick={() => router.push(`/chat/${conv.id}`)}
                      >
                        {conv.title}
                      </button>
                      <div className="flex opacity-0 group-hover:opacity-100">
                        <Tooltip content="Rename">
                          <button
                            className="p-1 hover:rounded hover:bg-muted"
                            onClick={() => handleRename(conv.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Delete">
                          <button
                            className="p-1 hover:rounded hover:bg-muted"
                            onClick={() => {
                              deleteConversation(conv.id);
                              if (pathname === `/chat/${conv.id}`) {
                                router.push("/chat");
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </button>
                        </Tooltip>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
