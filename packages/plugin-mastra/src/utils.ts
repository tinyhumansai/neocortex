import type { MastraTool } from "./types";

const DEFAULT_BASE_URL = "https://api.tinyhumans.ai";

export function getEnv(key: string): string | undefined {
  try {
    const g = typeof globalThis !== "undefined" ? globalThis : (undefined as unknown as Record<string, unknown>);
    const env = (g as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    return env?.[key];
  } catch {
    return undefined;
  }
}

export function resolveBaseUrl(explicit?: string): string {
  const baseUrl = explicit ?? getEnv("TINYHUMANS_BASE_URL") ?? DEFAULT_BASE_URL;
  return baseUrl.replace(/\/+$/, "");
}

/** Lightweight JSON schema helper for simple “object with properties”. */
export function objectSchema(input: {
  description?: string;
  properties: Record<string, Record<string, unknown>>;
  required?: string[];
}): Record<string, unknown> {
  return {
    type: "object",
    description: input.description,
    properties: input.properties,
    required: input.required ?? [],
  };
}

export const NEOCORTEX_MASTRA_TOOL_SCHEMAS = {
  neocortex_save_memory: {
    name: "neocortex_save_memory",
    description: "Save a piece of important information into long-term memory.",
    parameters: objectSchema({
      properties: {
        namespace: { type: "string", description: "Optional namespace override." },
        key: { type: "string", description: "Short key/title for the memory." },
        content: { type: "string", description: "The content to remember." },
        metadata: { type: "object", description: "Optional metadata object." },
      },
      required: ["key", "content"],
    }),
  },
  neocortex_recall_memory: {
    name: "neocortex_recall_memory",
    description: "Recall relevant long-term memory for the given query.",
    parameters: objectSchema({
      properties: {
        namespace: { type: "string", description: "Optional namespace override." },
        query: { type: "string", description: "Natural-language query for memory." },
        max_chunks: { type: "integer", description: "Max number of chunks to retrieve." },
      },
      required: ["query"],
    }),
  },
  neocortex_delete_memory: {
    name: "neocortex_delete_memory",
    description: "Delete all memory in a namespace (admin delete).",
    parameters: objectSchema({
      properties: {
        namespace: { type: "string", description: "Namespace to delete. If omitted, backend decides scope." },
      },
      required: [],
    }),
  },
  neocortex_sync_memory: {
    name: "neocortex_sync_memory",
    description: "Sync OpenClaw memory files (POST /v1/memory/sync).",
    parameters: objectSchema({
      properties: {
        workspace_id: { type: "string", description: "Workspace identifier." },
        agent_id: { type: "string", description: "Agent identifier." },
        source: { type: "string", description: "Optional source: startup | agent_end." },
        files: {
          type: "array",
          description: "Files to sync.",
          items: { type: "object" },
        },
      },
      required: ["workspace_id", "agent_id", "files"],
    }),
  },
  neocortex_insert_document: {
    name: "neocortex_insert_document",
    description: "Insert a single memory document (POST /v1/memory/documents).",
    parameters: objectSchema({
      properties: {
        title: { type: "string", description: "Document title." },
        content: { type: "string", description: "Document content." },
        namespace: { type: "string", description: "Namespace." },
        source_type: { type: "string", description: "Optional sourceType: doc | chat | email." },
        metadata: { type: "object", description: "Optional metadata." },
        priority: { type: "string", description: "Optional priority: high | medium | low." },
        created_at: { type: "number", description: "Optional Unix timestamp (seconds)." },
        updated_at: { type: "number", description: "Optional Unix timestamp (seconds)." },
        document_id: { type: "string", description: "Document id." },
      },
      required: ["title", "content", "namespace", "document_id"],
    }),
  },
  neocortex_insert_documents_batch: {
    name: "neocortex_insert_documents_batch",
    description: "Insert multiple memory documents (POST /v1/memory/documents/batch).",
    parameters: objectSchema({
      properties: {
        items: { type: "array", description: "Document items.", items: { type: "object" } },
      },
      required: ["items"],
    }),
  },
  neocortex_list_documents: {
    name: "neocortex_list_documents",
    description: "List ingested documents (GET /v1/memory/documents).",
    parameters: objectSchema({
      properties: {
        namespace: { type: "string", description: "Optional namespace." },
        limit: { type: "integer", description: "Optional page size." },
        offset: { type: "integer", description: "Optional page offset." },
      },
      required: [],
    }),
  },
  neocortex_get_document: {
    name: "neocortex_get_document",
    description: "Get a memory document (GET /v1/memory/documents/:documentId).",
    parameters: objectSchema({
      properties: {
        document_id: { type: "string", description: "Document id." },
        namespace: { type: "string", description: "Optional namespace." },
      },
      required: ["document_id"],
    }),
  },
  neocortex_delete_document: {
    name: "neocortex_delete_document",
    description: "Delete a memory document (DELETE /v1/memory/documents/:documentId?namespace=...).",
    parameters: objectSchema({
      properties: {
        document_id: { type: "string", description: "Document id." },
        namespace: { type: "string", description: "Namespace." },
      },
      required: ["document_id", "namespace"],
    }),
  },
  neocortex_query_memory_context: {
    name: "neocortex_query_memory_context",
    description: "Query memory context (POST /v1/memory/queries).",
    parameters: objectSchema({
      properties: {
        query: { type: "string", description: "Query string." },
        namespace: { type: "string", description: "Optional namespace." },
        include_references: { type: "boolean", description: "Include references." },
        max_chunks: { type: "integer", description: "Optional chunk limit." },
        document_ids: { type: "array", description: "Optional document filters.", items: { type: "string" } },
        recall_only: { type: "boolean", description: "Recall-only mode." },
        llm_query: { type: "string", description: "Optional LLM query override." },
      },
      required: ["query"],
    }),
  },
  neocortex_chat_memory_context: {
    name: "neocortex_chat_memory_context",
    description: "Chat with memory context (POST /v1/memory/conversations).",
    parameters: objectSchema({
      properties: {
        messages: { type: "array", description: "Messages (role/content).", items: { type: "object" } },
        temperature: { type: "number", description: "Optional temperature." },
        max_tokens: { type: "integer", description: "Optional max tokens." },
      },
      required: ["messages"],
    }),
  },
  neocortex_record_interactions: {
    name: "neocortex_record_interactions",
    description: "Record interactions (POST /v1/memory/interactions).",
    parameters: objectSchema({
      properties: {
        namespace: { type: "string", description: "Namespace." },
        entity_names: { type: "array", description: "Entity names.", items: { type: "string" } },
        description: { type: "string", description: "Optional description." },
        interaction_level: { type: "string", description: "Optional interaction level." },
        interaction_levels: { type: "array", description: "Optional multiple interaction levels.", items: { type: "string" } },
        timestamp: { type: "number", description: "Optional timestamp." },
      },
      required: ["namespace", "entity_names"],
    }),
  },
  neocortex_recall_thoughts: {
    name: "neocortex_recall_thoughts",
    description: "Generate reflective thoughts (POST /v1/memory/memories/thoughts).",
    parameters: objectSchema({
      properties: {
        namespace: { type: "string", description: "Optional namespace." },
        max_chunks: { type: "integer", description: "Optional max chunks." },
        temperature: { type: "number", description: "Optional temperature." },
        randomness_seed: { type: "integer", description: "Optional randomness seed." },
        persist: { type: "boolean", description: "Optional persist." },
        enable_prediction_check: { type: "boolean", description: "Optional enablePredictionCheck." },
        thought_prompt: { type: "string", description: "Optional thoughtPrompt." },
      },
      required: [],
    }),
  },
  neocortex_chat_memory: {
    name: "neocortex_chat_memory",
    description: "Chat with memory cache (POST /v1/memory/chat).",
    parameters: objectSchema({
      properties: {
        messages: { type: "array", description: "Messages (role/content).", items: { type: "object" } },
        temperature: { type: "number", description: "Optional temperature." },
        max_tokens: { type: "integer", description: "Optional max tokens." },
      },
      required: ["messages"],
    }),
  },
  neocortex_interact_memory: {
    name: "neocortex_interact_memory",
    description: "Record interactions (core) (POST /v1/memory/interact).",
    parameters: objectSchema({
      properties: {
        namespace: { type: "string", description: "Namespace." },
        entity_names: { type: "array", description: "Entity names.", items: { type: "string" } },
        description: { type: "string", description: "Optional description." },
        interaction_level: { type: "string", description: "Optional interaction level." },
        interaction_levels: { type: "array", description: "Optional multiple interaction levels.", items: { type: "string" } },
        timestamp: { type: "number", description: "Optional timestamp." },
      },
      required: ["namespace", "entity_names"],
    }),
  },
  neocortex_recall_memory_master: {
    name: "neocortex_recall_memory_master",
    description: "Recall context from master node (POST /v1/memory/recall).",
    parameters: objectSchema({
      properties: {
        namespace: { type: "string", description: "Optional namespace." },
        max_chunks: { type: "integer", description: "Optional max chunks." },
      },
      required: [],
    }),
  },
  neocortex_recall_memories: {
    name: "neocortex_recall_memories",
    description: "Recall memories from Ebbinghaus bank (POST /v1/memory/memories/recall).",
    parameters: objectSchema({
      properties: {
        namespace: { type: "string", description: "Optional namespace." },
        top_k: { type: "number", description: "Optional topK." },
        min_retention: { type: "number", description: "Optional minRetention." },
        as_of: { type: "number", description: "Optional asOf timestamp." },
      },
      required: [],
    }),
  },
  neocortex_get_ingestion_job: {
    name: "neocortex_get_ingestion_job",
    description: "Get ingestion job status (GET /v1/memory/ingestion/jobs/:jobId).",
    parameters: objectSchema({
      properties: {
        job_id: { type: "string", description: "Job id." },
      },
      required: ["job_id"],
    }),
  },
  neocortex_get_graph_snapshot: {
    name: "neocortex_get_graph_snapshot",
    description: "Get admin graph snapshot (GET /v1/memory/admin/graph-snapshot).",
    parameters: objectSchema({
      properties: {
        namespace: { type: "string", description: "Optional namespace." },
        mode: { type: "string", description: "Optional mode (master|latest_chunks)." },
        limit: { type: "integer", description: "Optional limit." },
        seed_limit: { type: "integer", description: "Optional seed limit." },
      },
      required: [],
    }),
  },
} as const satisfies Record<string, Omit<MastraTool, "execute">>;

