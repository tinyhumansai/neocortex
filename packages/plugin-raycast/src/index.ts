import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

export interface RaycastNeocortexConfig extends NeocortexConfig {
  /** Default namespace when one is not provided by the caller. */
  defaultNamespace?: string;
}

export class RaycastNeocortexMemory {
  private readonly client: NeocortexMemoryClient;
  private readonly defaultNamespace: string;

  constructor(config: RaycastNeocortexConfig) {
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
      const text =
        (chunk as any).content ?? (chunk as any).text ?? (chunk as any).body ?? "";
      if (typeof text === "string" && text.trim()) texts.push(text.trim());
    }

    return texts.length ? texts.join("\n\n") : "No relevant memories found.";
  }

  async syncMemory(input: any) {
    const raw = await this.client.syncMemory(input);
    return { ok: true as const, raw };
  }

  async insertDocument(input: any) {
    const raw = await this.client.insertDocument(input);
    return { ok: true as const, raw };
  }

  async insertDocumentsBatch(input: any) {
    const raw = await this.client.insertDocumentsBatch(input);
    return { ok: true as const, raw };
  }

  async listDocuments(input: any) {
    const raw = await this.client.listDocuments(input);
    return { ok: true as const, raw };
  }

  async getDocument(input: any) {
    const raw = await this.client.getDocument(input);
    return { ok: true as const, raw };
  }

  async deleteDocument(input: any) {
    const raw = await this.client.deleteDocument(input);
    return { ok: true as const, raw };
  }

  async queryMemoryContext(input: any) {
    const namespace = this.resolveNamespace(input.namespace);
    const rawRes = await this.client.queryMemoryContext({ ...input, namespace });
    const data = rawRes?.data ?? rawRes;
    return {
      ok: true as const,
      namespace,
      context: this.extractContext(data),
      raw: data,
    };
  }

  async chatMemoryContext(input: any) {
    const rawRes = await this.client.chatMemoryContext(input);
    const data = rawRes?.data ?? rawRes;
    const content = typeof data?.content === "string" ? data.content : "";
    return { ok: true as const, content, raw: data };
  }

  async recordInteractions(input: any) {
    const raw = await this.client.recordInteractions(input);
    return { ok: true as const, raw };
  }

  async recallThoughts(input: any) {
    const rawRes = await this.client.recallThoughts(input);
    const data = rawRes?.data ?? rawRes;
    return { ok: true as const, thought: data?.thought, raw: data };
  }

  async chatMemory(input: any) {
    const rawRes = await this.client.chatMemory(input);
    const data = rawRes?.data ?? rawRes;
    const content = typeof data?.content === "string" ? data.content : "";
    return { ok: true as const, content, raw: data };
  }

  async interactMemory(input: any) {
    const raw = await this.client.interactMemory(input);
    return { ok: true as const, raw };
  }

  async recallMemoryMaster(input: any) {
    const namespace = this.resolveNamespace(input.namespace);
    const rawRes = await this.client.recallMemoryMaster({ ...input, namespace });
    const data = rawRes?.data ?? rawRes;
    return {
      ok: true as const,
      namespace,
      context: this.extractContext(data),
      raw: data,
    };
  }

  async recallMemories(input: any) {
    const raw = await this.client.recallMemories(input);
    return { ok: true as const, raw };
  }

  async getIngestionJob(input: any) {
    const raw = await this.client.getIngestionJob(input);
    return { ok: true as const, raw };
  }

  /**
   * MCP tool definitions that can be registered on a Model Context Protocol server
   * for consumption by Raycast via the Raycast MCP extension.
   */
  getMcpTools() {
    const saveMemorySchema = z.object({
      namespace: z.string().optional().describe("Optional namespace override."),
      key: z.string().describe("Short key/title for the memory."),
      content: z.string().describe("The content to remember."),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("Optional JSON-serializable metadata."),
    });

    const recallMemorySchema = z.object({
      namespace: z.string().optional().describe("Optional namespace override."),
      query: z.string().describe("Natural-language query for memory."),
      max_chunks: z
        .number()
        .int()
        .optional()
        .describe("Maximum number of memory chunks to retrieve (default 10)."),
    });

    const deleteMemorySchema = z.object({
      namespace: z.string().optional().describe("Namespace to delete."),
    });

    const syncMemorySchema = z.object({
      workspace_id: z.string().describe("Workspace identifier."),
      agent_id: z.string().describe("Agent identifier."),
      source: z.enum(["startup", "agent_end"]).optional(),
      files: z.array(
        z.object({
          file_path: z.string().optional(),
          content: z.string(),
          timestamp: z.union([z.string(), z.number()]).optional(),
          hash: z.string(),
        })
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
      items: z.array(insertDocumentSchema),
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

    const chatMemorySchema = chatMemoryContextSchema;

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

    const getIngestionJobSchema = z.object({
      job_id: z.string(),
    });

    return [
      {
        name: "neocortex_save_memory",
        description: "Save a user preference or important fact into Neocortex memory.",
        inputSchema: saveMemorySchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = saveMemorySchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.saveMemory(input);
        },
      },
      {
        name: "neocortex_recall_memory",
        description: "Recall relevant long-term memory for a given query from Neocortex.",
        inputSchema: recallMemorySchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = recallMemorySchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.recallMemory(input);
        },
      },
      {
        name: "neocortex_delete_memory",
        description: "Delete all Neocortex memory in a namespace (admin delete).",
        inputSchema: deleteMemorySchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = deleteMemorySchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.deleteMemory(input);
        },
      },
      {
        name: "neocortex_sync_memory",
        description: "Sync OpenClaw memory files (POST /v1/memory/sync).",
        inputSchema: syncMemorySchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = syncMemorySchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.syncMemory(input);
        },
      },
      {
        name: "neocortex_insert_document",
        description: "Insert a single memory document (POST /v1/memory/documents).",
        inputSchema: insertDocumentSchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = insertDocumentSchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.insertDocument(input);
        },
      },
      {
        name: "neocortex_insert_documents_batch",
        description: "Insert multiple memory documents (POST /v1/memory/documents/batch).",
        inputSchema: insertDocumentsBatchSchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = insertDocumentsBatchSchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.insertDocumentsBatch(input);
        },
      },
      {
        name: "neocortex_list_documents",
        description: "List ingested documents (GET /v1/memory/documents).",
        inputSchema: listDocumentsSchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = listDocumentsSchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.listDocuments(input);
        },
      },
      {
        name: "neocortex_get_document",
        description: "Get a memory document (GET /v1/memory/documents/:documentId).",
        inputSchema: getDocumentSchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = getDocumentSchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.getDocument(input);
        },
      },
      {
        name: "neocortex_delete_document",
        description: "Delete a memory document (DELETE /v1/memory/documents/:documentId?namespace=...).",
        inputSchema: deleteDocumentSchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = deleteDocumentSchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.deleteDocument(input);
        },
      },
      {
        name: "neocortex_query_memory_context",
        description: "Query memory context (POST /v1/memory/queries).",
        inputSchema: queryMemoryContextSchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = queryMemoryContextSchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.queryMemoryContext(input);
        },
      },
      {
        name: "neocortex_chat_memory_context",
        description: "Chat with memory context (POST /v1/memory/conversations).",
        inputSchema: chatMemoryContextSchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = chatMemoryContextSchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.chatMemoryContext(input);
        },
      },
      {
        name: "neocortex_record_interactions",
        description: "Record interactions (POST /v1/memory/interactions).",
        inputSchema: recordInteractionsSchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = recordInteractionsSchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.recordInteractions(input);
        },
      },
      {
        name: "neocortex_recall_thoughts",
        description: "Generate reflective thoughts (POST /v1/memory/memories/thoughts).",
        inputSchema: recallThoughtsSchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = recallThoughtsSchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.recallThoughts(input);
        },
      },
      {
        name: "neocortex_chat_memory",
        description: "Chat with memory cache (POST /v1/memory/chat).",
        inputSchema: chatMemorySchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = chatMemorySchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.chatMemory(input);
        },
      },
      {
        name: "neocortex_interact_memory",
        description: "Record entity interactions (POST /v1/memory/interact).",
        inputSchema: interactMemorySchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = interactMemorySchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.interactMemory(input);
        },
      },
      {
        name: "neocortex_recall_memory_master",
        description: "Recall context from the master node (POST /v1/memory/recall).",
        inputSchema: recallMemoryMasterSchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = recallMemoryMasterSchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.recallMemoryMaster(input);
        },
      },
      {
        name: "neocortex_recall_memories",
        description: "Recall memories from the Ebbinghaus bank (POST /v1/memory/memories/recall).",
        inputSchema: recallMemoriesSchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = recallMemoriesSchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.recallMemories(input);
        },
      },
      {
        name: "neocortex_get_ingestion_job",
        description: "Get ingestion job status (GET /v1/memory/ingestion/jobs/:jobId).",
        inputSchema: getIngestionJobSchema,
        async handler(args: unknown, { server }: { server: McpServer }) {
          const input = getIngestionJobSchema.parse(args);
          const memory = (server as any).__memory as RaycastNeocortexMemory;
          return await memory.getIngestionJob(input);
        },
      },
    ];
  }
}

