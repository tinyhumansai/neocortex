import { NeocortexMemoryClient } from "./client";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type {
  ChatMemoryContextInput,
  ChatMemoryInput,
  DeleteMemoryInput,
  DeleteDocumentInput,
  GetDocumentInput,
  GetIngestionJobInput,
  InsertDocumentInput,
  InsertDocumentsBatchInput,
  MastraTool,
  NeocortexConfig,
  RecallMemoryInput,
  RecallMemoryMasterInput,
  RecallMemoriesInput,
  RecallThoughtsInput,
  InteractMemoryInput,
  ListDocumentsInput,
  QueryMemoryContextInput,
  RecordInteractionsInput,
  SaveMemoryInput,
  SyncMemoryInput,
} from "./types";
import { NEOCORTEX_MASTRA_TOOL_SCHEMAS } from "./utils";

export * from "./types";
export * from "./utils";

export interface MastraNeocortexConfig extends NeocortexConfig {
  /** Default namespace used when tool input does not specify one. */
  defaultNamespace?: string;
}

/**
 * createNeocortexMastraTools
 *
 * Mastra-native tools created via `createTool()` (similar ergonomics to Agno's Toolkit:
 * you get ready-to-register tools).
 *
 * Notes:
 * - Tools are bound to the provided credentials; credentials never flow through tool inputs.
 * - If you want tool names in traces/streams to match tool IDs, register as:
 *   `tools: { [tool.id]: tool }`.
 */
