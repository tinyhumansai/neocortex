import type { Plugin } from "@opencode-ai/plugin";
import { z } from "zod";

import { NeocortexMemoryClient } from "./client";
import type {
  ChatMemoryContextInput,
  ChatMemoryInput,
  DeleteDocumentInput,
  DeleteMemoryInput,
  GetDocumentInput,
  GetIngestionJobInput,
  InteractMemoryInput,
  InsertDocumentInput,
  InsertDocumentsBatchInput,
  ListDocumentsInput,
  NeocortexConfig,
  QueryMemoryContextInput,
  RecallMemoryInput,
  RecallMemoriesInput,
  RecallMemoryMasterInput,
  RecallThoughtsInput,
  RecordInteractionsInput,
  SaveMemoryInput,
  SyncMemoryInput,
} from "./types";
import { NEOCORTEX_MASTRA_TOOL_SCHEMAS } from "./utils";

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
      documentId: input.key,
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

  private extractContext(data: any): string {
    const llmMsg = data?.llmContextMessage || data?.response;
    if (typeof llmMsg === "string" && llmMsg.trim()) return llmMsg.trim();

    const chunks = data?.context?.chunks ?? [];
    if (!Array.isArray(chunks) || chunks.length === 0) {
      return "No relevant memories found.";
    }

    const texts: string[] = [];
    for (const chunk of chunks) {
      if (!chunk || typeof chunk !== "object") continue;
      const text = (chunk as any).content ?? (chunk as any).text ?? (chunk as any).body ?? "";
      if (typeof text === "string" && text.trim()) texts.push(text.trim());
    }

    return texts.length ? texts.join("\n\n") : "No relevant memories found.";
  }

  async syncMemory(input: SyncMemoryInput): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.syncMemory({
      workspace_id: input.workspace_id,
      agent_id: input.agent_id,
      source: input.source,
      files: input.files,
    });
    return { ok: true as const, raw: res };
  }

  async insertDocument(input: InsertDocumentInput): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.insertDocument({
      title: input.title,
      content: input.content,
      namespace: input.namespace,
      source_type: input.source_type,
      metadata: input.metadata,
      priority: input.priority,
      created_at: input.created_at,
      updated_at: input.updated_at,
      document_id: input.document_id,
    });
    return { ok: true as const, raw: res };
  }

  async insertDocumentsBatch(
    input: InsertDocumentsBatchInput,
  ): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.insertDocumentsBatch({ items: input.items as any });
    return { ok: true as const, raw: res };
  }

  async listDocuments(input: ListDocumentsInput): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.listDocuments({
      namespace: input.namespace,
      limit: input.limit,
      offset: input.offset,
    });
    return { ok: true as const, raw: res };
  }

  async getDocument(input: GetDocumentInput): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.getDocument({
      document_id: input.document_id,
      namespace: input.namespace,
    });
    return { ok: true as const, raw: res };
  }

  async deleteDocument(input: DeleteDocumentInput): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.deleteDocument({
      document_id: input.document_id,
      namespace: input.namespace,
    });
    return { ok: true as const, raw: res };
  }

  async queryMemoryContext(
    input: QueryMemoryContextInput,
  ): Promise<{ ok: true; namespace: string; context: string; raw: unknown }> {
    const namespace = input.namespace?.trim() || this.defaultNamespace;
    const res = await this.client.queryMemoryContext({
      query: input.query,
      include_references: input.include_references,
      namespace,
      max_chunks: input.max_chunks,
      document_ids: input.document_ids,
      recall_only: input.recall_only,
      llm_query: input.llm_query,
    });
    const data = (res as any)?.data ?? {};
    return { ok: true as const, namespace, context: this.extractContext(data), raw: data };
  }

  async chatMemoryContext(
    input: ChatMemoryContextInput,
  ): Promise<{ ok: true; content: string; raw: unknown }> {
    const res = await this.client.chatMemoryContext({
      messages: input.messages,
      temperature: input.temperature,
      max_tokens: input.max_tokens,
    });
    const content = (res as any)?.data?.content;
    return {
      ok: true as const,
      content: typeof content === "string" ? content : "",
      raw: res,
    };
  }

  async recordInteractions(
    input: RecordInteractionsInput,
  ): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.recordInteractions({
      namespace: input.namespace,
      entity_names: input.entity_names,
      description: input.description,
      interaction_level: input.interaction_level,
      interaction_levels: input.interaction_levels,
      timestamp: input.timestamp,
    });
    return { ok: true as const, raw: res };
  }

  async recallThoughts(
    input: RecallThoughtsInput,
  ): Promise<{ ok: true; thought?: string; raw: unknown }> {
    const res = await this.client.recallThoughts({
      namespace: input.namespace,
      max_chunks: input.max_chunks,
      temperature: input.temperature,
      randomness_seed: input.randomness_seed,
      persist: input.persist,
      enable_prediction_check: input.enable_prediction_check,
      thought_prompt: input.thought_prompt,
    });
    const thought = (res as any)?.data?.thought;
    return {
      ok: true as const,
      thought: typeof thought === "string" ? thought : undefined,
      raw: res,
    };
  }

  async chatMemory(input: ChatMemoryInput): Promise<{ ok: true; content: string; raw: unknown }> {
    const res = await this.client.chatMemory({
      messages: input.messages,
      temperature: input.temperature,
      max_tokens: input.max_tokens,
    });
    const content = (res as any)?.data?.content;
    return { ok: true as const, content: typeof content === "string" ? content : "", raw: res };
  }

  async interactMemory(input: InteractMemoryInput): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.interactMemory({
      namespace: input.namespace,
      entity_names: input.entity_names,
      description: input.description,
      interaction_level: input.interaction_level,
      interaction_levels: input.interaction_levels,
      timestamp: input.timestamp,
    });
    return { ok: true as const, raw: res };
  }

  async recallMemoryMaster(
    input: RecallMemoryMasterInput,
  ): Promise<{ ok: true; namespace: string; context: string; raw: unknown }> {
    const namespace = input.namespace?.trim() || this.defaultNamespace;
    const res = await this.client.recallMemoryMaster({
      namespace,
      max_chunks: input.max_chunks,
    });
    const data = (res as any)?.data ?? {};
    return { ok: true as const, namespace, context: this.extractContext(data), raw: data };
  }

  async recallMemories(input: RecallMemoriesInput): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.recallMemories({
      namespace: input.namespace?.trim(),
      top_k: input.top_k,
      min_retention: input.min_retention,
      as_of: input.as_of,
    });
    return { ok: true as const, raw: res };
  }

  async getIngestionJob(input: GetIngestionJobInput): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.getIngestionJob({ job_id: input.job_id });
    return { ok: true as const, raw: res };
  }
}