/**
 * Convenience entry point to run a Neocortex memory MCP server over stdio.
 *
 * Intended usage from Raycast's MCP Extension configuration:
 *
 *   Command: node
 *   Args: ["./node_modules/@neocortex/plugin-raycast/dist/index.js"]
 *
 * Then set TINYHUMANS_API_KEY / TINYHUMANS_BASE_URL in the environment for the Raycast MCP process.
 */
export async function runNeocortexMcpServerFromEnv() {
  const token =
    process.env.TINYHUMANS_API_KEY ||
    process.env.NEOCORTEX_API_KEY ||
    process.env.NEOCORTEX_TOKEN;

  if (!token || !token.trim()) {
    throw new Error(
      "Neocortex token is required. Set TINYHUMANS_API_KEY, NEOCORTEX_API_KEY, or NEOCORTEX_TOKEN."
    );
  }

  const memory = new RaycastNeocortexMemory({
    token,
    baseUrl: process.env.TINYHUMANS_BASE_URL || process.env.NEOCORTEX_BASE_URL,
  });

  const server = new McpServer({
    name: "neocortex-raycast-memory-mcp",
    version: "0.1.0",
  });

  // Attach memory instance to server so tool handlers can access it.
  (server as any).__memory = memory;

  for (const tool of memory.getMcpTools()) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      tool.handler as any
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Allow running as `node dist/index.js` directly.
if (typeof process !== "undefined" && process.argv[1]?.endsWith("index.js")) {
  // eslint-disable-next-line no-void
  void runNeocortexMcpServerFromEnv();
}