export function createNeocortexMastraTools(config: MastraNeocortexConfig) {
  const memory = new MastraNeocortexMemory(config);

  const neocortexSaveMemory = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_save_memory.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_save_memory.description,
    inputSchema: z.object({
      namespace: z.string().optional().describe("Optional namespace override."),
      key: z.string().describe("Short key/title for the memory."),
      content: z.string().describe("The content to remember."),
      metadata: z.record(z.unknown()).optional().describe("Optional metadata object."),
    }),
    outputSchema: z.object({
      ok: z.literal(true),
      namespace: z.string(),
      message: z.string(),
    }),
    execute: async (inputData) => memory.saveMemory(inputData),
  });

  const neocortexRecallMemory = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_recall_memory.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_recall_memory.description,
    inputSchema: z.object({
      namespace: z.string().optional().describe("Optional namespace override."),
      query: z.string().describe("Natural-language query for memory."),
      max_chunks: z.number().int().optional().describe("Max number of chunks to retrieve."),
    }),
    outputSchema: z.object({
      ok: z.literal(true),
      namespace: z.string(),
      context: z.string(),
      raw: z.unknown(),
    }),
    execute: async (inputData) => memory.recallMemory(inputData),
  });

  const neocortexDeleteMemory = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_delete_memory.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_delete_memory.description,
    inputSchema: z.object({
      namespace: z.string().optional().describe("Namespace to delete."),
    }),
    outputSchema: z.object({
      ok: z.literal(true),
      namespace: z.string().optional(),
      message: z.string(),
      raw: z.unknown(),
    }),
    execute: async (inputData) => memory.deleteMemory(inputData),
  });

  const neocortexSyncMemory = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_sync_memory.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_sync_memory.description,
    inputSchema: z.object({
      workspace_id: z.string(),
      agent_id: z.string(),
      source: z.enum(["startup", "agent_end"]).optional(),
      files: z.array(
        z.object({
          file_path: z.string().optional(),
          content: z.string().optional(),
          // SDK/types allow string|number timestamps; allow both.
          timestamp: z.union([z.string(), z.number()]).optional(),
          hash: z.string().optional(),
        })
      ),
    }),
    outputSchema: z.object({ ok: z.literal(true), raw: z.unknown() }),
    execute: async (inputData) => memory.syncMemory(inputData as any),
  });

  const neocortexInsertDocument = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_insert_document.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_insert_document.description,
    inputSchema: z.object({
      title: z.string(),
      content: z.string(),
      namespace: z.string(),
      source_type: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
      priority: z.string().optional(),
      created_at: z.number().optional(),
      updated_at: z.number().optional(),
      document_id: z.string(),
    }),
    outputSchema: z.object({ ok: z.literal(true), raw: z.unknown() }),
    execute: async (inputData) => memory.insertDocument(inputData),
  });

  const neocortexInsertDocumentsBatch = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_insert_documents_batch.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_insert_documents_batch.description,
    inputSchema: z.object({
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
        })
      ),
    }),
    outputSchema: z.object({ ok: z.literal(true), raw: z.unknown() }),
    execute: async (inputData) => memory.insertDocumentsBatch(inputData as any),
  });

  const neocortexListDocuments = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_list_documents.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_list_documents.description,
    inputSchema: z.object({
      namespace: z.string().optional(),
      limit: z.number().int().optional(),
      offset: z.number().int().optional(),
    }),
    outputSchema: z.object({ ok: z.literal(true), raw: z.unknown() }),
    execute: async (inputData) => memory.listDocuments(inputData),
  });

  const neocortexGetDocument = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_get_document.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_get_document.description,
    inputSchema: z.object({
      document_id: z.string(),
      namespace: z.string().optional(),
    }),
    outputSchema: z.object({ ok: z.literal(true), raw: z.unknown() }),
    execute: async (inputData) => memory.getDocument(inputData),
  });

  const neocortexDeleteDocument = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_delete_document.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_delete_document.description,
    inputSchema: z.object({
      document_id: z.string(),
      namespace: z.string(),
    }),
    outputSchema: z.object({ ok: z.literal(true), raw: z.unknown() }),
    execute: async (inputData) => memory.deleteDocument(inputData),
  });

  const neocortexQueryMemoryContext = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_query_memory_context.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_query_memory_context.description,
    inputSchema: z.object({
      query: z.string(),
      namespace: z.string().optional(),
      include_references: z.boolean().optional(),
      max_chunks: z.number().int().optional(),
      document_ids: z.array(z.string()).optional(),
      recall_only: z.boolean().optional(),
      llm_query: z.string().optional(),
    }),
    outputSchema: z.object({ ok: z.literal(true), namespace: z.string(), context: z.string(), raw: z.unknown() }),
    execute: async (inputData) => memory.queryMemoryContext(inputData),
  });

  const neocortexChatMemoryContext = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_chat_memory_context.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_chat_memory_context.description,
    inputSchema: z.object({
      messages: z.array(z.object({ role: z.string(), content: z.string() })),
      temperature: z.number().optional(),
      max_tokens: z.number().int().optional(),
    }),
    outputSchema: z.object({ ok: z.literal(true), content: z.string(), raw: z.unknown() }),
    execute: async (inputData) => memory.chatMemoryContext(inputData),
  });

  const neocortexRecordInteractions = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_record_interactions.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_record_interactions.description,
    inputSchema: z.object({
      namespace: z.string(),
      entity_names: z.array(z.string()),
      description: z.string().optional(),
      interaction_level: z.string().optional(),
      interaction_levels: z.array(z.string()).optional(),
      timestamp: z.number().optional(),
    }),
    outputSchema: z.object({ ok: z.literal(true), raw: z.unknown() }),
    execute: async (inputData) => memory.recordInteractions(inputData),
  });

  const neocortexRecallThoughts = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_recall_thoughts.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_recall_thoughts.description,
    inputSchema: z.object({
      namespace: z.string().optional(),
      max_chunks: z.number().int().optional(),
      temperature: z.number().optional(),
      randomness_seed: z.number().int().optional(),
      persist: z.boolean().optional(),
      enable_prediction_check: z.boolean().optional(),
      thought_prompt: z.string().optional(),
    }),
    outputSchema: z.object({ ok: z.literal(true), thought: z.string().optional(), raw: z.unknown() }),
    execute: async (inputData) => memory.recallThoughts(inputData),
  });

  const neocortexChatMemory = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_chat_memory.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_chat_memory.description,
    inputSchema: z.object({
      messages: z.array(z.object({ role: z.string(), content: z.string() })),
      temperature: z.number().optional(),
      max_tokens: z.number().int().optional(),
    }),
    outputSchema: z.object({ ok: z.literal(true), content: z.string(), raw: z.unknown() }),
    execute: async (inputData) => memory.chatMemory(inputData),
  });

  const neocortexInteractMemory = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_interact_memory.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_interact_memory.description,
    inputSchema: z.object({
      namespace: z.string(),
      entity_names: z.array(z.string()),
      description: z.string().optional(),
      interaction_level: z.string().optional(),
      interaction_levels: z.array(z.string()).optional(),
      timestamp: z.number().optional(),
    }),
    outputSchema: z.object({ ok: z.literal(true), raw: z.unknown() }),
    execute: async (inputData) => memory.interactMemory(inputData),
  });

  const neocortexRecallMemoryMaster = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_recall_memory_master.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_recall_memory_master.description,
    inputSchema: z.object({
      namespace: z.string().optional(),
      max_chunks: z.number().int().optional(),
    }),
    outputSchema: z.object({ ok: z.literal(true), namespace: z.string(), context: z.string(), raw: z.unknown() }),
    execute: async (inputData) => memory.recallMemoryMaster(inputData),
  });

  const neocortexRecallMemories = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_recall_memories.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_recall_memories.description,
    inputSchema: z.object({
      namespace: z.string().optional(),
      top_k: z.number().optional(),
      min_retention: z.number().optional(),
      as_of: z.number().optional(),
    }),
    outputSchema: z.object({ ok: z.literal(true), raw: z.unknown() }),
    execute: async (inputData) => memory.recallMemories(inputData),
  });

  const neocortexGetIngestionJob = createTool({
    id: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_get_ingestion_job.name,
    description: NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_get_ingestion_job.description,
    inputSchema: z.object({ job_id: z.string() }),
    outputSchema: z.object({ ok: z.literal(true), raw: z.unknown() }),
    execute: async (inputData) => memory.getIngestionJob(inputData),
  });

  return {
    memory,
    neocortexSaveMemory,
    neocortexRecallMemory,
    neocortexDeleteMemory,
    neocortexSyncMemory,
    neocortexInsertDocument,
    neocortexInsertDocumentsBatch,
    neocortexListDocuments,
    neocortexGetDocument,
    neocortexDeleteDocument,
    neocortexQueryMemoryContext,
    neocortexChatMemoryContext,
    neocortexRecordInteractions,
    neocortexRecallThoughts,
    neocortexChatMemory,
    neocortexInteractMemory,
    neocortexRecallMemoryMaster,
    neocortexRecallMemories,
    neocortexGetIngestionJob,
  };
}

