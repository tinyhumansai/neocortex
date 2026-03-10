"use client";

import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import type { Model } from "@/types";

const MODEL_STORAGE_KEY = "lexai-selected-model";

export function ModelSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (modelId: string) => void;
}) {
  const [models, setModels] = useState<Model[]>([]);

  useEffect(() => {
    api
      .getModels()
      .then(setModels)
      .catch(() => setModels([]));
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(MODEL_STORAGE_KEY);
    if (stored && models.some((m) => m.id === stored)) {
      onChange(stored);
    }
  }, [models, onChange]);

  const handleSelect = (id: string) => {
    onChange(id);
    localStorage.setItem(MODEL_STORAGE_KEY, id);
  };

  const currentModel = models.find((m) => m.id === value) ?? models[0];

  if (models.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-transparent bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {currentModel?.name ?? value}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="min-w-[12rem]">
        {models.map((m) => (
          <DropdownMenuItem key={m.id} onSelect={() => handleSelect(m.id)}>
            <div>
              <p className="font-medium">{m.name}</p>
              <p className="text-xs text-muted-foreground">{m.description}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
