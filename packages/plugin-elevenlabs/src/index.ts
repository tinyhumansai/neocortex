import { NeocortexMemoryClient } from "./client";
import {
  NeocortexConfig,
  NamespaceStrategy,
  SaveMemoryRequest,
  RecallMemoryRequest,
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

    const res = await this.client.insertMemory({
      title: req.key,
      content: req.content,
      namespace,
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

    const res = await this.client.queryMemory({
      query: req.query,
      namespace,
      maxChunks: req.max_chunks ?? 5,
    });

    const data = res.data;
    const context = data.llmContextMessage || data.response;

    if (context) {
      return { ok: true, context, namespace, data };
    }

    const chunks = data.context?.chunks || [];
    const text = chunks
      .map((c: any) => c.content || c.text || "")
      .filter(Boolean)
      .join("\n\n");

    return {
      ok: true,
      context: text || "No relevant memories found.",
      namespace,
      data,
    };
  }
}