/**
 * MastraNeocortexMemory
 *
 * A lightweight adapter that exposes Neocortex (Alphahuman) memory as tools in a
 * Mastra-friendly shape: `{ name, description, parameters, execute }`.
 *
 * If Mastra expects a different tool signature, you can still use the provided
 * `NEOCORTEX_MASTRA_TOOL_SCHEMAS` + call `saveMemory/recallMemory/deleteMemory` directly.
 */
export class MastraNeocortexMemory {
  private readonly client: NeocortexMemoryClient;
  private readonly defaultNamespace: string;

  constructor(config: MastraNeocortexConfig) {
    this.client = new NeocortexMemoryClient(config);
    this.defaultNamespace = config.defaultNamespace?.trim() || "default";
  }

  async saveMemory(input: SaveMemoryInput): Promise<{ ok: true; namespace: string; message: string }> {
    const namespace = input.namespace?.trim() || this.defaultNamespace;
    const res = await this.client.insertMemory({
      title: input.key,
      content: input.content,
      namespace,
      documentId: input.key,
      metadata: input.metadata,
      sourceType: "doc",
    });
    const status = (res as any)?.data?.status ?? "completed";
    return {
      ok: true,
      namespace,
      message: `Saved memory '${input.key}' in namespace '${namespace}' (status=${status}).`,
    };
  }

  async recallMemory(input: RecallMemoryInput): Promise<{ ok: true; namespace: string; context: string; raw: unknown }> {
    const namespace = input.namespace?.trim() || this.defaultNamespace;
    const res = await this.client.queryMemory({
      query: input.query,
      namespace,
      maxChunks: input.max_chunks ?? 10,
    });
    const data = res.data;
    const context = data.llmContextMessage || data.response;
    if (typeof context === "string" && context.trim()) {
      return { ok: true, namespace, context: context.trim(), raw: data };
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
      ok: true,
      namespace,
      context: texts.length ? texts.join("\n\n") : "No relevant memories found.",
      raw: data,
    };
  }