/**
 * OpenCode plugin entry point exposing Neocortex memory via tool.execute.* hooks.
 *
 * Tools (invoked by name in OpenCode prompts/config):
 *   - Full Mastra-aligned Neocortex tool surface (excluding graph snapshot)
 */
export const NeocortexOpenCodePlugin: Plugin = async (ctx) => {
  const token =
    process.env.TINYHUMANS_API_KEY ||
    process.env.NEOCORTEX_API_KEY ||
    process.env.NEOCORTEX_TOKEN;

  if (!token || !token.trim()) {
    await ctx.client.app.log({
      body: {
        service: "@neocortex/plugin-opencode",
        level: "error",
        message:
          "Neocortex token is missing. Set TINYHUMANS_API_KEY, NEOCORTEX_API_KEY, or NEOCORTEX_TOKEN.",
      },
    });
    // Return no hooks so plugin loads safely but does nothing.
    return {};
  }

  const baseUrl = process.env.TINYHUMANS_BASE_URL || process.env.NEOCORTEX_BASE_URL;

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

  const syncMemorySchema = z.object({
    workspace_id: z.string(),
    agent_id: z.string(),
    source: z.enum(["startup", "agent_end"]).optional(),
    files: z.array(
      z.object({
        file_path: z.string().optional(),
        content: z.string().optional(),
        timestamp: z.union([z.string(), z.number()]).optional(),
        hash: z.string().optional(),
      }),
    ),
  });

  const insertDocumentSchema = z.object({
    title: z.string(),
    content: z.string(),
    namespace: z.string(),
    source_type: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    priority: z.string().optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
    document_id: z.string(),
  });

  const insertDocumentsBatchSchema = z.object({
    items: z.array(
      z.object({
        title: z.string().optional(),
        content: z.string().optional(),
        namespace: z.string().optional(),
        source_type: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
        priority: z.string().optional(),
        created_at: z.number().optional(),
        updated_at: z.number().optional(),
        document_id: z.string(),
      }),
    ),
  });

  const listDocumentsSchema = z.object({
    namespace: z.string().optional(),
    limit: z.number().int().optional(),
    offset: z.number().int().optional(),
  });

  const getDocumentSchema = z.object({
    document_id: z.string(),
    namespace: z.string().optional(),
  });

  const deleteDocumentSchema = z.object({
    document_id: z.string(),
    namespace: z.string(),
  });

  const queryMemoryContextSchema = z.object({
    query: z.string(),
    namespace: z.string().optional(),
    include_references: z.boolean().optional(),
    max_chunks: z.number().int().optional(),
    document_ids: z.array(z.string()).optional(),
    recall_only: z.boolean().optional(),
    llm_query: z.string().optional(),
  });

  const chatMemoryContextSchema = z.object({
    messages: z.array(z.object({ role: z.string(), content: z.string() })),
    temperature: z.number().optional(),
    max_tokens: z.number().int().optional(),
  });

  const recordInteractionsSchema = z.object({
    namespace: z.string(),
    entity_names: z.array(z.string()),
    description: z.string().optional(),
    interaction_level: z.string().optional(),
    interaction_levels: z.array(z.string()).optional(),
    timestamp: z.number().optional(),
  });

  const recallThoughtsSchema = z.object({
    namespace: z.string().optional(),
    max_chunks: z.number().int().optional(),
    temperature: z.number().optional(),
    randomness_seed: z.number().int().optional(),
    persist: z.boolean().optional(),
    enable_prediction_check: z.boolean().optional(),
    thought_prompt: z.string().optional(),
  });

  const chatMemorySchema = z.object({
    messages: z.array(z.object({ role: z.string(), content: z.string() })),
    temperature: z.number().optional(),
    max_tokens: z.number().int().optional(),
  });

  const interactMemorySchema = z.object({
    namespace: z.string(),
    entity_names: z.array(z.string()),
    description: z.string().optional(),
    interaction_level: z.string().optional(),
    interaction_levels: z.array(z.string()).optional(),
    timestamp: z.number().optional(),
  });

  const recallMemoryMasterSchema = z.object({
    namespace: z.string().optional(),
    max_chunks: z.number().int().optional(),
  });

  const recallMemoriesSchema = z.object({
    namespace: z.string().optional(),
    top_k: z.number().optional(),
    min_retention: z.number().optional(),
    as_of: z.number().optional(),
  });

  const getIngestionJobSchema = z.object({ job_id: z.string() });

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
      } else if (input.tool === NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_sync_memory.name) {
        const parsed = syncMemorySchema.parse(output.args);
        const res = await memory.syncMemory(parsed as any);
        output.args = { result: res };
      } else if (input.tool === NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_insert_document.name) {
        const parsed = insertDocumentSchema.parse(output.args);
        const res = await memory.insertDocument(parsed);
        output.args = { result: res };
      } else if (
        input.tool === NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_insert_documents_batch.name
      ) {
        const parsed = insertDocumentsBatchSchema.parse(output.args);
        const res = await memory.insertDocumentsBatch(parsed as any);
        output.args = { result: res };
      } else if (input.tool === NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_list_documents.name) {
        const parsed = listDocumentsSchema.parse(output.args);
        const res = await memory.listDocuments(parsed);
        output.args = { result: res };
      } else if (input.tool === NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_get_document.name) {
        const parsed = getDocumentSchema.parse(output.args);
        const res = await memory.getDocument(parsed);
        output.args = { result: res };
      } else if (input.tool === NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_delete_document.name) {
        const parsed = deleteDocumentSchema.parse(output.args);
        const res = await memory.deleteDocument(parsed);
        output.args = { result: res };
      } else if (
        input.tool === NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_query_memory_context.name
      ) {
        const parsed = queryMemoryContextSchema.parse(output.args);
        const res = await memory.queryMemoryContext(parsed);
        output.args = { result: res };
      } else if (
        input.tool === NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_chat_memory_context.name
      ) {
        const parsed = chatMemoryContextSchema.parse(output.args);
        const res = await memory.chatMemoryContext(parsed);
        output.args = { result: res };
      } else if (
        input.tool === NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_record_interactions.name
      ) {
        const parsed = recordInteractionsSchema.parse(output.args);
        const res = await memory.recordInteractions(parsed);
        output.args = { result: res };
      } else if (input.tool === NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_recall_thoughts.name) {
        const parsed = recallThoughtsSchema.parse(output.args);
        const res = await memory.recallThoughts(parsed);
        output.args = { result: res };
      } else if (input.tool === NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_chat_memory.name) {
        const parsed = chatMemorySchema.parse(output.args);
        const res = await memory.chatMemory(parsed);
        output.args = { result: res };
      } else if (input.tool === NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_interact_memory.name) {
        const parsed = interactMemorySchema.parse(output.args);
        const res = await memory.interactMemory(parsed);
        output.args = { result: res };
      } else if (
        input.tool === NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_recall_memory_master.name
      ) {
        const parsed = recallMemoryMasterSchema.parse(output.args);
        const res = await memory.recallMemoryMaster(parsed);
        output.args = { result: res };
      } else if (input.tool === NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_recall_memories.name) {
        const parsed = recallMemoriesSchema.parse(output.args);
        const res = await memory.recallMemories(parsed);
        output.args = { result: res };
      } else if (input.tool === NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_get_ingestion_job.name) {
        const parsed = getIngestionJobSchema.parse(output.args);
        const res = await memory.getIngestionJob(parsed);
        output.args = { result: res };
      }
    },
  };
};


