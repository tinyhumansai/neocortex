import { NeocortexMemoryClient } from "./client";
import {
  NeocortexConfig,
  NamespaceStrategy,
  SaveMemoryRequest,
  RecallMemoryRequest,
  QueryMemoryResponse,
  QueryMemoryResponseData,
} from "./types";
import { defaultNamespaceStrategy } from "./utils";

export * from "./types";
export * from "./utils";

export interface ElevenLabsNeocortexConfig extends NeocortexConfig {
  /** Optional strategy to derive a Neocortex namespace from ElevenLabs context. */
  namespaceStrategy?: NamespaceStrategy;
}

/**
 * ElevenLabsNeocortexMemory
 * 
 * Provides memory tools for ElevenLabs agents powered by Neocortex.
 * Supports both Client-side Tools (direct SDK integration) and Server-side Tools (webhooks).
 */
export class ElevenLabsNeocortexMemory {
  private readonly client: NeocortexMemoryClient;
  private readonly namespaceFor: NamespaceStrategy;

  constructor(config: ElevenLabsNeocortexConfig) {
    this.client = new NeocortexMemoryClient(config);
    this.namespaceFor = config.namespaceStrategy ?? defaultNamespaceStrategy;
  }

  /**
   * Returns client-side tool handlers for ElevenLabs SDK.
   * 
   * @example
   * ```ts
   * const conversation = await Conversation.startSession({
   *   agentId: "...",
   *   clientTools: memory.getClientTools(),
   * });
   * ```
   */
  getClientTools(): Record<string, (parameters: any) => Promise<string>> {
    return {
      addMemories: async (params: any) => {
        try {
          const res = await this.handleSaveTool({
            key: params.key || "memory",
            document_id: params.document_id || params.key || "memory",
            content: params.message || params.content || "",
            namespace: params.namespace,
            user_id: params.user_id,
            conversation_id: params.conversation_id,
          });
          return res.message;
        } catch (err: any) {
          return `Error saving memory: ${err.message}`;
        }
      },

      retrieveMemories: async (params: any) => {
        try {
          const res = await this.handleRecallTool({
            query: params.message || params.query || "",
            namespace: params.namespace,
            user_id: params.user_id,
            conversation_id: params.conversation_id,
            max_chunks: params.max_chunks,
          });
          return res.context;
        } catch (err: any) {
          return `Error recalling memory: ${err.message}`;
        }
      },
    };
  }

  /**
   * Handler for server-side webhook tools.
   */
  async handleSaveTool(req: SaveMemoryRequest) {
    const namespace = this.namespaceFor({
      explicitNamespace: req.namespace,
      userId: req.user_id,
      conversationId: req.conversation_id,
      phoneNumber: req.phone_number,
    });

    const documentId = req.document_id?.trim() || req.key;
    const res = await this.client.insertMemory({
      title: req.key,
      content: req.content,
      namespace,
      documentId,
      metadata: req.metadata,
    });

    return {
      ok: true,
      message: "Memory saved successfully",
      namespace,
      data: res.data,
    };
  }

  /**
   * Handler for server-side webhook tools.
   */
  async handleRecallTool(req: RecallMemoryRequest) {
    const namespace = this.namespaceFor({
      explicitNamespace: req.namespace,
      userId: req.user_id,
      conversationId: req.conversation_id,
      phoneNumber: req.phone_number,
    });

    const query = typeof req.query === "string" ? req.query.trim() : "";
    if (!query) {
      return {
        ok: true,
        context: "No search text was provided.",
        namespace,
        data: { cached: false } as QueryMemoryResponseData,
      };
    }

    const res = await this.client.queryMemory({
      query,
      namespace,
      maxChunks: req.max_chunks ?? 5,
    });

    const raw = res?.data;
    const data =
      raw && typeof raw === "object"
        ? raw
        : ({} as QueryMemoryResponse["data"]);

    const context = data.llmContextMessage || data.response;

    if (context) {
      return { ok: true, context: String(context), namespace, data };
    }

    const chunkList = data.context?.chunks;
    const chunks = Array.isArray(chunkList) ? chunkList : [];
    const text = chunks
      .map((c: { content?: unknown; text?: unknown }) =>
        String(c?.content ?? c?.text ?? ""),
      )
      .filter(Boolean)
      .join("\n\n");

    return {
      ok: true,
      context: text || "No relevant memories found.",
      namespace,
      data,
    };
  }

  // Advanced endpoint wrappers
  async listDocuments(req: { namespace?: string; user_id?: string; conversation_id?: string; phone_number?: string; limit?: number; offset?: number }) {
    const namespace = this.namespaceFor({
      explicitNamespace: req.namespace,
      userId: req.user_id,
      conversationId: req.conversation_id,
      phoneNumber: req.phone_number,
    });
    return this.client.listDocuments({ namespace, limit: req.limit, offset: req.offset });
  }

  async getDocument(req: { document_id: string; namespace?: string; user_id?: string; conversation_id?: string; phone_number?: string }) {
    const namespace = this.namespaceFor({
      explicitNamespace: req.namespace,
      userId: req.user_id,
      conversationId: req.conversation_id,
      phoneNumber: req.phone_number,
    });
    return this.client.getDocument({ documentId: req.document_id, namespace });
  }

  async deleteDocument(req: { document_id: string; namespace?: string; user_id?: string; conversation_id?: string; phone_number?: string }) {
    const namespace = this.namespaceFor({
      explicitNamespace: req.namespace,
      userId: req.user_id,
      conversationId: req.conversation_id,
      phoneNumber: req.phone_number,
    });
    return this.client.deleteDocument({ documentId: req.document_id, namespace });
  }

  async recallMemoryMaster(req: { query: string; namespace?: string; user_id?: string; conversation_id?: string; phone_number?: string }) {
    const namespace = this.namespaceFor({
      explicitNamespace: req.namespace,
      userId: req.user_id,
      conversationId: req.conversation_id,
      phoneNumber: req.phone_number,
    });
    return this.client.recallMemory({ query: req.query, namespace });
  }

  async recallMemories(req: {
    query: string;
    namespace?: string;
    user_id?: string;
    conversation_id?: string;
    phone_number?: string;
    include_references?: boolean;
    max_chunks?: number;
  }) {
    const namespace = this.namespaceFor({
      explicitNamespace: req.namespace,
      userId: req.user_id,
      conversationId: req.conversation_id,
      phoneNumber: req.phone_number,
    });
    return this.client.recallMemories({
      query: req.query,
      namespace,
      includeReferences: req.include_references,
      maxChunks: req.max_chunks,
    });
  }

  async getIngestionJob(req: { job_id: string }) {
    return this.client.getIngestionJob({ jobId: req.job_id });
  }
}
