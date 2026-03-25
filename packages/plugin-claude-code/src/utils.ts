const DEFAULT_BASE_URL = "https://api.tinyhumans.ai";

export function getEnv(name: string): string | undefined {
  try {
    const g =
      typeof globalThis !== "undefined"
        ? globalThis
        : ((undefined as unknown) as Record<string, unknown>);
    const env = (g as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    return env?.[name];
  } catch {
    return undefined;
  }
}

export function resolveBaseUrl(explicit?: string): string {
  const baseUrl = explicit ?? getEnv("TINYHUMANS_BASE_URL") ?? DEFAULT_BASE_URL;
  return baseUrl.replace(/\/+$/, "");
}

export const NEOCORTEX_MASTRA_TOOL_SCHEMAS = {
  neocortex_save_memory: {
    name: "neocortex_save_memory",
    description: "Save a piece of important information into long-term memory.",
  },
  neocortex_recall_memory: {
    name: "neocortex_recall_memory",
    description: "Recall relevant long-term memory for the given query.",
  },
  neocortex_delete_memory: {
    name: "neocortex_delete_memory",
    description: "Delete all memory in a namespace (admin delete).",
  },
  neocortex_sync_memory: {
    name: "neocortex_sync_memory",
    description: "Sync OpenClaw memory files (POST /v1/memory/sync).",
  },
  neocortex_insert_document: {
    name: "neocortex_insert_document",
    description: "Insert a single memory document (POST /v1/memory/documents).",
  },
  neocortex_insert_documents_batch: {
    name: "neocortex_insert_documents_batch",
    description: "Insert multiple memory documents (POST /v1/memory/documents/batch).",
  },
  neocortex_list_documents: {
    name: "neocortex_list_documents",
    description: "List ingested documents (GET /v1/memory/documents).",
  },
  neocortex_get_document: {
    name: "neocortex_get_document",
    description: "Get a memory document (GET /v1/memory/documents/:documentId).",
  },
  neocortex_delete_document: {
    name: "neocortex_delete_document",
    description:
      "Delete a memory document (DELETE /v1/memory/documents/:documentId?namespace=...).",
  },
  neocortex_query_memory_context: {
    name: "neocortex_query_memory_context",
    description: "Query memory context (POST /v1/memory/queries).",
  },
  neocortex_chat_memory_context: {
    name: "neocortex_chat_memory_context",
    description: "Chat with memory context (POST /v1/memory/conversations).",
  },
  neocortex_record_interactions: {
    name: "neocortex_record_interactions",
    description: "Record interactions (POST /v1/memory/interactions).",
  },
  neocortex_recall_thoughts: {
    name: "neocortex_recall_thoughts",
    description: "Generate reflective thoughts (POST /v1/memory/memories/thoughts).",
  },
  neocortex_chat_memory: {
    name: "neocortex_chat_memory",
    description: "Chat with memory cache (POST /v1/memory/chat).",
  },
  neocortex_interact_memory: {
    name: "neocortex_interact_memory",
    description: "Record interactions (core) (POST /v1/memory/interact).",
  },
  neocortex_recall_memory_master: {
    name: "neocortex_recall_memory_master",
    description: "Recall context from master node (POST /v1/memory/recall).",
  },
  neocortex_recall_memories: {
    name: "neocortex_recall_memories",
    description: "Recall memories from Ebbinghaus bank (POST /v1/memory/memories/recall).",
  },
  neocortex_get_ingestion_job: {
    name: "neocortex_get_ingestion_job",
    description: "Get ingestion job status (GET /v1/memory/ingestion/jobs/:jobId).",
  },
} as const;

