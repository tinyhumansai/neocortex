import type { Plugin } from "@opencode-ai/plugin";
import { z } from "zod";

import { NeocortexMemoryClient } from "./client";
import type {
  DeleteMemoryInput,
  NeocortexConfig,
  RecallMemoryInput,
  SaveMemoryInput,
} from "./types";

export * from "./types";
export * from "./utils";
export * from "./client";

export interface OpenCodeNeocortexConfig extends NeocortexConfig {
  /** Default namespace when one is not provided by the caller. */
  defaultNamespace?: string;
}

export class OpenCodeNeocortexMemory {
  private readonly client: NeocortexMemoryClient;
  private readonly defaultNamespace: string;

  constructor(config: OpenCodeNeocortexConfig) {
    this.client = new NeocortexMemoryClient(config);
    this.defaultNamespace = config.defaultNamespace?.trim() || "default";
  }

  private resolveNamespace(ns?: string | null): string {
    const trimmed = ns?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : this.defaultNamespace;
  }

  async saveMemory(input: SaveMemoryInput) {
    const namespace = this.resolveNamespace(input.namespace);
    const res = await this.client.insertMemory({
      title: input.key,
      content: input.content,
      namespace,
      sourceType: "doc",
      metadata: input.metadata,
    });
    const status = (res as any)?.data?.status ?? "completed";
    return {
      ok: true as const,
      namespace,
      message: `Saved memory '${input.key}' in namespace '${namespace}' (status=${status}).`,
    };
  }

  async recallMemory(input: RecallMemoryInput) {
    const namespace = this.resolveNamespace(input.namespace);
    const res = await this.client.queryMemory({
      query: input.query,
      namespace,
      maxChunks: input.max_chunks ?? 10,
    });
    const data = res.data;
    const direct = data.llmContextMessage || data.response;
    if (typeof direct === "string" && direct.trim()) {
      return { ok: true as const, namespace, context: direct.trim(), raw: data };
    }

    const chunks = data.context?.chunks ?? [];
    const texts: string[] = [];
    for (const chunk of chunks) {
      if (chunk && typeof chunk === "object") {
        const text = (chunk as any).content ?? (chunk as any).text ?? (chunk as any).body ?? "";
        if (typeof text === "string" && text.trim()) texts.push(text.trim());
      }
    }
    return {
      ok: true as const,
      namespace,
      context: texts.length ? texts.join("\n\n") : "No relevant memories found.",
      raw: data,
    };
  }

  async deleteMemory(input: DeleteMemoryInput) {
    const namespace = input.namespace?.trim() || undefined;
    const res = await this.client.deleteMemory({ namespace });
    return {
      ok: true as const,
      namespace,
      message: res.data?.message || "Memory deleted.",
      raw: res.data,
    };
  }
}

/**
 * OpenCode plugin entry point exposing Neocortex memory via tool.execute.* hooks.
 *
 * Tools (invoked by name in OpenCode prompts/config):
 *   - neocortex_save_memory
 *   - neocortex_recall_memory
 *   - neocortex_delete_memory
 */
export const NeocortexOpenCodePlugin: Plugin = async (ctx) => {
  const token =
    process.env.ALPHAHUMAN_API_KEY ||
    process.env.NEOCORTEX_API_KEY ||
    process.env.NEOCORTEX_TOKEN;

  if (!token || !token.trim()) {
    await ctx.client.app.log({
      body: {
        service: "@neocortex/plugin-opencode",
        level: "error",
        message:
          "Neocortex token is missing. Set ALPHAHUMAN_API_KEY, NEOCORTEX_API_KEY, or NEOCORTEX_TOKEN.",
      },
    });
    // Return no hooks so plugin loads safely but does nothing.
    return {};
  }

  const baseUrl = process.env.ALPHAHUMAN_BASE_URL || process.env.NEOCORTEX_BASE_URL;

  const memory = new OpenCodeNeocortexMemory({
    token,
    baseUrl,
    logger: {
      info: (msg, data) =>
        ctx.client.app.log({
          body: {
            service: "@neocortex/plugin-opencode",
            level: "info",
            message: msg,
            extra: (data as Record<string, unknown>) ?? undefined,
          },
        }),
      warn: (msg, data) =>
        ctx.client.app.log({
          body: {
            service: "@neocortex/plugin-opencode",
            level: "warn",
            message: msg,
            extra: (data as Record<string, unknown>) ?? undefined,
          },
        }),
      error: (msg, data) =>
        ctx.client.app.log({
          body: {
            service: "@neocortex/plugin-opencode",
            level: "error",
            message: msg,
            extra: (data as Record<string, unknown>) ?? undefined,
          },
        }),
    },
  });

  const saveArgsSchema = z.object({
    namespace: z.string().optional(),
    key: z.string(),
    content: z.string(),
    metadata: z.record(z.unknown()).optional(),
  });

  const recallArgsSchema = z.object({
    namespace: z.string().optional(),
    query: z.string(),
    max_chunks: z.number().int().optional(),
  });

  const deleteArgsSchema = z.object({
    namespace: z.string().optional(),
  });

  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "neocortex_save_memory") {
        const parsed = saveArgsSchema.parse(output.args);
        const res = await memory.saveMemory(parsed);
        output.args = { result: res };
      } else if (input.tool === "neocortex_recall_memory") {
        const parsed = recallArgsSchema.parse(output.args);
        const res = await memory.recallMemory(parsed);
        output.args = { result: res };
      } else if (input.tool === "neocortex_delete_memory") {
        const parsed = deleteArgsSchema.parse(output.args);
        const res = await memory.deleteMemory(parsed);
        output.args = { result: res };
      }
    },
  };
};