  async deleteMemory(input: DeleteMemoryInput): Promise<{ ok: true; namespace?: string; message: string; raw: unknown }> {
    const namespace = input.namespace?.trim() || undefined;
    const res = await this.client.deleteMemory({ namespace });
    return {
      ok: true,
      namespace,
      message: res.data?.message || "Memory deleted.",
      raw: res.data,
    };
  }

  private extractContext(data: any): string {
    const llmMsg = data?.llmContextMessage || data?.response;
    if (typeof llmMsg === "string" && llmMsg.trim()) return llmMsg.trim();

    const chunks = data?.context?.chunks ?? [];
    if (!Array.isArray(chunks) || chunks.length === 0) return "No relevant memories found.";

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
      workspaceId: input.workspace_id,
      agentId: input.agent_id,
      source: input.source,
      files: (input.files ?? []).map((f: any) => ({
        filePath: f.file_path ?? f.filePath,
        content: f.content,
        timestamp: String(f.timestamp ?? ""),
        hash: f.hash,
      })),
    });
    return { ok: true, raw: res };
  }

  async insertDocument(input: InsertDocumentInput): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.insertDocument({
      title: input.title,
      content: input.content,
      namespace: input.namespace,
      sourceType: input.source_type ?? "doc",
      metadata: input.metadata ?? {},
      priority: input.priority,
      createdAt: input.created_at,
      updatedAt: input.updated_at,
      documentId: input.document_id,
    } as any);
    return { ok: true, raw: res };
  }

  async insertDocumentsBatch(input: InsertDocumentsBatchInput): Promise<{ ok: true; raw: unknown }> {
    const items = (input.items ?? []).map((it: any) => ({
      title: it.title,
      content: it.content,
      namespace: it.namespace,
      sourceType: it.source_type ?? it.sourceType,
      metadata: it.metadata ?? {},
      priority: it.priority,
      createdAt: it.created_at ?? it.createdAt,
      updatedAt: it.updated_at ?? it.updatedAt,
      documentId: it.document_id,
    }));
    const res = await this.client.insertDocumentsBatch({ items });
    return { ok: true, raw: res };
  }

  async listDocuments(input: ListDocumentsInput): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.listDocuments({
      namespace: input.namespace,
      limit: input.limit,
      offset: input.offset,
    });
    return { ok: true, raw: res };
  }

  async getDocument(input: GetDocumentInput): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.getDocument({
      documentId: input.document_id,
      namespace: input.namespace,
    });
    return { ok: true, raw: res };
  }

  async deleteDocument(input: DeleteDocumentInput): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.deleteDocument({
      documentId: input.document_id,
      namespace: input.namespace,
    });
    return { ok: true, raw: res };
  }

  async queryMemoryContext(
    input: QueryMemoryContextInput,
  ): Promise<{ ok: true; namespace: string; context: string; raw: unknown }> {
    const namespace = input.namespace?.trim() || this.defaultNamespace;
    const res = await this.client.queryMemoryContext({
      query: input.query,
      includeReferences: input.include_references,
      namespace,
      maxChunks: input.max_chunks,
      documentIds: input.document_ids,
      recallOnly: input.recall_only,
      llmQuery: input.llm_query,
    });
    const data = (res as any)?.data ?? {};
    return { ok: true, namespace, context: this.extractContext(data), raw: data };
  }

  async chatMemoryContext(
    input: ChatMemoryContextInput,
  ): Promise<{ ok: true; content: string; raw: unknown }> {
    const res = await this.client.chatMemoryContext({
      messages: input.messages,
      temperature: input.temperature,
      maxTokens: input.max_tokens,
    } as any);
    const content = (res as any)?.data?.content;
    return { ok: true, content: typeof content === "string" ? content : "", raw: res };
  }

  async recordInteractions(input: RecordInteractionsInput): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.recordInteractions({
      namespace: input.namespace,
      entityNames: input.entity_names,
      description: input.description,
      interactionLevel: input.interaction_level,
      interactionLevels: input.interaction_levels,
      timestamp: input.timestamp,
    } as any);
    return { ok: true, raw: res };
  }

  async recallThoughts(input: RecallThoughtsInput): Promise<{ ok: true; thought?: string; raw: unknown }> {
    const res = await this.client.recallThoughts({
      namespace: input.namespace,
      maxChunks: input.max_chunks,
      temperature: input.temperature,
      randomnessSeed: input.randomness_seed,
      persist: input.persist,
      enablePredictionCheck: input.enable_prediction_check,
      thoughtPrompt: input.thought_prompt,
    } as any);
    const thought = (res as any)?.data?.thought;
    return { ok: true, thought: typeof thought === "string" ? thought : undefined, raw: res };
  }

  async chatMemory(input: ChatMemoryInput): Promise<{ ok: true; content: string; raw: unknown }> {
    const res = await this.client.chatMemory({
      messages: input.messages,
      temperature: input.temperature,
      maxTokens: input.max_tokens,
    } as any);
    const content = (res as any)?.data?.content;
    return { ok: true, content: typeof content === "string" ? content : "", raw: res };
  }

  async interactMemory(input: InteractMemoryInput): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.interactMemory({
      namespace: input.namespace,
      entityNames: input.entity_names,
      description: input.description,
      interactionLevel: input.interaction_level,
      interactionLevels: input.interaction_levels,
      timestamp: input.timestamp,
    } as any);
    return { ok: true, raw: res };
  }

  async recallMemoryMaster(
    input: RecallMemoryMasterInput,
  ): Promise<{ ok: true; namespace: string; context: string; raw: unknown }> {
    const namespace = input.namespace?.trim() || this.defaultNamespace;
    const res = await this.client.recallMemory({ namespace, maxChunks: input.max_chunks });
    const data = (res as any)?.data ?? {};
    return { ok: true, namespace, context: this.extractContext(data), raw: data };
  }

  async recallMemories(input: RecallMemoriesInput): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.recallMemories({
      namespace: input.namespace,
      topK: input.top_k,
      minRetention: input.min_retention,
      asOf: input.as_of,
    });
    return { ok: true, raw: res };
  }

  async getIngestionJob(input: GetIngestionJobInput): Promise<{ ok: true; raw: unknown }> {
    const res = await this.client.getIngestionJob(input.job_id);
    return { ok: true, raw: res };
  }

  /**
   * Tools you can register with Mastra.
   *
   * The names and schemas are stable; credentials never flow through tool params.
   */
  getTools(): Array<MastraTool<any, any>> {
    return [
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_save_memory,
        execute: (params: SaveMemoryInput) => this.saveMemory(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_recall_memory,
        execute: (params: RecallMemoryInput) => this.recallMemory(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_delete_memory,
        execute: (params: DeleteMemoryInput) => this.deleteMemory(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_sync_memory,
        execute: (params: SyncMemoryInput) => this.syncMemory(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_insert_document,
        execute: (params: InsertDocumentInput) => this.insertDocument(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_insert_documents_batch,
        execute: (params: InsertDocumentsBatchInput) => this.insertDocumentsBatch(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_list_documents,
        execute: (params: ListDocumentsInput) => this.listDocuments(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_get_document,
        execute: (params: GetDocumentInput) => this.getDocument(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_delete_document,
        execute: (params: DeleteDocumentInput) => this.deleteDocument(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_query_memory_context,
        execute: (params: QueryMemoryContextInput) => this.queryMemoryContext(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_chat_memory_context,
        execute: (params: ChatMemoryContextInput) => this.chatMemoryContext(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_record_interactions,
        execute: (params: RecordInteractionsInput) => this.recordInteractions(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_recall_thoughts,
        execute: (params: RecallThoughtsInput) => this.recallThoughts(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_chat_memory,
        execute: (params: ChatMemoryInput) => this.chatMemory(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_interact_memory,
        execute: (params: InteractMemoryInput) => this.interactMemory(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_recall_memory_master,
        execute: (params: RecallMemoryMasterInput) => this.recallMemoryMaster(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_recall_memories,
        execute: (params: RecallMemoriesInput) => this.recallMemories(params),
      },
      {
        ...NEOCORTEX_MASTRA_TOOL_SCHEMAS.neocortex_get_ingestion_job,
        execute: (params: GetIngestionJobInput) => this.getIngestionJob(params),
      },
    ];
  }
}

